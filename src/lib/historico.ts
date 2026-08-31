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

/** ¿Fue campeón, o subió al podio? Sirve para destacar la temporada. */
export function esPodio(posicion: number | null): boolean {
  return posicion !== null && posicion >= 1 && posicion <= 3;
}
