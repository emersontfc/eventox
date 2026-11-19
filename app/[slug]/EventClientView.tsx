'use client';
import { useState, useEffect } from 'react';
import {
  CalendarDays, MapPin, Search, Check, Sparkles, Lock, ArrowRight,
  UtensilsCrossed, CheckCircle2, UserCheck, X, Shield, Clock3, Heart,
  Camera, ExternalLink, Image, Share2, Music2, Navigation, Shirt,
  CheckCheck, Copy, Plus, UserPlus
} from 'lucide-react';
import Countdown from '../../components/Countdown';
import AdminDashboard from '../AdminDashboard';
import AuthModal from '../../components/AuthModal';
import Confetti from '../../components/Confetti';

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
  const [activeTab, setActiveTab] = useState<'seating' | 'schedule' | 'menu' | 'gallery' | 'info'>('seating');
  const [showConfetti, setShowConfetti] = useState(false);

  // Search & RSVP state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GuestSearchResult[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestSearchResult | null>(null);
  const [rsvpMessage, setRsvpMessage] = useState<string>('');
  const [rsvpLoading, setRsvpLoading] = useState(false);

  // Self-registration state
  const [showSelfReg, setShowSelfReg] = useState(false);
  const [selfRegName, setSelfRegName] = useState('');
  const [selfRegPhone, setSelfRegPhone] = useState('');
  const [selfRegNotes, setSelfRegNotes] = useState('');
  const [selfRegLoading, setSelfRegLoading] = useState(false);
  const [selfRegError, setSelfRegError] = useState('');

  // Copy ticket state
  const [ticketCopied, setTicketCopied] = useState(false);

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const formattedDate = new Date(
    (event.eventDate || '2026-12-11T14:00') + ':00+02:00'
  ).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Maputo',
  });

  const formattedTime = new Date(
    (event.eventDate || '2026-12-11T14:00') + ':00+02:00'
  ).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
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
      if (status === 'confirmado') {
        setShowConfetti(true);
        setRsvpMessage('✦ Presença confirmada com sucesso! O teu lugar na mesa está reservado.');
      } else {
        setRsvpMessage('Agradecemos por nos avisar que não poderás comparecer.');
      }
    } catch (e) {
      setRsvpMessage(e instanceof Error ? e.message : 'Erro ao confirmar');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleSelfRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelfRegError('');
    if (!selfRegName.trim() || selfRegName.length < 3) {
      setSelfRegError('Por favor insere o teu nome completo.');
      return;
    }
    setSelfRegLoading(true);

    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'guest-self-register',
          name: selfRegName.trim(),
          phone: selfRegPhone.trim(),
          notes: selfRegNotes.trim(),
        }),
      });

      const data = await res.json() as {
        ok?: boolean;
        error?: string;
        guest?: GuestSearchResult;
        alreadyExists?: boolean;
      };

      if (!res.ok || !data.ok || !data.guest) {
        throw new Error(data.error || 'Erro ao registar convidado.');
      }

      setSelectedGuest(data.guest);
      setShowSelfReg(false);
      setShowConfetti(true);
      setRsvpMessage(
        data.alreadyExists
          ? 'Encontrámos o teu registo anterior!'
          : '✦ Parabéns! O teu lugar foi atribuído com sucesso.'
      );
    } catch (err) {
      setSelfRegError(err instanceof Error ? err.message : 'Erro ao processar registo.');
    } finally {
      setSelfRegLoading(false);
    }
  };

  const handleCopyTicket = () => {
    if (!selectedGuest) return;
    const text = `🎟️ MEU BILHETE VIP - ${event.title}\nAnfitrião: ${event.hostName}\nConvidado: ${selectedGuest.name}\nMesa: ${selectedGuest.tableName}\nLugar: #${String(selectedGuest.seat).padStart(2, '0')}\nData: ${formattedDate} às ${formattedTime}\nLocal: ${event.venue}\nLink: https://eventox.kazix.site/${event.slug}`;
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setTicketCopied(true);
      setTimeout(() => setTicketCopied(false), 2500);
    }
  };

  if (isAdmin && viewMode === 'admin') {
    return (
      <div>
        <div className="admin-view-banner">
          <span>Modo Administrador Ativo</span>
          <button onClick={() => setViewMode('guest')}>
            Ver como Convidado (Portal Público)
          </button>
        </div>
        <AdminDashboard slug={event.slug} onExit={() => setViewMode('guest')} />
      </div>
    );
  }

  return (
    <div className="event-portal-page">
      <Confetti active={showConfetti} onFinish={() => setShowConfetti(false)} />

      {/* Top navigation */}
      <header className="portal-nav">
        <div className="portal-brand" onClick={() => (window.location.href = '/')}>
          <Sparkles size={20} className="portal-icon" />
          <span>Eventox</span>
        </div>
        <div className="portal-nav-actions">
          {isAdmin ? (
            <button className="primary-pill" onClick={() => setViewMode('admin')}>
              <Shield size={16} /> Painel de Organização
            </button>
          ) : (
            <button className="outline-pill" onClick={() => setAuthModalOpen(true)}>
              <Lock size={15} /> Área de Organização
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="portal-hero">
        <div className="portal-hero-container">
          <span className="portal-badge">✦ CELEBRAÇÃO & CONVITE OFICIAL ✦</span>
          <h1 className="portal-title">{event.title}</h1>
          <p className="portal-host">
            Anfitrião: <strong>{event.hostName}</strong>
          </p>
          <p className="portal-description">
            {event.description ||
              'Uma celebração extraordinária repleta de emoções, memórias e momentos para recordar toda a vida.'}
          </p>

          <div className="portal-meta-chips">
            <div className="portal-chip">
              <CalendarDays size={18} />
              <span>{formattedDate} às {formattedTime}</span>
            </div>
            <div className="portal-chip">
              <MapPin size={18} />
              <span>{event.venue || 'Salão de Eventos'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Countdown Card */}
      <section className="portal-countdown-section">
        <div className="portal-countdown-container">
          <Countdown date={event.eventDate} title="CONTAGEM REGRESSIVA OFICIAL" />
        </div>
      </section>

      {/* Interactive Tabs Navigation */}
      <nav className="portal-tabs-nav" aria-label="Navegação do evento">
        <button
          className={`portal-tab-pill ${activeTab === 'seating' ? 'active' : ''}`}
          onClick={() => setActiveTab('seating')}
        >
          <Search size={15} />
          <span>Mesa & RSVP</span>
        </button>
        <button
          className={`portal-tab-pill ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Clock3 size={15} />
          <span>Programa</span>
        </button>
        <button
          className={`portal-tab-pill ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          <UtensilsCrossed size={15} />
          <span>Cardápio & Bar</span>
        </button>
        <button
          className={`portal-tab-pill ${activeTab === 'gallery' ? 'active' : ''}`}
          onClick={() => setActiveTab('gallery')}
        >
          <Camera size={15} />
          <span>Galeria de Fotos</span>
        </button>
        <button
          className={`portal-tab-pill ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <Navigation size={15} />
          <span>Local & Traje</span>
        </button>
        <button
          className="portal-tab-pill"
          onClick={() => window.open(`/${event.slug}/mural`, '_blank')}
        >
          <Heart size={15} className="text-rose-400" />
          <span>Mural de Felicitações ↗</span>
        </button>
        <button
          className="portal-tab-pill"
          onClick={() => window.open(`/${event.slug}/screen`, '_blank')}
        >
          <Sparkles size={15} className="text-amber-400" />
          <span>Modo Ecrã 16:9 ↗</span>
        </button>
      </nav>

      {/* TAB 1: SEATING FINDER & RSVP & VIP PASS */}
      {activeTab === 'seating' && (
        <section className="portal-rsvp-section">
          <div className="portal-rsvp-card">
            <div className="rsvp-header">
              <span className="overline">CONSULTA DE LUGAR & CONFIRMAÇÃO</span>
              <h2>És um dos nossos convidados de honra?</h2>
              <p>Digita o teu nome para consultar a tua mesa atribuída e confirmar a tua presença.</p>
            </div>

            <form onSubmit={handleSearch} className="guest-search-form">
              <div className="search-input-wrap">
                <Search size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Digita o teu nome ou apelido (ex.: Carlos Mondlane)..."
                  required
                />
              </div>
              <button type="submit" className="primary-button" disabled={searching}>
                {searching ? 'A pesquisar…' : 'Consultar Lugar →'}
              </button>
            </form>

            {/* Search results list */}
            {searchResults.length > 0 && !selectedGuest && (
              <div className="search-results-list">
                <p className="results-count">Encontrámos {searchResults.length} resultado(s):</p>
                {searchResults.map((guest) => (
                  <div
                    key={guest.id}
                    className="search-result-item"
                    onClick={() => {
                      setSelectedGuest(guest);
                      setRsvpMessage('');
                    }}
                  >
                    <div>
                      <strong>{guest.name}</strong>
                      <small>
                        {guest.tableName} · Lugar #{String(guest.seat).padStart(2, '0')}
                      </small>
                    </div>
                    <span className={`status-badge ${guest.status}`}>
                      {guest.status === 'confirmado'
                        ? 'Confirmado'
                        : guest.status === 'recusado'
                        ? 'Não comparece'
                        : 'Aguardar Confirmação'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* No search results hint */}
            {searchResults.length === 0 && searchQuery && !searching && (
              <div className="no-results-hint">
                <p>Não encontrámos nenhum convidado com esse nome na lista prévia.</p>
                <button
                  type="button"
                  className="primary-pill"
                  onClick={() => {
                    setSelfRegName(searchQuery);
                    setShowSelfReg(true);
                  }}
                  style={{ marginTop: '10px' }}
                >
                  <UserPlus size={15} /> Registar Presença Agora (Auto-Registo)
                </button>
              </div>
            )}

            {/* VIRTUAL VIP GALA PASS TICKET */}
            {selectedGuest && (
              <div className="vip-ticket-wrapper">
                <div className="vip-ticket-card">
                  <div className="vip-ticket-header">
                    <span className="vip-ticket-gold-seal">✦ BILHETE VIP OFICIAL ✦</span>
                    <span className="vip-ticket-event-title">{event.title}</span>
                  </div>

                  <h3 className="vip-ticket-guest-name">
                    <span>Sr(a).</span> {selectedGuest.name}
                  </h3>

                  <div className="vip-ticket-body">
                    <div className="vip-ticket-item">
                      <span>MESA ATRIBUÍDA</span>
                      <strong>{selectedGuest.tableName}</strong>
                    </div>
                    <div className="vip-ticket-item">
                      <span>LUGAR RESERVADO</span>
                      <strong className="seat-badge">#{String(selectedGuest.seat).padStart(2, '0')}</strong>
                    </div>
                    <div className="vip-ticket-item">
                      <span>ESTADO</span>
                      <strong style={{ color: selectedGuest.status === 'confirmado' ? '#92e8a6' : '#edd38c' }}>
                        {selectedGuest.status === 'confirmado' ? '✓ Presença Confirmada' : 'Aguardar Resposta'}
                      </strong>
                    </div>
                    <div className="vip-ticket-item">
                      <span>DATA & LOCAL</span>
                      <strong style={{ fontSize: '12px' }}>{formattedDate} · {event.venue}</strong>
                    </div>
                  </div>

                  {/* RSVP Confirmation Actions */}
                  <div className="rsvp-action-box" style={{ background: 'rgba(0,0,0,0.2)', border: 'none', marginBottom: '16px' }}>
                    <p style={{ color: '#ecd7ba', margin: '0 0 10px', fontSize: '12.5px' }}>
                      {selectedGuest.status === 'confirmado'
                        ? 'Presença já confirmada! Podes alterar se necessário:'
                        : 'Por favor confirma a tua presença para reservarmos o teu lugar à mesa:'}
                    </p>
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
                    <div
                      className={`rsvp-feedback ${selectedGuest.status === 'confirmado' ? 'success' : 'info'}`}
                      style={{ marginBottom: '14px' }}
                    >
                      {rsvpMessage}
                    </div>
                  )}

                  {/* Share & Copy Actions */}
                  <div className="vip-ticket-actions">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Olá! Confirmei a minha presença na ${event.title} (${event.hostName}). Estarei na mesa ${selectedGuest.tableName}, lugar #${selectedGuest.seat}! Vê os detalhes aqui: https://eventox.kazix.site/${event.slug}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vip-share-btn"
                    >
                      <Share2 size={16} /> Partilhar no WhatsApp
                    </a>

                    <button onClick={handleCopyTicket} className="vip-change-btn">
                      {ticketCopied ? <CheckCheck size={15} /> : <Copy size={15} />}
                      <span>{ticketCopied ? 'Bilhete Copiado!' : 'Copiar Bilhete'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedGuest(null);
                        setRsvpMessage('');
                      }}
                      className="vip-change-btn"
                    >
                      Pesquisar outro convidado
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Self-registration expandable trigger & form */}
            {!selectedGuest && (
              <div className="guest-self-reg-trigger">
                <span>Não encontras o teu nome na lista oficial?</span>
                <button type="button" onClick={() => setShowSelfReg(!showSelfReg)}>
                  {showSelfReg ? 'Ocultar formulário' : 'Solicitar Presença / Auto-Registo →'}
                </button>

                {showSelfReg && (
                  <form onSubmit={handleSelfRegister} className="guest-self-reg-card">
                    <h3>Auto-Registo de Convidado</h3>
                    <p>Preenche os teus dados abaixo para garantires o teu lugar na mesa desta noite inesquecível.</p>

                    {selfRegError && <div className="auth-alert-error" style={{ marginBottom: '12px' }}>{selfRegError}</div>}

                    <div className="form-grid">
                      <label className="field full">
                        Nome Completo
                        <input
                          type="text"
                          required
                          value={selfRegName}
                          onChange={(e) => setSelfRegName(e.target.value)}
                          placeholder="Ex.: Carlos Mondlane"
                          autoFocus
                        />
                      </label>
                      <label className="field">
                        Contacto / WhatsApp
                        <input
                          type="tel"
                          value={selfRegPhone}
                          onChange={(e) => setSelfRegPhone(e.target.value)}
                          placeholder="+258 84 000 0000"
                        />
                      </label>
                      <label className="field">
                        Nota / Acompanhante (Opcional)
                        <input
                          type="text"
                          value={selfRegNotes}
                          onChange={(e) => setSelfRegNotes(e.target.value)}
                          placeholder="Ex.: Convidado de Honra"
                        />
                      </label>
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        type="button"
                        className="outline"
                        onClick={() => setShowSelfReg(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="primary"
                        disabled={selfRegLoading}
                      >
                        {selfRegLoading ? 'A registar lugar…' : '✦ Confirmar e Obter Bilhete VIP'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: SCHEDULE / TIMELINE */}
      {activeTab === 'schedule' && (
        <section className="portal-schedule-section" style={{ padding: '0 20px 40px' }}>
          <div className="capabilities-header" style={{ textAlign: 'center', marginBottom: '25px' }}>
            <span className="overline">MOMENTOS DA NOITE</span>
            <h2>Programa Oficial da Gala</h2>
            <p>Conhece os principais momentos planeados para esta grande celebração.</p>
          </div>

          <div className="timeline-list">
            <div className="timeline-card">
              <span className="timeline-time-badge">14:00</span>
              <div className="timeline-info">
                <h4>Recepção & Boas-Vindas aos Convidados</h4>
                <p>Check-in no tapete de honra, atribuição de mesas e cocktail de boas-vindas com canapés.</p>
              </div>
            </div>

            <div className="timeline-card">
              <span className="timeline-time-badge">15:00</span>
              <div className="timeline-info">
                <h4>Entrada Solene & Discursos de Homenagem</h4>
                <p>Entrada oficial do homenageado, palavras da família, colegas e mesa de honra.</p>
              </div>
            </div>

            <div className="timeline-card">
              <span className="timeline-time-badge">16:30</span>
              <div className="timeline-info">
                <h4>Brinde de Honra & Sessão Fotográfica</h4>
                <p>Brinde de celebração com espumante e sessão de fotos por mesas no backdrop oficial.</p>
              </div>
            </div>

            <div className="timeline-card">
              <span className="timeline-time-badge">17:30</span>
              <div className="timeline-info">
                <h4>Banquete de Gala & Abertura do Buffet</h4>
                <p>Serviço de catering premium com pratos quentes, saladas e sobremesas finas.</p>
              </div>
            </div>

            <div className="timeline-card">
              <span className="timeline-time-badge">19:30</span>
              <div className="timeline-info">
                <h4>Corte do Bolo & Abertura da Pista de Dança</h4>
                <p>Música ao vivo, DJ da noite, serviço de bar e celebração até ao final.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: MENU & BAR */}
      {activeTab === 'menu' && (
        <section className="portal-menu-section" style={{ padding: '0 20px 40px' }}>
          <div className="capabilities-header" style={{ textAlign: 'center', marginBottom: '25px' }}>
            <span className="overline">GASTRONOMIA & COCKTAILS</span>
            <h2>Cardápio & Bar da Gala</h2>
            <p>Uma seleção requintada preparada para brindar a esta conquista especial.</p>
          </div>

          <div className="menu-showcase-grid">
            <div className="menu-category-card">
              <h3>🥗 Entradas & Canapés</h3>
              <div className="menu-items-list">
                <div className="menu-item-row">
                  <strong>Tártaro de Salmão com Abacate</strong>
                  <small>Temperado com citrinos frescos e ervas aromáticas</small>
                </div>
                <div className="menu-item-row">
                  <strong>Bruschettas Mediterrânicas</strong>
                  <small>Tomate cereja confitado, manjericão e redução balsâmica</small>
                </div>
                <div className="menu-item-row">
                  <strong>Tábua de Queijos Selecionados & Frios</strong>
                  <small>Acompanhada por compotas artesanais e tostas finas</small>
                </div>
              </div>
            </div>

            <div className="menu-category-card">
              <h3>🥩 Pratos Principais</h3>
              <div className="menu-items-list">
                <div className="menu-item-row">
                  <strong>Lombo de Novilho em Crosta de Ervas</strong>
                  <small>Com molho de vinho do Porto e batata gratinada dauphinoise</small>
                </div>
                <div className="menu-item-row">
                  <strong>Robalo Grelhado com Risotto de Limão</strong>
                  <small>Acompanhado por legumes salteados na manteiga clarificada</small>
                </div>
                <div className="menu-item-row">
                  <strong>Ravioli de Cogumelos Selvagens (Opção Vegetariana)</strong>
                  <small>Com creme suave de trufa negra e parmesão envelhecido</small>
                </div>
              </div>
            </div>

            <div className="menu-category-card">
              <h3>🥂 Bar & Cocktails</h3>
              <div className="menu-items-list">
                <div className="menu-item-row">
                  <strong>Espumante & Champagne de Honra</strong>
                  <small>Servido para o brinde solene de graduação</small>
                </div>
                <div className="menu-item-row">
                  <strong>Cocktail de Assinatura "Graduation Gold"</strong>
                  <small>Gin premium, xarope de flor de sabugueiro e citrinos</small>
                </div>
                <div className="menu-item-row">
                  <strong>Vinhos Tintos & Brancos Reserva</strong>
                  <small>Seleção exclusiva da garrafeira da celebração</small>
                </div>
              </div>
            </div>

            <div className="menu-category-card">
              <h3>🍰 Sobremesas & Doces</h3>
              <div className="menu-items-list">
                <div className="menu-item-row">
                  <strong>Bolo de Gala Red Velvet & Frutos Silvestres</strong>
                  <small>O bolo solene do corte de honra da festa</small>
                </div>
                <div className="menu-item-row">
                  <strong>Petit Gâteau de Chocolate Belga</strong>
                  <small>Com bola de gelado artesanal de baunilha de Madagáscar</small>
                </div>
                <div className="menu-item-row">
                  <strong>Mousse de Maracujá Fresco com Merengue</strong>
                  <small>Textura aveludada e toque cítrico refrescante</small>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: SHARED PHOTO GALLERY */}
      {activeTab === 'gallery' && (
        <section className="portal-gallery-section">
          <div className="portal-gallery-card">
            <div className="gallery-header">
              <span className="overline">✦ REGISTO DE MEMÓRIAS & FOTOS COLETIVAS</span>
              <h2>Galeria Compartilhada do Evento</h2>
              <p>
                Tira fotografias durante a celebração e partilha-as connosco! As fotos enviadas ficam guardadas no álbum oficial do anfitrião em resolução máxima.
              </p>
            </div>

            {event.photoAlbumUrl ? (
              <div className="gallery-content">
                <div className="gallery-action-box">
                  <a
                    href={event.photoAlbumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gallery-primary-button"
                  >
                    <Camera size={22} />
                    <span>Adicionar Fotos ao Álbum Oficial 📸</span>
                  </a>
                  <a
                    href={event.photoAlbumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gallery-secondary-button"
                  >
                    <ExternalLink size={17} />
                    <span>Ver Álbum no Google Fotos ↗</span>
                  </a>
                </div>

                <div className="gallery-features-row">
                  <div className="gallery-feature-pill">
                    <span className="pill-icon">📱</span>
                    <span>Upload direto pelo telemóvel</span>
                  </div>
                  <div className="gallery-feature-pill">
                    <span className="pill-icon">🌟</span>
                    <span>Qualidade original (HD / 4K)</span>
                  </div>
                  <div className="gallery-feature-pill">
                    <span className="pill-icon">⚡</span>
                    <span>Sem registo obrigatório</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gallery-empty-state">
                <Camera size={32} />
                <p>O link do álbum partilhado estará disponível aqui durante o evento.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 5: VENUE & DRESS CODE */}
      {activeTab === 'info' && (
        <section className="portal-info-section" style={{ padding: '0 20px 40px' }}>
          <div className="capabilities-header" style={{ textAlign: 'center', marginBottom: '25px' }}>
            <span className="overline">DETALHES IMPORTANTES</span>
            <h2>Localização & Código de Traje</h2>
            <p>Tudo o que precisas de saber para brilhares nesta noite memorável.</p>
          </div>

          <div className="info-showcase-grid">
            <div className="info-card">
              <h3><Shirt size={20} /> Código de Traje (Dress Code)</h3>
              <p>
                O traje para a celebração é <strong>Fato de Gala / Passeio Completo</strong> (Smoking, fato escuro com gravata ou vestido de festa longo).
              </p>
              <div>
                <strong style={{ fontSize: '11px', color: '#6d4554', letterSpacing: '1px' }}>PALETA DE CORES SUGERIDA:</strong>
                <div className="palette-circles">
                  <div className="palette-dot" style={{ background: '#5d1a2f' }} title="Borgonha / Vinho" />
                  <div className="palette-dot" style={{ background: '#d4af37' }} title="Dourado Champagne" />
                  <div className="palette-dot" style={{ background: '#1c1b1c' }} title="Preto Noite" />
                  <div className="palette-dot" style={{ background: '#f5efe8' }} title="Creme / Marfim" />
                </div>
              </div>
            </div>

            <div className="info-card">
              <h3><MapPin size={20} /> Local do Evento & GPS</h3>
              <p>
                <strong>{event.venue || 'Salão de Eventos Cajada II, Maputo'}</strong><br />
                O recinto dispõe de estacionamento vigiado e receção dedicada para os convidados.
              </p>
              <div className="maps-action-btns">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue || 'Maputo')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="maps-btn"
                >
                  <Navigation size={14} /> Abrir no Google Maps ↗
                </a>
                <a
                  href={`https://waze.com/ul?q=${encodeURIComponent(event.venue || 'Maputo')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="maps-btn"
                  style={{ background: '#3b242e' }}
                >
                  <Navigation size={14} /> Abrir no Waze ↗
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="portal-footer">
        <div className="footer-container">
          <p>© 2026 {event.title} ✦ Eventox — Gestão Inteligente de Eventos</p>
          <div className="footer-links">
            <a href="/">Criar Outro Evento</a>
            <span>·</span>
            <button onClick={() => setAuthModalOpen(true)}>Acesso da Organização</button>
          </div>
        </div>
      </footer>

      {/* Unified Auth Modal (Login / Cadastro) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode="login"
        currentSlug={event.slug}
        onLoginSuccess={() => {
          setIsAdmin(true);
          setViewMode('admin');
        }}
      />
    </div>
  );
}
