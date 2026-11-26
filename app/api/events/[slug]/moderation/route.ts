import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../../../../db';
import { galleryMedia, guestbookMessages } from '../../../../../db/schema';
import { getEventMembershipContext, logAuditAction } from '../../../../../lib/auth';
import { hasPermission } from '../../../../../lib/permissions';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ slug: string }> };

async function moderator(context: Context) {
  const { slug } = await context.params;
  const access = await getEventMembershipContext(slug);
  return access && hasPermission(access.role, access.permissions, 'gallery:moderate') ? access : null;
}

export async function GET(_request: Request, context: Context) {
  const access = await moderator(context);
  if (!access) return NextResponse.json({ error: 'Sem permissão para moderar.' }, { status: 403 });

  const db = getDb();
  const [photos, messages] = await Promise.all([
    db.select({
      id: galleryMedia.id, title: galleryMedia.originalName, content: galleryMedia.uploader,
      status: galleryMedia.status, featured: galleryMedia.featured, mime: galleryMedia.mime,
    }).from(galleryMedia).where(eq(galleryMedia.eventId, access.event.id)).orderBy(desc(galleryMedia.id)),
    db.select({
      id: guestbookMessages.id, title: guestbookMessages.senderName, content: guestbookMessages.message,
      status: guestbookMessages.status, featured: guestbookMessages.featured,
    }).from(guestbookMessages).where(eq(guestbookMessages.eventId, access.event.id)).orderBy(desc(guestbookMessages.id)),
  ]);
  return NextResponse.json({ photos, messages });
}

export async function PATCH(request: Request, context: Context) {
  const access = await moderator(context);
  if (!access) return NextResponse.json({ error: 'Sem permissão para moderar.' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, any> | null;
  if (!body || !['photos', 'messages'].includes(body.kind) ||
      !Number.isSafeInteger(body.id) || body.id < 1 ||
      !['approve', 'hide', 'feature', 'unfeature'].includes(body.action)) {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  }
  const { id, action, kind } = body;
  const values = { status: action === 'hide' ? 'rejeitado' : 'aprovado', featured: action === 'feature' };
  const table = kind === 'photos' ? galleryMedia : guestbookMessages;
  const [updated] = await getDb().update(table).set(values)
    .where(and(eq(table.eventId, access.event.id), eq(table.id, id)))
    .returning({ id: table.id });
  if (!updated) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });
  await logAuditAction({
    eventId: access.event.id,
    userId: access.user.id,
    userName: access.user.name,
    action: `moderation:${action}`,
    entity: kind === 'photos' ? 'gallery' : 'guestbook',
    entityId: id,
  });
  return NextResponse.json(values);
}
