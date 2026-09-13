/**
 * El texto corto que acompaña a una noticia cuando se comparte.
 *
 * Facebook, X y WhatsApp montan la tarjeta de un enlace con la foto, el título y
 * una descripción. La descripción salía del resumen de la noticia, y ninguna
 * noticia lo tenía relleno: al compartir en Facebook solo se veía la foto. Así
 * que, si no hay resumen, se saca de las primeras frases del cuerpo.
 *
 * Sin dependencias, para poder probarlo solo con
 * `node scripts/panel/probar.mjs`.
 */

/** Lo que cabe sin que Facebook y Google lo corten a mitad. */
export const LARGO_EXTRACTO = 160;

/** El Markdown convertido en texto plano de una línea. */
export function textoPlano(markdown: string): string {
  return (
    markdown
      // Imágenes y bloques de código: no son texto que leer
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/```[\s\S]*?```/g, " ")
      // Enlaces: se queda el texto, no la dirección
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // HTML suelto
      .replace(/<[^>]+>/g, " ")
      // Marcas de título, cita y lista al principio de línea
      .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, "")
      // Negritas, cursivas y código en línea
      .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, "$2")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * El resumen si lo hay; si no, el principio del cuerpo, cortado en una palabra
 * y sin quedarse a medias de una frase cuando se puede evitar.
 */
export function extractoDe(resumen: string | null | undefined, cuerpo: string): string {
  const propio = (resumen ?? "").trim();
  if (propio) return propio;

  const texto = textoPlano(cuerpo);
  if (texto.length <= LARGO_EXTRACTO) return texto;

  const recorte = texto.slice(0, LARGO_EXTRACTO);

  // Mejor terminar en un punto, si hay uno lo bastante avanzado
  const punto = recorte.lastIndexOf(". ");
  if (punto >= LARGO_EXTRACTO * 0.6) return recorte.slice(0, punto + 1);

  const espacio = recorte.lastIndexOf(" ");
  return `${recorte.slice(0, espacio > 0 ? espacio : LARGO_EXTRACTO).replace(/[,;:\s]+$/, "")}…`;
}
