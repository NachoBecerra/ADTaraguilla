"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { haySesion } from "@/lib/panel/sesion";
import { commitear, leerArchivo } from "@/lib/panel/github";

const RUTA_DATOS = "src/data/galeria.json";

export type Resultado = { ok: boolean; mensaje: string };

/** Una foto guardada: la URL en el almacenamiento y sus medidas reales. */
type Foto = { url: string; ancho: number; alto: number };

type Entrada = {
  id: string;
  titulo: string;
  albumes: string[];
  fecha: string;
  fotos: Foto[];
};

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

/** Admite lista o valor suelto, que es como se guardaba antes. */
function comoLista(valor?: string[] | string): string[] {
  if (!valor) return [];
  return (Array.isArray(valor) ? valor : [valor]).map((v) => v.trim()).filter(Boolean);
}

/** Etiquetas de una entrada, del formato nuevo o del antiguo de un solo álbum. */
function etiquetasDe(e: { albumes?: string[] | string; album?: string }): string[] {
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
function fotosDe(valor?: Foto[] | string[] | string): Foto[] {
  if (!valor) return [];
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista.flatMap((f) => {
    if (typeof f !== "string") return f?.url ? [f] : [];
    const url = f.trim();
    return url ? [{ url, ancho: 0, alto: 0 }] : [];
  });
}

/** Lee el archivo del repositorio y normaliza las entradas. */
async function leerGaleria(): Promise<{ items: Entrada[] }> {
  const crudo = await leerArchivo(RUTA_DATOS);
  const datos = crudo ? JSON.parse(crudo) : {};

  const items: Entrada[] = (datos.items ?? []).map(
    (
      e: Partial<Entrada> & {
        fotos?: Foto[] | string[] | string;
        albumes?: string[] | string;
        album?: string;
      },
      i: number,
    ) => ({
      titulo: e.titulo ?? "",
      albumes: etiquetasDe(e),
      fecha: e.fecha ?? "",
      fotos: fotosDe(e.fotos),
      // Los identificadores antiguos podían faltar o repetirse: se aseguran
      // aquí para poder editar y borrar sin depender de la posición.
      id: e.id || `${aSlug(e.titulo ?? "foto")}-${i}`,
    }),
  );

  return { ...datos, items };
}

/**
 * Borra las fotos de donde estén.
 *
 * Las nuevas viven en el almacenamiento y se quitan con `del`, que además
 * libera el espacio de verdad. Las antiguas son archivos del repositorio y
 * hay que borrarlas en el commit, así que se devuelven para eso.
 */
async function borrarArchivos(fotos: Foto[]): Promise<string[]> {
  const enBlob = fotos.map((f) => f.url).filter((u) => u.startsWith("http"));
  const enRepo = fotos.map((f) => f.url).filter((u) => u.startsWith("/img/"));

  if (enBlob.length > 0) {
    try {
      await del(enBlob);
    } catch {
      // Si el borrado del archivo falla, la entrada se quita igualmente: es
      // peor dejarla visible en la web que dejar un archivo huérfano.
    }
  }

  return enRepo.map((u) => `public${u}`);
}

async function guardarGaleria(
  galeria: { items: Entrada[] },
  mensaje: string,
  eliminar: string[] = [],
) {
  await commitear(
    {
      escribir: [
        {
          ruta: RUTA_DATOS,
          contenido: JSON.stringify(galeria, null, 2) + "\n",
          binario: false,
        },
      ],
      eliminar,
    },
    mensaje,
  );

  revalidatePath("/galeria");
  revalidatePath("/panel/galeria");
  revalidatePath("/");
}

/* ------------------------------------------------------------------ subir */

/**
 * Crea la entrada con las fotos que el navegador ya ha subido.
 *
 * Aquí solo llegan URLs y medidas: los archivos han ido directos del
 * navegador al almacenamiento, así que este commit es un JSON de dos kilos
 * en vez de veinte megas de fotos.
 */
export async function subirFotos(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  if (!(await haySesion())) return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };

  const titulo = String(datos.get("titulo") ?? "").trim();
  const albumes = datos.getAll("albumes").map(String).map((a) => a.trim()).filter(Boolean);
  const fecha = String(datos.get("fecha") ?? "").trim();

  let fotos: Foto[] = [];
  try {
    fotos = JSON.parse(String(datos.get("fotos") ?? "[]")) as Foto[];
  } catch {
    return { ok: false, mensaje: "No se han recibido bien las fotos. Inténtalo otra vez." };
  }

  if (!titulo) return { ok: false, mensaje: "Ponle un título." };
  if (albumes.length === 0) return { ok: false, mensaje: "Ponle al menos una etiqueta." };
  if (fotos.length === 0) return { ok: false, mensaje: "No has elegido ninguna foto." };

  try {
    const galeria = await leerGaleria();
    galeria.items = [
      {
        id: `${aSlug(titulo)}-${Date.now().toString(36)}`,
        titulo,
        albumes,
        fecha: fecha || new Date().toISOString().slice(0, 10),
        fotos,
      },
      ...galeria.items,
    ];

    await guardarGaleria(
      galeria,
      `Galería: ${titulo} (${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"})`,
    );

    return {
      ok: true,
      mensaje: `${fotos.length} ${fotos.length === 1 ? "foto subida" : "fotos subidas"}. La web se actualiza en un par de minutos.`,
    };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido guardar: ${(e as Error).message}` };
  }
}

/* ----------------------------------------------------------------- editar */

/** Cambia título, etiquetas y fecha de una entrada ya publicada. */
export async function guardarEntrada(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  if (!(await haySesion())) return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };

  const id = String(datos.get("id") ?? "");
  const titulo = String(datos.get("titulo") ?? "").trim();
  const albumes = datos.getAll("albumes").map(String).map((a) => a.trim()).filter(Boolean);
  const fecha = String(datos.get("fecha") ?? "").trim();

  if (!titulo) return { ok: false, mensaje: "El título no puede quedar vacío." };

  try {
    const galeria = await leerGaleria();
    const entrada = galeria.items.find((e) => e.id === id);
    if (!entrada) return { ok: false, mensaje: "Esa entrada ya no existe." };

    entrada.titulo = titulo;
    entrada.albumes = albumes;
    if (fecha) entrada.fecha = fecha;

    await guardarGaleria(galeria, `Galería: cambios en «${titulo}»`);
    return { ok: true, mensaje: "Guardado." };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido guardar: ${(e as Error).message}` };
  }
}

/** Quita una foto suelta de una entrada y borra su archivo. */
export async function borrarFoto(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  if (!(await haySesion())) return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };

  const id = String(datos.get("id") ?? "");
  const url = String(datos.get("foto") ?? "");

  try {
    const galeria = await leerGaleria();
    const entrada = galeria.items.find((e) => e.id === id);
    if (!entrada) return { ok: false, mensaje: "Esa entrada ya no existe." };

    const quitada = entrada.fotos.filter((f) => f.url === url);
    entrada.fotos = entrada.fotos.filter((f) => f.url !== url);

    // Una entrada sin fotos ya no pinta nada en la galería
    if (entrada.fotos.length === 0) {
      galeria.items = galeria.items.filter((e) => e.id !== id);
    }

    const enRepo = await borrarArchivos(quitada);
    await guardarGaleria(galeria, `Galería: foto eliminada de «${entrada.titulo}»`, enRepo);
    return { ok: true, mensaje: "Foto eliminada." };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido eliminar: ${(e as Error).message}` };
  }
}

/** Borra una entrada entera con todas sus fotos. */
export async function borrarEntrada(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  if (!(await haySesion())) return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };

  const id = String(datos.get("id") ?? "");

  try {
    const galeria = await leerGaleria();
    const entrada = galeria.items.find((e) => e.id === id);
    if (!entrada) return { ok: false, mensaje: "Esa entrada ya no existe." };

    galeria.items = galeria.items.filter((e) => e.id !== id);

    const enRepo = await borrarArchivos(entrada.fotos);
    await guardarGaleria(galeria, `Galería: eliminada «${entrada.titulo}»`, enRepo);
    return { ok: true, mensaje: `«${entrada.titulo}» eliminada.` };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido eliminar: ${(e as Error).message}` };
  }
}
