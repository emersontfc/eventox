import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { events, liveInteractions, screenSettings } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getEventMembershipContext, isEventAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET: List interactions (Wordcloud words, Polls, Q&A)
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type'); // 'wordcloud' | 'poll' | 'qa'

    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    let query = db.select().from(liveInteractions).where(eq(liveInteractions.eventId, event.id));

    const rows = await query.orderBy(desc(liveInteractions.votes), desc(liveInteractions.id)).limit(100);

    const filtered = typeFilter ? rows.filter((r: any) => r.type === typeFilter) : rows;

    return NextResponse.json({ items: filtered });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao listar interações.' },
      { status: 500 }
    );
  }
}

// POST: Submit word cloud, vote poll, submit question or upvote
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const body = await request.json() as {
      action?: 'submit' | 'upvote' | 'moderate' | 'create-poll';
      type?: 'wordcloud' | 'poll' | 'qa' | 'song_vote';
      content?: string;
      senderName?: string;
      tableNumber?: string;
      id?: number;
      status?: 'pendente' | 'aprovado' | 'rejeitado' | 'exibido';
      pollOptions?: string[];
      pollTitle?: string;
    };

    const now = new Date().toISOString();
    const action = body.action || 'submit';

    // 1. Participant submits a Word, Question, or Song Vote
    if (action === 'submit') {
      const type = body.type || 'wordcloud';
      const content = (body.content || '').trim().slice(0, 200);
      const senderName = (body.senderName || 'Convidado Anónimo').trim().slice(0, 50);
      const tableNumber = (body.tableNumber || '').trim().slice(0, 10);

      if (!content) {
        return NextResponse.json({ error: 'Conteúdo obrigatório.' }, { status: 400 });
      }

      // If wordcloud, check if this word already exists in approved words -> increment votes/frequency!
      if (type === 'wordcloud') {
        const cleanWord = content.toLowerCase();
        const [existing] = await db
          .select()
          .from(liveInteractions)
          .where(and(eq(liveInteractions.eventId, event.id), eq(liveInteractions.type, 'wordcloud'), sql`lower(${liveInteractions.content}) = ${cleanWord}`))
          .limit(1);

        if (existing) {
          await db
            .update(liveInteractions)
            .set({ votes: (existing.votes || 1) + 1 })
            .where(eq(liveInteractions.id, existing.id));

          return NextResponse.json({ ok: true, id: existing.id, updated: true });
        }
      }

      const [newInteraction] = await db
        .insert(liveInteractions)
        .values({
          eventId: event.id,
          type,
          senderName,
          tableNumber: tableNumber || null,
          content,
          votes: 1,
          status: 'aprovado', // Auto-approve clean words or questions
          createdAt: now,
        })
        .returning();

      return NextResponse.json({ ok: true, interaction: newInteraction });
    }

    // 2. Upvote an interaction (e.g. Q&A or Poll option)
    if (action === 'upvote' && body.id) {
      const [item] = await db
        .select()
        .from(liveInteractions)
        .where(and(eq(liveInteractions.id, body.id), eq(liveInteractions.eventId, event.id)))
        .limit(1);

      if (!item) {
        return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });
      }

      const nextVotes = (item.votes || 0) + 1;
      await db
        .update(liveInteractions)
        .set({ votes: nextVotes })
        .where(eq(liveInteractions.id, item.id));

      return NextResponse.json({ ok: true, id: item.id, votes: nextVotes });
    }

    // 3. Moderator / Operator moderation
    if (action === 'moderate' && body.id) {
      const isOwnerOrAdmin = await isEventAdmin(slug);
      const authContext = await getEventMembershipContext(slug);

      if (!isOwnerOrAdmin && (!authContext || !hasPermission(authContext.role, authContext.permissions, 'messages:moderate'))) {
        return NextResponse.json({ error: 'Permissão insuficiente para moderar.' }, { status: 403 });
      }

      const targetStatus = body.status || 'aprovado';
      await db
        .update(liveInteractions)
        .set({
          status: targetStatus,
          displayedAt: targetStatus === 'exibido' ? now : null,
        })
        .where(and(eq(liveInteractions.id, body.id), eq(liveInteractions.eventId, event.id)));

      // Bump screen version so TV updates
      const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, event.id)).limit(1);
      await db
        .update(screenSettings)
        .set({
          version: (settings?.version || 1) + 1,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, event.id));

      return NextResponse.json({ ok: true, status: targetStatus });
    }

    // 4. Create Live Poll (Operator)
    if (action === 'create-poll' && body.pollTitle && Array.isArray(body.pollOptions)) {
      const isOwnerOrAdmin = await isEventAdmin(slug);
      const authContext = await getEventMembershipContext(slug);

      if (!isOwnerOrAdmin && (!authContext || !hasPermission(authContext.role, authContext.permissions, 'games:manage'))) {
        return NextResponse.json({ error: 'Permissão insuficiente para criar votação.' }, { status: 403 });
      }

      // Clear previous active polls for this event
      await db
        .update(liveInteractions)
        .set({ status: 'rejeitado' })
        .where(and(eq(liveInteractions.eventId, event.id), eq(liveInteractions.type, 'poll')));

      for (const opt of body.pollOptions) {
        if (!opt?.trim()) continue;
        await db.insert(liveInteractions).values({
          eventId: event.id,
          type: 'poll',
          senderName: body.pollTitle.trim(),
          content: opt.trim(),
          votes: 0,
          status: 'aprovado',
          createdAt: now,
        });
      }

      // Switch TV to poll scene
      const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, event.id)).limit(1);
      await db
        .update(screenSettings)
        .set({
          activeSceneId: 'poll',
          version: (settings?.version || 1) + 1,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, event.id));

      return NextResponse.json({ ok: true, title: body.pollTitle });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar interação.' },
      { status: 500 }
    );
  }
}
