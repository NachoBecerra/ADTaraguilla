import EscudoClub from "@/components/EscudoClub";
import EnlaceRetransmision from "@/components/EnlaceRetransmision";
import { site } from "@/data/site";
import { IconoEnlaceExterno } from "@/components/Iconos";
import type { Equipo, PartidoPropio } from "@/lib/competicion";

/**
 * La temporada entera de un equipo: lo jugado y lo que viene.
 *
 * Una tarjeta por mes con los partidos seguidos dentro, separados por una raya
 * fina. Antes era una tarjeta por partido y cada una gastaba una línea entera
 * para poner «J1» en una esquina: nueve partidos ocupaban el doble de pantalla
 * que ahora.
 *
 * No dice la competición —en el calendario de un equipo es la misma en todas
 * las filas— ni si se juega en casa: eso ya lo dice el orden de los dos
 * equipos, local arriba.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Botones del pie: anchos, no redondos, que se tocan con el dedo. */
const BOTON =
  "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[10px] font-bold uppercase tracking-wide";

const SIN_FECHA = "sin-fecha";

/** A qué mes pertenece un partido, en hora española. */
function mesDe(fecha: string | null): string {
  if (!fecha) return SIN_FECHA;
  return fecha.slice(0, 7);
}

function tituloDelMes(mes: string): string {
  if (mes === SIN_FECHA) return "Sin fecha";
  const [anio, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${anio}`;
}

/** Día y, si el partido está por jugar, la hora: es lo que se busca. */
function cuando(partido: PartidoPropio): string {
  if (!partido.fecha) return "Por confirmar";

  const dia = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    timeZone: "Europe/Madrid",
  })
    .format(new Date(`${partido.fecha}T12:00:00Z`))
    .replace(/[.,]/g, "");

  return !partido.jugado && partido.hora ? `${dia} · ${partido.hora}` : dia;
}

function Lado({
  nombre,
  codigo,
  esNuestro,
  goles,
  gana,
}: {
  nombre: string;
  codigo: string | null;
  esNuestro: boolean;
  goles: number | null;
  gana: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <EscudoClub nombre={nombre} codigo={codigo} esNuestro={esNuestro} size={20} />
      <p
        className={`min-w-0 flex-1 truncate text-sm leading-tight ${
          esNuestro ? "font-bold text-tinta" : "text-tinta"
        }`}
      >
        {nombre}
      </p>
      <span
        className={`title w-5 shrink-0 text-right text-base tabular-nums ${
          goles === null ? "text-mute" : gana ? "text-club" : "text-tinta"
        }`}
      >
        {goles ?? "–"}
      </span>
    </div>
  );
}

function Partido({ partido, equipo }: { partido: PartidoPropio; equipo: Equipo }) {
  const { golesLocal, golesVisitante } = partido;
  const pendiente = golesLocal === null || golesVisitante === null;

  // Nuestro escudo y nuestro nombre corto se leen mejor que los de la RFAF
  const nuestro = { nombre: site.nombre, codigo: null, esNuestro: true };
  const rival = {
    nombre: partido.rival,
    codigo: partido.esLocal ? partido.codVisitante : partido.codLocal,
    esNuestro: false,
  };

  const local = partido.esLocal ? nuestro : rival;
  const visitante = partido.esLocal ? rival : nuestro;

  return (
    <li className="py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-club">
          {partido.jornada.replace(/^Jornada\s*/i, "J")}
        </span>
        <span className="truncate text-[11px] text-mute first-letter:uppercase">
          {cuando(partido)}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <EnlaceRetransmision
            equipo={equipo.id}
            fecha={partido.fecha}
            className={`${BOTON} bg-club text-white`}
          />
          {partido.urlActa ? (
            <a
              href={partido.urlActa}
              target="_blank"
              rel="noopener noreferrer"
              title={`Acta del partido en la ${site.federacion.siglas}`}
              className={`${BOTON} bg-rfaf text-white transition-colors hover:bg-rfaf-oscuro`}
            >
              Acta
              <IconoEnlaceExterno size={11} className="shrink-0" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-1.5 space-y-1">
        <Lado {...local} goles={golesLocal} gana={!pendiente && golesLocal > golesVisitante} />
        <Lado
          {...visitante}
          goles={golesVisitante}
          gana={!pendiente && golesVisitante > golesLocal}
        />
      </div>
    </li>
  );
}

export default function CalendarioEquipo({
  partidos,
  equipo,
}: {
  partidos: PartidoPropio[];
  equipo: Equipo;
}) {
  // Los meses, en el orden en que llegan los partidos, que ya vienen ordenados
  const meses: { mes: string; partidos: PartidoPropio[] }[] = [];
  for (const p of partidos) {
    const mes = mesDe(p.fecha);
    const ultimo = meses.at(-1);
    if (ultimo?.mes === mes) ultimo.partidos.push(p);
    else meses.push({ mes, partidos: [p] });
  }

  return (
    <div className="space-y-5">
      {meses.map(({ mes, partidos: delMes }) => (
        <div key={mes}>
          <h3 className="eyebrow mb-2 first-letter:uppercase">{tituloDelMes(mes)}</h3>

          <ul className="card divide-y divide-linea px-3.5">
            {delMes.map((p, i) =>
              p.descanso ? (
                <li
                  key={`${p.fecha}-descanso-${i}`}
                  className="flex items-center gap-2 py-2.5 text-sm text-mute"
                >
                  <span className="text-[11px] font-bold text-club">
                    {p.jornada.replace(/^Jornada\s*/i, "J")}
                  </span>
                  <span className="text-[11px]">{cuando(p)}</span>
                  <span className="ml-auto italic">Jornada de descanso</span>
                </li>
              ) : (
                <Partido key={`${p.fecha}-${p.rival}-${i}`} partido={p} equipo={equipo} />
              ),
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
