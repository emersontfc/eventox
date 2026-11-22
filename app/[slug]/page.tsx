import type { Metadata } from 'next';
import { getDb } from '../../db';
import { events } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { hasPermission } from '../../lib/permissions';
import { getEventMembershipContext } from '../../lib/auth';
import EventClientView from './EventClientView';
import { readProgram } from '../../lib/event-program-server';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [event] = await getDb().select({
    title: events.title, description: events.description, slug: events.slug,
  }).from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) return {};
  const description = event.description || `Consulta o programa e confirma a tua presença em ${event.title}.`;
  return {
    title: event.title,
    description,
    alternates: { canonical: `/${event.slug}` },
    openGraph: { siteName: 'EventoX', title: event.title, description, url: `/${event.slug}` },
  };
}

export default async function EventPage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ organizar?: string }> }) {
  const { slug } = await props.params;
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);

  if (!event) {
    notFound();
  }

  const access = await getEventMembershipContext(slug);
  const { organizar } = await props.searchParams;

  return (
    <EventClientView
      event={{
        id: event.id,
        slug: event.slug,
        title: event.title,
        hostName: event.hostName,
        eventDate: event.eventDate,
        venue: event.venue,
        description: event.description,
        coverTheme: event.coverTheme,
        photoAlbumUrl: event.photoAlbumUrl || '',
        createdAt: event.createdAt,
      }}
      initialAdmin={Boolean(access)}
      canChangeTheme={Boolean(access && hasPermission(access.role, access.permissions, 'event:manage'))}
      program={(await readProgram(event.id, event.slug)).published}
      openAccess={!access && organizar === '1'}
    />
  );
}
