import type { MetadataRoute } from "next";
import { site } from "@/data/site";

/**
 * Los datos que el móvil necesita para instalar la web como una aplicación.
 *
 * Con esto, el navegador ofrece añadirla a la pantalla de inicio y, una vez
 * dentro, se abre sin barra de direcciones: se comporta como una app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.nombre} — Web oficial`,
    // El que sale bajo el icono en la pantalla de inicio: tiene que ser corto
    // o el móvil lo recorta con puntos suspensivos
    short_name: site.nombre,
    description: site.descripcion,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#265612",
    theme_color: "#265612",
    lang: "es-ES",
    categories: ["sports"],
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android recorta el icono a la forma del sistema (círculo, cuadrado
      // redondeado…). Sin una versión preparada para eso, el escudo sale
      // cortado por los bordes.
      {
        src: "/icono-mascara-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Equipos", url: "/equipos" },
      { name: "Noticias", url: "/noticias" },
      { name: "Galería", url: "/galeria" },
    ],
  };
}
