'use client';
import PublicEventMenu from '../../components/PublicEventMenu';
import ProgramTimeline from '../../components/ProgramTimeline';
import type { ProgramItem } from '../../lib/event-program';

import React, { useState, useEffect } from 'react';
import {
  CalendarDays, MapPin, Search, Check, Sparkles, Lock, ArrowRight,
  UtensilsCrossed, CheckCircle2, UserCheck, X, Shield, Clock3, Heart,
  Camera, ExternalLink, Share2, Music2, Navigation, Shirt,
  CheckCheck, Copy, Plus, UserPlus, Play, Send, MessageSquare,
  Award, QrCode as QrCodeIcon, Disc3, Palette
} from 'lucide-react';
import QRCode from 'qrcode';
import Countdown from '../../components/Countdown';
import AuthModal from '../../components/AuthModal';
import Confetti from '../../components/Confetti';
import EmbeddedMusicPlayer, { PlayingSong } from '../../components/EmbeddedMusicPlayer';
import { resolveEventTheme } from '../../lib/event-themes';
import EventGallerySection from '../../components/EventGallerySection';
import EventThemeSelector from '../../components/EventThemeSelector';

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
  notes?: string;
}

interface PlaylistItem {
  id: number;
  title: string;
  artist: string;
  url: string;
  status: string;
  position: number;
}

interface MuralMessage {
  id: number;
  senderName: string;
  relationship: string;
  message: string;
  createdAt: string;
}

interface MenuItemDisplay {
  id: string | number;
  name: string;
  category: string;
  unit?: string | null;
  stock?: number | null;
  description?: string | null;
  isAvailable?: boolean;
}

export default function EventClientView({
  event,
  initialAdmin = false,
  program,
  openAccess = false,
  canChangeTheme = false,
}: {
  event: EventData;
  initialAdmin: boolean;
  openAccess: boolean;
  program: ProgramItem[];
  canChangeTheme: boolean;
}) {
  const isAdmin = initialAdmin;
  const [activeTab, setActiveTab] = useState<'seating' | 'music' | 'schedule' | 'menu' | 'mural' | 'gallery' | 'info'>('seating');
  const [showConfetti, setShowConfetti] = useState(false);

  // Theme & Template state
  const [currentTheme, setCurrentTheme] = useState(event.coverTheme || 'gala-gold');
  const [showThemeModal, setShowThemeModal] = useState(false);
  const theme = resolveEventTheme(currentTheme);

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

  // Copy ticket & QR Code state
  const [ticketCopied, setTicketCopied] = useState(false);
  const [ticketQrUrl, setTicketQrUrl] = useState<string>('');

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(openAccess);

  // Music & Playlist state
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [activePlayingSong, setActivePlayingSong] = useState<PlayingSong | null>(null);
  const [songRequestTitle, setSongRequestTitle] = useState('');
  const [songRequestArtist, setSongRequestArtist] = useState('');
  const [songRequestUrl, setSongRequestUrl] = useState('');
  const [songRequestGuestName, setSongRequestGuestName] = useState('');
  const [songRequestLoading, setSongRequestLoading] = useState(false);
  const [songRequestSuccess, setSongRequestSuccess] = useState('');
  const [songRequestError, setSongRequestError] = useState('');

  // Mural / Guestbook state
  const [muralMessages, setMuralMessages] = useState<MuralMessage[]>([]);
  const [muralSenderName, setMuralSenderName] = useState('');
  const [muralRelationship, setMuralRelationship] = useState('Amigo(a)');
  const [muralMessage, setMuralMessage] = useState('');
  const [muralSubmitting, setMuralSubmitting] = useState(false);
  const [muralSuccess, setMuralSuccess] = useState('');
  const [muralError, setMuralError] = useState('');

  // Event stats
  const [confirmedCount, setConfirmedCount] = useState<number>(0);

  // Menu / Catering state
  const [menuItemsList, setMenuItemsList] = useState<MenuItemDisplay[]>([]);

  // Formatted date and time
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

  // Listen to URL query params or hash for direct tab navigation (e.g. ?tab=menu or #menu)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const hash = window.location.hash.replace('#', '');
      const target = tabParam || hash;
      const validTabs = ['seating', 'music', 'schedule', 'menu', 'mural', 'gallery', 'info'];
      if (validTabs.includes(target)) {
        setActiveTab(target as any);
        if (target !== 'seating') {
          setTimeout(() => {
            const anchor = document.getElementById('portal-content-anchor');
            if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
          }, 150);
        }
      }
    }
  }, []);

  // Fetch initial event dynamic data (playlist, guestbook, stats)
  useEffect(() => {
    if (!event.slug) return;
    const fetchEventExtras = async () => {
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(event.slug)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as any;
        if (data.event?.coverTheme) setCurrentTheme(data.event.coverTheme);
        if (data.playlist) setPlaylist(data.playlist);
        if (data.guestbook) setMuralMessages(data.guestbook);
        if (data.stats?.confirmedGuests) setConfirmedCount(data.stats.confirmedGuests);
        if (data.menu && Array.isArray(data.menu)) setMenuItemsList(data.menu);
      } catch {
        // Non-blocking
      }
    };
    fetchEventExtras();
  }, [event.slug]);

  // Generate QR Code for Selected Guest VIP Pass
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedGuest && event.slug) {
      const checkinUrl = `${window.location.origin}/${event.slug}?guestId=${selectedGuest.id}&token=vip`;
      QRCode.toDataURL(checkinUrl, {
        width: 320,
        margin: 1,
        color: {
          dark: '#2a1620',
          light: '#fdf8f5',
        },
      }).then(setTicketQrUrl).catch(() => {});
    } else {
      setTicketQrUrl('');
    }
  }, [selectedGuest, event.slug]);

  // Handle guest search
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

  // Handle RSVP confirmation or decline
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
        setRsvpMessage('✦ Presença confirmada com sucesso! O teu lugar de honra na mesa está garantido.');
        setConfirmedCount((c) => c + 1);
      } else {
        setRsvpMessage('Agradecemos por nos avisar que não poderás comparecer.');
      }
    } catch (e) {
      setRsvpMessage(e instanceof Error ? e.message : 'Erro ao confirmar');
    } finally {
      setRsvpLoading(false);
    }
  };

  // Handle Self Registration
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
          : '✦ Parabéns! O teu lugar na mesa foi atribuído com sucesso.'
      );
    } catch (err) {
      setSelfRegError(err instanceof Error ? err.message : 'Erro ao processar registo.');
    } finally {
      setSelfRegLoading(false);
    }
  };

  // Copy Ticket VIP details
  const handleCopyTicket = () => {
    if (!selectedGuest) return;
    const text = `🎟️ MEU BILHETE VIP - ${event.title}\nAnfitrião: ${event.hostName}\nConvidado: ${selectedGuest.name}\nMesa: ${selectedGuest.tableName}\nLugar: #${String(selectedGuest.seat).padStart(2, '0')}\nData: ${formattedDate} às ${formattedTime}\nLocal: ${event.venue}\nLink Oficial: https://eventox.kazix.site/${event.slug}`;
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setTicketCopied(true);
      setTimeout(() => setTicketCopied(false), 2500);
    }
  };

  // Handle Song Request from Guest
  const handleSongRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSongRequestError('');
    setSongRequestSuccess('');

    if (!songRequestTitle.trim()) {
      setSongRequestError('Por favor insere o título ou nome da música.');
      return;
    }

    setSongRequestLoading(true);
    try {
      const guestName = songRequestGuestName.trim() || (selectedGuest ? selectedGuest.name : '');
      const res = await fetch(`/api/events/${encodeURIComponent(event.slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'song-request',
          title: songRequestTitle.trim(),
          artist: songRequestArtist.trim(),
          url: songRequestUrl.trim(),
          name: guestName,
        }),
      });

      const data = await res.json() as { ok?: boolean; song?: PlaylistItem; error?: string };
      if (!res.ok || !data.ok || !data.song) {
        throw new Error(data.error || 'Erro ao sugerir música');
      }

      setPlaylist((prev) => [...prev, data.song!]);
      // Play immediately in the in-app player without navigating away!
      setActivePlayingSong(data.song!);
      setShowConfetti(true);
      setSongRequestSuccess(`✦ "${songRequestTitle}" foi adicionada! O leitor iniciou a reprodução abaixo.`);
      setSongRequestTitle('');
      setSongRequestArtist('');
      setSongRequestUrl('');
    } catch (err: any) {
      setSongRequestError(err.message || 'Erro ao submeter pedido de música');
    } finally {
      setSongRequestLoading(false);
    }
  };

  // Handle Mural / Guestbook Submit
  const handleMuralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMuralError('');
    setMuralSuccess('');

    const sender = muralSenderName.trim() || (selectedGuest ? selectedGuest.name : '');
    if (!sender || !muralMessage.trim()) {
      setMuralError('Por favor preenche o teu nome e a mensagem de felicitação.');
      return;
    }

    setMuralSubmitting(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.slug)}/guestbook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          senderName: sender,
          relationship: muralRelationship,
          message: muralMessage.trim(),
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar mensagem');

      setShowConfetti(true);
      setMuralSuccess('✦ A tua mensagem foi enviada. Ficará no mural após aprovação da equipa.');
      setMuralMessage('');
    } catch (err: any) {
      setMuralError(err.message || 'Erro ao enviar felicitação');
    } finally {
      setMuralSubmitting(false);
    }
  };

  return (
    <div className={`event-portal-page ${theme.bodyClass || 'theme-gala-gold'}`}>
      <Confetti active={showConfetti} onFinish={() => setShowConfetti(false)} />

      {/* Top Luxury Navigation */}
      <header className="portal-nav">
        <div className="portal-brand" onClick={() => (window.location.href = '/')}>
          <Sparkles size={20} className="portal-icon" />
          <span>Eventox</span>
        </div>
        <div className="portal-nav-actions">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              {canChangeTheme && <button
                type="button"
                className="outline-pill"
                onClick={() => setShowThemeModal(true)}
                style={{ borderColor: theme.accentColor, color: theme.accentColor, cursor: 'pointer', background: 'transparent' }}
                title="Mudar Template & Identidade Visual do Evento"
              >
                <Palette size={15} /> Escolher Template
              </button>}
              <a className="primary-pill" href={`/${event.slug}/organizar`}>
                <Shield size={16} /> Voltar ao painel
              </a>
            </div>
          ) : (
            <a className="outline-pill" href={`/conta?continuar=${encodeURIComponent(`/${event.slug}/organizar`)}`}>
              <Lock size={15} /> Entrar como equipa
            </a>
          )}
        </div>
      </header>

      {/* Hero Section with refined aesthetics based on chosen template */}
      <section className="portal-hero" style={{ background: theme.heroGradient }}>
        <div className="portal-hero-container">
          <h1 className="portal-title">{event.title}</h1>
          <p className="portal-host">
            Anfitrião de Honra: <strong>{event.hostName}</strong>
          </p>
          <p className="portal-description">
            {event.description ||
              'Uma celebração extraordinária repleta de emoções, memórias e momentos inesquecíveis para recordar toda a vida.'}
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
            {confirmedCount > 0 && (
              <div className="portal-chip">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span>{confirmedCount} convidados confirmados</span>
              </div>
            )}
          </div>

          {/* Quick CTA buttons */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                setActiveTab('seating');
                const el = document.getElementById('portal-content-anchor');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="primary-button transition-transform duration-200 hover:scale-[1.02]"
              style={{
                background: theme.buttonPrimary.bg,
                color: theme.buttonPrimary.text,
                boxShadow: theme.buttonPrimary.shadow,
                border: 0,
                fontSize: '13.5px',
                padding: '12px 28px',
                cursor: 'pointer',
              }}
            >
              Confirmar presença e ver lugar
            </button>

            <button
              onClick={() => {
                setActiveTab('menu');
                const el = document.getElementById('portal-content-anchor');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="secondary-button transition-transform duration-200 hover:scale-[1.02]"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--portal-text-primary)',
                border: '1.5px solid var(--portal-border)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                fontSize: '13.5px',
                padding: '12px 24px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <UtensilsCrossed size={16} /> Ver Cardápio e Bar
            </button>
          </div>
        </div>
      </section>

      {/* Anchor for smooth scroll */}
      <div id="portal-content-anchor" />

      {/* Interactive Tabs Navigation (Convidados only see guest-appropriate features) */}
      <nav className="portal-tabs-nav" aria-label="Navegação do evento">
        <button
          className={`portal-tab-pill ${activeTab === 'seating' ? 'active' : ''}`}
          aria-pressed={activeTab === 'seating'}
          onClick={() => setActiveTab('seating')}
        >
          <Search size={15} />
          <span>Presença e mesa</span>
        </button>

        <button
          className={`portal-tab-pill ${activeTab === 'music' ? 'active' : ''}`}
          aria-pressed={activeTab === 'music'}
          onClick={() => setActiveTab('music')}
        >
          <Music2 size={15} className="text-amber-500" />
          <span>Músicas</span>
        </button>

        <button
          className={`portal-tab-pill ${activeTab === 'schedule' ? 'active' : ''}`}
          aria-pressed={activeTab === 'schedule'}
          onClick={() => setActiveTab('schedule')}
        >
          <Clock3 size={15} />
          <span>Programa</span>
        </button>

        <button
          className={`portal-tab-pill ${activeTab === 'menu' ? 'active' : ''}`}
          aria-pressed={activeTab === 'menu'}
          onClick={() => setActiveTab('menu')}
        >
          <UtensilsCrossed size={15} />
          <span>Cardápio e bar</span>
        </button>

        <button
          className={`portal-tab-pill ${activeTab === 'mural' ? 'active' : ''}`}
          aria-pressed={activeTab === 'mural'}
          onClick={() => setActiveTab('mural')}
        >
          <Heart size={15} className="text-rose-500" />
          <span>Mural</span>
        </button>

        <button
          className={`portal-tab-pill ${activeTab === 'gallery' ? 'active' : ''}`}
          aria-pressed={activeTab === 'gallery'}
          onClick={() => setActiveTab('gallery')}
        >
          <Camera size={15} />
          <span>Galeria de fotos</span>
        </button>

        <button
          className={`portal-tab-pill ${activeTab === 'info' ? 'active' : ''}`}
          aria-pressed={activeTab === 'info'}
          onClick={() => setActiveTab('info')}
        >
          <Navigation size={15} />
          <span>Local e traje</span>
        </button>
      </nav>

      {/* TAB 1: SEATING FINDER & RSVP & LUXURY VIP PASS */}
      {activeTab === 'seating' && (
        <section className="portal-rsvp-section">
          <div className="portal-rsvp-card">
            <div className="rsvp-header">
              <span className="overline">CONSULTA DE LUGAR & CONFIRMAÇÃO</span>
              <h2>És um dos nossos convidados de honra?</h2>
              <p>Digita o teu nome para consultar a tua mesa atribuída e confirmar a tua presença oficial.</p>
            </div>

            <p className="rsvp-personal-link-hint">Se recebeste um convite pessoal, abre o link enviado pela organização.</p>
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

            {/* VIRTUAL VIP GALA PASS TICKET WITH EMBEDDED QR CODE */}
            {selectedGuest && (
              <div className="vip-ticket-wrapper">
                <div className="vip-ticket-card">
                  <div className="vip-ticket-header">
                    <span className="vip-ticket-gold-seal">✦ BILHETE VIP OFICIAL ✦</span>
                    <span className="vip-ticket-event-title">{event.title}</span>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 text-left">
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
                    </div>

                    {/* High-Resolution VIP Pass QR Code */}
                    {ticketQrUrl && (
                      <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 border border-amber-500/30 backdrop-blur-sm">
                        <img
                          src={ticketQrUrl}
                          alt={`QR Code VIP ${selectedGuest.name}`}
                          className="h-28 w-28 rounded-xl object-contain shadow-lg"
                        />
                        <span className="mt-2 text-[10px] uppercase font-bold tracking-widest text-amber-300">
                          Check-in de Honra
                        </span>
                      </div>
                    )}
                  </div>

                  {/* RSVP Confirmation Actions */}
                  <div className="rsvp-action-box" style={{ background: 'rgba(0,0,0,0.2)', border: 'none', marginBottom: '16px', marginTop: '16px' }}>
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

      {/* TAB 2: PLAYLIST & IN-APP MUSIC PLAYER & SONG REQUESTS */}
      {activeTab === 'music' && (
        <section className="portal-music-section" style={{ maxWidth: '820px', margin: '0 auto 70px', padding: '0 16px' }}>
          <div className="portal-rsvp-card">
            <div className="rsvp-header">
              <span className="overline">BANDA SONORA DA CELEBRAÇÃO</span>
              <h2>Músicas da Festa & Pedidos ao DJ</h2>
              <p>
                Ouve as músicas oficiais da celebração diretamente aqui na plataforma (sem sair para outros sites!) e sugere canções especiais para tocarem na festa.
              </p>
            </div>

            {/* Song Request Form */}
            <form onSubmit={handleSongRequest} className="guest-self-reg-card" style={{ marginBottom: '30px' }}>
              <div className="flex items-center gap-2 mb-3">
                <Music2 className="text-amber-500" size={18} />
                <h3 style={{ margin: 0, fontSize: '16px' }}>Pedir uma Música para a Pista de Dança</h3>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--portal-text-secondary)', margin: '0 0 14px' }}>
                Conheces a música perfeita para este momento? Envia o título e artista. Se tiveres link do YouTube ou Spotify, cola abaixo para tocar na hora!
              </p>

              {songRequestError && <div className="auth-alert-error" style={{ marginBottom: '12px' }}>{songRequestError}</div>}
              {songRequestSuccess && <div className="rsvp-feedback success" style={{ marginBottom: '12px' }}>{songRequestSuccess}</div>}

              <div className="form-grid">
                <label className="field full">
                  Título da Música *
                  <input
                    type="text"
                    required
                    value={songRequestTitle}
                    onChange={(e) => setSongRequestTitle(e.target.value)}
                    placeholder="Ex.: Jerusalema, Stand by Me, A Mi No Me Importa..."
                  />
                </label>
                <label className="field">
                  Artista / Banda
                  <input
                    type="text"
                    value={songRequestArtist}
                    onChange={(e) => setSongRequestArtist(e.target.value)}
                    placeholder="Ex.: Master KG, Ben E. King..."
                  />
                </label>
                <label className="field">
                  O Teu Nome (para dedicatória)
                  <input
                    type="text"
                    value={songRequestGuestName}
                    onChange={(e) => setSongRequestGuestName(e.target.value)}
                    placeholder={selectedGuest ? selectedGuest.name : 'Ex.: Carlos Mondlane'}
                  />
                </label>
                <label className="field full">
                  Link YouTube ou Spotify (Opcional)
                  <input
                    type="url"
                    value={songRequestUrl}
                    onChange={(e) => setSongRequestUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... ou https://open.spotify.com/track/..."
                  />
                </label>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={songRequestLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Send size={15} />
                  {songRequestLoading ? 'A adicionar…' : '✦ Pedir Música & Ouvir Agora'}
                </button>
              </div>
            </form>

            {/* In-App Music List */}
            <div className="playlist-showcase">
              <div className="flex items-center justify-between mb-4">
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--portal-text-primary)', margin: 0 }}>
                  Lista de Músicas da Noite ({playlist.length})
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--portal-text-muted)' }}>
                  Clica em "Ouvir" para escutar no reprodutor abaixo
                </span>
              </div>

              {playlist.length === 0 ? (
                <div className="no-results-hint" style={{ padding: '24px' }}>
                  <Disc3 size={32} className="mx-auto mb-2 text-amber-500 animate-spin-slow" />
                  <p>Ainda não foram adicionadas músicas à lista oficial.</p>
                  <p style={{ fontSize: '11.5px', marginTop: '4px' }}>Sê o primeiro a sugerir uma música no formulário acima!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {playlist.map((s, index) => {
                    const isCurrent = activePlayingSong?.id === s.id || (activePlayingSong?.title === s.title);
                    return (
                      <div
                        key={s.id || index}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10'
                            : 'bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-neutral-300">
                            #{String(index + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <strong className="block text-sm font-semibold text-white truncate">
                              {s.title}
                            </strong>
                            <small className="text-xs text-neutral-400 truncate block">
                              {s.artist || 'Música da Celebração'}
                            </small>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setActivePlayingSong(s)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              isCurrent
                                ? 'bg-amber-500 text-black shadow-md'
                                : 'bg-white/10 text-amber-300 hover:bg-white/20'
                            }`}
                            title="Ouvir na plataforma sem sair"
                          >
                            <Play size={13} />
                            <span>{isCurrent ? 'A Tocar' : 'Ouvir Aqui'}</span>
                          </button>

                          {s.url && (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-neutral-400 hover:text-white transition"
                              title="Abrir no site original (opcional)"
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: SCHEDULE / TIMELINE */}
      {activeTab === 'schedule' && (
        <section className="portal-schedule-section" style={{ padding: '0 20px 40px' }}>
          <div className="capabilities-header" style={{ textAlign: 'center', marginBottom: '25px' }}>
            <span className="overline">MOMENTOS DA NOITE</span>
            <h2>Programa do evento</h2>
            <p>Conhece os principais momentos planeados para esta grande celebração.</p>
          </div>

          <ProgramTimeline items={program} />
        </section>
      )}

      {activeTab === 'menu' && <PublicEventMenu items={menuItemsList} />}

      {/* TAB 5: INTEGRATED MURAL DE FELICITAÇÕES */}
      {activeTab === 'mural' && (
        <section className="portal-mural-section" style={{ maxWidth: '820px', margin: '0 auto 70px', padding: '0 16px' }}>
          <div className="portal-rsvp-card">
            <div className="rsvp-header">
              <span className="overline">MENSAGENS & HOMENAGENS</span>
              <h2>Mural de Felicitações ao Anfitrião</h2>
              <p>Deixa uma mensagem com palavras de carinho, votos de sucesso e bênçãos para o homenageado.</p>
            </div>

            {/* Send Wish Form */}
            <form onSubmit={handleMuralSubmit} className="guest-self-reg-card" style={{ marginBottom: '30px' }}>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="text-rose-500" size={18} />
                <h3 style={{ margin: 0, fontSize: '16px' }}>Escrever Mensagem de Felicitação</h3>
              </div>

              {muralError && <div className="auth-alert-error" style={{ marginBottom: '12px' }}>{muralError}</div>}
              {muralSuccess && <div className="rsvp-feedback success" style={{ marginBottom: '12px' }}>{muralSuccess}</div>}

              <div className="form-grid">
                <label className="field">
                  O Teu Nome *
                  <input
                    type="text"
                    required
                    value={muralSenderName}
                    onChange={(e) => setMuralSenderName(e.target.value)}
                    placeholder={selectedGuest ? selectedGuest.name : 'Ex.: Dr. Carlos Mondlane'}
                  />
                </label>
                <label className="field">
                  Grau de Relação
                  <select value={muralRelationship} onChange={(e) => setMuralRelationship(e.target.value)}>
                    <option value="Família">Família</option>
                    <option value="Amigo(a)">Amigo(a)</option>
                    <option value="Colega">Colega / Profissional</option>
                    <option value="Mestre / Professor">Mestre / Professor</option>
                    <option value="Convidado de Honra">Convidado de Honra</option>
                  </select>
                </label>
                <label className="field full">
                  A Tua Mensagem de Felicitação *
                  <textarea
                    required
                    rows={4}
                    value={muralMessage}
                    onChange={(e) => setMuralMessage(e.target.value)}
                    placeholder="Muitos parabéns por esta conquista notável! Que esta nova etapa seja repleta de sucesso e realizações..."
                  />
                </label>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={muralSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Send size={15} />
                  {muralSubmitting ? 'A enviar…' : '✦ Publicar no Mural de Honra'}
                </button>
              </div>
            </form>

            {/* Approved Messages Feed */}
            <div className="mural-feed">
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--portal-text-primary)', marginBottom: '16px' }}>
                Mensagens de Amigos & Família ({muralMessages.length})
              </h4>

              {muralMessages.length === 0 ? (
                <div className="no-results-hint" style={{ padding: '24px' }}>
                  <MessageSquare size={32} className="mx-auto mb-2 text-rose-400" />
                  <p>Ainda não há mensagens aprovadas no mural.</p>
                  <p style={{ fontSize: '11.5px', marginTop: '4px' }}>Sê o primeiro a felicitar o anfitrião no formulário acima!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {muralMessages.map((m) => (
                    <div
                      key={m.id}
                      className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-sm transition hover:border-white/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm font-bold text-white">{m.senderName}</strong>
                        <span className="text-[11px] font-semibold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                          {m.relationship || 'Convidado'}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-300 leading-relaxed font-serif italic">
                        "{m.message}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB 6: INTERACTIVE PHOTO GALLERY & DIRECT PHONE UPLOAD */}
      {activeTab === 'gallery' && (
        <EventGallerySection
          slug={event.slug}
          photoAlbumUrl={event.photoAlbumUrl}
          onPhotoUploaded={() => setShowConfetti(true)}
        />
      )}

      {/* TAB 7: VENUE & DRESS CODE */}
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
                <strong style={{ fontSize: '11px', color: 'var(--portal-accent)', letterSpacing: '1.5px' }}>PALETA DE CORES SUGERIDA:</strong>
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
                <strong>{event.venue || 'Salão de Eventos, Maputo'}</strong><br />
                O recinto dispõe de estacionamento vigiado e receção dedicada para os convidados de honra.
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
                >
                  <Navigation size={14} /> Abrir no Waze ↗
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Floating Bottom Music Player: Plays without navigating away from the page! */}
      <EmbeddedMusicPlayer
        song={activePlayingSong}
        onClose={() => setActivePlayingSong(null)}
        mode="docked"
      />

      {/* Luxury Theme Selector Modal for Organizers */}
      {showThemeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setShowThemeModal(false)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl bg-neutral-950 p-6 shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowThemeModal(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <EventThemeSelector
              currentTheme={currentTheme}
              eventTitle={event.title}
              slug={event.slug}
              onThemeChanged={(t) => {
                setCurrentTheme(t);
                setShowConfetti(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Countdown Card */}
      <section className="portal-countdown-section">
        <div className="portal-countdown-container">
          <Countdown date={event.eventDate} title="CONTAGEM REGRESSIVA OFICIAL" />
        </div>
      </section>

      {/* Footer */}
      <footer className="portal-footer">
        <div className="footer-container">
          <p>© {new Date().getFullYear()} Eventox</p>
          <div className="footer-links">
            <a href="/">Criar Outro Evento</a>
            <span>·</span>
            <button onClick={() => setAuthModalOpen(true)}>Acesso por PIN</button>
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
          window.location.assign(`/${event.slug}/organizar`);
        }}
      />
    </div>
  );
}
