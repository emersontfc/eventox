'use client';
import { useState, useEffect } from 'react';
import {
  X, Lock, Sparkles, Plus, ArrowRight, Eye, EyeOff, Check, Copy,
  CheckCheck, QrCode, CalendarDays, MapPin, Shield, CheckCircle2,
  ExternalLink, User
} from 'lucide-react';
import QRCode from 'qrcode';
import Confetti from './Confetti';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
  currentSlug?: string;
  onLoginSuccess?: (slug: string) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  defaultMode = 'login',
  currentSlug = '',
  onLoginSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultMode);
  const [showPasscode, setShowPasscode] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Login state
  const [loginSlug, setLoginSlug] = useState(currentSlug || 'emerson');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register state (Wizard in 3 steps)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [eventType, setEventType] = useState('Gala de Graduação');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');
  const [slug, setSlug] = useState('');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [photoAlbumUrl, setPhotoAlbumUrl] = useState('');
  const [description, setDescription] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Created success state
  const [createdEvent, setCreatedEvent] = useState<{
    slug: string;
    title: string;
    url: string;
    qrCode: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTab(defaultMode);
    if (currentSlug) {
      setLoginSlug(currentSlug);
    }
  }, [defaultMode, currentSlug, isOpen]);

  if (!isOpen) return null;

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

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(val));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const cleanSlug = generateSlug(loginSlug);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: cleanSlug, passcode: loginPasscode }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Código de acesso incorreto.');
      }

      setShowConfetti(true);
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(cleanSlug);
        } else {
          window.location.href = `/${cleanSlug}`;
        }
        onClose();
      }, 700);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Erro ao autenticar.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    if (passcode.length < 4) {
      setRegisterError('O código de acesso deve ter pelo menos 4 caracteres.');
      return;
    }

    if (passcode !== confirmPasscode) {
      setRegisterError('As palavras-passe / códigos não coincidem.');
      return;
    }

    setRegisterLoading(true);

    try {
      const cleanSlug = generateSlug(slug || title);
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          hostName,
          slug: cleanSlug,
          eventDate,
          venue,
          passcode,
          description: description || `${eventType} de ${hostName}. Uma celebração inesquecível.`,
          photoAlbumUrl: photoAlbumUrl || undefined,
          coverTheme: 'gold',
        }),
      });

      const data = await res.json() as { ok?: boolean; slug?: string; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Erro ao criar o evento.');
      }

      const domain = typeof window !== 'undefined' ? window.location.origin : 'https://eventox.kazix.site';
      const eventUrl = `${domain}/${data.slug || cleanSlug}`;
      const qrDataUrl = await QRCode.toDataURL(eventUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#502232', light: '#ffffff' }
      }).catch(() => '');

      setCreatedEvent({
        slug: data.slug || cleanSlug,
        title,
        url: eventUrl,
        qrCode: qrDataUrl,
      });

      setShowConfetti(true);
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Erro ao criar o evento.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (createdEvent?.url && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(createdEvent.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <>
      <Confetti active={showConfetti} onFinish={() => setShowConfetti(false)} />

      <div
        className="modal-cover"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="auth-modal-card">
          {/* Header */}
          <div className="auth-modal-header">
            <div className="auth-brand-chip">
              <Sparkles size={16} />
              <span>EVENTOX PORTAL</span>
            </div>
            <button className="auth-close-btn" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          {/* If already created successfully */}
          {createdEvent ? (
            <div className="auth-success-view">
              <div className="auth-success-icon">
                <CheckCircle2 size={36} />
              </div>
              <span className="auth-success-badge">✦ EVENTO CRIADO COM SUCESSO ✦</span>
              <h2>{createdEvent.title}</h2>
              <p>O teu evento já está ativo e pronto a partilhar com os convidados!</p>

              <div className="auth-qr-box">
                {createdEvent.qrCode && (
                  <img src={createdEvent.qrCode} alt="QR Code Oficial" className="auth-qr-img" />
                )}
                <div className="auth-link-row">
                  <code>{createdEvent.url}</code>
                  <button onClick={handleCopyLink} className="copy-pill-btn">
                    {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="auth-success-actions">
                <a
                  href={`/${createdEvent.slug}`}
                  className="primary-action-btn"
                >
                  Abrir Página do Evento →
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Selector */}
              <div className="auth-tab-bar">
                <button
                  type="button"
                  className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
                  onClick={() => { setTab('login'); setLoginError(''); }}
                >
                  <Lock size={15} />
                  <span>Acesso da Organização</span>
                </button>
                <button
                  type="button"
                  className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
                  onClick={() => { setTab('register'); setRegisterError(''); }}
                >
                  <Plus size={15} />
                  <span>Criar Novo Evento</span>
                </button>
              </div>

              {/* TAB 1: LOGIN FORM */}
              {tab === 'login' && (
                <form onSubmit={handleLogin} className="auth-form-body">
                  <div className="auth-intro">
                    <h3>Bem-vindo à Organização</h3>
                    <p>Introduz o código de acesso / PIN de administração para gerir o evento.</p>
                  </div>

                  {loginError && <div className="auth-alert-error">{loginError}</div>}

                  <label className="auth-field">
                    <span>Link do Evento (Slug)</span>
                    <div className="auth-input-group">
                      <span className="auth-input-prefix">/</span>
                      <input
                        type="text"
                        required
                        value={loginSlug}
                        onChange={(e) => setLoginSlug(e.target.value)}
                        placeholder="ex.: emerson"
                      />
                    </div>
                  </label>

                  <label className="auth-field">
                    <span>Código de Acesso / PIN</span>
                    <div className="auth-input-group">
                      <input
                        type={showPasscode ? 'text' : 'password'}
                        required
                        value={loginPasscode}
                        onChange={(e) => setLoginPasscode(e.target.value)}
                        placeholder="Código de administração..."
                        autoFocus
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowPasscode(!showPasscode)}
                      >
                        {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loginLoading}
                  >
                    {loginLoading ? 'A verificar credenciais…' : 'Entrar no Painel de Controlo →'}
                  </button>

                  <div className="auth-form-footer">
                    <span>Ainda não tens um evento registado?</span>
                    <button
                      type="button"
                      className="auth-text-link"
                      onClick={() => setTab('register')}
                    >
                      Criar agora em 30 segundos
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: REGISTER WIZARD */}
              {tab === 'register' && (
                <form onSubmit={handleRegister} className="auth-form-body">
                  {/* Step Indicators */}
                  <div className="wizard-progress-bar">
                    <div className={`wizard-step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
                    <div className={`wizard-line ${step >= 2 ? 'active' : ''}`} />
                    <div className={`wizard-step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
                    <div className={`wizard-line ${step >= 3 ? 'active' : ''}`} />
                    <div className={`wizard-step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
                  </div>

                  {registerError && <div className="auth-alert-error">{registerError}</div>}

                  {/* STEP 1: EVENT IDENTITY */}
                  {step === 1 && (
                    <div className="wizard-step-content">
                      <div className="auth-intro">
                        <h3>O que vamos celebrar?</h3>
                        <p>Dá um nome inesquecível ao teu evento e identifica o anfitrião principal.</p>
                      </div>

                      <label className="auth-field">
                        <span>Título da Celebração</span>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => handleTitleChange(e.target.value)}
                          placeholder="Ex.: Gala de Graduação de Medicina"
                          autoFocus
                        />
                      </label>

                      <label className="auth-field">
                        <span>Nome do Anfitrião / Formando</span>
                        <input
                          type="text"
                          required
                          value={hostName}
                          onChange={(e) => setHostName(e.target.value)}
                          placeholder="Ex.: Dr. Emerson Charles"
                        />
                      </label>

                      <label className="auth-field">
                        <span>Tipo de Evento</span>
                        <select
                          value={eventType}
                          onChange={(e) => setEventType(e.target.value)}
                        >
                          <option value="Gala de Graduação">Gala de Graduação</option>
                          <option value="Casamento & Recepção">Casamento & Recepção</option>
                          <option value="Aniversário de Gala">Aniversário de Gala</option>
                          <option value="Celebração Corporativa">Celebração Corporativa</option>
                          <option value="Outro Evento Especial">Outro Evento Especial</option>
                        </select>
                      </label>

                      <div className="wizard-actions">
                        <button
                          type="button"
                          className="auth-submit-btn"
                          disabled={!title.trim() || !hostName.trim()}
                          onClick={() => setStep(2)}
                        >
                          Continuar: Data & Local →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: DATE & VENUE */}
                  {step === 2 && (
                    <div className="wizard-step-content">
                      <div className="auth-intro">
                        <h3>Quando e onde será a festa?</h3>
                        <p>Define a data, o salão e personaliza o link exclusivo do teu evento.</p>
                      </div>

                      <label className="auth-field">
                        <span>Data e Hora do Início</span>
                        <input
                          type="datetime-local"
                          required
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                        />
                      </label>

                      <label className="auth-field">
                        <span>Local do Evento / Salão</span>
                        <input
                          type="text"
                          required
                          value={venue}
                          onChange={(e) => setVenue(e.target.value)}
                          placeholder="Ex.: Salão Cajada II, Maputo"
                        />
                      </label>

                      <label className="auth-field">
                        <span>Link Oficial do Teu Evento</span>
                        <div className="auth-input-group">
                          <span className="auth-input-prefix">eventox.kazix.site/</span>
                          <input
                            type="text"
                            required
                            value={slug}
                            onChange={(e) => setSlug(generateSlug(e.target.value))}
                            placeholder="meu-evento"
                          />
                        </div>
                        <small className="auth-field-hint">
                          Este será o link público enviado aos convidados para visualizarem as mesas e confirmarem presença.
                        </small>
                      </label>

                      <div className="wizard-actions-split">
                        <button
                          type="button"
                          className="auth-secondary-btn"
                          onClick={() => setStep(1)}
                        >
                          ← Voltar
                        </button>
                        <button
                          type="button"
                          className="auth-submit-btn"
                          disabled={!eventDate || !venue.trim() || !slug.trim()}
                          onClick={() => setStep(3)}
                        >
                          Continuar: Segurança →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: SECURITY & EXTRAS */}
                  {step === 3 && (
                    <div className="wizard-step-content">
                      <div className="auth-intro">
                        <h3>Segurança da Organização</h3>
                        <p>Cria um código secreto para proteger o painel e adiciona a tua galeria de fotos.</p>
                      </div>

                      <div className="auth-field-row">
                        <label className="auth-field">
                          <span>Código de Administração (PIN)</span>
                          <input
                            type="password"
                            required
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            placeholder="Mínimo 4 caracteres..."
                          />
                        </label>

                        <label className="auth-field">
                          <span>Confirmar Código</span>
                          <input
                            type="password"
                            required
                            value={confirmPasscode}
                            onChange={(e) => setConfirmPasscode(e.target.value)}
                            placeholder="Repete o código..."
                          />
                        </label>
                      </div>

                      <label className="auth-field">
                        <span>Álbum Google Fotos (Opcional)</span>
                        <input
                          type="url"
                          value={photoAlbumUrl}
                          onChange={(e) => setPhotoAlbumUrl(e.target.value)}
                          placeholder="https://photos.app.goo.gl/..."
                        />
                        <small className="auth-field-hint">
                          Os convidados poderão abrir este link diretamente para adicionar fotos tiradas na festa.
                        </small>
                      </label>

                      <div className="wizard-actions-split">
                        <button
                          type="button"
                          className="auth-secondary-btn"
                          onClick={() => setStep(2)}
                        >
                          ← Voltar
                        </button>
                        <button
                          type="submit"
                          className="auth-submit-btn"
                          disabled={registerLoading || !passcode || passcode !== confirmPasscode}
                        >
                          {registerLoading ? 'A criar o teu evento…' : '✦ Finalizar e Criar Evento ✦'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
