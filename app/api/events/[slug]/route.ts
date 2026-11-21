import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { events, guestTables, guests, menuItems, playlist, galleryMedia, guestbookMessages } from '../../../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
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

    // Get event tables & guests stats
    const tables = await db.select().from(guestTables).where(eq(guestTables.eventId, event.id));
    const allGuests = await db.select({
      id: guests.id,
      name: guests.name,
      tableId: guests.tableId,
      seat: guests.seat,
      status: guests.status,
    }).from(guests).where(eq(guests.eventId, event.id));

    const totalSeats = tables.reduce((acc: number, t: any) => acc + t.capacity, 0);
    const confirmedCount = allGuests.filter((g: any) => ['confirmado', 'presente'].includes(g.status)).length;
    const pendingCount = allGuests.filter((g: any) => g.status === 'pendente').length;

    // Get menu highlights for guests showcase
    const menu = await db.select().from(menuItems).where(
      and(eq(menuItems.eventId, event.id), eq(menuItems.available, true))
    );

    // Get all songs for playlist showcase ordered by position
    const songs = await db.select().from(playlist)
      .where(eq(playlist.eventId, event.id))
      .orderBy(playlist.position, playlist.id);

    // Get approved guestbook messages for live guestbook section
    const guestbook = await db.select().from(guestbookMessages)
      .where(and(eq(guestbookMessages.eventId, event.id), eq(guestbookMessages.status, 'aprovado')))
      .orderBy(desc(guestbookMessages.featured), desc(guestbookMessages.id))
      .limit(20);

    // Get approved media highlights
    const media = await db.select().from(galleryMedia).where(
      and(eq(galleryMedia.eventId, event.id), eq(galleryMedia.status, 'aprovado'))
    ).orderBy(desc(galleryMedia.featured), desc(galleryMedia.id)).limit(12);

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
      tables: tables.map((t: any) => ({ id: t.id, name: t.name, capacity: t.capacity })),
      menu: menu.map((m: any) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        description: m.description,
        stock: m.stock,
        unit: m.unit,
      })),
      playlist: songs.map((s: any) => ({ id: s.id, title: s.title, artist: s.artist, url: s.url, status: s.status, position: s.position })),
      guestbook: guestbook.map((g: any) => ({ id: g.id, senderName: g.senderName, relationship: g.relationship, message: g.message, createdAt: g.createdAt })),
      gallery: media.map((m: any) => ({ id: m.id, key: m.key, mime: m.mime, uploader: m.uploader, createdAt: m.createdAt })),
      admin,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao carregar evento.' }, { status: 500 });
  }
}

// RSVP, Guest search & Self-registration endpoint
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
      title?: string;
      artist?: string;
      url?: string;
      theme?: string;
    };

    const action = body.action || 'rsvp-confirm';

    // 1. Search for guest
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

      const filtered = matches.filter((g: any) => g.name.toLowerCase().includes(q));
      const tables = await db.select().from(guestTables).where(eq(guestTables.eventId, event.id));
      const tableMap = Object.fromEntries(tables.map((t: any) => [t.id, t.name]));

      return NextResponse.json({
        results: filtered.map((g: any) => ({
          ...g,
          tableName: tableMap[g.tableId] || `Mesa ${g.tableId}`,
        })),
      });
    }

    // 2. RSVP status update (confirmado / recusado)
    if (action === 'rsvp-confirm') {
      const id = Number(body.guestId);
      if (!id) throw new Error('Identificador de convidado inválido.');

      const newStatus = body.status === 'recusado' ? 'recusado' : 'confirmado';
      await db.update(guests)
        .set({ status: newStatus, notes: body.notes ? String(body.notes).slice(0, 500) : '' })
        .where(and(eq(guests.id, id), eq(guests.eventId, event.id)));

      return NextResponse.json({ ok: true, status: newStatus });
    }

    // 3. Guest self-registration (Cadastro direto do convidado)
    if (action === 'guest-self-register') {
      const rawName = String(body.name || '').trim();
      const rawPhone = String(body.phone || '').trim();
      const rawNotes = String(body.notes || '').trim().slice(0, 500);

      if (!rawName || rawName.length < 3) {
        throw new Error('Por favor insere o teu nome completo (mínimo 3 caracteres).');
      }

      // Check if already registered
      const existing = await db.select().from(guests).where(
        and(eq(guests.eventId, event.id), eq(guests.name, rawName))
      ).limit(1);

      if (existing.length > 0) {
        const tables = await db.select().from(guestTables).where(eq(guestTables.eventId, event.id));
        const tableMap = Object.fromEntries(tables.map((t: any) => [t.id, t.name]));
        const g = existing[0];
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          guest: {
            id: g.id,
            name: g.name,
            tableId: g.tableId,
            tableName: tableMap[g.tableId] || `Mesa ${g.tableId}`,
            seat: g.seat,
            status: g.status,
            notes: g.notes,
          },
        });
      }

      // Find an available seat across tables
      const tables = await db.select().from(guestTables).where(eq(guestTables.eventId, event.id));
      if (tables.length === 0) {
        throw new Error('As mesas deste evento ainda não foram configuradas.');
      }

      const allEventGuests = await db.select({
        tableId: guests.tableId,
        seat: guests.seat,
      }).from(guests).where(eq(guests.eventId, event.id));

      let assignedTableId = tables[0].id;
      let assignedSeat = 1;
      let foundSlot = false;

      for (const table of tables) {
        const takenSeats = new Set(
          allEventGuests.filter((g: any) => g.tableId === table.id).map((g: any) => g.seat)
        );
        for (let s = 1; s <= table.capacity; s++) {
          if (!takenSeats.has(s)) {
            assignedTableId = table.id;
            assignedSeat = s;
            foundSlot = true;
            break;
          }
        }
        if (foundSlot) break;
      }

      if (!foundSlot) {
        // Fallback to table 1 next sequential seat
        assignedTableId = tables[0].id;
        const highestSeat = Math.max(0, ...allEventGuests.filter((g: any) => g.tableId === assignedTableId).map((g: any) => g.seat));
        assignedSeat = highestSeat + 1;
      }

      const tableMap = Object.fromEntries(tables.map((t: any) => [t.id, t.name]));
      const timestamp = new Date().toISOString();

      const [newGuest] = await db.insert(guests).values({
        eventId: event.id,
        name: rawName,
        phone: rawPhone,
        tableId: assignedTableId,
        seat: assignedSeat,
        status: 'confirmado',
        notes: rawNotes,
        createdAt: timestamp,
      }).returning();

      return NextResponse.json({
        ok: true,
        guest: {
          id: newGuest.id,
          name: newGuest.name,
          tableId: newGuest.tableId,
          tableName: tableMap[newGuest.tableId] || `Mesa ${newGuest.tableId}`,
          seat: newGuest.seat,
          status: newGuest.status,
          notes: newGuest.notes,
        },
      });
    }

    // 4. Song request from guest (Músicas pedidas pelos convidados)
    if (action === 'song-request') {
      const title = String(body.title || '').trim();
      const artist = String(body.artist || '').trim();
      const url = String(body.url || '').trim();
      const guestName = String(body.name || '').trim();

      if (!title || title.length < 2) {
        throw new Error('Por favor indica o nome ou título da música.');
      }

      const [position] = await db.select({ max: sql<number>`coalesce(max(${playlist.position}),0)` })
        .from(playlist)
        .where(eq(playlist.eventId, event.id));

      const formattedArtist = artist
        ? (guestName ? `${artist} · Sugerido por ${guestName}` : artist)
        : (guestName ? `Sugerido por ${guestName}` : 'Pedido de Convidado');

      const [newSong] = await db.insert(playlist).values({
        eventId: event.id,
        title,
        artist: formattedArtist,
        url,
        position: Number(position?.max || 0) + 1,
        status: 'fila',
      }).returning();

      return NextResponse.json({
        ok: true,
        song: {
          id: newSong.id,
          title: newSong.title,
          artist: newSong.artist,
          url: newSong.url,
          status: newSong.status,
          position: newSong.position,
        },
      });
    }

    // 5. Update theme / template (Personalização de design da página)
    if (action === 'update-theme') {
      const isOwnerOrAdmin = await isEventAdmin(slug, 'event:manage');
      if (!isOwnerOrAdmin) {
        return NextResponse.json({ error: 'Acesso restrito à organização do evento.' }, { status: 403 });
      }

      const newTheme = String(body.theme || 'gala-gold').trim().toLowerCase();
      await db.update(events).set({ coverTheme: newTheme }).where(eq(events.id, event.id));

      return NextResponse.json({ ok: true, theme: newTheme });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao processar confirmação.' }, { status: 400 });
  }
}
