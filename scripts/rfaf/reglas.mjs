/**
 * Cuándo creerse lo que publica la RFAF.
 *
 * Sin dependencias a propósito: son decisiones de fecha y hora, y así se
 * prueban solas con `node scripts/rfaf/probar.mjs`.
 */

/**
 * Cuánto tarda como poco un partido en poder tener resultado, desde el saque.
 *
 * Ni el más corto —dos partes de veinticinco del prebenjamín— cabe en menos.
 */
export const MINIMO_PARA_TENER_RESULTADO_MS = 60 * 60_000;

/**
 * La hora del saque en milisegundos, contando en hora española.
 *
 * La sincronización corre en GitHub, que va en UTC, así que un partido de las
 * 19:00 se leería como las 19:00 UTC: dos horas más tarde de lo que es. Con eso,
 * un resultado legítimo parecería llegado antes de tiempo toda la tarde.
 */
export function saqueEnMs(fecha, hora) {
  const comoSiFueraUtc = Date.parse(`${fecha}T${hora ?? "00:00"}:00Z`);
  if (Number.isNaN(comoSiFueraUtc)) return null;

  const referencia = new Date(comoSiFueraUtc);
  const desfase =
    new Date(referencia.toLocaleString("en-US", { timeZone: "Europe/Madrid" })) -
    new Date(referencia.toLocaleString("en-US", { timeZone: "UTC" }));

  return comoSiFueraUtc - desfase;
}

/**
 * ¿Puede este resultado ser de verdad, o llega antes de tiempo?
 *
 * El 6 de septiembre de 2026, a las 18:22, la RFAF daba por jugado —con
 * resultado— un partido que empezaba a las 19:00. La web se lo creyó: dio el
 * partido por terminado, retiró la retransmisión en directo de la portada y
 * pasó la tarjeta al partido siguiente, con el equipo todavía en el campo.
 *
 * Un resultado anterior al partido no es un resultado. Ante la duda se
 * descarta: no tener resultado es un hueco que se rellena en la siguiente
 * pasada; tener uno falso es publicar una mentira.
 */
export function resultadoCreible(fecha, hora, ahora = Date.now()) {
  if (!fecha) return true; // sin fecha no hay forma de juzgar; que pase

  const saque = saqueEnMs(fecha, hora);
  if (saque === null) return true;

  return ahora >= saque + MINIMO_PARA_TENER_RESULTADO_MS;
}
