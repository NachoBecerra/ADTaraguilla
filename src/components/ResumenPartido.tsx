import Link from "next/link";
import EscudoClub from "@/components/EscudoClub";
import IndicadorAvisos from "@/components/IndicadorAvisos";
import { DondeSeJuega, Marcador } from "@/components/Partidos";
import { fechaPartido } from "@/lib/formato";
import type { Equipo, PartidoPropio } from "@/lib/competicion";

/**
 * Una línea de partido en la portada: de qué equipo es, contra quién, dónde y
 * cuándo.
 *
 * Sirve igual para lo que viene y para lo que ya pasó; solo cambia lo que se
 * enseña a la derecha, la hora o el marcador.
 */
export default function ResumenPartido({
  equipo,
  partido,
}: {
  equipo: Equipo;
  partido: PartidoPropio;
}) {
  return (
    <Link
      href={`/equipos/${equipo.id}`}
      className="card relative flex items-center gap-3 p-3 transition-colors hover:border-club"
    >
      <EscudoClub
        nombre={partido.rival}
        codigo={partido.esLocal ? partido.codVisitante : partido.codLocal}
        size={38}
      />

      <div className="min-w-0 flex-1">
        {/* La insignia va con nuestro equipo, no con el rival: ahí no le come
            sitio al nombre, que es lo que hay que poder leer entero */}
        <p className="flex items-center gap-2">
          <span className="title truncate text-sm leading-tight text-tinta">{equipo.nombre}</span>
          <DondeSeJuega esLocal={partido.esLocal} />
        </p>
        <p className="mt-0.5 truncate text-xs text-mute">{partido.rival}</p>
      </div>

      <div className="shrink-0 text-right">
        <Marcador partido={partido} />
        {partido.fecha ? (
          <p className="mt-1 text-[11px] text-mute">{fechaPartido(partido.fecha)}</p>
        ) : null}
      </div>

      {/* Al final: se ve en la esquina igual, pero se lee después del equipo */}
      <IndicadorAvisos equipo={equipo.id} posicion="-right-2 -top-2" />
    </Link>
  );
}
