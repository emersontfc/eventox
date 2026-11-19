'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Monitor, Play, Pause, AlertTriangle, ExternalLink, RefreshCw,
  CheckCircle2, Clock, Send, Palette, Sparkles, Volume2, Shield,
  Eye, X, Check, Users, MessageSquare, Radio, Maximize2,
  Trophy, HelpCircle, BarChart3, Cloud, Flame, Plus, ChevronRight,
  ChevronLeft, Award, ThumbsUp, ArrowRight, Music, AlertCircle
} from 'lucide-react';
import QRCode from 'qrcode';

interface Scene {
  id: number;
  sceneType: string;
  title: string;
  subtitle?: string | null;
  duration: number;
  position: number;
  isActive: boolean;
}

interface Question {
  id: number;
  orderIndex: number;
  questionType: string;
  title: string;
  options: string[];
  correctAnswer: string;
  timeLimit: number;
  points: number;
  explanation?: string;
}

interface Game {
  id: number;
  title: string;
  description?: string;
  gameType: string;
  questionCount: number;
  questions: Question[];
}

interface GameSession {
  id: number;
  pin: string;
  status: string;
  currentQuestionIndex: number;
  questionStartedAt?: string;
  participantCount: number;
  topPlayers?: Array<{ nickname: string; score: number; avatar?: string; tableNumber?: string }>;
}

export default function LiveStudioDashboard({ slug }: { slug: string }) {
  const [activeTab, setActiveTab] = useState<'monitor' | 'games' | 'interactions' | 'messages'>('monitor');
  const [screenData, setScreenData] = useState<any>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Staging
  const [stagedSceneId, setStagedSceneId] = useState<string>('welcome');
  const [tickerInput, setTickerInput] = useState('');
  const [emergencyText, setEmergencyText] = useState('Atenção a todos os presentes: por favor aguardem instruções da organização.');

  // Game creation modal / form
  const [newGameTitle, setNewGameTitle] = useState('');
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  // Poll creation
  const [pollTitle, setPollTitle] = useState('');
  const [pollOptions, setPollOptions] = useState(['Opção A', 'Opção B', 'Opção C']);

  // Direct Broadcast
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState('honra');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Synthesized Web Audio Test
  const playSoundEffect = (type: 'beep' | 'success' | 'fanfare') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'beep') {
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'fanfare') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.15); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      }
      showToast('🔊 Efeito sonoro emitido com sucesso!');
    } catch {
      showToast('Áudio não suportado neste navegador.');
    }
  };

  // Load screen state, games and messages
  const loadStudioState = useCallback(async () => {
    try {
      const [screenRes, gamesRes, msgRes] = await Promise.all([
        fetch(`/api/screen/${slug}`, { cache: 'no-store' }),
        fetch(`/api/games/${slug}`, { cache: 'no-store' }),
        fetch(`/api/screen/${slug}/messages`, { cache: 'no-store' }),
      ]);

      if (screenRes.ok) {
        const sData = (await screenRes.json()) as any;
        setScreenData(sData);
        if (sData.settings?.stagedSceneId) {
          setStagedSceneId(sData.settings.stagedSceneId);
        }
      }

      if (gamesRes.ok) {
        const gData = (await gamesRes.json()) as any;
        setGames(gData.games || []);
        setActiveSession(gData.activeSession || null);
      }

      if (msgRes.ok) {
        const mData = (await msgRes.json()) as any;
        setMessages(mData.messages || []);
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao sincronizar com o Estúdio Live');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Connect SSE stream for instant updates
  useEffect(() => {
    loadStudioState();

    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource(`/api/screen/${slug}/stream`);
      eventSource.addEventListener('update', () => {
        loadStudioState();
      });

      eventSource.onerror = () => {
        if (!fallbackInterval) {
          fallbackInterval = setInterval(loadStudioState, 4000);
        }
      };
    } catch {
      fallbackInterval = setInterval(loadStudioState, 4000);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [slug, loadStudioState]);

  // 1. Scene Switchers
  const handlePublishScene = async (sceneId: string) => {
    try {
      const res = await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-scene', sceneId }),
      });
      if (!res.ok) throw new Error('Falha ao publicar cena');
      showToast(`🚀 Cena "${sceneId.toUpperCase()}" enviada para o ecrã com sucesso!`);
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStageScene = async (sceneId: string) => {
    setStagedSceneId(sceneId);
    try {
      await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stage-scene', sceneId }),
      });
      showToast(`Cena "${sceneId}" preparada no Estúdio. Clica em "Enviar para o Ar" quando pronto.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handlePublishStaged = async () => {
    try {
      const res = await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish-staged' }),
      });
      if (!res.ok) throw new Error('Falha ao enviar cena preparada');
      showToast('🌟 Cena preparada agora está NO AR na TV!');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleTogglePause = async () => {
    try {
      const res = await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-pause' }),
      });
      const data = (await res.json()) as any;
      showToast(data.isPaused ? '⏸️ Rotação congelada nesta cena' : '▶️ Rotação automática retomada');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleNextScene = async () => {
    try {
      await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next-scene' }),
      });
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handlePrevScene = async () => {
    try {
      await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prev-scene' }),
      });
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 2. Broadcast Marquee Ticker
  const handleSendTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tickerInput.trim()) return;

    try {
      await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'broadcast-ticker',
          tickerText: tickerInput.trim(),
          tickerSender: 'Organização',
        }),
      });
      showToast('📢 Ticker dourado transmitido no rodapé do ecrã!');
      setTickerInput('');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleClearTicker = async () => {
    try {
      await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-ticker' }),
      });
      showToast('Ticker removido do ecrã.');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 3. Emergency Mode
  const handleToggleEmergency = async (active: boolean) => {
    try {
      await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-emergency',
          emergencyMode: active,
          emergencyMessage: emergencyText,
        }),
      });
      showToast(active ? '🚨 MODO DE EMERGÊNCIA ATIVADO NA TV!' : 'Modo de emergência desativado');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 4. Live Quiz Engine Handlers
  const handleCreateGame = async () => {
    try {
      const res = await fetch(`/api/games/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-game',
          title: newGameTitle.trim() || 'Super Quiz da Celebração',
          gameType: 'quiz',
        }),
      });
      if (!res.ok) throw new Error('Falha ao criar jogo');
      showToast('🎮 Novo jogo criado com perguntas modelo!');
      setIsCreatingGame(false);
      setNewGameTitle('');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStartSession = async (gameId: number) => {
    try {
      const res = await fetch(`/api/games/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-session', gameId }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Falha ao iniciar sala');
      showToast(`🎯 Sala de Quiz aberta com PIN ${data.session.pin}! A TV agora está em Modo Lobby.`);
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStartQuestion = async (sessionId: number, qIdx: number) => {
    try {
      await fetch(`/api/games/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-question', sessionId, questionIndex: qIdx }),
      });
      showToast(`⏱️ Pergunta ${qIdx + 1} iniciada! Os convidados já podem responder no telemóvel.`);
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRevealAnswer = async (sessionId: number) => {
    try {
      await fetch(`/api/games/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reveal-answer', sessionId }),
      });
      showToast('📊 Resposta correta revelada no ecrã com estatísticas!');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleShowPodium = async (sessionId: number) => {
    try {
      await fetch(`/api/games/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'show-podium', sessionId }),
      });
      showToast('🏆 Pódio de Campeões e Batalha das Mesas projetados no ecrã!');
      playSoundEffect('fanfare');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEndSession = async (sessionId: number) => {
    try {
      await fetch(`/api/games/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end-session', sessionId }),
      });
      showToast('Jogo concluído. O ecrã regressou à rotação normal.');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSimulatePlayers = async (sessionId: number) => {
    try {
      const res = await fetch(`/api/games/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate-players', sessionId }),
      });
      const data = (await res.json()) as any;
      showToast(`🧪 ${data.simulatedCount} convidados virtuais adicionados para ensaio!`);
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 5. Interactions Handlers (Polls & Word Cloud)
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollTitle.trim()) return;

    try {
      await fetch(`/api/games/${slug}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-poll',
          pollTitle: pollTitle.trim(),
          pollOptions: pollOptions.filter(o => o.trim()),
        }),
      });
      showToast('📊 Votação ao vivo criada e projetada no ecrã!');
      setPollTitle('');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleModerateInteraction = async (id: number, status: 'aprovado' | 'rejeitado' | 'exibido') => {
    try {
      await fetch(`/api/games/${slug}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'moderate', id, status }),
      });
      showToast(`Item ${status === 'aprovado' ? 'aprovado' : status === 'exibido' ? 'projetado' : 'rejeitado'}!`);
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // 6. Direct Message Moderation
  const handleModerateMessage = async (messageId: number, status: 'aprovado' | 'exibido' | 'cancelado') => {
    try {
      await fetch(`/api/screen/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'moderate', messageId, status }),
      });
      showToast(`Mensagem ${status === 'exibido' ? 'projetada no ecrã' : status}!`);
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSendDirectAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    try {
      await fetch(`/api/screen/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          text: broadcastText.trim(),
          category: broadcastCategory,
          status: 'exibido',
        }),
      });
      showToast('✨ Anúncio de honra projetado no ecrã!');
      setBroadcastText('');
      loadStudioState();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const currentScene = screenData?.settings?.activeSceneId || 'welcome';
  const isPaused = Boolean(screenData?.settings?.isPaused || screenData?.settings?.holdScene);
  const isEmergency = Boolean(screenData?.settings?.emergencyMode);
  const tickerText = screenData?.settings?.broadcastTicker;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-2xl shadow-amber-500/30 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}

      {/* Top Command Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-white/10 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Monitor size={24} />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Estúdio Live 16:9</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Sincronizado v{screenData?.settings?.version || 1}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Cena no ar: <strong className="text-amber-400 uppercase">{currentScene}</strong> ·{' '}
              {isPaused ? '⏸️ Congelado' : '▶️ Rotação ativa'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.open(`/${slug}/screen`, '_blank')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs tracking-wide uppercase transition shadow-lg shadow-amber-500/20 cursor-pointer"
            title="Abrir Ecrã 16:9 em Nova Janela para Ligar à TV"
          >
            <ExternalLink size={15} /> Abrir Ecrã na TV ↗
          </button>

          <button
            onClick={() => playSoundEffect('beep')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-neutral-300 transition cursor-pointer"
            title="Testar saída de áudio do estúdio"
          >
            <Volume2 size={14} className="text-amber-400" /> Teste Som
          </button>

          <button
            onClick={() => handleToggleEmergency(!isEmergency)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              isEmergency
                ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'
            }`}
          >
            <AlertTriangle size={14} /> {isEmergency ? 'Desativar Alerta' : 'Alerta / Emergência'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'monitor', label: '📺 Monitor & Linha Temporal', icon: Monitor },
          { id: 'games', label: '🎮 Quiz Live & Competição', icon: Trophy, badge: activeSession ? 'SALA ATIVA' : null },
          { id: 'interactions', label: '📊 Votações & Nuvem', icon: BarChart3 },
          { id: 'messages', label: '💌 Dedicatórias & Anúncios', icon: MessageSquare, count: messages.filter(m => m.status === 'pendente').length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-slate-950 font-bold animate-pulse">
                  {tab.badge}
                </span>
              )}
              {Boolean(tab.count) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: MONITOR & TIMELINE */}
      {activeTab === 'monitor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: 16:9 Mirror View & Staging */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl bg-slate-900 border border-white/10 p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  Pré-visualização 16:9 em Tempo Real (NO AR)
                </span>
                <span className="text-xs text-amber-400 font-mono">
                  {screenData?.event?.title || 'Eventox'} · {currentScene.toUpperCase()}
                </span>
              </div>

              {/* 16:9 Canvas Mirror Preview */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-white/10 flex flex-col justify-between p-6 shadow-2xl">
                {/* Background glow */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(217,119,6,0.15),transparent_70%)] pointer-events-none" />

                {/* Top header preview */}
                <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400" />
                    <span className="text-xs font-serif tracking-widest text-amber-200 uppercase">
                      {screenData?.event?.hostName || 'ANFITRIÃO'}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-neutral-300">
                    Sincronizado
                  </span>
                </div>

                {/* Center content preview based on active scene */}
                <div className="relative z-10 text-center my-auto py-4">
                  {currentScene === 'welcome' && (
                    <div className="space-y-2 animate-in fade-in">
                      <p className="text-[10px] tracking-widest text-amber-400 uppercase">✦ SEJAM BEM-VINDOS ✦</p>
                      <h3 className="text-2xl font-serif font-bold text-white tracking-tight">
                        {screenData?.event?.title || 'Celebração Oficial'}
                      </h3>
                      <p className="text-xs text-neutral-400">{screenData?.event?.venue}</p>
                    </div>
                  )}

                  {currentScene === 'countdown' && (
                    <div className="space-y-2 animate-in fade-in">
                      <p className="text-[10px] text-amber-400 uppercase tracking-widest">CONTAGEM REGRESSIVA OFICIAL</p>
                      <div className="flex justify-center gap-3 text-white font-mono text-xl font-bold">
                        <div className="p-2 rounded bg-white/5 border border-white/10">02<span className="text-[8px] block text-neutral-400">DIAS</span></div>
                        <div className="p-2 rounded bg-white/5 border border-white/10">14<span className="text-[8px] block text-neutral-400">HORAS</span></div>
                        <div className="p-2 rounded bg-white/5 border border-white/10">35<span className="text-[8px] block text-neutral-400">MIN</span></div>
                      </div>
                    </div>
                  )}

                  {currentScene === 'quiz' && (
                    <div className="space-y-2 animate-in fade-in">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold">
                        MODO JOGO AO VIVO
                      </span>
                      <h4 className="text-lg font-bold text-white">
                        {activeSession ? `PIN DA SALA: ${activeSession.pin}` : 'Quiz Interativo dos Convidados'}
                      </h4>
                      <p className="text-xs text-neutral-400">
                        {activeSession?.participantCount || 0} participantes ligados pelo telemóvel
                      </p>
                    </div>
                  )}

                  {currentScene === 'poll' && (
                    <div className="space-y-2 animate-in fade-in">
                      <span className="text-[10px] text-amber-400 uppercase tracking-widest">VOTAÇÃO EM DIRETO</span>
                      <h4 className="text-lg font-bold text-white">Resultados das Votações</h4>
                      <p className="text-xs text-neutral-400">A acompanhar escolhas das mesas em tempo real</p>
                    </div>
                  )}

                  {currentScene === 'wordcloud' && (
                    <div className="space-y-2 animate-in fade-in">
                      <span className="text-[10px] text-amber-400 uppercase tracking-widest">NUVEM DE PALAVRAS</span>
                      <h4 className="text-lg font-bold text-white">Dedicatórias em Palavras</h4>
                      <div className="flex flex-wrap justify-center gap-2 text-xs">
                        <span className="text-amber-400 text-sm font-bold">Sucesso</span>
                        <span className="text-white text-xs">Orgulho</span>
                        <span className="text-emerald-400 text-base font-bold">Exemplo</span>
                        <span className="text-amber-300 text-xs">Brilhante</span>
                      </div>
                    </div>
                  )}

                  {!['welcome', 'countdown', 'quiz', 'poll', 'wordcloud'].includes(currentScene) && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-amber-400 uppercase">{currentScene}</p>
                      <h4 className="text-xl font-bold text-white capitalize">{currentScene.replace('_', ' ')}</h4>
                      <p className="text-xs text-neutral-400">A exibir conteúdo multimédia selecionado</p>
                    </div>
                  )}
                </div>

                {/* Bottom ticker preview */}
                <div className="relative z-10 border-t border-white/10 pt-2 flex items-center justify-between text-[11px] text-neutral-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <Radio size={12} className="text-emerald-400" />
                    <span className="truncate">
                      {tickerText ? (
                        <strong className="text-amber-300 font-normal">📢 {tickerText}</strong>
                      ) : (
                        'Transmissão Eventox 2.0 HD'
                      )}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-neutral-500">16:9 1080p</span>
                </div>
              </div>

              {/* Playback & Staging Deck */}
              <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevScene}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white cursor-pointer"
                    title="Cena Anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleTogglePause}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      isPaused
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    {isPaused ? <Play size={14} /> : <Pause size={14} />}
                    {isPaused ? 'Retomar Rotação' : 'Congelar Cena'}
                  </button>
                  <button
                    onClick={handleNextScene}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white cursor-pointer"
                    title="Próxima Cena"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Staging GO LIVE */}
                <div className="flex items-center gap-2">
                  <select
                    value={stagedSceneId}
                    onChange={(e) => handleStageScene(e.target.value)}
                    className="rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-xs text-white"
                  >
                    <option value="welcome">Rascunho: Boas-vindas</option>
                    <option value="countdown">Rascunho: Contagem Regressiva</option>
                    <option value="arrivals">Rascunho: Chegadas</option>
                    <option value="schedule">Rascunho: Programa</option>
                    <option value="quiz">Rascunho: Quiz Live</option>
                    <option value="poll">Rascunho: Votação Live</option>
                    <option value="wordcloud">Rascunho: Nuvem de Palavras</option>
                    <option value="gallery_mural">Rascunho: Galeria Mural</option>
                  </select>

                  <button
                    onClick={handlePublishStaged}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wide transition cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <Radio size={14} /> Enviar para o Ar
                  </button>
                </div>
              </div>
            </div>

            {/* Breaking News Ticker Dispatcher */}
            <div className="rounded-2xl bg-slate-900 border border-white/10 p-4">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>📢 Ticker de Rodapé (Notícia / Alerta Marquee)</span>
                {tickerText && (
                  <button
                    onClick={handleClearTicker}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Limpar Ticker Atual
                  </button>
                )}
              </h4>
              <form onSubmit={handleSendTicker} className="flex gap-2">
                <input
                  type="text"
                  value={tickerInput}
                  onChange={(e) => setTickerInput(e.target.value)}
                  placeholder="Ex: Jantar servido na Sala Principal · Brinde com os noivos às 21h..."
                  className="flex-1 rounded-xl bg-slate-950 border border-white/15 px-4 py-2 text-xs text-white placeholder-neutral-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Transmitir
                </button>
              </form>
            </div>
          </div>

          {/* Right: Scene Library & Direct Triggers */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl bg-slate-900 border border-white/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Palette size={16} className="text-amber-400" />
                  Biblioteca de Cenas do Ecrã
                </h3>
                <span className="text-[11px] text-neutral-400">1 toque = NO AR</span>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'welcome', title: 'Boas-vindas Oficial', desc: 'Monograma, anfitrião e dados do evento' },
                  { id: 'countdown', title: 'Contagem Regressiva', desc: 'Relógio sincronizado para abertura ou brinde' },
                  { id: 'arrivals', title: 'Boas-vindas aos Recém-Chegados', desc: 'Nomes dos convidados após check-in' },
                  { id: 'quiz', title: 'Quiz Live Interativo', desc: 'Competição Kahoot com PIN e pódio' },
                  { id: 'poll', title: 'Votações & Sondagens', desc: 'Gráficos de barras ao vivo das mesas' },
                  { id: 'wordcloud', title: 'Nuvem de Palavras', desc: 'Dedicatórias em palavras agregadas' },
                  { id: 'gallery_mural', title: 'Mural de Fotografias', desc: 'Slideshow dinâmico das fotos aprovadas' },
                  { id: 'schedule', title: 'Programa & Momentos', desc: 'Linha temporal do cocktail ao corte do bolo' },
                  { id: 'tribute', title: 'Homenagem Especial', desc: 'Momento solene com foto e citação' },
                  { id: 'gratitude', title: 'Agradecimento & Encerramento', desc: 'Mensagem final de carinho aos convidados' },
                ].map((s) => {
                  const isCurrent = currentScene === s.id;
                  const isStaged = stagedSceneId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border transition flex items-center justify-between ${
                        isCurrent
                          ? 'bg-amber-500/15 border-amber-500/40 text-white'
                          : 'bg-white/5 border-white/5 text-neutral-300 hover:border-white/15'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs">{s.title}</strong>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500 text-white font-bold animate-pulse">
                              NO AR
                            </span>
                          )}
                          {isStaged && !isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                              PRONTO
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400">{s.desc}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleStageScene(s.id)}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-neutral-300 cursor-pointer"
                        >
                          Preparar
                        </button>
                        <button
                          onClick={() => handlePublishScene(s.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                            isCurrent
                              ? 'bg-white/10 text-neutral-400 cursor-default'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          }`}
                        >
                          Lançar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE QUIZ & KAHOOT ENGINE */}
      {activeTab === 'games' && (
        <div className="space-y-6">
          {/* Active Session Controller Banner */}
          {activeSession ? (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 text-white shadow-xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 animate-pulse">
                      SALA DE JOGO ATIVA
                    </span>
                    <span className="text-xs text-neutral-400">Status: {activeSession.status.toUpperCase()}</span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tight text-white mt-1">
                    PIN DE ACESSO: <span className="text-amber-400 font-mono tracking-widest">{activeSession.pin}</span>
                  </h3>
                  <p className="text-xs text-neutral-300 mt-1">
                    Convidados entram através de <strong className="text-white underline">/{slug}/join</strong> ou apontando a câmara para o QR Code da TV.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleSimulatePlayers(activeSession.id)}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-neutral-200 font-semibold cursor-pointer"
                    title="Simular 10 jogadores virtuais para testar pódio e resposta"
                  >
                    🧪 Simular 10 Participantes
                  </button>
                  <button
                    onClick={() => handleShowPodium(activeSession.id)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wide cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    🏆 Exibir Pódio & Batalha de Mesas
                  </button>
                  <button
                    onClick={() => handleEndSession(activeSession.id)}
                    className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer"
                  >
                    Encerrar Sala
                  </button>
                </div>
              </div>

              {/* Connected Players Bar */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <Users size={14} className="text-emerald-400" />
                    Jogadores Conectados ({activeSession.participantCount})
                  </span>
                  <span className="text-[11px] text-neutral-400">Classificação atualizada pelo servidor</span>
                </div>

                {activeSession.topPlayers && activeSession.topPlayers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeSession.topPlayers.map((p, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white"
                      >
                        <span>{p.avatar || '🎉'}</span>
                        <strong>{p.nickname}</strong>
                        {p.tableNumber && <small className="text-neutral-400">Mesa {p.tableNumber}</small>}
                        <b className="text-amber-400">{p.score} pts</b>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">
                    A aguardar primeiros jogadores entrarem com o PIN... Clica em "Simular 10 Participantes" para testar agora!
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-900 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy size={20} className="text-amber-400" />
                  Pronto para Iniciar o Quiz Live?
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Ao abrir a sala, o ecrã 16:9 mostra o PIN grande e o QR Code de entrada instantânea.
                </p>
              </div>

              {games.length > 0 ? (
                <button
                  onClick={() => handleStartSession(games[0].id)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide uppercase transition shadow-xl shadow-amber-500/25 cursor-pointer"
                >
                  🚀 Iniciar Sala de Quiz (PIN ao Vivo)
                </button>
              ) : (
                <button
                  onClick={handleCreateGame}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs uppercase cursor-pointer"
                >
                  + Criar Quiz da Celebração
                </button>
              )}
            </div>
          )}

          {/* Questions Controller */}
          {games.map((g) => (
            <div key={g.id} className="rounded-2xl bg-slate-900 border border-white/10 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h4 className="text-base font-bold text-white">{g.title}</h4>
                  <p className="text-xs text-neutral-400">{g.description} · {g.questions.length} Perguntas</p>
                </div>
                {!activeSession && (
                  <button
                    onClick={() => handleStartSession(g.id)}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs uppercase cursor-pointer"
                  >
                    Iniciar com Este Jogo
                  </button>
                )}
              </div>

              {/* Question list */}
              <div className="space-y-3">
                {g.questions.map((q, idx) => {
                  const isCurrentActive =
                    activeSession &&
                    activeSession.currentQuestionIndex === idx &&
                    activeSession.status === 'question_active';
                  const isCurrentEnded =
                    activeSession &&
                    activeSession.currentQuestionIndex === idx &&
                    activeSession.status === 'question_ended';

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border transition ${
                        isCurrentActive
                          ? 'bg-amber-500/15 border-amber-500 text-white'
                          : isCurrentEnded
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                          : 'bg-white/5 border-white/5 text-neutral-300'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-amber-400">
                              {idx + 1}
                            </span>
                            <strong className="text-sm font-semibold">{q.title}</strong>
                            {isCurrentActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                                A DECORRER NO ECRÃ (20s)
                              </span>
                            )}
                            {isCurrentEnded && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-slate-950 font-bold">
                                RESPOSTA REVELADA
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-neutral-400 ml-8">
                            {q.options.map((opt, oIdx) => (
                              <span
                                key={oIdx}
                                className={`px-2 py-0.5 rounded ${
                                  String(oIdx) === String(q.correctAnswer)
                                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                                    : 'bg-white/5'
                                }`}
                              >
                                {oIdx === 0 && '🔴 '}
                                {oIdx === 1 && '🔷 '}
                                {oIdx === 2 && '🟡 '}
                                {oIdx === 3 && '🟩 '}
                                {opt}
                              </span>
                            ))}
                          </div>
                        </div>

                        {activeSession && (
                          <div className="flex items-center gap-2 self-end md:self-auto">
                            <button
                              onClick={() => handleStartQuestion(activeSession.id, idx)}
                              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase cursor-pointer"
                            >
                              ▶️ Lançar Pergunta
                            </button>
                            <button
                              onClick={() => handleRevealAnswer(activeSession.id)}
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-neutral-200 cursor-pointer"
                            >
                              👁️ Revelar Resposta
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: LIVE POLLS & WORD CLOUD */}
      {activeTab === 'interactions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Live Poll Builder */}
          <div className="rounded-2xl bg-slate-900 border border-white/10 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 size={18} className="text-amber-400" />
              Criar Votação / Sondagem Live
            </h3>
            <p className="text-xs text-neutral-400">
              Cria uma votação rápida e projeta os resultados instantaneamente na tela grande.
            </p>

            <form onSubmit={handleCreatePoll} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-300 block mb-1">Pergunta da Votação</label>
                <input
                  type="text"
                  value={pollTitle}
                  onChange={(e) => setPollTitle(e.target.value)}
                  placeholder="Ex: Qual foi a melhor sobremesa servida?"
                  className="w-full rounded-xl bg-slate-950 border border-white/15 px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-300 block">Opções de Resposta</label>
                {pollOptions.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const updated = [...pollOptions];
                      updated[i] = e.target.value;
                      setPollOptions(updated);
                    }}
                    placeholder={`Opção ${i + 1}`}
                    className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-xs text-white"
                  />
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide cursor-pointer"
              >
                Lançar Votação para a TV
              </button>
            </form>
          </div>

          {/* Word Cloud & Q&A Moderation */}
          <div className="rounded-2xl bg-slate-900 border border-white/10 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cloud size={18} className="text-amber-400" />
              Nuvem de Palavras & Moderação
            </h3>
            <p className="text-xs text-neutral-400">
              Palavras submetidas pelos convidados via telemóvel para a Nuvem de Palavras.
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {screenData?.interactions?.wordCloud && screenData.interactions.wordCloud.length > 0 ? (
                screenData.interactions.wordCloud.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-white">
                      "{item.word}" <b className="text-amber-400">({item.count}x)</b>
                    </span>
                    <button
                      onClick={() => handlePublishScene('wordcloud')}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                    >
                      Projetar Nuvem
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-500 italic p-4 text-center">
                  Ainda não foram submetidas palavras. Os convidados podem submeter em /{slug}/join.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GUESTBOOK MESSAGES & ANNOUNCEMENTS */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Direct Announcement Form */}
          <div className="md:col-span-5 rounded-2xl bg-slate-900 border border-white/10 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Send size={16} className="text-amber-400" />
              Anúncio Imediato de Honra
            </h3>
            <p className="text-xs text-neutral-400">
              Projeta um cartão comemorativo ou de honra diretamente no ecrã 16:9.
            </p>

            <form onSubmit={handleSendDirectAnnouncement} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-300 block mb-1">Categoria de Honra</label>
                <select
                  value={broadcastCategory}
                  onChange={(e) => setBroadcastCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white"
                >
                  <option value="honra">Homenagem Especial</option>
                  <option value="casal">Dedicatória ao Casal</option>
                  <option value="familia">Mensagem da Família</option>
                  <option value="equipa">Agradecimento à Equipa</option>
                  <option value="personalizado">Aviso Geral</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-300 block mb-1">Texto da Mensagem</label>
                <textarea
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  rows={4}
                  placeholder="Ex: Em nome de toda a comissão, parabéns ao nosso anfitrião por esta conquista extraordinária!"
                  className="w-full rounded-xl bg-slate-950 border border-white/15 p-3 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide cursor-pointer"
              >
                Projetar no Ecrã Agora
              </button>
            </form>
          </div>

          {/* Messages Queue */}
          <div className="md:col-span-7 rounded-2xl bg-slate-900 border border-white/10 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Fila de Dedicatórias dos Convidados</span>
              <span className="text-xs text-neutral-400 font-normal">
                {messages.length} mensagens registadas
              </span>
            </h3>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {messages.length > 0 ? (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300">
                          {m.category}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          Status: <strong>{m.status}</strong>
                        </span>
                      </div>
                      <p className="text-white text-xs leading-relaxed">"{m.text}"</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.status !== 'exibido' && (
                        <button
                          onClick={() => handleModerateMessage(m.id, 'exibido')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          Exibir
                        </button>
                      )}
                      {m.status === 'pendente' && (
                        <button
                          onClick={() => handleModerateMessage(m.id, 'cancelado')}
                          className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] cursor-pointer"
                        >
                          Rejeitar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-500 italic text-center p-6">
                  Nenhuma mensagem na fila.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
