'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Trophy, Sparkles, Users, Send, CheckCircle2, XCircle,
  HelpCircle, BarChart3, Cloud, MessageSquare, ArrowRight,
  Flame, Check, Award, ThumbsUp, RefreshCw, AlertCircle
} from 'lucide-react';

interface Participant {
  id: number;
  nickname: string;
  tableNumber?: string | null;
  avatar?: string | null;
  score: number;
  streak: number;
}

export default function ParticipantJoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  const [joined, setJoined] = useState(false);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  // Form input
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🎉');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live game state
  const [gameState, setGameState] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<any>(null);

  // Other tabs
  const [activeTab, setActiveTab] = useState<'quiz' | 'poll' | 'wordcloud' | 'qa'>('quiz');
  const [wordInput, setWordInput] = useState('');
  const [wordSubmitted, setWordSubmitted] = useState(false);
  const [qaInput, setQaInput] = useState('');
  const [qaSubmitted, setQaSubmitted] = useState(false);
  const [pollVoted, setPollVoted] = useState(false);

  const avatars = ['🎉', '🥂', '🎓', '👑', '✨', '🚀', '🌟', '🩺', '❤️', '🔥'];

  // Unwrap params and query params
  useEffect(() => {
    params.then((p) => {
      const cleanSlug = p.slug.toLowerCase().trim();
      setSlug(cleanSlug);

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlPin = urlParams.get('pin');
        if (urlPin) setPin(urlPin);

        // Check localStorage for remembered session
        const saved = localStorage.getItem(`eventox_player_${cleanSlug}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.participant && parsed.sessionId) {
              setParticipant(parsed.participant);
              setSessionId(parsed.sessionId);
              setJoined(true);
            }
          } catch {}
        }
      }
    });
  }, [params]);

  // Poll for question updates when in game
  const fetchGameState = useCallback(async () => {
    if (!slug || !joined || !participant) return;
    try {
      const url = `/api/games/${slug}/join?participantId=${participant.id}${sessionId ? `&sessionId=${sessionId}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as any;
        setGameState(data);

        // Update score and streak if changed
        if (data.participant) {
          setParticipant(data.participant);
        }

        // Handle answer status
        if (data.hasAnsweredCurrent) {
          setAnswerSubmitted(true);
          setAnswerFeedback(data.lastAnswerResult);
        } else if (data.session?.status === 'question_active' && selectedAnswer === null) {
          setAnswerSubmitted(false);
          setAnswerFeedback(null);
        }
      }
    } catch {}
  }, [slug, joined, participant, sessionId, selectedAnswer]);

  useEffect(() => {
    if (!joined) return;
    fetchGameState();
    const interval = setInterval(fetchGameState, 2000);
    return () => clearInterval(interval);
  }, [joined, fetchGameState]);

  // Join Room
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('Por favor indica o teu nome.');
      return;
    }
    if (!pin.trim()) {
      setError('Por favor introduz o PIN da sala.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/games/${slug}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          pin: pin.trim(),
          nickname: nickname.trim(),
          tableNumber: tableNumber.trim(),
          avatar: selectedAvatar,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Falha ao entrar na sala');

      setParticipant(data.participant);
      setSessionId(data.sessionId);
      setJoined(true);

      // Persist in localStorage
      localStorage.setItem(
        `eventox_player_${slug}`,
        JSON.stringify({ participant: data.participant, sessionId: data.sessionId })
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Answer with Haptic Feedback
  const handleSelectAnswer = async (indexStr: string) => {
    if (answerSubmitted || !participant || !gameState?.currentQuestion) return;

    // Trigger phone vibration if supported
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(50); } catch {}
    }

    setSelectedAnswer(indexStr);
    setAnswerSubmitted(true);

    try {
      const res = await fetch(`/api/games/${slug}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-answer',
          sessionId,
          participantId: participant.id,
          questionId: gameState.currentQuestion.id,
          answer: indexStr,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Erro ao submeter resposta');

      setAnswerFeedback(data);
      if (data.totalScore !== undefined) {
        setParticipant((prev) => (prev ? { ...prev, score: data.totalScore, streak: data.streak } : prev));
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Word Cloud Submission
  const handleSendWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordInput.trim()) return;

    try {
      await fetch(`/api/games/${slug}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          type: 'wordcloud',
          content: wordInput.trim(),
          senderName: participant?.nickname || nickname || 'Convidado',
          tableNumber: participant?.tableNumber || tableNumber || null,
        }),
      });
      setWordSubmitted(true);
      setWordInput('');
    } catch {}
  };

  // Q&A Question Submission
  const handleSendQa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim()) return;

    try {
      await fetch(`/api/games/${slug}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          type: 'qa',
          content: qaInput.trim(),
          senderName: participant?.nickname || nickname || 'Convidado',
          tableNumber: participant?.tableNumber || tableNumber || null,
        }),
      });
      setQaSubmitted(true);
      setQaInput('');
    } catch {}
  };

  // Leave / Switch player
  const handleLeave = () => {
    localStorage.removeItem(`eventox_player_${slug}`);
    setJoined(false);
    setParticipant(null);
    setSessionId(null);
  };

  // SCREEN 1: JOIN FORM (MOBILE FIRST)
  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-5 font-sans">
        {/* Header */}
        <div className="text-center pt-8 pb-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-3xl mx-auto shadow-2xl shadow-amber-500/20 mb-3">
            ✦
          </div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            EVENTOX EXPERIENCE
          </span>
          <h1 className="text-2xl font-bold text-white mt-1">Entrar no Quiz Live</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Responde às perguntas no teu telemóvel e compete pelo pódio da festa!
          </p>
        </div>

        {/* Join Card */}
        <div className="max-w-md w-full mx-auto bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                PIN do Jogo (vê no ecrã da TV)
              </label>
              <input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Ex: 849201"
                className="w-full text-center text-2xl font-mono font-black tracking-widest rounded-2xl bg-slate-950 border border-white/15 px-4 py-3 text-amber-400 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                O teu Nome / Apelido
              </label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Dra. Sofia ou Carlos"
                className="w-full rounded-2xl bg-slate-950 border border-white/15 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1">
                Número da tua Mesa (opcional)
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Ex: 4"
                className="w-full rounded-2xl bg-slate-950 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Avatar picker */}
            <div>
              <label className="text-xs font-bold text-neutral-300 block mb-1.5">
                Escolhe o teu Avatar
              </label>
              <div className="flex flex-wrap justify-center gap-2">
                {avatars.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-10 h-10 rounded-2xl text-xl flex items-center justify-center transition ${
                      selectedAvatar === av
                        ? 'bg-amber-500 scale-110 shadow-lg shadow-amber-500/30'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider transition shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <>Entrar no Jogo <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-neutral-500 pb-4">
          Eventox Live Experience · Sincronizado em tempo real
        </p>
      </div>
    );
  }

  // SCREEN 2: ACTIVE PARTICIPANT HUB
  const currentQ = gameState?.currentQuestion;
  const isQuestionActive = gameState?.session?.status === 'question_active';
  const isQuestionEnded = gameState?.session?.status === 'question_ended';
  const isPodium = gameState?.session?.status === 'podium';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 font-sans select-none">
      {/* Top Participant Status Bar */}
      <header className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-white/10 shadow-lg">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{participant?.avatar || '🎉'}</span>
          <div>
            <strong className="text-xs text-white block">{participant?.nickname}</strong>
            <span className="text-[10px] text-neutral-400">
              {participant?.tableNumber ? `Mesa ${participant.tableNumber}` : 'Convidado'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-neutral-400 block uppercase">Pontos</span>
            <b className="text-sm font-mono text-amber-400">{participant?.score || 0} pts</b>
          </div>
          <button
            onClick={handleLeave}
            className="text-[10px] text-neutral-500 hover:text-rose-400 underline"
            title="Sair ou trocar de participante"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Sub Tabs */}
      <div className="flex items-center justify-around border-b border-white/10 my-3 pb-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('quiz')}
          className={`py-1.5 px-3 rounded-xl transition ${activeTab === 'quiz' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-neutral-400'}`}
        >
          🎮 Quiz Live
        </button>
        <button
          onClick={() => setActiveTab('wordcloud')}
          className={`py-1.5 px-3 rounded-xl transition ${activeTab === 'wordcloud' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-neutral-400'}`}
        >
          ☁️ Nuvem
        </button>
        <button
          onClick={() => setActiveTab('qa')}
          className={`py-1.5 px-3 rounded-xl transition ${activeTab === 'qa' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-neutral-400'}`}
        >
          ❓ Perguntas
        </button>
      </div>

      {/* TAB 1: QUIZ GAMEPLAY */}
      {activeTab === 'quiz' && (
        <main className="flex-1 flex flex-col justify-center my-auto w-full max-w-md mx-auto py-2">
          {/* Waiting in Lobby */}
          {(!gameState?.session || gameState.session.status === 'lobby') && (
            <div className="text-center p-8 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl space-y-4 animate-in fade-in">
              <span className="text-5xl animate-bounce block">{participant?.avatar || '🎉'}</span>
              <h2 className="text-2xl font-bold text-white">Estás dentro!</h2>
              <p className="text-sm text-neutral-300">
                Olha para o ecrã da TV. A primeira pergunta vai começar a qualquer momento!
              </p>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 inline-block text-xs text-amber-400 font-mono">
                PIN: {gameState?.session?.pin || pin}
              </div>
            </div>
          )}

          {/* Question Active - 4 Kahoot Geometric Buttons */}
          {isQuestionActive && currentQ && (
            <div className="space-y-4 w-full">
              <div className="text-center mb-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest block">
                  Pergunta {currentQ.orderIndex} de {currentQ.totalQuestions}
                </span>
                <h3 className="text-lg font-bold text-white mt-1 leading-snug">
                  {currentQ.title}
                </h3>
              </div>

              {answerSubmitted ? (
                <div className="p-8 rounded-3xl bg-slate-900 border border-emerald-500/40 text-center space-y-3 animate-in zoom-in-95">
                  <CheckCircle2 size={48} className="text-emerald-400 mx-auto animate-pulse" />
                  <h4 className="text-xl font-bold text-white">Resposta Registada!</h4>
                  <p className="text-xs text-neutral-300">
                    A aguardar contagem e revelação dos resultados no ecrã...
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3.5">
                  {[
                    { label: currentQ.options[0] || 'Opção A', color: 'bg-red-600 active:bg-red-700 text-white', icon: '▲' },
                    { label: currentQ.options[1] || 'Opção B', color: 'bg-blue-600 active:bg-blue-700 text-white', icon: '◆' },
                    { label: currentQ.options[2] || 'Opção C', color: 'bg-amber-500 active:bg-amber-600 text-slate-950', icon: '●' },
                    { label: currentQ.options[3] || 'Opção D', color: 'bg-emerald-600 active:bg-emerald-700 text-white', icon: '■' },
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectAnswer(String(idx))}
                      className={`h-36 rounded-2xl p-4 flex flex-col items-center justify-center font-bold text-lg shadow-xl transition active:scale-95 cursor-pointer ${btn.color}`}
                    >
                      <span className="text-3xl mb-1">{btn.icon}</span>
                      <span className="text-xs font-semibold text-center line-clamp-2">{btn.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Question Ended - Instant Feedback */}
          {isQuestionEnded && (
            <div className="p-8 rounded-3xl bg-slate-900 border border-white/10 text-center space-y-4 animate-in zoom-in-95">
              {answerFeedback?.isCorrect ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl mx-auto">
                    🎉
                  </div>
                  <h3 className="text-2xl font-bold text-emerald-400">Excelente! Resposta Correta!</h3>
                  <p className="text-sm font-mono text-amber-300 font-bold">
                    +{answerFeedback.pointsEarned || 950} Pontos
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-3xl mx-auto">
                    ❌
                  </div>
                  <h3 className="text-xl font-bold text-rose-400">Não foi desta vez!</h3>
                  <p className="text-xs text-neutral-400">
                    Prepara-te para a próxima pergunta!
                  </p>
                </>
              )}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-300">
                Pontuação Total: <strong className="text-amber-400">{participant?.score || 0} pts</strong>
              </div>
            </div>
          )}

          {/* Podium End */}
          {isPodium && (
            <div className="p-8 rounded-3xl bg-slate-900 border border-amber-500/30 text-center space-y-4 animate-in zoom-in-95">
              <Trophy size={48} className="text-amber-400 mx-auto animate-bounce" />
              <h3 className="text-2xl font-black text-white">Quiz Concluído!</h3>
              <p className="text-sm text-neutral-300">
                Olha para a TV para ver o Pódio Oficial de Campeões e a Batalha das Mesas!
              </p>
              <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-300 font-bold text-base">
                A tua Pontuação Final: {participant?.score || 0} pts
              </div>
            </div>
          )}
        </main>
      )}

      {/* TAB 2: WORD CLOUD SUBMISSION */}
      {activeTab === 'wordcloud' && (
        <main className="flex-1 flex flex-col justify-center my-auto w-full max-w-md mx-auto p-4 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
          <div className="text-center">
            <span className="text-2xl">☁️</span>
            <h3 className="text-lg font-bold text-white mt-1">Nuvem de Palavras</h3>
            <p className="text-xs text-neutral-400">
              Em uma palavra, como defines esta noite inesquecível?
            </p>
          </div>

          {wordSubmitted ? (
            <div className="p-6 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-center space-y-2">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Palavra Enviada!</h4>
              <p className="text-xs text-neutral-300">
                A tua palavra já foi adicionada à Nuvem no grande ecrã.
              </p>
              <button
                onClick={() => setWordSubmitted(false)}
                className="text-xs text-amber-400 underline mt-2 block mx-auto cursor-pointer"
              >
                Enviar outra palavra
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendWord} className="space-y-3">
              <input
                type="text"
                required
                maxLength={30}
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                placeholder="Ex: Orgulho, Inesquecível, Brilhante..."
                className="w-full rounded-2xl bg-slate-950 border border-white/15 p-3.5 text-sm text-white placeholder-neutral-500"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Enviar para o Ecrã
              </button>
            </form>
          )}
        </main>
      )}

      {/* TAB 3: Q&A SUBMISSION */}
      {activeTab === 'qa' && (
        <main className="flex-1 flex flex-col justify-center my-auto w-full max-w-md mx-auto p-4 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
          <div className="text-center">
            <span className="text-2xl">❓</span>
            <h3 className="text-lg font-bold text-white mt-1">Pergunta ao Anfitrião</h3>
            <p className="text-xs text-neutral-400">
              Tens uma pergunta especial ou curiosidade para o homenageado?
            </p>
          </div>

          {qaSubmitted ? (
            <div className="p-6 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-center space-y-2">
              <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Pergunta Submetida!</h4>
              <p className="text-xs text-neutral-300">
                A tua pergunta foi enviada ao moderador para ser respondida em direto.
              </p>
              <button
                onClick={() => setQaSubmitted(false)}
                className="text-xs text-amber-400 underline mt-2 block mx-auto cursor-pointer"
              >
                Fazer outra pergunta
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendQa} className="space-y-3">
              <textarea
                required
                rows={3}
                maxLength={200}
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                placeholder="Ex: Qual foi a cadeira mais desafiante de todo o curso?"
                className="w-full rounded-2xl bg-slate-950 border border-white/15 p-3 text-sm text-white placeholder-neutral-500"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Enviar Pergunta
              </button>
            </form>
          )}
        </main>
      )}

      {/* Bottom Info */}
      <footer className="text-center text-[10px] text-neutral-500 py-2">
        Eventox Live · Sala: {gameState?.session?.pin || pin || 'Ativa'}
      </footer>
    </div>
  );
}
