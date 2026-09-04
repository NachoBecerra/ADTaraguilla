import { sinResultado, mapaDelCampo, type PartidoPropio } from "@/lib/competicion";
import { fechaLarga, diaYHora } from "@/lib/formato";
import { site } from "@/data/site";
import EscudoClub from "@/components/EscudoClub";
import { IconoCalendario, IconoUbicacion, IconoEnlaceExterno } from "@/components/Iconos";
import { AvisoDelPartido, CentroDelPartido } from "@/components/EnDirecto";

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
  const fecha = (
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
  );

  // Jornada de descanso: no hay rival, campo ni marcador que enseñar
  if (partido.descanso) {
    return (
      <li className="flex items-center gap-3 border-b border-linea py-3 last:border-0">
        {fecha}
        <p className="flex-1 text-sm italic text-mute">Jornada de descanso</p>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-b border-linea py-3 last:border-0">
      {fecha}

      <EscudoClub
        nombre={partido.rival}
        codigo={partido.esLocal ? partido.codVisitante : partido.codLocal}
        size={26}
      />

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold leading-tight text-tinta">
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
  equipo,
}: {
  partido: PartidoPropio;
  titulo: string;
  /**
   * Identificador del equipo, para saber si tiene retransmisión abierta.
   *
   * La tarjeta la pinta el servidor y el directo lo sabe el navegador, así que
   * los dos trozos que cambian —el centro y el aviso de abajo— son componentes
   * de cliente metidos aquí dentro. Comparten el mismo sondeo que el resto de
   * la página: no es una petición más.
   */
  equipo: string;
}) {
  const { dia, hora } = partido.fecha
    ? diaYHora(`${partido.fecha}T${partido.hora ?? "12:00"}:00`)
    : { dia: "Fecha por confirmar", hora: "" };

  const lado = (nombre: string, props: { esNuestro?: boolean; codigo?: string | null }) => (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <div className="grid grid-cols-1 h-14 w-14 place-items-center rounded-full bg-panel-2 sm:h-16 sm:w-16">
        <EscudoClub nombre={nombre} size={38} {...props} />
      </div>
      <span className="title text-sm leading-tight text-tinta sm:text-base">{nombre}</span>
    </div>
  );

  const mapa = mapaDelCampo(partido.codCampo);

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
          <div className="flex min-w-21 flex-col items-center px-1">
            {/* Sin retransmisión, el «VS» y la hora de siempre; con ella, el
                marcador y el minuto. El «VS» desaparece en cuanto hay
                resultado: delante de un marcador no aporta nada. */}
            <CentroDelPartido
              equipo={equipo}
              fecha={partido.fecha ?? null}
              hora={partido.hora ?? null}
            />
          </div>
          {partido.esLocal ? rival : nosotros}
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-linea pt-4 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2.5 text-mute">
            <IconoCalendario size={18} className="shrink-0 text-club" />
            <dd className="first-letter:uppercase">{hora ? dia : "Fecha por confirmar"}</dd>
          </div>
          <div className="flex items-center gap-2.5 text-mute">
            <IconoUbicacion size={18} className="shrink-0 text-club" />
            {/*
              Si sabemos dónde está el campo, se abre en el mapa. Es lo
              primero que hace falta cuando se juega fuera y no se conoce el
              pueblo.
            */}
            {mapa ? (
              <dd>
                <a
                  href={mapa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-club-soft underline underline-offset-2"
                >
                  {partido.campo}
                  <IconoEnlaceExterno size={13} className="shrink-0" />
                </a>
              </dd>
            ) : (
              <dd>{partido.campo ?? "Campo por confirmar"}</dd>
            )}
          </div>
        </dl>

        {/* Entrar al directo, o decir en qué punto está el partido cuando no
            hay retransmisión y la hora del saque ya pasó */}
        <AvisoDelPartido
          equipo={equipo}
          fecha={partido.fecha ?? null}
          hora={partido.hora ?? null}
        />

        {/*
          La RFAF publica la ficha del partido unos días antes; hasta entonces
          pone "Previo no disponible" y no hay enlace que dar.
        */}
        {partido.urlActa ? (
          <a
            href={partido.urlActa}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-club-soft"
          >
            Ficha del partido en la RFAF
            <IconoEnlaceExterno size={14} className="shrink-0" />
          </a>
        ) : null}
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
