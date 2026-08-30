import Link from "next/link";
import { haEmpezado, type Competicion, type Equipo, type PartidoPropio } from "@/lib/competicion";
import { Marcador } from "@/components/Partidos";
import { IconoFlecha } from "@/components/Iconos";
import { fechaLarga } from "@/lib/formato";

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

        {proximo ? (
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-panel-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-club-soft">
              Próximo
            </span>
            <span className="min-w-0 truncate text-mute">
              <span className="text-tinta">{proximo.rival}</span>
              {proximo.fecha ? ` · ${fechaLarga(proximo.fecha)}` : ""}
              {proximo.hora ? ` · ${proximo.hora}` : ""}
            </span>
          </div>
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
