import type { Metadata } from "next";
import { getRivales, getEquipos, temporada, actualizado } from "@/lib/competicion";
import { site } from "@/data/site";
import DirectorioClubes from "@/components/DirectorioClubes";
import { fechaLarga } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Clubes de la competición",
  description:
    "Directorio de todos los clubes contra los que compiten los equipos de la AD Taraguilla, con enlace directo a su ficha en la Real Federación Andaluza de Fútbol.",
};

export default function PaginaClubes() {
  const clubes = getRivales();

  // Las competiciones en las que participa el club, para filtrar el directorio
  const competiciones = [
    ...new Set(getEquipos().flatMap((e) => e.competiciones.map((c) => c.nombre))),
  ].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <>
      <section className="border-b border-linea">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <p className="eyebrow">Temporada {temporada}</p>
          <h1 className="title mt-2 text-5xl text-tinta sm:text-6xl">
            Clubes de la
            <br />
            <span className="text-club">competición</span>
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-mute">
            Los {clubes.length} clubes contra los que juegan nuestros equipos esta temporada.
            Cada ficha enlaza con su página en la {site.federacion.nombre}, donde se consultan
            plantilla, calendario, resultados y actas oficiales.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-8">
        <DirectorioClubes clubes={clubes} competiciones={competiciones} />

        <p className="mt-10 rounded-xl border border-linea bg-panel p-4 text-xs leading-relaxed text-mute">
          Esta lista se genera automáticamente a partir de los grupos en los que compiten
          nuestros equipos; se actualizó el {fechaLarga(actualizado)}. Los datos de competición
          son propiedad de la {site.federacion.nombre}: esta página solo enlaza a la fuente
          oficial y, ante cualquier discrepancia, prevalece lo publicado en{" "}
          <a
            href={site.federacion.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-club-soft underline underline-offset-2"
          >
            {site.federacion.url.replace("https://", "")}
          </a>
          .
        </p>
      </section>
    </>
  );
}
