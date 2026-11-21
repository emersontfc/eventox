'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, UserPlus, Shield, Check, Copy, CheckCheck, Trash2,
  Lock, AlertTriangle, RefreshCw, Clock, History, Ban, UserCheck, X
} from 'lucide-react';

interface Member {
  membershipId: number;
  userId: number;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  permissions: string[];
  status: string;
  createdAt: string;
  roleDefinition?: {
    id: string;
    label: string;
    description: string;
    badgeColor: string;
  } | null;
}

interface Invitation {
  id: number;
  email: string;
  role: string;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface AuditLog {
  id: number;
  userId?: number | null;
  userName?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
}

interface RoleDef {
  id: string;
  label: string;
  description: string;
  badgeColor: string;
  defaultPermissions: string[];
}

const permissionExamples: Record<string, string> = {
  'event:manage': 'Editar o evento e publicar o programa',
  'team:invite': 'Convidar membros para a equipa',
  'guests:view': 'Consultar a lista de convidados',
  'guests:rsvp': 'Confirmar presença',
  'guests:checkin': 'Registar entradas',
  'hospitality:menu:manage': 'Editar o cardápio',
  'hospitality:order:create': 'Registar pedidos',
  'playlist:control': 'Adicionar músicas e gerir a playlist',
  'gallery:moderate': 'Moderar fotos e mensagens',
  'committee:tasks:update': 'Atualizar tarefas da comissão',
};

export default function TeamManagement({ slug }: { slug: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('coorganizador');
  const [inviting, setInviting] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Active sub-tab (members | invitations | audit)
  const [subTab, setSubTab] = useState<'members' | 'invitations' | 'audit'>('members');

  const loadTeamData = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/team`, { cache: 'no-store' });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar equipa');

      setMembers(data.members || []);
      setInvitations(data.invitations || []);
      setAuditLogs(data.auditLogs || []);
      setRoles(data.roles || []);
      setIsOwner(Boolean(data.isOwner));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados da equipa');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  };

  // Create invitation
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      const res = await fetch(`/api/events/${slug}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar convite');

      setGeneratedInviteUrl(new URL(data.inviteUrl, window.location.origin).href);
      showSuccess('Convite gerado com sucesso!');
      loadTeamData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  // Revoke invitation
  const handleRevokeInvite = async (invitationId: number) => {
    if (!confirm('Deseja realmente revogar este convite?')) return;
    try {
      const res = await fetch(`/api/events/${slug}/invitations?invitationId=${invitationId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao revogar convite');
      showSuccess('Convite revogado.');
      loadTeamData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Update member role
  const handleRoleChange = async (targetUserId: number, newRole: string) => {
    try {
      const res = await fetch(`/api/events/${slug}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-role', userId: targetUserId, role: newRole }),
      });
      if (!res.ok) {
        const j: any = await res.json();
        throw new Error(j.error || 'Falha ao alterar função');
      }
      showSuccess('Função do membro atualizada!');
      loadTeamData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle member status (bloqueado / ativo)
  const handleStatusChange = async (targetUserId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'ativo' ? 'bloqueado' : 'ativo';
    try {
      const res = await fetch(`/api/events/${slug}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-status', userId: targetUserId, status: nextStatus }),
      });
      if (!res.ok) throw new Error('Falha ao alterar estado');
      showSuccess(`Membro ${nextStatus === 'bloqueado' ? 'bloqueado' : 'reativado'}.`);
      loadTeamData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Remove member
  const handleRemoveMember = async (targetUserId: number, memberName: string) => {
    if (!confirm(`Remover "${memberName}" da equipa deste evento?`)) return;
    try {
      const res = await fetch(`/api/events/${slug}/team?userId=${targetUserId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao remover membro');
      showSuccess('Membro removido da equipa.');
      loadTeamData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyInviteLink = () => {
    if (!generatedInviteUrl) return;
    navigator.clipboard.writeText(generatedInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-amber-500 mb-2" />
        <p>A carregar equipa e permissões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest font-bold text-amber-500">
            Controlo de Acesso & Colaboração
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Equipa do Evento</h2>
          <p className="text-sm text-slate-500">
            Gere organizadores, recepção, audiovisual, catering e consulta o histórico de operações.
          </p>
        </div>

        <button
          onClick={() => {
            setGeneratedInviteUrl(null);
            setInviteEmail('');
            setInviteModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-sm font-bold text-white transition shadow-sm"
        >
          <UserPlus size={18} /> Convidar Colaborador
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-emerald-800 text-sm flex items-center gap-2">
          <Check size={18} className="text-emerald-600" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-50 p-4 text-rose-800 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setSubTab('members')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            subTab === 'members'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users size={16} /> Membros da Equipa ({members.length})
        </button>
        <button
          onClick={() => setSubTab('invitations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            subTab === 'invitations'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock size={16} /> Convites Pendentes ({invitations.filter((i) => i.status === 'pendente').length})
        </button>
        <button
          onClick={() => setSubTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            subTab === 'audit'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History size={16} /> Registo de Operações (Audit Log)
        </button>
      </div>

      {/* TAB 1: MEMBERS */}
      {subTab === 'members' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Utilizador</th>
                  <th className="py-3 px-4">Função / Perfil</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Data de Adesão</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {members.map((m) => {
                  const isUserOwner = m.role === 'proprietario';
                  return (
                    <tr key={m.userId} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800 text-sm">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong className="block text-slate-900">{m.name}</strong>
                            <small className="text-slate-500">{m.email}</small>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isOwner && !isUserOwner ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 uppercase">
                            <Shield size={12} className="text-amber-600" />
                            {m.roleDefinition?.label || m.role}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            m.status === 'ativo'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {m.status === 'ativo' ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {new Date(m.createdAt).toLocaleDateString('pt-PT', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {!isUserOwner && isOwner && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleStatusChange(m.userId, m.status)}
                              className={`p-1.5 rounded-lg border transition ${
                                m.status === 'ativo'
                                  ? 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={m.status === 'ativo' ? 'Bloquear Acesso' : 'Desbloquear Acesso'}
                            >
                              {m.status === 'ativo' ? <Ban size={15} /> : <UserCheck size={15} />}
                            </button>
                            <button
                              onClick={() => handleRemoveMember(m.userId, m.name)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                              title="Remover da Equipa"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVITATIONS */}
      {subTab === 'invitations' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4">Convites da equipa</h3>
          {invitations.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum convite pendente.</p>
          ) : (
            <div className="space-y-3">
              {[...invitations].sort((a, b) => Number(b.status === 'pendente') - Number(a.status === 'pendente')).map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 bg-slate-50/50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">{inv.email}</strong>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        {inv.role}
                      </span>
                      <span className="text-xs text-slate-400">
                        Expira em {new Date(inv.expiresAt).toLocaleDateString('pt-PT')}
                      </span>
                    </div>
                    <span className={inv.status === 'pendente' ? 'font-semibold text-amber-800' : 'text-slate-600'}>
                      {inv.status === 'pendente' && new Date(inv.expiresAt) < new Date() ? 'Expirado' :
                        inv.status === 'pendente' ? 'A aguardar aceitação' : inv.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={inv.status !== 'pendente' || new Date(inv.expiresAt) < new Date()}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`);
                          showSuccess('Link de convite copiado!');
                        } catch {
                          setError('Não foi possível copiar o link.');
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                    >
                      <Copy size={13} /> Copiar Link
                    </button>
                    {inv.status === 'pendente' && (
                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 px-3 py-1.5 text-xs font-semibold"
                      >
                        <Trash2 size={13} /> Revogar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT LOG */}
      {subTab === 'audit' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4">Histórico de Operações</h3>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum registo de operação recente.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between border-b border-slate-100 pb-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900">{log.userName || 'Sistema'}</strong>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-mono">
                        {log.action}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-slate-500 font-mono text-[11px] truncate max-w-xl">
                        {log.details}
                      </p>
                    )}
                  </div>
                  <span className="text-slate-400 shrink-0">
                    {new Date(log.createdAt).toLocaleString('pt-PT')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Convidar para a Equipa</h3>
              <button onClick={() => setInviteModalOpen(false)}>
                <X size={18} className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            {generatedInviteUrl ? (
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-emerald-800 text-sm">
                  ✓ Convite criado com sucesso! Partilhe o link abaixo com o colaborador.
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 break-all text-xs font-mono text-slate-700">
                  {generatedInviteUrl}
                </div>
                <button
                  onClick={copyInviteLink}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 transition"
                >
                  {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
                  {copied ? 'Copiado para a Área de Transferência!' : 'Copiar Link de Convite'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Email do Colaborador
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colega@exemplo.com"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Função / Responsabilidade
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                  >
                    {roles
                      .filter((r) => r.id !== 'proprietario')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} — {r.description}
                        </option>
                      ))}
                  </select>
                </div>

                {roles.filter(role => role.id === inviteRole).map(role => (
                  <div key={role.id} className="rounded-xl bg-slate-50 p-3 text-sm" aria-live="polite">
                    <strong>O que esta função pode fazer</strong>
                    <p>{role.description}</p>
                    <ul className="list-disc pl-5">
                      {Object.entries(permissionExamples)
                        .filter(([key]) => role.defaultPermissions.some(permission => permission === key ||
                          (permission.endsWith(':*') && key.startsWith(permission.slice(0, -1)))))
                        .map(([key, label]) => <li key={key}>{label}</li>)}
                    </ul>
                  </div>
                ))}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    className="rounded-xl bg-amber-600 hover:bg-amber-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {inviting ? 'A gerar...' : 'Gerar Convite'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
