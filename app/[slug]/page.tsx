import { getDb } from '../../db';
import { events } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { isEventAdmin } from '../../lib/auth';
import EventClientView from './EventClientView';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EventPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);

  if (!event) {
    notFound();
  }

  const admin = await isEventAdmin(slug);

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
      initialAdmin={admin}
    />
  );
}
