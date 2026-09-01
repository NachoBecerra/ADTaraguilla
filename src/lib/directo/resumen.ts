import { leerRegistro, listarRegistros } from "@/lib/directo/almacen";
import { minutoEn, plegar, type Fase } from "@/lib/directo/modelo";
import { diasDeLaVentana, idsDeLaVentana } from "@/lib/directo/ventana";

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
 * quedó. Pasado eso se retira solo: a partir de ahí el resultado que vale es el
 * del acta de la RFAF, que llega por la sincronización.
 */
const TRAS_EL_FINAL_MS = 3 * 60 * 60_000;

type ResumenInterno = ResumenDirecto & { terminadoHace: number };

function resumir(registro: Awaited<ReturnType<typeof leerRegistro>>): ResumenInterno | null {
  if (!registro) return null;

  const estado = plegar(registro.eventos, registro.partido.minutosPorParte);
  return {
    terminadoHace:
      estado.fase === "final" ? Date.now() - Date.parse(registro.actualizado) : 0,
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
        // Y lo que terminó hace rato deja paso al resultado oficial
        r.terminadoHace < TRAS_EL_FINAL_MS,
    )
    // `terminadoHace` es de uso interno: no tiene por qué salir a la red
    .map((r) => {
      const resumen: ResumenDirecto = { ...r };
      delete (resumen as Partial<ResumenInterno>).terminadoHace;
      return resumen;
    });
}
