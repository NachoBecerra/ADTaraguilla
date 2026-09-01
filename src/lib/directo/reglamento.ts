/**
 * Cuánto dura cada parte según la categoría.
 *
 * El reloj del directo lo necesita para dos cosas: saber en qué minuto arranca
 * la segunda parte (en benjamín es el 30, no el 45) y saber a partir de cuándo
 * se está jugando el descuento.
 *
 * La categoría no viene como tal en los datos de la RFAF: viene dentro del
 * nombre de la competición, en cosas como "2ª ANDALUZA PREBENJAMIN" o
 * "1ª ANDALUZA SENIOR". De ahí se saca por palabra.
 */

/** Minutos por tiempo de cada categoría, según el reglamento andaluz. */
const POR_CATEGORIA: [RegExp, number][] = [
  // Prebenjamín va antes que benjamín a propósito: "PREBENJAMIN" contiene
  // "BENJAMIN", y al revés se le asignarían 30 minutos en vez de 25.
  [/PREBENJAMIN/, 25],
  [/BENJAMIN/, 30],
  [/ALEVIN/, 35],
  [/INFANTIL/, 40],
  [/CADETE/, 45],
  [/JUVENIL/, 45],
  [/SENIOR/, 45],
];

/** Lo que se usa cuando la categoría no se reconoce: el partido de siempre. */
export const MINUTOS_POR_DEFECTO = 45;

function buscar(texto: string | null | undefined): number | null {
  const limpio = (texto ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  for (const [patron, minutos] of POR_CATEGORIA) {
    if (patron.test(limpio)) return minutos;
  }
  return null;
}

/**
 * Minutos por parte, buscando en varios textos por orden de fiabilidad.
 *
 * Se pasan varios porque ninguno es fiable del todo por separado. El campo
 * `categoria` del equipo siempre trae la palabra ("1ª ANDALUZA SENIOR"), así
 * que va primero; el nombre de la competición vale de respaldo pero no sirve
 * solo, porque hay competiciones que no la nombran: el infantil A juega la
 * "1ª Andaluza Infantil Fundación Cajasol" y el primer equipo la "Copa
 * Andalucía Senior".
 *
 * Si nada se reconoce se cae a 45 y el reloj sigue funcionando: preferimos un
 * minuto discutible a un directo roto.
 */
export function minutosPorParte(...textos: (string | null | undefined)[]): number {
  for (const texto of textos) {
    const minutos = buscar(texto);
    if (minutos !== null) return minutos;
  }
  return MINUTOS_POR_DEFECTO;
}
