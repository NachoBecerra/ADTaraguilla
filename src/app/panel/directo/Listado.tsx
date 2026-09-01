"use client";

import { useState } from "react";
import { empezarRetransmision } from "./acciones";
import { fechaPartido } from "@/lib/formato";
import { IconoFlecha } from "@/components/Iconos";

/**
 * Los partidos de los próximos días, para abrir la retransmisión de uno.
 *
 * El enlace se compone con el origen del navegador y no en el servidor: así lo
 * que se copia funciona igual probando en local que en producción.
 */

export type Fila = {
  id: string;
  nombreEquipo: string;
  local: string;
  visitante: string;
  fecha: string | null;
  hora: string | null;
  campo: string | null;
  abierta: boolean;
};

export default function Listado({ partidos }: { partidos: Fila[] }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState<string | null>(null);

  async function abrir(id: string) {
    setTrabajando(id);
    setErrores((e) => ({ ...e, [id]: "" }));

    const r = await empezarRetransmision(id);
    if (r.ok && r.ruta) {
      setEnlaces((e) => ({ ...e, [id]: `${window.location.origin}${r.ruta}` }));
    } else {
      setErrores((e) => ({ ...e, [id]: r.mensaje }));
    }
    setTrabajando(null);
  }

  async function copiar(id: string) {
    try {
      await navigator.clipboard.writeText(enlaces[id]);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      // Sin permiso de portapapeles queda el campo de texto para copiar a mano
    }
  }

  if (partidos.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-linea bg-panel p-4 text-sm text-mute">
        No hay partidos en los próximos días. Cuando la RFAF publique el
        calendario aparecerán aquí.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {partidos.map((p) => (
        <li key={p.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-club-soft">
                {p.nombreEquipo}
              </p>
              <p className="title mt-0.5 truncate text-lg text-tinta">
                {p.local} · {p.visitante}
              </p>
              <p className="mt-1 text-xs text-mute">
                {p.fecha ? fechaPartido(p.fecha) : "Sin fecha"}
                {p.hora ? ` · ${p.hora}` : " · sin hora"}
                {p.campo ? ` · ${p.campo}` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() => abrir(p.id)}
              disabled={trabajando === p.id}
              className="btn btn-primary shrink-0 px-4 py-2 text-sm"
            >
              {trabajando === p.id
                ? "Abriendo…"
                : p.abierta || enlaces[p.id]
                  ? "Ver enlace"
                  : "Retransmitir"}
            </button>
          </div>

          {errores[p.id] ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-club">
              {errores[p.id]}
            </p>
          ) : null}

          {enlaces[p.id] ? (
            <div className="mt-3 rounded-xl bg-panel-2 p-3">
              <p className="text-xs leading-relaxed text-mute">
                Manda este enlace a quien vaya al campo. Funciona desde ya, vale
                solo para este partido y deja de servir unas horas después de
                acabar.
              </p>
              <input
                readOnly
                value={enlaces[p.id]}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-2 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-xs text-tinta"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => copiar(p.id)}
                  className="btn btn-primary px-4 py-2 text-sm"
                >
                  {copiado === p.id ? "Copiado" : "Copiar enlace"}
                </button>
                <a
                  href={enlaces[p.id]}
                  className="btn btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm"
                >
                  Abrir yo
                  <IconoFlecha size={15} />
                </a>
              </div>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
