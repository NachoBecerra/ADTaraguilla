"use client";

import { useSyncExternalStore } from "react";
import { IconoCampanaLlena } from "@/components/Iconos";

/**
 * Campanita en la esquina de la tarjeta del equipo del que se reciben avisos.
 *
 * El equipo elegido vive en el almacenamiento del navegador, que no es estado
 * de React. Se lee con `useSyncExternalStore`, que es lo que existe justo para
 * eso: no da problemas al pintar en el servidor y se entera de los cambios
 * hechos en otra pestaña.
 */

export const CLAVE_AVISOS = "avisos-equipo";
/** Aviso propio: `storage` solo salta en las OTRAS pestañas, no en la actual. */
export const EVENTO_AVISOS = "avisos-equipo-cambio";

function suscribir(alCambiar: () => void): () => void {
  window.addEventListener("storage", alCambiar);
  window.addEventListener(EVENTO_AVISOS, alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener(EVENTO_AVISOS, alCambiar);
  };
}

function enElNavegador(): string | null {
  try {
    return localStorage.getItem(CLAVE_AVISOS);
  } catch {
    return null;
  }
}

/** En el servidor no hay navegador, así que no se pinta nada. */
const enElServidor = (): string | null => null;

export default function IndicadorAvisos({
  equipo,
  posicion = "right-2.5 top-2.5",
}: {
  equipo: string;
  /**
   * Dónde colgarla. Por defecto dentro de la esquina, que es donde hay hueco
   * en las tarjetas grandes; en las filas compactas esa esquina la ocupa la
   * hora y hay que sacarla al borde.
   */
  posicion?: string;
}) {
  const elegido = useSyncExternalStore(suscribir, enElNavegador, enElServidor);
  if (elegido !== equipo) return null;

  return (
    <span
      role="img"
      // El title es la ayuda al pasar el ratón; el aria-label, lo que se lee
      aria-label="Recibes avisos de este equipo"
      title="Recibes avisos de este equipo"
      /*
       * Sin círculo ni fondo: solo la campana, del verde del club. Basta para
       * saber que ese equipo tiene avisos sin robarle atención a la tarjeta.
       */
      className={`absolute z-10 text-club ${posicion}`}
    >
      <IconoCampanaLlena size={16} />
    </span>
  );
}
