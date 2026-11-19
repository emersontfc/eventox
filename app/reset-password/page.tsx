'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A palavra-passe deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Erro ao redefinir palavra-passe.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', background: '#eaf7ed', color: '#2b7a48', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
          <CheckCircle2 size={32} />
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#381f2a', margin: '0 0 8px' }}>
          Palavra-passe Redefinida!
        </h2>
        <p style={{ color: '#7c6970', fontSize: '13px', lineHeight: 1.6 }}>
          A tua nova palavra-passe foi guardada com sucesso. A redirecionar para a página inicial…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ width: '48px', height: '48px', background: '#f6ecf0', color: '#68263e', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
          <Lock size={22} />
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', color: '#3a1f2b', margin: '0 0 6px' }}>
          Definir Nova Palavra-passe
        </h2>
        <p style={{ color: '#816f76', fontSize: '12.5px', margin: 0 }}>
          Escolhe uma nova palavra-passe segura para a tua conta.
        </p>
      </div>

      {error && <div className="auth-alert-error">{error}</div>}

      <label className="auth-field">
        <span>Nova Palavra-passe</span>
        <input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres..."
        />
      </label>

      <label className="auth-field">
        <span>Confirmar Palavra-passe</span>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repete a nova palavra-passe..."
        />
      </label>

      <button type="submit" className="auth-submit-btn" disabled={loading} style={{ marginTop: '6px' }}>
        {loading ? 'A guardar…' : 'Guardar Nova Palavra-passe →'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();

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
        <div className="auth-modal-card" style={{ maxWidth: '460px', width: '100%', padding: '36px 30px' }}>
          <Suspense fallback={<p style={{ textAlign: 'center' }}>A carregar…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
