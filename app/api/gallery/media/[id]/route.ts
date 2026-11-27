import { eq } from 'drizzle-orm';
import { getDb } from '../../../../../db';
import { events, galleryMedia, settings } from '../../../../../db/schema';
import { isEventAdmin } from '../../../../../lib/auth';
import { storage } from '../../../../../lib/storage';

export const dynamic = 'force-dynamic';

function rangeFor(header: string, size: number) {
  const match = header.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || size < 1) return null;
  const [, first, last] = match;
  if (!first && !last) return null;
  if (!first) {
    const length = Number(last);
    if (!Number.isSafeInteger(length) || length <= 0) return null;
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(first);
  const end = last ? Math.min(Number(last), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || (last && !Number.isSafeInteger(Number(last))) || start > end) return null;
  return { start, end };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response('Não encontrado', { status: 404 });

  const db = getDb();
  const [media] = await db.select().from(galleryMedia).where(eq(galleryMedia.id, id)).limit(1);
  if (!media) return new Response('Não encontrado', { status: 404 });
  if (media.status !== 'aprovado') {
    const [event] = await db.select({ slug: events.slug }).from(events).where(eq(events.id, media.eventId));
    const moderator = event && await isEventAdmin(event.slug, 'gallery:moderate');
    if (!moderator) {
      if (media.eventId !== 1 || media.status === 'rejeitado') {
        return new Response('Acesso negado', { status: 403 });
      }
      const key = new URL(request.url).searchParams.get('key') || '';
      const [token] = await db.select().from(settings).where(eq(settings.key, 'gallery-token'));
      if (!token?.value || key !== token.value) return new Response('Acesso negado', { status: 403 });
    }
  }

  const headers = new Headers({
    'Content-Type': media.mime,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Accept-Ranges': 'bytes',
  });
  const rangeHeader = request.headers.get('range');
  const range = rangeHeader ? rangeFor(rangeHeader, media.size) : undefined;
  if (rangeHeader && !range) {
    headers.set('Content-Range', `bytes */${media.size}`);
    return new Response(null, { status: 416, headers });
  }

  const object = await storage.get(media.key, range ?? undefined);
  if (!object) return new Response('Não encontrado', { status: 404 });
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${media.size}`);
  const length = object.size ?? (range ? range.end - range.start + 1 : media.size);
  headers.set('Content-Length', String(length));

  return new Response(object.body, { status: range ? 206 : 200, headers });
}
