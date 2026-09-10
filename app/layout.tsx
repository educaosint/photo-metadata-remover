import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LimpiaFoto | Elimina metadatos de tus fotos — Educa OSINT",
  description:
    "Elimina ubicación GPS, fecha, dispositivo y otros metadatos ocultos de tus fotos antes de compartirlas. Gratis y sin subir archivos.",
  icons: { icon: "/educa-osint-logo.png", shortcut: "/educa-osint-logo.png" },
  manifest: "/manifest.webmanifest",
  themeColor: "#0a2639",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
