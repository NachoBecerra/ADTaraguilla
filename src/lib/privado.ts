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
 * **La caché va desactivada por defecto, y es importante.** El almacén sirve
 * los archivos por una caché y `put` los guarda con un mes de vigencia; leer a
 * través de ella devuelve la versión anterior. Aquí dentro no hay nada que se
 * beneficie de eso: todo son datos que se leen, se modifican y se vuelven a
 * guardar —el recuento de uso, las suscripciones, el partido en directo—, así
 * que una lectura vieja no es un dato antiguo sino un dato **perdido**. Costó
 * un fallo en producción descubrirlo: el directo se comía la cronología entera
 * a cada gol.
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
 * Sin pasar por la caché salvo que se pida lo contrario: ver la cabecera.
 */
export async function leerPrivado<T>(
  ruta: string,
  porDefecto: T,
  { sinCache = true }: { sinCache?: boolean } = {},
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
 * Vigencia mínima que admite el almacén. Se usa siempre: nada de lo que se
 * guarda aquí tiene sentido conservarlo un mes, que es lo que hace `put` si no
 * se le dice nada.
 */
const CACHE_MINIMA_S = 60;

/**
 * Escribe un JSON en el almacén privado, sobrescribiendo lo que hubiera.
 *
 * `sobrescribir: false` hace que falle en vez de pisar lo que ya hubiera, que
 * es lo que hace segura una creación.
 *
 * La vigencia corta reduce el daño, pero no basta por sí sola: un minuto sigue
 * siendo mucho para algo que cambia cada pocos segundos. Lo que de verdad
 * arregla el problema es que las lecturas no pasen por la caché.
 */
export async function escribirPrivado(
  ruta: string,
  datos: unknown,
  {
    cacheMaxAge = CACHE_MINIMA_S,
    sobrescribir = true,
  }: { cacheMaxAge?: number; sobrescribir?: boolean } = {},
): Promise<boolean> {
  if (!TOKEN) return false;
  try {
    await put(ruta, JSON.stringify(datos), {
      access: "private",
      token: TOKEN,
      contentType: "application/json",
      // Ruta fija: hay que poder volver a leer el mismo archivo
      addRandomSuffix: false,
      /*
       * Con `sobrescribir: false` el almacén rechaza la escritura si el
       * archivo ya existe. Es la forma de crear algo sin arriesgarse a pisar
       * lo que hubiera, cuando no basta con haber mirado antes.
       */
      allowOverwrite: sobrescribir,
      cacheControlMaxAge: cacheMaxAge,
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
