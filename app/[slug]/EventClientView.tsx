'use client';
import { useState, useEffect } from 'react';
import {
  CalendarDays, MapPin, Search, Check, Sparkles, Lock, X, Shield,
  Camera
} from 'lucide-react';
import Countdown from '../../components/Countdown';
import AdminDashboard from '../AdminDashboard';

interface EventData {
  id: number;
  slug: string;
  title: string;
  hostName: string;
  eventDate: string;
  venue: string;
  description: string;
  coverTheme: string;
  photoAlbumUrl?: string | null;
  createdAt: string;
}

interface GuestSearchResult {
  id: number;
  name: string;
  tableId: number;
  tableName: string;
  seat: number;
  status: string;
}

export default function EventClientView({
  event,
  initialAdmin = false,
}: {
  event: EventData;
  initialAdmin: boolean;
}) {
  const [isAdmin, setIsAdmin] = useState(initialAdmin);
  const [viewMode, setViewMode] = useState<'guest' | 'admin'>(initialAdmin ? 'admin' : 'guest');

  // Search & RSVP state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GuestSearchResult[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestSearchResult | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState<string>('');
  const [rsvpMessage, setRsvpMessage] = useState<string>('');
  const [rsvpLoading, setRsvpLoading] = useState(false);

  // Admin login modal state
  const [loginModal, setLoginModal] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const formattedDate = new Date(
    (event.eventDate || '2026-12-11T14:00') + ':00+02:00'
  ).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Maputo',
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    setSearching(true);
    setSelectedGuest(null);
    setRsvpMessage('');
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'guest-search', name: searchQuery }),
      });
      const data = await res.json() as { results?: GuestSearchResult[]; error?: string };
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleRsvp = async (status: 'confirmado' | 'recusado') => {
    if (!selectedGuest) return;
    setRsvpLoading(true);
    setRsvpMessage('');
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'rsvp-confirm',
          guestId: selectedGuest.id,
          status,
        }),
      });
      const data = await res.json() as { ok?: boolean; status?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Erro ao registar confirmação');

      setSelectedGuest({ ...selectedGuest, status });
      setRsvpMessage(
        status === 'confirmado'
          ? '✦ Presença confirmada com sucesso! Esperamos por si nesta noite memorável.'
          : 'Compreendemos que não poderá comparecer. Agradecemos por nos avisar.'
      );
    } catch (e) {
      setRsvpMessage(e instanceof Error ? e.message : 'Erro ao confirmar');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: event.slug, passcode }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Código de acesso incorreto');
      }
      setIsAdmin(true);
      setViewMode('admin');
      setLoginModal(false);
      setPasscode('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Código incorreto');
    } finally {
      setLoginLoading(false);
    }
  };

  if (isAdmin && viewMode === 'admin') {
    return (
      <AdminDashboard
        slug={event.slug}
        onPreview={() => setViewMode('guest')}
        onExit={() => { setIsAdmin(false); setViewMode('guest'); }}
      />
    );
  }

  return (
    <div className="event-portal-page">
      {/* Top navigation */}
      <header className="portal-nav">
        <a className="portal-brand" href="/">
          <Sparkles size={20} className="portal-icon" />
          <span>Eventox</span>
        </a>
        <div className="portal-nav-actions">
          {isAdmin ? (
            <button className="primary-pill" onClick={() => setViewMode('admin')}>
              <Shield size={16} /> Abrir painel
            </button>
          ) : (
            <button className="outline-pill" onClick={() => setLoginModal(true)}>
              <Lock size={15} /> Área do organizador
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="portal-hero">
        <div className="portal-hero-container">
          <h1 className="portal-title">{event.title}</h1>
          <p className="portal-host">
            Anfitrião: <strong>{event.hostName}</strong>
          </p>
          <div className="portal-meta-chips">
            <div className="portal-chip">
              <CalendarDays size={18} />
              <span>{formattedDate}</span>
            </div>
            <div className="portal-chip">
              <MapPin size={18} />
              <span>{event.venue || 'Local a definir'}</span>
            </div>
          </div>
          <a className="primary-pill portal-rsvp-link" href="#confirmar-presenca">
            <Check size={18} /> Confirmar presença
          </a>
          {event.description && <p className="portal-description">{event.description}</p>}
        </div>
      </section>

      {/* RSVP & Seat Finder Section */}
      <section className="portal-rsvp-section" id="confirmar-presenca" tabIndex={-1}>
        <div className="portal-rsvp-card">
          <div className="rsvp-header">
            <h2>Confirma a tua presença</h2>
            <p>Digita o teu nome para consultar a tua mesa, número do lugar e confirmar a tua presença.</p>
          </div>

          <form onSubmit={handleSearch} className="guest-search-form">
            <div className="search-input-wrap">
              <Search size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex.: João Silva..."
                required
              />
            </div>
            <button type="submit" className="primary-button" disabled={searching}>
              {searching ? 'A pesquisar…' : 'Consultar Lugar'}
            </button>
          </form>

          {/* Search results */}
          {searchResults.length > 0 && !selectedGuest && (
            <div className="search-results-list">
              <p className="results-count">Encontrámos {searchResults.length} resultado(s):</p>
              {searchResults.map((guest) => (
                <div
                  key={guest.id}
                  className="search-result-item"
                  onClick={() => setSelectedGuest(guest)}
                >
                  <div>
                    <strong>{guest.name}</strong>
                    <small>{guest.tableName} · Lugar {String(guest.seat).padStart(2, '0')}</small>
                  </div>
                  <span className={`status-badge ${guest.status}`}>
                    {guest.status === 'confirmado' ? 'Confirmado' : guest.status === 'recusado' ? 'Não comparece' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <p className="no-results-hint">
              Não encontrámos nenhum convidado com esse nome. Verifica a escrita ou fala com a comissão organizadora.
            </p>
          )}

          {/* Selected Guest Details & Action */}
          {selectedGuest && (
            <div className="guest-detail-card">
              <div className="guest-detail-header">
                <div>
                  <span className="overline">CONVIDADO SELECIONADO</span>
                  <h3>{selectedGuest.name}</h3>
                </div>
                <button className="text-button" onClick={() => setSelectedGuest(null)}>
                  Alterar pesquisa
                </button>
              </div>

              <div className="guest-seating-grid">
                <div className="seating-item">
                  <span className="seating-label">MESA ATRIBUÍDA</span>
                  <strong className="seating-val">{selectedGuest.tableName}</strong>
                </div>
                <div className="seating-item">
                  <span className="seating-label">LUGAR RESERVADO</span>
                  <strong className="seating-val seat-num">#{String(selectedGuest.seat).padStart(2, '0')}</strong>
                </div>
                <div className="seating-item">
                  <span className="seating-label">ESTADO ATUAL</span>
                  <span className={`status-badge ${selectedGuest.status}`}>
                    {selectedGuest.status === 'confirmado' ? 'Confirmado' : selectedGuest.status === 'recusado' ? 'Não comparece' : 'Aguardar resposta'}
                  </span>
                </div>
              </div>

              <div className="rsvp-action-box">
                <p>Por favor confirma a tua presença para prepararmos o teu lugar na festa:</p>
                <div className="rsvp-buttons">
                  <button
                    className="confirm-btn"
                    disabled={rsvpLoading || selectedGuest.status === 'confirmado'}
                    onClick={() => handleRsvp('confirmado')}
                  >
                    <Check size={18} /> Confirmar Presença
                  </button>
                  <button
                    className="decline-btn"
                    disabled={rsvpLoading || selectedGuest.status === 'recusado'}
                    onClick={() => handleRsvp('recusado')}
                  >
                    <X size={18} /> Não Poderei Comparecer
                  </button>
                </div>
              </div>

              {rsvpMessage && (
                <div className={`rsvp-feedback ${selectedGuest.status === 'confirmado' ? 'success' : 'info'}`}>
                  {rsvpMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Countdown Card */}
      <section className="portal-countdown-section">
        <div className="portal-countdown-container">
          <Countdown date={event.eventDate} title="Contagem regressiva" />
        </div>
      </section>

      {event.photoAlbumUrl && (
        <section className="portal-gallery-section">
          <div className="portal-gallery-card">
            <div className="gallery-header">
              <h2>Álbum de fotos</h2>
              <p>Vê e partilha fotografias do evento no álbum do anfitrião.</p>
            </div>
            <a href={event.photoAlbumUrl} target="_blank" rel="noopener noreferrer" className="gallery-primary-button">
              <Camera size={20} /> Abrir álbum de fotos
            </a>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="portal-footer">
        <div className="footer-container">
          <p>© 2026 {event.title} ✦ Eventox — Gestão Inteligente de Eventos</p>
          <div className="footer-links">
            <a href="/">Criar um Evento</a>
          </div>
        </div>
      </footer>

      {/* Admin Passcode Modal */}
      {loginModal && (
        <div className="modal-cover" onMouseDown={(e) => { if (e.target === e.currentTarget) setLoginModal(false); }}>
          <div className="modal compact">
            <div className="modal-title">
              <div>
                <span className="overline">ACESSO RESERVADO</span>
                <h2>Área do organizador</h2>
              </div>
              <button onClick={() => setLoginModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAdminLogin} className="form-grid">
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                Introduz o código de acesso / PIN de administração do evento <strong>{event.title}</strong>.
              </p>
              {loginError && <div className="error" style={{ margin: 0 }}>{loginError}</div>}
              <label className="field full">
                Código de Acesso
                <input
                  type="password"
                  autoFocus
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Código de administração..."
                />
              </label>
              <div className="modal-actions full">
                <button type="button" className="outline" onClick={() => setLoginModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary" disabled={loginLoading}>
                  {loginLoading ? 'A validar…' : 'Entrar no Painel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
