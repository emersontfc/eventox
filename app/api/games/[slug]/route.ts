import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  events, screenSettings, liveGames, gameQuestions,
  gameSessions, gameParticipants, gameAnswers
} from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { getEventMembershipContext, logAuditAction, isEventAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// GET: List live games and session status for this event
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const games = await db
      .select()
      .from(liveGames)
      .where(and(eq(liveGames.eventId, event.id), eq(liveGames.status, 'ativo')))
      .orderBy(desc(liveGames.id));

    // Get questions for each game
    const gamesWithQuestions = await Promise.all(
      games.map(async (g: any) => {
        const questions = await db
          .select()
          .from(gameQuestions)
          .where(eq(gameQuestions.gameId, g.id))
          .orderBy(asc(gameQuestions.orderIndex), asc(gameQuestions.id));

        return {
          ...g,
          questionCount: questions.length,
          questions: questions.map((q: any) => {
            let parsedOpts = [];
            try { parsedOpts = JSON.parse(q.options); } catch { parsedOpts = []; }
            return { ...q, options: parsedOpts };
          }),
        };
      })
    );

    // Active session info
    const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, event.id)).limit(1);
    let activeSession = null;

    if (settings?.activeGameSessionId) {
      const [session] = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.id, settings.activeGameSessionId))
        .limit(1);

      if (session) {
        const participants = await db
          .select()
          .from(gameParticipants)
          .where(eq(gameParticipants.sessionId, session.id))
          .orderBy(desc(gameParticipants.score));

        activeSession = {
          ...session,
          participantCount: participants.length,
          topPlayers: participants.slice(0, 5),
        };
      }
    }

    return NextResponse.json({
      games: gamesWithQuestions,
      activeSession,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao listar jogos.' },
      { status: 500 }
    );
  }
}

// POST: Manage games and host live sessions
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const isOwnerOrAdmin = await isEventAdmin(slug, 'games:manage');
    const authContext = await getEventMembershipContext(slug);

    const isAuthorized =
      isOwnerOrAdmin ||
      (authContext &&
        (hasPermission(authContext.role, authContext.permissions, 'games:manage') ||
          hasPermission(authContext.role, authContext.permissions, 'games:host') ||
          hasPermission(authContext.role, authContext.permissions, 'screen:control') ||
          hasPermission(authContext.role, authContext.permissions, 'screen:*')));

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Acesso reservado ao operador do evento.' }, { status: 403 });
    }

    const db = getDb();
    const [eventRow] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);
    if (!eventRow) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const eventId = authContext?.event?.id || eventRow.id;
    const userId = authContext?.user?.id || eventRow.ownerId || 1;
    const now = new Date().toISOString();

    const body = await request.json() as {
      action?: string;
      gameId?: number;
      sessionId?: number;
      questionIndex?: number;
      title?: string;
      description?: string;
      gameType?: string;
      questionData?: {
        id?: number;
        title: string;
        questionType?: string;
        options: string[];
        correctAnswer: string;
        timeLimit?: number;
        points?: number;
        explanation?: string;
      };
    };

    const action = body.action || '';

    // 1. Create a new Live Game
    if (action === 'create-game') {
      const title = (body.title || 'Super Quiz da Celebração').trim();
      const [newGame] = await db
        .insert(liveGames)
        .values({
          eventId,
          title,
          description: body.description || 'Competição interativa ao vivo para todos os convidados.',
          gameType: body.gameType || 'quiz',
          settings: JSON.stringify({ timePerQuestion: 20 }),
          status: 'ativo',
          createdAt: now,
        })
        .returning();

      // Seed default questions if creating a starter quiz
      const defaultQuestions = [
        {
          title: 'Em que ano começou esta jornada inesquecível?',
          options: ['2020', '2021', '2022', '2023'],
          correctAnswer: '1',
          timeLimit: 20,
          explanation: 'O percurso teve início oficial em 2021!',
        },
        {
          title: 'Qual é o prato preferido do anfitrião?',
          options: ['Bife na Chapa', 'Mocoto Tradicional', 'Camarão Grelhado', 'Massa com Marisco'],
          correctAnswer: '2',
          timeLimit: 20,
          explanation: 'O camarão grelhado é a grande paixão gastronómica!',
        },
        {
          title: 'Qual foi o lema mais repetido durante a formação?',
          options: ['Desistir nunca', 'Foco, Força e Fé', 'Com rigor e excelência', 'Tudo vale a pena'],
          correctAnswer: '1',
          timeLimit: 20,
          explanation: 'Foco, Força e Fé guiou cada conquista!',
        },
      ];

      for (let i = 0; i < defaultQuestions.length; i++) {
        const q = defaultQuestions[i];
        await db.insert(gameQuestions).values({
          gameId: newGame.id,
          orderIndex: i + 1,
          questionType: 'multiple_choice',
          title: q.title,
          options: JSON.stringify(q.options),
          correctAnswer: q.correctAnswer,
          timeLimit: q.timeLimit,
          points: 1000,
          explanation: q.explanation,
          createdAt: now,
        });
      }

      return NextResponse.json({ ok: true, game: newGame });
    }

    // 2. Add Question to Game
    if (action === 'add-question' && body.gameId && body.questionData) {
      const q = body.questionData;
      const [inserted] = await db
        .insert(gameQuestions)
        .values({
          gameId: body.gameId,
          orderIndex: 99,
          questionType: q.questionType || 'multiple_choice',
          title: q.title.trim(),
          options: JSON.stringify(q.options || []),
          correctAnswer: String(q.correctAnswer || '0'),
          timeLimit: q.timeLimit || 20,
          points: q.points || 1000,
          explanation: q.explanation || '',
          createdAt: now,
        })
        .returning();

      return NextResponse.json({ ok: true, question: inserted });
    }

    // 3. Start Live Room / Session (Kahoot Style)
    if (action === 'start-session' && body.gameId) {
      const pin = generatePin();
      const [session] = await db
        .insert(gameSessions)
        .values({
          gameId: body.gameId,
          eventId,
          pin,
          status: 'lobby',
          currentQuestionIndex: 0,
          version: 1,
          createdAt: now,
        })
        .returning();

      // Put TV in Quiz mode and link active game session
      const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, eventId)).limit(1);
      const nextVersion = (settings?.version || 1) + 1;

      await db
        .update(screenSettings)
        .set({
          activeSceneId: 'quiz',
          activeGameId: body.gameId,
          activeGameSessionId: session.id,
          sceneStartedAt: now,
          isPaused: true, // Freeze on quiz scene
          version: nextVersion,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      await logAuditAction({
        eventId,
        userId,
        userName: authContext?.user?.name || 'Operador AV',
        action: 'games:start_session',
        entity: 'game_sessions',
        details: { sessionId: session.id, pin },
      });

      return NextResponse.json({ ok: true, session });
    }

    // 4. Launch Question to TV and mobile devices
    if (action === 'start-question' && body.sessionId) {
      const targetQuestionIndex = body.questionIndex !== undefined ? body.questionIndex : 0;

      const [session] = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.id, body.sessionId))
        .limit(1);

      if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });

      const nextSessionVer = (session.version || 1) + 1;
      await db
        .update(gameSessions)
        .set({
          status: 'question_active',
          currentQuestionIndex: targetQuestionIndex,
          questionStartedAt: now,
          version: nextSessionVer,
        })
        .where(eq(gameSessions.id, body.sessionId));

      // Bump screen settings version to trigger SSE
      const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, eventId)).limit(1);
      await db
        .update(screenSettings)
        .set({
          activeSceneId: 'quiz',
          version: (settings?.version || 1) + 1,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, status: 'question_active', questionIndex: targetQuestionIndex });
    }

    // 5. Reveal Answer & Show Results Bar Chart
    if (action === 'reveal-answer' && body.sessionId) {
      const [session] = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.id, body.sessionId))
        .limit(1);

      if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });

      const nextSessionVer = (session.version || 1) + 1;
      await db
        .update(gameSessions)
        .set({
          status: 'question_ended',
          version: nextSessionVer,
        })
        .where(eq(gameSessions.id, body.sessionId));

      const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, eventId)).limit(1);
      await db
        .update(screenSettings)
        .set({
          version: (settings?.version || 1) + 1,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, status: 'question_ended' });
    }

    // 6. Show Podium / Final Leaderboard
    if (action === 'show-podium' && body.sessionId) {
      const [session] = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.id, body.sessionId))
        .limit(1);

      if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });

      const nextSessionVer = (session.version || 1) + 1;
      await db
        .update(gameSessions)
        .set({
          status: 'podium',
          version: nextSessionVer,
        })
        .where(eq(gameSessions.id, body.sessionId));

      const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, eventId)).limit(1);
      await db
        .update(screenSettings)
        .set({
          version: (settings?.version || 1) + 1,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, status: 'podium' });
    }

    // 7. End Game and return TV to normal rotation
    if (action === 'end-session' && body.sessionId) {
      await db
        .update(gameSessions)
        .set({ status: 'concluded' })
        .where(eq(gameSessions.id, body.sessionId));

      const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, eventId)).limit(1);
      await db
        .update(screenSettings)
        .set({
          activeSceneId: 'welcome',
          activeGameSessionId: null,
          isPaused: false,
          version: (settings?.version || 1) + 1,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, status: 'concluded' });
    }

    // 8. Rehearsal Mode: Simulate 10 participants with scores
    if (action === 'simulate-players' && body.sessionId) {
      const simulatedNames = [
        { name: 'Dr. João Machel', table: '1', avatar: '👨‍⚕️', score: 2850 },
        { name: 'Dra. Maria Lurdes', table: '2', avatar: '👩‍⚕️', score: 2600 },
        { name: 'Eng. Américo', table: '1', avatar: '🎓', score: 2450 },
        { name: 'Prof. Bento Sitoe', table: '3', avatar: '📚', score: 2100 },
        { name: 'Tia Helena', table: '4', avatar: '✨', score: 1950 },
        { name: 'Marta Charles', table: '2', avatar: '🥂', score: 1800 },
        { name: 'Carlos Jr.', table: '4', avatar: '🎉', score: 1750 },
        { name: 'Dra. Vanessa', table: '3', avatar: '🌟', score: 1600 },
        { name: 'Paulo Silva', table: '5', avatar: '🏆', score: 1400 },
        { name: 'Isabel Cossa', table: '5', avatar: '👏', score: 1250 },
      ];

      for (const p of simulatedNames) {
        await db.insert(gameParticipants).values({
          sessionId: body.sessionId,
          nickname: p.name,
          tableNumber: p.table,
          avatar: p.avatar,
          score: p.score,
          streak: Math.floor(p.score / 800),
          isConnected: true,
          lastActiveAt: now,
          createdAt: now,
        });
      }

      // Bump session version
      const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, body.sessionId)).limit(1);
      await db
        .update(gameSessions)
        .set({ version: (session?.version || 1) + 1 })
        .where(eq(gameSessions.id, body.sessionId));

      const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, eventId)).limit(1);
      await db
        .update(screenSettings)
        .set({ version: (settings?.version || 1) + 1, updatedAt: now })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, simulatedCount: simulatedNames.length });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar comando do jogo.' },
      { status: 500 }
    );
  }
}
