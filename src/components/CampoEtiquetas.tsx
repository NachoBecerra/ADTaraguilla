"use client";

import { useMemo, useState } from "react";
import { IconoCerrar } from "@/components/Iconos";

/**
 * Campo de etiquetas para clasificar fotos y noticias.
 *
 * Una foto puede llevar varias a la vez —equipo, temporada, jugador— y aparece
 * bajo todas ellas. Se escriben y se añaden con Intro o coma; las ya usadas se
 * sugieren debajo para no acabar con "Infantil B" y "infantil b" conviviendo.
 */
export default function CampoEtiquetas({
  nombre,
  iniciales = [],
  sugerencias = [],
  ayuda,
}: {
  /** Nombre del campo del formulario; se envía como valores repetidos. */
  nombre: string;
  iniciales?: string[];
  sugerencias?: string[];
  ayuda?: string;
}) {
  const [etiquetas, setEtiquetas] = useState<string[]>(iniciales);
  const [texto, setTexto] = useState("");

  function añadir(valor: string) {
    const limpia = valor.trim().replace(/\s+/g, " ");
    if (!limpia) return;
    // Sin distinguir mayúsculas, para no duplicar la misma etiqueta
    if (!etiquetas.some((e) => e.toLowerCase() === limpia.toLowerCase())) {
      setEtiquetas((a) => [...a, limpia]);
    }
    setTexto("");
  }

  const disponibles = useMemo(
    () =>
      sugerencias
        .filter((s) => !etiquetas.some((e) => e.toLowerCase() === s.toLowerCase()))
        .slice(0, 12),
    [sugerencias, etiquetas],
  );

  return (
    <div>
      {/* Lo que viaja en el formulario: un valor por etiqueta */}
      {etiquetas.map((e) => (
        <input key={e} type="hidden" name={nombre} value={e} />
      ))}

      {etiquetas.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {etiquetas.map((e) => (
            <li key={e}>
              <button
                type="button"
                onClick={() => setEtiquetas((a) => a.filter((x) => x !== e))}
                className="inline-flex items-center gap-1.5 rounded-full bg-club px-3 py-1.5 text-xs font-bold text-white"
              >
                {e}
                <IconoCerrar size={12} />
                <span className="sr-only">Quitar</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        type="text"
        value={texto}
        onChange={(e) => {
          // Escribir una coma vale como Intro
          if (e.target.value.includes(",")) añadir(e.target.value.replace(",", ""));
          else setTexto(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            añadir(texto);
          }
          if (e.key === "Backspace" && texto === "") {
            setEtiquetas((a) => a.slice(0, -1));
          }
        }}
        onBlur={() => añadir(texto)}
        placeholder="Escribe y pulsa Intro"
        className="w-full rounded-lg border border-linea bg-panel px-3 py-2 text-tinta focus:border-club focus:outline-none"
      />

      {disponibles.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {disponibles.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => añadir(s)}
                className="rounded-full border border-linea bg-panel px-2.5 py-1 text-xs text-mute transition-colors hover:border-club hover:text-club"
              >
                + {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {ayuda ? <p className="mt-2 text-xs text-mute">{ayuda}</p> : null}
    </div>
  );
}
