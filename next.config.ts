import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La sección se llamó /palmares durante unas horas: por si alguien
  // compartió el enlace, se redirige en vez de dar un 404.
  async redirects() {
    return [{ source: "/palmares", destination: "/historico", permanent: true }];
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
