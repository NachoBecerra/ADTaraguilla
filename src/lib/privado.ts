import { del, get, list, put } from "@vercel/blob";

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

/**
 * Lee un JSON del almacén privado. Devuelve el valor por defecto si no está.
 *
 * `sinCache` es imprescindible para lo que se lee justo después de haberlo
 * escrito. El almacén sirve los archivos por una caché y `put` los guarda con
 * un mes de vigencia, así que una lectura normal puede devolver la versión
 * anterior: quien lea para modificar y volver a guardar perdería lo último.
 */
export async function leerPrivado<T>(
  ruta: string,
  porDefecto: T,
  { sinCache = false }: { sinCache?: boolean } = {},
): Promise<T> {
  if (!TOKEN) return porDefecto;
  try {
    const encontrado = await get(ruta, {
      access: "private",
      token: TOKEN,
      ...(sinCache ? { useCache: false } : {}),
    });
    if (!encontrado) return porDefecto;
    return (await new Response(encontrado.stream).json()) as T;
  } catch {
    // No existe todavía, o el almacén no responde
    return porDefecto;
  }
}

/**
 * Escribe un JSON en el almacén privado, sobrescribiendo lo que hubiera.
 *
 * `cacheMaxAge` baja la vigencia en la caché del almacén, que por defecto es
 * de un mes. Para algo que cambia cada pocos segundos, como un partido en
 * directo, un mes es una eternidad. El mínimo que admite el almacén es un
 * minuto, así que esto reduce el daño pero no lo elimina: lo que necesite leer
 * lo último de verdad tiene que pedirlo además con `sinCache`.
 */
export async function escribirPrivado(
  ruta: string,
  datos: unknown,
  { cacheMaxAge }: { cacheMaxAge?: number } = {},
): Promise<boolean> {
  if (!TOKEN) return false;
  try {
    await put(ruta, JSON.stringify(datos), {
      access: "private",
      token: TOKEN,
      contentType: "application/json",
      // Ruta fija: hay que poder volver a leer el mismo archivo
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(cacheMaxAge === undefined ? {} : { cacheControlMaxAge: cacheMaxAge }),
    });
    return true;
  } catch {
    return false;
  }
}

/** Rutas de todos los archivos que empiezan por ese prefijo. */
export async function listarPrivado(prefijo: string): Promise<string[]> {
  if (!TOKEN) return [];
  const rutas: string[] = [];
  let cursor: string | undefined;
  try {
    do {
      const pagina = await list({ prefix: prefijo, cursor, token: TOKEN });
      rutas.push(...pagina.blobs.map((b) => b.pathname));
      cursor = pagina.hasMore ? pagina.cursor : undefined;
    } while (cursor);
  } catch {
    // Si el almacén no responde, mejor una lista vacía que reventar
  }
  return rutas;
}

/** Borra un archivo del almacén privado. */
export async function borrarPrivado(ruta: string): Promise<void> {
  if (!TOKEN) return;
  try {
    await del(ruta, { token: TOKEN });
  } catch {
    // Un archivo que no se puede borrar no debe tumbar la operación
  }
}
