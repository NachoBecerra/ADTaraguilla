/**
 * Enlazar un bloque concreto de la portada.
 *
 * Sirve para compartir «mira los resultados de esta semana» sin que quien abra
 * el enlace tenga que buscarlos: la página se coloca sola en ese bloque.
 *
 * Se aceptan las tres formas que la gente escribe o copia, porque el enlace lo
 * comparte una persona, no un programa:
 *
 *     ad-taraguilla.es/#resultados
 *     ad-taraguilla.es/?resultados
 *     ad-taraguilla.es/?seccion=ultimos-resultados
 *
 * Sin dependencias: se prueba con `node scripts/panel/probar.mjs`.
 */

/** Los bloques de la portada que se pueden enlazar. */
export const SECCIONES = ["resultados", "proximos", "noticias", "galeria"] as const;

export type Seccion = (typeof SECCIONES)[number];

/**
 * Cómo lo escribe la gente. La clave es lo que se puede poner en la dirección;
 * el valor, el bloque al que lleva.
 *
 * Sin tildes ni mayúsculas: lo que llega se normaliza antes de buscar aquí.
 */
const NOMBRES: Record<string, Seccion> = {
  resultados: "resultados",
  "ultimos-resultados": "resultados",
  ultimosresultados: "resultados",

  proximos: "proximos",
  "proximos-partidos": "proximos",
  proximospartidos: "proximos",
  partidos: "proximos",
  horarios: "proximos",
  calendario: "proximos",

  noticias: "noticias",
  actualidad: "noticias",

  galeria: "galeria",
  fotos: "galeria",
  imagenes: "galeria",
};

/** Quita tildes, espacios y mayúsculas: «Últimos Resultados» y «ultimos-resultados» son lo mismo. */
function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_]+/g, "-");
}

/** El bloque al que apunta un nombre, si es uno de los nuestros. */
export function seccionPorNombre(nombre: string | null | undefined): Seccion | null {
  if (!nombre) return null;
  return NOMBRES[normalizar(nombre)] ?? null;
}

/**
 * Qué bloque pide una dirección, mirando primero el `#` y luego lo que va
 * detrás de `?`.
 *
 * De la parte de la interrogación vale tanto `?seccion=resultados` como
 * `?resultados` a secas, que es como lo escribiría cualquiera. Lo que no
 * reconocemos se ignora: una dirección con `?utm_source=facebook` abre la
 * portada de siempre, no un error.
 */
export function seccionDesdeUrl(search: string | null, hash: string | null): Seccion | null {
  const porHash = seccionPorNombre((hash ?? "").replace(/^#/, ""));
  if (porHash) return porHash;

  const parametros = new URLSearchParams((search ?? "").replace(/^\?/, ""));

  const declarada = seccionPorNombre(parametros.get("seccion") ?? parametros.get("ir"));
  if (declarada) return declarada;

  // `?resultados`: la clave sin valor es el nombre del bloque
  for (const [clave, valor] of parametros) {
    if (valor) continue;
    const suelta = seccionPorNombre(clave);
    if (suelta) return suelta;
  }

  return null;
}
