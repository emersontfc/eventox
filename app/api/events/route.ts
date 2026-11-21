import { NextResponse } from 'next/server';
import { getDb } from '../../../db';
import { events, guestTables } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { hashPasscode, setSessionCookie } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

const defaultTables = [
  { name: 'Mesa de Honra', capacity: 4 },
  { name: 'Mesa Principal', capacity: 10 },
  { name: 'Família', capacity: 10 },
  { name: 'Amigos de Infância', capacity: 10 },
  { name: 'Colegas de Curso', capacity: 10 },
  { name: 'VIP 1', capacity: 10 },
  { name: 'VIP 2', capacity: 10 },
  { name: 'Equipa & Produção', capacity: 10 },
  { name: 'Convidados Especiais', capacity: 10 },
  { name: 'Mesa Geral', capacity: 10 },
];

export async function GET() {
  try {
    const db = getDb();
    const allEvents = await db.select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      hostName: events.hostName,
      eventDate: events.eventDate,
      venue: events.venue,
      description: events.description,
      coverTheme: events.coverTheme,
      photoAlbumUrl: events.photoAlbumUrl,
      createdAt: events.createdAt,
    }).from(events).orderBy(desc(events.id));

    return NextResponse.json({ events: allEvents });
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao listar eventos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      slug?: string;
      title?: string;
      hostName?: string;
      eventDate?: string;
      venue?: string;
      passcode?: string;
      description?: string;
      coverTheme?: string;
      photoAlbumUrl?: string;
    };

    let slug = String(body.slug || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const title = String(body.title || '').trim().slice(0, 120);
    const hostName = String(body.hostName || '').trim().slice(0, 100);
    const eventDate = String(body.eventDate || '').trim();
    const venue = String(body.venue || '').trim().slice(0, 150);
    const passcode = String(body.passcode || '1234').trim().slice(0, 50);
    const description = String(body.description || '').trim().slice(0, 500);
    const coverTheme = String(body.coverTheme || 'gold').trim().slice(0, 30);
    const photoAlbumUrl = String(body.photoAlbumUrl || '').trim().slice(0, 500);

    if (!slug) throw new Error('Define um link / slug para o evento (ex: meu-evento).');
    if (['api', 'admin', '_next', 'static', 'public', 'conta'].includes(slug)) {
      throw new Error('Este link está reservado pelo sistema.');
    }
    if (!title) throw new Error('O título do evento é obrigatório.');
    if (!hostName) throw new Error('O nome do anfitrião é obrigatório.');
    if (!eventDate) throw new Error('A data do evento é obrigatória.');

    const db = getDb();

    // Check if slug exists
    const existing = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    if (existing.length) {
      throw new Error(`O link "/${slug}" já está a ser utilizado. Escolhe outro nome.`);
    }

    const timestamp = new Date().toISOString();
    const securePasscodeHash = hashPasscode(passcode || '1234');
    const [inserted] = await db.insert(events).values({
      slug,
      title,
      hostName,
      eventDate,
      venue: venue || 'Local a definir',
      passcode: securePasscodeHash,
      description,
      coverTheme,
      photoAlbumUrl: photoAlbumUrl || null,
      createdAt: timestamp,
    }).returning();

    // Initialize default tables for this new event
    if (inserted?.id) {
      const tablesToInsert = defaultTables.map((t, i) => ({
        id: (inserted.id * 100) + (i + 1),
        eventId: inserted.id,
        name: t.name,
        capacity: t.capacity,
      }));
      await db.insert(guestTables).values(tablesToInsert).onConflictDoNothing();
    }

    const response = NextResponse.json({ ok: true, slug, event: { id: inserted.id, slug: inserted.slug, title: inserted.title } });
    if (inserted?.id) {
      setSessionCookie(response, slug, inserted.id);
    }
    return response;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao criar evento.' }, { status: 400 });
  }
}
