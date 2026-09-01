"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fechaPartido } from "@/lib/formato";
import { IconoFlecha, IconoCasa, IconoAutobus } from "@/components/Iconos";

/**
 * Los partidos de este equipo que se narraron en directo.
 *
 * La cronología de un partido es lo único que la RFAF no da: el acta trae el
 * resultado, pero no en qué minuto cayó cada gol ni lo que se contó desde la
 * banda. Por eso las retransmisiones se quedan guardadas toda la temporada y se
 * pueden volver a leer.
 *
 * Qué partidos tienen retransmisión se pregunta al abrir, porque la ficha del
 * equipo se genera al compilar y no puede saberlo: se retransmite un sábado y
 * la página se generó el jueves.
 */

export type PartidoNarrable = {
  fecha: string;
  rival: string;
  esLocal: boolean;
  /** El resultado oficial, si la RFAF ya lo publicó. */
  marcador: string | null;
};

export default function DirectosGuardados({
  equipo,
  partidos,
}: {
  equipo: string;
  partidos: PartidoNarrable[];
}) {
  const [fechas, setFechas] = useState<string[] | null>(null);

  useEffect(() => {
    let vigente = true;

    fetch(`/api/directo/archivo?equipo=${encodeURIComponent(equipo)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { fechas: [] }))
      .then((datos: { fechas?: string[] }) => {
        if (vigente) setFechas(datos.fechas ?? []);
      })
      .catch(() => {
        // Sin respuesta no se enseña la sección, que es un extra
        if (vigente) setFechas([]);
      });

    return () => {
      vigente = false;
    };
  }, [equipo]);

  if (fechas === null) return null; // todavía preguntando

  const narrados = partidos.filter((p) => fechas.includes(p.fecha));
  if (narrados.length === 0) return null;

  return (
    <section>
      <p className="eyebrow">Se contaron en directo</p>
      <h2 className="title mt-1 text-2xl text-tinta">Retransmisiones</h2>
      <p className="mt-1 text-sm text-mute">
        Cómo se vivió el partido desde el campo, minuto a minuto. El resultado
        que vale sigue siendo el del acta.
      </p>

      <ul className="mt-4 space-y-2">
        {narrados.map((p) => (
          <li key={p.fecha}>
            <Link
              href={`/directo/${equipo}-${p.fecha}`}
              className="card flex items-center gap-3 p-3 transition-colors hover:border-club"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-mute">
                  {p.esLocal ? (
                    <IconoCasa size={14} className="text-club-soft" />
                  ) : (
                    <IconoAutobus size={14} className="text-club-soft" />
                  )}
                  {fechaPartido(p.fecha)}
                </span>
                <span className="mt-0.5 block truncate font-bold text-tinta">{p.rival}</span>
              </span>

              {p.marcador ? (
                <span className="title shrink-0 text-lg tabular-nums text-club">
                  {p.marcador}
                </span>
              ) : null}
              <IconoFlecha size={16} className="shrink-0 text-club-soft" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
