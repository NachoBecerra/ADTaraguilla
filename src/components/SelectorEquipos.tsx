"use client";

import { useState } from "react";

export type OpcionEquipo = { id: string; nombre: string };

/**
 * Elige a qué equipos pertenecen unas fotos.
 *
 * A diferencia de las etiquetas, aquí no se escribe: se elige de la lista de
 * equipos del club. Así el vínculo es exacto y la ficha del equipo puede
 * encontrar sus fotos sin depender de cómo se haya escrito el nombre.
 *
 * Se admiten varios porque hay fotos que valen para dos equipos: un derbi de
 * cantera, una foto de familia, la entrega de trofeos.
 */
export default function SelectorEquipos({
  nombre,
  equipos,
  iniciales = [],
}: {
  /** Nombre del campo del formulario; se envía como valores repetidos. */
  nombre: string;
  equipos: OpcionEquipo[];
  iniciales?: string[];
}) {
  const [elegidos, setElegidos] = useState<string[]>(iniciales);

  const alternar = (id: string) =>
    setElegidos((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  if (equipos.length === 0) {
    return <p className="text-xs text-mute">Todavía no hay equipos en competición.</p>;
  }

  return (
    <div>
      {/* Lo que viaja en el formulario: un valor por equipo */}
      {elegidos.map((id) => (
        <input key={id} type="hidden" name={nombre} value={id} />
      ))}

      <ul className="flex flex-wrap gap-1.5">
        {equipos.map((e) => {
          const activo = elegidos.includes(e.id);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => alternar(e.id)}
                aria-pressed={activo}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  activo
                    ? "bg-club text-white"
                    : "border border-linea bg-panel text-mute hover:border-club hover:text-club"
                }`}
              >
                {e.nombre}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-mute">
        Las fotos aparecerán en la ficha del equipo. Puedes marcar más de uno.
      </p>
    </div>
  );
}
