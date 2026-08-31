import fs from "node:fs";
import path from "node:path";

/**
 * Palmarés e histórico de clasificaciones.
 *
 * Son datos congelados: una temporada terminada no cambia, así que se
 * recogen una vez y no se vuelven a pedir.
 */

const DIR = path.join(process.cwd(), "src", "data", "rfaf", "historico");

export type FilaHistorica = {
  posicion: number;
  equipo: string;
  puntos: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
};

export type CompeticionHistorica = {
  nombre: string;
  categoria: string;
  grupo: string;
  codGrupo: string;
  puntos: number | null;
  posicion: number | null;
  clasificacion?: FilaHistorica[];
  urlClasificacion?: string;
  sinClasificacion?: boolean;
};

export type TemporadaHistorica = {
  temporada: string;
  competiciones: CompeticionHistorica[];
};

export type HistoricoEquipo = {
  id: string;
  nombre: string;
  nombreRfaf?: string;
  orden?: number;
  temporadas: TemporadaHistorica[];
};

export function historicoDe(id: string): HistoricoEquipo | null {
  const ruta = path.join(DIR, `${id}.json`);
  if (!fs.existsSync(ruta)) return null;
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8")) as HistoricoEquipo;
  } catch {
    return null;
  }
}

/** El histórico de todos los equipos, en el orden en que se muestran. */
export function todosLosHistoricos(): HistoricoEquipo[] {
  if (!fs.existsSync(DIR)) return [];

  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as HistoricoEquipo;
      } catch {
        return null;
      }
    })
    .filter((h): h is HistoricoEquipo => h !== null && h.temporadas.length > 0)
    .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
}

/** Todos los campeonatos del club, del más reciente al más antiguo. */
export function titulosDelClub(): Titulo[] {
  const titulos: Titulo[] = [];

  for (const h of todosLosHistoricos()) {
    for (const t of h.temporadas) {
      for (const c of t.competiciones) {
        if (c.posicion === 1) {
          titulos.push({
            equipo: h.nombre,
            equipoId: h.id,
            temporada: t.temporada,
            competicion: c.nombre,
            puntos: c.puntos,
          });
        }
      }
    }
  }

  return titulos.sort(
    (a, b) => b.temporada.localeCompare(a.temporada) || a.equipo.localeCompare(b.equipo, "es"),
  );
}

export type Titulo = {
  equipo: string;
  equipoId: string;
  temporada: string;
  competicion: string;
  puntos: number | null;
};

/** ¿Fue campeón, o subió al podio? Sirve para destacar la temporada. */
export function esPodio(posicion: number | null): boolean {
  return posicion !== null && posicion >= 1 && posicion <= 3;
}
