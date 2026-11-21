import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { events, guestbookMessages } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getEventMembershipContext, logAuditAction, isEventAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const isOwnerOrAdmin = await isEventAdmin(slug, 'gallery:moderate');
    const authContext = await getEventMembershipContext(slug);
    const canModerate = isOwnerOrAdmin || (authContext && hasPermission(authContext.role, authContext.permissions, 'gallery:moderate'));

    const query = db
      .select()
      .from(guestbookMessages)
      .where(
        canModerate
          ? eq(guestbookMessages.eventId, event.id)
          : and(eq(guestbookMessages.eventId, event.id), eq(guestbookMessages.status, 'aprovado'))
      )
      .orderBy(desc(guestbookMessages.id))
      .limit(60);

    const rows = await query;
    return NextResponse.json({ messages: rows, canModerate: Boolean(canModerate) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao listar mensagens do mural.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const body = await request.json() as {
      senderName?: string;
      relationship?: string;
      message?: string;
      photoUrl?: string;
    };

    const senderName = String(body.senderName || '').trim();
    const message = String(body.message || '').trim();
    const relationship = body.relationship ? String(body.relationship).trim() : 'Convidado(a)';

    if (!senderName || senderName.length < 2) {
      return NextResponse.json({ error: 'Por favor indica o teu nome.' }, { status: 400 });
    }
    if (!message || message.length < 3) {
      return NextResponse.json({ error: 'A mensagem não pode estar vazia.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const [newMsg] = await db
      .insert(guestbookMessages)
      .values({
        eventId: event.id,
        senderName,
        relationship,
        message: message.slice(0, 500),
        photoUrl: body.photoUrl ? String(body.photoUrl).slice(0, 500) : null,
        status: 'pendente', // Moderation required
        createdAt: now,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      message: 'A tua mensagem foi enviada e será exibida no mural assim que validada!',
      item: newMsg,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao enviar mensagem.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const authContext = await getEventMembershipContext(slug);

    const isOwnerOrAdmin = await isEventAdmin(slug, 'gallery:moderate');
    if (!isOwnerOrAdmin && (!authContext || !hasPermission(authContext.role, authContext.permissions, 'gallery:moderate'))) {
      return NextResponse.json({ error: 'Permissão insuficiente para moderar o mural.' }, { status: 403 });
    }

    const body = await request.json() as {
      messageId?: number;
      status?: 'aprovado' | 'rejeitado' | 'pendente';
    };

    if (!body.messageId || !body.status) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    const db = getDb();
    const [eventRow] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);
    if (!eventRow) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const eventId = authContext?.event?.id || eventRow.id;
    const userId = authContext?.user?.id || eventRow.ownerId || 1;

    await db
      .update(guestbookMessages)
      .set({
        status: body.status,
        approvedBy: userId,
      })
      .where(and(eq(guestbookMessages.id, body.messageId), eq(guestbookMessages.eventId, eventId)));

    await logAuditAction({
      eventId,
      userId,
      userName: authContext?.user?.name || 'Administrador',
      action: 'guestbook:moderate',
      entity: 'guestbook_messages',
      entityId: body.messageId,
      details: { newStatus: body.status },
    });

    return NextResponse.json({ ok: true, status: body.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao moderar mensagem.' },
      { status: 500 }
    );
  }
}
