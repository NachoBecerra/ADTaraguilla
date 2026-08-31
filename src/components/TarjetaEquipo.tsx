import Link from "next/link";
import {
  haEmpezado,
  type Competicion,
  type Equipo,
  type PartidoPropio,
} from "@/lib/competicion";
import { Marcador } from "@/components/Partidos";
import EscudoClub from "@/components/EscudoClub";
import {
  IconoFlecha,
  IconoCalendario,
  IconoUbicacion,
  IconoCasa,
  IconoAutobus,
} from "@/components/Iconos";
import { fechaPartido } from "@/lib/formato";

/**
 * Ficha resumida de un equipo: dónde está en la clasificación, qué hizo el
 * último fin de semana y a quién se enfrenta el siguiente.
 */
export default function TarjetaEquipo({
  equipo,
  proximo,
  ultimo,
  competicion,
}: {
  equipo: Equipo;
  proximo: PartidoPropio | null;
  ultimo: PartidoPropio | null;
  competicion: Competicion | null;
}) {
  const fila = haEmpezado(competicion)
    ? competicion?.clasificacion.find((f) => f.equipo === equipo.nombreRfaf)
    : null;

  return (
    <Link
      href={`/equipos/${equipo.id}`}
      className="group card block overflow-hidden p-5 transition-colors hover:border-club"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="title text-2xl text-tinta">{equipo.nombre}</h3>
          <p className="truncate text-xs uppercase tracking-wide text-mute">
            {competicion?.nombre ?? equipo.categoria}
          </p>
        </div>

        {fila ? (
          <div className="shrink-0 rounded-xl bg-panel-2 px-3 py-1.5 text-center">
            <p className="title text-xl leading-none text-club">{fila.posicion}º</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-mute">
              {fila.puntos} pts
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2.5 border-t border-linea pt-3.5 text-sm">
        {ultimo ? (
          <div className="flex items-center gap-2.5">
            <Marcador partido={ultimo} />
            <span className="min-w-0 truncate text-mute">
              <span className="text-tinta">{ultimo.rival}</span>
              {ultimo.esLocal ? " (casa)" : " (fuera)"}
            </span>
          </div>
        ) : null}

        {/*
          El próximo partido es lo que más se consulta, así que se enseña con
          escudo, si se juega en casa o fuera, cuándo y dónde. Antes era una
          línea de texto que se cortaba justo en la fecha.
        */}
        {proximo ? (
          proximo.descanso ? (
            <p className="text-mute">Jornada de descanso.</p>
          ) : (
            <div className="rounded-xl bg-panel-2 p-3">
              <div className="flex items-center gap-3">
                <EscudoClub
                  nombre={proximo.rival}
                  codigo={proximo.esLocal ? proximo.codVisitante : proximo.codLocal}
                  size={38}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold leading-tight text-tinta">
                    {proximo.rival}
                  </p>
                  {/* Una casa o un autobús se leen antes que la palabra */}
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-mute">
                    {proximo.esLocal ? (
                      <IconoCasa size={15} className="text-club-soft" />
                    ) : (
                      <IconoAutobus size={15} className="text-club-soft" />
                    )}
                    {proximo.esLocal ? "En casa" : "Fuera"}
                  </p>
                </div>

                {/* La hora, que es el dato que se busca, con el mayor peso */}
                <span
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-center ${
                    proximo.hora ? "bg-club text-white" : "bg-panel text-mute"
                  }`}
                >
                  <span className="title block text-base leading-none">
                    {proximo.hora ?? (
                      <>
                        <span aria-hidden>--:--</span>
                        <span className="sr-only">Hora sin fijar</span>
                      </>
                    )}
                  </span>
                </span>
              </div>

              {/*
                Cada dato en su línea, siempre. Envolviéndolos, cuando el
                nombre del campo era corto se juntaban los dos en la misma
                línea y unas tarjetas quedaban distintas de otras.
              */}
              <div className="mt-2.5 space-y-1 text-xs text-mute">
                <span className="flex items-center gap-1.5">
                  <IconoCalendario size={14} className="shrink-0 text-club-soft" />
                  {proximo.fecha ? fechaPartido(proximo.fecha) : "Fecha sin fijar"}
                </span>
                {proximo.campo ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <IconoUbicacion size={14} className="shrink-0 text-club-soft" />
                    <span className="truncate">{proximo.campo}</span>
                  </span>
                ) : null}
                {/* La tarjeta entera ya es un enlace al equipo, así que el
                    mapa no puede ir aquí dentro: va en la ficha del partido */}
              </div>
            </div>
          )
        ) : null}

        {!ultimo && !proximo ? (
          <p className="text-mute">
            {equipo.enCompeticion
              ? "La RFAF aún no ha publicado el calendario."
              : "Pendiente de entrar en competición."}
          </p>
        ) : null}
      </div>

      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-club-soft">
        Ver equipo
        <IconoFlecha size={15} />
      </span>
    </Link>
  );
}
