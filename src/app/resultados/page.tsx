import type { Metadata } from "next";
import Link from "next/link";
import { resumenEquipos, temporada } from "@/lib/competicion";
import { site } from "@/data/site";
import TarjetaResultado from "@/components/TarjetaResultado";
import Compartir from "@/components/Compartir";
import { fechaLarga } from "@/lib/formato";
import { IconoFlecha } from "@/components/Iconos";

/**
 * Cómo quedaron todos los equipos en su último partido.
 *
 * Existe para poder **compartirla**. La portada ya los enseña, pero un enlace
 * con `#resultados` le enseña a Facebook la tarjeta de la portada: mismo
 * título, misma foto y la misma descripción de siempre. Con página propia, lo
 * que se ve al compartir habla de los resultados, y de paso Google la indexa
 * aparte.
 */

/** Los resultados de la última jornada, en una frase. */
function resumenCorto(): string {
  const conResultado = resumenEquipos().filter((e) => e.ultimo?.jugado);
  if (conResultado.length === 0) {
    return `Resultados de los equipos de la ${site.nombre}, con los datos oficiales de la competición.`;
  }

  /* Con el rival delante o detrás según dónde se jugara: «2-0 al Chiclana» y
     «0-2 en Tarifa» dicen lo mismo que la tarjeta, sin invertir el marcador */
  const primeros = conResultado
    .slice(0, 3)
    .map(
      ({ equipo, ultimo }) =>
        `${equipo.nombre} ${ultimo!.golesPropios}-${ultimo!.golesRival} ${
          ultimo!.esLocal ? "al" : "en"
        } ${ultimo!.rival}`,
    )
    .join(" · ");

  return `Último partido de cada equipo de la ${site.nombre}: ${primeros}${
    conResultado.length > 3 ? " y más" : ""
  }.`;
}

export function generateMetadata(): Metadata {
  const description = resumenCorto();

  return {
    title: "Resultados",
    description,
    alternates: { canonical: "/resultados" },
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: site.nombre,
      url: "/resultados",
      title: `Resultados · ${site.nombre}`,
      description,
    },
    twitter: { card: "summary_large_image", title: `Resultados · ${site.nombre}`, description },
  };
}

export default function PaginaResultados() {
  const equipos = resumenEquipos().filter((e) => e.ultimo);

  // Lo más reciente primero; sin fecha, al final
  const orden = (f?: string | null) => f ?? "0000-00-00";
  const resultados = [...equipos].sort((a, b) =>
    orden(b.ultimo?.fecha).localeCompare(orden(a.ultimo?.fecha)),
  );

  const ultimaFecha = resultados[0]?.ultimo?.fecha ?? null;

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
      <h1 className="title mt-2 text-5xl text-tinta sm:text-6xl">Resultados</h1>
      <p className="mt-3 text-base leading-relaxed text-mute">
        El último partido de cada equipo del club
        {ultimaFecha ? `, hasta el ${fechaLarga(ultimaFecha)}` : ""}.
      </p>

      {resultados.length > 0 ? (
        <>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resultados.map(({ equipo, ultimo }) => (
              <li key={equipo.id}>
                <TarjetaResultado equipo={equipo} partido={ultimo!} conEquipo />
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Compartir
              titulo={`Resultados de la ${site.nombre}`}
              resumen={resumenCorto()}
              url={`${site.url}/resultados`}
            />
          </div>
        </>
      ) : (
        <p className="card mt-8 p-5 text-sm leading-relaxed text-mute">
          Todavía no hay resultados esta temporada. Aparecerán en cuanto se juegue la primera
          jornada.
        </p>
      )}
    </section>
  );
}
