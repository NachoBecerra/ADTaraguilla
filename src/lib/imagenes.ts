import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";

/**
 * Dimensiones reales de una imagen de /public.
 *
 * Las fotos que sube el club vienen en cualquier proporción: verticales del
 * móvil, cuadradas, apaisadas. Para poder enseñarlas enteras sin que la página
 * dé saltos al cargar hay que conocer su tamaño, y como son archivos locales se
 * puede leer de la cabecera en tiempo de compilación, que es barato.
 */

const PUBLICO = path.join(process.cwd(), "public");
const cache = new Map<string, Dimensiones | null>();

export type Dimensiones = { ancho: number; alto: number; ratio: number };

/** Proporción de reserva cuando no se puede leer la imagen. */
export const DIMENSIONES_POR_DEFECTO: Dimensiones = {
  ancho: 1600,
  alto: 900,
  ratio: 16 / 9,
};

export function dimensionesDe(src?: string | null): Dimensiones | null {
  if (!src || !src.startsWith("/")) return null;
  if (cache.has(src)) return cache.get(src) ?? null;

  let medida: Dimensiones | null = null;
  try {
    const { width, height } = imageSize(fs.readFileSync(path.join(PUBLICO, src)));
    if (width && height) medida = { ancho: width, alto: height, ratio: width / height };
  } catch {
    // Imagen que aún no existe o formato que no sabemos leer: se usa el respaldo
    medida = null;
  }

  cache.set(src, medida);
  return medida;
}

/** Dimensiones de la imagen, o la proporción de reserva si no se pueden leer. */
export function dimensionesOPorDefecto(src?: string | null): Dimensiones {
  return dimensionesDe(src) ?? DIMENSIONES_POR_DEFECTO;
}
