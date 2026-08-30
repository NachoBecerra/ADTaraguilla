import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { dimensionesDe } from "@/lib/imagenes";
import galeriaData from "@/data/galeria.json";

const DIR_NOTICIAS = path.join(process.cwd(), "content", "noticias");
const AUTOR_POR_DEFECTO = "AD Taraguilla";

export type Noticia = {
  slug: string;
  titulo: string;
  fecha: string;
  resumen: string;
  portada: string;
  autor: string;
  categoria: string;
  destacada: boolean;
  cuerpoHtml: string;
};

function leerArchivosMd(): string[] {
  if (!fs.existsSync(DIR_NOTICIAS)) return [];
  return fs.readdirSync(DIR_NOTICIAS).filter((f) => f.endsWith(".md"));
}

function parsearNoticia(archivo: string): Noticia {
  const crudo = fs.readFileSync(path.join(DIR_NOTICIAS, archivo), "utf8");
  const { data, content } = matter(crudo);

  return {
    slug: (data.slug as string) ?? archivo.replace(/\.md$/, ""),
    titulo: (data.titulo as string) ?? "Sin título",
    // El CMS guarda la fecha como Date; la normalizamos a ISO para poder ordenar.
    fecha: new Date((data.fecha as string) ?? Date.now()).toISOString(),
    resumen: (data.resumen as string) ?? "",
    portada: (data.portada as string) ?? "",
    autor: (data.autor as string) ?? AUTOR_POR_DEFECTO,
    categoria: (data.categoria as string) ?? "Club",
    destacada: Boolean(data.destacada),
    cuerpoHtml: marked.parse(content, { async: false }),
  };
}

export function getNoticias(): Noticia[] {
  return leerArchivosMd()
    .map(parsearNoticia)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function getNoticia(slug: string): Noticia | undefined {
  return getNoticias().find((n) => n.slug === slug);
}

export function getCategorias(): string[] {
  return [...new Set(getNoticias().map((n) => n.categoria))].sort();
}

/* ---------------------------------------------------------------- galería */

/** Una entrada de la galería tal y como se guarda: puede llevar varias fotos. */
export type EntradaGaleria = {
  id?: string;
  tipo: "foto" | "video";
  titulo: string;
  fecha: string;
  album: string;
  fotos?: string[] | string;
  youtubeId?: string;
};

/** Una foto o vídeo suelto, que es lo que se pinta en la galería. */
export type ItemGaleria = {
  id: string;
  tipo: "foto" | "video";
  titulo: string;
  fecha: string;
  album: string;
  src: string;
  youtubeId?: string;
  /** Dimensiones reales, para enseñar la foto entera sin saltos de maquetación. */
  ancho: number;
  alto: number;
};

/** El widget de imagen devuelve una cadena si se elige una sola foto. */
function comoLista(fotos?: string[] | string): string[] {
  if (!fotos) return [];
  return (Array.isArray(fotos) ? fotos : [fotos]).filter(Boolean);
}

/** Identificador estable a partir del texto, para no exigirlo al publicar. */
function aSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Aplana las entradas en fotos sueltas. Una entrada con seis fotos de un
 * partido son seis piezas en la galería, todas con el mismo título y álbum.
 */
export function getGaleria(): ItemGaleria[] {
  const items: ItemGaleria[] = [];
  const usados = new Set<string>();

  /** Nunca dos claves iguales, aunque se repitan títulos o falten ids. */
  const idUnico = (base: string): string => {
    const raiz = aSlug(base) || "foto";
    let id = raiz;
    for (let n = 2; usados.has(id); n++) id = `${raiz}-${n}`;
    usados.add(id);
    return id;
  };

  for (const entrada of galeriaData.items as EntradaGaleria[]) {
    const fotos = comoLista(entrada.fotos);

    if (entrada.tipo === "video") {
      // Las miniaturas de YouTube siempre vienen en 480x360
      const src = fotos[0] ?? "";
      const medida = src ? dimensionesDe(src) : null;
      items.push({
        ...entrada,
        id: idUnico(entrada.id || `${entrada.titulo}-${entrada.fecha}`),
        src,
        ancho: medida?.ancho ?? 480,
        alto: medida?.alto ?? 360,
      });
      continue;
    }

    if (fotos.length === 0) continue; // entrada sin foto: no hay nada que enseñar

    for (const src of fotos) {
      const medida = dimensionesDe(src);
      items.push({
        ...entrada,
        id: idUnico(entrada.id || `${entrada.titulo}-${entrada.fecha}`),
        src,
        ancho: medida?.ancho ?? 4,
        alto: medida?.alto ?? 3,
      });
    }
  }

  return items.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function getAlbumes(): string[] {
  return [...new Set(getGaleria().map((i) => i.album))];
}

