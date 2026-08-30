"use server";

import { revalidatePath } from "next/cache";
import { haySesion } from "@/lib/panel/sesion";
import { publicar, leerArchivo } from "@/lib/panel/github";

const RUTA_DATOS = "src/data/galeria.json";
const CARPETA = "public/img/galeria";

export type Resultado = { ok: boolean; mensaje: string };

/** Nombre de archivo seguro y sin colisiones. */
function nombreArchivo(album: string, i: number, extension: string): string {
  const base = album
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "foto";
  const sello = Date.now().toString(36);
  return `${base}-${sello}-${String(i + 1).padStart(2, "0")}.${extension}`;
}

/**
 * Sube las fotos y crea una entrada de galería con todas ellas.
 * Todo va en un único commit: un despliegue, no veinte.
 */
export async function subirFotos(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  if (!(await haySesion())) return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };

  const titulo = String(datos.get("titulo") ?? "").trim();
  const album = String(datos.get("album") ?? "").trim();
  const fecha = String(datos.get("fecha") ?? "").trim();
  // El navegador manda las fotos ya reducidas y en base64
  const imagenes = datos.getAll("imagenes").map(String).filter(Boolean);

  if (!titulo) return { ok: false, mensaje: "Ponle un título." };
  if (!album) return { ok: false, mensaje: "Indica el álbum." };
  if (imagenes.length === 0) return { ok: false, mensaje: "No has elegido ninguna foto." };

  try {
    const archivos = imagenes.map((datoUrl, i) => {
      const [cabecera, base64] = datoUrl.split(",", 2);
      const extension = /png/.test(cabecera) ? "png" : "jpg";
      return {
        ruta: `${CARPETA}/${nombreArchivo(album, i, extension)}`,
        contenido: base64,
        binario: true,
      };
    });

    // La entrada nueva se pone la primera: la galería ordena por fecha, pero
    // así el archivo también se lee de lo más reciente a lo más antiguo.
    const crudo = await leerArchivo(RUTA_DATOS);
    const galeria = crudo ? JSON.parse(crudo) : { items: [] };
    galeria.items = [
      {
        tipo: "foto",
        titulo,
        album,
        fecha: fecha || new Date().toISOString().slice(0, 10),
        fotos: archivos.map((a) => `/${a.ruta.replace(/^public\//, "")}`),
      },
      ...(galeria.items ?? []),
    ];

    archivos.push({
      ruta: RUTA_DATOS,
      contenido: JSON.stringify(galeria, null, 2) + "\n",
      binario: false,
    });

    await publicar(
      archivos,
      `Galería: ${titulo} (${imagenes.length} ${imagenes.length === 1 ? "foto" : "fotos"})`,
    );

    revalidatePath("/galeria");
    revalidatePath("/panel/galeria");

    return {
      ok: true,
      mensaje: `${imagenes.length} ${imagenes.length === 1 ? "foto subida" : "fotos subidas"}. La web se actualiza en un par de minutos.`,
    };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido subir: ${(e as Error).message}` };
  }
}
