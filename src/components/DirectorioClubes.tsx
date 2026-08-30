"use client";

import { useMemo, useState } from "react";
import type { ClubRival } from "@/lib/competicion";
import { site } from "@/data/site";
import EscudoImg from "@/components/EscudoImg";
import { IconoBuscar, IconoEnlaceExterno } from "@/components/Iconos";

/** Quita acentos para que "cadiz" encuentre "Cádiz". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export default function DirectorioClubes({
  clubes,
  competiciones,
}: {
  clubes: ClubRival[];
  competiciones: string[];
}) {
  const [consulta, setConsulta] = useState("");
  const [competicion, setCompeticion] = useState("todas");

  const resultados = useMemo(() => {
    const q = normalizar(consulta.trim());
    return clubes.filter(
      (c) =>
        (competicion === "todas" || c.competiciones.includes(competicion)) &&
        (q === "" || normalizar(c.nombre).includes(q)),
    );
  }, [clubes, consulta, competicion]);

  return (
    <>
      <div className="relative">
        <IconoBuscar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar club…"
          aria-label="Buscar club"
          className="w-full rounded-full border border-linea bg-panel py-3.5 pl-12 pr-4 text-base text-tinta placeholder:text-mute focus:border-club focus:outline-none"
        />
      </div>

      {competiciones.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {["todas", ...competiciones].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCompeticion(c)}
              aria-pressed={competicion === c}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                competicion === c
                  ? "bg-club text-white"
                  : "border border-linea bg-panel text-mute hover:border-club hover:text-club"
              }`}
            >
              {c === "todas" ? "Todas las competiciones" : c}
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-sm text-mute">
        {resultados.length} {resultados.length === 1 ? "club" : "clubes"}
      </p>

      <ul className="mt-4 space-y-3">
        {resultados.map((club) => (
          <li key={club.nombre} className="card p-4">
            <div className="flex items-center gap-3.5">
              <EscudoImg src={club.escudo} size={44} />

              <div className="min-w-0 flex-1">
                <h3 className="title text-lg leading-tight text-tinta">{club.nombre}</h3>
                <p className="truncate text-sm text-mute">{club.competiciones.join(" · ")}</p>
              </div>
            </div>

            {club.urlRfaf ? (
              <a
                href={club.urlRfaf}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary mt-3.5 px-4 py-2 text-[13px]"
              >
                Ficha en {site.federacion.siglas}
                <IconoEnlaceExterno size={14} />
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      {resultados.length === 0 ? (
        <p className="mt-10 text-center text-mute">Ningún club coincide con la búsqueda.</p>
      ) : null}
    </>
  );
}
