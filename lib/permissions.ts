export type EventRole =
  | 'proprietario'
  | 'coorganizador'
  | 'recepcao'
  | 'catering'
  | 'audiovisual'
  | 'fotografia'
  | 'comissao';

export interface RoleDefinition {
  id: EventRole;
  label: string;
  description: string;
  badgeColor: string;
  defaultPermissions: string[];
}

export const ROLE_DEFINITIONS: Record<EventRole, RoleDefinition> = {
  proprietario: {
    id: 'proprietario',
    label: 'Proprietário',
    description: 'Acesso total e irrestrito ao evento, configurações avançadas e gestão da equipa.',
    badgeColor: '#b4833e',
    defaultPermissions: ['*'],
  },
  coorganizador: {
    id: 'coorganizador',
    label: 'Coorganizador',
    description: 'Gestão completa do evento, módulos operacionais e equipa (exceto eliminação do evento).',
    badgeColor: '#7b2e47',
    defaultPermissions: [
      'event:manage',
      'team:view',
      'team:invite',
      'guests:*',
      'tables:*',
      'hospitality:*',
      'screen:*',
      'games:*',
      'playlist:*',
      'committee:*',
      'gallery:*',
      'media:*',
      'quotes:*',
      'messages:*',
      'audit:view',
    ],
  },
  recepcao: {
    id: 'recepcao',
    label: 'Recepção & Protocolo',
    description: 'Check-in de convidados, atribuição e consulta de mesas e emissão de boas-vindas.',
    badgeColor: '#2b7a48',
    defaultPermissions: [
      'guests:view',
      'guests:create',
      'guests:edit',
      'guests:checkin',
      'tables:view',
      'screen:arrivals',
      'screen:messages:create',
    ],
  },
  catering: {
    id: 'catering',
    label: 'Catering & Bar',
    description: 'Controlo do cardápio, stock de bebidas e registo de comandas por mesa.',
    badgeColor: '#9c602a',
    defaultPermissions: [
      'hospitality:view',
      'hospitality:order:create',
      'hospitality:order:update',
      'hospitality:stock:update',
      'tables:view',
    ],
  },
  audiovisual: {
    id: 'audiovisual',
    label: 'Audiovisual (Ecrã & Som)',
    description: 'Operação da tela ao vivo, rotação de cenas, aprovação de mensagens, quiz live e playlist.',
    badgeColor: '#30588c',
    defaultPermissions: [
      'screen:*',
      'screen:view',
      'screen:control',
      'screen:design',
      'screen:messages:*',
      'screen:messages:view',
      'screen:messages:moderate',
      'screen:scenes:manage',
      'games:*',
      'games:manage',
      'games:host',
      'messages:moderate',
      'playlist:view',
      'playlist:control',
      'quotes:manage',
      'gallery:view',
      'media:manage',
    ],
  },
  fotografia: {
    id: 'fotografia',
    label: 'Fotografia & Vídeo',
    description: 'Moderação da galeria compartilhada, upload em alta resolução e fotos no ecrã.',
    badgeColor: '#6e3c8c',
    defaultPermissions: [
      'gallery:view',
      'gallery:upload',
      'gallery:moderate',
      'screen:gallery',
      'media:manage',
    ],
  },
  comissao: {
    id: 'comissao',
    label: 'Membro da Comissão',
    description: 'Consulta do programa, execução de tarefas organizacionais e lista de convidados.',
    badgeColor: '#4f4449',
    defaultPermissions: [
      'committee:view',
      'committee:tasks:update',
      'guests:view',
      'tables:view',
      'playlist:view',
      'gallery:view',
    ],
  },
};

export const MODULE_ACTIONS = [
  { module: 'guests', label: 'Convidados & RSVP', actions: ['view', 'create', 'edit', 'delete', 'checkin'] },
  { module: 'tables', label: 'Mesas & Lugares', actions: ['view', 'create', 'edit', 'delete'] },
  { module: 'hospitality', label: 'Bar & Catering', actions: ['view', 'order', 'stock'] },
  { module: 'screen', label: 'Modo Ecrã / Eventox Live', actions: ['view', 'control', 'design', 'messages', 'scenes'] },
  { module: 'games', label: 'Jogos & Quiz Live', actions: ['manage', 'host'] },
  { module: 'playlist', label: 'Playlist & Som', actions: ['view', 'control'] },
  { module: 'gallery', label: 'Galeria & Fotos', actions: ['view', 'upload', 'moderate'] },
  { module: 'committee', label: 'Comissão & Tarefas', actions: ['view', 'edit', 'tasks'] },
  { module: 'team', label: 'Gestão da Equipa', actions: ['view', 'invite', 'manage'] },
];

export function hasPermission(
  role: string,
  customPermissions: string[] | string | undefined,
  requiredPermission: string
): boolean {
  if (role === 'proprietario') return true;

  // Parse permissions if string
  let perms: string[] = [];
  if (Array.isArray(customPermissions)) {
    perms = customPermissions;
  } else if (typeof customPermissions === 'string') {
    try {
      perms = JSON.parse(customPermissions);
    } catch {
      perms = [];
    }
  }

  // Combine custom perms and default role perms
  const roleDef = ROLE_DEFINITIONS[role as EventRole];
  const allPerms = new Set<string>([...perms, ...(roleDef?.defaultPermissions || [])]);

  // Global wildcard
  if (allPerms.has('*') || allPerms.has(requiredPermission)) return true;

  // Prefix checks:
  // e.g. required "screen:messages:view" matches "screen:*" or "screen:messages:*"
  // e.g. required "screen:messages" matches "screen:*" or "screen:messages:view" or "screen:messages:moderate"
  for (const perm of allPerms) {
    if (perm === '*') return true;
    if (perm.endsWith(':*')) {
      const prefix = perm.slice(0, -2);
      if (requiredPermission.startsWith(prefix)) return true;
    }
    // If requirement is a broader module/submodule like 'screen:messages' and user has 'screen:messages:moderate'
    if (perm.startsWith(`${requiredPermission}:`)) return true;
  }

  return false;
}
