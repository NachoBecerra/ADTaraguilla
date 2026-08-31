import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";
import { site } from "@/data/site";
import Cabecera from "@/components/Cabecera";
import { ClubJsonLd } from "@/components/DatosEstructurados";
import PieDePagina from "@/components/PieDePagina";
import AvisoInstalar from "@/components/AvisoInstalar";
import RegistrarSW from "@/components/RegistrarSW";
import AvisoDatosNuevos from "@/components/AvisoDatosNuevos";
import { actualizado } from "@/lib/competicion";

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
  // Sin canónico, una misma página accesible por varias direcciones compite
  // consigo misma en los buscadores
  alternates: { canonical: "/" },
  keywords: [
    site.nombre,
    site.nombreLargo,
    "fútbol San Roque",
    "fútbol base Cádiz",
    "Campo de Gibraltar",
    "Primera Andaluza",
    "RFAF",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: site.nombre,
    title: `${site.nombre} — Web oficial`,
    description: site.descripcion,
  },
  icons: {
    icon: site.escudo,
    // iPhone no lee los iconos del manifest: usa este
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: site.nombre,
    // La barra de estado se funde con el verde de la cabecera
    statusBarStyle: "black-translucent",
  },
  twitter: {
    // La grande enseña la imagen al compartir; la pequeña solo un recuadro
    card: "summary_large_image",
    title: `${site.nombre} — Web oficial`,
    description: site.descripcion,
  },
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
        <ClubJsonLd />
        <Cabecera />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <PieDePagina />
        <AvisoInstalar />
        <RegistrarSW />
        <AvisoDatosNuevos generado={actualizado} />
      </body>
    </html>
  );
}
