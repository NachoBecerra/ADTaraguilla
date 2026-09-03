import fs from "node:fs/promises";
import path from "node:path";
import {
  borrarPrivado,
  escribirPrivado,
  hayAlmacenPrivado,
  leerPrivado,
  listarPrivado,
} from "@/lib/privado";

/**
 * Dónde guarda sus cosas el directo.
 *
 * Es una capa fina sobre el almacén privado con **un respaldo en disco para
 * desarrollo**: sin `BLOB_PRIVADO_READ_WRITE_TOKEN` el almacén no guarda nada y
 * todo lo del directo se comportaría como si no existiera. Con esto se puede
 * desarrollar y probar el directo entero sin secretos.
 *
 * Vive aparte y todo el directo pasa por aquí porque llamar al almacén privado
 * directamente es un error fácil de cometer y difícil de ver: lo escrito se
 * pierde en silencio y en local parece que la funcionalidad no va. Ha pasado ya
 * con el listado de partidos y con el contador de seguidores.
 *
 * El respaldo **nunca actúa en producción**: allí, si falta el token, es un
 * fallo de configuración que hay que ver, no algo que disimular.
 */

const enDisco = !hayAlmacenPrivado && process.env.NODE_ENV !== "production";

const RAIZ_LOCAL = path.join(process.cwd(), ".next", "cache");
const enLocal = (ruta: string) => path.join(RAIZ_LOCAL, ruta);

/** Vigencia mínima del almacén: nada de lo del directo aguanta más. */
const CACHE_S = 60;

export async function leerJson<T>(ruta: string, porDefecto: T): Promise<T> {
  if (enDisco) {
    try {
      return JSON.parse(await fs.readFile(enLocal(ruta), "utf8")) as T;
    } catch {
      return porDefecto;
    }
  }
  return leerPrivado<T>(ruta, porDefecto);
}

export async function escribirJson(ruta: string, datos: unknown): Promise<boolean> {
  if (enDisco) {
    await fs.mkdir(path.dirname(enLocal(ruta)), { recursive: true });
    await fs.writeFile(enLocal(ruta), JSON.stringify(datos), "utf8");
    return true;
  }
  return escribirPrivado(ruta, datos, { cacheMaxAge: CACHE_S });
}

/**
 * Escribe **solo si no existe**. Devuelve false si ya estaba.
 *
 * No vale con haber mirado antes: leer devuelve lo mismo cuando algo no existe
 * que cuando el almacén no contesta.
 */
export async function crearJson(ruta: string, datos: unknown): Promise<boolean> {
  if (enDisco) {
    await fs.mkdir(path.dirname(enLocal(ruta)), { recursive: true });
    try {
      // "wx": falla si el archivo ya existe
      await fs.writeFile(enLocal(ruta), JSON.stringify(datos), { encoding: "utf8", flag: "wx" });
      return true;
    } catch {
      return false;
    }
  }
  return escribirPrivado(ruta, datos, { cacheMaxAge: CACHE_S, sobrescribir: false });
}

export async function borrarJson(ruta: string): Promise<void> {
  if (enDisco) {
    await fs.rm(enLocal(ruta), { force: true });
    return;
  }
  await borrarPrivado(ruta);
}

/** Rutas de todo lo guardado bajo un prefijo, con el mismo formato en los dos casos. */
export async function listarJson(prefijo: string): Promise<string[]> {
  if (enDisco) {
    try {
      const nombres = await fs.readdir(enLocal(prefijo));
      return nombres.filter((n) => n.endsWith(".json")).map((n) => `${prefijo}/${n}`);
    } catch {
      return []; // todavía no hay nada
    }
  }
  return listarPrivado(`${prefijo}/`);
}
