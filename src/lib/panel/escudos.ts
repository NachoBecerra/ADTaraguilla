import { leerJson, escribirJson } from "@/lib/directo/deposito";

/**
 * La librería de escudos del club.
 *
 * Los de la RFAF ya los tenemos: vienen con los calendarios y se leen al
 * compilar. Esto es lo otro, los que no están en ninguna parte —el equipo de
 * un torneo de verano, un club de otra federación— y que alguien sube a mano
 * para que un amistoso no se quede con el escudo gris.
 *
 * **La imagen va al almacén público y aquí solo vive su dirección.** Es lo
 * mismo que se hace con las fotos de la galería, y por el mismo motivo: el
 * archivo sube directo desde el navegador y nunca pasa por el servidor.
 *
 * Un archivo común y no uno por escudo, al revés que en el directo: aquí no
 * hay dos escrituras a la vez que puedan pisarse. Se sube un escudo cuando se
 * crea un amistoso, o sea unas cuantas veces por temporada.
 */

const RUTA = "escudos/propios.json";

export type EscudoPropio = {
  /** Basta con la dirección: es única y no se repite. */
  id: string;
  nombre: string;
  url: string;
  subido: string;
};

/**
 * De dónde aceptamos que venga un escudo.
 *
 * Lo que se guarda aquí acaba pintado en la web, así que no puede ser
 * cualquier dirección de internet: quien entre al panel podría colgar una
 * imagen de fuera en la pantalla del directo. Son los mismos sitios que
 * next.config.ts permite cargar, y por eso están los dos escritos igual.
 */
const SITIOS = [/^rfaf\.filesnovanet\.es$/, /^files\.rfaf\.es$/, /\.public\.blob\.vercel-storage\.com$/];

export function esEscudoAceptable(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && SITIOS.some((s) => s.test(hostname));
  } catch {
    return false; // ni siquiera es una dirección
  }
}

export async function escudosPropios(): Promise<EscudoPropio[]> {
  const guardado = await leerJson<{ escudos?: EscudoPropio[] }>(RUTA, {});
  return guardado.escudos ?? [];
}

/** Guarda un escudo en la librería y devuelve la lista ya con él. */
export async function anadirEscudoPropio(
  nombre: string,
  url: string,
): Promise<EscudoPropio[]> {
  const antes = await escudosPropios();

  /* Subir dos veces el escudo del mismo club es fácil: se queda el nuevo, que
     es el que acaba de elegir quien lo sube */
  const otros = antes.filter((e) => e.nombre !== nombre && e.url !== url);
  const escudos = [...otros, { id: url, nombre, url, subido: new Date().toISOString() }].sort(
    (a, b) => a.nombre.localeCompare(b.nombre, "es"),
  );

  await escribirJson(RUTA, { escudos });
  return escudos;
}

/** Quita un escudo de la librería. Devuelve la lista y lo que había que borrar. */
export async function quitarEscudoPropio(
  id: string,
): Promise<{ escudos: EscudoPropio[]; borrado: EscudoPropio | null }> {
  const antes = await escudosPropios();
  const borrado = antes.find((e) => e.id === id) ?? null;
  if (!borrado) return { escudos: antes, borrado: null };

  const escudos = antes.filter((e) => e.id !== id);
  await escribirJson(RUTA, { escudos });
  return { escudos, borrado };
}
