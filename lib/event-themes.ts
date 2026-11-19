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
    subtitle: 'Estilo Black-Tie majestoso com preto obsidiana profundo e detalhes em ouro 24K metálico.',
    previewBg: 'linear-gradient(135deg, #08090d 0%, #171822 50%, #08090d 100%)',
    previewBorder: '#d4af37',
    previewAccent: '#f5d77f',
    previewBadge: 'Ouro 24K',
    bodyClass: 'theme-gala-gold',
    heroGradient: 'radial-gradient(ellipse at 50% 15%, #232433 0%, #0f1017 45%, #08090d 100%)',
    badgeStyle: {
      bg: 'rgba(212, 175, 55, 0.12)',
      border: '1px solid rgba(212, 175, 55, 0.35)',
      text: '#f3db8b',
    },
    cardStyle: {
      bg: 'rgba(16, 17, 24, 0.88)',
      border: '1px solid rgba(212, 175, 55, 0.22)',
      text: '#ffffff',
    },
    accentColor: '#d4af37',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #e6ca65 0%, #d4af37 50%, #aa820a 100%)',
      text: '#050505',
      shadow: '0 8px 24px rgba(212, 175, 55, 0.38)',
    },
  },

  'royal-emerald': {
    id: 'royal-emerald',
    name: 'Esmeralda Imperial & Ouro Nobre',
    subtitle: 'Verde esmeralda imperial profundo, veludo floresta e arabescos dourados de alta nobreza.',
    previewBg: 'linear-gradient(135deg, #020c08 0%, #072e20 50%, #020c08 100%)',
    previewBorder: '#10b981',
    previewAccent: '#34d399',
    previewBadge: 'Esmeralda',
    bodyClass: 'theme-royal-emerald',
    heroGradient: 'radial-gradient(ellipse at 50% 15%, #083827 0%, #051e14 45%, #020c08 100%)',
    badgeStyle: {
      bg: 'rgba(16, 185, 129, 0.12)',
      border: '1px solid rgba(16, 185, 129, 0.35)',
      text: '#6ee7b7',
    },
    cardStyle: {
      bg: 'rgba(5, 24, 17, 0.88)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      text: '#ffffff',
    },
    accentColor: '#10b981',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #047857 100%)',
      text: '#ffffff',
      shadow: '0 8px 24px rgba(16, 185, 129, 0.38)',
    },
  },

  'velvet-burgundy': {
    id: 'velvet-burgundy',
    name: 'Borgonha Veludo & Rose Gold',
    subtitle: 'Vinho tinto nobre, rubi sofisticado com iluminação suave em ouro rosa e champanhe.',
    previewBg: 'linear-gradient(135deg, #0d0307 0%, #290815 50%, #0d0307 100%)',
    previewBorder: '#f43f5e',
    previewAccent: '#fda4af',
    previewBadge: 'Borgonha',
    bodyClass: 'theme-velvet-burgundy',
    heroGradient: 'radial-gradient(ellipse at 50% 15%, #3d0d21 0%, #1f0611 45%, #0d0307 100%)',
    badgeStyle: {
      bg: 'rgba(244, 63, 94, 0.12)',
      border: '1px solid rgba(244, 63, 94, 0.35)',
      text: '#fecdd3',
    },
    cardStyle: {
      bg: 'rgba(28, 8, 16, 0.88)',
      border: '1px solid rgba(244, 63, 94, 0.25)',
      text: '#ffffff',
    },
    accentColor: '#f43f5e',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #9f1239 100%)',
      text: '#ffffff',
      shadow: '0 8px 24px rgba(244, 63, 94, 0.38)',
    },
  },

  'midnight-sapphire': {
    id: 'midnight-sapphire',
    name: 'Safira Meia-Noite & Prata Estelar',
    subtitle: 'Azul marinho celestial, reflexos de safira estrelada e detalhes cromados luminosos.',
    previewBg: 'linear-gradient(135deg, #020712 0%, #081a3d 50%, #020712 100%)',
    previewBorder: '#38bdf8',
    previewAccent: '#7dd3fc',
    previewBadge: 'Safira',
    bodyClass: 'theme-midnight-sapphire',
    heroGradient: 'radial-gradient(ellipse at 50% 15%, #0d2657 0%, #061530 45%, #020712 100%)',
    badgeStyle: {
      bg: 'rgba(56, 189, 248, 0.12)',
      border: '1px solid rgba(56, 189, 248, 0.35)',
      text: '#bae6fd',
    },
    cardStyle: {
      bg: 'rgba(7, 19, 42, 0.88)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      text: '#ffffff',
    },
    accentColor: '#38bdf8',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 50%, #0369a1 100%)',
      text: '#ffffff',
      shadow: '0 8px 24px rgba(56, 189, 248, 0.38)',
    },
  },

  'minimal-ivory': {
    id: 'minimal-ivory',
    name: 'Marfim Editorial & Champagne (Vogue)',
    subtitle: 'Luminosidade editorial, mármore champanhe e tipografia nítida de alta-costura.',
    previewBg: 'linear-gradient(135deg, #fbfbf9 0%, #eee8dd 50%, #e2d9cc 100%)',
    previewBorder: '#b45309',
    previewAccent: '#78350f',
    previewBadge: 'Marfim & Ouro',
    bodyClass: 'theme-minimal-ivory',
    heroGradient: 'radial-gradient(ellipse at 50% 15%, #ffffff 0%, #f7f4ec 50%, #ece5d6 100%)',
    badgeStyle: {
      bg: 'rgba(180, 83, 9, 0.08)',
      border: '1px solid rgba(180, 83, 9, 0.25)',
      text: '#78350f',
    },
    cardStyle: {
      bg: 'rgba(255, 255, 255, 0.96)',
      border: '1px solid rgba(180, 83, 9, 0.18)',
      text: '#18181b',
    },
    accentColor: '#b45309',
    buttonPrimary: {
      bg: 'linear-gradient(135deg, #b45309 0%, #92400e 50%, #78350f 100%)',
      text: '#ffffff',
      shadow: '0 8px 24px rgba(180, 83, 9, 0.3)',
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
