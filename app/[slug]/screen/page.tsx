'use client';
import type { ProgramItem } from '../../../lib/event-program';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Sparkles, Maximize2, Minimize2, Calendar, MapPin, Clock,
  Heart, Award, Users, QrCode as QrCodeIcon, AlertTriangle,
  ChevronLeft, ChevronRight, RefreshCw, Volume2, VolumeX,
  Trophy, Flame, CheckCircle, BarChart3, Cloud, MessageSquare, Radio
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
    stageStatus?: string;
    version?: number;
    sceneStartedAt?: string | null;
    sceneDurationSeconds?: number;
    isPaused?: boolean;
    activeGameSessionId?: number | null;
    broadcastTicker?: string | null;
    broadcastTickerSender?: string | null;
  };
  scenes: Array<{
    id: number;
    sceneType: string;
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
  program?: ProgramItem[];
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
  activeGameSession?: {
    id: number;
    pin: string;
    status: string;
    currentQuestionIndex: number;
    questionStartedAt?: string;
    participantCount: number;
    currentQuestion?: {
      id: number;
      orderIndex: number;
      totalQuestions: number;
      currentIndex: number;
      questionType: string;
      title: string;
      mediaUrl?: string | null;
      options: string[];
      correctAnswer?: string;
      timeLimit: number;
      points: number;
      explanation?: string;
    } | null;
    topPlayers?: Array<{ id: number; nickname: string; score: number; avatar?: string; tableNumber?: string }>;
    tableRankings?: Array<{ table: string; score: number }>;
  } | null;
  interactions?: {
    wordCloud?: Array<{ word: string; count: number }>;
    polls?: Array<{ option: string; votes: number }>;
    qa?: Array<{ id: number; question: string; sender: string; votes: number }>;
  };
  timestamp: number;
}

export default function EventScreenPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  const [screenData, setScreenData] = useState<ScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [qrJoinDataUrl, setQrJoinDataUrl] = useState<string>('');
  const [liveQuoteIndex, setLiveQuoteIndex] = useState(0);
  const [contentPage, setContentPage] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const activeScene = screenData?.settings.activeSceneId;

  useEffect(() => {
    setPreviewMode(new URLSearchParams(window.location.search).get('preview') === '1');
  }, []);

  useEffect(() => {
    setContentPage(0);
    if (activeScene !== 'schedule' && activeScene !== 'gallery_mural') return;
    if (screenData?.settings.isPaused || screenData?.settings.holdScene) return;
    const timer = window.setInterval(() => setContentPage(page => page + 1), 6500);
    return () => window.clearInterval(timer);
  }, [activeScene, screenData?.settings.isPaused, screenData?.settings.holdScene]);

  // Question countdown state
  const [questionSecondsRemaining, setQuestionSecondsRemaining] = useState<number>(20);

  // General countdown timer state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSlug(p.slug.toLowerCase().trim()));
  }, [params]);

  // Synthesized Web Audio Sound Generator (No external MP3 files needed)
  const playChime = useCallback((type: 'tick' | 'reveal' | 'fanfare') => {
    if (!audioEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'tick') {
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'reveal') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.1);
        osc.frequency.setValueAtTime(659.25, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'fanfare') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.15);
        osc.frequency.setValueAtTime(783.99, now + 0.3);
        osc.frequency.setValueAtTime(1046.50, now + 0.45);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
      }
    } catch {
      // Audio not permitted yet
    }
  }, [audioEnabled]);

  // Fetch initial screen data
  const fetchScreenData = useCallback(async (currentSlug: string) => {
    try {
      const res = await fetch(`/api/screen/${currentSlug}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar ecrã');
      const data: ScreenData = await res.json();
      setScreenData(data);
      setError(null);
    } catch (err: any) {
      if (!screenData) {
        setError('A carregar transmissão do evento...');
      }
    } finally {
      setLoading(false);
    }
  }, [screenData]);

  // SSE Stream with polling fallback
  useEffect(() => {
    if (!slug) return;

    fetchScreenData(slug);

    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource(`/api/screen/${slug}/stream`);

      eventSource.addEventListener('update', (event) => {
        try {
          fetchScreenData(slug);
        } catch {}
      });

      eventSource.onerror = () => {
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            fetchScreenData(slug);
          }, 3000);
        }
      };
    } catch {
      pollInterval = setInterval(() => {
        fetchScreenData(slug);
      }, 3000);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [slug, fetchScreenData]);

  // Generate high-resolution QR Code for Participant Join
  useEffect(() => {
    if (typeof window !== 'undefined' && slug) {
      const targetUrl = `${window.location.origin}/${slug}/join`;
      QRCode.toDataURL(targetUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: '#050508',
          light: '#ffffff',
        },
      }).then(setQrJoinDataUrl).catch(() => {});
    }
  }, [slug]);

  // Live countdown calculation for event date
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
    }, 12000);
    return () => clearInterval(quoteInterval);
  }, [screenData?.quotes]);

  // Server-Authoritative Question Timer
  useEffect(() => {
    const session = screenData?.activeGameSession;
    if (!session || session.status !== 'question_active' || !session.questionStartedAt) {
      return;
    }

    const timeLimit = session.currentQuestion?.timeLimit || 20;
    const startedAt = new Date(session.questionStartedAt).getTime();

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, timeLimit - elapsed);
      setQuestionSecondsRemaining(remaining);
      if (remaining <= 3 && remaining > 0) {
        playChime('tick');
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 500);
    return () => clearInterval(timerInterval);
  }, [screenData?.activeGameSession, playChime]);

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
    } catch {}
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  if (loading && !screenData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-amber-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-12 w-12 animate-spin text-amber-400" />
          <h2 className="text-xl font-light tracking-widest uppercase">A sintonizar Estúdio Live 16:9...</h2>
        </div>
      </div>
    );
  }

  if (error && !screenData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-rose-300 font-sans p-6">
        <div className="rounded-2xl border border-rose-900/50 bg-rose-950/40 p-8 text-center max-w-lg">
          <AlertTriangle className="mx-auto h-12 w-12 text-rose-400 mb-4" />
          <p className="text-lg">{error}</p>
          <button
            onClick={() => fetchScreenData(slug)}
            className="mt-6 rounded-xl bg-amber-500 px-6 py-2.5 text-slate-950 font-bold hover:bg-amber-400 transition"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const { event, settings, activeMessage, quotes = [], photos = [], program = [], recentArrivals = [], activeGameSession, interactions } = screenData!;
  const currentSceneType = settings.activeSceneId || 'welcome';
  const currentQuote = quotes.length > 0 ? quotes[liveQuoteIndex % quotes.length] : null;
  const programPage = (contentPage % Math.max(1, Math.ceil(program.length / 4))) * 4;
  const galleryItem = photos[contentPage % photos.length];

  // Cinematic themes
  const themeClass =
    settings.theme === 'royal_wine'
      ? 'from-[#190610] via-[#2a0c1d] to-[#12040b] text-rose-50'
      : settings.theme === 'cinematic_dark'
      ? 'from-[#02050b] via-[#080d1a] to-[#010307] text-slate-100'
      : 'from-[#08080b] via-[#141318] to-[#050507] text-amber-50'; // midnight_gold

  const accentColor =
    settings.theme === 'royal_wine' ? 'text-rose-400' : settings.theme === 'cinematic_dark' ? 'text-sky-400' : 'text-amber-400';

  const accentBorder =
    settings.theme === 'royal_wine' ? 'border-rose-400/40' : settings.theme === 'cinematic_dark' ? 'border-sky-400/40' : 'border-amber-400/40';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`event-stage relative h-screen w-screen overflow-hidden bg-black flex items-center justify-center select-none font-sans ${previewMode ? 'event-stage-preview' : ''}`}
    >
      {/* 16:9 Canvas Box with Responsive Scale & Safe Margin */}
      <div
        className={`event-stage-canvas relative w-full max-w-[1920px] aspect-video max-h-screen flex flex-col justify-between p-6 sm:p-10 md:p-12 lg:p-16 overflow-hidden bg-gradient-to-br ${themeClass} shadow-2xl`}
      >
        {/* Ambient atmospheric glow */}
        <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-amber-500/5 blur-3xl" />
        </div>

        {/* Floating Top Controls (auto-hides on idle) */}
        <div
          className={`event-stage-controls absolute top-4 right-4 z-50 flex items-center gap-3 transition-opacity duration-500 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playChime('tick');
            }}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold backdrop-blur-md transition shadow-lg ${
              audioEnabled
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                : 'border-white/10 bg-black/60 text-white/80 hover:bg-black/80'
            }`}
          >
            {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {audioEnabled ? 'Som Ativo' : 'Ativar Efeitos Sonoros'}
          </button>

          <button
            onClick={toggleFullscreen}
            className="rounded-full border border-white/10 bg-black/60 p-2.5 text-white hover:bg-white/20 transition shadow-lg backdrop-blur-md"
            title={isFullscreen ? 'Sair de Ecrã Inteiro (F)' : 'Ecrã Inteiro (F)'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        {/* Emergency Mode Alert Banner */}
        {settings.emergencyMode && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/98 p-12 text-center backdrop-blur-xl animate-pulse">
            <AlertTriangle className="h-24 w-24 text-red-400 mb-6 animate-bounce" />
            <h1 className="text-4xl md:text-7xl font-black uppercase tracking-widest text-white mb-4">
              Aviso de Emergência
            </h1>
            <p className="max-w-4xl text-2xl md:text-4xl font-semibold text-red-100 leading-relaxed">
              {settings.emergencyMessage || 'Atenção a todos os presentes: por favor aguardem instruções da organização.'}
            </p>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="relative z-10 flex items-center justify-between border-b border-white/10 pb-5 w-full shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black font-black text-2xl shadow-xl">
              ✦
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-extrabold tracking-wide text-white uppercase truncate max-w-xl">
                {event.title}
              </h2>
              <p className={`text-xs sm:text-sm md:text-base tracking-widest uppercase font-bold ${accentColor}`}>
                {event.hostName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm sm:text-base text-white/80 font-medium">
            <div className="flex items-center gap-2">
              <Calendar size={18} className={accentColor} />
              <span>
                {new Date(event.eventDate || Date.now()).toLocaleDateString('pt-PT', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <MapPin size={18} className={accentColor} />
              <span className="truncate max-w-xs">{event.venue}</span>
            </div>
          </div>
        </header>

        {/* Central Stage */}
        <section className="relative z-10 my-auto flex-1 flex items-center justify-center w-full py-4 overflow-hidden">
          {/* 1. SCENE: WELCOME */}
          {currentSceneType === 'welcome' && (
            <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-700 w-full max-w-5xl mx-auto px-4">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-5 py-2 text-xs sm:text-sm font-bold text-amber-300 tracking-widest uppercase shadow-lg backdrop-blur-md">
                <Sparkles size={16} /> Celebração Oficial
              </span>
              <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-white leading-tight drop-shadow-2xl">
                {event.title}
              </h1>
              <p className="mt-5 text-xl sm:text-2xl md:text-3xl font-light text-amber-100/90 tracking-wide leading-relaxed max-w-3xl">
                {event.description || 'Uma noite inesquecível de celebração, amizade e alegria.'}
              </p>
            </div>
          )}

          {/* 2. SCENE: COUNTDOWN */}
          {currentSceneType === 'countdown' && (
            <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-700 w-full max-w-5xl mx-auto">
              <span className="mb-4 text-sm sm:text-base font-bold tracking-widest text-amber-300 uppercase">
                ✦ CONTAGEM REGRESSIVA OFICIAL ✦
              </span>
              <h2 className="text-3xl sm:text-5xl font-serif font-black text-white mb-8">
                O Grande Momento Aproxima-se
              </h2>
              <div className="grid grid-cols-4 gap-4 sm:gap-8 w-full max-w-3xl">
                {[
                  { label: 'DIAS', val: timeLeft.days },
                  { label: 'HORAS', val: timeLeft.hours },
                  { label: 'MINUTOS', val: timeLeft.minutes },
                  { label: 'SEGUNDOS', val: timeLeft.seconds },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center justify-center rounded-2xl border border-amber-400/30 bg-black/60 p-4 sm:p-6 backdrop-blur-md shadow-2xl"
                  >
                    <span className="font-mono text-4xl sm:text-6xl md:text-7xl font-black text-white">
                      {String(item.val).padStart(2, '0')}
                    </span>
                    <span className="mt-2 text-[10px] sm:text-xs font-bold tracking-widest text-amber-400 uppercase">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. SCENE: QUIZ / LIVE COMPETITION (KAHOOT STYLE) */}
          {currentSceneType === 'quiz' && (
            <div className="w-full max-w-6xl mx-auto h-full flex flex-col justify-between py-2 animate-in fade-in duration-500">
              {/* State A: Lobby waiting room */}
              {(!activeGameSession || activeGameSession.status === 'lobby') && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 my-auto p-8 rounded-3xl bg-black/60 border border-amber-400/30 backdrop-blur-xl">
                  <div className="space-y-4 max-w-xl text-left">
                    <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950 uppercase tracking-widest">
                      QUIZ LIVE INTERATIVO
                    </span>
                    <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
                      Entra com o teu telemóvel!
                    </h2>
                    <p className="text-base sm:text-xl text-neutral-300">
                      Acede a <strong className="text-amber-400 underline">{slug}/join</strong> ou lê o QR Code ao lado.
                    </p>
                    <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 inline-block">
                      <span className="text-xs text-amber-300 uppercase tracking-wider block font-semibold">PIN DA SALA</span>
                      <strong className="text-4xl sm:text-6xl font-mono font-black text-white tracking-widest">
                        {activeGameSession?.pin || '849 201'}
                      </strong>
                    </div>
                    <div className="text-xs text-neutral-400 flex items-center gap-2">
                      <Users size={16} className="text-emerald-400" />
                      <span>{activeGameSession?.participantCount || 0} convidados na sala</span>
                    </div>
                  </div>

                  {qrJoinDataUrl && (
                    <div className="p-4 rounded-3xl bg-white shadow-2xl flex flex-col items-center">
                      <img src={qrJoinDataUrl} alt="QR Code" className="w-48 h-48 sm:w-60 sm:h-60" />
                      <span className="text-[11px] font-bold text-slate-900 mt-2 uppercase tracking-wider">
                        Ler para Participar
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* State B: Question active */}
              {activeGameSession && activeGameSession.status === 'question_active' && activeGameSession.currentQuestion && (
                <div className="space-y-6 my-auto text-center w-full">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Pergunta {activeGameSession.currentQuestion.currentIndex} de {activeGameSession.currentQuestion.totalQuestions}
                    </span>
                    <div className="flex items-center gap-2 text-white font-mono text-2xl font-bold">
                      <Clock size={20} className={questionSecondsRemaining <= 5 ? 'text-rose-500 animate-pulse' : 'text-amber-400'} />
                      <span>{questionSecondsRemaining}s</span>
                    </div>
                  </div>

                  <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-4xl mx-auto leading-tight">
                    {activeGameSession.currentQuestion.title}
                  </h2>

                  {/* 4 Colored Kahoot Answer Choices */}
                  <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto pt-4">
                    {activeGameSession.currentQuestion.options.map((opt, idx) => {
                      const colors = [
                        'bg-red-600/90 border-red-500 text-white',
                        'bg-blue-600/90 border-blue-500 text-white',
                        'bg-amber-500/90 border-amber-400 text-slate-950',
                        'bg-emerald-600/90 border-emerald-500 text-white',
                      ];
                      const symbols = ['▲', '◆', '●', '■'];
                      return (
                        <div
                          key={idx}
                          className={`p-5 sm:p-7 rounded-2xl border-2 font-bold text-xl sm:text-2xl flex items-center gap-4 shadow-xl text-left ${colors[idx % 4]}`}
                        >
                          <span className="text-2xl sm:text-3xl">{symbols[idx % 4]}</span>
                          <span className="truncate">{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* State C: Question ended & Reveal */}
              {activeGameSession && activeGameSession.status === 'question_ended' && activeGameSession.currentQuestion && (
                <div className="space-y-6 my-auto text-center w-full animate-in zoom-in-95">
                  <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 uppercase">
                    RESPOSTA CORRETA
                  </span>
                  <h2 className="text-3xl sm:text-5xl font-black text-white max-w-4xl mx-auto">
                    {activeGameSession.currentQuestion.title}
                  </h2>

                  <div className="p-6 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 max-w-2xl mx-auto text-left">
                    <span className="text-xs text-emerald-300 uppercase font-bold block mb-1">A Opção Correta é:</span>
                    <p className="text-2xl sm:text-3xl font-black text-white">
                      {activeGameSession.currentQuestion.options[Number(activeGameSession.currentQuestion.correctAnswer)] || 'Opção Correta'}
                    </p>
                    {activeGameSession.currentQuestion.explanation && (
                      <p className="text-sm text-neutral-200 mt-2 italic">
                        💡 {activeGameSession.currentQuestion.explanation}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* State D: Podium & Table Battle */}
              {activeGameSession && activeGameSession.status === 'podium' && (
                <div className="space-y-6 my-auto text-center w-full animate-in fade-in zoom-in-95">
                  <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
                    ✦ PÓDIO DE CAMPEÕES & CLASSIFICAÇÃO ✦
                  </span>
                  <h2 className="text-4xl sm:text-6xl font-black text-white">
                    Grandes Vencedores da Noite
                  </h2>

                  <div className="flex items-end justify-center gap-4 sm:gap-6 pt-6 max-w-3xl mx-auto">
                    {/* 2nd Place */}
                    {activeGameSession.topPlayers?.[1] && (
                      <div className="flex flex-col items-center">
                        <span className="text-2xl mb-1">{activeGameSession.topPlayers[1].avatar || '🥈'}</span>
                        <strong className="text-sm sm:text-base text-white truncate max-w-[120px]">
                          {activeGameSession.topPlayers[1].nickname}
                        </strong>
                        <span className="text-xs text-amber-300 font-bold mb-2">
                          {activeGameSession.topPlayers[1].score} pts
                        </span>
                        <div className="w-24 sm:w-32 h-28 sm:h-36 rounded-t-2xl bg-gradient-to-t from-slate-700 to-slate-500 border border-white/20 flex items-center justify-center font-black text-3xl text-white shadow-xl">
                          2º
                        </div>
                      </div>
                    )}

                    {/* 1st Place */}
                    {activeGameSession.topPlayers?.[0] && (
                      <div className="flex flex-col items-center">
                        <span className="text-4xl mb-1 animate-bounce">{activeGameSession.topPlayers[0].avatar || '👑'}</span>
                        <strong className="text-base sm:text-lg text-amber-300 font-bold truncate max-w-[150px]">
                          {activeGameSession.topPlayers[0].nickname}
                        </strong>
                        <span className="text-sm text-amber-400 font-black mb-2">
                          {activeGameSession.topPlayers[0].score} pts
                        </span>
                        <div className="w-28 sm:w-40 h-40 sm:h-52 rounded-t-2xl bg-gradient-to-t from-amber-600 to-amber-400 border border-amber-300 flex items-center justify-center font-black text-4xl text-slate-950 shadow-2xl">
                          1º
                        </div>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {activeGameSession.topPlayers?.[2] && (
                      <div className="flex flex-col items-center">
                        <span className="text-2xl mb-1">{activeGameSession.topPlayers[2].avatar || '🥉'}</span>
                        <strong className="text-sm sm:text-base text-white truncate max-w-[120px]">
                          {activeGameSession.topPlayers[2].nickname}
                        </strong>
                        <span className="text-xs text-amber-300 font-bold mb-2">
                          {activeGameSession.topPlayers[2].score} pts
                        </span>
                        <div className="w-24 sm:w-32 h-20 sm:h-28 rounded-t-2xl bg-gradient-to-t from-amber-900 to-amber-700 border border-white/20 flex items-center justify-center font-black text-3xl text-white shadow-xl">
                          3º
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Table Battle ranking */}
                  {activeGameSession.tableRankings && activeGameSession.tableRankings.length > 0 && (
                    <div className="pt-4 max-w-xl mx-auto">
                      <span className="text-xs text-neutral-400 uppercase tracking-wider block mb-2">
                        🛡️ Batalha das Mesas (Classificação Geral)
                      </span>
                      <div className="flex justify-center gap-3">
                        {activeGameSession.tableRankings.slice(0, 3).map((t, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-xl bg-white/10 border border-white/10 text-xs text-white"
                          >
                            <strong>{t.table}:</strong> <b className="text-amber-400">{t.score} pts</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. SCENE: LIVE POLLS */}
          {currentSceneType === 'poll' && (
            <div className="w-full max-w-4xl mx-auto text-center space-y-6 animate-in fade-in">
              <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
                ✦ VOTAÇÃO EM DIRETO DAS MESAS ✦
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white">
                O que dizem os nossos convidados?
              </h2>

              <div className="space-y-4 pt-4">
                {interactions?.polls && interactions.polls.length > 0 ? (
                  interactions.polls.map((p, idx) => {
                    const totalVotes = interactions.polls?.reduce((acc, curr) => acc + curr.votes, 0) || 1;
                    const pct = Math.round((p.votes / totalVotes) * 100);
                    return (
                      <div key={idx} className="p-4 rounded-2xl bg-black/60 border border-white/10 text-left space-y-2">
                        <div className="flex justify-between text-sm sm:text-base font-bold text-white">
                          <span>{p.option}</span>
                          <span className="text-amber-400">{pct}% ({p.votes} votos)</span>
                        </div>
                        <div className="w-full h-4 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-neutral-400 italic">A aguardar votos dos participantes...</p>
                )}
              </div>
            </div>
          )}

          {/* 5. SCENE: WORD CLOUD */}
          {currentSceneType === 'wordcloud' && (
            <div className="w-full max-w-5xl mx-auto text-center space-y-6 animate-in fade-in">
              <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
                ✦ NUVEM DE PALAVRAS COLETIVA ✦
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white">
                Como os convidados definem esta noite
              </h2>

              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-8 max-w-4xl mx-auto">
                {interactions?.wordCloud && interactions.wordCloud.length > 0 ? (
                  interactions.wordCloud.map((w, idx) => {
                    const sizes = ['text-xl', 'text-2xl', 'text-4xl', 'text-5xl', 'text-6xl'];
                    const colors = ['text-white', 'text-amber-400', 'text-amber-200', 'text-emerald-300', 'text-amber-300'];
                    const sizeClass = sizes[Math.min(sizes.length - 1, w.count - 1)] || 'text-2xl';
                    const colorClass = colors[idx % colors.length];
                    return (
                      <span
                        key={idx}
                        className={`font-serif font-black tracking-tight ${sizeClass} ${colorClass} drop-shadow-md hover:scale-110 transition duration-300`}
                      >
                        {w.word}
                      </span>
                    );
                  })
                ) : (
                  <p className="text-neutral-400 italic">Envia a tua palavra em /{slug}/join!</p>
                )}
              </div>
            </div>
          )}

          {/* 6. SCENE: ARRIVALS */}
          {currentSceneType === 'arrivals' && (
            <div className="w-full max-w-4xl mx-auto text-center space-y-6 animate-in fade-in">
              <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
                ✦ BOAS-VINDAS AOS RECÉM-CHEGADOS ✦
              </span>
              <h2 className="text-3xl sm:text-5xl font-serif font-bold text-white">
                A nossa celebração está completa!
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
                {recentArrivals.map((g) => (
                  <div
                    key={g.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1 shadow-lg"
                  >
                    <span className="text-xl">✨</span>
                    <strong className="text-sm font-semibold text-white block truncate">{g.name}</strong>
                    <span className="text-[10px] text-amber-300 uppercase tracking-wider">Presente</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentSceneType === 'schedule' && (
            <div className="screen-program">
              <h2>Programa do evento</h2>
              {program.length ? (
                <ul>
                  {program.slice(programPage, programPage + 4).map((item, index) => (
                    <li key={programPage + index}><time dateTime={item.time}>{item.time}</time><strong>{item.title}</strong></li>
                  ))}
                </ul>
              ) : <p>O programa será publicado em breve.</p>}
            </div>
          )}

          {currentSceneType === 'gallery_mural' && (
            <div className="screen-gallery">
              <h2>Galeria do evento</h2>
              {galleryItem ? (
                galleryItem.mime.startsWith('video/') ? (
                  <video key={galleryItem.id} src={`/api/gallery/media/${galleryItem.id}`} muted autoPlay loop playsInline />
                ) : (
                  <img src={`/api/gallery/media/${galleryItem.id}`} alt={`Fotografia de ${galleryItem.uploader || 'convidado'}`} />
                )
              ) : <p>As fotos aprovadas aparecem aqui.</p>}
            </div>
          )}

          {(currentSceneType === 'tribute' || currentSceneType === 'gratitude') && (
            <div className="screen-tribute">
              <h2>{currentSceneType === 'tribute' ? 'Homenagem' : 'Obrigado pela tua presença'}</h2>
              {currentSceneType === 'tribute' && (activeMessage?.text || currentQuote?.quote) ? (
                <blockquote>{activeMessage?.text || currentQuote?.quote}</blockquote>
              ) : <p>{event.title}</p>}
            </div>
          )}
        </section>

        {/* Bottom Bar: Broadcast Ticker Marquee */}
        {settings.broadcastTicker ? (
          <footer className="relative z-10 w-full border-t border-amber-500/40 bg-gradient-to-r from-amber-950/80 via-black/90 to-amber-950/80 py-2.5 px-6 rounded-2xl backdrop-blur-md shadow-2xl flex items-center justify-between overflow-hidden">
            <div className="flex items-center gap-3 shrink-0">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500 text-slate-950">
                NOTÍCIA
              </span>
              <Radio size={14} className="text-amber-400 animate-pulse" />
            </div>
            <div className="overflow-hidden whitespace-nowrap flex-1 ml-4 text-sm md:text-base font-bold text-amber-200">
              <span className="inline-block animate-marquee">
                📢 {settings.broadcastTicker} · Organização do Evento · {event.title}
              </span>
            </div>
          </footer>
        ) : (
          <footer className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 w-full text-xs text-white/60">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              <span>Eventox Live Cinema · Transmissão 16:9</span>
            </div>
            {currentQuote && (
              <p className="hidden md:block italic max-w-xl truncate text-amber-100/70">
                "{currentQuote.quote}" {currentQuote.author && `— ${currentQuote.author}`}
              </p>
            )}
            <div className="font-mono text-[10px] text-neutral-500">
              Sincronizado v{settings.version || 1}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
