import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La sección se llamó /palmares durante unas horas: por si alguien
  // compartió el enlace, se redirige en vez de dar un 404.
  /*
   * El propio service worker no puede quedar cacheado: si el navegador se
   * queda con una copia vieja, no habría forma de corregirlo nunca.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/palmares", destination: "/historico", permanent: true },
      // Hubo un panel de Decap aquí; quien tenga el enlace guardado va al bueno
      { source: "/admin", destination: "/panel", permanent: true },
      { source: "/admin/:resto*", destination: "/panel", permanent: true },
    ];
  },

  images: {
    remotePatterns: [
      // Escudos de los clubes, servidos por la CDN de la RFAF
      { protocol: "https", hostname: "rfaf.filesnovanet.es" },
      { protocol: "https", hostname: "files.rfaf.es" },
      // Fotos de la galería y portadas de noticias, en Vercel Blob
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
