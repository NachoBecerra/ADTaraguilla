"use client";

import { useState } from "react";
import CampoQueCrece from "@/components/CampoQueCrece";
import { LARGO_TEXTO, type EventoEnLinea, type Jugada } from "@/lib/directo/modelo";
import {
  IconoAPuerta,
  IconoCorner,
  IconoFalta,
  IconoFueraDeJuego,
  IconoLapiz,
  IconoPenalti,
  IconoTiroLibre,
} from "@/components/Iconos";
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
 * este último se le pasan `alAnular` y `alEditar`, y le aparecen la equis y el
 * lápiz.
 *
 * La edición solo se ofrece en los comentarios, que son lo único escrito a mano
 * y por tanto lo único que puede salir con una errata. Un gol mal apuntado no se
 * edita: se quita. Y el lápiz no ocupa sitio hasta que hace falta, porque en esa
 * pantalla no sobra ni un píxel: al pulsarlo, la propia fila se convierte en el
 * campo de escritura.
 */

/** Cada jugada con la preposición que le toca: no es lo mismo "para" que "de". */
function textoDeJugada(clase: Jugada, equipo: string): string {
  switch (clase) {
    case "corner":
      return `Córner para ${equipo}`;
    case "tiroLibre":
      return `Tiro libre para ${equipo}`;
    case "fueraDeJuego":
      return `Fuera de juego de ${equipo}`;
    case "disparo":
      return `Tiro a puerta de ${equipo}`;
    case "falta":
      return `Falta de ${equipo}`;
    case "penalti":
      return `Penalti para ${equipo}`;
  }
}

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
    case "jugada":
      return textoDeJugada(evento.clase, nombre(evento.equipo));
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

const DIBUJO_DE_JUGADA = {
  corner: IconoCorner,
  tiroLibre: IconoTiroLibre,
  fueraDeJuego: IconoFueraDeJuego,
  disparo: IconoAPuerta,
  falta: IconoFalta,
  penalti: IconoPenalti,
} as const;

/** Un icono ayuda a encontrar los goles de un vistazo al bajar por la lista. */
function icono(evento: EventoEnLinea): React.ReactNode {
  switch (evento.tipo) {
    case "gol":
      return "⚽";
    case "tarjeta":
      return evento.color === "amarilla" ? "🟨" : "🟥";
    case "jugada": {
      const Dibujo = DIBUJO_DE_JUGADA[evento.clase];
      return <Dibujo size={15} className="text-mute" />;
    }
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
  alEditar,
}: {
  linea: EventoEnLinea[];
  partido: FichaPartido;
  alAnular?: (id: string) => void;
  /**
   * Corrige un comentario ya publicado.
   *
   * Se pasa el instante original además del texto: el comentario corregido tiene
   * que quedarse en su minuto y en su sitio de la cronología, no saltar al final
   * como si acabara de escribirse.
   */
  alEditar?: (id: string, ts: number, mensaje: string) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");

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
      {[...linea].reverse().map((evento) => {
        const enEdicion = editando === evento.id;

        /* Solo los comentarios: son lo único escrito a mano */
        const sePuedeEditar = Boolean(alEditar) && evento.tipo === "texto";

        const guardar = () => {
          const limpio = borrador.trim();
          // Sin cambios o vacío: se sale sin tocar nada, que borrar es la equis
          const antes = evento.tipo === "texto" ? evento.mensaje : "";
          if (limpio && limpio !== antes) alEditar?.(evento.id, evento.ts, limpio);
          setEditando(null);
        };

        return (
        <li
          key={evento.id}
          className={`rounded-xl border bg-panel px-3 py-2.5 ${
            enEdicion
              ? "border-club"
              : "flex items-center gap-3 border-linea"
          }`}
        >
          {/*
            Editando, el campo se lleva una línea entera y los botones van
            debajo. En un móvil, con "Guardar" y "Cancelar" al lado, al texto le
            quedaban tres palabras de ancho: inservible para corregir una frase.
          */}
          {enEdicion ? (
            <>
              <CampoQueCrece
                autoFocus
                value={borrador}
                maxLength={LARGO_TEXTO}
                aria-label="Corregir el comentario"
                enterKeyHint="done"
                onChange={(e) => setBorrador(e.target.value)}
                alEnviar={guardar}
                alCancelar={() => setEditando(null)}
                className="w-full rounded-lg border border-linea bg-panel px-3 py-2 text-base text-tinta focus:border-club focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 text-xs text-mute">
                  Se queda en el minuto {evento.minuto.etiqueta}
                </span>
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="btn btn-ghost px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardar}
                  className="btn btn-primary px-3 py-1.5 text-xs"
                >
                  Guardar
                </button>
              </div>
            </>
          ) : (
            <>
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

              {sePuedeEditar ? (
                <button
                  type="button"
                  onClick={() => {
                    setBorrador(evento.tipo === "texto" ? evento.mensaje : "");
                    setEditando(evento.id);
                  }}
                  className="shrink-0 rounded-lg px-1.5 py-1 text-mute transition-colors hover:text-club"
                >
                  <IconoLapiz size={15} />
                  <span className="sr-only">Corregir el comentario</span>
                </button>
              ) : null}

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
            </>
          )}
        </li>
        );
      })}
    </ol>
  );
}
