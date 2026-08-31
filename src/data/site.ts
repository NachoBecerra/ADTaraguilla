/**
 * Configuración central del sitio.
 * Todo lo que el club necesita cambiar (nombre, redes, contacto, federación)
 * vive aquí. Los colores están en src/app/globals.css.
 */

export const site = {
  nombre: "AD Taraguilla",
  nombreLargo: "Agrupación Deportiva Taraguilla",
  lema: "Cantera, barrio y fútbol",
  localidad: "Taraguilla, San Roque (Cádiz)",
  fundacion: "1969", // TODO: confirmar año real de fundación
  escudo: "/img/escudo.png",
  url: "https://ad-taraguilla.vercel.app", // TODO: cambiar al dominio propio cuando lo haya
  descripcion:
    "Web oficial de la AD Taraguilla, club de fútbol de San Roque (Cádiz): noticias, resultados y clasificaciones de sus nueve equipos, galería de fotos y el histórico del club.",

  contacto: {
    email: "info@adtaraguilla.es", // TODO
    telefono: "", // opcional
    campo: "Campo Municipal Hermanos García Mota",
    direccion: "San Roque (Cádiz)",
    mapaUrl: "https://maps.app.goo.gl/vtfdquUtJBExsGbFA",
  },

  /** Redes sociales. Deja la url vacía ("") para ocultar la red del sitio. */
  redes: [
    { id: "instagram", nombre: "Instagram", url: "https://www.instagram.com/a.d.taraguilla/", handle: "@a.d.taraguilla" },
    { id: "facebook", nombre: "Facebook", url: "https://www.facebook.com/TaraguillaAD", handle: "AD Taraguilla" },
    // X sin actualizar desde 2021: se deja fuera dejando la url vacía
    { id: "x", nombre: "X", url: "", handle: "" },
    { id: "youtube", nombre: "YouTube", url: "", handle: "" },
    { id: "tiktok", nombre: "TikTok", url: "", handle: "" },
    { id: "whatsapp", nombre: "WhatsApp", url: "", handle: "" },
  ] as const,

  /**
   * Federación de referencia. Categoría, grupo, calendario, resultados y
   * rivales no se escriben aquí: los sincroniza scripts/rfaf a partir del
   * código de club de src/data/equipos.json.
   */
  federacion: {
    nombre: "Real Federación Andaluza de Fútbol",
    siglas: "RFAF",
    delegacion: "Delegación de Cádiz",
    url: "https://www.rfaf.es",
    /** Página de competiciones/clasificaciones de la RFAF. */
    competicionesUrl:
      "https://www.rfaf.es/pnfg/NPcd/NFG_LstCompeticiones_Vis?cod_primaria=1000123",
  },

} as const;

export type Red = (typeof site.redes)[number];

/** Solo las redes que tienen URL configurada. */
export const redesActivas = site.redes.filter((r) => r.url.length > 0);
