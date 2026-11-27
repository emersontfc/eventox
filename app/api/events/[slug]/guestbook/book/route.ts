import { NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { events, galleryMedia, guestbookMessages } from '@/db/schema';
import { invitationDates, INVITE_TIME_ZONE } from '@/lib/guest-invitation';
import { GUESTBOOK_BOOK_PAGE_LIMIT, GUESTBOOK_PHOTO_MAX_BYTES, guestbookBookAvailable, guestbookPhotoKey, guestbookPhotoToken } from '@/lib/guestbook';
import { makeGuestbookPdf } from '@/lib/guestbook-pdf';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers });

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: rawSlug } = await params;
    const slug = rawSlug.toLowerCase().trim();
    const volume = Number(new URL(request.url).searchParams.get('volume') ?? 1);
    if (!Number.isSafeInteger(volume) || !Number.isSafeInteger(volume * GUESTBOOK_BOOK_PAGE_LIMIT) || volume < 1) return error('Volume inválido.', 400);

    const db = getDb();
    const [event] = await db.select({ id: events.id, title: events.title, eventDate: events.eventDate })
      .from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) return error('Evento não encontrado.', 404);
    if (!guestbookBookAvailable(event.eventDate)) return error('O livro fica disponível após o dia do evento.', 403);

    const messages = await db.select({
      senderName: guestbookMessages.senderName,
      relationship: guestbookMessages.relationship,
      message: guestbookMessages.message,
      photoUrl: guestbookMessages.photoUrl,
    }).from(guestbookMessages).where(and(eq(guestbookMessages.eventId, event.id), eq(guestbookMessages.status, 'aprovado')))
      .orderBy(asc(guestbookMessages.id)).limit(GUESTBOOK_BOOK_PAGE_LIMIT).offset((volume - 1) * GUESTBOOK_BOOK_PAGE_LIMIT);
    const gallery = volume === 1 ? await db.select({ key: galleryMedia.key, caption: galleryMedia.album }).from(galleryMedia).where(and(
      eq(galleryMedia.eventId, event.id), eq(galleryMedia.status, 'aprovado'), lte(galleryMedia.size, GUESTBOOK_PHOTO_MAX_BYTES),
      inArray(galleryMedia.mime, ['image/jpeg', 'image/png']),
    )).orderBy(desc(galleryMedia.featured), asc(galleryMedia.id)).limit(12) : [];
    if (!messages.length && !gallery.length) return error('Ainda não há recordações aprovadas neste volume.', 404);

    const startsAt = invitationDates(event.eventDate).startsAt;
    const date = startsAt ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeZone: INVITE_TIME_ZONE }).format(new Date(startsAt)) : '';
    const file = await makeGuestbookPdf({
      title: event.title,
      date,
      volume,
      dedications: messages.map((row: typeof messages[number]) => {
        const token = guestbookPhotoToken(slug, row.photoUrl);
        return { ...row, photoKey: token ? guestbookPhotoKey(event.id, token) : null };
      }),
      gallery,
    });
    const filename = slug.replace(/[^a-z0-9-]+/g, '-') || 'evento';
    return new Response(Buffer.from(file), {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}-recordacoes${volume > 1 ? `-${volume}` : ''}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return error('Não foi possível preparar o livro de recordações.', 500);
  }
}
