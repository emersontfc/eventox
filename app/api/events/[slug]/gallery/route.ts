import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, count, desc, eq, lt, or } from 'drizzle-orm';
import { getDb } from '../../../../../db';
import { events, galleryMedia } from '../../../../../db/schema';
import { isEventAdmin } from '../../../../../lib/auth';
import { galleryFileIssue, galleryFileMime, galleryMimeExtensions } from '../../../../../lib/gallery-uploads';
import { storage } from '../../../../../lib/storage';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

function galleryResponse(item: typeof galleryMedia.$inferSelect) {
  return {
    id: item.id,
    url: `/api/gallery/media/${item.id}`,
    mime: item.mime,
    size: item.size,
    uploader: item.uploader,
    album: item.album,
    originalName: item.originalName,
    status: item.status,
    featured: item.featured,
    createdAt: item.createdAt,
  };
}

export async function GET(request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select({ id: events.id }).from(events)
      .where(eq(events.slug, slug.toLowerCase().trim())).limit(1);
    if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });

    const params = new URL(request.url).searchParams;
    const admin = params.get('visibilidade') !== 'publicada' && await isEventAdmin(slug, 'gallery:moderate');
    const album = params.get('album')?.trim().slice(0, 60);
    const requested = Number(params.get('limite') ?? 60);
    const limit = Number.isSafeInteger(requested) && requested > 0 ? Math.min(60, requested) : 60;
    const rawCursor = params.get('a_seguir');
    const cursor = rawCursor?.match(/^([01]):(\d+)$/);
    const previousId = Number(cursor?.[2]);
    if (rawCursor !== null && (!cursor || !Number.isSafeInteger(previousId) || previousId < 1)) {
      return NextResponse.json({ error: 'A página pedida é inválida.' }, { status: 400 });
    }

    const visibility = and(eq(galleryMedia.eventId, event.id), admin ? undefined : eq(galleryMedia.status, 'aprovado'));
    const after = cursor?.[1] === '1'
      ? or(eq(galleryMedia.featured, false), and(eq(galleryMedia.featured, true), lt(galleryMedia.id, previousId)))
      : cursor ? and(eq(galleryMedia.featured, false), lt(galleryMedia.id, previousId)) : undefined;

    const [rows, albums] = await Promise.all([
      db.select().from(galleryMedia)
        .where(and(visibility, album ? eq(galleryMedia.album, album) : undefined, after))
        .orderBy(desc(galleryMedia.featured), desc(galleryMedia.id))
        .limit(limit + 1),
      db.select({ name: galleryMedia.album, total: count() }).from(galleryMedia)
        .where(and(eq(galleryMedia.eventId, event.id), eq(galleryMedia.status, 'aprovado')))
        .groupBy(galleryMedia.album),
    ]);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = rows.length > limit && last ? `${last.featured ? 1 : 0}:${last.id}` : null;

    return NextResponse.json({ photos: page.map(galleryResponse), admin, albums, nextCursor }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar a galeria.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select({ id: events.id, slug: events.slug }).from(events)
      .where(eq(events.slug, slug.toLowerCase().trim())).limit(1);
    if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Formato multipart esperado.' }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Seleciona uma foto ou um vídeo.' }, { status: 400 });
    }

    const issue = galleryFileIssue(file);
    if (issue) return NextResponse.json({ error: issue }, { status: 400 });
    const mime = galleryFileMime(file)!;
    const extension = galleryMimeExtensions[mime];

    const requestedId = String(form.get('uploadId') || '');
    if (requestedId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestedId)) {
      return NextResponse.json({ error: 'Pedido de envio inválido.' }, { status: 400 });
    }
    const uploadId = (requestedId || randomUUID()).toLowerCase();
    const bytes = Buffer.from(await file.arrayBuffer());
    const fingerprint = createHash('sha256').update(bytes).digest('hex');
    const storageKey = `events/${event.slug}/gallery/${uploadId}-${fingerprint}.${extension}`;
    const findExisting = () => db.select().from(galleryMedia)
      .where(and(eq(galleryMedia.eventId, event.id), eq(galleryMedia.key, storageKey))).limit(1);
    const [existing] = await findExisting();
    if (existing) return NextResponse.json({ ok: true, photo: galleryResponse(existing) });

    const uploader = String(form.get('uploader') || form.get('name') || '').trim().slice(0, 80) || 'Convidado';
    const album = String(form.get('album') || '').trim().slice(0, 60) || 'Momentos especiais';
    await storage.put(storageKey, bytes, { httpMetadata: { contentType: mime } });
    const [record] = await db.insert(galleryMedia).values({
      eventId: event.id,
      key: storageKey,
      mime,
      size: file.size,
      originalName: file.name.slice(0, 160),
      uploader,
      album,
      status: 'pendente',
      createdAt: new Date().toISOString(),
    }).onConflictDoNothing({ target: galleryMedia.key }).returning();

    const saved = record ?? (await findExisting())[0];
    if (!saved) throw new Error('O ficheiro enviado não foi registado.');
    return NextResponse.json({ ok: true, photo: galleryResponse(saved) });
  } catch {
    return NextResponse.json({ error: 'Não foi possível guardar o ficheiro. Tenta novamente.' }, { status: 500 });
  }
}
