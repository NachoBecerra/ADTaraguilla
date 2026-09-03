"use server";

import matter from "gray-matter";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { haySesion } from "@/lib/panel/sesion";
import { commitear, leerArchivo } from "@/lib/panel/github";
import { CARPETA } from "@/lib/panel/noticias";
import {
  RUTA_GALERIA,
  aArchivo,
  leerGaleria,
  type Foto,
} from "@/lib/panel/galeriaDatos";

export type Resultado = { ok: boolean; mensaje: string };

function aSlug(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "noticia"
  );
}

/** Nombre del archivo: la fecha delante mantiene la carpeta ordenada sola. */
const nombreDe = (fecha: string, slug: string) => `${CARPETA}/${fecha}-${slug}.md`;

/** Escapa el valor para el frontmatter sin depender de comillas. */
function aYaml(valor: string): string {
  return JSON.stringify(valor ?? "");
}

function componerMarkdown(n: {
  titulo: string;
  slug: string;
  fecha: string;
  categoria: string;
  etiquetas: string[];
  resumen: string;
  portada: string;
  autor: string;
  destacada: boolean;
  galeria: string;
  cuerpo: string;
}): string {
  return [
    "---",
    `titulo: ${aYaml(n.titulo)}`,
    `slug: ${aYaml(n.slug)}`,
    `fecha: ${n.fecha}`,
    `categoria: ${aYaml(n.categoria)}`,
    `etiquetas: [${n.etiquetas.map(aYaml).join(", ")}]`,
    `resumen: ${aYaml(n.resumen)}`,
    `portada: ${aYaml(n.portada)}`,
    `autor: ${aYaml(n.autor)}`,
    `destacada: ${n.destacada}`,
    ...(n.galeria ? [`galeria: ${aYaml(n.galeria)}`] : []),
    "---",
    "",
    n.cuerpo.trim(),
    "",
  ].join("\n");
}

/**
 * Crea o actualiza una noticia.
 *
 * Si cambia el título o la fecha cambia también el nombre del archivo, así que
 * se borra el anterior en el mismo commit: si no, quedarían dos noticias.
 */
export async function guardarNoticia(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  if (!(await haySesion())) return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };

  const titulo = String(datos.get("titulo") ?? "").trim();
  const cuerpo = String(datos.get("cuerpo") ?? "").trim();
  if (!titulo) return { ok: false, mensaje: "Ponle un título." };
  if (!cuerpo) return { ok: false, mensaje: "La noticia está vacía." };

  const anterior = String(datos.get("archivo") ?? "");
  const fecha = String(datos.get("fecha") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const slug = aSlug(String(datos.get("slug") ?? "").trim() || titulo);
  const archivo = nombreDe(fecha, slug);

  // La portada ya la ha subido el navegador al almacenamiento: aquí llega su URL
  const portada = String(datos.get("portada") ?? "");

  const escribir: { ruta: string; contenido: string; binario?: boolean }[] = [];

  /*
   * Las fotos que acompañan a la noticia van a la galería, no al Markdown.
   *
   * Es lo que pidió el club —que se suban también a la galería— y de paso
   * resuelve el problema de tenerlas en dos sitios: la noticia solo guarda a
   * qué entrada mirar. Todo va en el mismo commit que la noticia, así que o se
   * guardan las dos cosas o no se guarda ninguna.
   */
  let galeria = String(datos.get("galeria") ?? "").trim();

  let nuevas: Foto[] = [];
  try {
    nuevas = JSON.parse(String(datos.get("fotos") ?? "[]")) as Foto[];
  } catch {
    return { ok: false, mensaje: "No se han recibido bien las fotos. Inténtalo otra vez." };
  }

  if (nuevas.length > 0) {
    const etiquetasFoto = datos.getAll("fotoEtiquetas").map(String).map((e) => e.trim()).filter(Boolean);
    const equiposFoto = datos.getAll("fotoEquipos").map(String).map((e) => e.trim()).filter(Boolean);

    try {
      const galeriaActual = await leerGaleria();
      const existente = galeria ? galeriaActual.items.find((e) => e.id === galeria) : undefined;

      if (existente) {
        existente.fotos = [...existente.fotos, ...nuevas];
        existente.titulo = titulo;
        if (etiquetasFoto.length > 0) existente.albumes = etiquetasFoto;
        if (equiposFoto.length > 0) existente.equipos = equiposFoto;
      } else {
        galeria = `noticia-${slug}-${Date.now().toString(36)}`;
        galeriaActual.items = [
          {
            id: galeria,
            titulo,
            /* Sin etiqueta no se encuentra en la galería, así que si no se pone
               ninguna se usa la categoría de la noticia como red de seguridad */
            albumes:
              etiquetasFoto.length > 0
                ? etiquetasFoto
                : [String(datos.get("categoria") ?? "Club")],
            equipos: equiposFoto,
            fecha,
            fotos: nuevas,
          },
          ...galeriaActual.items,
        ];
      }

      escribir.push({
        ruta: RUTA_GALERIA,
        contenido: aArchivo(galeriaActual),
        binario: false,
      });
    } catch (e) {
      return { ok: false, mensaje: `No se ha podido leer la galería: ${(e as Error).message}` };
    }
  }

  escribir.push({
    ruta: archivo,
    contenido: componerMarkdown({
      titulo,
      slug,
      fecha,
      categoria: String(datos.get("categoria") ?? "Club"),
      etiquetas: datos.getAll("etiquetas").map(String).map((e) => e.trim()).filter(Boolean),
      resumen: String(datos.get("resumen") ?? "").trim(),
      portada,
      autor: String(datos.get("autor") ?? "AD Taraguilla").trim() || "AD Taraguilla",
      destacada: datos.get("destacada") === "on",
      galeria,
      cuerpo,
    }),
  });

  try {
    const eliminar = anterior && anterior !== archivo ? [anterior] : [];

    await commitear(
      { escribir, eliminar },
      anterior ? `Noticia: cambios en «${titulo}»` : `Noticia: ${titulo}`,
    );

    // La portada que se ha sustituido ya no la usa nadie
    const portadaVieja = String(datos.get("portadaAnterior") ?? "");
    if (portadaVieja.startsWith("http") && portadaVieja !== portada) {
      try {
        await del(portadaVieja);
      } catch {
        // Un archivo huérfano es molesto, perder el cambio sería peor
      }
    }

    revalidatePath("/noticias");
    revalidatePath("/panel/noticias");
    revalidatePath("/galeria");
    revalidatePath("/");

    const cuantas = nuevas.length;
    return {
      ok: true,
      mensaje: cuantas
        ? `Guardada, con ${cuantas} ${cuantas === 1 ? "foto" : "fotos"} añadidas también a la galería.`
        : anterior
          ? "Guardada."
          : "Noticia publicada.",
    };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido guardar: ${(e as Error).message}` };
  }
}

/** Borra la noticia y, si la tenía, su foto de portada. */
export async function borrarNoticia(
  _previo: Resultado | null,
  datos: FormData,
): Promise<Resultado> {
  if (!(await haySesion())) return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };

  const archivo = String(datos.get("archivo") ?? "");
  if (!archivo) return { ok: false, mensaje: "No sé qué noticia borrar." };

  try {
    const crudo = await leerArchivo(archivo);
    const portada = crudo ? String(matter(crudo).data.portada ?? "") : "";

    const eliminar = [archivo];
    if (portada.startsWith("/img/")) eliminar.push(`public${portada}`);
    if (portada.startsWith("http")) {
      try {
        await del(portada);
      } catch {
        // Que falle borrar el archivo no debe impedir borrar la noticia
      }
    }

    await commitear({ eliminar }, `Noticia eliminada: ${archivo.split("/").pop()}`);

    revalidatePath("/noticias");
    revalidatePath("/panel/noticias");
    revalidatePath("/");

    return { ok: true, mensaje: "Noticia eliminada." };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido eliminar: ${(e as Error).message}` };
  }
}
