import { redirect } from 'next/navigation';
import AdminDashboard from '../../AdminDashboard';
import { getEventMembershipContext, getCurrentUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function OrganizerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getEventMembershipContext(slug);
  if (!access) {
    if (await getCurrentUser()) {
      return (
        <div className="account-page">
          <h1>Sem acesso a este evento</h1>
          <p>Entra com a conta que recebeu o convite ou pede à organização para confirmar o teu acesso.</p>
          <a className="outline-pill" href={`/conta?continuar=${encodeURIComponent(`/${slug}/organizar`)}`}>Entrar com outra conta</a>
          <a className="outline-pill" href="/dashboard">Os meus eventos</a>
        </div>
      );
    }
    redirect(`/conta?continuar=${encodeURIComponent(`/${slug}/organizar`)}`);
  }

  return (
    <AdminDashboard
      slug={access.event.slug}
      role={access.role}
      permissions={access.permissions}
    />
  );
}
