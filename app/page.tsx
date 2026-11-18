'use client';
import { useState, useEffect } from 'react';
import {
  Sparkles, CalendarDays, MapPin, Users, UtensilsCrossed, GlassWater,
  Music2, ArrowRight, Shield, Check, Plus, Search, ChevronRight, X, Heart,
  Copy, CheckCheck, QrCode, ExternalLink, Link2, Share2, Layers, CheckCircle2,
  Camera
} from 'lucide-react';
import Countdown from '../components/Countdown';
import QRCode from 'qrcode';

interface EventItem {
  id: number;
  slug: string;
  title: string;
  hostName: string;
  eventDate: string;
  venue: string;
  description: string;
  coverTheme: string;
  photoAlbumUrl?: string | null;
}

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [searchCode, setSearchCode] = useState('');

  // New event form state
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [slug, setSlug] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [passcode, setPasscode] = useState('');
  const [description, setDescription] = useState('');
  const [photoAlbumUrl, setPhotoAlbumUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Post-creation success state
  const [createdEvent, setCreatedEvent] = useState<{
    slug: string;
    title: string;
    url: string;
    qrCode: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/events', { cache: 'no-store' });
      const data = await res.json() as { events?: EventItem[] };
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(val));
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          hostName,
          slug,
          eventDate,
          venue,
          description,
          photoAlbumUrl: photoAlbumUrl || undefined,
          passcode: passcode || '1234',
        }),
      });
      const data = await res.json() as { ok?: boolean; slug?: string; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Erro ao criar evento');
      }

      const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${data.slug}`;
      const qrDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#502232', light: '#ffffff' }
      }).catch(() => '');

      setCreatedEvent({
        slug: data.slug || slug,
        title,
        url: publicUrl,
        qrCode: qrDataUrl,
      });
      loadEvents();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar evento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCreated = () => {
    if (createdEvent?.url && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(createdEvent.url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleSearchNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = generateSlug(searchCode);
    if (clean) {
      window.location.href = `/${clean}`;
    }
  };

  const resetCreateForm = () => {
    setTitle('');
    setHostName('');
    setSlug('');
    setEventDate('');
    setVenue('');
    setPasscode('');
    setDescription('');
    setPhotoAlbumUrl('');
    setFormError('');
    setCreatedEvent(null);
    setCopiedLink(false);
    setCreateModal(false);
  };

  const emersonEvent = events.find(e => e.slug === 'emerson') || {
    id: 1,
    slug: 'emerson',
    title: 'Gala de Graduação',
    hostName: 'Emerson Charles',
    eventDate: '2026-12-11T14:00',
    venue: 'Salão de Eventos Cajada II',
    description: 'A celebração de uma grande jornada académica e o início de um novo capítulo.',
    coverTheme: 'gold',
  };

  return (
    <div className="home-portal-wrapper">
      {/* Top Navbar */}
      <header className="home-navbar">
        <div className="home-brand">
          <div className="home-brand-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <strong>EVENTOX</strong>
            <small>SISTEMA DE EVENTOS</small>
          </div>
        </div>

        <div className="home-nav-links">
          <button className="primary-pill" onClick={() => { resetCreateForm(); setCreateModal(true); }}>
            <Plus size={16} /> Criar Evento
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-content">
          <span className="home-badge">✦ O SEU EVENTO. O SEU LINK EXCLUSIVO. ✦</span>
          <h1>
            Celebrações inesquecíveis,<br />
            <strong>gestão inteligente.</strong>
          </h1>
          <p className="home-hero-subtitle">
            Cria o teu evento, gera o <strong>link de visualização oficial</strong> com QR Code para os teus convidados,
            organiza mesas interativas, controla presenças (RSVP) e gere o bar e catering num só lugar.
          </p>

          <div className="home-hero-actions">
            <button className="hero-cta-button" onClick={() => { resetCreateForm(); setCreateModal(true); }}>
              <Plus size={18} /> Criar Novo Evento Agora
            </button>
            <a href="/emerson" className="hero-secondary-button">
              Ver Gala do Emerson →
            </a>
          </div>

          {/* Quick Access search */}
          <form onSubmit={handleSearchNavigate} className="home-quick-search">
            <Search size={18} />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Tens o link ou código de um evento? Digita aqui..."
            />
            <button type="submit">Entrar →</button>
          </form>
        </div>
      </section>

      {/* Como Funciona em 4 Passos */}
      <section className="home-how-it-works">
        <div className="how-it-works-inner">
          <div className="capabilities-header">
            <span className="overline">FLUXO SIMPLES E PODEROSO</span>
            <h2>Como o Eventox Funciona</h2>
            <p>Do primeiro convite ao brinde final, tudo sincronizado em tempo real.</p>
          </div>

          <div className="steps-cards-grid">
            <div className="step-card">
              <span className="step-num">01</span>
              <h3>Cria o Evento & Obtém o Link</h3>
              <p>
                Em 30 segundos defines o título, data e local. O sistema gera automaticamente o teu link exclusivo (ex.: <code>eventox.kazix.site/o-teu-evento</code>) e o QR Code oficial.
              </p>
            </div>

            <div className="step-card">
              <span className="step-num">02</span>
              <h3>Configura Mesas & Convidados</h3>
              <p>
                Importa listas completas do Excel ou CSV num segundo. O sistema aloca lugares vagos e permite organizar mesas redondas interativas com um clique.
              </p>
            </div>

            <div className="step-card">
              <span className="step-num">03</span>
              <h3>Partilha com os Convidados</h3>
              <p>
                Envia o link de visualização por WhatsApp ou no convite. Os convidados acedem à contagem regressiva, confirmam presença (RSVP) e descobrem em que mesa vão sentar.
              </p>
            </div>

            <div className="step-card">
              <span className="step-num">04</span>
              <h3>Opera no Dia da Celebração</h3>
              <p>
                Acompanha presenças em direto no check-in, regista pedidos de bar e mesa com desconto automático de stock e controla a playlist da festa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Event: Emerson's Graduation */}
      <section className="home-featured-section">
        <div className="featured-card">
          <div className="featured-badge">✦ EVENTO EM DESTAQUE ✦</div>
          <div className="featured-header">
            <div>
              <span className="overline">{emersonEvent.hostName?.toUpperCase()}</span>
              <h2>{emersonEvent.title}</h2>
              <p className="featured-venue">
                <MapPin size={16} /> {emersonEvent.venue} · <CalendarDays size={16} /> 11 de Dezembro de 2026
              </p>
            </div>
            <a href={`/${emersonEvent.slug}`} className="primary-pill">
              Aceder ao Evento <ArrowRight size={16} />
            </a>
          </div>

          <div className="featured-countdown">
            <Countdown date={emersonEvent.eventDate} title="CONTAGEM REGRESSIVA OFICIAL" />
          </div>
        </div>
      </section>

      {/* Capabilities Showcase */}
      <section className="home-capabilities-section">
        <div className="capabilities-header">
          <span className="overline">MÓDULOS COMPLETOS</span>
          <h2>Tudo o que o Eventox faz por si</h2>
          <p>Esqueça folhas soltas de papel e folhas de cálculo desatualizadas.</p>
        </div>

        <div className="capabilities-grid">
          <div className="capability-card">
            <div className="cap-icon color-0"><Users size={24} /></div>
            <h3>Gestão de Convidados & RSVP</h3>
            <p>
              Importa até 500 convidados de uma só vez. Acompanha em tempo real quem confirmou, recusou ou já chegou ao recinto.
            </p>
          </div>

          <div className="capability-card">
            <div className="cap-icon color-1"><UtensilsCrossed size={24} /></div>
            <h3>Mesas & Lugares Interativos</h3>
            <p>
              Diagramas visuais de mesas redondas numeradas. Toca num lugar para atribuir ou trocar convidados instantaneamente.
            </p>
          </div>

          <div className="capability-card">
            <div className="cap-icon color-2"><GlassWater size={24} /></div>
            <h3>Bar, Catering & Pedidos</h3>
            <p>
              Inventário em direto com alerta de stock baixo. Comandas por mesa que deduzem as quantidades reservadas automaticamente.
            </p>
          </div>

          <div className="capability-card">
            <div className="cap-icon color-3"><Music2 size={24} /></div>
            <h3>Playlist da Noite</h3>
            <p>
              Sequência de músicas organizada com links para YouTube/Spotify, fila dinâmica e controlo do que está a tocar.
            </p>
          </div>

          <div className="capability-card">
            <div className="cap-icon color-0"><Shield size={24} /></div>
            <h3>Comissão Organizadora</h3>
            <p>
              Distribui responsabilidades e funções por áreas (Protocolo, Decoração, Catering, Som) com tarefas e prazos claros.
            </p>
          </div>

          <div className="capability-card">
            <div className="cap-icon color-1"><Link2 size={24} /></div>
            <h3>Link de Visualização & QR Code</h3>
            <p>
              Cada celebração tem a sua página pública com endereço limpo e código QR pronto a imprimir ou enviar por WhatsApp.
            </p>
          </div>

          <div className="capability-card">
            <div className="cap-icon color-2"><Camera size={24} /></div>
            <h3>Galeria Coletiva de Fotos</h3>
            <p>
              Conecta o teu álbum Google Fotos ou Drive. Os convidados enviam fotos em alta resolução direto do telemóvel sem app nem registo.
            </p>
          </div>
        </div>
      </section>

      {/* Event Directory / Recent Events */}
      {events.length > 0 && (
        <section className="home-events-directory">
          <div className="directory-header">
            <div>
              <span className="overline">CELEBRAÇÕES NA PLATAFORMA</span>
              <h2>Explorar eventos ativos</h2>
            </div>
            <button className="outline-pill" onClick={() => { resetCreateForm(); setCreateModal(true); }}>
              + Novo Evento
            </button>
          </div>

          <div className="events-grid">
            {events.map((ev) => (
              <a href={`/${ev.slug}`} key={ev.id} className="event-item-card">
                <div className="event-item-meta">
                  <span className="event-slug-pill">/{ev.slug}</span>
                  <span className="event-date-chip">
                    <CalendarDays size={14} />
                    {new Date(ev.eventDate + ':00+02:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <h3>{ev.title}</h3>
                <p className="event-item-host">Anfitrião: <strong>{ev.hostName}</strong></p>
                <div className="event-item-foot">
                  <span><MapPin size={14} /> {ev.venue || 'Local a definir'}</span>
                  <span className="arrow-chip">Ver Evento →</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <strong>EVENTOX</strong>
            <p>A plataforma completa para celebrações memoráveis.</p>
          </div>
          <div className="footer-copy">
            © 2026 Eventox · Gestão de Eventos Inteligente.
          </div>
        </div>
      </footer>

      {/* Create Event Modal */}
      {createModal && (
        <div className="modal-cover" onMouseDown={(e) => { if (e.target === e.currentTarget && !createdEvent) setCreateModal(false); }}>
          <div className="modal">
            {createdEvent ? (
              /* Success & Link Presentation Screen */
              <div className="event-created-success-panel">
                <div className="success-icon-badge">
                  <CheckCircle2 size={38} />
                </div>
                <span className="overline">CELEBRAÇÃO CRIADA COM SUCESSO</span>
                <h2>{createdEvent.title}</h2>
                <p className="success-subtitle">
                  O teu evento está pronto e o <strong>link de visualização oficial</strong> foi gerado:
                </p>

                <div className="created-link-box">
                  <span className="link-label"><Link2 size={15} /> LINK DE VISUALIZAÇÃO DO EVENTO</span>
                  <div className="link-pill-row">
                    <code>{createdEvent.url}</code>
                    <button type="button" className={`copy-btn ${copiedLink ? 'copied' : ''}`} onClick={handleCopyCreated}>
                      {copiedLink ? <><CheckCheck size={16} /> Copiado!</> : <><Copy size={16} /> Copiar Link</>}
                    </button>
                  </div>
                  <small className="created-link-tip">
                    ✦ Envia este link aos teus convidados por WhatsApp para eles verem a contagem regressiva e confirmarem presença.
                  </small>
                </div>

                {createdEvent.qrCode && (
                  <div className="created-qr-section">
                    <img src={createdEvent.qrCode} alt="QR Code do Evento" />
                    <span>QR Code de Acesso Rápido</span>
                    <a href={createdEvent.qrCode} download={`qrcode-${createdEvent.slug}.png`} className="download-qr-link">
                      Descarregar Imagem QR ⬇
                    </a>
                  </div>
                )}

                <div className="created-actions-row">
                  <a href={`/${createdEvent.slug}`} className="primary-action-btn">
                    Aceder ao Painel de Gestão (Admin) →
                  </a>
                  <a href={`/${createdEvent.slug}`} target="_blank" rel="noopener noreferrer" className="secondary-action-btn">
                    Ver como Convidado (Página Pública) ↗
                  </a>
                </div>
              </div>
            ) : (
              /* Creation Form */
              <>
                <div className="modal-title">
                  <div>
                    <span className="overline">NOVA CELEBRAÇÃO</span>
                    <h2>Criar um Evento</h2>
                  </div>
                  <button onClick={() => setCreateModal(false)}><X size={20} /></button>
                </div>

                <form onSubmit={handleCreateEvent} className="form-grid">
                  {formError && <div className="error full">{formError}</div>}

                  <label className="field full">
                    Nome do Evento
                    <input
                      type="text"
                      required
                      autoFocus
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Ex.: Gala de Graduação, Casamento de Ana & Rui..."
                    />
                  </label>

                  <label className="field">
                    Nome do Anfitrião
                    <input
                      type="text"
                      required
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      placeholder="Ex.: Emerson Charles"
                    />
                  </label>

                  <label className="field">
                    Link do Evento (Slug)
                    <div className="slug-input-prefix">
                      <span>/</span>
                      <input
                        type="text"
                        required
                        value={slug}
                        onChange={(e) => setSlug(generateSlug(e.target.value))}
                        placeholder="meu-evento"
                      />
                    </div>
                  </label>

                  <label className="field">
                    Data e Hora
                    <input
                      type="datetime-local"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    Local da Celebração
                    <input
                      type="text"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      placeholder="Ex.: Salão Nobre Cajada II"
                    />
                  </label>

                  <label className="field full">
                    Mensagem ou Descrição para os Convidados (Opcional)
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex.: Uma noite inesquecível para celebrar esta grande conquista com todos os que fizeram parte dela..."
                    />
                  </label>

                  <label className="field full">
                    Álbum de Fotos Coletivo (Google Fotos / Drive - Opcional)
                    <input
                      type="url"
                      value={photoAlbumUrl}
                      onChange={(e) => setPhotoAlbumUrl(e.target.value)}
                      placeholder="Ex.: https://photos.app.goo.gl/..."
                    />
                    <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
                      Os convidados verão o botão para carregar fotos do telemóvel diretamente para o teu álbum.
                    </small>
                  </label>

                  <label className="field full">
                    Código PIN de Acesso de Administração
                    <input
                      type="text"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Código para gerir o painel (ex.: 2026)"
                    />
                    <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
                      Guarda este código para acederes e gerires convidados e mesas mais tarde.
                    </small>
                  </label>

                  <div className="modal-actions full">
                    <button type="button" className="outline" onClick={() => setCreateModal(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="primary" disabled={submitting}>
                      {submitting ? 'A criar celebração…' : 'Criar Evento & Obter Link →'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
