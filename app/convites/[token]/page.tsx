import type { Metadata } from 'next';
import { readGuestInvitation } from '../../../lib/guest-invitation-server';
import InvitationView from './InvitationView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Convite pessoal',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await readGuestInvitation(token);
  return <InvitationView token={token} initial={invitation} />;
}
