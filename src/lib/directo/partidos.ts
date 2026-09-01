import { escudoDe, getEquipos, partidosDe } from "@/lib/competicion";
import type { FichaPartido } from "@/lib/directo/almacen";
import { minutosPorParte } from "@/lib/directo/reglamento";

/**
 * Qué partidos se pueden retransmitir y cómo se identifican.
 *
 * El identificador es `<equipo>-<fecha>`. Un equipo juega un partido al día,
 * así que no hace falta el código de partido de la RFAF, que es justo lo que
 * no tenemos en las eliminatorias de copa. El directo funciona igual en copa
 * que en liga.
 */

const ZONA = "Europe/Madrid";

/**
 * Hora de saque en milisegundos.
 *
 * La RFAF da fecha y hora por separado y en hora española, pero el servidor de
 * Vercel corre en UTC: interpretarlas tal cual dejaría el enlace desfasado dos
 * horas en verano, y el delegado llegaría al campo con un enlace que aún no
 * vale. Se resuelve midiendo el desfase real de Madrid ese día, que además
 * cambia con el horario de invierno.
 */
export function saqueEnMs(fecha: string, hora: string | null): number {
  // Sin hora asignada se toma el mediodía: el enlace abarca la tarde entera
  const comoSiFueraUtc = Date.parse(`${fecha}T${hora ?? "12:00"}:00Z`);
  if (!Number.isFinite(comoSiFueraUtc)) return Number.NaN;

  const d = new Date(comoSiFueraUtc);
  const desfase =
    new Date(d.toLocaleString("en-US", { timeZone: ZONA })).getTime() -
    new Date(d.toLocaleString("en-US", { timeZone: "UTC" })).getTime();

  return comoSiFueraUtc - desfase;
}

export type Candidato = { ficha: FichaPartido; saqueMs: number };

/**
 * Partidos de los próximos días de todos los equipos, para que el club elija
 * cuál retransmitir. Se incluye el día de ayer porque un enlace puede hacer
 * falta para rematar un partido que se quedó a medias.
 */
export function partidosRetransmitibles(ahora = new Date()): Candidato[] {
  const dia = 86_400_000;
  const desde = new Date(ahora.getTime() - dia).toISOString().slice(0, 10);
  const hasta = new Date(ahora.getTime() + 8 * dia).toISOString().slice(0, 10);

  const candidatos: Candidato[] = [];

  for (const equipo of getEquipos()) {
    for (const p of partidosDe(equipo)) {
      if (p.descanso || !p.fecha) continue;
      if (p.fecha < desde || p.fecha > hasta) continue;

      const saqueMs = saqueEnMs(p.fecha, p.hora);
      if (!Number.isFinite(saqueMs)) continue;

      candidatos.push({
        saqueMs,
        ficha: {
          id: `${equipo.id}-${p.fecha}`,
          equipo: equipo.id,
          nombreEquipo: equipo.nombre,
          local: p.local,
          visitante: p.visitante,
          escudoLocal: escudoDe({ codigo: p.codLocal, nombre: p.local }),
          escudoVisitante: escudoDe({ codigo: p.codVisitante, nombre: p.visitante }),
          competicion: p.competicion,
          jornada: p.jornada,
          // La categoría del equipo manda; la competición es solo respaldo
          minutosPorParte: minutosPorParte(equipo.categoria, p.competicion),
          fecha: p.fecha,
          hora: p.hora,
          campo: p.campo,
        },
      });
    }
  }

  return candidatos.sort((a, b) => a.saqueMs - b.saqueMs);
}
