import { getDb } from '@/db';
import { events, screenSettings, screenMessages } from '@/db/schema';
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
  let lastUpdatedAt = '';
  let lastMessageId = 0;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`));

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

          const isSettingsUpdated = settings && settings.updatedAt !== lastUpdatedAt;
          const isMessageUpdated = latestMsg && latestMsg.id !== lastMessageId;

          if (isSettingsUpdated || isMessageUpdated) {
            if (settings) lastUpdatedAt = settings.updatedAt;
            if (latestMsg) lastMessageId = latestMsg.id;

            const payload = JSON.stringify({
              settings,
              activeMessage: latestMsg || null,
              timestamp: Date.now(),
            });

            controller.enqueue(encoder.encode(`event: update\ndata: ${payload}\n\n`));
          } else {
            // Heartbeat
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          }
        } catch {
          // ignore transient poll error
        }
      };

      // Poll every 2 seconds
      intervalId = setInterval(pollForUpdates, 2000);
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
