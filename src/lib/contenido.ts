import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
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

export type ItemGaleria = {
  id: string;
  tipo: "foto" | "video";
  titulo: string;
  fecha: string;
  album: string;
  /** Ruta de la imagen (fotos) o miniatura (vídeos). */
  src: string;
  /** ID del vídeo de YouTube, solo para tipo "video". */
  youtubeId?: string;
};

export function getGaleria(): ItemGaleria[] {
  return [...(galeriaData.items as ItemGaleria[])].sort((a, b) =>
    b.fecha.localeCompare(a.fecha),
  );
}

export function getAlbumes(): string[] {
  return [...new Set(getGaleria().map((i) => i.album))];
}

