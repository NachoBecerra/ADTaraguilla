import { get, put } from "@vercel/blob";

/**
 * Almacén privado del club.
 *
 * Aquí van los datos que no puede leer cualquiera: el recuento de uso y, más
 * adelante, las suscripciones a los avisos. Es un almacén distinto del de las
 * fotos, que es público a propósito.
 *
 * Los archivos se guardan y se leen como privados. En un almacén así no basta
 * con pedir la URL: hay que pasar por el SDK con el token, y por eso se lee
 * con `get` en vez de con un fetch normal.
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
    const encontrado = await get(ruta, { access: "private", token: TOKEN });
    if (!encontrado) return porDefecto;
    return (await new Response(encontrado.stream).json()) as T;
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
      access: "private",
      token: TOKEN,
      contentType: "application/json",
      // Ruta fija: hay que poder volver a leer el mismo archivo
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return true;
  } catch {
    return false;
  }
}
