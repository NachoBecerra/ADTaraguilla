import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEquipo,
  getEquipos,
  partidosDe,
  proximoPartido,
  ultimoResultado,
  competicionPrincipal,
  haEmpezado,
  sinResultado,
  hoyIso,
  temporada,
} from "@/lib/competicion";
import { site } from "@/data/site";
import Clasificacion from "@/components/Clasificacion";
import { FilaPartido, TarjetaProximoPartido } from "@/components/Partidos";
import { fechaLarga } from "@/lib/formato";
import { IconoFlecha, IconoEnlaceExterno } from "@/components/Iconos";

export function generateStaticParams() {
  return getEquipos().map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/equipos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const equipo = getEquipo(id);
  if (!equipo) return { title: "Equipo no encontrado" };

  return {
    title: equipo.nombre,
    description: `Clasificación, calendario y resultados del ${equipo.nombre} de la ${site.nombre} en ${equipo.categoria}.`,
  };
}

export default async function PaginaEquipo({ params }: PageProps<"/equipos/[id]">) {
  const { id } = await params;
  const equipo = getEquipo(id);
  if (!equipo) notFound();

  const partidos = partidosDe(equipo);
  const proximo = proximoPartido(equipo);
  const ultimo = ultimoResultado(equipo);
  const principal = competicionPrincipal(equipo);
  const fila = haEmpezado(principal)
    ? principal?.clasificacion.find((f) => f.equipo === equipo.nombreRfaf)
    : null;

  // Un partido con fecha pasada y sin resultado no es "próximo": va con los
  // disputados, marcado como sin resultado publicado.
  const disputados = partidos.filter((p) => p.jugado || sinResultado(p));
  const pendientes = partidos.filter(
    (p) => !p.jugado && (!p.fecha || p.fecha >= hoyIso()),
  );
  const faltanResultados = disputados.some(sinResultado);

  return (
    <>
      <section className="border-b border-linea">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
          <Link
            href="/equipos"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-mute transition-colors hover:text-club"
          >
            <IconoFlecha size={16} className="rotate-180" />
            Todos los equipos
          </Link>

          <p className="eyebrow mt-5">
            {equipo.categoria} · Temporada {temporada}
          </p>
          <h1 className="title mt-2 text-5xl text-tinta sm:text-6xl">{equipo.nombre}</h1>

          {fila ? (
            <dl className="mt-6 flex flex-wrap gap-2.5">
              {[
                { t: "Posición", v: `${fila.posicion}º` },
                { t: "Puntos", v: fila.puntos },
                { t: "Jugados", v: fila.jugados },
                { t: "G-E-P", v: `${fila.ganados}-${fila.empatados}-${fila.perdidos}` },
                { t: "Goles", v: `${fila.golesFavor}:${fila.golesContra}` },
              ].map((d) => (
                <div key={d.t} className="rounded-xl border border-linea bg-panel px-4 py-2.5">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-mute">
                    {d.t}
                  </dt>
                  <dd className="title text-xl text-tinta">{d.v}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <a
            href={equipo.urlRfaf}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost mt-6"
          >
            Ficha, plantilla y actas en {site.federacion.siglas}
            <IconoEnlaceExterno size={15} />
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-5 py-8">
        {proximo ? <TarjetaProximoPartido partido={proximo} titulo="Próximo partido" /> : null}

        {equipo.competiciones.length === 0 ? (
          <p className="rounded-xl border border-linea bg-panel p-4 text-sm text-mute">
            Este equipo todavía no tiene competición asignada en la RFAF para la temporada{" "}
            {temporada}. Aparecerá aquí en cuanto se publique.
          </p>
        ) : null}

        {principal ? (
          <section>
            <h2 className="title text-3xl text-tinta">Clasificación</h2>
            <p className="mb-4 mt-1 text-sm text-mute">
              {principal.nombre}
              {principal.grupo ? ` · ${principal.grupo}` : ""}
            </p>
            <Clasificacion competicion={principal} equipo={equipo} />
          </section>
        ) : null}

        {disputados.length > 0 ? (
          <section>
            <h2 className="title text-3xl text-tinta">Resultados</h2>
            <ul className="mt-4 rounded-xl border border-linea bg-panel px-4">
              {[...disputados].reverse().map((p, i) => (
                <FilaPartido
                  key={`${p.fecha}-${p.rival}-${i}`}
                  partido={p}
                  mostrarCompeticion={equipo.competiciones.length > 1}
                />
              ))}
            </ul>
            {faltanResultados ? (
              <p className="mt-2 text-xs text-mute">
                «s/r»: la RFAF no publica el resultado de ese partido. Se puede
                consultar en su ficha oficial.
              </p>
            ) : ultimo ? (
              <p className="mt-2 text-xs text-mute">
                Último partido disputado: {ultimo.fecha ? fechaLarga(ultimo.fecha) : "—"}
              </p>
            ) : null}
          </section>
        ) : null}

        {pendientes.length > 0 ? (
          <section>
            <h2 className="title text-3xl text-tinta">Calendario</h2>
            <ul className="mt-4 rounded-xl border border-linea bg-panel px-4">
              {pendientes.map((p, i) => (
                <FilaPartido
                  key={`${p.fecha}-${p.rival}-${i}`}
                  partido={p}
                  mostrarCompeticion={equipo.competiciones.length > 1}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
