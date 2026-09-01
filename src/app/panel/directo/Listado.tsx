"use client";

import { useState } from "react";
import { empezarRetransmision, reiniciarRetransmision } from "./acciones";
import type { EstadoPanel } from "@/lib/directo/panel";
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
  estado: EstadoPanel;
};

/** Cómo se ve de un vistazo en qué punto está cada partido. */
const CHIP: Record<EstadoPanel, { texto: string; clase: string } | null> = {
  "sin-abrir": null,
  abierta: { texto: "Preparada", clase: "bg-panel-2 text-mute" },
  "en-directo": { texto: "En directo", clase: "bg-club text-white" },
  terminada: { texto: "Terminada", clase: "bg-panel-2 text-mute" },
  // No se llega a pintar: el panel no las lista
  caducada: null,
};

/**
 * Lo que lee quien recibe el mensaje.
 *
 * Un enlace pelado en WhatsApp no dice de qué partido es ni qué hay que hacer
 * con él, y quien lo recibe puede tener tres de partidos distintos. Así que va
 * con el equipo, el rival y cuándo se juega, y con la frase que quita el miedo:
 * no hay que instalar nada ni saber ninguna contraseña.
 */
function mensajeDe(p: Fila, url: string): string {
  const cuando = [p.fecha ? fechaPartido(p.fecha) : null, p.hora]
    .filter(Boolean)
    .join(", ");

  return [
    `Panel de retransmisión · ${p.nombreEquipo}`,
    `${p.local} · ${p.visitante}${cuando ? ` — ${cuando}` : ""}`,
    "",
    "Abre este enlace en el móvil desde el campo para ir apuntando el partido. No hace falta instalar nada ni saber ninguna contraseña.",
    "",
    url,
  ].join("\n");
}

export default function Listado({ partidos }: { partidos: Fila[] }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState<string | null>(null);
  /* Reiniciar borra la cronología: no puede pasar de un solo toque */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  /* La dirección solo se enseña si el portapapeles falla: si no, estorba */
  const [aMano, setAMano] = useState<string | null>(null);

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

  async function reiniciar(id: string) {
    setTrabajando(id);
    setErrores((e) => ({ ...e, [id]: "" }));

    const r = await reiniciarRetransmision(id);
    if (r.ok && r.ruta) {
      setEnlaces((e) => ({ ...e, [id]: `${window.location.origin}${r.ruta}` }));
    } else {
      setErrores((e) => ({ ...e, [id]: r.mensaje }));
    }
    setConfirmando(null);
    setTrabajando(null);
  }

  async function copiar(id: string) {
    try {
      await navigator.clipboard.writeText(enlaces[id]);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      /*
       * Hay navegadores que no dejan copiar sin más (o sin HTTPS). Solo
       * entonces aparece la dirección, para poder seleccionarla a mano: tenerla
       * siempre a la vista no le dice nada a quien no es informático, y encima
       * invita a tocarla.
       */
      setAMano(id);
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
              {CHIP[p.estado] ? (
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CHIP[p.estado]!.clase}`}
                >
                  {CHIP[p.estado]!.texto}
                </span>
              ) : null}
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
                : p.estado !== "sin-abrir" || enlaces[p.id]
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

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copiar(p.id)}
                  className="btn btn-primary px-4 py-2 text-sm"
                >
                  {copiado === p.id ? "Copiado" : "Copiar enlace"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(mensajeDe(p, enlaces[p.id]))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary px-4 py-2 text-sm"
                >
                  Enviar por WhatsApp
                </a>
                <a
                  href={enlaces[p.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm"
                >
                  Iniciar retransmisión
                  <IconoFlecha size={15} />
                </a>
              </div>

              {aMano === p.id ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-club">
                    Este navegador no deja copiar solo. Cópialo a mano:
                  </p>
                  <input
                    readOnly
                    value={enlaces[p.id]}
                    onFocus={(e) => e.currentTarget.select()}
                    className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-xs text-tinta"
                  />
                </div>
              ) : null}

              {/*
                Empezar de cero. Va aparte y en dos pasos porque borra la
                cronología del partido, y eso no se guarda en ningún otro sitio.
              */}
              <div className="mt-3 border-t border-linea pt-3">
                {confirmando === p.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-club">
                      Se borra todo lo apuntado. No se puede deshacer.
                    </span>
                    <button
                      type="button"
                      onClick={() => reiniciar(p.id)}
                      disabled={trabajando === p.id}
                      className="btn btn-primary px-3 py-1.5 text-xs"
                    >
                      {trabajando === p.id ? "Borrando…" : "Sí, empezar de cero"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="btn btn-ghost px-3 py-1.5 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(p.id)}
                    className="text-xs font-bold text-mute underline transition-colors hover:text-club"
                  >
                    Reiniciar el partido
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
