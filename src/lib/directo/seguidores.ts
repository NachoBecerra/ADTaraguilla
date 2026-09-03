import { borrarJson, crearJson, listarJson } from "@/lib/directo/deposito";

/**
 * Cuánta gente ha seguido un partido.
 *
 * **Un archivo por visita, no una lista común.** Es el mismo motivo por el que
 * las suscripciones a los avisos se guardan una por archivo: con una lista, dos
 * personas entrando a la vez leen lo mismo, cada una añade lo suyo y la segunda
 * escritura borra a la primera. Y así es exactamente como llega la gente a un
 * directo —de golpe, después de mandar el enlace por WhatsApp—, así que no sería
 * perder una visita suelta: sería perder la mitad.
 *
 * Se guarda **aparte del partido** y no dentro de su registro. El registro es la
 * verdad del encuentro y lo escribe quien está en el campo: meter ahí las
 * visitas sería arriesgarse a que una visita y un gol llegaran a la vez y se
 * perdiera el gol. Además, cada visita cambiaría la versión del registro y
 * echaría por tierra el ETag, que es lo que hace barato preguntar cada cinco
 * segundos.
 *
 * **El identificador es de un partido, no de una persona.** Cada navegador se
 * inventa uno nuevo para cada encuentro, así que sirve para no contar dos veces
 * a quien recarga y no sirve para seguir a nadie de un partido al siguiente. Es
 * lo mínimo que hace falta para dar una cifra, sin guardar nada de nadie.
 */

const carpeta = (partido: string) => `directo/seguidores/${partido}`;

/**
 * Tope de visitas anotadas.
 *
 * Pasado eso el número se queda quieto. Un partido de este club no va a
 * acercarse ni de lejos, pero una carpeta sin límite es una carpeta que algún
 * día crece sin control.
 */
const MAXIMO = 5000;

/** Cuánta gente ha abierto este partido. */
export async function cuantosSiguen(partido: string): Promise<number> {
  return (await listarJson(carpeta(partido))).length;
}

/**
 * Anota una visita y devuelve el total.
 *
 * Crear-si-no-existe, así que recargar la página no suma otra vez y dos visitas
 * simultáneas no pueden pisarse: cada una escribe su propio archivo.
 */
export async function anotarSeguidor(partido: string, id: string): Promise<number> {
  const rutas = await listarJson(carpeta(partido));
  if (rutas.length >= MAXIMO) return rutas.length;

  const mia = `${carpeta(partido)}/${id}.json`;
  if (rutas.includes(mia)) return rutas.length;

  await crearJson(mia, { visto: new Date().toISOString() });
  return rutas.length + 1;
}

/**
 * Borra la cuenta entera de un partido.
 *
 * Al eliminar un amistoso no puede quedarse su rastro de visitas rondando por
 * el almacén.
 */
export async function borrarSeguidores(partido: string): Promise<void> {
  const rutas = await listarJson(carpeta(partido));
  await Promise.all(rutas.map(borrarJson));
}
