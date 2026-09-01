/**
 * En qué punto está una retransmisión, y si el panel debe enseñarla.
 *
 * Sin dependencias a propósito: es una decisión de tres datos, y así se puede
 * probar sola con `npm run directo:probar`.
 */

export type EstadoPanel =
  /** Nadie la ha abierto todavía. */
  | "sin-abrir"
  /** Abierta pero sin pitar el inicio. */
  | "abierta"
  | "en-directo"
  /** Terminada, pero aún se puede rematar la cronología. */
  | "terminada"
  /** Terminada hace horas: ya no se puede escribir. */
  | "caducada";

/** Lo que se sigue pudiendo escribir después de dar el partido por terminado. */
export const TRAS_EL_FINAL_MS = 180 * 60_000;

/**
 * ¿Sale este partido en el panel de directos?
 *
 * El panel enseña lo que todavía se puede hacer, así que una retransmisión
 * cerrada hace horas sobra. Pero **solo si el partido ya se jugó**.
 *
 * Un partido de hoy o de los próximos días tiene que seguir a la vista aunque
 * su retransmisión esté cerrada: si no, una prueba hecha días antes lo
 * escondería y el día del partido no habría forma de abrirlo. Con verlo, se
 * reinicia y listo.
 *
 * La cronología no se pierde en ningún caso: sigue en la página del partido.
 */
export function seVeEnElPanel(
  estado: EstadoPanel,
  fecha: string | null,
  hoy: string,
): boolean {
  if (estado !== "caducada") return true;
  return (fecha ?? "9999-99-99") >= hoy;
}
