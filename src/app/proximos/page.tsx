import type { Metadata } from "next";
import Link from "next/link";
import { resumenEquipos, temporada, cuandoSeJuega } from "@/lib/competicion";
import { site } from "@/data/site";
import ResumenPartido from "@/components/ResumenPartido";
import Compartir from "@/components/Compartir";
import { fechaLarga } from "@/lib/formato";
import { IconoFlecha } from "@/components/Iconos";

/**
 * Cuándo juega cada equipo del club, en una sola pantalla.
 *
 * Lo mismo que la portada enseña arriba, pero con dirección propia: así se
 * puede mandar al grupo de WhatsApp o publicar en Facebook y que la tarjeta
 * hable de los horarios de la jornada, no de la web en general.
 */

/** Los próximos partidos, en una frase, para la tarjeta al compartir. */
function resumenCorto(partidos: ReturnType<typeof porJugar>): string {
  if (partidos.length === 0) {
    return `Horarios de los partidos de la ${site.nombre}, con los datos oficiales de la competición.`;
  }

  const primeros = partidos
    .slice(0, 3)
    .map(({ equipo, proximo }) => `${equipo.nombre}${proximo!.hora ? ` ${proximo!.hora}` : ""}`)
    .join(" · ");

  return `Cuándo juega cada equipo de la ${site.nombre}: ${primeros}${
    partidos.length > 3 ? " y más" : ""
  }.`;
}

/** Los equipos con partido por delante, por día y hora. */
function porJugar() {
  return resumenEquipos()
    .filter((e) => e.proximo && !e.proximo.descanso)
    .sort((a, b) => cuandoSeJuega(a.proximo!).localeCompare(cuandoSeJuega(b.proximo!)));
}

export function generateMetadata(): Metadata {
  const description = resumenCorto(porJugar());

  return {
    title: "Próximos partidos",
    description,
    alternates: { canonical: "/proximos" },
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: site.nombre,
      url: "/proximos",
      title: `Próximos partidos · ${site.nombre}`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `Próximos partidos · ${site.nombre}`,
      description,
    },
  };
}

export default function PaginaProximos() {
  const partidos = porJugar();
  const primera = partidos[0]?.proximo?.fecha ?? null;

  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-mute transition-colors hover:text-club"
      >
        <IconoFlecha size={16} className="rotate-180" />
        Inicio
      </Link>

      <p className="eyebrow mt-5">Temporada {temporada}</p>
      <h1 className="title mt-2 text-5xl text-tinta sm:text-6xl">Próximos partidos</h1>
      <p className="mt-3 text-base leading-relaxed text-mute">
        Cuándo y contra quién juega cada equipo
        {primera ? `, a partir del ${fechaLarga(primera)}` : ""}. Los partidos sin hora todavía no
        la tienen puesta.
      </p>

      {partidos.length > 0 ? (
        <>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partidos.map(({ equipo, proximo }) => (
              <li key={equipo.id}>
                <ResumenPartido equipo={equipo} partido={proximo!} />
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Compartir
              titulo={`Próximos partidos de la ${site.nombre}`}
              resumen={resumenCorto(partidos)}
              url={`${site.url}/proximos`}
            />
          </div>
        </>
      ) : (
        <p className="card mt-8 p-5 text-sm leading-relaxed text-mute">
          No hay partidos anunciados ahora mismo. Aparecerán aquí en cuanto se publique la
          siguiente jornada.
        </p>
      )}
    </section>
  );
}
