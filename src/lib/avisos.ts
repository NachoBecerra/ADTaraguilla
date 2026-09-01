import { createHash } from "node:crypto";
import {
  borrarPrivado,
  escribirPrivado,
  leerPrivado,
  listarPrivado,
} from "@/lib/privado";

/**
 * Suscripciones a los avisos.
 *
 * Cada dispositivo que acepta recibir avisos genera una suscripción propia del
 * navegador. Esa suscripción ya identifica al dispositivo, así que **no hace
 * falta que nadie se registre**: las preferencias se guardan junto a ella.
 *
 * Se guarda un archivo por suscripción, no una lista común, para que dos
 * personas suscribiéndose a la vez no se pisen. El nombre del archivo es un
 * resumen de la dirección de la suscripción, así que reinscribirse desde el
 * mismo dispositivo sobrescribe en vez de duplicar.
 */

const CARPETA = "avisos";

export type Suscripcion = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** Identificador del equipo del que se quieren avisos. */
  equipo: string;
  creada: string;
};

/**
 * Nombre del archivo de una suscripción.
 *
 * La dirección es larga y trae caracteres que no valen en una ruta, así que se
 * resume. Además evita guardar la dirección completa en el nombre, que es a fin
 * de cuentas un dato del dispositivo de alguien.
 */
export function rutaDe(endpoint: string): string {
  const resumen = createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
  return `${CARPETA}/${resumen}.json`;
}

export async function guardarSuscripcion(s: Suscripcion): Promise<boolean> {
  return escribirPrivado(rutaDe(s.endpoint), s);
}

export async function borrarSuscripcion(endpoint: string): Promise<void> {
  await borrarPrivado(rutaDe(endpoint));
}

/** Todas las suscripciones guardadas. */
export async function todasLasSuscripciones(): Promise<Suscripcion[]> {
  const rutas = await listarPrivado(`${CARPETA}/`);
  const leidas = await Promise.all(
    rutas.map((r) => leerPrivado<Suscripcion | null>(r, null)),
  );
  return leidas.filter((s): s is Suscripcion => Boolean(s?.endpoint));
}
