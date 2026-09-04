import type { EventoEnLinea, Lado } from "@/lib/directo/modelo";

/**
 * Las cuentas del partido: cuántos córneres, cuántos fueras de juego, cuántas
 * tarjetas.
 *
 * Nace de mirar la retransmisión desde la grada: los datos ya estaban todos en
 * la cronología, pero para saber cuántos disparos llevaba el equipo había que
 * bajar contando mensajes de uno en uno. Son la misma información leída de otra
 * manera, así que se derivan de la cronología y no se guardan: si se corrige un
 * evento —o se anula—, las cuentas se corrigen solas.
 */

/** Lo que se cuenta, en el orden en que se enseña. */
export const CUENTAS = [
  "gol",
  "disparo",
  "corner",
  "tiroLibre",
  "fueraDeJuego",
  "amarilla",
  "roja",
] as const;

export type Cuenta = (typeof CUENTAS)[number];

export const NOMBRES: Record<Cuenta, string> = {
  gol: "Goles",
  disparo: "Tiros a puerta",
  corner: "Córners",
  tiroLibre: "Tiros libres",
  fueraDeJuego: "Fueras de juego",
  amarilla: "Tarjetas amarillas",
  roja: "Tarjetas rojas",
};

export type Recuento = Record<Cuenta, number>;

const aCero = (): Recuento =>
  Object.fromEntries(CUENTAS.map((c) => [c, 0])) as Recuento;

/**
 * Cuenta los eventos de la cronología, por equipo.
 *
 * Con `parte` cuenta solo la de ese número; sin ella, el partido entero.
 */
export function contar(
  linea: EventoEnLinea[],
  parte?: number,
): Record<Lado, Recuento> {
  const cuentas: Record<Lado, Recuento> = { local: aCero(), visitante: aCero() };

  for (const e of linea) {
    if (parte !== undefined && e.parte !== parte) continue;

    if (e.tipo === "gol") cuentas[e.equipo].gol += 1;
    else if (e.tipo === "jugada") cuentas[e.equipo][e.clase] += 1;
    else if (e.tipo === "tarjeta") cuentas[e.equipo][e.color] += 1;
  }

  return cuentas;
}

/**
 * Las partes que se han llegado a jugar, para no ofrecer una pestaña vacía.
 *
 * Se mira la cronología y no la fase del partido: en el descanso la segunda
 * parte todavía no existe, y con el partido terminado existen las dos.
 */
export function partesJugadas(linea: EventoEnLinea[]): number[] {
  const vistas = new Set(linea.map((e) => e.parte).filter((p) => p > 0));
  return [...vistas].sort((a, b) => a - b);
}

/** Si no ha pasado nada que contar, no hay estadísticas que enseñar. */
export function hayAlgoQueContar(linea: EventoEnLinea[]): boolean {
  return linea.some(
    (e) => e.tipo === "gol" || e.tipo === "jugada" || e.tipo === "tarjeta",
  );
}
