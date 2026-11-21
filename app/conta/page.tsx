import AccountForm from './AccountForm';

export default async function AccountPage({ searchParams }: {
  searchParams: Promise<{ continuar?: string; criar?: string }>;
}) {
  const { continuar, criar } = await searchParams;
  const destination = typeof continuar === 'string' &&
    /^\/(?:invite\/[a-f0-9]{48}|[a-z0-9-]+\/organizar)$/.test(continuar)
    ? continuar : '/dashboard';

  return (
    <div className="home-portal-wrapper">
      <div className="account-page">
        <a className="outline-pill" href="/">Eventox</a>
        <AccountForm destination={destination} create={criar === '1'} />
      </div>
    </div>
  );
}
