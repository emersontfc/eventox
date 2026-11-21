export type ProgramItem = { time: string; title: string; description: string };

export function defaultProgram(slug: string): ProgramItem[] {
  if (slug !== "emerson") return [];
  return [
  {
    "time": "14:00",
    "title": "Recepção & Boas-Vindas aos Convidados",
    "description": "Check-in no tapete de honra, atribuição de mesas e cocktail de boas-vindas com canapés."
  },
  {
    "time": "15:00",
    "title": "Entrada Solene & Discursos de Homenagem",
    "description": "Entrada oficial do homenageado, palavras da família, colegas e mesa de honra."
  },
  {
    "time": "16:30",
    "title": "Brinde de Honra & Sessão Fotográfica",
    "description": "Brinde de celebração com espumante e sessão de fotos por mesas no backdrop oficial."
  },
  {
    "time": "17:30",
    "title": "Banquete de Gala & Abertura do Buffet",
    "description": "Serviço de catering premium com pratos quentes, saladas e sobremesas finas."
  },
  {
    "time": "19:30",
    "title": "Corte do Bolo & Abertura da Pista de Dança",
    "description": "Música ao vivo, DJ da noite, serviço de bar e celebração até ao final."
  }
];
}
