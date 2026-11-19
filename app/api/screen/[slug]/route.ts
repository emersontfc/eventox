import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  events, screenSettings, screenScenes, screenMessages,
  galleryMedia, quotesLibrary, guests
} from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { getEventMembershipContext, logAuditAction, isEventAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET: Public read-only screen state (sanitized, zero sensitive attendee details)
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    // 1. Screen settings
    let [settings] = await db.select().from(screenSettings).where(eq(screenSettings.eventId, event.id)).limit(1);
    if (!settings) {
      const now = new Date().toISOString();
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
        updatedAt: now,
      }).returning();
    }

    // 2. Screen scenes
    const scenes = await db
      .select()
      .from(screenScenes)
      .where(and(eq(screenScenes.eventId, event.id), eq(screenScenes.isActive, true)))
      .orderBy(asc(screenScenes.position), asc(screenScenes.id));

    // 3. Active / Recent broadcast message (e.g. arrivals welcome message or live announcement)
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
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao carregar estado do ecrã.' },
      { status: 500 }
    );
  }
}

// POST: Operator controls (Requires 'screen:control' or owner)
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const isOwnerOrAdmin = await isEventAdmin(slug);
    const authContext = await getEventMembershipContext(slug);

    if (!isOwnerOrAdmin && (!authContext || !hasPermission(authContext.role, authContext.permissions, 'screen:control'))) {
      return NextResponse.json({ error: 'Acesso reservado ao operador audiovisual.' }, { status: 403 });
    }

    const body = await request.json() as {
      action?: string;
      sceneId?: string;
      autoRotate?: boolean;
      rotateInterval?: number;
      holdScene?: boolean;
      emergencyMode?: boolean;
      emergencyMessage?: string;
      theme?: string;
      backgroundStyle?: string;
      customLogoUrl?: string;
      customHeadline?: string;
      fontFamily?: string;
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

    const action = body.action || '';

    // Switch active scene immediately
    if (action === 'set-active-scene' && body.sceneId) {
      await db
        .update(screenSettings)
        .set({ activeSceneId: body.sceneId, updatedAt: now })
        .where(eq(screenSettings.eventId, eventId));

      await logAuditAction({
        eventId,
        userId,
        userName: authContext?.user?.name || 'Administrador',
        action: 'screen:set_scene',
        entity: 'screen_settings',
        details: { sceneId: body.sceneId },
      });

      return NextResponse.json({ ok: true, activeSceneId: body.sceneId });
    }

    // Toggle auto-rotate
    if (action === 'toggle-auto-rotate' && typeof body.autoRotate === 'boolean') {
      await db
        .update(screenSettings)
        .set({ autoRotate: body.autoRotate, updatedAt: now })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, autoRotate: body.autoRotate });
    }

    // Toggle freeze / hold scene
    if (action === 'toggle-hold' && typeof body.holdScene === 'boolean') {
      await db
        .update(screenSettings)
        .set({ holdScene: body.holdScene, updatedAt: now })
        .where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, holdScene: body.holdScene });
    }

    // Toggle emergency / alert mode
    if (action === 'toggle-emergency' && typeof body.emergencyMode === 'boolean') {
      await db
        .update(screenSettings)
        .set({
          emergencyMode: body.emergencyMode,
          emergencyMessage: body.emergencyMessage !== undefined ? body.emergencyMessage : null,
          updatedAt: now,
        })
        .where(eq(screenSettings.eventId, eventId));

      await logAuditAction({
        eventId,
        userId,
        userName: authContext?.user?.name || 'Administrador',
        action: 'screen:emergency_mode',
        entity: 'screen_settings',
        details: { emergencyMode: body.emergencyMode, message: body.emergencyMessage },
      });

      return NextResponse.json({ ok: true, emergencyMode: body.emergencyMode });
    }

    // Update screen visual settings (theme, background, font, rotation interval)
    if (action === 'update-settings') {
      const updates: Partial<typeof screenSettings.$inferInsert> = { updatedAt: now };
      if (body.theme) updates.theme = body.theme;
      if (body.backgroundStyle) updates.backgroundStyle = body.backgroundStyle;
      if (body.fontFamily) updates.fontFamily = body.fontFamily;
      if (body.customLogoUrl !== undefined) updates.customLogoUrl = body.customLogoUrl;
      if (body.customHeadline !== undefined) updates.customHeadline = body.customHeadline;
      if (body.rotateInterval && body.rotateInterval >= 5) updates.rotateInterval = body.rotateInterval;

      await db.update(screenSettings).set(updates).where(eq(screenSettings.eventId, eventId));

      return NextResponse.json({ ok: true, settings: updates });
    }

    // Update scene properties
    if (action === 'update-scene' && body.sceneData?.id) {
      const s = body.sceneData;
      const updates: Partial<typeof screenScenes.$inferInsert> = {};
      if (s.title !== undefined) updates.title = s.title;
      if (s.subtitle !== undefined) updates.subtitle = s.subtitle;
      if (s.content !== undefined) updates.content = JSON.stringify(s.content);
      if (s.duration !== undefined && s.duration >= 3) updates.duration = s.duration;
      if (s.isActive !== undefined) updates.isActive = s.isActive;

      if (!s.id) {
        return NextResponse.json({ error: 'ID da cena obrigatório.' }, { status: 400 });
      }

      await db
        .update(screenScenes)
        .set(updates)
        .where(and(eq(screenScenes.id, s.id), eq(screenScenes.eventId, eventId)));

      return NextResponse.json({ ok: true });
    }

    // Reorder scenes
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
