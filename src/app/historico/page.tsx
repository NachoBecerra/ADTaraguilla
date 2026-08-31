import type { Metadata } from "next";
import Link from "next/link";
import { todosLosHistoricos, titulosDelClub } from "@/lib/historico";
import Historial from "@/components/Historial";
import SeccionRedes from "@/components/SeccionRedes";
import { IconoFlecha } from "@/components/Iconos";

export const metadata: Metadata = {
  title: "Histórico",
  description:
    "Todos los títulos de la AD Taraguilla y cómo acabó cada equipo en las temporadas anteriores.",
  alternates: { canonical: "/historico" },
};

export default function Historico() {
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
          <h1 className="title mt-2 text-5xl sm:text-6xl">Histórico</h1>
          {titulos.length > 0 ? (
            <p className="mt-3 max-w-lg text-base leading-relaxed text-white/85">
              Cómo acabó cada equipo entre {desde} y {hasta}, con{" "}
              <strong className="text-white">{titulos.length} títulos</strong> por el
              camino.
            </p>
          ) : null}
        </div>
      </section>


      <section className="mx-auto max-w-5xl px-5 pt-10">
        <p className="text-sm text-mute">
          Pulsa una temporada para ver la clasificación completa. Los campeonatos
          aparecen destacados.
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
