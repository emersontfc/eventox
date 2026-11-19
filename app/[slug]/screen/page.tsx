'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Sparkles, Maximize2, Minimize2, Calendar, MapPin, Clock,
  Heart, Award, Users, QrCode as QrCodeIcon, AlertTriangle,
  ChevronLeft, ChevronRight, RefreshCw
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
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            fetchScreenData(slug);
          }, 3500);
        }
      };
    } catch {
      pollInterval = setInterval(() => {
        fetchScreenData(slug);
      }, 3500);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [slug, fetchScreenData]);

  // Generate high-resolution QR Code
  useEffect(() => {
    if (typeof window !== 'undefined' && slug) {
      const targetUrl = `${window.location.origin}/${slug}/mural`;
      QRCode.toDataURL(targetUrl, {
        width: 480,
        margin: 2,
        color: {
          dark: '#0a0a0e',
          light: '#ffffff',
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
    }, 10000);
    return () => clearInterval(quoteInterval);
  }, [screenData?.quotes]);

  // Auto-rotate scenes
  useEffect(() => {
    if (!screenData?.scenes?.length) return;

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
          <RefreshCw className="h-12 w-12 animate-spin text-amber-400" />
          <h2 className="text-2xl font-light tracking-widest uppercase">Inicializando Eventox Live Cinema...</h2>
        </div>
      </div>
    );
  }

  if (error && !screenData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-rose-300">
        <div className="rounded-2xl border border-rose-900/50 bg-rose-950/40 p-8 text-center max-w-lg">
          <AlertTriangle className="mx-auto h-14 w-14 text-rose-400 mb-4" />
          <p className="text-xl">{error}</p>
          <button
            onClick={() => fetchScreenData(slug)}
            className="mt-6 rounded-xl bg-rose-600 px-6 py-2.5 text-white font-bold hover:bg-rose-500 transition"
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
      ? 'from-[#190610] via-[#2a0c1d] to-[#12040b] text-rose-50'
      : settings.theme === 'cinematic_dark'
      ? 'from-[#02050b] via-[#080d1a] to-[#010307] text-slate-100'
      : 'from-[#08080b] via-[#141318] to-[#050507] text-amber-50'; // midnight_gold default

  const accentColor =
    settings.theme === 'royal_wine'
      ? 'text-rose-400'
      : settings.theme === 'cinematic_dark'
      ? 'text-sky-400'
      : 'text-amber-400';

  const accentGlow =
    settings.theme === 'royal_wine'
      ? 'bg-rose-500/10'
      : settings.theme === 'cinematic_dark'
      ? 'bg-sky-500/10'
      : 'bg-amber-500/10';

  const currentQuote = quotes.length > 0 ? quotes[liveQuoteIndex % quotes.length] : null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative h-screen w-screen overflow-hidden bg-gradient-to-br ${themeClass} select-none font-sans`}
    >
      {/* Immersive ambient glowing light elements */}
      <div className="absolute inset-0 pointer-events-none opacity-50 overflow-hidden">
        <div className={`absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full ${accentGlow} blur-3xl`} />
        <div className={`absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full ${accentGlow} blur-3xl`} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full ${accentGlow} blur-3xl opacity-30`} />
      </div>

      {/* Floating Top Control Bar (auto-hides on idle mouse) */}
      <div
        className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-6 transition-opacity duration-500 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2 backdrop-blur-md shadow-lg">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold tracking-widest uppercase text-white/90">
              Eventox Live • {scenes.length > 0 ? `${currentSceneIndex + 1}/${scenes.length}` : '1/1'}
            </span>
          </div>

          {settings.holdScene && (
            <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-4 py-1.5 text-xs text-amber-300 font-bold backdrop-blur-md">
              Cena Fixada pelo Operador
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentSceneIndex((prev) => (prev - 1 + scenes.length) % scenes.length)}
            className="rounded-full border border-white/10 bg-black/60 p-2.5 text-white/80 hover:bg-black/90 hover:text-white transition shadow-lg backdrop-blur-md"
            title="Cena Anterior (Seta Esquerda)"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentSceneIndex((prev) => (prev + 1) % scenes.length)}
            className="rounded-full border border-white/10 bg-black/60 p-2.5 text-white/80 hover:bg-black/90 hover:text-white transition shadow-lg backdrop-blur-md"
            title="Próxima Cena (Seta Direita)"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-full border border-white/10 bg-black/70 p-2.5 text-white hover:bg-white/20 transition shadow-lg backdrop-blur-md"
            title={isFullscreen ? 'Sair de Ecrã Inteiro (F)' : 'Ecrã Inteiro Projector (F)'}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {/* Emergency Mode Overlay */}
      {settings.emergencyMode && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-red-950/95 p-12 text-center backdrop-blur-xl animate-pulse">
          <AlertTriangle className="h-28 w-28 text-red-400 mb-8 animate-bounce" />
          <h1 className="text-5xl md:text-8xl font-black uppercase tracking-widest text-white mb-6">
            Aviso de Emergência
          </h1>
          <p className="max-w-5xl text-3xl md:text-5xl font-semibold text-red-100 leading-relaxed">
            {settings.emergencyMessage || 'Atenção a todos os presentes: por favor aguardem instruções da organização.'}
          </p>
        </div>
      )}

      {/* Live Broadcast / Welcome Announcement Banner */}
      {activeMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-5xl w-[92%] animate-in fade-in slide-in-from-top-6 duration-700">
          <div className="flex items-center gap-6 rounded-3xl border border-amber-400/40 bg-gradient-to-r from-black/95 via-amber-950/90 to-black/95 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300">
              <Sparkles size={32} className="animate-spin" />
            </div>
            <div className="overflow-hidden">
              <span className="text-sm font-bold uppercase tracking-widest text-amber-400 block mb-1">
                {activeMessage.category === 'honra' ? 'Recepção de Honra • Solenidade' : 'Boas-Vindas Oficiais'}
              </span>
              <p className="text-2xl md:text-3xl font-bold text-white truncate">
                {activeMessage.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TRUE FULL-SCREEN 16:9 RESPONSIVE VIEWPORT */}
      <main className="relative z-10 h-full w-full flex flex-col justify-between p-6 sm:p-10 md:p-12 lg:p-16">

        {/* Top Header Bar */}
        <header className="flex items-center justify-between border-b border-white/10 pb-6 w-full shrink-0">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black font-black text-2xl sm:text-3xl shadow-xl">
              E
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-extrabold tracking-wide text-white uppercase">
                {event.title}
              </h2>
              <p className={`text-base sm:text-lg md:text-xl tracking-widest uppercase font-bold ${accentColor} mt-0.5`}>
                {event.hostName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8 text-base sm:text-xl text-white/80 font-medium">
            <div className="flex items-center gap-2.5">
              <Calendar size={22} className={accentColor} />
              <span>
                {new Date(event.eventDate || Date.now()).toLocaleDateString('pt-PT', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2.5">
              <MapPin size={22} className={accentColor} />
              <span className="truncate max-w-xs">{event.venue}</span>
            </div>
          </div>
        </header>

        {/* Central Stage (Edge-to-Edge Responsive Scale) */}
        <section className="my-auto flex-1 flex items-center justify-center w-full py-6">

          {/* SCENE 1: WELCOME */}
          {currentScene.sceneKey === 'welcome' && (
            <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-1000 w-full max-w-7xl mx-auto px-4">
              <span className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-6 py-2 text-base sm:text-lg font-bold text-amber-300 tracking-widest uppercase shadow-lg backdrop-blur-md">
                <Sparkles size={20} /> Celebração Oficial de Graduação em Medicina
              </span>
              <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight text-white leading-tight drop-shadow-2xl">
                {currentScene.title || event.title}
              </h1>
              <p className="mt-6 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-amber-100/90 tracking-wide leading-relaxed max-w-5xl">
                {currentScene.subtitle || event.description || 'Uma noite memorável de consagração, amizade e orgulho.'}
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-xl sm:text-2xl text-white/80 font-medium">
                <span className="flex items-center gap-3">
                  <Clock size={24} className={accentColor} />
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
            <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-1000 w-full max-w-7xl mx-auto px-4">
              <span className={`text-base sm:text-xl uppercase tracking-[0.25em] font-bold mb-4 ${accentColor}`}>
                {timeLeft.isPast ? 'O Momento Chegou • É Hora de Celebrar' : 'Contagem Regressiva para o Início da Gala'}
              </span>
              <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-black text-white mb-10">
                O Grande Momento
              </h2>

              <div className="grid grid-cols-4 gap-4 sm:gap-6 md:gap-10 w-full max-w-6xl">
                {[
                  { label: 'DIAS', val: timeLeft.days },
                  { label: 'HORAS', val: timeLeft.hours },
                  { label: 'MINUTOS', val: timeLeft.minutes },
                  { label: 'SEGUNDOS', val: timeLeft.seconds },
                ].map((unit, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center justify-center rounded-3xl border border-white/15 bg-white/5 py-8 md:py-14 px-4 backdrop-blur-xl shadow-2xl"
                  >
                    <span className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[10rem] font-black text-amber-300 leading-none drop-shadow-2xl">
                      {String(unit.val).padStart(2, '0')}
                    </span>
                    <span className="mt-4 text-xs sm:text-lg md:text-xl font-bold tracking-[0.3em] uppercase text-white/70">
                      {unit.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCENE 3: ARRIVALS / CHECK-IN */}
          {currentScene.sceneKey === 'arrivals' && (
            <div className="w-full max-w-7xl mx-auto animate-in fade-in duration-700 px-4">
              <div className="text-center mb-10">
                <span className={`text-base sm:text-xl uppercase tracking-[0.25em] font-bold ${accentColor}`}>
                  Recepção de Honra & Protocolo
                </span>
                <h2 className="text-4xl sm:text-6xl md:text-7xl font-serif font-black text-white mt-2">
                  Convidados Recém-Chegados
                </h2>
              </div>

              {recentArrivals.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {recentArrivals.map((guest, idx) => (
                    <div
                      key={guest.id || idx}
                      className="flex flex-col items-center justify-center rounded-3xl border border-amber-400/25 bg-amber-950/25 p-6 text-center backdrop-blur-xl shadow-xl"
                    >
                      <div className="h-16 w-16 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-2xl mb-3 shadow-md">
                        {guest.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-white text-xl md:text-2xl truncate w-full">
                        {guest.name}
                      </span>
                      <span className="text-sm font-semibold text-amber-300 mt-1">✓ Presente no Salão</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-white/70">
                  <Users className="mx-auto h-20 w-20 text-white/40 mb-4" />
                  <p className="text-2xl md:text-3xl font-light">A receber os distintos convidados no átrio principal.</p>
                </div>
              )}
            </div>
          )}

          {/* SCENE 4: FUN QUOTE / REFLECTION */}
          {currentScene.sceneKey === 'fun_quote' && (
            <div className="w-full max-w-7xl mx-auto text-center animate-in fade-in zoom-in-95 duration-1000 px-4">
              <span className={`text-base sm:text-xl uppercase tracking-[0.25em] font-bold mb-6 inline-block ${accentColor}`}>
                Memórias & Reflexões da Jornada Médica
              </span>
              <blockquote className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl italic text-white/95 leading-relaxed drop-shadow-xl">
                "{currentQuote?.quote || 'Curar quando possível, aliviar com frequência, consolar sempre.'}"
              </blockquote>
              <div className="mt-10 flex items-center justify-center gap-6">
                <div className="h-0.5 w-20 bg-amber-400/50" />
                <span className="text-2xl sm:text-3xl md:text-4xl font-semibold text-amber-300">
                  {currentQuote?.author || 'Hipócrates'}
                </span>
                <div className="h-0.5 w-20 bg-amber-400/50" />
              </div>
            </div>
          )}

          {/* SCENE 5: GALLERY & MURAL */}
          {currentScene.sceneKey === 'gallery_mural' && (
            <div className="w-full max-w-7xl mx-auto text-center animate-in fade-in duration-700 px-4">
              <span className={`text-base sm:text-xl uppercase tracking-[0.25em] font-bold ${accentColor}`}>
                Mural de Momentos ao Vivo
              </span>
              <h2 className="text-4xl sm:text-6xl md:text-7xl font-serif font-black text-white mt-2 mb-8">
                Fotografias & Mensagens dos Convidados
              </h2>
              <div className="rounded-3xl border border-white/15 bg-white/5 p-10 md:p-14 backdrop-blur-xl shadow-2xl max-w-5xl mx-auto">
                <p className="text-2xl sm:text-3xl md:text-4xl text-amber-100/90 leading-relaxed font-light">
                  Aceda ao mural no seu telemóvel e partilhe os seus votos e fotos com o Dr. Emerson. As melhores memórias serão projetadas aqui durante toda a festa!
                </p>
                <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-amber-400/40 bg-amber-400/10 px-8 py-3 text-xl font-bold text-amber-300">
                  <Sparkles size={24} /> Partilhe em: evento.kazix.site/{event.slug}/mural
                </div>
              </div>
            </div>
          )}

          {/* SCENE 6: DYNAMIC QR CODE */}
          {currentScene.sceneKey === 'qr_code' && (
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-20 animate-in fade-in duration-700 w-full max-w-7xl mx-auto px-4">
              {qrDataUrl && (
                <div className="rounded-3xl border-4 border-amber-400/50 bg-white p-6 shadow-2xl shrink-0">
                  <img src={qrDataUrl} alt="QR Code do Evento" className="h-72 w-72 sm:h-80 sm:w-80 md:h-96 md:w-96" />
                </div>
              )}
              <div className="max-w-2xl text-left">
                <span className={`text-base sm:text-xl uppercase tracking-[0.25em] font-bold ${accentColor}`}>
                  Interação dos Convidados
                </span>
                <h2 className="mt-2 text-4xl sm:text-6xl md:text-7xl font-serif font-black text-white">
                  Participe no Ecrã
                </h2>
                <p className="mt-6 text-xl sm:text-2xl text-white/80 leading-relaxed">
                  Aponte a câmara do seu smartphone para o código QR para:
                </p>
                <ul className="mt-6 space-y-4 text-xl sm:text-2xl text-amber-200/95 font-medium">
                  <li className="flex items-center gap-3">✓ Consultar a sua mesa e assento oficial</li>
                  <li className="flex items-center gap-3">✓ Enviar mensagens de felicitações ao vivo</li>
                  <li className="flex items-center gap-3">✓ Sugerir músicas para a pista de dança</li>
                </ul>
              </div>
            </div>
          )}

          {/* SCENE 7: SCHEDULE */}
          {currentScene.sceneKey === 'schedule' && (
            <div className="w-full max-w-5xl mx-auto animate-in fade-in duration-700 px-4">
              <div className="text-center mb-8">
                <span className={`text-base sm:text-xl uppercase tracking-[0.25em] font-bold ${accentColor}`}>
                  Programa Oficial
                </span>
                <h2 className="text-4xl sm:text-6xl font-serif font-black text-white mt-1">
                  Ordem de Trabalhos da Gala
                </h2>
              </div>
              <div className="space-y-4">
                {[
                  { time: '14:00', title: 'Acolhimento & Recepção de Boas-Vindas' },
                  { time: '15:30', title: 'Entrada Solene dos Graduados & Discursos' },
                  { time: '17:00', title: 'Brinde de Honra e Sessão Fotográfica' },
                  { time: '18:00', title: 'Banquete de Comemoração' },
                  { time: '20:30', title: 'Abertura da Pista de Dança & Confraternização' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-8 py-5 backdrop-blur-md shadow-lg"
                  >
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-amber-400">{item.time}</span>
                    <span className="text-xl sm:text-2xl text-white font-medium">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCENE 8: TRIBUTE */}
          {currentScene.sceneKey === 'tribute' && (
            <div className="w-full max-w-6xl mx-auto text-center animate-in fade-in zoom-in-95 duration-1000 px-4">
              <Award className="mx-auto h-24 w-24 text-amber-400 mb-6" />
              <span className={`text-base sm:text-xl uppercase tracking-[0.25em] font-bold ${accentColor}`}>
                Momento Solene
              </span>
              <h2 className="text-4xl sm:text-7xl md:text-8xl font-serif font-black text-white mt-2 mb-6">
                Homenagem aos Pais & Mestres
              </h2>
              <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-amber-100/95 leading-relaxed font-light">
                A conquista do diploma em Medicina é o reflexo de anos de dedicação incansável, do amor incondicional das nossas famílias e da sabedoria dos nossos mestres. A vós dedicamos este grande dia!
              </p>
            </div>
          )}

          {/* SCENE 9: GRATITUDE */}
          {currentScene.sceneKey === 'gratitude' && (
            <div className="w-full max-w-6xl mx-auto text-center animate-in fade-in zoom-in-95 duration-1000 px-4">
              <Heart className="mx-auto h-24 w-24 text-rose-400 mb-6 animate-pulse" />
              <span className={`text-base sm:text-xl uppercase tracking-[0.25em] font-bold ${accentColor}`}>
                Agradecimento Especial
              </span>
              <h2 className="text-4xl sm:text-7xl md:text-8xl font-serif font-black text-white mt-2 mb-6">
                O Nosso Muito Obrigado!
              </h2>
              <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-amber-100/95 leading-relaxed font-light">
                A presença calorosa de cada um de vocês torna esta celebração verdadeiramente inesquecível. Celebrem connosco esta vitória extraordinária!
              </p>
            </div>
          )}

        </section>

        {/* Bottom Footer Bar */}
        <footer className="flex items-center justify-between border-t border-white/10 pt-4 text-sm sm:text-base text-white/50 w-full shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <span>Eventox Live Cinema Engine • Projeção Oficial em Direto</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Transmissão em Alta Definição</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </footer>
      </main>
    </div>
  );
}
