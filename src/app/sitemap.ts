import type { MetadataRoute } from "next";
import { site } from "@/data/site";
import { getNoticias } from "@/lib/contenido";
import { getEquipos } from "@/lib/competicion";

export default function sitemap(): MetadataRoute.Sitemap {
  const estaticas = ["", "/equipos", "/noticias", "/galeria", "/palmares"].map((ruta) => ({
    url: `${site.url}${ruta}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: ruta === "" ? 1 : 0.8,
  }));

  const noticias = getNoticias().map((n) => ({
    url: `${site.url}/noticias/${n.slug}`,
    lastModified: new Date(n.fecha),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const equipos = getEquipos().map((e) => ({
    url: `${site.url}/equipos/${e.id}`,
    lastModified: new Date(e.actualizado),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...estaticas, ...equipos, ...noticias];
}
