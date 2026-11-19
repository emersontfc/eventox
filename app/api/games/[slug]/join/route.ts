import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  events, gameSessions, gameParticipants,
  gameQuestions, gameAnswers, screenSettings
} from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET: Check participant status and get current active question
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const participantIdStr = searchParams.get('participantId');
    const sessionIdStr = searchParams.get('sessionId');

    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    // 1. If checking active session for event
    let targetSession = null;
    if (sessionIdStr) {
      [targetSession] = await db.select().from(gameSessions).where(eq(gameSessions.id, Number(sessionIdStr))).limit(1);
    } else {
      const [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, event.id)).limit(1);
      if (settings?.activeGameSessionId) {
        [targetSession] = await db.select().from(gameSessions).where(eq(gameSessions.id, settings.activeGameSessionId)).limit(1);
      }
    }

    if (!targetSession) {
      return NextResponse.json({
        hasActiveSession: false,
        message: 'Nenhum jogo ativo de momento. Aguarde o operador iniciar!',
      });
    }

    // 2. Participant info if provided
    let participant = null;
    let hasAnsweredCurrent = false;
    let lastAnswerResult: Record<string, any> | null = null;

    if (participantIdStr) {
      const pId = Number(participantIdStr);
      [participant] = await db
        .select()
        .from(gameParticipants)
        .where(and(eq(gameParticipants.id, pId), eq(gameParticipants.sessionId, targetSession.id)))
        .limit(1);
    }

    // 3. Current Question
    const questions = await db
      .select()
      .from(gameQuestions)
      .where(eq(gameQuestions.gameId, targetSession.gameId))
      .orderBy(asc(gameQuestions.orderIndex), asc(gameQuestions.id));

    const currentQ = questions[targetSession.currentQuestionIndex];
    let sanitizedQuestion = null;

    if (currentQ) {
      let parsedOptions: string[] = [];
      try {
        parsedOptions = JSON.parse(currentQ.options);
      } catch {
        parsedOptions = [];
      }

      sanitizedQuestion = {
        id: currentQ.id,
        orderIndex: targetSession.currentQuestionIndex + 1,
        totalQuestions: questions.length,
        title: currentQ.title,
        options: parsedOptions,
        timeLimit: currentQ.timeLimit,
        points: currentQ.points,
      };

      // Check if participant already answered
      if (participant) {
        const [existingAns] = await db
          .select()
          .from(gameAnswers)
          .where(and(eq(gameAnswers.participantId, participant.id), eq(gameAnswers.questionId, currentQ.id)))
          .limit(1);

        if (existingAns) {
          hasAnsweredCurrent = true;
          lastAnswerResult = {
            answer: existingAns.answer,
            isCorrect: existingAns.isCorrect,
            pointsEarned: existingAns.points,
          };
        }
      }
    }

    return NextResponse.json({
      hasActiveSession: true,
      session: {
        id: targetSession.id,
        pin: targetSession.pin,
        status: targetSession.status,
        questionStartedAt: targetSession.questionStartedAt,
      },
      participant,
      currentQuestion: sanitizedQuestion,
      hasAnsweredCurrent,
      lastAnswerResult,
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao obter dados do jogo.' },
      { status: 500 }
    );
  }
}

// POST: Join room or Submit answer
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const body = await request.json() as {
      action: 'join' | 'submit-answer';
      pin?: string;
      nickname?: string;
      tableNumber?: string;
      avatar?: string;
      sessionId?: number;
      participantId?: number;
      questionId?: number;
      answer?: string;
      clientTimeMs?: number;
    };

    const now = new Date().toISOString();

    // 1. Join room via PIN
    if (body.action === 'join') {
      const pin = (body.pin || '').trim();
      const nickname = (body.nickname || '').trim().slice(0, 30);
      const tableNumber = (body.tableNumber || '').trim().slice(0, 10);
      const avatar = body.avatar || '🎉';

      if (!pin) {
        return NextResponse.json({ error: 'Código PIN é obrigatório.' }, { status: 400 });
      }

      if (!nickname) {
        return NextResponse.json({ error: 'Por favor introduz o teu nome.' }, { status: 400 });
      }

      // Find session by PIN
      const [session] = await db
        .select()
        .from(gameSessions)
        .where(and(eq(gameSessions.eventId, event.id), eq(gameSessions.pin, pin)))
        .orderBy(desc(gameSessions.id))
        .limit(1);

      if (!session) {
        return NextResponse.json({ error: 'Código PIN inválido ou sala não encontrada.' }, { status: 404 });
      }

      if (session.status === 'concluded') {
        return NextResponse.json({ error: 'Esta partida já foi encerrada.' }, { status: 400 });
      }

      // Check if nickname already exists in this session
      const [existing] = await db
        .select()
        .from(gameParticipants)
        .where(and(eq(gameParticipants.sessionId, session.id), eq(gameParticipants.nickname, nickname)))
        .limit(1);

      if (existing) {
        // Reconnection for existing participant
        return NextResponse.json({
          ok: true,
          reconnected: true,
          participant: existing,
          sessionId: session.id,
        });
      }

      const [newParticipant] = await db
        .insert(gameParticipants)
        .values({
          sessionId: session.id,
          nickname,
          tableNumber: tableNumber || null,
          avatar,
          score: 0,
          streak: 0,
          isConnected: true,
          lastActiveAt: now,
          createdAt: now,
        })
        .returning();

      // Bump session version
      await db
        .update(gameSessions)
        .set({ version: (session.version || 1) + 1 })
        .where(eq(gameSessions.id, session.id));

      return NextResponse.json({
        ok: true,
        participant: newParticipant,
        sessionId: session.id,
      });
    }

    // 2. Submit Question Answer
    if (body.action === 'submit-answer') {
      const { sessionId, participantId, questionId, answer } = body;

      if (!sessionId || !participantId || !questionId || answer === undefined) {
        return NextResponse.json({ error: 'Dados de resposta incompletos.' }, { status: 400 });
      }

      const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, sessionId)).limit(1);
      if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 });

      if (session.status !== 'question_active') {
        return NextResponse.json({ error: 'O tempo para responder a esta pergunta já expirou!' }, { status: 400 });
      }

      const [question] = await db.select().from(gameQuestions).where(eq(gameQuestions.id, questionId)).limit(1);
      if (!question) return NextResponse.json({ error: 'Pergunta não encontrada.' }, { status: 404 });

      // Verify participant hasn't answered already
      const [existing] = await db
        .select()
        .from(gameAnswers)
        .where(and(eq(gameAnswers.participantId, participantId), eq(gameAnswers.questionId, questionId)))
        .limit(1);

      if (existing) {
        return NextResponse.json({ error: 'Já submeteste a tua resposta a esta pergunta!' }, { status: 400 });
      }

      // Check server timing
      const startedAtMs = session.questionStartedAt ? new Date(session.questionStartedAt).getTime() : Date.now();
      const currentMs = Date.now();
      const responseMs = Math.max(100, currentMs - startedAtMs);
      const allowedMs = (question.timeLimit + 2) * 1000; // 2s grace for network latency

      if (responseMs > allowedMs) {
        return NextResponse.json({ error: 'Tempo limite esgotado.' }, { status: 400 });
      }

      const isCorrect = String(question.correctAnswer).trim().toLowerCase() === String(answer).trim().toLowerCase();

      // Kahoot-style speed bonus calculation:
      // Base points (1000). Fastest answers get close to 1000, slowest get around 500.
      let earnedPoints = 0;
      if (isCorrect) {
        const timeFraction = Math.max(0, Math.min(1, responseMs / (question.timeLimit * 1000)));
        earnedPoints = Math.round(question.points * (1 - timeFraction * 0.5));
      }

      await db.insert(gameAnswers).values({
        sessionId,
        participantId,
        questionId,
        answer: String(answer),
        isCorrect,
        points: earnedPoints,
        responseMs,
        createdAt: now,
      });

      // Update participant score and streak
      const [participant] = await db
        .select()
        .from(gameParticipants)
        .where(eq(gameParticipants.id, participantId))
        .limit(1);

      const nextStreak = isCorrect ? (participant?.streak || 0) + 1 : 0;
      const nextScore = (participant?.score || 0) + earnedPoints;

      await db
        .update(gameParticipants)
        .set({
          score: nextScore,
          streak: nextStreak,
          lastActiveAt: now,
        })
        .where(eq(gameParticipants.id, participantId));

      return NextResponse.json({
        ok: true,
        isCorrect,
        pointsEarned: earnedPoints,
        totalScore: nextScore,
        streak: nextStreak,
      });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar resposta do participante.' },
      { status: 500 }
    );
  }
}
