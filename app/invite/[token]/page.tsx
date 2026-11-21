'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sparkles, Shield, CheckCircle2, AlertCircle, ArrowRight, Lock, UserPlus } from 'lucide-react';
import AuthModal from '../../../components/AuthModal';

interface InvitationDetails {
  valid: boolean;
  status: string;
  event?: {
    id: number;
    slug: string;
    title: string;
    hostName: string;
    eventDate: string;
    venue: string;
  };
  inviterName?: string;
  role?: string;
  roleLabel?: string;
  roleDescription?: string;
  error?: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || '');

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadDetails = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/invitations/${token}`);
      const data = await res.json() as InvitationDetails;
      setDetails(data);
    } catch {
      setDetails({ valid: false, status: 'erro', error: 'Não foi possível carregar o convite.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/invitations/${token}`, { method: 'POST' });
      const data = await res.json() as { ok?: boolean; error?: string; slug?: string; requiresAuth?: boolean };

      if (res.status === 401 || data.requiresAuth) {
        setAuthMode('login');
        setAuthModalOpen(true);
        return;
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Erro ao aceitar convite.');
      }

      setFeedback({ type: 'success', message: 'Convite aceite com sucesso! A redirecionar para o painel…' });
      setTimeout(() => {
        router.push(`/${data.slug || details?.event?.slug || 'emerson'}/organizar`);
      }, 1200);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao processar.' });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="home-portal-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="home-navbar">
        <div className="home-brand" onClick={() => router.push('/')}>
          <div className="home-brand-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <strong>EVENTOX</strong>
            <small>SISTEMA DE EVENTOS</small>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 16px' }}>
        <div className="auth-modal-card" style={{ maxWidth: '520px', width: '100%', padding: '36px 32px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#88747c' }}>
              <Sparkles size={32} style={{ animation: 'spin 2s linear infinite', margin: '0 auto 12px' }} />
              <p>A validar o teu convite…</p>
            </div>
          ) : !details?.valid ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', background: '#fff0f2', color: '#a82e44', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <AlertCircle size={32} />
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#381f2a', margin: '0 0 8px' }}>
                Convite Inválido ou Expirado
              </h2>
              <p style={{ color: '#7c6970', fontSize: '13px', lineHeight: 1.6 }}>
                {details?.error || 'Este link de convite já foi utilizado, revogado ou expirou a sua validade.'}
              </p>
              <button
                type="button"
                className="auth-submit-btn"
                style={{ marginTop: '20px', width: '100%' }}
                onClick={() => router.push('/')}
              >
                Voltar à Página Inicial
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b4833e', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', marginBottom: '14px' }}>
                <Shield size={16} />
                <span>CONVITE PARA A EQUIPA</span>
              </div>

              <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '28px', color: '#3b1f2a', margin: '0 0 6px' }}>
                {details.event?.title}
              </h2>
              <p style={{ color: '#837177', fontSize: '13px', margin: '0 0 24px' }}>
                Anfitrião: <strong>{details.event?.hostName}</strong> · Convidado por: <strong>{details.inviterName}</strong>
              </p>

              <div style={{ background: '#fbf7f8', border: '1px solid #eadbe0', borderRadius: '14px', padding: '18px 20px', marginBottom: '24px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', color: '#8d757e', display: 'block', marginBottom: '6px' }}>
                  FUNÇÃO ATRIBUÍDA:
                </span>
                <strong style={{ fontSize: '18px', color: '#632338', display: 'block' }}>
                  {details.roleLabel}
                </strong>
                <p style={{ fontSize: '12px', color: '#79666d', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {details.roleDescription}
                </p>
              </div>

              {feedback && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    marginBottom: '16px',
                    background: feedback.type === 'success' ? '#eaf7ed' : '#fff0f2',
                    color: feedback.type === 'success' ? '#2b7a48' : '#a82e44',
                    border: `1px solid ${feedback.type === 'success' ? '#c4e8cd' : '#f5c4ce'}`,
                  }}
                >
                  {feedback.message}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="auth-submit-btn"
                  style={{ width: '100%' }}
                  disabled={accepting}
                  onClick={handleAccept}
                >
                  {accepting ? 'A aceitar convite…' : 'Aceitar Convite e Aceder ao Evento →'}
                </button>

                <p style={{ fontSize: '11px', color: '#9c8990', textAlign: 'center', margin: '6px 0 0' }}>
                  Será solicitada a confirmação da tua conta para associar o acesso em segurança.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
        onLoginSuccess={() => {
          handleAccept();
        }}
      />
    </div>
  );
}
