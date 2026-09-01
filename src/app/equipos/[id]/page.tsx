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
import { getGaleriaDeEquipo } from "@/lib/contenido";
import NavegacionEquipo, { type Bloque } from "@/components/NavegacionEquipo";
import Galeria from "@/components/Galeria";
import BotonAvisos from "@/components/BotonAvisos";
import { BandaDirecto } from "@/components/EnDirecto";
import DirectosGuardados, { type PartidoNarrable } from "@/components/DirectosGuardados";
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
    alternates: { canonical: `/equipos/${equipo.id}` },
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

  const fotos = getGaleriaDeEquipo(equipo.id);

  // Un partido con fecha pasada y sin resultado no es "próximo": va con los
  // disputados, marcado como sin resultado publicado.
  const disputados = partidos.filter((p) => p.jugado || sinResultado(p));
  const pendientes = partidos.filter(
    (p) => !p.jugado && (!p.fecha || p.fecha >= hoyIso()),
  );
  const faltanResultados = disputados.some(sinResultado);

  /*
   * Los partidos ya jugados, por si alguno tiene retransmisión guardada. Cuáles
   * la tienen no se puede saber aquí: esta página se genera al compilar y una
   * retransmisión ocurre después. Lo pregunta el navegador al abrirla.
   */
  const narrables: PartidoNarrable[] = disputados
    .filter((p) => p.fecha)
    .map((p) => ({
      fecha: p.fecha as string,
      rival: p.rival,
      esLocal: p.esLocal,
      marcador:
        p.golesLocal === null || p.golesVisitante === null
          ? null
          : `${p.golesLocal}-${p.golesVisitante}`,
    }))
    .reverse();

  // La barra inferior solo enseña los bloques que este equipo tiene: uno
  // recién inscrito no tiene todavía ni resultados ni fotos
  const bloques: Bloque[] = [
    ...(principal ? (["clasificacion"] as const) : []),
    ...(pendientes.length > 0 ? (["calendario"] as const) : []),
    ...(disputados.length > 0 ? (["resultados"] as const) : []),
    ...(fotos.length > 0 ? (["imagenes"] as const) : []),
  ];

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
            Ficha del equipo en {site.federacion.siglas}
            <IconoEnlaceExterno size={15} />
          </a>

          {/* Elegir equipo favorito es simplemente estar aquí y pulsar */}
          <BotonAvisos equipo={equipo.id} nombre={equipo.nombre} />
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-5 py-8 pb-28 md:pb-8">
        {/*
          Si hay partido ahora mismo, lo primero. No sustituye a nada de lo de
          abajo: el próximo partido y los resultados siguen siendo los de la
          RFAF, que es lo único oficial.
        */}
        <BandaDirecto equipo={equipo.id} />

        {proximo ? <TarjetaProximoPartido partido={proximo} titulo="Próximo partido" /> : null}

        {equipo.competiciones.length === 0 ? (
          <p className="rounded-xl border border-linea bg-panel p-4 text-sm text-mute">
            Este equipo todavía no tiene competición asignada en la RFAF para la temporada{" "}
            {temporada}. Aparecerá aquí en cuanto se publique.
          </p>
        ) : null}

        {principal ? (
          <section id="clasificacion" className="scroll-mt-20">
            <h2 className="title text-3xl text-tinta">Clasificación</h2>
            <p className="mb-4 mt-1 text-sm text-mute">
              {principal.nombre}
              {principal.grupo ? ` · ${principal.grupo}` : ""}
            </p>
            <Clasificacion competicion={principal} equipo={equipo} />
          </section>
        ) : null}

        {pendientes.length > 0 ? (
          <section id="calendario" className="scroll-mt-20">
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
        {disputados.length > 0 ? (
          <section id="resultados" className="scroll-mt-20">
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

        {narrables.length > 0 ? (
          <DirectosGuardados equipo={equipo.id} partidos={narrables} />
        ) : null}

        {fotos.length > 0 ? (
          <section id="imagenes" className="scroll-mt-20">
            <h2 className="title text-3xl text-tinta">Imágenes</h2>
            <p className="mb-4 mt-1 text-sm text-mute">
              {fotos.length} {fotos.length === 1 ? "foto" : "fotos"} del equipo.
            </p>

            {/*
              La misma galería de siempre, pero acotada a este equipo: se ven
              todas aquí, con su visor a pantalla completa, sin salir a
              /galeria. Su nombre no se ofrece como filtro porque todas las
              fotos lo llevan y no filtraría nada.
            */}
            <Galeria items={fotos} ocultar={equipo.nombre} conBuscador porTanda={12} />
          </section>
        ) : null}

      </div>

      <NavegacionEquipo bloques={bloques} />
    </>
  );
}
