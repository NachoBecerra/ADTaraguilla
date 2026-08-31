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
  /** Etiquetas libres, además de la categoría: equipo, temporada, jugador… */
  etiquetas: string[];
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
    etiquetas: comoLista(data.etiquetas as string[] | string | undefined),
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
  /** Varias etiquetas: equipo, temporada, jugador, lo que haga falta. */
  albumes?: string[] | string;
  /** Formato antiguo, de una sola etiqueta. Se sigue leyendo. */
  album?: string;
  fotos?: string[] | string;
  youtubeId?: string;
};

/** Una foto o vídeo suelto, que es lo que se pinta en la galería. */
export type ItemGaleria = {
  id: string;
  tipo: "foto" | "video";
  titulo: string;
  fecha: string;
  albumes: string[];
  src: string;
  youtubeId?: string;
  /** Dimensiones reales, para enseñar la foto entera sin saltos de maquetación. */
  ancho: number;
  alto: number;
};

/** Admite tanto una lista como un valor suelto, que es como se guardaba antes. */
function comoLista(valor?: string[] | string): string[] {
  if (!valor) return [];
  return (Array.isArray(valor) ? valor : [valor]).map((v) => v.trim()).filter(Boolean);
}

/** Etiquetas de una entrada, viniendo del formato nuevo o del antiguo. */
export function etiquetasDe(e: { albumes?: string[] | string; album?: string }): string[] {
  const lista = comoLista(e.albumes);
  return lista.length > 0 ? lista : comoLista(e.album);
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
/** Las entradas tal y como se guardan, para editarlas desde el panel. */
export function getEntradasGaleria() {
  return (galeriaData.items as EntradaGaleria[]).map((e, i) => ({
    id: e.id || `${aSlug(e.titulo ?? "foto")}-${i}`,
    tipo: e.tipo,
    titulo: e.titulo,
    albumes: etiquetasDe(e),
    fecha: e.fecha,
    fotos: comoLista(e.fotos),
  }));
}

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
        albumes: etiquetasDe(entrada),
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
        albumes: etiquetasDe(entrada),
        id: idUnico(entrada.id || `${entrada.titulo}-${entrada.fecha}`),
        src,
        ancho: medida?.ancho ?? 4,
        alto: medida?.alto ?? 3,
      });
    }
  }

  return items.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Todas las etiquetas en uso, de la más usada a la menos. */
export function getAlbumes(): string[] {
  const cuenta = new Map<string, number>();
  for (const i of getGaleria()) {
    for (const a of i.albumes) cuenta.set(a, (cuenta.get(a) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([a]) => a);
}

