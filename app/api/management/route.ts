import { NextResponse } from 'next/server';
import { isAdmin } from '../../admin-auth';
import { getDb } from '../../../db';
import { events, guestTables, guests, settings } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { planGuestImport } from '../../../lib/guest-import';
import { hashPasscode } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

function getSlug(request: Request) {
  const url = new URL(request.url);
  return (url.searchParams.get('slug') || request.headers.get('x-event-slug') || 'emerson').toLowerCase().trim();
}

async function getEventAndId(db: ReturnType<typeof getDb>, slug: string) {
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (event) return { event, eventId: event.id };
  return { event: null, eventId: 1 };
}

export async function GET(request: Request) {
  const slug = getSlug(request);
  if (!await isAdmin(slug)) return NextResponse.json({ error: 'Acesso reservado ao administrador' }, { status: 403 });

  try {
    const db = getDb();
    const { event, eventId } = await getEventAndId(db, slug);

    const [tables, people, prefs] = await Promise.all([
      db.select().from(guestTables).where(eq(guestTables.eventId, eventId)),
      db.select().from(guests).where(eq(guests.eventId, eventId)),
      db.select().from(settings),
    ]);

    const settingsObj = Object.fromEntries(prefs.map((x: any) => [x.key, x.value]));
    if (event) {
      settingsObj.eventName = event.title;
      settingsObj.eventDate = event.eventDate;
      settingsObj.venue = event.venue;
      settingsObj.hostName = event.hostName;
      settingsObj.description = event.description;
      settingsObj.slug = event.slug;
      settingsObj.passcode = '';
      settingsObj.photoAlbumUrl = event.photoAlbumUrl || '';
    }

    return NextResponse.json({
      tables,
      guests: people,
      settings: settingsObj,
      event: event ? {
        id: event.id,
        slug: event.slug,
        title: event.title,
        hostName: event.hostName,
        eventDate: event.eventDate,
        venue: event.venue,
        description: event.description,
        photoAlbumUrl: event.photoAlbumUrl || '',
      } : null,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Não foi possível carregar os dados.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const slug = getSlug(request);
  if (!await isAdmin(slug)) return NextResponse.json({ error: 'Acesso reservado ao administrador' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 }); }

  try {
    const db = getDb();
    const { event, eventId } = await getEventAndId(db, slug);
    const action = String(body.action || '');

    if (action === 'guest-import') {
      if (typeof body.text !== 'string' || body.text.length > 1000000) throw new Error('Lista inválida ou demasiado grande.');
      const [tables, existing] = await Promise.all([
        db.select().from(guestTables).where(eq(guestTables.eventId, eventId)),
        db.select().from(guests).where(eq(guests.eventId, eventId)),
      ]);
      const plan = planGuestImport(body.text, tables, existing, body.skipDuplicates !== false);
      if (plan.errors.length) throw new Error(plan.errors.slice(0, 5).join(' '));
      if (!plan.records.length) throw new Error('Não há novos convidados para adicionar.');

      const timestamp = new Date().toISOString();
      const inserts = [];
      for (let i = 0; i < plan.records.length; i += 10) {
        inserts.push(db.insert(guests).values(plan.records.slice(i, i + 10).map(g => ({ ...g, eventId, createdAt: timestamp }))));
      }
      if (typeof (db as any).batch === 'function') {
        await (db as any).batch(inserts);
      } else {
        await Promise.all(inserts);
      }
      return NextResponse.json({ ok: true, imported: plan.records.length, skipped: plan.skipped });
    } else if (action === 'guest-save') {
      const id = Number(body.id || 0), tableId = Number(body.tableId), seat = Number(body.seat);
      const name = String(body.name || '').trim().slice(0, 120);
      const status = String(body.status || 'pendente');
      if (!name || !Number.isInteger(tableId) || !Number.isInteger(seat) || seat < 1 || !['pendente', 'confirmado', 'recusado', 'presente'].includes(status)) {
        throw new Error('Verifica nome, mesa, lugar e estado.');
      }

      const [targetTable] = await db.select().from(guestTables).where(and(eq(guestTables.id, tableId), eq(guestTables.eventId, eventId))).limit(1);
      if (!targetTable) throw new Error('Mesa não encontrada.');
      if (seat > targetTable.capacity) {
        throw new Error(`A mesa "${targetTable.name}" tem apenas ${targetTable.capacity} lugares. O lugar #${seat} não existe.`);
      }

      const record = {
        eventId,
        name,
        tableId,
        seat,
        status,
        phone: String(body.phone || '').slice(0, 50),
        notes: String(body.notes || '').slice(0, 500),
      };

      const occupied = await db.select().from(guests).where(and(eq(guests.eventId, eventId), eq(guests.tableId, tableId), eq(guests.seat, seat))).limit(1);
      if (occupied.length && occupied[0].id !== id) throw new Error('Este lugar já está ocupado.');

      if (id) {
        const existing = await db.select().from(guests).where(and(eq(guests.id, id), eq(guests.eventId, eventId))).limit(1);
        if (!existing.length) throw new Error('Convidado não encontrado.');
        await db.update(guests).set(record).where(eq(guests.id, id));
      } else {
        await db.insert(guests).values({ ...record, createdAt: new Date().toISOString() });
      }
    } else if (action === 'guest-delete') {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1) throw new Error('Convidado inválido.');
      await db.delete(guests).where(and(eq(guests.id, id), eq(guests.eventId, eventId)));
    } else if (action === 'table-save' || action === 'table-create') {
      const id = Number(body.id || 0);
      const name = String(body.name || '').trim().slice(0, 90);
      const capacity = Math.min(30, Math.max(2, Number(body.capacity) || (name.toLowerCase().includes('honra') ? 4 : 10)));
      if (!name) throw new Error('Nome da mesa obrigatório.');

      if (id > 0) {
        await db.update(guestTables).set({ name, capacity }).where(and(eq(guestTables.id, id), eq(guestTables.eventId, eventId)));
      } else {
        const existingTables = await db.select({ id: guestTables.id }).from(guestTables).where(eq(guestTables.eventId, eventId));
        const maxId = existingTables.reduce((max: number, t: { id: number }) => Math.max(max, t.id), 0);
        const nextId = maxId + 1;
        await db.insert(guestTables).values({
          id: nextId,
          eventId,
          name,
          capacity,
        });
      }
    } else if (action === 'table-rename') {
      const id = Number(body.id);
      const name = String(body.name || '').trim().slice(0, 90);
      const capacity = body.capacity !== undefined ? Math.min(30, Math.max(2, Number(body.capacity) || 10)) : undefined;
      if (!Number.isInteger(id) || !name) throw new Error('Nome da mesa inválido.');
      const updateData: { name: string; capacity?: number } = { name };
      if (capacity !== undefined) updateData.capacity = capacity;
      await db.update(guestTables).set(updateData).where(and(eq(guestTables.id, id), eq(guestTables.eventId, eventId)));
    } else if (action === 'table-delete') {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1) throw new Error('Mesa inválida.');
      const seatedGuests = await db.select().from(guests).where(and(eq(guests.tableId, id), eq(guests.eventId, eventId)));
      if (seatedGuests.length > 0) {
        throw new Error(`Não podes eliminar uma mesa que possui ${seatedGuests.length} convidado(s) atribuído(s). Move ou remove os convidados primeiro.`);
      }
      await db.delete(guestTables).where(and(eq(guestTables.id, id), eq(guestTables.eventId, eventId)));
    } else if (action === 'settings') {
      const eventDate = String(body.eventDate || '');
      const eventName = String(body.eventName || '').trim().slice(0, 100);
      const venue = String(body.venue || '').trim().slice(0, 150);
      const hostName = String(body.hostName || '').trim().slice(0, 100);
      const description = String(body.description || '').trim().slice(0, 500);
      const passcode = String(body.passcode || '').trim().slice(0, 50);
      const photoAlbumUrl = typeof body.photoAlbumUrl === 'string' ? body.photoAlbumUrl.trim().slice(0, 500) : undefined;

      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(eventDate) || !eventName) throw new Error('Data ou nome do evento inválido.');

      if (event) {
        await db.update(events).set({
          title: eventName,
          eventDate,
          venue,
          ...(hostName ? { hostName } : {}),
          ...(description ? { description } : {}),
          ...(passcode ? { passcode: hashPasscode(passcode) } : {}),
          ...(photoAlbumUrl !== undefined ? { photoAlbumUrl } : {}),
        }).where(eq(events.id, eventId));
      }

      const settingsEntries: Record<string, string> = { eventDate, eventName, venue, hostName, description };
      if (photoAlbumUrl !== undefined) settingsEntries.photoAlbumUrl = photoAlbumUrl;
      for (const [key, value] of Object.entries(settingsEntries)) {
        await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
      }
    } else {
      throw new Error('Ação desconhecida.');
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível guardar.';
    return NextResponse.json({ error: message.includes('UNIQUE') ? 'Este lugar já está ocupado.' : message }, { status: 400 });
  }
}
