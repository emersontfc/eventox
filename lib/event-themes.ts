export interface EventTheme {
  id: string;
  name: string;
  subtitle: string;
  previewBg: string;
  previewBorder: string;
  previewAccent: string;
  previewBadge: string;
  bodyClass: string;
  heroGradient: string;
  badgeStyle: {
    bg: string;
    border: string;
    text: string;
  };
  cardStyle: {
    bg: string;
    border: string;
    text: string;
  };
  accentColor: string;
  buttonPrimary: {
    bg: string;
    text: string;
    shadow: string;
  };
}

export const EVENT_THEMES: Record<string, EventTheme> = {
  'gala-gold': {
    id: 'gala-gold',
    name: 'Gala Ouro & Noite Imperial',
    subtitle: 'Estilo Black-Tie majestoso, preto obsidiana com detalhes em ouro 24k metálico.',
    previewBg: 'linear-gradient(135deg, #0d0a0b 0%, #1c1318 50%, #0d0a0b 100%)',
    previewBorder: '#d4af37',
    previewAccent: '#f5d77f',
    previewBadge: 'Ouro 24K',
    bodyClass: 'theme-gala-gold',
    heroGradient: 'radial-gradient(ellipse at 50% 20%, #2a1b24 0%, #120b0f 50%, #080507 100%)',
    badgeStyle: {
      bg: 'rgba(212, 175, 55, 0.15)',
      border: '1px solid rgba(212, 175, 55, 0.45)',
      text: '#f3db8b',
    },
    cardStyle: {
      bg: 'rgba(20, 13, 17, 0.85)',
      border: '1px solid rgba(212, 175, 55, 0.25)',
      text: '#ffffff',
    },
    accentColor: '#d4af37',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #d4af37 0%, #aa820a 100%)',
      text: '#000000',
      shadow: '0 8px 24px rgba(212, 175, 55, 0.35)',
    },
  },

  'royal-emerald': {
    id: 'royal-emerald',
    name: 'Esmeralda Real & Ouro Nobre',
    subtitle: 'Verde esmeralda imperial, veludo floresta e arabescos dourados de alta nobreza.',
    previewBg: 'linear-gradient(135deg, #03140e 0%, #072b1d 50%, #03140e 100%)',
    previewBorder: '#10b981',
    previewAccent: '#34d399',
    previewBadge: 'Esmeralda',
    bodyClass: 'theme-royal-emerald',
    heroGradient: 'radial-gradient(ellipse at 50% 20%, #083323 0%, #041d14 50%, #020f0a 100%)',
    badgeStyle: {
      bg: 'rgba(16, 185, 129, 0.15)',
      border: '1px solid rgba(16, 185, 129, 0.45)',
      text: '#6ee7b7',
    },
    cardStyle: {
      bg: 'rgba(6, 26, 18, 0.85)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      text: '#ffffff',
    },
    accentColor: '#10b981',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      text: '#ffffff',
      shadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
    },
  },

  'velvet-burgundy': {
    id: 'velvet-burgundy',
    name: 'Borgonha Veludo & Rose Gold',
    subtitle: 'Vinho tinto nobre, rubi sofisticado com iluminação suave em ouro rosa.',
    previewBg: 'linear-gradient(135deg, #18050c 0%, #2e0b17 50%, #18050c 100%)',
    previewBorder: '#f43f5e',
    previewAccent: '#fda4af',
    previewBadge: 'Borgonha',
    bodyClass: 'theme-velvet-burgundy',
    heroGradient: 'radial-gradient(ellipse at 50% 20%, #3d0e1f 0%, #200710 50%, #0e0307 100%)',
    badgeStyle: {
      bg: 'rgba(244, 63, 94, 0.15)',
      border: '1px solid rgba(244, 63, 94, 0.45)',
      text: '#fecdd3',
    },
    cardStyle: {
      bg: 'rgba(28, 9, 16, 0.85)',
      border: '1px solid rgba(244, 63, 94, 0.25)',
      text: '#ffffff',
    },
    accentColor: '#f43f5e',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)',
      text: '#ffffff',
      shadow: '0 8px 24px rgba(225, 29, 72, 0.35)',
    },
  },

  'midnight-sapphire': {
    id: 'midnight-sapphire',
    name: 'Safira Meia-Noite & Prata',
    subtitle: 'Azul marinho celestial, reflexos de safira estrelada e detalhes cromados.',
    previewBg: 'linear-gradient(135deg, #050d1a 0%, #0b1a36 50%, #050d1a 100%)',
    previewBorder: '#38bdf8',
    previewAccent: '#7dd3fc',
    previewBadge: 'Safira',
    bodyClass: 'theme-midnight-sapphire',
    heroGradient: 'radial-gradient(ellipse at 50% 20%, #0c234a 0%, #07152d 50%, #030a17 100%)',
    badgeStyle: {
      bg: 'rgba(56, 189, 248, 0.15)',
      border: '1px solid rgba(56, 189, 248, 0.45)',
      text: '#bae6fd',
    },
    cardStyle: {
      bg: 'rgba(8, 20, 42, 0.85)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      text: '#ffffff',
    },
    accentColor: '#38bdf8',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      text: '#ffffff',
      shadow: '0 8px 24px rgba(2, 132, 199, 0.35)',
    },
  },

  'minimal-ivory': {
    id: 'minimal-ivory',
    name: 'Marfim Editorial & Champagne',
    subtitle: 'Luminosidade editorial, mármore champanhe e tipografia limpa de alta-costura.',
    previewBg: 'linear-gradient(135deg, #f8f6f0 0%, #eee8dd 50%, #e2d9cc 100%)',
    previewBorder: '#b45309',
    previewAccent: '#78350f',
    previewBadge: 'Marfim & Ouro',
    bodyClass: 'theme-minimal-ivory',
    heroGradient: 'radial-gradient(ellipse at 50% 20%, #ffffff 0%, #f7f3eb 50%, #ede5d8 100%)',
    badgeStyle: {
      bg: 'rgba(180, 83, 9, 0.1)',
      border: '1px solid rgba(180, 83, 9, 0.3)',
      text: '#78350f',
    },
    cardStyle: {
      bg: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(180, 83, 9, 0.15)',
      text: '#261611',
    },
    accentColor: '#b45309',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #92400e 0%, #78350f 100%)',
      text: '#ffffff',
      shadow: '0 8px 24px rgba(146, 64, 14, 0.25)',
    },
  },
};

export function resolveEventTheme(rawTheme?: string | null): EventTheme {
  const key = (rawTheme || 'gala-gold').toLowerCase().trim();
  if (EVENT_THEMES[key]) return EVENT_THEMES[key];
  if (key === 'gold' || key === 'default') return EVENT_THEMES['gala-gold'];
  if (key === 'emerald' || key === 'green') return EVENT_THEMES['royal-emerald'];
  if (key === 'burgundy' || key === 'rose' || key === 'wine') return EVENT_THEMES['velvet-burgundy'];
  if (key === 'sapphire' || key === 'blue' || key === 'navy') return EVENT_THEMES['midnight-sapphire'];
  if (key === 'ivory' || key === 'white' || key === 'minimal') return EVENT_THEMES['minimal-ivory'];
  return EVENT_THEMES['gala-gold'];
}
