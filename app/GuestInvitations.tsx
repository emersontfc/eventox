'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Search, Users, X } from 'lucide-react';

type Guest = { id: number; name: string; tableName: string | null };
type Invitation = { token: string; guestId: number; companionId: number | null };
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt');

export default function GuestInvitations({ slug }: { slug: string }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const endpoint = `/api/events/${encodeURIComponent(slug)}/guest-invites`;
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [latest, setLatest] = useState('');
  const [copied, setCopied] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setInvitations(data.invitations);
      setGuests(data.guests);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message || 'Não foi possível carregar os convites.');
    });
    return () => controller.abort();
  }, [endpoint, reload]);

  const guestNames = new Map(guests.map(guest => [guest.id, guest.name]));
  const invitationsByGuest = new Map<number, Invitation>();

  for (const invite of invitations ?? []) {
    invitationsByGuest.set(invite.guestId, invite);
    if (invite.companionId !== null) invitationsByGuest.set(invite.companionId, invite);
  }

  const searchTerms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  const results = query.trim()
    ? guests.filter(guest => searchTerms.every(term => normalize(guest.name).includes(term))).slice(0, 8)
    : [];
  const names = (invite: Invitation) => [invite.guestId, invite.companionId]
    .filter(id => id !== null).map(id => guestNames.get(id) || 'Convidado removido').join(' e ');
  const visibleInvites = (invitations ?? []).filter(invite => normalize(names(invite)).includes(normalize(listQuery.trim())));

  async function create() {
    if (!selected.length || busy || !invitations) return;
    const replaceSingles = selected.length === 2 && selected.some(id => invitationsByGuest.get(id)?.companionId === null);
    if (replaceSingles && !confirm('Criar um link para o casal e desativar os links individuais anteriores?')) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: selected, replaceSingles }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const invite: Invitation = data.invitation;
      setInvitations(previous => [invite, ...(previous ?? []).filter(item =>
        !selected.includes(item.guestId) && (item.companionId === null || !selected.includes(item.companionId)))]);
      setLatest(invite.token);
      setSelected([]);
      setQuery('');
      setListQuery('');
      setFeedback('Convite pronto. Copia o link para enviar aos convidados.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível criar o convite.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invite: Invitation) {
    if (!confirm(`Desativar o link de ${names(invite)}?`)) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setInvitations(previous => previous?.filter(item => item.token !== invite.token) ?? []);
      if (latest === invite.token) setLatest('');
      setFeedback('Link desativado.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível revogar o convite.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    setError('');
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/convites/${token}`);
      setCopied(token);
    } catch {
      setError('Não foi possível copiar. Abre o convite e copia o endereço do navegador.');
    }
  }

  return (
    <section className="guest-invites-admin">
      <header className="desk-heading">
        <h1>Convites digitais</h1>
        <p>Cria um link pessoal para um convidado ou um link partilhado para um casal.</p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {feedback && <p className="desk-feedback" role="status"><Check size={18} />{feedback}</p>}
      <div className="guest-invites-layout">
        <section className="guest-invites-box">
          <h2>Novo convite</h2>
          <p>Seleciona até dois nomes da lista de convidados.</p>
          <ul className="guest-invites-selected" aria-label="Convidados selecionados">
            {selected.map(id => (
              <li key={id}>
                {guestNames.get(id)}
                <button type="button" aria-label={`Retirar ${guestNames.get(id)}`} disabled={busy}
                  onClick={() => setSelected(previous => previous.filter(value => value !== id))}><X size={16} /></button>
              </li>
            ))}
          </ul>
          {selected.length < 2 && (
            <>
              <label className="desk-search">
                <Search size={18} aria-hidden="true" />
                <input type="search" aria-label="Pesquisar convidado para o convite" placeholder="Pesquisar nome" value={query}
                  onChange={event => setQuery(event.target.value)} disabled={busy} />
              </label>
              {query.trim() && (
                <ul className="guest-invites-results">
                  {results.map(guest => {
                    const existing = invitationsByGuest.get(guest.id);
                    return (
                      <li key={guest.id}>
                        <button type="button" disabled={busy || selected.includes(guest.id) ||
                          (Boolean(existing?.companionId) && ![existing?.guestId, existing?.companionId].includes(selected[0]))}
                          onClick={() => { setSelected(previous => [...previous, guest.id]); setQuery(''); }}>
                          <strong>{guest.name}</strong>
                          <small>{existing ? existing.companionId ? 'Já tem convite de casal' : 'Já tem convite individual'
                            : guest.tableName ?? 'Convidado'}</small>
                        </button>
                      </li>
                    );
                  })}
                  {!results.length && <li>Nenhum convidado encontrado.</li>}
                </ul>
              )}
            </>
          )}
          <button type="button" className="primary" disabled={busy || !selected.length || !invitations} onClick={create}>
            <Link2 size={17} />{selected.length === 2 ? 'Criar convite de casal' : 'Criar convite individual'}
          </button>
        </section>
        <section className="guest-invites-box">
          <h2>Links criados</h2>
          {(invitations?.length ?? 0) > 0 && (
            <label className="desk-search"><Search size={18} aria-hidden="true" />
              <input type="search" aria-label="Pesquisar links criados" placeholder="Procurar por nome"
                value={listQuery} onChange={event => setListQuery(event.target.value)} />
            </label>
          )}
          {!invitations && (error ? <button type="button" className="outline" onClick={() => {
            setError(''); setReload(value => value + 1);
          }}>Tentar novamente</button> : <p>A carregar…</p>)}
          {invitations && !visibleInvites.length && <p>{listQuery ? 'Nenhum link encontrado.' : 'Ainda não foram criados convites.'}</p>}
          <ul className="guest-invites-list">
            {visibleInvites.map(invite => (
              <li key={invite.token} data-latest={latest === invite.token}>
                <div>
                  <strong>{names(invite)}</strong>
                  <small><Users size={14} aria-hidden="true" />{invite.companionId ? 'Casal' : 'Individual'}</small>
                </div>
                <div className="organizer-actions">
                  <button type="button" className="primary" onClick={() => copy(invite.token)}>
                    <Copy size={15} />{copied === invite.token ? 'Copiado' : 'Copiar link'}
                  </button>
                  <a className="outline" href={`/convites/${invite.token}`} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} /> Abrir
                  </a>
                  <button type="button" className="outline" disabled={busy} onClick={() => revoke(invite)}>Revogar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
