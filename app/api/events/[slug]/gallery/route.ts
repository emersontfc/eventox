import { NextResponse } from 'next/server';
import { getDb } from '../../../../../db';
import { events, galleryMedia } from '../../../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { storage } from '../../../../../lib/storage';
import { isEventAdmin } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug.toLowerCase().trim()))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const admin = await isEventAdmin(slug, 'gallery:moderate');

    const query = db
      .select({
        id: galleryMedia.id,
        key: galleryMedia.key,
        mime: galleryMedia.mime,
        size: galleryMedia.size,
        originalName: galleryMedia.originalName,
        uploader: galleryMedia.uploader,
        album: galleryMedia.album,
        status: galleryMedia.status,
        createdAt: galleryMedia.createdAt,
      })
      .from(galleryMedia)
      .where(
        admin
          ? eq(galleryMedia.eventId, event.id)
          : and(eq(galleryMedia.eventId, event.id), eq(galleryMedia.status, 'aprovado'))
      )
      .orderBy(desc(galleryMedia.id))
      .limit(60);

    const items = await query;

    return NextResponse.json({
      photos: items.map((m: any) => ({
        id: m.id,
        url: `/api/gallery/media/${m.id}`,
        mime: m.mime,
        size: m.size,
        uploader: m.uploader,
        album: m.album,
        originalName: m.originalName,
        status: m.status,
        createdAt: m.createdAt,
      })),
      admin,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar fotos.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug.toLowerCase().trim()))
      .limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Formato multipart esperado.' }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Ficheiro não enviado ou inválido.' }, { status: 400 });
    }

    const allowed = new Set([
      'image/jpeg', 'image/png', 'image/webp', 'image/heic',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]);

    if (!allowed.has(file.type)) {
      return NextResponse.json(
        { error: 'Formato não suportado. Usa JPG, PNG, WebP, MP4 ou MOV.' },
        { status: 400 }
      );
    }

    const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size < 1 || file.size > maxSize) {
      return NextResponse.json(
        { error: 'Tamanho excede o limite (15 MB para fotos, 50 MB para vídeos).' },
        { status: 400 }
      );
    }

    const uploader = String(form.get('uploader') || form.get('name') || '').trim().slice(0, 80) || 'Convidado';
    const album = String(form.get('album') || 'Momentos especiais').trim().slice(0, 60);

    const suffix: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
    };

    const ext = suffix[file.type] || 'jpg';
    const storageKey = `events/${event.slug}/gallery/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const buffer = await file.arrayBuffer();
    await storage.put(storageKey, buffer, {
      httpMetadata: { contentType: file.type },
    });

    const [newRecord] = await db.insert(galleryMedia).values({
      eventId: event.id,
      key: storageKey,
      mime: file.type,
      size: file.size,
      originalName: file.name.slice(0, 160),
      uploader,
      album,
      status: 'aprovado', // Auto-approved for live celebration experience
      createdAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({
      ok: true,
      photo: {
        id: newRecord.id,
        url: `/api/gallery/media/${newRecord.id}`,
        uploader: newRecord.uploader,
        album: newRecord.album,
        mime: newRecord.mime,
        createdAt: newRecord.createdAt,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao processar envio de foto.' },
      { status: 500 }
    );
  }
}
