import { leerArchivo } from "@/lib/panel/github";
import { getEntradasGaleria } from "@/lib/contenido";

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
  tipo: "foto" | "video";
  titulo: string;
  album: string;
  fecha: string;
  fotos: string[];
};

function comoLista(fotos?: string[] | string): string[] {
  if (!fotos) return [];
  return (Array.isArray(fotos) ? fotos : [fotos]).filter(Boolean);
}

function aSlug(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "foto"
  );
}

export async function entradasDeGaleria(): Promise<EntradaPanel[]> {
  try {
    const crudo = await leerArchivo("src/data/galeria.json");
    if (!crudo) throw new Error("sin datos");

    const datos = JSON.parse(crudo);
    return (datos.items ?? []).map(
      (e: Partial<EntradaPanel> & { fotos?: string[] | string }, i: number) => ({
        id: e.id || `${aSlug(e.titulo ?? "foto")}-${i}`,
        tipo: e.tipo ?? "foto",
        titulo: e.titulo ?? "",
        album: e.album ?? "",
        fecha: e.fecha ?? "",
        fotos: comoLista(e.fotos),
      }),
    );
  } catch {
    return getEntradasGaleria();
  }
}

/** Álbumes existentes, para sugerirlos al escribir. */
export function albumesDe(entradas: EntradaPanel[]): string[] {
  return [...new Set(entradas.map((e) => e.album).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}
