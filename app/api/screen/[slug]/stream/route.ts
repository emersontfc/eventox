import { getDb } from '@/db';
import { events, screenSettings, screenMessages, gameSessions } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

  if (!event) {
    return new Response('Evento não encontrado', { status: 404 });
  }

  const encoder = new TextEncoder();

  let intervalId: NodeJS.Timeout;
  let lastVersion = -1;
  let lastMessageId = 0;
  let lastSessionVersion = -1;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`)
      );

      const pollForUpdates = async () => {
        try {
          const [settings] = await db
            .select()
            .from(screenSettings)
            .where(eq(screenSettings.eventId, event.id))
            .limit(1);

          const [latestMsg] = await db
            .select()
            .from(screenMessages)
            .where(and(eq(screenMessages.eventId, event.id), eq(screenMessages.status, 'exibido')))
            .orderBy(desc(screenMessages.id))
            .limit(1);

          let gameSessionVersion = 0;
          if (settings?.activeGameSessionId) {
            const [session] = await db
              .select({ version: gameSessions.version })
              .from(gameSessions)
              .where(eq(gameSessions.id, settings.activeGameSessionId))
              .limit(1);
            if (session) gameSessionVersion = session.version;
          }

          const currentVersion = settings?.version || 0;
          const currentMsgId = latestMsg?.id || 0;

          const isSettingsChanged = currentVersion !== lastVersion;
          const isMsgChanged = currentMsgId !== lastMessageId;
          const isGameChanged = gameSessionVersion !== lastSessionVersion;

          if (isSettingsChanged || isMsgChanged || isGameChanged) {
            lastVersion = currentVersion;
            lastMessageId = currentMsgId;
            lastSessionVersion = gameSessionVersion;

            const payload = JSON.stringify({
              settings,
              activeMessage: latestMsg || null,
              timestamp: Date.now(),
              version: currentVersion,
            });

            controller.enqueue(encoder.encode(`event: update\ndata: ${payload}\n\n`));
          } else {
            // Heartbeat comment
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          }
        } catch {
          // ignore transient poll error
        }
      };

      // Poll every 1.5 seconds for instant response
      intervalId = setInterval(pollForUpdates, 1500);
      pollForUpdates();
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
