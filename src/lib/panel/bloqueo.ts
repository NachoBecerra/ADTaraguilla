/**
 * Cuándo se deja de aceptar intentos de contraseña desde un mismo sitio.
 *
 * El panel se abre con una sola contraseña compartida, y hasta ahora se podía
 * probar sin límite: acertar da treinta días de sesión con permiso para
 * publicar y borrar en la web del club. Esto no cambia nada para quien se
 * equivoca un par de veces; frena a quien prueba contraseñas en bucle.
 *
 * Sin dependencias a propósito: son cuentas de tiempo, y así se prueban solas
 * con `node scripts/panel/probar.mjs`.
 */

/** Fallos seguidos que se admiten antes de bloquear. */
export const MAX_FALLOS = 5;

/** Dos fallos más separados que esto no se cuentan juntos. */
export const VENTANA_FALLOS_MS = 15 * 60_000;

/** Lo que dura el bloqueo. */
export const BLOQUEO_MS = 15 * 60_000;

export type Intentos = {
  fallos: number;
  ultimoFallo: number;
  bloqueadoHasta: number | null;
};

/** Milisegundos que le quedan al bloqueo, o null si se puede intentar. */
export function bloqueoRestante(intentos: Intentos | null, ahora: number): number | null {
  if (!intentos?.bloqueadoHasta) return null;
  const quedan = intentos.bloqueadoHasta - ahora;
  return quedan > 0 ? quedan : null;
}

/**
 * Apunta un fallo.
 *
 * `acabaDeBloquearse` es verdad solo en el fallo que cierra el paso, que es
 * cuando hay que avisar: un aviso por bloqueo, no uno por cada intento.
 */
export function trasUnFallo(
  previos: Intentos | null,
  ahora: number,
): { intentos: Intentos; acabaDeBloquearse: boolean } {
  const seguidos = previos && ahora - previos.ultimoFallo <= VENTANA_FALLOS_MS;
  const fallos = seguidos ? previos.fallos + 1 : 1;

  if (fallos >= MAX_FALLOS) {
    return {
      intentos: { fallos, ultimoFallo: ahora, bloqueadoHasta: ahora + BLOQUEO_MS },
      acabaDeBloquearse: true,
    };
  }

  return {
    intentos: { fallos, ultimoFallo: ahora, bloqueadoHasta: null },
    acabaDeBloquearse: false,
  };
}
