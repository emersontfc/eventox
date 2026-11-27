import { getDb } from '@/db';
import { events, screenSettings, screenMessages, gameSessions, galleryMedia, settings as siteSettings } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { programKey } from '@/lib/event-program-server';
import { readActiveProjection } from '@/lib/projection-server';

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
  let lastContentSignature = '';
  let polling = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`)
      );

      const pollForUpdates = async () => {
        if (polling || request.signal.aborted) return;
        polling = true;
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

          const projection = readActiveProjection(event, Date.now());
          const gallery = settings?.activeSceneId === 'gallery_mural'
            ? db.select({ id: galleryMedia.id, mime: galleryMedia.mime, author: galleryMedia.uploader })
              .from(galleryMedia).where(and(eq(galleryMedia.eventId, event.id), eq(galleryMedia.status, 'aprovado')))
              .orderBy(desc(galleryMedia.featured), desc(galleryMedia.id)).limit(16).all()
            : null;
          const schedule = settings?.activeSceneId === 'schedule'
            ? db.select({ value: siteSettings.value }).from(siteSettings)
              .where(eq(siteSettings.key, programKey(event.id))).get()?.value
            : null;
          const contentSignature = JSON.stringify([projection, gallery, schedule]);
          const contentChanged = contentSignature !== lastContentSignature;

          if (isSettingsChanged || isMsgChanged || isGameChanged || contentChanged) {
            lastContentSignature = contentSignature;
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
          // Clients keep their polling fallback when this connection closes.
        } finally {
          polling = false;
        }
      };

      // Poll every 1.5 seconds for instant response
      intervalId = setInterval(pollForUpdates, 1500);
      request.signal.addEventListener('abort', () => clearInterval(intervalId), { once: true });
      void pollForUpdates();
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
