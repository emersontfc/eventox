import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { events, screenMessages, guests, screenSettings } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getEventMembershipContext, logAuditAction } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const authContext = await getEventMembershipContext(slug);

    if (!authContext || !hasPermission(authContext.role, authContext.permissions, 'screen:messages')) {
      return NextResponse.json({ error: 'Acesso reservado ao operador audiovisual.' }, { status: 403 });
    }

    const db = getDb();
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
      .where(eq(screenMessages.eventId, authContext.event.id))
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

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const authContext = await getEventMembershipContext(slug);

    if (!authContext) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const body = await request.json() as {
      action?: 'create' | 'moderate' | 'trigger-welcome';
      messageId?: number;
      guestId?: number;
      category?: string;
      text?: string;
      status?: 'pendente' | 'aprovado' | 'exibido' | 'cancelado';
      priority?: number;
    };

    const db = getDb();
    const eventId = authContext.event.id;
    const now = new Date().toISOString();

    // 1. Create custom announcement or message
    if (body.action === 'create' && body.text) {
      if (!hasPermission(authContext.role, authContext.permissions, 'screen:messages')) {
        return NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 });
      }

      const [newMsg] = await db
        .insert(screenMessages)
        .values({
          eventId,
          category: body.category || 'personalizado',
          text: body.text.trim(),
          status: body.status || 'aprovado',
          priority: body.priority || 1,
          createdBy: authContext.user.id,
          approvedBy: authContext.user.id,
          createdAt: now,
        })
        .returning();

      // If status is 'exibido', update screen settings timestamp to notify SSE stream
      if (body.status === 'exibido') {
        await db.update(screenSettings).set({ updatedAt: now }).where(eq(screenSettings.eventId, eventId));
      }

      await logAuditAction({
        eventId,
        userId: authContext.user.id,
        userName: authContext.user.name,
        action: 'screen:create_message',
        entity: 'screen_messages',
        entityId: newMsg.id,
        details: { text: body.text },
      });

      return NextResponse.json({ ok: true, message: newMsg });
    }

    // 2. Moderate (approve, display, or cancel)
    if (body.action === 'moderate' && body.messageId && body.status) {
      if (!hasPermission(authContext.role, authContext.permissions, 'screen:messages')) {
        return NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 });
      }

      const updates: Partial<typeof screenMessages.$inferInsert> = {
        status: body.status,
        approvedBy: authContext.user.id,
      };

      if (body.text) {
        updates.text = body.text.trim();
      }

      if (body.status === 'exibido') {
        updates.displayedAt = now;
        await db.update(screenSettings).set({ updatedAt: now }).where(eq(screenSettings.eventId, eventId));
      }

      await db
        .update(screenMessages)
        .set(updates)
        .where(and(eq(screenMessages.id, body.messageId), eq(screenMessages.eventId, eventId)));

      return NextResponse.json({ ok: true, status: body.status });
    }

    // 3. Trigger check-in welcome suggestion
    if (body.action === 'trigger-welcome' && body.guestId) {
      const [guest] = await db
        .select()
        .from(guests)
        .where(and(eq(guests.id, body.guestId), eq(guests.eventId, eventId)))
        .limit(1);

      if (!guest) {
        return NextResponse.json({ error: 'Convidado não encontrado.' }, { status: 404 });
      }

      // Check anti-duplication: has this guest already been welcomed?
      const existing = await db
        .select()
        .from(screenMessages)
        .where(and(eq(screenMessages.guestId, guest.id), eq(screenMessages.eventId, eventId)))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({ ok: true, duplicate: true, message: existing[0] });
      }

      // Generate respectful welcome message based on category
      const name = guest.name.trim();
      let text = `Bem-vindo(a), ${name}! Obrigado por celebrar connosco.`;
      let category = 'individual';

      const lowerName = name.toLowerCase();
      if (lowerName.includes('casal') || lowerName.includes(' e ') || lowerName.includes(' & ')) {
        category = 'casal';
        text = `Bem-vindos, ${name}! Uma imensa alegria ter-vos connosco nesta celebração.`;
      } else if (lowerName.includes('família') || lowerName.includes('familia')) {
        category = 'familia';
        text = `Que alegria receber a ${name}! Bem-vindos à nossa celebração.`;
      } else if (lowerName.includes('dr.') || lowerName.includes('dra.') || lowerName.includes('prof.')) {
        category = 'honra';
        text = `Uma calorosa e distinta recepção a ${name}!`;
      }

      const [newWelcome] = await db
        .insert(screenMessages)
        .values({
          eventId,
          guestId: guest.id,
          category,
          text,
          status: 'pendente', // Requires AV operator approval or auto-approval
          priority: 0,
          createdBy: authContext.user.id,
          createdAt: now,
        })
        .returning();

      return NextResponse.json({ ok: true, message: newWelcome });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar mensagem.' },
      { status: 500 }
    );
  }
}
