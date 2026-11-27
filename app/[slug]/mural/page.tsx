import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { events } from '@/db/schema';
import GuestbookMural from '@/components/GuestbookMural';

export const dynamic = 'force-dynamic';

export default async function GuestbookMuralPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.toLowerCase().trim();
  const [event] = await getDb().select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) notFound();
  return (
    <main className="event-portal-page">
      <a className="guestbook-standalone-link" href={`/${encodeURIComponent(slug)}`}>Voltar ao evento</a>
      <GuestbookMural slug={slug} allowModeration headingLevel={1} />
    </main>
  );
}
