import type { EventoEnLinea } from "@/lib/directo/modelo";
import type { FichaPartido } from "@/lib/directo/almacen";

/**
 * Lo que ha ido pasando en el partido, con lo último arriba.
 *
 * Al revés obligaría a bajar hasta el final cada vez que pasa algo, y en un
 * partido pasan treinta cosas. Vale igual para quien sigue el partido desde
 * casa y para quien lo escribe desde el campo: el que acaba de apuntar un gol
 * quiere verlo sin desplazar nada, y de paso la equis para corregirlo le queda
 * a mano, justo debajo del botón de deshacer.
 *
 * La misma lista la ve el público y quien está escribiendo desde el campo; a
 * este último se le pasa `alAnular` y le aparece la equis para corregir.
 */

function describir(evento: EventoEnLinea, partido: FichaPartido): string {
  const nombre = (lado: "local" | "visitante") =>
    lado === "local" ? partido.local : partido.visitante;

  switch (evento.tipo) {
    case "inicio":
      return "Comienza el partido";
    case "gol":
      return `Gol de ${nombre(evento.equipo)}`;
    case "tarjeta":
      return `Tarjeta ${evento.color} para ${nombre(evento.equipo)}`;
    case "parar":
      return "Se para el reloj";
    case "reanudar":
      return "Se reanuda el juego";
    case "finParte":
      return "Final de la parte";
    case "empezarParte":
      return "Empieza la siguiente parte";
    case "final":
      return "Final del partido";
    case "texto":
      return evento.mensaje;
  }
}

/** Un icono ayuda a encontrar los goles de un vistazo al bajar por la lista. */
function icono(evento: EventoEnLinea): string {
  switch (evento.tipo) {
    case "gol":
      return "⚽";
    case "tarjeta":
      return evento.color === "amarilla" ? "🟨" : "🟥";
    case "inicio":
    case "empezarParte":
      return "▶";
    case "finParte":
    case "final":
      return "⏹";
    case "parar":
      return "⏸";
    case "reanudar":
      return "⏵";
    case "texto":
      return "💬";
  }
}

export default function Cronologia({
  linea,
  partido,
  alAnular,
}: {
  linea: EventoEnLinea[];
  partido: FichaPartido;
  alAnular?: (id: string) => void;
}) {
  if (linea.length === 0) {
    return (
      <p className="mt-3 rounded-xl bg-panel-2 p-4 text-center text-sm text-mute">
        Todavía no ha pasado nada.
      </p>
    );
  }

  /* El plegado devuelve los eventos como pasaron; aquí se enseñan al revés */
  return (
    <ol className="mt-3 space-y-1.5">
      {[...linea].reverse().map((evento) => (
        <li
          key={evento.id}
          className="flex items-center gap-3 rounded-xl border border-linea bg-panel px-3 py-2.5"
        >
          {/* Ancho fijo para que los minutos queden en columna. La etiqueta
              ya trae la comilla, o el "+" si fue en el descuento. */}
          <span
            className={`w-12 shrink-0 text-right text-sm font-bold tabular-nums ${
              evento.minuto.descuento ? "text-club" : "text-club-soft"
            }`}
          >
            {evento.minuto.etiqueta}
          </span>
          <span aria-hidden className="shrink-0 text-base">
            {icono(evento)}
          </span>
          <span
            className={`min-w-0 flex-1 text-sm ${
              evento.tipo === "gol" ? "font-bold text-tinta" : "text-mute"
            }`}
          >
            {describir(evento, partido)}
          </span>

          {alAnular ? (
            <button
              type="button"
              onClick={() => alAnular(evento.id)}
              className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-mute transition-colors hover:text-club"
            >
              <span aria-hidden>✕</span>
              <span className="sr-only">Quitar</span>
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
