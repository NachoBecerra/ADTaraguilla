/**
 * Utilidades para leer las tablas del portal PNFG.
 *
 * El HTML de la RFAF no tiene ids ni clases estables, así que trabajamos sobre
 * la estructura de tablas: filas y celdas. Es lo único que se ha mantenido
 * constante entre temporadas.
 */

const ENTIDADES = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ordf: "ª", ordm: "º", deg: "°", middot: "·", ndash: "–", mdash: "—",
};

export function decodificar(texto) {
  return texto
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? m);
}

/** Quita scripts y estilos, que ensucian cualquier extracción posterior. */
export function limpiar(html) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
}

/** Texto plano de un fragmento de HTML, con espacios normalizados. */
export function texto(fragmento) {
  return decodificar(fragmento.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Todas las filas de la página como arrays de celdas en texto plano. */
export function filas(html) {
  return [...limpiar(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => ({
    html: m[1],
    // Las celdas vacías (separadores, iconos) solo estorban al leer la tabla
    celdas: [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((c) => texto(c[1]))
      .filter((c) => c !== ""),
  }));
}

/** Primer enlace de un fragmento que contenga `patron`. */
export function enlace(fragmento, patron) {
  const encontrados = [...fragmento.matchAll(/(?:href|onclick)\s*=\s*["']?[^"'>]*?((?:\/pnfg\/NPcd\/)?NFG_[A-Za-z_]+\?[^"'>\s)]+)/g)];
  const bueno = encontrados.find((m) => m[1].includes(patron));
  return bueno ? bueno[1] : null;
}

/** Todos los enlaces NFG_* de la página, sin repetir. */
export function enlaces(html, patron) {
  const todos = [...limpiar(html).matchAll(/(?:href|onclick)\s*=\s*["']?[^"'>]*?((?:\/pnfg\/NPcd\/)?NFG_[A-Za-z_]+\?[^"'>\s)]+)/g)]
    .map((m) => m[1]);
  return [...new Set(patron ? todos.filter((u) => u.includes(patron)) : todos)];
}

/** Valor de un parámetro dentro de una URL del portal. */
export function parametro(url, nombre) {
  const m = new RegExp(`[?&]${nombre}=([^&"'\\s]*)`, "i").exec(url ?? "");
  return m ? m[1] : null;
}

/**
 * Corta el HTML en bloques por temporada.
 * En "Competiciones del Equipo" cada tabla va precedida del rótulo "2026-2027".
 */
export function bloquesPorTemporada(html) {
  const limpio = limpiar(html);
  const marcas = [...limpio.matchAll(/((?:19|20)\d{2}\s*-\s*(?:19|20)\d{2})/g)];
  return marcas.map((marca, i) => ({
    temporada: marca[1].replace(/\s/g, ""),
    html: limpio.slice(marca.index, marcas[i + 1]?.index ?? limpio.length),
  }));
}

/** "12-09-2026" o "12/09/2026" -> "2026-09-12". */
export function fechaIso(texto) {
  const m = /(\d{2})[-/](\d{2})[-/](\d{4})/.exec(texto ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "19:30" -> "19:30"; si no hay hora asignada todavía, null. */
export function hora(texto) {
  const m = /\b([0-2]?\d):([0-5]\d)\b/.exec(texto ?? "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

/** "7 - 3" -> [7, 3]; sin resultado todavía, null. */
export function marcador(texto) {
  const m = /(\d{1,3})\s*-\s*(\d{1,3})/.exec(texto ?? "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Convierte un nombre en un identificador apto para URL. */
export function aSlug(texto) {
  return decodificar(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
