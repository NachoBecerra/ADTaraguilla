"use server";

import matter from "gray-matter";
import { revalidatePath } from "next/cache";
import { haySesion } from "@/lib/panel/sesion";
import { commitear, leerArchivo } from "@/lib/panel/github";
import { CARPETA } from "@/lib/panel/noticias";

const CARPETA_IMAGENES = "public/img/noticias";

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

  // La portada nueva llega ya reducida desde el navegador
  const imagen = String(datos.get("imagen") ?? "");
  let portada = String(datos.get("portada") ?? "");

  const escribir: { ruta: string; contenido: string; binario?: boolean }[] = [];

  if (imagen) {
    const [cabecera, base64] = imagen.split(",", 2);
    const extension = /png/.test(cabecera) ? "png" : "jpg";
    const ruta = `${CARPETA_IMAGENES}/${slug}-${Date.now().toString(36)}.${extension}`;
    escribir.push({ ruta, contenido: base64, binario: true });
    portada = ruta.replace(/^public/, "");
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
      cuerpo,
    }),
  });

  try {
    const eliminar = anterior && anterior !== archivo ? [anterior] : [];

    await commitear(
      { escribir, eliminar },
      anterior ? `Noticia: cambios en «${titulo}»` : `Noticia: ${titulo}`,
    );

    revalidatePath("/noticias");
    revalidatePath("/panel/noticias");
    revalidatePath("/");

    return { ok: true, mensaje: anterior ? "Guardada." : "Noticia publicada." };
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

    await commitear({ eliminar }, `Noticia eliminada: ${archivo.split("/").pop()}`);

    revalidatePath("/noticias");
    revalidatePath("/panel/noticias");
    revalidatePath("/");

    return { ok: true, mensaje: "Noticia eliminada." };
  } catch (e) {
    return { ok: false, mensaje: `No se ha podido eliminar: ${(e as Error).message}` };
  }
}
