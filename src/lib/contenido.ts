import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { dimensionesDe } from "@/lib/imagenes";
import { getEquipos } from "@/lib/competicion";
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
  /**
   * Entrada de la galería con las fotos que acompañan a la noticia.
   *
   * Se guarda **la referencia y no las fotos**. Así solo hay un sitio donde
   * viven: si el club borra una foto desde la galería, desaparece también de la
   * noticia en vez de dejar un hueco roto, y retocar el título o las etiquetas
   * de la entrada no obliga a tocar la noticia.
   */
  galeria: string;
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
    galeria: (data.galeria as string) ?? "",
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
  titulo: string;
  fecha: string;
  /** Varias etiquetas: equipo, temporada, jugador, lo que haga falta. */
  albumes?: string[] | string;
  /** Formato antiguo, de una sola etiqueta. Se sigue leyendo. */
  album?: string;
  fotos?: FotoGuardada[] | string[] | string;
  /**
   * Equipos a los que pertenecen estas fotos, por identificador.
   *
   * Se guarda el id y no el nombre a propósito: el nombre puede cambiar
   * ("Alevín B" pasa a "Alevín"), y entonces las fotos se despegarían del
   * equipo. El nombre se resuelve al pintar.
   */
  equipos?: string[];
};

/**
 * Una foto tal y como se guarda desde que las imágenes viven en Vercel Blob.
 *
 * El navegador ya sabe cuánto mide la foto cuando la reduce, así que apunta
 * las medidas al subirla: fuera del repositorio no hay archivo local del que
 * leerlas en tiempo de compilación.
 */
export type FotoGuardada = { url: string; ancho: number; alto: number };

/** Una foto suelta, que es lo que se pinta en la galería. */
export type ItemGaleria = {
  id: string;
  /** Entrada de la que sale, para poder pedir las fotos de una noticia. */
  entrada: string;
  titulo: string;
  fecha: string;
  albumes: string[];
  /** Identificadores de los equipos a los que se asignó la foto. */
  equipos: string[];
  src: string;
  /** Dimensiones reales, para enseñar la foto entera sin saltos de maquetación. */
  ancho: number;
  alto: number;
};

/** Admite tanto una lista como un valor suelto, que es como se guardaba antes. */
function comoLista(valor?: string[] | string): string[] {
  if (!valor) return [];
  return (Array.isArray(valor) ? valor : [valor]).map((v) => v.trim()).filter(Boolean);
}

/**
 * Normaliza las fotos de una entrada.
 *
 * Conviven dos formatos: las de antes eran una ruta suelta dentro de /public
 * y hay que medirlas leyendo el archivo; las nuevas viven en Blob y traen las
 * medidas puestas.
 */
export function fotosDe(valor?: FotoGuardada[] | string[] | string): FotoGuardada[] {
  if (!valor) return [];
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista.flatMap((f) => {
    if (typeof f !== "string") return f.url ? [f] : [];
    const src = f.trim();
    if (!src) return [];
    const medida = dimensionesDe(src);
    return [{ url: src, ancho: medida?.ancho ?? 4, alto: medida?.alto ?? 3 }];
  });
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
    titulo: e.titulo,
    albumes: etiquetasDe(e),
    equipos: comoLista(e.equipos),
    fecha: e.fecha,
    fotos: fotosDe(e.fotos),
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

  // Para pintar el nombre a partir del id guardado
  const nombreDeEquipo = new Map(getEquipos().map((e) => [e.id, e.nombre]));

  for (const entrada of galeriaData.items as EntradaGaleria[]) {
    const fotos = fotosDe(entrada.fotos);
    const equipos = comoLista(entrada.equipos);

    // El equipo se comporta además como una etiqueta más, para que el filtro
    // de la galería lo encuentre sin tener que duplicarlo a mano al subir
    const etiquetas = [...etiquetasDe(entrada)];
    for (const id of equipos) {
      const nombre = nombreDeEquipo.get(id);
      if (nombre && !etiquetas.some((a) => a.toLowerCase() === nombre.toLowerCase())) {
        etiquetas.push(nombre);
      }
    }
    if (fotos.length === 0) continue; // entrada sin foto: no hay nada que enseñar

    for (const foto of fotos) {
      items.push({
        ...entrada,
        albumes: etiquetas,
        equipos,
        entrada: entrada.id ?? "",
        id: idUnico(entrada.id || `${entrada.titulo}-${entrada.fecha}`),
        src: foto.url,
        ancho: foto.ancho,
        alto: foto.alto,
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

/** Fotos de una entrada concreta: las que acompañan a una noticia. */
export function getGaleriaDeEntrada(id: string): ItemGaleria[] {
  if (!id) return [];
  return getGaleria().filter((i) => i.entrada === id);
}

/** Fotos asignadas a un equipo, de la más reciente a la más antigua. */
export function getGaleriaDeEquipo(id: string): ItemGaleria[] {
  return getGaleria().filter((i) => i.equipos.includes(id));
}
