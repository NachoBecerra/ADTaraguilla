import { head, put } from "@vercel/blob";

/**
 * Almacén privado del club.
 *
 * Aquí van los datos que no puede leer cualquiera: el recuento de uso y, más
 * adelante, las suscripciones a los avisos. Es un almacén distinto del de las
 * fotos, que es público a propósito.
 *
 * Si la variable no está puesta, todo lo que hay aquí se comporta como si no
 * existiera: la web sigue funcionando y solo se pierde el recuento.
 */

/*
 * Vercel nombra la variable según el prefijo que se elija al conectar el
 * almacén: con el prefijo BLOB_PRIVADO la deja en
 * BLOB_PRIVADO_READ_WRITE_TOKEN. Se aceptan las dos formas para que no
 * dependa de cómo se haya conectado.
 */
const TOKEN =
  process.env.BLOB_PRIVADO_READ_WRITE_TOKEN ?? process.env.BLOB_PRIVADO_TOKEN;

export const hayAlmacenPrivado = Boolean(TOKEN);

/** Lee un JSON del almacén privado. Devuelve el valor por defecto si no está. */
export async function leerPrivado<T>(ruta: string, porDefecto: T): Promise<T> {
  if (!TOKEN) return porDefecto;
  try {
    const info = await head(ruta, { token: TOKEN });
    const r = await fetch(info.downloadUrl, { cache: "no-store" });
    if (!r.ok) return porDefecto;
    return (await r.json()) as T;
  } catch {
    // No existe todavía, o el almacén no responde
    return porDefecto;
  }
}

/** Escribe un JSON en el almacén privado, sobrescribiendo lo que hubiera. */
export async function escribirPrivado(ruta: string, datos: unknown): Promise<boolean> {
  if (!TOKEN) return false;
  try {
    await put(ruta, JSON.stringify(datos), {
      token: TOKEN,
      access: "public", // el almacén ya es privado; esto es el modo del archivo
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return true;
  } catch {
    return false;
  }
}
