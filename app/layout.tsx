import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://eventox.kazix.site'),
  title: {
    default: 'EventoX | Gestão de eventos e experiências ao vivo',
    template: '%s | EventoX',
  },
  description: 'Organiza convidados, mesas, programa e equipa. Partilha o convite do evento e controla a experiência ao vivo com o Estúdio Live.',
  openGraph: { siteName: 'EventoX', type: 'website' },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className="antialiased">{children}</body>
    </html>
  );
}
