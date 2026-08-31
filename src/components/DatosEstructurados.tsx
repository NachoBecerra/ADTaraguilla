import { site } from "@/data/site";

/**
 * Datos estructurados (JSON-LD).
 *
 * Es la forma de decirle a Google qué es esto en vez de dejar que lo adivine
 * del texto: un club de fútbol, con su escudo, su localidad, sus redes y sus
 * noticias. Sin esto la web compite solo por coincidencia de palabras.
 */
export function ClubJsonLd() {
  const datos = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: site.nombreLargo,
    alternateName: site.nombre,
    url: site.url,
    logo: `${site.url}${site.escudo}`,
    sport: "Football",
    description: site.descripcion,
    address: {
      "@type": "PostalAddress",
      addressLocality: "San Roque",
      addressRegion: "Cádiz",
      addressCountry: "ES",
    },
    location: {
      "@type": "Place",
      name: site.contacto.campo,
      address: site.contacto.direccion,
    },
    memberOf: {
      "@type": "SportsOrganization",
      name: site.federacion.nombre,
      url: site.federacion.url,
    },
    sameAs: site.redes.filter((r) => r.url).map((r) => r.url),
  };

  return (
    <script
      type="application/ld+json"
      // El contenido lo generamos nosotros, no viene de fuera
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }}
    />
  );
}

/** Una noticia, para que pueda aparecer como artículo en los resultados. */
export function NoticiaJsonLd({
  titulo,
  resumen,
  fecha,
  portada,
  autor,
  url,
}: {
  titulo: string;
  resumen: string;
  fecha: string;
  portada?: string;
  autor: string;
  url: string;
}) {
  const datos = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: titulo,
    description: resumen,
    datePublished: fecha,
    dateModified: fecha,
    image: portada ? [`${site.url}${portada}`] : [`${site.url}/opengraph-image.png`],
    author: { "@type": "Organization", name: autor },
    publisher: {
      "@type": "Organization",
      name: site.nombreLargo,
      logo: { "@type": "ImageObject", url: `${site.url}${site.escudo}` },
    },
    mainEntityOfPage: url,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }}
    />
  );
}
