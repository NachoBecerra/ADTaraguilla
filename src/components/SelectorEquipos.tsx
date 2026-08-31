export type OpcionEquipo = { id: string; nombre: string };

/**
 * Elige a qué equipo pertenecen unas fotos.
 *
 * A diferencia de las etiquetas, aquí no se escribe: se elige de la lista de
 * equipos del club. Así el vínculo es exacto y la ficha del equipo encuentra
 * sus fotos sin depender de cómo se haya escrito el nombre.
 *
 * Es un desplegable normal a propósito: en el móvil abre el selector del
 * sistema, que se maneja mucho mejor con el dedo que una fila de botones.
 *
 * Se envía como lista de un solo valor porque así lo guarda la galería, que
 * admite varios equipos por entrada aunque desde aquí se asigne uno.
 */
export default function SelectorEquipos({
  nombre,
  equipos,
  iniciales = [],
}: {
  /** Nombre del campo del formulario. */
  nombre: string;
  equipos: OpcionEquipo[];
  iniciales?: string[];
}) {
  if (equipos.length === 0) {
    return <p className="text-xs text-mute">Todavía no hay equipos en competición.</p>;
  }

  return (
    <div>
      <select
        name={nombre}
        defaultValue={iniciales[0] ?? ""}
        className="w-full rounded-xl border border-linea bg-panel px-4 py-3 text-tinta focus:border-club focus:outline-none"
      >
        <option value="">Sin equipo</option>
        {equipos.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>

      <p className="mt-2 text-xs text-mute">
        Las fotos aparecerán también en la ficha de ese equipo.
      </p>
    </div>
  );
}
