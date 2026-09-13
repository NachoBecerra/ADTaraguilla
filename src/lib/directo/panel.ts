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
 * Cuánto después del saque un partido sin nada escrito deja de tener sentido
 * en el panel. Holgado: cubre un retraso del árbitro y abrir el enlace tarde,
 * con el partido ya empezado, que es cuando más prisa hay.
 */
export const YA_NO_SE_JUEGA_MS = 3 * 60 * 60_000;

/**
 * ¿Sale este partido en el panel de directos?
 *
 * **El panel enseña lo que todavía se puede hacer.** De ahí salen todas las
 * reglas, y cada estado se mira por lo que aún admite:
 *
 * - **Con algo escrito** —en directo o recién terminado—, siempre: queda
 *   rematar la cronología, aunque la RFAF ya haya publicado el acta.
 * - **Sin nada escrito** —sin abrir, o abierto y vacío—, solo mientras el
 *   partido pueda jugarse todavía. En cuanto hay acta oficial, o han pasado
 *   horas desde el saque, no queda nada que retransmitir. Antes se veían
 *   siempre, y el día después el panel seguía ofreciendo retransmitir
 *   partidos con resultado publicado desde la víspera.
 * - **Cerrado hace horas**, solo si el partido aún no ha pasado: una prueba
 *   hecha días antes no puede esconder el partido del sábado.
 *
 * La cronología no se pierde en ningún caso: sigue en la página del partido.
 */
export function seVeEnElPanel(
  estado: EstadoPanel,
  fecha: string | null,
  hoy: string,
  {
    saqueMs,
    ahora = Date.now(),
    oficial = false,
  }: { saqueMs?: number; ahora?: number; oficial?: boolean } = {},
): boolean {
  if (estado === "en-directo" || estado === "terminada") return true;

  if (estado === "sin-abrir" || estado === "abierta") {
    if (oficial) return false;
    if (saqueMs !== undefined && Number.isFinite(saqueMs) && ahora > saqueMs + YA_NO_SE_JUEGA_MS) {
      return false;
    }
    return true;
  }

  return (fecha ?? "9999-99-99") >= hoy;
}
