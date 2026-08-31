"use client";

import { useState } from "react";
import type { HistoricoEquipo, CompeticionHistorica } from "@/lib/historico";
import { IconoFlecha, IconoEnlaceExterno } from "@/components/Iconos";

/** Medalla para las tres primeras plazas; el resto, sin adorno. */
function Posicion({ posicion }: { posicion: number | null }) {
  if (posicion === null) return <span className="text-mute">—</span>;

  const podio = posicion <= 3;
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
        posicion === 1
          ? "bg-club text-white"
          : podio
            ? "bg-panel-2 text-club"
            : "bg-panel-2 text-mute"
      }`}
    >
      {posicion}º
    </span>
  );
}

function Tabla({
  competicion,
  nombreRfaf,
}: {
  competicion: CompeticionHistorica;
  nombreRfaf?: string;
}) {
  const filas = competicion.clasificacion ?? [];
  if (filas.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-mute">
        La RFAF no publica clasificación de esta competición.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wider text-mute">
            <th scope="col" className="py-2 pl-4 pr-2 font-bold">#</th>
            <th scope="col" className="py-2 pr-2 font-bold">Equipo</th>
            <th scope="col" className="px-2 py-2 text-center font-bold">Pts</th>
            <th scope="col" className="px-2 py-2 text-center font-bold">PJ</th>
            <th scope="col" className="px-2 py-2 text-center font-bold">G</th>
            <th scope="col" className="px-2 py-2 text-center font-bold">E</th>
            <th scope="col" className="px-2 py-2 text-center font-bold">P</th>
            <th scope="col" className="px-2 py-2 pr-4 text-center font-bold">Goles</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const nuestro = f.equipo === nombreRfaf;
            return (
              <tr
                key={`${f.posicion}-${f.equipo}`}
                className={`border-b border-linea last:border-0 ${
                  nuestro ? "bg-club/8 font-semibold" : ""
                }`}
              >
                <td className="py-2 pl-4 pr-2 tabular-nums text-mute">{f.posicion}</td>
                <td className={`py-2 pr-2 ${nuestro ? "text-club" : "text-tinta"}`}>
                  {f.equipo}
                </td>
                <td className="px-2 py-2 text-center font-bold tabular-nums text-tinta">
                  {f.puntos}
                </td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{f.jugados}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{f.ganados}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{f.empatados}</td>
                <td className="px-2 py-2 text-center tabular-nums text-mute">{f.perdidos}</td>
                <td className="px-2 py-2 pr-4 text-center tabular-nums text-mute">
                  {f.golesFavor}:{f.golesContra}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Historial({ historico }: { historico: HistoricoEquipo }) {
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <ul className="mt-4 space-y-2">
      {historico.temporadas.map((t) =>
        t.competiciones.map((c) => {
          const clave = `${t.temporada}|${c.codGrupo}`;
          const abierto = abierta === clave;
          const hayTabla = (c.clasificacion?.length ?? 0) > 0;

          return (
            <li key={clave} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setAbierta(abierto ? null : clave)}
                aria-expanded={abierto}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <Posicion posicion={c.posicion} />

                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-tinta">{t.temporada}</span>
                  <span className="block truncate text-xs text-mute">
                    {c.nombre}
                    {c.grupo && c.grupo !== "UNICO" ? ` · ${c.grupo}` : ""}
                  </span>
                </span>

                {c.puntos !== null ? (
                  <span className="shrink-0 text-sm font-bold text-tinta">
                    {c.puntos} pts
                  </span>
                ) : null}

                <IconoFlecha
                  size={16}
                  className={`shrink-0 text-mute transition-transform ${
                    abierto ? "rotate-90" : ""
                  }`}
                />
              </button>

              {abierto ? (
                <div className="border-t border-linea">
                  <Tabla competicion={c} nombreRfaf={historico.nombreRfaf} />
                  {hayTabla && c.urlClasificacion ? (
                    <a
                      href={c.urlClasificacion}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-3 text-xs font-bold text-club-soft"
                    >
                      Ver en la RFAF
                      <IconoEnlaceExterno size={13} />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        }),
      )}
    </ul>
  );
}
