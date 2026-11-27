import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
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
      id: guestbookMessages.id, title: guestbookMessages.senderName, content: guestbookMessages.message, photoUrl: guestbookMessages.photoUrl,
      status: guestbookMessages.status, featured: guestbookMessages.featured,
    }).from(guestbookMessages).where(eq(guestbookMessages.eventId, access.event.id)).orderBy(desc(guestbookMessages.id)),
  ]);
  return NextResponse.json({ photos, messages }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(request: Request, context: Context) {
  const access = await moderator(context);
  if (!access) return NextResponse.json({ error: 'Sem permissão para moderar.' }, { status: 403 });

  const body = await request.json().catch(() => null) as { ids?: unknown; id?: unknown; action?: unknown; kind?: unknown } | null;
  const { action, kind } = body ?? {};
  const selected = Array.isArray(body?.ids) ? [...new Set<unknown>(body.ids)] : [body?.id];
  const ids = selected.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0);
  if ((kind !== 'photos' && kind !== 'messages') ||
      !ids.length || ids.length > 50 || selected.length !== ids.length ||
      (action !== 'approve' && action !== 'hide' && action !== 'feature' && action !== 'unfeature') ||
      (ids.length > 1 && action !== 'approve' && action !== 'hide')) {
    return NextResponse.json({ error: 'Seleção ou ação inválida.' }, { status: 400 });
  }

  const userId = access.authenticatedByPasscode ? access.event.ownerId : access.user.id;
  const values = {
    status: action === 'hide' ? 'rejeitado' : 'aprovado',
    ...(action !== 'approve' ? { featured: action === 'feature' } : {}),
  };
  const table = kind === 'photos' ? galleryMedia : guestbookMessages;
  const db = getDb();
  const updated = db.transaction((tx: typeof db) => {
    const selection = and(eq(table.eventId, access.event.id), inArray(table.id, ids));
    const found = tx.select({ id: table.id }).from(table).where(selection).all();
    if (found.length !== ids.length) return false;
    tx.update(table).set({ ...values, approvedBy: userId }).where(selection).run();
    return true;
  }, { behavior: 'immediate' });

  if (!updated) return NextResponse.json({ error: 'Um dos itens já não está disponível neste evento.' }, { status: 404 });
  await logAuditAction({
    eventId: access.event.id,
    userId,
    userName: access.user.name,
    action: `moderation:${action}`,
    entity: kind === 'photos' ? 'gallery' : 'guestbook',
    entityId: ids.length === 1 ? ids[0] : undefined,
    details: { ids },
  });
  return NextResponse.json({ ...values, ids });
}
