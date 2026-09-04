"use client";

import { useState } from "react";
import EscudoImg from "@/components/EscudoImg";
import type { FichaPartido } from "@/lib/directo/almacen";
import type { EventoEnLinea } from "@/lib/directo/modelo";
import {
  CUENTAS,
  NOMBRES,
  contar,
  hayAlgoQueContar,
  partesJugadas,
} from "@/lib/directo/estadisticas";

/**
 * Las cuentas del partido, para quien las quiera.
 *
 * Van detrás de un botón a propósito. Lo que la mayoría abre la página a mirar
 * es el marcador y el minuto, y una tabla de siete filas metida entre el
 * resultado y la cronología los empuja fuera de la pantalla del móvil. Quien
 * quiere saber cuántos córners lleva su equipo lo pregunta una vez, no en cada
 * recarga.
 *
 * Los números salen de la cronología en cada pintada, así que se corrigen solos
 * cuando alguien corrige un evento desde la banda.
 */

/** Ancho de la barra de cada equipo, repartido según sus números. */
function reparto(a: number, b: number): [number, number] {
  if (a + b === 0) return [0, 0];
  return [(a / (a + b)) * 100, (b / (a + b)) * 100];
}

export default function EstadisticasDirecto({
  linea,
  partido,
}: {
  linea: EventoEnLinea[];
  partido: FichaPartido;
}) {
  const [abierto, setAbierto] = useState(false);
  /** `0` es el partido entero; 1 y 2, cada parte. */
  const [parte, setParte] = useState(0);

  // Sin nada que contar, un botón que abre una tabla de ceros no aporta nada
  if (!hayAlgoQueContar(linea)) return null;

  const partes = partesJugadas(linea);
  const cuentas = contar(linea, parte === 0 ? undefined : parte);

  /* Una fila de ceros en las dos columnas no dice nada: se calla, salvo que
     con ese filtro no quede ninguna, y entonces hay que explicar por qué */
  const filas = CUENTAS.filter(
    (c) => cuentas.local[c] > 0 || cuentas.visitante[c] > 0,
  );

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="btn btn-ghost w-full py-3 text-sm"
      >
        {abierto ? "Ocultar estadísticas" : "Mostrar estadísticas"}
      </button>

      {abierto ? (
        <div className="mt-2 rounded-2xl border border-linea bg-panel p-4">
          {/* Qué escudo es cada lado de la barra, que si no hay que adivinarlo */}
          <div className="flex items-center gap-2">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <EscudoImg src={partido.escudoLocal} size={22} />
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-club"
              />
              <span className="truncate text-xs font-bold text-tinta">
                {partido.local}
              </span>
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <span className="truncate text-right text-xs font-bold text-tinta">
                {partido.visitante}
              </span>
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-club-claro"
              />
              <EscudoImg src={partido.escudoVisitante} size={22} />
            </span>
          </div>

          {/* Las partes solo se ofrecen si se han jugado: en el descanso no hay
              segunda parte de la que enseñar nada */}
          {partes.length > 1 ? (
            <div
              role="tablist"
              aria-label="Parte del partido"
              className="mt-3 flex gap-1 rounded-xl bg-panel-2 p-1"
            >
              {[{ v: 0, t: "Todo" }, ...partes.map((p) => ({ v: p, t: `${p}ª parte` }))].map(
                ({ v, t }) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={parte === v}
                    onClick={() => setParte(v)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                      parte === v ? "bg-club text-white" : "text-mute"
                    }`}
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
          ) : null}

          {filas.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {filas.map((c) => {
                const local = cuentas.local[c];
                const visitante = cuentas.visitante[c];
                const [izq, der] = reparto(local, visitante);
                return (
                  // `data-cuenta` da a cada fila un asidero estable: por el
                  // texto habría que distinguir "Tiros a puerta" de "Tiros
                  // libres", y basta con retocar un nombre para romperlo
                  <li key={c} data-cuenta={c}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="w-6 shrink-0 text-left font-bold tabular-nums text-tinta">
                        {local}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-center text-xs text-mute">
                        {NOMBRES[c]}
                      </span>
                      <span className="w-6 shrink-0 text-right font-bold tabular-nums text-tinta">
                        {visitante}
                      </span>
                    </div>
                    {/* La barra es lo que se lee de un vistazo; los números
                        están para quien quiera la cifra exacta */}
                    <div
                      aria-hidden
                      className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-panel-2"
                    >
                      <span
                        className="rounded-full bg-club transition-[width]"
                        style={{ width: `${izq}%` }}
                      />
                      <span
                        className="rounded-full bg-club-claro transition-[width]"
                        style={{ width: `${der}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-center text-sm text-mute">
              En esta parte todavía no ha pasado nada.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
