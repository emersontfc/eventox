import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emerson Charles | Gala de Graduação 2026",
  description: "Contagem regressiva e organização dos convidados da gala de graduação de Medicina.",
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
