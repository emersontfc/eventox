import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { events, guestTables, guests } from '../../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isEventAdmin } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const admin = await isEventAdmin(slug);

    // Get event stats
    const tables = await db.select().from(guestTables).where(eq(guestTables.eventId, event.id));
    const allGuests = await db.select({
      id: guests.id,
      name: guests.name,
      tableId: guests.tableId,
      seat: guests.seat,
      status: guests.status,
    }).from(guests).where(eq(guests.eventId, event.id));

    const totalSeats = tables.reduce((acc, t) => acc + t.capacity, 0);
    const confirmedCount = allGuests.filter(g => ['confirmado', 'presente'].includes(g.status)).length;
    const pendingCount = allGuests.filter(g => g.status === 'pendente').length;

    return NextResponse.json({
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        hostName: event.hostName,
        eventDate: event.eventDate,
        venue: event.venue,
        description: event.description,
        coverTheme: event.coverTheme,
        photoAlbumUrl: event.photoAlbumUrl || '',
        createdAt: event.createdAt,
      },
      stats: {
        totalTables: tables.length,
        totalSeats: totalSeats || 100,
        registeredGuests: allGuests.length,
        confirmedGuests: confirmedCount,
        pendingGuests: pendingCount,
      },
      tables: tables.map(t => ({ id: t.id, name: t.name, capacity: t.capacity })),
      admin,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao carregar evento.' }, { status: 500 });
  }
}

// RSVP / Check-in endpoint for guests
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const body = await request.json() as {
      action?: string;
      guestId?: number;
      name?: string;
      phone?: string;
      status?: string;
      notes?: string;
    };

    const action = body.action || 'rsvp-confirm';

    if (action === 'guest-search') {
      const q = String(body.name || '').trim().toLowerCase();
      if (!q || q.length < 2) {
        return NextResponse.json({ results: [] });
      }

      const matches = await db.select({
        id: guests.id,
        name: guests.name,
        tableId: guests.tableId,
        seat: guests.seat,
        status: guests.status,
        notes: guests.notes,
      }).from(guests).where(eq(guests.eventId, event.id));

      const filtered = matches.filter(g => g.name.toLowerCase().includes(q));
      const tables = await db.select().from(guestTables).where(eq(guestTables.eventId, event.id));
      const tableMap = Object.fromEntries(tables.map(t => [t.id, t.name]));

      return NextResponse.json({
        results: filtered.map(g => ({
          ...g,
          tableName: tableMap[g.tableId] || `Mesa ${g.tableId}`,
        })),
      });
    }

    if (action === 'rsvp-confirm') {
      const id = Number(body.guestId);
      if (!id) throw new Error('Identificador de convidado inválido.');

      const newStatus = body.status === 'recusado' ? 'recusado' : 'confirmado';
      await db.update(guests)
        .set({ status: newStatus, notes: body.notes ? String(body.notes).slice(0, 500) : '' })
        .where(and(eq(guests.id, id), eq(guests.eventId, event.id)));

      return NextResponse.json({ ok: true, status: newStatus });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao processar confirmação.' }, { status: 400 });
  }
}
