import matter from "gray-matter";
import { listarCarpeta, leerArchivo } from "@/lib/panel/github";
import { getNoticias } from "@/lib/contenido";

/**
 * Noticias tal y como están AHORA en el repositorio.
 *
 * Igual que con la galería: leer el contenido compilado haría que un cambio
 * recién guardado no se viera hasta que la web se reconstruyese, y quien
 * edita pensaría que no se ha guardado.
 */

export const CARPETA = "content/noticias";

export type NoticiaPanel = {
  /** Ruta del archivo en el repositorio: es lo que identifica la noticia. */
  archivo: string;
  titulo: string;
  slug: string;
  fecha: string;
  categoria: string;
  resumen: string;
  portada: string;
  autor: string;
  destacada: boolean;
  cuerpo: string;
};

function deArchivo(nombre: string, crudo: string): NoticiaPanel {
  const { data, content } = matter(crudo);
  return {
    archivo: `${CARPETA}/${nombre}`,
    titulo: String(data.titulo ?? ""),
    slug: String(data.slug ?? nombre.replace(/\.md$/, "")),
    fecha: new Date(String(data.fecha ?? Date.now())).toISOString().slice(0, 10),
    categoria: String(data.categoria ?? "Club"),
    resumen: String(data.resumen ?? ""),
    portada: String(data.portada ?? ""),
    autor: String(data.autor ?? "AD Taraguilla"),
    destacada: Boolean(data.destacada),
    cuerpo: content.trim(),
  };
}

/**
 * `enVivo` dice si se ha podido leer el repositorio. Importa: el contenido
 * compilado no incluye el cuerpo de las noticias, así que si se editara desde
 * ahí se guardaría una noticia vacía. Cuando es false, el panel enseña la
 * lista pero no deja editar.
 */
export async function noticiasDelRepositorio(): Promise<{
  noticias: NoticiaPanel[];
  enVivo: boolean;
}> {
  try {
    const nombres = (await listarCarpeta(CARPETA)).filter((n) => n.endsWith(".md"));
    if (nombres.length === 0) throw new Error("sin noticias");

    const leidas = await Promise.all(
      nombres.map(async (n) => {
        const crudo = await leerArchivo(`${CARPETA}/${n}`);
        return crudo ? deArchivo(n, crudo) : null;
      }),
    );

    return {
      enVivo: true,
      noticias: leidas
        .filter((n): n is NoticiaPanel => n !== null)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    };
  } catch {
    // Sin token o con GitHub caído: se enseña lo compilado, pero sin editar
    const noticias = getNoticias().map((n) => ({
      archivo: "",
      titulo: n.titulo,
      slug: n.slug,
      fecha: n.fecha.slice(0, 10),
      categoria: n.categoria,
      resumen: n.resumen,
      portada: n.portada,
      autor: n.autor,
      destacada: n.destacada,
      cuerpo: "",
    }));

    return { noticias, enVivo: false };
  }
}

/** Categorías que ofrece el desplegable al escribir. */
export const CATEGORIAS = [
  "Primer equipo",
  "Cantera",
  "Club",
  "Afición",
  "Fútbol femenino",
] as const;
