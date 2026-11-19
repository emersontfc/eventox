'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Sparkles, Maximize2, Minimize2, Calendar, MapPin, Clock,
  Heart, Award, Users, QrCode as QrCodeIcon, AlertTriangle,
  ChevronLeft, ChevronRight, Volume2, VolumeX, Shield, RefreshCw
} from 'lucide-react';
import QRCode from 'qrcode';

interface ScreenData {
  event: {
    id: number;
    slug: string;
    title: string;
    hostName: string;
    eventDate: string;
    venue: string;
    description: string;
    photoAlbumUrl?: string | null;
  };
  settings: {
    activeSceneId: string;
    autoRotate: boolean;
    rotateInterval: number;
    theme: string;
    backgroundStyle: string;
    holdScene: boolean;
    emergencyMode: boolean;
    emergencyMessage?: string | null;
    customLogoUrl?: string | null;
    customHeadline?: string | null;
    fontFamily: string;
  };
  scenes: Array<{
    id: number;
    sceneKey: string;
    title: string;
    subtitle?: string | null;
    content: Record<string, any>;
    duration: number;
    position: number;
    isActive: boolean;
  }>;
  activeMessage?: {
    id: number;
    category: string;
    text: string;
    status: string;
    createdAt: string;
  } | null;
  photos: Array<{
    id: number;
    key: string;
    mime: string;
    uploader?: string | null;
  }>;
  quotes: Array<{
    id: number;
    quote: string;
    author?: string | null;
    category: string;
  }>;
  recentArrivals: Array<{
    id: number;
    name: string;
  }>;
  timestamp: number;
}

export default function EventScreenPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  const [screenData, setScreenData] = useState<ScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active scene index
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [liveQuoteIndex, setLiveQuoteIndex] = useState(0);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSlug(p.slug.toLowerCase().trim()));
  }, [params]);

  // Fetch initial screen data
  const fetchScreenData = useCallback(async (currentSlug: string) => {
    try {
      const res = await fetch(`/api/screen/${currentSlug}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar ecrã');
      const data: ScreenData = await res.json();
      setScreenData(data);
      setError(null);
    } catch (err: any) {
      console.warn('Poll error:', err);
      if (!screenData) {
        setError('A carregar transmissão do evento...');
      }
    } finally {
      setLoading(false);
    }
  }, [screenData]);

  // Set up SSE Stream with polling fallback
  useEffect(() => {
    if (!slug) return;

    fetchScreenData(slug);

    // Set up SSE
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource(`/api/screen/${slug}/stream`);

      eventSource.addEventListener('update', (event) => {
        try {
          const payload = JSON.parse(event.data);
          setScreenData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              settings: payload.settings ? { ...prev.settings, ...payload.settings } : prev.settings,
              activeMessage: payload.activeMessage !== undefined ? payload.activeMessage : prev.activeMessage,
              timestamp: payload.timestamp || Date.now(),
            };
          });
        } catch (e) {
          console.error('SSE JSON error', e);
        }
      });

      eventSource.onerror = () => {
        // Fallback to polling every 4 seconds if SSE disconnects
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            fetchScreenData(slug);
          }, 4000);
        }
      };
    } catch {
      // Direct polling fallback
      pollInterval = setInterval(() => {
        fetchScreenData(slug);
      }, 4000);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [slug, fetchScreenData]);

  // Generate QR Code for guests
  useEffect(() => {
    if (typeof window !== 'undefined' && slug) {
      const targetUrl = `${window.location.origin}/${slug}/mural`;
      QRCode.toDataURL(targetUrl, {
        width: 380,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#f8fafc',
        },
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [slug]);

  // Live countdown calculation
  useEffect(() => {
    if (!screenData?.event?.eventDate) return;

    const calcTime = () => {
      const target = new Date(screenData.event.eventDate).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isPast: false });
    };

    calcTime();
    const interval = setInterval(calcTime, 1000);
    return () => clearInterval(interval);
  }, [screenData?.event?.eventDate]);

  // Auto-rotate quotes
  useEffect(() => {
    if (!screenData?.quotes?.length) return;
    const quoteInterval = setInterval(() => {
      setLiveQuoteIndex((prev) => (prev + 1) % screenData.quotes.length);
    }, 9000);
    return () => clearInterval(quoteInterval);
  }, [screenData?.quotes]);

  // Auto-rotate scenes
  useEffect(() => {
    if (!screenData?.scenes?.length) return;

    // If holdScene is true or emergencyMode is active, do not auto rotate
    if (screenData.settings.holdScene || screenData.settings.emergencyMode) return;
    if (!screenData.settings.autoRotate) return;

    const activeScene = screenData.scenes[currentSceneIndex];
    const duration = (activeScene?.duration || screenData.settings.rotateInterval || 12) * 1000;

    const timer = setTimeout(() => {
      setCurrentSceneIndex((prev) => (prev + 1) % screenData.scenes.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [screenData, currentSceneIndex]);

  // Sync activeSceneId from operator if changed remotely
  useEffect(() => {
    if (!screenData?.settings?.activeSceneId || !screenData?.scenes?.length) return;
    const targetIdx = screenData.scenes.findIndex(
      (s) => s.sceneKey === screenData.settings.activeSceneId
    );
    if (targetIdx !== -1 && targetIdx !== currentSceneIndex) {
      setCurrentSceneIndex(targetIdx);
    }
  }, [screenData?.settings?.activeSceneId, screenData?.scenes]);

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.error('Fullscreen toggle error', err);
    }
  };

  // Listen for fullscreen change event
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'ArrowRight' && screenData?.scenes?.length) {
        setCurrentSceneIndex((prev) => (prev + 1) % screenData.scenes.length);
      } else if (e.key === 'ArrowLeft' && screenData?.scenes?.length) {
        setCurrentSceneIndex((prev) => (prev - 1 + screenData.scenes.length) % screenData.scenes.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenData]);

  // Auto-hide controls on mouse idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  if (loading && !screenData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-amber-100">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-amber-400" />
          <h2 className="text-xl font-light tracking-widest uppercase">Inicializando Eventox Live...</h2>
        </div>
      </div>
    );
  }

  if (error && !screenData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-rose-300">
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-8 text-center max-w-md">
          <AlertTriangle className="mx-auto h-12 w-12 text-rose-400 mb-3" />
          <p className="text-lg">{error}</p>
          <button
            onClick={() => fetchScreenData(slug)}
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-500 transition"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const { event, settings, scenes = [], activeMessage, quotes = [], recentArrivals = [] } = screenData!;
  const currentScene = scenes[currentSceneIndex] || {
    sceneKey: 'welcome',
    title: event.title,
    subtitle: event.hostName,
    content: {},
  };

  // Determine theme style
  const themeClass =
    settings.theme === 'royal_wine'
      ? 'from-[#1a0812] via-[#2d0f1f] to-[#12040c] text-rose-50 border-rose-500/20'
      : settings.theme === 'cinematic_dark'
      ? 'from-[#030712] via-[#090d16] to-[#020408] text-slate-100 border-slate-700/30'
      : 'from-[#0b0b0e] via-[#17161b] to-[#08080a] text-amber-50 border-amber-500/20'; // midnight_gold default

  const accentColor =
    settings.theme === 'royal_wine'
      ? 'text-rose-400'
      : settings.theme === 'cinematic_dark'
      ? 'text-sky-400'
      : 'text-amber-400';

  const accentBorder =
    settings.theme === 'royal_wine'
      ? 'border-rose-400/30'
      : settings.theme === 'cinematic_dark'
      ? 'border-sky-400/30'
      : 'border-amber-400/30';

  const currentQuote = quotes.length > 0 ? quotes[liveQuoteIndex % quotes.length] : null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative h-screen w-screen overflow-hidden bg-gradient-to-br ${themeClass} select-none font-sans`}
    >
      {/* Ambient background particles/glow effect */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl filter" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl filter" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-amber-400/5 blur-3xl filter" />
      </div>

      {/* Floating Top Control Bar (auto-hides on idle) */}
      <div
        className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 transition-opacity duration-500 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-white/80">
              Eventox Live • {scenes.length > 0 ? `${currentSceneIndex + 1}/${scenes.length}` : '1/1'}
            </span>
          </div>

          {settings.holdScene && (
            <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1 text-xs text-amber-300 font-medium">
              Cena Fixada pelo Operador
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentSceneIndex((prev) => (prev - 1 + scenes.length) % scenes.length)}
            className="rounded-full border border-white/10 bg-black/50 p-2 text-white/80 hover:bg-black/80 hover:text-white transition"
            title="Cena Anterior (Seta Esquerda)"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCurrentSceneIndex((prev) => (prev + 1) % scenes.length)}
            className="rounded-full border border-white/10 bg-black/50 p-2 text-white/80 hover:bg-black/80 hover:text-white transition"
            title="Próxima Cena (Seta Direita)"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-full border border-white/10 bg-black/60 p-2 text-white hover:bg-white/20 transition backdrop-blur-md"
            title={isFullscreen ? 'Sair de Ecrã Inteiro (F)' : 'Ecrã Inteiro 16:9 (F)'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Emergency Mode Overlay */}
      {settings.emergencyMode && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-red-950/95 p-8 text-center backdrop-blur-lg animate-pulse">
          <AlertTriangle className="h-24 w-24 text-red-400 mb-6 animate-bounce" />
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-wider text-white mb-4">
            Aviso Importante
          </h1>
          <p className="max-w-3xl text-2xl md:text-3xl font-medium text-red-100 leading-relaxed">
            {settings.emergencyMessage || 'Atenção a todos os presentes: por favor aguardem instruções da organização.'}
          </p>
        </div>
      )}

      {/* Live Broadcast / Welcome Announcement Banner */}
      {activeMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 max-w-4xl w-[90%] animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-4 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-950/90 via-black/90 to-amber-950/90 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
              <Sparkles size={24} className="animate-spin" />
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                {activeMessage.category === 'honra' ? 'Recepção de Honra' : 'Boas-Vindas'}
              </span>
              <p className="text-lg md:text-xl font-semibold text-white truncate">
                {activeMessage.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 16:9 Central Screen Display Area */}
      <main className="relative z-10 flex h-full w-full items-center justify-center p-6 md:p-12">
        <div className="relative aspect-video w-full max-w-7xl max-h-[88vh] flex flex-col justify-between rounded-3xl border border-white/10 bg-black/40 p-8 md:p-14 shadow-2xl backdrop-blur-md overflow-hidden">

          {/* Top Header of the 16:9 Screen */}
          <header className="flex items-center justify-between border-b border-white/10 pb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black font-black text-xl shadow-lg">
                E
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-serif tracking-wide text-white uppercase">
                  {event.title}
                </h2>
                <p className={`text-sm tracking-widest uppercase font-semibold ${accentColor}`}>
                  {event.hostName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Calendar size={16} className={accentColor} />
                <span>
                  {new Date(event.eventDate || Date.now()).toLocaleDateString('pt-PT', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <MapPin size={16} className={accentColor} />
                <span className="truncate max-w-[200px]">{event.venue}</span>
              </div>
            </div>
          </header>

          {/* Dynamic Scene Content */}
          <section className="my-auto flex-1 flex items-center justify-center py-6">
            {/* SCENE 1: WELCOME */}
            {currentScene.sceneKey === 'welcome' && (
              <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-1000 max-w-4xl">
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-sm font-medium text-amber-300">
                  <Sparkles size={16} /> Sejam Bem-Vindos à Gala Oficial
                </span>
                <h1 className="font-serif text-4xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
                  {currentScene.title || event.title}
                </h1>
                <p className="mt-4 text-xl md:text-2xl font-light text-amber-100/90 tracking-wide">
                  {currentScene.subtitle || event.description || 'Uma noite inesquecível de celebração, união e orgulho.'}
                </p>
                <div className="mt-8 flex items-center gap-6 text-base text-white/80">
                  <span className="flex items-center gap-2">
                    <Clock size={18} className={accentColor} />
                    {new Date(event.eventDate || Date.now()).toLocaleTimeString('pt-PT', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>•</span>
                  <span>{event.venue}</span>
                </div>
              </div>
            )}

            {/* SCENE 2: COUNTDOWN */}
            {currentScene.sceneKey === 'countdown' && (
              <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-1000">
                <span className={`text-sm uppercase tracking-widest font-semibold mb-4 ${accentColor}`}>
                  {timeLeft.isPast ? 'Momento da Celebração' : 'Contagem Regressiva para a Abertura'}
                </span>
                <h2 className="text-3xl md:text-5xl font-serif text-white mb-8">
                  O Grande Momento
                </h2>

                <div className="grid grid-cols-4 gap-4 md:gap-8 max-w-3xl w-full">
                  {[
                    { label: 'DIAS', val: timeLeft.days },
                    { label: 'HORAS', val: timeLeft.hours },
                    { label: 'MINUTOS', val: timeLeft.minutes },
                    { label: 'SEGUNDOS', val: timeLeft.seconds },
                  ].map((unit, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 backdrop-blur-md shadow-xl"
                    >
                      <span className="font-serif text-4xl md:text-7xl font-bold text-amber-300">
                        {String(unit.val).padStart(2, '0')}
                      </span>
                      <span className="mt-2 text-xs md:text-sm font-semibold tracking-widest text-white/60">
                        {unit.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCENE 3: ARRIVALS / CHECK-IN */}
            {currentScene.sceneKey === 'arrivals' && (
              <div className="w-full max-w-4xl animate-in fade-in duration-700">
                <div className="text-center mb-6">
                  <span className={`text-xs uppercase tracking-widest font-bold ${accentColor}`}>
                    Recepção & Protocolo
                  </span>
                  <h2 className="text-3xl md:text-4xl font-serif text-white">
                    Convidados de Honra Recém-Chegados
                  </h2>
                </div>

                {recentArrivals.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {recentArrivals.map((guest, idx) => (
                      <div
                        key={guest.id || idx}
                        className="flex flex-col items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-950/20 p-4 text-center backdrop-blur-md"
                      >
                        <div className="h-10 w-10 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-300 mb-2 font-bold text-lg">
                          {guest.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white text-base truncate w-full">
                          {guest.name}
                        </span>
                        <span className="text-xs text-amber-300/80 mt-1">Presente na Gala</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-white/60">
                    <Users className="mx-auto h-12 w-12 text-white/40 mb-3" />
                    <p className="text-lg">A acolher os ilustres convidados na entrada principal.</p>
                  </div>
                )}
              </div>
            )}

            {/* SCENE 4: FUN QUOTE / REFLECTION */}
            {currentScene.sceneKey === 'fun_quote' && (
              <div className="max-w-3xl text-center animate-in fade-in zoom-in-95 duration-1000">
                <span className={`text-xs uppercase tracking-widest font-bold mb-4 inline-block ${accentColor}`}>
                  Pensamentos & Memórias da Graduação
                </span>
                <blockquote className="font-serif text-2xl md:text-4xl italic text-white/95 leading-relaxed">
                  "{currentQuote?.quote || 'Curar quando possível, aliviar com frequência, consolar sempre.'}"
                </blockquote>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <div className="h-0.5 w-12 bg-amber-400/50" />
                  <span className="text-base md:text-lg font-medium text-amber-300">
                    {currentQuote?.author || 'Hipócrates'}
                  </span>
                  <div className="h-0.5 w-12 bg-amber-400/50" />
                </div>
              </div>
            )}

            {/* SCENE 5: GALLERY & MURAL */}
            {currentScene.sceneKey === 'gallery_mural' && (
              <div className="w-full max-w-4xl text-center animate-in fade-in duration-700">
                <span className={`text-xs uppercase tracking-widest font-bold ${accentColor}`}>
                  Mural de Momentos
                </span>
                <h2 className="text-3xl md:text-4xl font-serif text-white mb-6">
                  Fotografias & Mensagens ao Vivo
                </h2>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
                  <p className="text-lg md:text-xl text-amber-100/90 leading-relaxed max-w-2xl mx-auto">
                    Aceda ao mural pelo seu telemóvel e partilhe os seus votos para o Dr. Emerson. As melhores mensagens e memórias serão projectadas aqui durante a gala!
                  </p>
                  <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-amber-400/40 bg-amber-400/10 px-6 py-2 text-amber-300 font-semibold">
                    <Sparkles size={18} /> Partilhe no link oficial: eventox.kazix.site/{event.slug}/mural
                  </div>
                </div>
              </div>
            )}

            {/* SCENE 6: DYNAMIC QR CODE */}
            {currentScene.sceneKey === 'qr_code' && (
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14 animate-in fade-in duration-700">
                {qrDataUrl && (
                  <div className="rounded-3xl border-4 border-amber-400/40 bg-white p-4 shadow-2xl">
                    <img src={qrDataUrl} alt="QR Code do Evento" className="h-56 w-56 md:h-72 md:w-72" />
                  </div>
                )}
                <div className="max-w-md text-left">
                  <span className={`text-xs uppercase tracking-widest font-bold ${accentColor}`}>
                    Interação com os Convidados
                  </span>
                  <h2 className="mt-2 text-3xl md:text-5xl font-serif font-bold text-white">
                    Participe no Ecrã
                  </h2>
                  <p className="mt-4 text-base md:text-lg text-white/80 leading-relaxed">
                    Aponte a câmara do seu smartphone para o código QR para:
                  </p>
                  <ul className="mt-4 space-y-2 text-sm md:text-base text-amber-200/90 font-medium">
                    <li className="flex items-center gap-2">✓ Consultar a sua mesa e assento</li>
                    <li className="flex items-center gap-2">✓ Enviar mensagens de felicitações</li>
                    <li className="flex items-center gap-2">✓ Sugerir músicas para a pista de dança</li>
                  </ul>
                </div>
              </div>
            )}

            {/* SCENE 7: SCHEDULE */}
            {currentScene.sceneKey === 'schedule' && (
              <div className="w-full max-w-3xl animate-in fade-in duration-700">
                <div className="text-center mb-6">
                  <span className={`text-xs uppercase tracking-widest font-bold ${accentColor}`}>
                    Programa Oficial
                  </span>
                  <h2 className="text-3xl md:text-4xl font-serif text-white">
                    Ordem de Trabalhos da Gala
                  </h2>
                </div>
                <div className="space-y-3">
                  {[
                    { time: '14:00', title: 'Acolhimento & Recepção de Boas-Vindas' },
                    { time: '15:30', title: 'Entrada Solene dos Graduados & Discursos' },
                    { time: '17:00', title: 'Brinde de Honra e Sessão Fotográfica' },
                    { time: '18:00', title: 'Banquete de Comemoração' },
                    { time: '20:30', title: 'Abertura da Pista de Dança & Confraternização' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 backdrop-blur-md"
                    >
                      <span className="font-serif text-lg font-bold text-amber-400">{item.time}</span>
                      <span className="text-base text-white font-medium">{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCENE 8: TRIBUTE */}
            {currentScene.sceneKey === 'tribute' && (
              <div className="max-w-3xl text-center animate-in fade-in zoom-in-95 duration-1000">
                <Award className="mx-auto h-16 w-16 text-amber-400 mb-4" />
                <span className={`text-xs uppercase tracking-widest font-bold ${accentColor}`}>
                  Momento Solene
                </span>
                <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mt-2 mb-4">
                  Homenagem aos Pais & Mestres
                </h2>
                <p className="text-lg md:text-xl text-amber-100/90 leading-relaxed font-light">
                  A conquista do diploma em Medicina é o reflexo de anos de sacrifício, amor incondicional da família e a sabedoria incansável dos nossos professores. A vós dedicamos este momento.
                </p>
              </div>
            )}

            {/* SCENE 9: GRATITUDE */}
            {currentScene.sceneKey === 'gratitude' && (
              <div className="max-w-3xl text-center animate-in fade-in zoom-in-95 duration-1000">
                <Heart className="mx-auto h-16 w-16 text-rose-400 mb-4 animate-pulse" />
                <span className={`text-xs uppercase tracking-widest font-bold ${accentColor}`}>
                  Agradecimento Especial
                </span>
                <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mt-2 mb-4">
                  O Nosso Muito Obrigado!
                </h2>
                <p className="text-lg md:text-xl text-amber-100/90 leading-relaxed font-light">
                  A presença de cada um de vocês torna esta celebração verdadeiramente completa e memorável. Celebrem connosco esta grande vitória!
                </p>
              </div>
            )}
          </section>

          {/* Bottom Footer of the 16:9 Screen */}
          <footer className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              <span>Eventox Live Cinema Engine • Modo Ecrã Profissional</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Transmissão em Directo</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
