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
  const comoSiFueraUtc = Date.parse(`${fecha}T${hora ?? HORA_SIN_FIJAR}:00Z`);
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

/**
 * Cuándo se da por jugado un partido al que la RFAF aún no ha puesto hora.
 *
 * **Al final de su día.** Es lo prudente para todo lo que pregunta «¿ya se ha
 * jugado?»: un partido sin hora no se hace candidato a resultado de madrugada
 * —y no le quita el sitio a otro partido del equipo que sí se ha jugado—, no
 * desaparece del panel a media tarde y el enlace de retransmitir no caduca
 * antes de un partido de noche.
 *
 * Antes cada parte suponía una cosa: la sincronización, la medianoche; la web,
 * el mediodía. `src/lib/directo/partidos.ts` usa este mismo valor y tienen que
 * coincidir.
 */
export const HORA_SIN_FIJAR = "23:59";

/** Lo que tarda el árbitro en cerrar el acta, contando desde el saque. */
export const MINUTOS_HASTA_EL_ACTA = 120;

/**
 * ¿Debería tener ya resultado este partido?
 *
 * Es lo que decide si merece la pena volver a pedir un equipo: mientras falte
 * el resultado de un partido que ya acabó, no se le salta.
 *
 * **En hora española.** Esto vivía en la sincronización y calculaba el final
 * con `new Date("…T19:00:00")`, que se lee en la hora del servidor. GitHub va en
 * UTC, así que un partido de las 19:00 se daba por terminado a las 23:00: dos
 * horas cada tarde de partido en las que el equipo se saltaba y su resultado
 * no se pedía. En local no se veía, porque el ordenador va en hora española.
 */
export function yaDeberiaTenerResultado(p, ahora = Date.now()) {
  if (p.jugado || !p.fecha) return false;

  const saque = saqueEnMs(p.fecha, p.hora ?? null);
  // Una fecha que no se entiende: mejor mirar de más que quedarse sin resultado
  if (saque === null) return true;

  return ahora >= saque + MINUTOS_HASTA_EL_ACTA * 60_000;
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
 *
 * **Con varios pendientes, decide el campo.** Un partido suspendido que nunca
 * tendrá resultado dejaba al equipo con dos candidatos para siempre, y desde
 * ahí no se deducía ni un resultado más en toda la temporada. La tabla separa
 * lo jugado en casa y fuera: si solo ha crecido uno de los dos y solo un
 * pendiente se jugó en ese campo, es él, sin ninguna duda. Si los dos
 * pendientes son del mismo campo, sigue sin deducirse: es preferible un hueco
 * que avisa (`atascoDeResultados`) a un resultado colgado del partido que no es.
 */
/**
 * Lo que dice la tabla frente a lo que tenemos: partidos con resultado, goles
 * ya contados y candidatos a ser el partido que falta, en total y por campo.
 */
function cuentasDelEquipo({ nombreRfaf, clasificacion, jornadas, ahora }) {
  const fila = (clasificacion ?? []).find((c) => c.equipo === nombreRfaf);
  if (!fila || typeof fila.jugados !== "number") return null;

  let contados = 0;
  let contadosCasa = 0;
  let contadosFuera = 0;
  let favorContados = 0;
  let contraContados = 0;
  const candidatos = [];

  (jornadas ?? []).forEach((jornada, j) => {
    (jornada.partidos ?? []).forEach((partido, i) => {
      const nuestro = partido.local === nombreRfaf || partido.visitante === nombreRfaf;
      if (!nuestro) return;
      if (esDescanso(partido.local) || esDescanso(partido.visitante)) return;

      const enCasa = partido.local === nombreRfaf;
      const { favor, contra } = comoLoVemos(partido, nombreRfaf);
      if (favor !== null && favor !== undefined && contra !== null && contra !== undefined) {
        contados += 1;
        if (enCasa) contadosCasa += 1;
        else contadosFuera += 1;
        favorContados += favor;
        contraContados += contra;
        return;
      }

      /* Solo cuenta como candidato si ya puede haberse jugado: si no, el
         partido nuevo de la tabla sería otro y le colgaríamos el resultado
         al que viene */
      if (resultadoCreible(partido.fecha ?? jornada.fecha ?? null, partido.hora ?? null, ahora)) {
        candidatos.push({ jornada: j, partido: i, ficha: partido, enCasa });
      }
    });
  });

  /* Las tablas guardadas antes de separar por campo no lo traen: entonces no
     se desempata, y todo funciona como antes */
  const porCampo = typeof fila.jugadosCasa === "number" && typeof fila.jugadosFuera === "number";

  return {
    fila,
    favorContados,
    contraContados,
    candidatos,
    nuevos: fila.jugados - contados,
    nuevosCasa: porCampo ? fila.jugadosCasa - contadosCasa : null,
    nuevosFuera: porCampo ? fila.jugadosFuera - contadosFuera : null,
  };
}

export function resultadoPorClasificacion({ nombreRfaf, clasificacion, jornadas, ahora = Date.now() }) {
  const cuentas = cuentasDelEquipo({ nombreRfaf, clasificacion, jornadas, ahora });
  if (!cuentas) return null;

  // Los goles solo se pueden atribuir si la tabla ha contado exactamente uno
  if (cuentas.nuevos !== 1) return null;

  let posibles = cuentas.candidatos;
  if (cuentas.nuevosCasa !== null) {
    const casa = cuentas.nuevosCasa === 1 && cuentas.nuevosFuera === 0;
    const fuera = cuentas.nuevosCasa === 0 && cuentas.nuevosFuera === 1;
    // La tabla por campo no cuadra con el total: algo raro, mejor no tocar
    if (!casa && !fuera) return null;
    /* Y vale también con un solo candidato: si la tabla dice que fue en casa y
       el único pendiente es fuera, el partido que ha contado es otro */
    posibles = posibles.filter((c) => c.enCasa === casa);
  }
  if (posibles.length !== 1) return null;

  const favor = cuentas.fila.golesFavor - cuentas.favorContados;
  const contra = cuentas.fila.golesContra - cuentas.contraContados;
  const sano = (n) => Number.isInteger(n) && n >= 0 && n <= GOLES_IMPOSIBLES;
  if (!sano(favor) || !sano(contra)) return null;

  const { jornada, partido, ficha } = posibles[0];
  const somosLocal = ficha.local === nombreRfaf;

  return {
    jornada,
    partido,
    golesLocal: somosLocal ? favor : contra,
    golesVisitante: somosLocal ? contra : favor,
  };
}

/**
 * ¿Cuenta la tabla partidos que no sabemos colocar?
 *
 * Es el hueco que la deducción deja a propósito cuando duda. Antes quedaba en
 * silencio, y un equipo podía pasarse la temporada sin un resultado más sin que
 * nadie se enterase. Esto no arregla nada: dice qué partidos hay que mirar,
 * para que alguien lo resuelva a mano.
 *
 * Se pregunta después de haber deducido lo que se pudiera: si se ha colocado,
 * no hay atasco.
 */
export function atascoDeResultados({ nombreRfaf, clasificacion, jornadas, ahora = Date.now() }) {
  const cuentas = cuentasDelEquipo({ nombreRfaf, clasificacion, jornadas, ahora });
  if (!cuentas || cuentas.nuevos < 1) return null;
  if (resultadoPorClasificacion({ nombreRfaf, clasificacion, jornadas, ahora })) return null;

  return {
    sinColocar: cuentas.nuevos,
    candidatos: cuentas.candidatos.map((c) => c.ficha),
  };
}

/* ----------------------------------------- un equipo no se cae de golpe */

/**
 * Días que se conserva en la web un equipo que la ficha del club deja de listar.
 *
 * La RFAF sirve la ficha del club igual que los calendarios: a veces recortada.
 * El índice de equipos se rehacía con lo que trajera en cada pasada, así que
 * una lectura a medias sacaba a un equipo entero de la web hasta la pasada
 * siguiente. Pero una baja de verdad —el prebenjamín, que no llegó a
 * inscribirse esta temporada— también tiene que acabar saliendo. Tres días
 * separan las dos cosas: un recorte se arregla en media hora; una baja no vuelve.
 */
export const DIAS_DE_GRACIA_EQUIPO = 3;

/**
 * Qué hacer con los equipos del índice que no vienen en la ficha de hoy.
 *
 * `ausenteDesde` se apunta la primera vez que falta y no se toca después, así
 * que no cambia en cada pasada ni provoca una publicación cada media hora. Un
 * equipo que vuelve a salir en la ficha no llega aquí: se rehace como siempre y
 * la marca desaparece sola.
 */
export function equiposAusentes(previos, idsEnLaFicha, ahora = Date.now()) {
  const vistos = new Set(idsEnLaFicha);
  const gracia = DIAS_DE_GRACIA_EQUIPO * 86_400_000;
  const conservados = [];
  const retirados = [];

  for (const previo of previos ?? []) {
    if (!previo?.id || vistos.has(previo.id)) continue;

    const desde = Date.parse(previo.ausenteDesde ?? "");
    const ausenteDesde = Number.isFinite(desde) ? desde : ahora;

    if (ahora - ausenteDesde > gracia) retirados.push(previo.id);
    else conservados.push({ id: previo.id, ausenteDesde: new Date(ausenteDesde).toISOString() });
  }

  return { conservados, retirados };
}
