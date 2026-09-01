/**
 * Qué retransmisiones pueden estar en marcha ahora, mirando solo los nombres.
 *
 * Sin dependencias a propósito: es lógica de fechas y de cadenas, y así se
 * puede probar sola con `npm run directo:probar`.
 */

const ZONA = "Europe/Madrid";

const enMadrid = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));

/**
 * Ayer, hoy y mañana en hora española.
 *
 * Los tres días no son por capricho: el servidor va en UTC y España no, así que
 * un partido de sábado por la noche puede caer ya en el "día siguiente" del
 * servidor mientras en el campo todavía es sábado. Con un solo día, ese partido
 * dejaría de aparecer a mitad de la segunda parte.
 */
export function diasDeLaVentana(ahora: Date = new Date()): string[] {
  return [-1, 0, 1].map((dias) => enMadrid(ahora.getTime() + dias * 86_400_000));
}

/**
 * De todo lo guardado, qué identificadores caen en esos días.
 *
 * Se decide por el **nombre del archivo**, antes de leer ninguno: el
 * identificador acaba en la fecha del partido. Sin este filtro, el coste de
 * saber qué hay en directo crecería con el historial de toda la temporada
 * —nueve equipos por treinta jornadas— en vez de con los partidos de estos
 * días, que como mucho son nueve.
 */
export function idsDeLaVentana(rutas: string[], dias: string[]): string[] {
  return rutas
    .map((r) => r.replace(/^directo\//, "").replace(/\.json$/, ""))
    .filter((id) => dias.some((dia) => id.endsWith(dia)));
}
