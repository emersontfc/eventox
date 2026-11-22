'use client';

import { useState, type FormEvent } from 'react';

export default function AccountForm({ destination, create }: { destination: string; create: boolean }) {
  const [register, setRegister] = useState(create);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      const response = await fetch(register ? '/api/auth/register' : '/api/auth/user-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(destination);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível entrar.');
      setBusy(false);
    }
  }

  return (
    <section className="auth-modal-card account-card">
      <h1>{register ? 'Criar conta' : 'Entrar na minha conta'}</h1>
      {destination.startsWith('/invite/') && <p>Usa o mesmo email indicado no convite da equipa.</p>}
      {error && <p className="auth-alert-error" role="alert">{error}</p>}
      <form onSubmit={submit}>
        {register && <label className="field">Nome<input name="name" autoComplete="name" required minLength={2} /></label>}
        <label className="field">Email<input type="email" name="email" autoComplete="email" required /></label>
        <label className="field">Palavra-passe
          <input type="password" name="password" autoComplete={register ? 'new-password' : 'current-password'}
            minLength={register ? 6 : undefined} required />
        </label>
        <button className="auth-submit-btn" disabled={busy}>{busy ? 'A processar…' : register ? 'Criar conta' : 'Entrar'}</button>
      </form>
      <button type="button" className="outline" disabled={busy} onClick={() => { setRegister(!register); setError(''); }}>
        {register ? 'Já tenho conta' : 'Criar conta'}
      </button>
      {destination.endsWith('/organizar') && (
        <p><a href={`${destination.slice(0, -'/organizar'.length)}?organizar=1`}>Entrar com o PIN do evento</a></p>
      )}
    </section>
  );
}
