import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { events, screenMessages, guests, screenSettings } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getEventMembershipContext, logAuditAction, isEventAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET: List messages for moderation (Operators / Admins)
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const isOwnerOrAdmin = await isEventAdmin(slug);
    const authContext = await getEventMembershipContext(slug);

    const hasViewPerm =
      isOwnerOrAdmin ||
      (authContext &&
        (hasPermission(authContext.role, authContext.permissions, 'screen:messages:view') ||
          hasPermission(authContext.role, authContext.permissions, 'screen:messages') ||
          hasPermission(authContext.role, authContext.permissions, 'screen:*') ||
          hasPermission(authContext.role, authContext.permissions, 'messages:moderate')));

    if (!hasViewPerm) {
      return NextResponse.json({ error: 'Acesso reservado à equipa do evento.' }, { status: 403 });
    }

    const db = getDb();
    const [eventRow] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);
    const eventId = authContext?.event?.id || eventRow?.id || 1;

    const rows = await db
      .select({
        id: screenMessages.id,
        category: screenMessages.category,
        text: screenMessages.text,
        status: screenMessages.status,
        priority: screenMessages.priority,
        scheduledFor: screenMessages.scheduledFor,
        displayedAt: screenMessages.displayedAt,
        createdAt: screenMessages.createdAt,
        guestId: screenMessages.guestId,
      })
      .from(screenMessages)
      .where(eq(screenMessages.eventId, eventId))
      .orderBy(desc(screenMessages.id))
      .limit(50);

    return NextResponse.json({ messages: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao listar mensagens.' },
      { status: 500 }
    );
  }
}

// POST: Create or moderate screen message
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const isOwnerOrAdmin = await isEventAdmin(slug);
    const authContext = await getEventMembershipContext(slug);

    const db = getDb();
    const [eventRow] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);
    if (!eventRow) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const body = await request.json() as {
      action?: 'create' | 'moderate' | 'trigger-welcome' | 'guest-submit';
      messageId?: number;
      guestId?: number;
      guestName?: string;
      category?: string;
      text?: string;
      status?: 'pendente' | 'aprovado' | 'exibido' | 'cancelado';
      priority?: number;
    };

    const eventId = authContext?.event?.id || eventRow.id;
    const userId = authContext?.user?.id || eventRow.ownerId || 1;
    const now = new Date().toISOString();

    const isOperator =
      isOwnerOrAdmin ||
      (authContext &&
        (hasPermission(authContext.role, authContext.permissions, 'screen:messages:moderate') ||
          hasPermission(authContext.role, authContext.permissions, 'screen:messages') ||
          hasPermission(authContext.role, authContext.permissions, 'screen:*') ||
          hasPermission(authContext.role, authContext.permissions, 'messages:moderate')));

    // 1. Guest public submission (e.g. from mobile / mural without login)
    if (body.action === 'guest-submit' || (!isOperator && body.action === 'create')) {
      if (!body.text?.trim()) {
        return NextResponse.json({ error: 'Texto da mensagem obrigatório.' }, { status: 400 });
      }

      const [newMsg] = await db
        .insert(screenMessages)
        .values({
          eventId,
          category: body.category || 'individual',
          text: body.text.trim().slice(0, 300),
          status: 'pendente', // Requires moderation before projecting on screen
          priority: 0,
          createdAt: now,
        })
        .returning();

      return NextResponse.json({ ok: true, message: newMsg, moderated: false });
    }

    // 2. Operator message creation (directly approved or displayed)
    if (body.action === 'create' && body.text) {
      if (!isOperator) {
        return NextResponse.json({ error: 'Permissão insuficiente para criar anúncios diretos.' }, { status: 403 });
      }

      const targetStatus = body.status || 'exibido';
      const [newMsg] = await db
        .insert(screenMessages)
        .values({
          eventId,
          category: body.category || 'personalizado',
          text: body.text.trim(),
          status: targetStatus,
          priority: body.priority || 1,
          createdBy: userId,
          approvedBy: userId,
          displayedAt: targetStatus === 'exibido' ? now : null,
          createdAt: now,
        })
        .returning();

      // If status is 'exibido', notify screen stream via version bump
      if (targetStatus === 'exibido') {
        const [curSettings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, eventId)).limit(1);
        await db
          .update(screenSettings)
          .set({
            updatedAt: now,
            version: (curSettings?.version || 1) + 1,
          })
          .where(eq(screenSettings.eventId, eventId));
      }

      return NextResponse.json({ ok: true, message: newMsg });
    }

    // 3. Moderate existing message (approve, display, cancel)
    if (body.action === 'moderate' && body.messageId) {
      if (!isOperator) {
        return NextResponse.json({ error: 'Permissão insuficiente para moderar mensagens.' }, { status: 403 });
      }

      const newStatus = body.status || 'aprovado';
      await db
        .update(screenMessages)
        .set({
          status: newStatus,
          approvedBy: userId,
          displayedAt: newStatus === 'exibido' ? now : null,
        })
        .where(and(eq(screenMessages.id, body.messageId), eq(screenMessages.eventId, eventId)));

      if (newStatus === 'exibido') {
        const [curSettings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, eventId)).limit(1);
        await db
          .update(screenSettings)
          .set({
            updatedAt: now,
            version: (curSettings?.version || 1) + 1,
          })
          .where(eq(screenSettings.eventId, eventId));
      }

      return NextResponse.json({ ok: true, status: newStatus });
    }

    // 4. Trigger Arrival Welcome for guest
    if (body.action === 'trigger-welcome' && body.guestId) {
      const [guest] = await db
        .select()
        .from(guests)
        .where(and(eq(guests.id, body.guestId), eq(guests.eventId, eventId)))
        .limit(1);

      if (!guest) {
        return NextResponse.json({ error: 'Convidado não encontrado.' }, { status: 404 });
      }

      const welcomeText = `Seja muito bem-vindo(a), ${guest.name}! A sua presença ilumina a nossa celebração.`;

      const [newMsg] = await db
        .insert(screenMessages)
        .values({
          eventId,
          guestId: guest.id,
          category: 'honra',
          text: welcomeText,
          status: 'exibido',
          priority: 2,
          createdBy: userId,
          approvedBy: userId,
          displayedAt: now,
          createdAt: now,
        })
        .returning();

      const [curSettings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, eventId)).limit(1);
      await db
        .update(screenSettings)
        .set({
          updatedAt: now,
          version: (curSettings?.version || 1) + 1,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, message: newMsg });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar mensagem.' },
      { status: 500 }
    );
  }
}
