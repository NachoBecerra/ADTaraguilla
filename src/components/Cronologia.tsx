"use client";

import { Fragment, useState } from "react";
import CampoQueCrece from "@/components/CampoQueCrece";
import { LARGO_TEXTO, type EventoEnLinea, type Jugada } from "@/lib/directo/modelo";
import {
  IconoAPuerta,
  IconoComentario,
  IconoCorner,
  IconoFuera,
  IconoFueraDeJuego,
  IconoGol,
  IconoLapiz,
  IconoPenalti,
  IconoSilbato,
  IconoTarjeta,
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
      return `Disparo a puerta de ${equipo}`;
    case "disparoFuera":
      return `Disparo fuera de ${equipo}`;
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
  disparoFuera: IconoFuera,
  falta: IconoSilbato,
  penalti: IconoPenalti,
} as const;

/**
 * Los eventos que abren o cierran una parte, o paran el reloj.
 *
 * Llevan el mismo silbato que una falta —es el mismo pitido— pero en verde y
 * sobre fondo tenue: en una lista con treinta faltas, el cambio de parte tiene
 * que encontrarse sin leer.
 */
const FASES = new Set(["inicio", "empezarParte", "finParte", "final", "parar", "reanudar"]);

/** Un icono ayuda a encontrar los goles de un vistazo al bajar por la lista. */
function icono(evento: EventoEnLinea): React.ReactNode {
  /* 18 y no 15: estos dibujos llevan más detalle que un trazo suelto, y tres
     píxeles menos es la diferencia entre ver una portería y ver una mancha */
  const tam = 18;

  switch (evento.tipo) {
    case "gol":
      return <IconoGol size={tam} className="text-tinta" />;
    case "tarjeta":
      return <IconoTarjeta color={evento.color} size={tam} />;
    case "jugada": {
      const Dibujo = DIBUJO_DE_JUGADA[evento.clase];
      return <Dibujo size={tam} className="text-mute" />;
    }
    case "texto":
      return <IconoComentario size={tam} className="text-mute" />;
    default:
      // Inicio, final, parar y reanudar: todos son el mismo pitido
      return <IconoSilbato size={tam} className="text-club" />;
  }
}

/** El encabezado de cada bloque de la cronología. */
function tituloDeParte(parte: number): string {
  return parte === 0 ? "Antes del partido" : `${parte}ª parte`;
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

  const alReves = [...linea].reverse();

  /* Con el partido en marcha hay dos o tres bloques —lo de antes del saque, la
     primera parte y la segunda—; con uno solo, un encabezado sobra */
  const hayVariasPartes = new Set(linea.map((e) => e.parte)).size > 1;

  /* El plegado devuelve los eventos como pasaron; aquí se enseñan al revés */
  return (
    <ol className="mt-3 space-y-1.5">
      {alReves.map((evento, i) => {
        const enEdicion = editando === evento.id;

        /* Yendo hacia atrás, cada bloque empieza donde cambia la parte. El
           encabezado nombra lo que viene debajo, que es lo que se lee luego. */
        const abreBloque =
          hayVariasPartes && (i === 0 || alReves[i - 1].parte !== evento.parte);

        const esFase = FASES.has(evento.tipo);

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
        <Fragment key={evento.id}>
        {abreBloque ? (
          <li className="flex items-center gap-2.5 pt-2 pb-0.5">
            <span className="h-px flex-1 bg-linea" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-mute">
              {tituloDeParte(evento.parte)}
            </span>
            <span className="h-px flex-1 bg-linea" />
          </li>
        ) : null}
        <li
          className={`rounded-xl border px-3 py-2.5 ${
            enEdicion
              ? "border-club bg-panel"
              : `flex items-center gap-3 ${
                  esFase ? "border-club-claro bg-panel-2" : "border-linea bg-panel"
                }`
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
                  evento.tipo === "gol"
                    ? "font-bold text-tinta"
                    : esFase
                      ? "font-semibold text-club-soft"
                      : "text-mute"
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
        </Fragment>
        );
      })}
    </ol>
  );
}
