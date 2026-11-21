import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  events, screenSettings, screenScenes, screenMessages,
  galleryMedia, quotesLibrary, guests,
  gameSessions, gameQuestions, gameParticipants, liveInteractions
} from '@/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { getEventMembershipContext, logAuditAction, isEventAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET: Public read-only screen state with server-authoritative clock and live experiences
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // 1. Screen settings with server-authoritative defaults
    let [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, event.id)).limit(1);
    if (!settings) {
      [settings] = await db.insert(screenSettings).values({
        eventId: event.id,
        activeSceneId: 'welcome',
        autoRotate: true,
        rotateInterval: 12,
        theme: 'midnight_gold',
        backgroundStyle: 'particles',
        holdScene: false,
        emergencyMode: false,
        fontFamily: 'playfair',
        stageStatus: 'no_ar',
        version: 1,
        sceneStartedAt: now,
        sceneDurationSeconds: 12,
        isPaused: false,
        updatedAt: now,
      }).returning();
    }

    // 2. Screen scenes
    const scenes = await db
      .select()
      .from(screenScenes)
      .where(and(eq(screenScenes.eventId, event.id), eq(screenScenes.isActive, true)))
      .orderBy(asc(screenScenes.position), asc(screenScenes.id));

    // 3. Active / Recent broadcast message
    const [activeMessage] = await db
      .select({
        id: screenMessages.id,
        category: screenMessages.category,
        text: screenMessages.text,
        status: screenMessages.status,
        createdAt: screenMessages.createdAt,
      })
      .from(screenMessages)
      .where(and(eq(screenMessages.eventId, event.id), eq(screenMessages.status, 'exibido')))
      .orderBy(desc(screenMessages.id))
      .limit(1);

    // 4. Approved gallery photos for live mural
    const photos = await db
      .select({
        id: galleryMedia.id,
        key: galleryMedia.key,
        mime: galleryMedia.mime,
        uploader: galleryMedia.uploader,
      })
      .from(galleryMedia)
      .where(and(eq(galleryMedia.eventId, event.id), eq(galleryMedia.status, 'aprovado')))
      .orderBy(desc(galleryMedia.id))
      .limit(16);

    // 5. Active quotes
    const quotes = await db
      .select({
        id: quotesLibrary.id,
        quote: quotesLibrary.quote,
        author: quotesLibrary.author,
        category: quotesLibrary.category,
      })
      .from(quotesLibrary)
      .where(and(eq(quotesLibrary.eventId, event.id), eq(quotesLibrary.isActive, true)));

    // 6. Recent checked-in guests (public sanitized: name only)
    const recentGuests = await db
      .select({
        id: guests.id,
        name: guests.name,
      })
      .from(guests)
      .where(and(eq(guests.eventId, event.id), eq(guests.status, 'presente')))
      .orderBy(desc(guests.id))
      .limit(8);

    // 7. Active live game session details (if active)
    let activeGameSessionData: Record<string, any> | null = null;
    if (settings.activeGameSessionId) {
      const [session] = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.id, settings.activeGameSessionId))
        .limit(1);

      if (session) {
        // Count participants
        const participants = await db
          .select({
            id: gameParticipants.id,
            nickname: gameParticipants.nickname,
            tableNumber: gameParticipants.tableNumber,
            avatar: gameParticipants.avatar,
            score: gameParticipants.score,
          })
          .from(gameParticipants)
          .where(eq(gameParticipants.sessionId, session.id))
          .orderBy(desc(gameParticipants.score));

        // Questions for this game
        const questions = await db
          .select()
          .from(gameQuestions)
          .where(eq(gameQuestions.gameId, session.gameId))
          .orderBy(asc(gameQuestions.orderIndex), asc(gameQuestions.id));

        const currentQ = questions[session.currentQuestionIndex];
        let currentQuestionSanitized: Record<string, any> | null = null;

        if (currentQ) {
          let parsedOptions: string[] = [];
          try {
            parsedOptions = JSON.parse(currentQ.options);
          } catch {
            parsedOptions = [];
          }

          currentQuestionSanitized = {
            id: currentQ.id,
            orderIndex: currentQ.orderIndex,
            totalQuestions: questions.length,
            currentIndex: session.currentQuestionIndex + 1,
            questionType: currentQ.questionType,
            title: currentQ.title,
            mediaUrl: currentQ.mediaUrl,
            options: parsedOptions,
            timeLimit: currentQ.timeLimit,
            points: currentQ.points,
          };

          // Only reveal correct answer and explanation if question is ended or podium
          if (session.status === 'question_ended' || session.status === 'podium' || session.status === 'concluded') {
            currentQuestionSanitized.correctAnswer = currentQ.correctAnswer;
            currentQuestionSanitized.explanation = currentQ.explanation;
          }
        }

        // Aggregate table scores for Table Battle
        const tableScores: Record<string, number> = {};
        for (const p of participants) {
          if (p.tableNumber) {
            const tbl = `Mesa ${p.tableNumber}`;
            tableScores[tbl] = (tableScores[tbl] || 0) + (p.score || 0);
          }
        }
        const sortedTables = Object.entries(tableScores)
          .map(([table, score]) => ({ table, score }))
          .sort((a, b) => b.score - a.score);

        activeGameSessionData = {
          id: session.id,
          pin: session.pin,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          questionStartedAt: session.questionStartedAt,
          participantCount: participants.length,
          currentQuestion: currentQuestionSanitized,
          topPlayers: participants.slice(0, 5),
          tableRankings: sortedTables.slice(0, 5),
        };
      }
    }

    // 8. Participatory interactions (Word Cloud, Poll, Q&A)
    const approvedInteractions = await db
      .select()
      .from(liveInteractions)
      .where(and(eq(liveInteractions.eventId, event.id), eq(liveInteractions.status, 'aprovado')))
      .orderBy(desc(liveInteractions.votes), desc(liveInteractions.id))
      .limit(40);

    const wordCloudItems = approvedInteractions
      .filter((i: any) => i.type === 'wordcloud')
      .map((i: any) => ({ word: i.content, count: Math.max(1, i.votes || 1) }));

    const pollItems = approvedInteractions
      .filter((i: any) => i.type === 'poll')
      .map((i: any) => ({ option: i.content, votes: i.votes || 0 }));

    const qaItems = approvedInteractions
      .filter((i: any) => i.type === 'qa')
      .map((i: any) => ({ id: i.id, question: i.content, sender: i.senderName, votes: i.votes || 0 }));

    return NextResponse.json({
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        hostName: event.hostName,
        eventDate: event.eventDate,
        venue: event.venue,
        description: event.description,
        photoAlbumUrl: event.photoAlbumUrl,
      },
      settings,
      scenes: scenes.map((s: any) => {
        let contentObj: Record<string, unknown> = {};
        try { contentObj = JSON.parse(s.content || '{}'); } catch { contentObj = {}; }
        return {
          ...s,
          content: contentObj,
        };
      }),
      activeMessage: activeMessage || null,
      photos,
      quotes,
      recentArrivals: recentGuests,
      activeGameSession: activeGameSessionData,
      interactions: {
        wordCloud: wordCloudItems,
        polls: pollItems,
        qa: qaItems,
      },
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao carregar estado do ecrã.' },
      { status: 500 }
    );
  }
}

// POST: Operator controls (Requires 'screen:control', 'audiovisual' role or owner)
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const isOwnerOrAdmin = await isEventAdmin(slug, 'screen:control');
    const authContext = await getEventMembershipContext(slug);

    if (
      !isOwnerOrAdmin &&
      (!authContext || !hasPermission(authContext.role, authContext.permissions, 'screen:control'))
    ) {
      return NextResponse.json({ error: 'Acesso reservado ao operador audiovisual.' }, { status: 403 });
    }

    const body = await request.json() as {
      action?: string;
      sceneId?: string;
      autoRotate?: boolean;
      rotateInterval?: number;
      holdScene?: boolean;
      isPaused?: boolean;
      emergencyMode?: boolean;
      emergencyMessage?: string;
      theme?: string;
      backgroundStyle?: string;
      customLogoUrl?: string;
      customHeadline?: string;
      fontFamily?: string;
      tickerText?: string;
      tickerSender?: string;
      sceneData?: {
        id?: number;
        title?: string;
        subtitle?: string;
        content?: Record<string, unknown>;
        duration?: number;
        isActive?: boolean;
      };
      orderedSceneIds?: number[];
    };

    const db = getDb();
    const [eventRow] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);
    if (!eventRow) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const eventId = authContext?.event?.id || eventRow.id;
    const userId = authContext?.user?.id || eventRow.ownerId || 1;
    const now = new Date().toISOString();

    const [currentSettings] = await db
      .select()
      .from(screenSettings)
      .where(eq(screenSettings.eventId, eventId))
      .limit(1);

    const currentVersion = (currentSettings?.version || 1) + 1;
    const action = body.action || '';

    // 1. Switch active scene immediately
    if ((action === 'set-active-scene' || action === 'set-scene') && body.sceneId) {
      await db
        .update(screenSettings)
        .set({
          activeSceneId: body.sceneId,
          sceneStartedAt: now,
          isPaused: false,
          stageStatus: 'no_ar',
          version: currentVersion,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      await logAuditAction({
        eventId,
        userId,
        userName: authContext?.user?.name || 'Operador AV',
        action: 'screen:set_scene',
        entity: 'screen_settings',
        details: { sceneId: body.sceneId, version: currentVersion },
      });

      return NextResponse.json({ ok: true, activeSceneId: body.sceneId, version: currentVersion });
    }

    // 2. Stage a scene (prepare in draft without publishing to TV)
    if (action === 'stage-scene' && body.sceneId) {
      await db
        .update(screenSettings)
        .set({
          stagedSceneId: body.sceneId,
          stageStatus: 'pronto',
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, stagedSceneId: body.sceneId, stageStatus: 'pronto' });
    }

    // 3. Publish staged scene to TV ("Enviar para o Ar")
    if (action === 'publish-staged') {
      const targetScene = currentSettings?.stagedSceneId || 'welcome';
      await db
        .update(screenSettings)
        .set({
          activeSceneId: targetScene,
          stagedSceneId: null,
          stageStatus: 'no_ar',
          sceneStartedAt: now,
          isPaused: false,
          version: currentVersion,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, activeSceneId: targetScene, version: currentVersion });
    }

    // 4. Toggle Pause / Hold rotation
    if (action === 'toggle-hold' || action === 'toggle-pause') {
      const nextPaused = body.isPaused !== undefined ? body.isPaused : !(currentSettings?.isPaused || currentSettings?.holdScene);
      await db
        .update(screenSettings)
        .set({
          isPaused: nextPaused,
          holdScene: nextPaused,
          version: currentVersion,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, isPaused: nextPaused, version: currentVersion });
    }

    // 5. Next / Prev scene sequence
    if (action === 'next-scene' || action === 'prev-scene') {
      const scenes = await db
        .select()
        .from(screenScenes)
        .where(and(eq(screenScenes.eventId, eventId), eq(screenScenes.isActive, true)))
        .orderBy(asc(screenScenes.position), asc(screenScenes.id));

      if (scenes.length > 0) {
        const curIdx = scenes.findIndex((s: any) => s.sceneType === currentSettings?.activeSceneId);
        let nextIdx = 0;
        if (action === 'next-scene') {
          nextIdx = (curIdx + 1) % scenes.length;
        } else {
          nextIdx = (curIdx - 1 + scenes.length) % scenes.length;
        }
        const nextSceneType = scenes[nextIdx].sceneType;

        await db
          .update(screenSettings)
          .set({
            activeSceneId: nextSceneType,
            sceneStartedAt: now,
            isPaused: false,
            version: currentVersion,
            updatedAt: now,
          })
          .where(eq(screenSettings.eventId, eventId));

        return NextResponse.json({ ok: true, activeSceneId: nextSceneType, version: currentVersion });
      }
    }

    // 6. Broadcast Marquee Ticker
    if (action === 'broadcast-ticker') {
      const ticker = (body.tickerText || '').trim();
      const sender = (body.tickerSender || 'Organização').trim();

      await db
        .update(screenSettings)
        .set({
          broadcastTicker: ticker || null,
          broadcastTickerSender: ticker ? sender : null,
          broadcastTickerAt: ticker ? now : null,
          version: currentVersion,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, broadcastTicker: ticker, version: currentVersion });
    }

    // 7. Clear Ticker
    if (action === 'clear-ticker') {
      await db
        .update(screenSettings)
        .set({
          broadcastTicker: null,
          broadcastTickerSender: null,
          broadcastTickerAt: null,
          version: currentVersion,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, cleared: true, version: currentVersion });
    }

    // 8. Toggle auto-rotate
    if (action === 'toggle-auto-rotate' && typeof body.autoRotate === 'boolean') {
      await db
        .update(screenSettings)
        .set({ autoRotate: body.autoRotate, version: currentVersion, updatedAt: now })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, autoRotate: body.autoRotate, version: currentVersion });
    }

    // 9. Toggle emergency alert mode
    if (action === 'toggle-emergency' && typeof body.emergencyMode === 'boolean') {
      await db
        .update(screenSettings)
        .set({
          emergencyMode: body.emergencyMode,
          emergencyMessage: body.emergencyMessage !== undefined ? body.emergencyMessage : null,
          version: currentVersion,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      await logAuditAction({
        eventId,
        userId,
        userName: authContext?.user?.name || 'Operador AV',
        action: 'screen:emergency_mode',
        entity: 'screen_settings',
        details: { emergencyMode: body.emergencyMode, message: body.emergencyMessage },
      });

      return NextResponse.json({ ok: true, emergencyMode: body.emergencyMode, version: currentVersion });
    }

    // 10. Update theme (handles both 'update-theme' and 'update-settings')
    if (action === 'update-theme' || action === 'update-settings') {
      const updates: Partial<typeof screenSettings.$inferInsert> = {
        updatedAt: now,
        version: currentVersion,
      };
      if (body.theme) updates.theme = body.theme;
      if (body.backgroundStyle) updates.backgroundStyle = body.backgroundStyle;
      if (body.fontFamily) updates.fontFamily = body.fontFamily;
      if (body.customLogoUrl !== undefined) updates.customLogoUrl = body.customLogoUrl;
      if (body.customHeadline !== undefined) updates.customHeadline = body.customHeadline;
      if (body.rotateInterval && body.rotateInterval >= 5) {
        updates.rotateInterval = body.rotateInterval;
        updates.sceneDurationSeconds = body.rotateInterval;
      }

      await db.update(screenSettings).set(updates).where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, settings: updates, version: currentVersion });
    }

    // 11. Update scene properties
    if (action === 'update-scene' && body.sceneData && typeof body.sceneData.id === 'number') {
      const s = body.sceneData;
      const sceneId = s.id as number;
      const updates: Partial<typeof screenScenes.$inferInsert> = {};
      if (s.title !== undefined) updates.title = s.title;
      if (s.subtitle !== undefined) updates.subtitle = s.subtitle;
      if (s.content !== undefined) updates.content = JSON.stringify(s.content);
      if (s.duration !== undefined && s.duration >= 3) updates.duration = s.duration;
      if (s.isActive !== undefined) updates.isActive = s.isActive;

      await db
        .update(screenScenes)
        .set(updates)
        .where(and(eq(screenScenes.id, sceneId), eq(screenScenes.eventId, eventId)));

      return NextResponse.json({ ok: true });
    }

    // 12. Reorder scenes
    if (action === 'reorder-scenes' && Array.isArray(body.orderedSceneIds)) {
      for (let i = 0; i < body.orderedSceneIds.length; i++) {
        const id = body.orderedSceneIds[i];
        await db
          .update(screenScenes)
          .set({ position: i + 1 })
          .where(and(eq(screenScenes.id, id), eq(screenScenes.eventId, eventId)));
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar comando do ecrã.' },
      { status: 500 }
    );
  }
}
