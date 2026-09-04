"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { haySesion } from "@/lib/panel/sesion";
import { commitear } from "@/lib/panel/github";
import {
  RUTA_GALERIA,
  aArchivo,
  aSlug,
  leerGaleria,
  type Entrada,
  type Foto,
} from "@/lib/panel/galeriaDatos";
import { aplicarFotos } from "@/lib/panel/fotosDeEntrada";

export type Resultado = { ok: boolean; mensaje: string };

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
    { escribir: [{ ruta: RUTA_GALERIA, contenido: aArchivo(galeria), binario: false }], eliminar },
    mensaje,
  );

  revalidatePath("/galeria");
  revalidatePath("/panel/galeria");
  /* Las fotos de una noticia viven en la galería, así que tocarla cambia
     también lo que enseña el editor de noticias */
  revalidatePath("/noticias");
  revalidatePath("/panel/noticias");
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
  const equipos = datos.getAll("equipos").map(String).map((e) => e.trim()).filter(Boolean);
  const fecha = String(datos.get("fecha") ?? "").trim();

  let fotos: Foto[] = [];
  try {
    fotos = JSON.parse(String(datos.get("fotos") ?? "[]")) as Foto[];
  } catch {
    return { ok: false, mensaje: "No se han recibido bien las fotos. Inténtalo otra vez." };
  }

  if (!titulo) return { ok: false, mensaje: "Ponle un título." };
  if (albumes.length === 0 && equipos.length === 0) {
    return { ok: false, mensaje: "Elige un equipo o ponle al menos una etiqueta." };
  }
  if (fotos.length === 0) return { ok: false, mensaje: "No has elegido ninguna foto." };

  try {
    const galeria = await leerGaleria();
    galeria.items = [
      {
        id: `${aSlug(titulo)}-${Date.now().toString(36)}`,
        titulo,
        albumes,
        equipos,
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
  const equipos = datos.getAll("equipos").map(String).map((e) => e.trim()).filter(Boolean);
  const fecha = String(datos.get("fecha") ?? "").trim();

  if (!titulo) return { ok: false, mensaje: "El título no puede quedar vacío." };

  try {
    const galeria = await leerGaleria();
    const entrada = galeria.items.find((e) => e.id === id);
    if (!entrada) return { ok: false, mensaje: "Esa entrada ya no existe." };

    entrada.titulo = titulo;
    entrada.albumes = albumes;
    entrada.equipos = equipos;
    if (fecha) entrada.fecha = fecha;

    await guardarGaleria(galeria, `Galería: cambios en «${titulo}»`);
    return { ok: true, mensaje: "Guardado." };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido guardar: ${(e as Error).message}` };
  }
}

/**
 * Añade fotos a un grupo ya publicado.
 *
 * Hasta ahora, una vez subido un grupo lo único que se podía hacer con sus
 * fotos era quitarlas de una en una: para meter una más había que crear otro
 * grupo, y el partido acababa repartido en dos sitios.
 *
 * Los archivos ya los ha subido el navegador; aquí solo llegan URLs y medidas.
 */
export async function anadirFotos(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  if (!(await haySesion())) return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };

  const id = String(datos.get("id") ?? "");

  let nuevas: Foto[] = [];
  try {
    nuevas = JSON.parse(String(datos.get("fotos") ?? "[]")) as Foto[];
  } catch {
    return { ok: false, mensaje: "No se han recibido bien las fotos. Inténtalo otra vez." };
  }
  if (nuevas.length === 0) return { ok: false, mensaje: "No has elegido ninguna foto." };

  try {
    const galeria = await leerGaleria();
    const entrada = galeria.items.find((e) => e.id === id);
    if (!entrada) return { ok: false, mensaje: "Ese grupo ya no existe." };

    const tras = aplicarFotos(galeria.items, id, { anadir: nuevas });
    if (tras.anadidas === 0) return { ok: true, mensaje: "Esas fotos ya estaban." };

    await guardarGaleria(
      { items: tras.items },
      `Galería: ${tras.anadidas} ${tras.anadidas === 1 ? "foto añadida" : "fotos añadidas"} a «${entrada.titulo}»`,
    );

    return {
      ok: true,
      mensaje: `${tras.anadidas} ${tras.anadidas === 1 ? "foto añadida" : "fotos añadidas"}.`,
    };
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

    const tras = aplicarFotos(galeria.items, id, { quitar: [url] });
    const enRepo = await borrarArchivos(
      entrada.fotos.filter((f: Foto) => tras.huerfanas.includes(f.url)),
    );

    await guardarGaleria(
      { items: tras.items },
      `Galería: foto eliminada de «${entrada.titulo}»`,
      enRepo,
    );
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
