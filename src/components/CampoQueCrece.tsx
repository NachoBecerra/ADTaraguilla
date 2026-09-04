"use client";

import { useCallback, useEffect, useRef, type ComponentPropsWithoutRef } from "react";

/**
 * Un campo de texto que se hace alto según se escribe.
 *
 * Nace de escribir comentarios desde la banda: en una sola línea, al pasar de
 * unas pocas palabras el texto se desplaza y **el principio de la frase queda
 * fuera de la pantalla**, donde no se puede ni ver ni tocar para corregirlo.
 * Creciendo hacia abajo, la frase entera sigue a la vista y el dedo llega a
 * cualquier palabra.
 *
 * A partir de {@link LINEAS_MAX} deja de crecer y hace scroll, para que el
 * campo no se coma la pantalla y aparte de la vista los botones del partido.
 */

/** Lo que crece antes de empezar a hacer scroll. */
const LINEAS_MAX = 6;

type Props = Omit<ComponentPropsWithoutRef<"textarea">, "rows" | "value"> & {
  value: string;
  /** Intro. Escribiendo un comentario no hacen falta saltos de línea. */
  alEnviar?: () => void;
  /** Escape. */
  alCancelar?: () => void;
};

export default function CampoQueCrece({
  value,
  alEnviar,
  alCancelar,
  onKeyDown,
  className = "",
  ...resto
}: Props) {
  const caja = useRef<HTMLTextAreaElement | null>(null);

  const ajustar = useCallback(() => {
    const nodo = caja.current;
    if (!nodo) return;

    /*
     * El alto en "auto" obliga al navegador a recalcular `scrollHeight` con el
     * texto actual. Sin este paso el campo crecería, pero al borrar no volvería
     * a encoger: `scrollHeight` nunca baja del alto ya fijado.
     */
    nodo.style.height = "auto";

    const estilo = getComputedStyle(nodo);
    const linea = parseFloat(estilo.lineHeight) || 24;
    // scrollHeight cuenta el relleno pero no los bordes; con box-sizing:
    // border-box hay que sumárselos para no quedarse corto por un par de píxeles
    const bordes = nodo.offsetHeight - nodo.clientHeight;
    const relleno = parseFloat(estilo.paddingTop) + parseFloat(estilo.paddingBottom);
    const tope = linea * LINEAS_MAX + relleno + bordes;

    nodo.style.height = `${Math.min(nodo.scrollHeight + bordes, tope)}px`;
    nodo.style.overflowY = nodo.scrollHeight + bordes > tope ? "auto" : "hidden";
  }, []);

  /*
   * Al escribir lo ajusta el propio onChange, pero el valor también cambia
   * desde fuera: al vaciarse el campo tras publicar el comentario hay que
   * devolverlo a su alto de una línea.
   */
  useEffect(ajustar, [value, ajustar]);

  /* Girando el móvil el texto se reparte en otras líneas y el alto cambia */
  useEffect(() => {
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [ajustar]);

  return (
    <textarea
      {...resto}
      value={value}
      rows={1}
      ref={(nodo) => {
        caja.current = nodo;
        ajustar();
      }}
      onInput={ajustar}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === "Enter" && !e.shiftKey && alEnviar) {
          e.preventDefault(); // si no, deja un salto de línea antes de enviar
          alEnviar();
        }
        if (e.key === "Escape" && alCancelar) alCancelar();
      }}
      className={`resize-none ${className}`}
    />
  );
}
