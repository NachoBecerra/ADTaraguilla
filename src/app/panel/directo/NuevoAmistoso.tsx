"use client";

import { useState } from "react";
import { crearAmistoso } from "./acciones";

/**
 * Crear a mano un partido que no está en la RFAF.
 *
 * Un amistoso, un torneo de verano, un triangular de pretemporada: cosas que
 * el club juega y la federación no publica. Vive solo en el almacén del
 * directo, así que después se borra entero y no queda nada.
 *
 * Va plegado por defecto. Lo normal es retransmitir partidos de liga, y un
 * formulario abierto en medio del panel sugeriría lo contrario.
 */

export default function NuevoAmistoso({
  equipos,
}: {
  equipos: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function crear(datos: FormData) {
    setGuardando(true);
    setError("");

    const r = await crearAmistoso({
      equipo: String(datos.get("equipo") ?? ""),
      rival: String(datos.get("rival") ?? ""),
      enCasa: datos.get("donde") !== "fuera",
      fecha: String(datos.get("fecha") ?? ""),
      hora: String(datos.get("hora") ?? ""),
      campo: String(datos.get("campo") ?? ""),
    });

    setGuardando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }

    // Recargar: el partido nuevo tiene que aparecer arriba con los demás
    window.location.reload();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="btn btn-ghost mt-6 w-full py-3 text-sm"
      >
        Añadir un partido amistoso
      </button>
    );
  }

  const campo = "mt-1 w-full rounded-xl border border-linea bg-panel px-3 py-2.5 text-base text-tinta focus:border-club focus:outline-none";
  const etiqueta = "text-xs font-bold uppercase tracking-wide text-mute";

  return (
    <form action={crear} className="card mt-6 p-4">
      <h2 className="title text-xl text-tinta">Partido amistoso</h2>
      <p className="mt-1 text-xs leading-relaxed text-mute">
        Para lo que la RFAF no publica. No aparecerá en resultados ni en la
        clasificación: solo se podrá retransmitir. Se borra cuando quieras y no
        deja rastro.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="equipo" className={etiqueta}>
            Equipo del club
          </label>
          <select id="equipo" name="equipo" required className={campo}>
            {equipos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rival" className={etiqueta}>
            Rival
          </label>
          <input
            id="rival"
            name="rival"
            required
            maxLength={60}
            placeholder="C.D. San García"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="donde" className={etiqueta}>
            Dónde se juega
          </label>
          <select id="donde" name="donde" defaultValue="casa" className={campo}>
            <option value="casa">En casa</option>
            <option value="fuera">Fuera</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fecha" className={etiqueta}>
              Día
            </label>
            <input id="fecha" name="fecha" type="date" required className={campo} />
          </div>
          <div>
            <label htmlFor="hora" className={etiqueta}>
              Hora
            </label>
            <input id="hora" name="hora" type="time" className={campo} />
          </div>
        </div>

        <div>
          <label htmlFor="campo" className={etiqueta}>
            Campo
          </label>
          <input
            id="campo"
            name="campo"
            maxLength={80}
            placeholder="Hermanos García Mota"
            className={campo}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-club">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={guardando} className="btn btn-primary flex-1 py-3 text-sm">
          {guardando ? "Creando…" : "Crear el partido"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="btn btn-ghost flex-1 py-3 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
