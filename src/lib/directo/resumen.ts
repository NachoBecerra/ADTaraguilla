import { leerRegistro, listarRegistros } from "@/lib/directo/almacen";
import { minutoEn, plegar, type Fase } from "@/lib/directo/modelo";
import { diasDeLaVentana, idsDeLaVentana } from "@/lib/directo/ventana";
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
  local: string;
  visitante: string;
  goles: { local: number; visitante: number };
  fase: Fase;
  /** El minuto tal y como se pinta: "37'" o "45+2". */
  minuto: string;
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
  desdeElSaque: number;
  oficial: boolean;
};

function resumir(registro: Awaited<ReturnType<typeof leerRegistro>>): ResumenInterno | null {
  if (!registro) return null;

  const estado = plegar(registro.eventos, registro.partido.minutosPorParte);
  const saque = estado.linea.find((e) => e.tipo === "inicio")?.ts ?? null;

  return {
    terminadoHace: estado.finMs === null ? 0 : Date.now() - estado.finMs,
    desdeElSaque: saque === null ? 0 : Date.now() - saque,
    oficial: hayResultadoOficial(registro.partido.equipo, registro.partido.fecha),
    id: registro.partido.id,
    equipo: registro.partido.equipo,
    local: registro.partido.local,
    visitante: registro.partido.visitante,
    goles: estado.goles,
    fase: estado.fase,
    minuto: minutoEn(estado, Date.now()).etiqueta,
    version: registro.version,
  };
}

/** Partidos con retransmisión abierta ahora mismo. */
export async function directosDeHoy(ahora = new Date()): Promise<ResumenDirecto[]> {
  const rutas = await listarRegistros();
  const candidatos = idsDeLaVentana(rutas, diasDeLaVentana(ahora));

  const resumenes = await Promise.all(candidatos.map((id) => leerRegistro(id).then(resumir)));

  return resumenes
    .filter(
      (r): r is ResumenInterno =>
        r !== null &&
        // Abierto pero sin empezar no es un directo: no hay nada que enseñar
        r.fase !== "sin-empezar" &&
        // En cuanto la RFAF publica el resultado, el directo ha cumplido
        !r.oficial &&
        // Lo que terminó hace rato deja paso a lo oficial
        r.terminadoHace < TRAS_EL_FINAL_MS &&
        // Y lo que nadie cerró tampoco puede quedarse encendido para siempre
        r.desdeElSaque < SIN_CERRAR_MS,
    )
    // Lo de decidir es de uso interno: no tiene por qué salir a la red
    .map((r) => {
      const resumen: ResumenDirecto = { ...r };
      const interno = resumen as Partial<ResumenInterno>;
      delete interno.terminadoHace;
      delete interno.desdeElSaque;
      delete interno.oficial;
      return resumen;
    });
}
