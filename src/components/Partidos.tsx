import { sinResultado, type PartidoPropio } from "@/lib/competicion";
import { fechaLarga, diaYHora } from "@/lib/formato";
import { site } from "@/data/site";
import EscudoClub from "@/components/EscudoClub";
import { IconoCalendario, IconoUbicacion, IconoEnlaceExterno } from "@/components/Iconos";

const COLOR_RESULTADO = {
  G: "bg-club text-white",
  E: "bg-panel-2 text-tinta",
  P: "bg-tinta/80 text-white",
} as const;

const TEXTO_RESULTADO = { G: "Victoria", E: "Empate", P: "Derrota" } as const;

/** Marcador o pendiente, en formato de tarjeta de resultado. */
export function Marcador({ partido }: { partido: PartidoPropio }) {
  if (!partido.jugado) {
    return (
      <span
        className="whitespace-nowrap rounded-lg bg-panel-2 px-2.5 py-1 text-xs font-bold text-mute"
        title={
          sinResultado(partido)
            ? "La RFAF no publica el resultado de este partido"
            : undefined
        }
      >
        {sinResultado(partido) ? "s/r" : (partido.hora ?? "—")}
      </span>
    );
  }

  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
        COLOR_RESULTADO[partido.resultado ?? "E"]
      }`}
    >
      {partido.golesPropios} – {partido.golesRival}
    </span>
  );
}

/** Una línea de partido: fecha, rival, dónde y marcador. */
export function FilaPartido({
  partido,
  mostrarCompeticion = false,
}: {
  partido: PartidoPropio;
  mostrarCompeticion?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-linea py-3 last:border-0">
      <div className="w-14 shrink-0 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-mute">
          {partido.jornada.replace(/^Jornada\s*/i, "J")}
        </p>
        <p className="text-xs text-mute">
          {partido.fecha
            ? new Intl.DateTimeFormat("es-ES", {
                day: "2-digit",
                month: "2-digit",
                timeZone: "Europe/Madrid",
              }).format(new Date(partido.fecha))
            : "—"}
        </p>
      </div>

      <EscudoClub
        nombre={partido.rival}
        codigo={partido.esLocal ? partido.codVisitante : partido.codLocal}
        size={26}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-tinta">
          <span className="mr-1.5 text-[11px] font-bold uppercase text-club-soft">
            {partido.esLocal ? "Casa" : "Fuera"}
          </span>
          {partido.rival}
        </p>
        <p className="truncate text-xs text-mute">
          {mostrarCompeticion ? `${partido.competicion} · ` : ""}
          {partido.campo ?? "Campo por confirmar"}
        </p>
      </div>

      <Marcador partido={partido} />

      {partido.urlActa ? (
        <a
          href={partido.urlActa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Acta del partido en la RFAF"
          className="shrink-0 text-mute transition-colors hover:text-club"
        >
          <IconoEnlaceExterno size={15} />
        </a>
      ) : null}
    </li>
  );
}

/** Tarjeta grande de próximo partido, con los dos escudos. */
export function TarjetaProximoPartido({
  partido,
  titulo,
}: {
  partido: PartidoPropio;
  titulo: string;
}) {
  const { dia, hora } = partido.fecha
    ? diaYHora(`${partido.fecha}T${partido.hora ?? "12:00"}:00`)
    : { dia: "Fecha por confirmar", hora: "" };

  const lado = (nombre: string, props: { esNuestro?: boolean; codigo?: string | null }) => (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-panel-2 sm:h-16 sm:w-16">
        <EscudoClub nombre={nombre} size={38} {...props} />
      </div>
      <span className="title text-sm leading-tight text-tinta sm:text-base">{nombre}</span>
    </div>
  );

  const nosotros = lado(site.nombre, { esNuestro: true });
  const rival = lado(partido.rival, {
    codigo: partido.esLocal ? partido.codVisitante : partido.codLocal,
  });

  return (
    <section className="card overflow-hidden">
      <div className="slash px-5 py-2.5">
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-white">
          {titulo} · {partido.competicion}
        </p>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3">
          {partido.esLocal ? nosotros : rival}
          <div className="flex flex-col items-center px-1">
            <span className="title text-3xl text-club sm:text-4xl">VS</span>
            <span
              className={`mt-1 whitespace-nowrap rounded-full px-3 py-1 font-bold ${
                partido.hora
                  ? "bg-club text-sm text-white"
                  : "bg-panel-2 text-[10px] uppercase tracking-wide text-mute"
              }`}
            >
              {partido.hora ?? "Hora sin fijar"}
            </span>
          </div>
          {partido.esLocal ? rival : nosotros}
        </div>

        <dl className="mt-6 grid gap-3 border-t border-linea pt-4 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2.5 text-mute">
            <IconoCalendario size={18} className="shrink-0 text-club" />
            <dd className="first-letter:uppercase">{hora ? dia : "Fecha por confirmar"}</dd>
          </div>
          <div className="flex items-center gap-2.5 text-mute">
            <IconoUbicacion size={18} className="shrink-0 text-club" />
            <dd>{partido.campo ?? "Campo por confirmar"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/** Resumen de una línea del último resultado. */
export function UltimoResultado({ partido }: { partido: PartidoPropio }) {
  return (
    <div className="flex items-center gap-3">
      <Marcador partido={partido} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-tinta">
          {TEXTO_RESULTADO[partido.resultado ?? "E"]} {partido.esLocal ? "en casa" : "fuera"} ·{" "}
          {partido.rival}
        </p>
        <p className="text-xs text-mute">
          {partido.fecha ? fechaLarga(partido.fecha) : ""}
        </p>
      </div>
    </div>
  );
}
