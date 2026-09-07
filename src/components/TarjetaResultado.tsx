import Link from "next/link";
import { sinResultado, type Equipo, type PartidoPropio } from "@/lib/competicion";
import { site } from "@/data/site";
import EscudoClub from "@/components/EscudoClub";
import EnlaceRetransmision from "@/components/EnlaceRetransmision";
import IndicadorAvisos from "@/components/IndicadorAvisos";
import { fechaPartido } from "@/lib/formato";
import { IconoEnlaceExterno } from "@/components/Iconos";

/**
 * Un resultado, con los dos equipos en el orden en que se juega el partido:
 * local arriba, visitante abajo.
 *
 * Antes se enseñaba "nuestros goles – los suyos" junto al nombre del rival, y
 * eso miente en cuanto se juega fuera: un 2-0 nuestro en Tarifa se leía como si
 * hubiera ganado el que aparecía primero. Aquí cada marcador va pegado al
 * escudo y al nombre de quien lo hizo, que es como se lee un resultado.
 */

/** Botón pequeño del pie de la tarjeta. */
const BOTON =
  "inline-flex items-center gap-1.5 rounded-lg border border-linea bg-panel-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-mute transition-colors hover:border-club hover:text-club";

function Lado({
  nombre,
  codigo,
  goles,
  esNuestro,
  gana,
}: {
  nombre: string;
  codigo: string | null;
  goles: number | null;
  esNuestro: boolean;
  gana: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <EscudoClub nombre={nombre} codigo={codigo} esNuestro={esNuestro} size={26} />

      <p
        className={`min-w-0 flex-1 truncate text-sm leading-tight ${
          esNuestro ? "font-bold text-tinta" : "text-tinta"
        }`}
      >
        {nombre}
      </p>

      <span
        className={`title w-6 shrink-0 text-right text-xl tabular-nums ${
          goles === null ? "text-mute" : gana ? "text-club" : "text-tinta"
        }`}
      >
        {goles ?? "–"}
      </span>
    </div>
  );
}

export default function TarjetaResultado({
  partido,
  equipo,
  conEquipo = false,
}: {
  partido: PartidoPropio;
  equipo: Equipo;
  /** Enseña de qué equipo nuestro es el partido, para las listas mezcladas. */
  conEquipo?: boolean;
}) {
  const { golesLocal, golesVisitante } = partido;
  const pendiente = golesLocal === null || golesVisitante === null;

  // Nuestro escudo local se ve mejor que el que sirve la RFAF, y el nombre
  // corto del club se lee antes que el que tiene registrado la federación
  const nuestro = {
    nombre: site.nombre,
    codigo: null,
    esNuestro: true,
  };
  const rival = {
    nombre: partido.rival,
    codigo: partido.esLocal ? partido.codVisitante : partido.codLocal,
    esNuestro: false,
  };

  const local = partido.esLocal ? nuestro : rival;
  const visitante = partido.esLocal ? rival : nuestro;

  return (
    <article className="card relative p-3.5">
      {/* ------------------------------------------ competición y jornada */}
      <div className="flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-wide">
        <p className="min-w-0 truncate text-club-soft">
          {conEquipo ? (
            <Link href={`/equipos/${equipo.id}`} className="hover:underline">
              {equipo.nombre}
            </Link>
          ) : null}
          {conEquipo ? " · " : ""}
          <span className={conEquipo ? "text-mute" : undefined}>{partido.competicion}</span>
        </p>
        <p className="ml-auto shrink-0 text-mute">
          {partido.jornada.replace(/^Jornada\s*/i, "J")}
        </p>
      </div>

      {/* ------------------------------------------------- los dos equipos */}
      <div className="mt-2.5 space-y-1.5">
        <Lado {...local} goles={golesLocal} gana={!pendiente && golesLocal > golesVisitante} />
        <Lado
          {...visitante}
          goles={golesVisitante}
          gana={!pendiente && golesVisitante > golesLocal}
        />
      </div>

      {/* ------------------------------- acta, retransmisión y cuándo se jugó */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-linea pt-2.5">
        {partido.urlActa ? (
          <a
            href={partido.urlActa}
            target="_blank"
            rel="noopener noreferrer"
            className={BOTON}
            title={`Acta del partido en la ${site.federacion.siglas}`}
          >
            Acta
            <IconoEnlaceExterno size={12} className="shrink-0" />
          </a>
        ) : null}

        <EnlaceRetransmision equipo={equipo.id} fecha={partido.fecha} className={BOTON} />

        {/* La RFAF no publica el resultado de algunos partidos, y decirlo es
            más honrado que dejar dos rayas sin explicación */}
        {sinResultado(partido) ? (
          <span
            className="text-[11px] font-bold uppercase tracking-wide text-mute"
            title={`La ${site.federacion.siglas} no publica el resultado de este partido`}
          >
            Sin resultado
          </span>
        ) : null}

        <span className="ml-auto shrink-0 text-xs text-mute">
          {partido.fecha ? fechaPartido(partido.fecha) : "Sin fecha"}
        </span>
      </div>

      {/* Al final: se ve en la esquina igual, pero se lee después del partido */}
      {conEquipo ? <IndicadorAvisos equipo={equipo.id} posicion="-right-2 -top-2" /> : null}
    </article>
  );
}
