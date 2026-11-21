import { redirect } from 'next/navigation';
import AdminDashboard from '../../AdminDashboard';
import { getEventMembershipContext } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function OrganizerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getEventMembershipContext(slug);
  if (!access) redirect(`/${encodeURIComponent(slug)}?organizar=1`);

  return (
    <AdminDashboard
      slug={access.event.slug}
      role={access.role}
      permissions={access.permissions}
    />
  );
}
