import fs from "node:fs";
import path from "node:path";
import clubJson from "@/data/rfaf/club.json";
import rivalesJson from "@/data/rfaf/rivales.json";

/**
 * Lectura de los datos que sincroniza scripts/rfaf desde la RFAF.
 * Todo viene ya resuelto en JSON: aquí solo se ordena y se derivan las vistas
 * que necesita la web (próximo partido, último resultado, etc.).
 */

const DIR_EQUIPOS = path.join(process.cwd(), "src", "data", "rfaf", "equipos");

export type Partido = {
  local: string;
  visitante: string;
  codLocal: string | null;
  codVisitante: string | null;
  fecha: string | null;
  hora: string | null;
  golesLocal: number | null;
  golesVisitante: number | null;
  localidad: string | null;
  campo: string | null;
  superficie: string | null;
  urlActa: string | null;
  jugado: boolean;
};

export type Jornada = {
  numero: number | null;
  nombre: string;
  fecha: string | null;
  partidos: Partido[];
};

export type FilaClasificacion = {
  posicion: number;
  equipo: string;
  puntos: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  racha: string[];
};

export type Competicion = {
  nombre: string;
  categoria: string;
  grupo: string;
  codGrupo: string;
  estado: "activa" | "sin-calendario" | "sin-datos";
  puntos: number | null;
  posicion: number | null;
  urlCalendario?: string | null;
  urlClasificacion?: string | null;
  jornadas: Jornada[];
  clasificacion: FilaClasificacion[];
};

export type Equipo = {
  id: string;
  nombre: string;
  nombreRfaf?: string;
  categoria: string;
  codigo: string;
  orden: number;
  enCompeticion: boolean;
  temporada: string;
  actualizado: string;
  urlRfaf: string;
  competiciones: Competicion[];
};

/** Partido de uno de nuestros equipos, ya visto desde nuestro lado. */
export type PartidoPropio = Partido & {
  competicion: string;
  jornada: string;
  esLocal: boolean;
  rival: string;
  golesPropios: number | null;
  golesRival: number | null;
  resultado: "G" | "E" | "P" | null;
};

/* ------------------------------------------------------------------ lectura */

export const temporada: string = clubJson.temporada;
export const actualizado: string = clubJson.generado;
export const urlClubRfaf: string = clubJson.club.urlRfaf;

let cache: Equipo[] | null = null;

export function getEquipos(): Equipo[] {
  if (cache) return cache;

  cache = (clubJson.equipos as { id: string }[])
    .map((resumen) => {
      const ruta = path.join(DIR_EQUIPOS, `${resumen.id}.json`);
      if (!fs.existsSync(ruta)) return null;
      return JSON.parse(fs.readFileSync(ruta, "utf8")) as Equipo;
    })
    .filter((e): e is Equipo => e !== null)
    .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));

  return cache;
}

export function getEquipo(id: string): Equipo | undefined {
  return getEquipos().find((e) => e.id === id);
}

/* ------------------------------------------------------ vistas derivadas */

/** ¿Este partido lo juega el equipo indicado? */
function esDelEquipo(partido: Partido, equipo: Equipo): "local" | "visitante" | null {
  if (partido.codLocal && partido.codLocal === equipo.codigo) return "local";
  if (partido.codVisitante && partido.codVisitante === equipo.codigo) return "visitante";

  // Respaldo por nombre cuando la RFAF aún no ha publicado los códigos
  const nuestro = equipo.nombreRfaf;
  if (nuestro) {
    if (partido.local === nuestro) return "local";
    if (partido.visitante === nuestro) return "visitante";
  }
  return null;
}

/** Todos los partidos del equipo, de todas sus competiciones, por fecha. */
export function partidosDe(equipo: Equipo): PartidoPropio[] {
  const partidos: PartidoPropio[] = [];

  for (const competicion of equipo.competiciones) {
    for (const jornada of competicion.jornadas) {
      for (const partido of jornada.partidos) {
        const lado = esDelEquipo(partido, equipo);
        if (!lado) continue;

        const esLocal = lado === "local";
        const golesPropios = esLocal ? partido.golesLocal : partido.golesVisitante;
        const golesRival = esLocal ? partido.golesVisitante : partido.golesLocal;

        partidos.push({
          ...partido,
          competicion: competicion.nombre,
          jornada: jornada.nombre,
          esLocal,
          rival: esLocal ? partido.visitante : partido.local,
          golesPropios,
          golesRival,
          resultado:
            golesPropios === null || golesRival === null
              ? null
              : golesPropios > golesRival
                ? "G"
                : golesPropios < golesRival
                  ? "P"
                  : "E",
        });
      }
    }
  }

  return partidos.sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999"));
}

export const hoyIso = () => new Date().toISOString().slice(0, 10);
const hoy = hoyIso;

/**
 * Partido cuya fecha ya pasó pero del que la RFAF no nos ha dado resultado.
 * Ocurre con las eliminatorias de copa, que no llevan número de jornada y no
 * podemos consultar en detalle. Se marca como tal en vez de enseñarlo como
 * pendiente, que sería mentir.
 */
export function sinResultado(p: PartidoPropio): boolean {
  return !p.jugado && !!p.fecha && p.fecha < hoyIso();
}

export function proximoPartido(equipo: Equipo): PartidoPropio | null {
  return (
    partidosDe(equipo).find((p) => !p.jugado && (p.fecha ?? "9999") >= hoy()) ?? null
  );
}

export function ultimoResultado(equipo: Equipo): PartidoPropio | null {
  const jugados = partidosDe(equipo).filter((p) => p.jugado);
  return jugados.length > 0 ? jugados[jugados.length - 1] : null;
}

/** La competición de liga del equipo: la que tiene clasificación. */
export function competicionPrincipal(equipo: Equipo): Competicion | null {
  return (
    equipo.competiciones.find((c) => c.clasificacion.length > 0) ??
    equipo.competiciones[0] ??
    null
  );
}

/**
 * ¿Ha empezado la competición? Antes de la primera jornada la RFAF publica la
 * tabla con todo a cero y en orden alfabético: enseñar ahí un "1º" engañaría.
 */
export function haEmpezado(competicion: Competicion | null): boolean {
  return (competicion?.clasificacion ?? []).some((f) => f.jugados > 0);
}

/** Nuestra fila en la clasificación de una competición. */
export function nuestraFila(
  competicion: Competicion,
  equipo: Equipo,
): FilaClasificacion | null {
  const nuestro = equipo.nombreRfaf;
  if (!nuestro) return null;
  return competicion.clasificacion.find((f) => f.equipo === nuestro) ?? null;
}

/** Resumen para la portada: cada equipo con su próximo partido y su último resultado. */
export function resumenEquipos() {
  return getEquipos().map((equipo) => ({
    equipo,
    proximo: proximoPartido(equipo),
    ultimo: ultimoResultado(equipo),
    competicion: competicionPrincipal(equipo),
  }));
}

/* -------------------------------------------------------------- rivales */

export type ClubRival = {
  nombre: string;
  codigo: string | null;
  competiciones: string[];
  urlRfaf: string | null;
};

export function getRivales(): ClubRival[] {
  return rivalesJson.clubes as ClubRival[];
}
