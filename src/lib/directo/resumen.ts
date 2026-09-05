import { leerRegistro, listarRegistros } from "@/lib/directo/almacen";
import { hayRetransmision, minutoEn, plegar, type Fase } from "@/lib/directo/modelo";
import { diasAnunciables, diasDeLaVentana, idsDeLaVentana } from "@/lib/directo/ventana";
import { getEquipo, partidosDe } from "@/lib/competicion";

/**
 * Lo justo para encender el "en directo" en una tarjeta.
 *
 * La ficha de un equipo y la portada solo necesitan saber que hay partido y
 * cómo va; la cronología entera se pide ya dentro. Así una visita a la portada
 * no arrastra el registro completo de tres partidos.
 *
 * **Esto no es un resultado oficial y nunca lo será.** Lo que la web da por
 * bueno son los datos de la RFAF: clasificaciones, resultados y todo lo que se
 * genera al compilar. El directo lo escribe alguien desde la banda y sirve para
 * seguir el partido mientras se juega, no para sustituir al acta.
 */

export type ResumenDirecto = {
  id: string;
  equipo: string;
  nombreEquipo: string;
  local: string;
  visitante: string;
  goles: { local: number; visitante: number };
  fase: Fase;
  /** El minuto tal y como se pinta: "37'" o "45+2". */
  minuto: string;
  /**
   * ¿Hay algo apuntado ya, o solo está anunciado?
   *
   * Separa las dos cosas que la web enseña distinto: «hoy hay directo», que es
   * una promesa para más tarde, y «en directo», que es un partido en marcha.
   * No vale mirar la fase: un aviso escrito antes del saque deja la fase en
   * «sin empezar» y sin embargo eso ya es un directo.
   */
  hayContenido: boolean;
  version: number;
};

/**
 * Cuánto se sigue enseñando un partido ya terminado.
 *
 * Un rato, para quien entra justo después del pitido final y quiere ver cómo
 * quedó. Pasado eso se retira: a partir de ahí el resultado que vale es el del
 * acta de la RFAF.
 */
const TRAS_EL_FINAL_MS = 3 * 60 * 60_000;

/**
 * Tope para un partido que nadie cerró.
 *
 * Lo normal es que el directo se apague cuando la RFAF publica el resultado.
 * Pero en las eliminatorias de copa la federación muchas veces no publica nada
 * —está documentado como limitación conocida—, y sin este tope un partido de
 * copa que el delegado olvidara cerrar seguiría marcando "EN DIRECTO 240'"
 * durante días. Es una red de seguridad, no la regla principal.
 */
const SIN_CERRAR_MS = 6 * 60 * 60_000;

/**
 * ¿Ha publicado ya la RFAF el resultado de este partido?
 *
 * Es la señal buena de que el partido acabó: en cuanto llega el acta, el
 * directo ha cumplido y deja paso a lo oficial, lo pulsara alguien o no.
 *
 * Sale de los datos que se generan al compilar, así que llega con el mismo
 * retraso que el resto de la web: unos minutos tras la sincronización.
 */
function hayResultadoOficial(equipoId: string, fecha: string | null): boolean {
  if (!fecha) return false;
  const equipo = getEquipo(equipoId);
  if (!equipo) return false;
  return partidosDe(equipo).some((p) => p.fecha === fecha && p.jugado);
}

type ResumenInterno = ResumenDirecto & {
  terminadoHace: number;
  desdeLoPrimero: number;
  hayQueEnsenar: boolean;
  anunciado: boolean;
  oficial: boolean;
};

function resumir(registro: Awaited<ReturnType<typeof leerRegistro>>): ResumenInterno | null {
  if (!registro) return null;

  const estado = plegar(registro.eventos, registro.partido.minutosPorParte);

  /* Desde lo primero que se apuntó y no desde el saque: hay retransmisiones
     que empiezan con un aviso antes de que el partido arranque, y sin esto un
     partido que nadie llegara a pitar se quedaría encendido para siempre. */
  const primero = estado.linea[0]?.ts ?? null;

  return {
    terminadoHace: estado.finMs === null ? 0 : Date.now() - estado.finMs,
    desdeLoPrimero: primero === null ? 0 : Date.now() - primero,
    /* Se enseña si hay algo apuntado o si el club lo ha anunciado a mano */
    hayQueEnsenar: hayRetransmision(estado) || Boolean(registro.anunciado),
    hayContenido: hayRetransmision(estado),
    anunciado: Boolean(registro.anunciado),
    oficial: hayResultadoOficial(registro.partido.equipo, registro.partido.fecha),
    id: registro.partido.id,
    equipo: registro.partido.equipo,
    nombreEquipo: registro.partido.nombreEquipo,
    local: registro.partido.local,
    visitante: registro.partido.visitante,
    goles: estado.goles,
    fase: estado.fase,
    minuto: minutoEn(estado, Date.now()).etiqueta,
    version: registro.version,
  };
}

/**
 * Partidos con retransmisión abierta ahora mismo, y los que están anunciados.
 *
 * Son dos cosas distintas y llegan juntas porque las pinta la misma tarjeta.
 * Se distinguen por `hayContenido`: lo anunciado todavía no tiene nada escrito
 * y no puede enseñarse como si se estuviera jugando.
 */
export async function directosDeHoy(ahora = new Date()): Promise<ResumenDirecto[]> {
  const rutas = await listarRegistros();

  /* Un anuncio se pone días antes, así que se mira más lejos que para los
     directos; pero solo para eso, que lo demás sigue siendo de estos días */
  const cerca = new Set(idsDeLaVentana(rutas, diasDeLaVentana(ahora)));
  const candidatos = idsDeLaVentana(rutas, diasAnunciables(ahora));

  const resumenes = await Promise.all(candidatos.map((id) => leerRegistro(id).then(resumir)));

  return resumenes
    .filter((r): r is ResumenInterno => {
      if (r === null) return false;

      /*
       * De los días que aún no han llegado solo sale el anuncio, y solo si no
       * tiene nada escrito: una prueba hecha hoy sobre el partido del sábado
       * que viene no puede aparecer en la portada como un partido en juego.
       */
      if (!cerca.has(r.id)) return r.anunciado && !r.hayContenido;

      return true;
    })
    .filter(
      (r): r is ResumenInterno =>
        // Abierto y con la cronología vacía no es un directo, salvo que el club
        // lo haya anunciado. Basta un comentario para que lo sea, aunque no se
        // haya pitado
        r.hayQueEnsenar &&
        // En cuanto la RFAF publica el resultado, el directo ha cumplido
        !r.oficial &&
        // Lo que terminó hace rato deja paso a lo oficial
        r.terminadoHace < TRAS_EL_FINAL_MS &&
        // Y lo que nadie cerró tampoco puede quedarse encendido para siempre
        r.desdeLoPrimero < SIN_CERRAR_MS,
    )
    // Lo de decidir es de uso interno: no tiene por qué salir a la red
    .map((r) => {
      const resumen: ResumenDirecto = { ...r };
      const interno = resumen as Partial<ResumenInterno>;
      delete interno.terminadoHace;
      delete interno.desdeLoPrimero;
      delete interno.hayQueEnsenar;
      delete interno.anunciado;
      delete interno.oficial;
      return resumen;
    });
}
