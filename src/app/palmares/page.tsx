import type { Metadata } from "next";
import Link from "next/link";
import { todosLosHistoricos, titulosDelClub } from "@/lib/historico";
import Historial from "@/components/Historial";
import SeccionRedes from "@/components/SeccionRedes";
import { IconoFlecha } from "@/components/Iconos";

export const metadata: Metadata = {
  title: "Palmarés",
  description:
    "Todos los títulos de la AD Taraguilla y cómo acabó cada equipo en las temporadas anteriores.",
};

export default function Palmares() {
  const historicos = todosLosHistoricos();
  const titulos = titulosDelClub();

  const temporadas = [...new Set(historicos.flatMap((h) => h.temporadas.map((t) => t.temporada)))]
    .sort();
  const desde = temporadas[0]?.split("-")[0];
  const hasta = temporadas.at(-1)?.split("-")[1];

  return (
    <>
      <section className="relative overflow-hidden bg-club text-white">
        <div
          aria-hidden
          className="absolute inset-y-0 -right-40 w-2/3 skew-x-[-14deg] bg-club-dark/70"
        />
        <div className="relative mx-auto max-w-5xl px-5 py-10 sm:py-14">
          <p className="eyebrow eyebrow-claro">Historia del club</p>
          <h1 className="title mt-2 text-5xl sm:text-6xl">Palmarés</h1>
          {titulos.length > 0 ? (
            <p className="mt-3 max-w-lg text-base leading-relaxed text-white/85">
              <strong className="text-white">{titulos.length} títulos</strong> entre{" "}
              {desde} y {hasta}, sumando todas las categorías del club.
            </p>
          ) : null}
        </div>
      </section>

      {titulos.length > 0 ? (
        <section className="mx-auto max-w-5xl px-5 pt-10">
          <h2 className="title text-3xl text-tinta">Los títulos</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {titulos.map((t, i) => (
              <li key={`${t.equipoId}-${t.temporada}-${i}`}>
                <Link
                  href={`/equipos/${t.equipoId}`}
                  className="card flex items-center gap-3.5 p-4 transition-colors hover:border-club"
                >
                  <span className="grid grid-cols-1 h-11 w-11 shrink-0 place-items-center rounded-full bg-club text-sm font-bold text-white">
                    1º
                  </span>
                  {/* flex-1 además de min-w-0: sin él la celda no encoge y el
                      texto largo desborda la tarjeta en el móvil */}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-tinta">{t.equipo}</span>
                    <span className="block truncate text-xs text-mute">
                      {t.temporada} · {t.competicion}
                      {t.puntos !== null ? ` · ${t.puntos} pts` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-5 pt-14">
        <h2 className="title text-3xl text-tinta">Temporada a temporada</h2>
        <p className="mt-1 text-sm text-mute">
          Cómo acabó cada equipo. Pulsa una temporada para ver la clasificación completa.
        </p>

        <div className="mt-6 space-y-10">
          {historicos.map((h) => (
            <div key={h.id}>
              <div className="flex items-end justify-between gap-4">
                <h3 className="title text-2xl text-tinta">{h.nombre}</h3>
                <Link
                  href={`/equipos/${h.id}`}
                  className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-sm font-bold text-club-soft"
                >
                  Ver equipo
                  <IconoFlecha size={15} />
                </Link>
              </div>
              <Historial historico={h} />
            </div>
          ))}
        </div>
      </section>

      <div className="pt-14">
        <SeccionRedes />
      </div>
    </>
  );
}
