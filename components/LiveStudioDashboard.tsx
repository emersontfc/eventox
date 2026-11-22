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

const sceneLibrary = [
  { id: 'welcome', title: 'Boas-vindas', desc: 'Nome, anfitrião e local do evento' },
  { id: 'countdown', title: 'Contagem regressiva', desc: 'Contagem até à hora do evento' },
  { id: 'arrivals', title: 'Chegadas', desc: 'Convidados com entrada registada' },
  { id: 'schedule', title: 'Programa', desc: 'Momentos publicados no convite' },
  { id: 'quiz', title: 'Quiz Live', desc: 'Sala, perguntas e pódio' },
  { id: 'poll', title: 'Votação', desc: 'Resultados em tempo real' },
  { id: 'wordcloud', title: 'Nuvem de palavras', desc: 'Palavras enviadas pelo público' },
  { id: 'gallery_mural', title: 'Galeria', desc: 'Fotos e vídeos aprovados' },
  { id: 'tribute', title: 'Homenagem', desc: 'Dedicatória ou citação do evento' },
  { id: 'gratitude', title: 'Encerramento', desc: 'Mensagem final para os convidados' },
];

const sceneTitle = (id: string) => sceneLibrary.find(scene => scene.id === id)?.title || id.replaceAll('_', ' ');

async function studioRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'A operação falhou. Tenta novamente.');
  }
  return response;
}

function StudioPreview({ slug }: { slug: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const frame = viewport.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1280));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="studio-preview-frame" ref={viewport}>
      <iframe title="Prévia do ecrã em direto" src={`/${encodeURIComponent(slug)}/screen?preview=1`}
        width={1280} height={720} style={{ transform: `scale(${scale})` }} />
    </div>
  );
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
  const [stagedSceneId, setStagedSceneId] = useState('');
  const [sceneBusy, setSceneBusy] = useState(false);
  const [syncMode, setSyncMode] = useState<'connecting' | 'live' | 'polling'>('connecting');
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
        setStagedSceneId(sData.settings?.stagedSceneId || '');
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

      if (!screenRes.ok) throw new Error('Não foi possível sincronizar o ecrã.');
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
      eventSource.onopen = () => {
        setSyncMode('live');
        if (fallbackInterval) clearInterval(fallbackInterval);
        fallbackInterval = null;
      };
      eventSource.addEventListener('update', () => {
        loadStudioState();
      });

      eventSource.onerror = () => {
        setSyncMode('polling');
        if (!fallbackInterval) {
          fallbackInterval = setInterval(loadStudioState, 4000);
        }
      };
    } catch {
      setSyncMode('polling');
      fallbackInterval = setInterval(loadStudioState, 4000);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [slug, loadStudioState]);

  async function changeScene(action: 'set-scene' | 'stage-scene' | 'publish-staged', sceneId?: string) {
    setSceneBusy(true);
    setError(null);
    try {
      await studioRequest(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sceneId }),
      });
      if (action === 'stage-scene') {
        setStagedSceneId(sceneId ?? '');
        showToast(`${sceneTitle(sceneId ?? '')} preparada.`);
      } else {
        if (action === 'publish-staged') setStagedSceneId('');
        showToast(`${sceneTitle(sceneId ?? stagedSceneId)} enviada para o ecrã.`);
      }
      await loadStudioState();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar a cena.');
    } finally {
      setSceneBusy(false);
    }
  }

  const handleStageScene = (id: string) => changeScene('stage-scene', id);
  const handlePublishScene = (id: string) => changeScene('set-scene', id);
  const handlePublishStaged = () => changeScene('publish-staged');

  const handleTogglePause = async () => {
    try {
      const res = await studioRequest(`/api/screen/${slug}`, {
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
      await studioRequest(`/api/screen/${slug}`, {
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
      await studioRequest(`/api/screen/${slug}`, {
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
      await studioRequest(`/api/screen/${slug}`, {
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
      await studioRequest(`/api/screen/${slug}`, {
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
    if (active && !window.confirm('Mostrar o alerta de emergência em todos os ecrãs do evento?')) return;
    try {
      await studioRequest(`/api/screen/${slug}`, {
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
      const res = await studioRequest(`/api/games/${slug}`, {
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
      const res = await studioRequest(`/api/games/${slug}`, {
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
      await studioRequest(`/api/games/${slug}`, {
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
      await studioRequest(`/api/games/${slug}`, {
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
      await studioRequest(`/api/games/${slug}`, {
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
      await studioRequest(`/api/games/${slug}`, {
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
      const res = await studioRequest(`/api/games/${slug}`, {
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
      await studioRequest(`/api/games/${slug}/interactions`, {
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
      await studioRequest(`/api/games/${slug}/interactions`, {
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
      await studioRequest(`/api/screen/${slug}/messages`, {
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
      await studioRequest(`/api/screen/${slug}/messages`, {
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
    <div className="studio-workspace space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div className="studio-toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}

      <header className="studio-header">
        <div className="studio-heading">
          <span className="studio-heading-icon"><Monitor size={23} aria-hidden="true" /></span>
          <div>
            <h1>Estúdio Live</h1>
            <p>{screenData?.event?.title || 'Controlo do ecrã do evento'}</p>
          </div>
        </div>
        <div className="studio-header-actions">
          <button type="button" className="studio-control" onClick={() => { setError(null); void loadStudioState(); }}>
            <RefreshCw size={16} /> Atualizar
          </button>
          <a className="studio-control studio-accent" href={`/${slug}/screen`} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={17} /> Abrir ecrã
          </a>
        </div>
      </header>
      <div className="studio-status-row">
        <span className="studio-sync" data-connected={syncMode === 'live'} aria-live="polite">
          {loading ? 'A ligar…' : !screenData ? 'Ecrã indisponível' : syncMode === 'live' ? 'Ligação em direto' : 'Atualização periódica'}
        </span>
        {screenData && <span>No ar <strong>{sceneTitle(currentScene)}</strong></span>}
        {screenData && <span>{isPaused ? 'Rotação em pausa' : screenData.settings?.autoRotate === false ? 'Rotação manual' : 'Rotação ativa'}</span>}
        {isEmergency && <strong className="studio-alert-state">Alerta ativo</strong>}
      </div>
      {error && (
        <div role="alert" className="studio-error">
          <AlertTriangle size={18} /><span>{error}</span>
          <button type="button" aria-label="Fechar erro" onClick={() => setError(null)}><X size={18} /></button>
        </div>
      )}
      <nav className="studio-tabs" aria-label="Secções do Estúdio Live">
        {([
          { id: 'monitor', label: 'Monitor', icon: Monitor },
          { id: 'games', label: 'Quiz', icon: Trophy, count: activeSession ? 'Ativo' : '' },
          { id: 'interactions', label: 'Interações', icon: BarChart3 },
          { id: 'messages', label: 'Mensagens', icon: MessageSquare, count: messages.filter(m => m.status === 'pendente').length || '' },
        ] as const).map(({ id, label, icon: Icon, ...meta }) => (
          <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}>
            <Icon size={17} aria-hidden="true" />{label}
            {'count' in meta && meta.count && <b>{meta.count}</b>}
          </button>
        ))}
      </nav>

      {/* TAB 1: MONITOR & TIMELINE */}
      {activeTab === 'monitor' && (
        <div className="studio-monitor-grid">
          {/* Left: 16:9 Mirror View & Staging */}
          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl bg-slate-900 border border-white/10 p-4 shadow-xl">
              <div className="studio-panel-heading">
                <h2>Prévia da transmissão</h2>
                <span>{sceneTitle(currentScene)} · 16:9</span>
              </div>
              <StudioPreview slug={slug} />

              {/* Playback & Staging Deck */}
              <div className="studio-playback">
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
                <div className="studio-stage-actions">
                  <select
                    aria-label="Cena a preparar"
                    value={stagedSceneId}
                    disabled={sceneBusy}
                    onChange={event => handleStageScene(event.target.value)}
                    className="rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-xs text-white"
                  >
                    <option value="" disabled>Preparar cena</option>
                    {sceneLibrary.map(scene => <option value={scene.id} key={scene.id}>{scene.title}</option>)}
                  </select>

                  <button
                    disabled={sceneBusy || !stagedSceneId}
                    onClick={handlePublishStaged}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wide transition cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <Radio size={14} /> Enviar para o ar
                  </button>
                </div>
              </div>
            </div>

            {/* Breaking News Ticker Dispatcher */}
            <div className="rounded-2xl bg-slate-900 border border-white/10 p-4">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Mensagem no rodapé</span>
                {tickerText && (
                  <button
                    onClick={handleClearTicker}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Limpar Ticker Atual
                  </button>
                )}
              </h4>
              <form onSubmit={handleSendTicker} className="studio-inline-form">
                <input
                  type="text"
                  aria-label="Mensagem no rodapé"
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
          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl bg-slate-900 border border-white/10 p-4">
              <div className="studio-panel-heading"><h2>Cenas disponíveis</h2></div>
              <div className="space-y-2">
                {sceneLibrary.map((s) => {
                  const isCurrent = currentScene === s.id;
                  const isStaged = stagedSceneId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`studio-scene p-3 rounded-xl border transition ${
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

                      <div className="studio-scene-actions">
                        <button
                          disabled={sceneBusy || isStaged}
                          onClick={() => handleStageScene(s.id)}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-neutral-300 cursor-pointer"
                        >
                          Preparar
                        </button>
                        <button
                          disabled={sceneBusy || isCurrent}
                          onClick={() => handlePublishScene(s.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                            isCurrent
                              ? 'bg-white/10 text-neutral-400 cursor-default'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          }`}
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <section className="studio-utility">
              <h2>Som e alerta</h2>
              <div className="studio-inline-form">
                <button type="button" className="studio-control" onClick={() => playSoundEffect('beep')}>
                  <Volume2 size={16} /> Testar som
                </button>
                <button type="button" className="studio-control studio-danger" onClick={() => handleToggleEmergency(!isEmergency)}>
                  <AlertTriangle size={16} /> {isEmergency ? 'Desativar alerta' : 'Ativar alerta'}
                </button>
              </div>
            </section>
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
