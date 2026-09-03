import { leerArchivo } from "@/lib/panel/github";

/**
 * El archivo de la galería, tal y como está en el repositorio.
 *
 * Vive aparte porque ahora lo escriben **dos sitios**: la subida de fotos de la
 * galería y las fotos que se añaden a una noticia. Con una copia de esta lógica
 * en cada uno, bastaría con que una de las dos normalizara distinto para
 * empezar a corromper el archivo poco a poco.
 */

export const RUTA_GALERIA = "src/data/galeria.json";

/** Una foto guardada: la URL en el almacenamiento y sus medidas reales. */
export type Foto = { url: string; ancho: number; alto: number };

export type Entrada = {
  id: string;
  titulo: string;
  albumes: string[];
  /** Equipos a los que pertenece, por identificador. */
  equipos: string[];
  fecha: string;
  fotos: Foto[];
};

export function aSlug(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "foto"
  );
}

/** Admite lista o valor suelto, que es como se guardaba antes. */
export function comoLista(valor?: string[] | string): string[] {
  if (!valor) return [];
  return (Array.isArray(valor) ? valor : [valor]).map((v) => v.trim()).filter(Boolean);
}

/** Etiquetas de una entrada, del formato nuevo o del antiguo de un solo álbum. */
export function etiquetasDe(e: { albumes?: string[] | string; album?: string }): string[] {
  const lista = comoLista(e.albumes);
  return lista.length > 0 ? lista : comoLista(e.album);
}

/**
 * Normaliza las fotos.
 *
 * Las de antes eran una ruta dentro de /public y no llevaban medidas; las
 * nuevas viven en el almacenamiento y sí. Se leen las dos formas para no
 * romper lo que ya estaba publicado.
 */
export function fotosDe(valor?: Foto[] | string[] | string): Foto[] {
  if (!valor) return [];
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista.flatMap((f) => {
    if (typeof f !== "string") return f?.url ? [f] : [];
    const url = f.trim();
    return url ? [{ url, ancho: 0, alto: 0 }] : [];
  });
}

/** Lee el archivo del repositorio y normaliza las entradas. */
export async function leerGaleria(): Promise<{ items: Entrada[] }> {
  const crudo = await leerArchivo(RUTA_GALERIA);
  const datos = crudo ? JSON.parse(crudo) : {};

  const items: Entrada[] = (datos.items ?? []).map(
    (
      e: Partial<Entrada> & {
        fotos?: Foto[] | string[] | string;
        albumes?: string[] | string;
        album?: string;
        equipos?: string[] | string;
      },
      i: number,
    ) => ({
      titulo: e.titulo ?? "",
      albumes: etiquetasDe(e),
      equipos: comoLista(e.equipos),
      fecha: e.fecha ?? "",
      fotos: fotosDe(e.fotos),
      // Los identificadores antiguos podían faltar o repetirse: se aseguran
      // aquí para poder editar y borrar sin depender de la posición.
      id: e.id || `${aSlug(e.titulo ?? "foto")}-${i}`,
    }),
  );

  return { ...datos, items };
}

/** El contenido que se escribe en el commit. */
export const aArchivo = (galeria: { items: Entrada[] }) =>
  JSON.stringify(galeria, null, 2) + "\n";
