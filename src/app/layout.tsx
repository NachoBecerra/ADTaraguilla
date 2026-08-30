import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";
import { site } from "@/data/site";
import Cabecera from "@/components/Cabecera";
import PieDePagina from "@/components/PieDePagina";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const cuerpo = Inter({
  variable: "--font-sans-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.nombre} — Web oficial`,
    template: `%s | ${site.nombre}`,
  },
  description: site.descripcion,
  applicationName: site.nombre,
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: site.nombre,
    title: `${site.nombre} — Web oficial`,
    description: site.descripcion,
  },
  icons: { icon: site.escudo },
};

export const viewport: Viewport = {
  themeColor: "#265612",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${cuerpo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-full focus:bg-club focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar al contenido
        </a>
        <Cabecera />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <PieDePagina />
      </body>
    </html>
  );
}
