import type { Metadata } from "next";
import { resumenEquipos, temporada, urlClubRfaf, actualizado } from "@/lib/competicion";
import { site } from "@/data/site";
import TarjetaEquipo from "@/components/TarjetaEquipo";
import SeccionRedes from "@/components/SeccionRedes";
import { fechaLarga } from "@/lib/formato";
import { IconoEnlaceExterno } from "@/components/Iconos";

export const metadata: Metadata = {
  title: "Equipos",
  description:
    "Todos los equipos de la AD Taraguilla: clasificación, calendario y resultados de cada categoría, actualizados desde la RFAF.",
};

export default function PaginaEquipos() {
  const equipos = resumenEquipos();
  const enCompeticion = equipos.filter((e) => e.competicion?.jornadas.length);
  const pendientes = equipos.filter((e) => !e.competicion?.jornadas.length);

  return (
    <>
      <section className="border-b border-linea">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <p className="eyebrow">Temporada {temporada}</p>
          <h1 className="title mt-2 text-5xl text-tinta sm:text-6xl">
            Nuestros
            <br />
            <span className="text-club">equipos</span>
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-mute">
            {equipos.length} equipos del club, del primer equipo a la cantera. Clasificación,
            calendario y resultados se actualizan solos desde la {site.federacion.nombre}.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enCompeticion.map(({ equipo, proximo, ultimo, competicion }) => (
            <TarjetaEquipo
              key={equipo.id}
              equipo={equipo}
              proximo={proximo}
              ultimo={ultimo}
              competicion={competicion}
            />
          ))}
        </div>

        {pendientes.length > 0 ? (
          <>
            <h2 className="title mt-12 text-2xl text-tinta">Pendientes de calendario</h2>
            <p className="mt-1 text-sm text-mute">
              Inscritos en competición; aparecerán aquí en cuanto la RFAF publique sus partidos.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendientes.map(({ equipo, proximo, ultimo, competicion }) => (
                <TarjetaEquipo
                  key={equipo.id}
                  equipo={equipo}
                  proximo={proximo}
                  ultimo={ultimo}
                  competicion={competicion}
                />
              ))}
            </div>
          </>
        ) : null}

        <p className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-linea bg-panel p-4 text-xs text-mute">
          <span>Datos actualizados el {fechaLarga(actualizado)} desde la {site.federacion.siglas}.</span>
          <a
            href={urlClubRfaf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-club-soft underline underline-offset-2"
          >
            Ficha oficial del club
            <IconoEnlaceExterno size={12} />
          </a>
        </p>
      </section>

      <SeccionRedes />
    </>
  );
}
