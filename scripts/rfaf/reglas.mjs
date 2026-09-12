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

/* --------------------------------------------- lo ya jugado no se borra */

/**
 * De dónde salió un resultado.
 *
 * Por ahora solo hay una procedencia buena: la diferencia en la clasificación.
 * Se guarda con el partido para poder distinguir lo deducido de lo que se
 * copió del marcador cuando aún no sabíamos que estaba trucado.
 */
export const ORIGEN_TABLA = "clasificacion";

/** Un partido se reconoce por quiénes lo juegan. */
export const clavePartido = (p) => `${p.local}|${p.visitante}`;

/**
 * Los partidos ya jugados que el calendario nuevo ha dejado de traer.
 *
 * Hay que conservarlos, y esto se escribe después de ver a la RFAF servir su
 * calendario a medias tres días seguidos. Primero dejó de publicar la jornada
 * 1 del senior entera; luego la devolvió con uno solo de sus nueve partidos; y
 * el sábado siguiente hizo lo mismo con la del infantil A, dejándola en dos de
 * ocho. Como la lista de partidos de cada jornada se arma desde ese
 * calendario, cada recorte se llevaba por delante un partido de verdad.
 *
 * **La regla: lo que ya se jugó es historia y no se toca; de lo que está por
 * jugarse manda el calendario.** Un partido pasado no cambia de día ni se
 * cancela; si desaparece del calendario es un renuncio de la federación, no
 * una noticia. Uno futuro que desaparece sí es una noticia: se ha aplazado.
 *
 * No basta con guardar los que ya tienen resultado. El del infantil A se
 * esfumó dos horas después de jugarse, con el acta todavía sin cerrar, y sin
 * el partido en su sitio el resultado no habría llegado nunca: se deduce
 * restando en la clasificación, y para eso hace falta el partido al que
 * colgárselo.
 *
 * Lo que sigue en el calendario **en cualquier jornada** no se rescata, y eso
 * es lo que evita duplicar un partido aplazado que la RFAF recoloca en otra
 * fecha: el calendario nuevo ya lo trae, y el suyo es el bueno.
 *
 * "Ya se jugó" se mide con la misma vara que el resto del proyecto: una hora
 * después del saque. No vale comparar días, y costó otra pasada descubrirlo:
 * el partido del infantil A era de **esa misma mañana**, así que su fecha no
 * era anterior a hoy y se perdió igual. Los resultados llegan el mismo día en
 * que se juegan; si la regla no cubre hoy, no cubre nada.
 */
export function partidosCongelados(previos, enElCalendario, ahora = Date.now()) {
  return (previos ?? []).filter((p) => {
    if (enElCalendario.has(clavePartido(p))) return false;

    /* Con resultado es historia, aunque su fecha se hubiera quedado en blanco */
    if (p.jugado && p.origen === ORIGEN_TABLA) return true;

    /* Y sin resultado, basta con que ya pueda haberse jugado */
    return Boolean(p.fecha) && resultadoCreible(p.fecha, p.hora ?? null, ahora);
  });
}

/** Todos los emparejamientos que trae un calendario, en cualquier jornada. */
export function partidosDelCalendario(calendario) {
  return new Set((calendario ?? []).flatMap((j) => (j.partidos ?? []).map(clavePartido)));
}

/* ------------------------------------------ el resultado, por diferencia */

/** Una jornada de descanso no es un partido. */
const esDescanso = (nombre) => /^\s*descansa\s*$/i.test(nombre ?? "");

/** Goles a favor y en contra de este partido, vistos desde nuestro lado. */
function comoLoVemos(partido, nombreRfaf) {
  const somosLocal = partido.local === nombreRfaf;
  return somosLocal
    ? { favor: partido.golesLocal, contra: partido.golesVisitante }
    : { favor: partido.golesVisitante, contra: partido.golesLocal };
}

/**
 * Tope de goles que se acepta como creíble en un partido.
 *
 * No es por incredulidad: es para no publicar el resultado de una cuenta que
 * se ha desalineado. Un 14-0 de alevines cabe; un 40-3 es que algo no cuadra.
 */
const GOLES_IMPOSIBLES = 30;

/**
 * El resultado de nuestro último partido, deducido de la clasificación.
 *
 * **Por qué no se lee del marcador de la RFAF.** Porque no se puede: el portal
 * ofusca los resultados a propósito —dígitos señuelo escondidos con CSS, otros
 * inyectados desde JavaScript, y cambiando en cada petición—, y lo que leíamos
 * eran las trampas. Un domingo entero publicando 1-12 y 0-18 en primera
 * andaluza, y un 4-4 donde hubo un 1-0.
 *
 * La tabla de clasificación, en cambio, va en texto plano y es correcta. Y para
 * lo único que esta web necesita —los partidos de **nuestros** equipos— la
 * tabla basta: cuando a un equipo le sube en uno la cuenta de jugados, la
 * diferencia de goles a favor y en contra **es** el resultado de ese partido.
 *
 * Se deduce solo cuando no hay ninguna duda: exactamente un partido nuevo y
 * exactamente un candidato sin resultado. Si se aplazan partidos o pasan dos
 * jornadas sin mirar, se deja en blanco. Un hueco se rellena; una mentira se
 * queda publicada.
 *
 * Los puntos no se usan para comprobar: una sanción los mueve sin tocar los
 * goles, y no sería justo perder un resultado bueno por eso.
 */
export function resultadoPorClasificacion({ nombreRfaf, clasificacion, jornadas, ahora = Date.now() }) {
  const fila = (clasificacion ?? []).find((c) => c.equipo === nombreRfaf);
  if (!fila || typeof fila.jugados !== "number") return null;

  let contados = 0;
  let favorContados = 0;
  let contraContados = 0;
  const candidatos = [];

  (jornadas ?? []).forEach((jornada, j) => {
    (jornada.partidos ?? []).forEach((partido, i) => {
      const nuestro = partido.local === nombreRfaf || partido.visitante === nombreRfaf;
      if (!nuestro) return;
      if (esDescanso(partido.local) || esDescanso(partido.visitante)) return;

      const { favor, contra } = comoLoVemos(partido, nombreRfaf);
      if (favor !== null && favor !== undefined && contra !== null && contra !== undefined) {
        contados += 1;
        favorContados += favor;
        contraContados += contra;
        return;
      }

      /* Solo cuenta como candidato si ya puede haberse jugado: si no, el
         partido nuevo de la tabla sería otro y le colgaríamos el resultado
         al que viene */
      if (resultadoCreible(partido.fecha ?? jornada.fecha ?? null, partido.hora ?? null, ahora)) {
        candidatos.push({ jornada: j, partido: i, ficha: partido });
      }
    });
  });

  if (fila.jugados - contados !== 1) return null;
  if (candidatos.length !== 1) return null;

  const favor = fila.golesFavor - favorContados;
  const contra = fila.golesContra - contraContados;
  const sano = (n) => Number.isInteger(n) && n >= 0 && n <= GOLES_IMPOSIBLES;
  if (!sano(favor) || !sano(contra)) return null;

  const { jornada, partido, ficha } = candidatos[0];
  const somosLocal = ficha.local === nombreRfaf;

  return {
    jornada,
    partido,
    golesLocal: somosLocal ? favor : contra,
    golesVisitante: somosLocal ? contra : favor,
  };
}
