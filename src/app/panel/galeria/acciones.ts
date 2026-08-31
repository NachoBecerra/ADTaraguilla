"use server";

import { revalidatePath } from "next/cache";
import { haySesion } from "@/lib/panel/sesion";
import { commitear, leerArchivo } from "@/lib/panel/github";

const RUTA_DATOS = "src/data/galeria.json";
const CARPETA = "public/img/galeria";

export type Resultado = { ok: boolean; mensaje: string };

type Entrada = {
  id: string;
  tipo: "foto" | "video";
  titulo: string;
  albumes: string[];
  fecha: string;
  fotos: string[];
  youtubeId?: string;
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

/** Lee el archivo del repositorio y normaliza las entradas. */
async function leerGaleria(): Promise<{ items: Entrada[] }> {
  const crudo = await leerArchivo(RUTA_DATOS);
  const datos = crudo ? JSON.parse(crudo) : {};

  const items: Entrada[] = (datos.items ?? []).map(
    (
      e: Partial<Entrada> & {
        fotos?: string[] | string;
        albumes?: string[] | string;
        album?: string;
      },
      i: number,
    ) => ({
      tipo: e.tipo ?? "foto",
      titulo: e.titulo ?? "",
      albumes: etiquetasDe(e),
      fecha: e.fecha ?? "",
      youtubeId: e.youtubeId,
      fotos: comoLista(e.fotos),
      // Los identificadores antiguos podían faltar o repetirse: se aseguran
      // aquí para poder editar y borrar sin depender de la posición.
      id: e.id || `${aSlug(e.titulo ?? "foto")}-${i}`,
    }),
  );

  return { ...datos, items };
}

/** Ruta del archivo de imagen dentro del repositorio, a partir de su URL. */
const aRutaRepo = (url: string) => `public${url}`;

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

function nombreArchivo(album: string, i: number, extension: string): string {
  return `${aSlug(album)}-${Date.now().toString(36)}-${String(i + 1).padStart(2, "0")}.${extension}`;
}

/**
 * Sube las fotos y crea una entrada con todas ellas.
 * Todo va en un único commit: un despliegue, no veinte.
 */
export async function subirFotos(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  if (!(await haySesion())) return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };

  const titulo = String(datos.get("titulo") ?? "").trim();
  const albumes = datos.getAll("albumes").map(String).map((a) => a.trim()).filter(Boolean);
  const fecha = String(datos.get("fecha") ?? "").trim();
  const imagenes = datos.getAll("imagenes").map(String).filter(Boolean);

  if (!titulo) return { ok: false, mensaje: "Ponle un título." };
  if (albumes.length === 0) return { ok: false, mensaje: "Ponle al menos una etiqueta." };
  if (imagenes.length === 0) return { ok: false, mensaje: "No has elegido ninguna foto." };

  try {
    const archivos = imagenes.map((datoUrl, i) => {
      const [cabecera, base64] = datoUrl.split(",", 2);
      const extension = /png/.test(cabecera) ? "png" : "jpg";
      return {
        ruta: `${CARPETA}/${nombreArchivo(albumes[0], i, extension)}`,
        contenido: base64,
        binario: true,
      };
    });

    const galeria = await leerGaleria();
    galeria.items = [
      {
        id: `${aSlug(titulo)}-${Date.now().toString(36)}`,
        tipo: "foto",
        titulo,
        albumes,
        fecha: fecha || new Date().toISOString().slice(0, 10),
        fotos: archivos.map((a) => a.ruta.replace(/^public/, "")),
      },
      ...galeria.items,
    ];

    await commitear(
      {
        escribir: [
          ...archivos,
          {
            ruta: RUTA_DATOS,
            contenido: JSON.stringify(galeria, null, 2) + "\n",
            binario: false,
          },
        ],
      },
      `Galería: ${titulo} (${imagenes.length} ${imagenes.length === 1 ? "foto" : "fotos"})`,
    );

    revalidatePath("/galeria");
    revalidatePath("/panel/galeria");
    revalidatePath("/");

    return {
      ok: true,
      mensaje: `${imagenes.length} ${imagenes.length === 1 ? "foto subida" : "fotos subidas"}. La web se actualiza en un par de minutos.`,
    };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido subir: ${(e as Error).message}` };
  }
}

/* ----------------------------------------------------------------- editar */

/** Cambia título, álbum y fecha de una entrada ya publicada. */
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
  const foto = String(datos.get("foto") ?? "");

  try {
    const galeria = await leerGaleria();
    const entrada = galeria.items.find((e) => e.id === id);
    if (!entrada) return { ok: false, mensaje: "Esa entrada ya no existe." };

    entrada.fotos = entrada.fotos.filter((f) => f !== foto);

    // Una entrada sin fotos ya no pinta nada en la galería
    if (entrada.fotos.length === 0 && entrada.tipo === "foto") {
      galeria.items = galeria.items.filter((e) => e.id !== id);
    }

    await guardarGaleria(galeria, `Galería: foto eliminada de «${entrada.titulo}»`, [
      aRutaRepo(foto),
    ]);
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

    await guardarGaleria(
      galeria,
      `Galería: eliminada «${entrada.titulo}»`,
      entrada.fotos.map(aRutaRepo),
    );
    return { ok: true, mensaje: `«${entrada.titulo}» eliminada.` };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido eliminar: ${(e as Error).message}` };
  }
}
