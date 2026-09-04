import { leerArchivo } from "@/lib/panel/github";
import { getEntradasGaleria, fotosDe, type FotoGuardada } from "@/lib/contenido";
import { conIdUnico } from "@/lib/panel/fotosDeEntrada";

/**
 * Entradas de la galería tal y como están AHORA en el repositorio.
 *
 * El panel no puede leer el JSON incrustado en la compilación: al guardar un
 * cambio, la web tarda un minuto largo en reconstruirse y mientras tanto el
 * editor vería el título viejo y pensaría que no se ha guardado nada. Así que
 * se pide el archivo a GitHub en cada visita.
 *
 * Si no hay token configurado, o GitHub falla, se cae a los datos compilados:
 * peor información, pero nunca una pantalla vacía.
 */

export type EntradaPanel = {
  id: string;
  titulo: string;
  albumes: string[];
  /** Identificadores de los equipos a los que se asignó la entrada. */
  equipos: string[];
  fecha: string;
  fotos: FotoGuardada[];
};

function comoLista(valor?: string[] | string): string[] {
  if (!valor) return [];
  return (Array.isArray(valor) ? valor : [valor]).map((v) => v.trim()).filter(Boolean);
}

/** Etiquetas de una entrada, del formato nuevo o del antiguo de un solo álbum. */
function etiquetas(e: { albumes?: string[] | string; album?: string }): string[] {
  const lista = comoLista(e.albumes);
  return lista.length > 0 ? lista : comoLista(e.album);
}

export async function entradasDeGaleria(): Promise<EntradaPanel[]> {
  try {
    const crudo = await leerArchivo("src/data/galeria.json");
    if (!crudo) throw new Error("sin datos");

    const datos = JSON.parse(crudo);

    /* El mismo reparto de identificadores que usa quien guarda: si aquí
       saliera otro, editar contestaría que el grupo ya no existe */
    return conIdUnico(
      (datos.items ?? []).map(
        (
          e: Partial<EntradaPanel> & {
            fotos?: FotoGuardada[] | string[] | string;
            albumes?: string[] | string;
            album?: string;
            equipos?: string[] | string;
          },
        ) => ({
          id: e.id,
          titulo: e.titulo ?? "",
          albumes: etiquetas(e),
          equipos: comoLista(e.equipos),
          fecha: e.fecha ?? "",
          fotos: fotosDe(e.fotos),
        }),
      ),
    );
  } catch {
    /* También aquí: los datos compilados traen los mismos identificadores
       repetidos, y sin repartirlos el panel enseñaría dos grupos que llevan
       los dos al mismo sitio */
    return conIdUnico(getEntradasGaleria());
  }
}

/** Etiquetas en uso, de la más frecuente a la menos, para sugerirlas. */
export function albumesDe(entradas: EntradaPanel[]): string[] {
  const cuenta = new Map<string, number>();
  for (const e of entradas) for (const a of e.albumes) cuenta.set(a, (cuenta.get(a) ?? 0) + 1);
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([a]) => a);
}
