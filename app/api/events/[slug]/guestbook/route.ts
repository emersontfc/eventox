import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, count, desc, eq, inArray, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { events, galleryMedia, guestbookMessages } from '@/db/schema';
import { getEventMembershipContext, isEventAdmin, logAuditAction } from '@/lib/auth';
import { safeGuestbookPhoto, GUESTBOOK_BOOK_PAGE_LIMIT, GUESTBOOK_PHOTO_MAX_BYTES, guestbookBookAvailable, guestbookPhotoKey, guestbookPhotoPath } from '@/lib/guestbook';
import { acceptableGuestbookImage } from '@/lib/guestbook-images';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };
const headers = { 'Cache-Control': 'private, no-store' };
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers });

export async function GET(request: Request, context: Context) {
  try {
    const { slug: rawSlug } = await context.params;
    const slug = rawSlug.toLowerCase().trim();
    const db = getDb();
    const [event] = await db.select({ id: events.id, eventDate: events.eventDate }).from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) return error('Evento não encontrado.', 404);

    const publishedOnly = new URL(request.url).searchParams.get('visibilidade') === 'publicada';
    const canModerate = !publishedOnly && await isEventAdmin(slug, 'gallery:moderate');
    const messages = await db.select({
      id: guestbookMessages.id,
      senderName: guestbookMessages.senderName,
      relationship: guestbookMessages.relationship,
      message: guestbookMessages.message,
      photoUrl: guestbookMessages.photoUrl,
      status: guestbookMessages.status,
      featured: guestbookMessages.featured,
      createdAt: guestbookMessages.createdAt,
    }).from(guestbookMessages)
      .where(and(eq(guestbookMessages.eventId, event.id), canModerate ? undefined : eq(guestbookMessages.status, 'aprovado')))
      .orderBy(desc(guestbookMessages.featured), desc(guestbookMessages.id))
      .limit(60);

    let bookVolumes = 0;
    if (guestbookBookAvailable(event.eventDate)) {
      const [dedications] = await db.select({ total: count() }).from(guestbookMessages).where(
        and(eq(guestbookMessages.eventId, event.id), eq(guestbookMessages.status, 'aprovado')),
      );
      bookVolumes = Math.ceil(dedications.total / GUESTBOOK_BOOK_PAGE_LIMIT);
      if (!bookVolumes) {
        const [photo] = await db.select({ id: galleryMedia.id }).from(galleryMedia).where(and(
          eq(galleryMedia.eventId, event.id), eq(galleryMedia.status, 'aprovado'), lte(galleryMedia.size, GUESTBOOK_PHOTO_MAX_BYTES), inArray(galleryMedia.mime, ['image/jpeg', 'image/png']),
        )).limit(1);
        if (photo) bookVolumes = 1;
      }
    }

    return NextResponse.json({
      messages: messages.map((item: typeof messages[number]) => ({ ...item, photoUrl: safeGuestbookPhoto(slug, item.photoUrl) })),
      canModerate,
      bookVolumes,
    }, { headers });
  } catch {
    return error('Não foi possível carregar o mural.', 500);
  }
}

export async function POST(request: Request, context: Context) {
  let uploadedKey: string | undefined;
  try {
    const { slug: rawSlug } = await context.params;
    const slug = rawSlug.toLowerCase().trim();
    const db = getDb();
    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) return error('Evento não encontrado.', 404);

    let body: Record<string, unknown>;
    let photo: File | null = null;
    try {
      if (request.headers.get('Content-Type')?.startsWith('multipart/form-data')) {
        const form = await request.formData();
        body = Object.fromEntries(form);
        const file = form.get('photo');
        if (file instanceof File && file.size > 0) photo = file;
      } else {
        const json: unknown = await request.json();
        if (!json || typeof json !== 'object' || Array.isArray(json)) return error('Pedido inválido.', 400);
        body = json as Record<string, unknown>;
      }
    } catch {
      return error('Pedido inválido.', 400);
    }

    const senderName = typeof body.senderName === 'string' ? body.senderName.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const relationship = typeof body.relationship === 'string' ? body.relationship.trim() : '';
    if (senderName.length < 2 || senderName.length > 80) return error('Indica um nome entre 2 e 80 caracteres.', 400);
    if (message.length < 3 || message.length > 500) return error('Escreve uma dedicatória entre 3 e 500 caracteres.', 400);

    let photoUrl: string | null = null;
    if (photo) {
      if (photo.size > GUESTBOOK_PHOTO_MAX_BYTES) return error('A foto deve ter até 8 MB.', 400);
      const bytes = Buffer.from(await photo.arrayBuffer());
      const details = acceptableGuestbookImage(bytes);
      if (!details) return error('Escolhe uma foto JPG ou PNG de até 25 megapíxeis.', 400);
      const filename = `${randomUUID().replaceAll('-', '')}.${details.extension}`;
      uploadedKey = guestbookPhotoKey(event.id, filename);
      await storage.put(uploadedKey, bytes, { httpMetadata: { contentType: details.mime } });
      photoUrl = guestbookPhotoPath(slug, filename);
    }

    const [item] = await db.insert(guestbookMessages).values({
      eventId: event.id,
      senderName,
      relationship: relationship.slice(0, 60) || 'Convidado(a)',
      message,
      photoUrl,
      status: 'pendente',
      createdAt: new Date().toISOString(),
    }).returning({ id: guestbookMessages.id, status: guestbookMessages.status });
    uploadedKey = undefined;
    return NextResponse.json({ ok: true, message: 'Dedicatória enviada para aprovação.', item }, { status: 201, headers });
  } catch {
    if (uploadedKey) await storage.delete(uploadedKey).catch(() => undefined);
    return error('Não foi possível enviar a dedicatória.', 500);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { slug: rawSlug } = await context.params;
    const slug = rawSlug.toLowerCase().trim();
    if (!await isEventAdmin(slug, 'gallery:moderate')) return error('Permissão insuficiente para moderar o mural.', 403);
    const body = await request.json().catch(() => null) as { messageId?: number; id?: number; status?: string } | null;
    const id = body?.messageId ?? body?.id;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || !body?.status || !['aprovado', 'rejeitado', 'pendente'].includes(body.status)) {
      return error('Dados de moderação inválidos.', 400);
    }

    const db = getDb();
    const [event] = await db.select({ id: events.id, ownerId: events.ownerId }).from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) return error('Evento não encontrado.', 404);
    const access = await getEventMembershipContext(slug);
    const userId = access?.authenticatedByPasscode ? event.ownerId : access?.user.id ?? event.ownerId;
    const [updated] = await db.update(guestbookMessages).set({
      status: body.status,
      ...(body.status !== 'aprovado' ? { featured: false } : {}),
      approvedBy: userId,
    }).where(and(eq(guestbookMessages.id, id), eq(guestbookMessages.eventId, event.id)))
      .returning({ id: guestbookMessages.id });
    if (!updated) return error('Dedicatória não encontrada.', 404);

    await logAuditAction({
      eventId: event.id, userId: userId ?? undefined, userName: access?.user.name || 'Organização',
      action: 'guestbook:moderate', entity: 'guestbook_messages', entityId: id, details: { newStatus: body.status },
    });
    return NextResponse.json({ ok: true, status: body.status }, { headers });
  } catch {
    return error('Não foi possível moderar a dedicatória.', 500);
  }
}
