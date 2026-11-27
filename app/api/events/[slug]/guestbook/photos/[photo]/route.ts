import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { events, guestbookMessages } from '@/db/schema';
import { isEventAdmin } from '@/lib/auth';
import { guestbookPhotoKey, guestbookPhotoPath, guestbookPhotoToken } from '@/lib/guestbook';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; photo: string }> }) {
  const { slug: eventSlug, photo } = await params;
  const slug = eventSlug.toLowerCase().trim();
  const path = guestbookPhotoPath(slug, photo);
  const notFound = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  if (!guestbookPhotoToken(slug, path)) return notFound();

  const db = getDb();
  const [match] = await db.select({ eventId: events.id, status: guestbookMessages.status })
    .from(guestbookMessages)
    .innerJoin(events, eq(guestbookMessages.eventId, events.id))
    .where(and(eq(events.slug, slug), eq(guestbookMessages.photoUrl, path)))
    .limit(1);
  if (!match || (match.status !== 'aprovado' && !await isEventAdmin(slug, 'gallery:moderate'))) return notFound();

  const image = await storage.get(guestbookPhotoKey(match.eventId, photo));
  if (!image) return notFound();
  return new Response(image.body, {
    headers: {
      'Content-Type': photo.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
