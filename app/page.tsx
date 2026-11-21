'use client';
import { useState, useEffect } from 'react';
import {
  Sparkles, CalendarDays, MapPin, Users, UtensilsCrossed, GlassWater,
  Music2, ArrowRight, Shield, Check, Plus, Search, ChevronRight, X, Heart,
  Copy, CheckCheck, QrCode, ExternalLink, Link2, Share2, Layers, CheckCircle2,
  Camera, Lock
} from 'lucide-react';
import Countdown from '../components/Countdown';
import AuthModal from '../components/AuthModal';

export default function HomePage() {
  const [searchCode, setSearchCode] = useState('');

  // Auth Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('register');

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

  const handleSearchNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = generateSlug(searchCode);
    if (clean) {
      window.location.href = `/${clean}`;
    }
  };

  const openAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="home-portal-wrapper">
      {/* Top Navbar */}
      <header className="home-navbar">
        <div className="home-brand" onClick={() => (window.location.href = '/')}>
          <div className="home-brand-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <strong>EVENTOX</strong>
            <small>SISTEMA DE EVENTOS</small>
          </div>
        </div>

        <div className="home-nav-links" style={{ display: 'flex', gap: '10px' }}>
          <button className="outline-pill" onClick={() => openAuth('login')}>
            <Lock size={15} /> Acesso Organização
          </button>
          <button className="primary-pill" onClick={() => openAuth('register')}>
            <Plus size={16} /> Criar Evento
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-content">
          <span className="home-badge">✦ PLATAFORMA PROFISSIONAL DE EVENTOS & EXPERIÊNCIAS AO VIVO ✦</span>
          <h1>
            Celebrações inesquecíveis,<br />
            <strong>gestão e interacção em direto.</strong>
          </h1>
          <p className="home-hero-subtitle">
            Cria o teu evento, gera o <strong>link de visualização oficial</strong> com QR Code para os teus convidados,
            projeta o <strong>Estúdio Live 16:9 na TV</strong> com jogos interativos, quiz ao vivo e organiza mesas, RSVP e catering num só lugar.
          </p>

          <div className="home-hero-actions">
            <button className="hero-cta-button" onClick={() => openAuth('register')}>
              <Plus size={18} /> Criar Novo Evento Agora
            </button>
            <button className="hero-secondary-button" onClick={() => openAuth('login')}>
              <Lock size={16} /> Entrar na Minha Conta
            </button>
          </div>

          {/* Quick Access search */}
          <form onSubmit={handleSearchNavigate} className="home-quick-search">
            <Search size={18} />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Tens o link ou código de um evento? Digita aqui para aceder..."
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
                Envia o link de visualização por WhatsApp ou no convite. Os convidados acedem à contagem regressiva, confirmam presença (RSVP) e recebem o seu Bilhete VIP.
              </p>
            </div>

            <div className="step-card">
              <span className="step-num">04</span>
              <h3>Estúdio Live & Interacção ao Vivo</h3>
              <p>
                Projeta o modo 16:9 na TV com Quiz interativo, votações dos convidados, contagem decrescente e controle total a partir do Estúdio Live do organizador.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Section: Eventox Experience Live */}
      <section className="home-featured-section">
        <div className="featured-card">
          <div className="featured-badge">✦ NOVO: ESTÚDIO LIVE & EXPERIÊNCIAS 16:9 ✦</div>
          <div className="featured-header">
            <div>
              <span className="overline">INTERACÇÃO CINEMATOGRÁFICA</span>
              <h2>O Teu Evento no Ecrã Grande</h2>
              <p className="featured-venue">
                Projetor, TV ou Painel LED · Sincronização em tempo real · Jogos estilo Kahoot & Mentimeter
              </p>
            </div>
            <button onClick={() => openAuth('register')} className="primary-pill">
              Começar Agora <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left">
              <h4 className="text-amber-300 font-bold mb-1">🎮 Quiz Live Competitivo</h4>
              <p className="text-xs text-neutral-300">Convidados respondem pelo telemóvel com PIN temporário. Pódio e pontuação ao vivo no ecrã da festa.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left">
              <h4 className="text-amber-300 font-bold mb-1">📊 Votações & Nuvem de Palavras</h4>
              <p className="text-xs text-neutral-300">Sondagens ao vivo, perguntas moderadas ao anfitrião e batalha interativa entre as mesas.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left">
              <h4 className="text-amber-300 font-bold mb-1">📺 Ecrã Centralizado</h4>
              <p className="text-xs text-neutral-300">Controlo central a partir do Estúdio: todas as TVs mostram exatamente a mesma cena em sincronia perfeita.</p>
            </div>
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



      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <strong>EVENTOX</strong>
            <p>A plataforma completa para celebrações memoráveis.</p>
          </div>
          <div className="footer-links" style={{ display: 'flex', gap: '15px' }}>
            <button
              onClick={() => openAuth('register')}
              style={{ background: 'none', border: 'none', color: '#917983', cursor: 'pointer', fontSize: '12px' }}
            >
              Criar Novo Evento
            </button>
            <span style={{ color: '#baa6af' }}>·</span>
            <button
              onClick={() => openAuth('login')}
              style={{ background: 'none', border: 'none', color: '#917983', cursor: 'pointer', fontSize: '12px' }}
            >
              Acesso da Organização
            </button>
          </div>
          <div className="footer-copy">
            © 2026 Eventox · Gestão de Eventos Inteligente.
          </div>
        </div>
      </footer>

      {/* Unified Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authModalMode}
        onLoginSuccess={(slug) => {
          window.location.href = `/${slug}/organizar`;
        }}
      />
    </div>
  );
}
