"use client";

import { useSyncExternalStore } from "react";
import { IconoCampana } from "@/components/Iconos";

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

export default function IndicadorAvisos({ equipo }: { equipo: string }) {
  const elegido = useSyncExternalStore(suscribir, enElNavegador, enElServidor);
  if (elegido !== equipo) return null;

  return (
    <span
      role="img"
      // El title es la ayuda al pasar el ratón; el aria-label, lo que se lee
      aria-label="Recibes avisos de este equipo"
      title="Recibes avisos de este equipo"
      /*
       * Apoyada en el borde: sobresale de la tarjeta y el aro del color del
       * fondo la recorta, que es lo que da la sensación de estar encima.
       */
      className="absolute -right-2.5 -top-2.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-club text-white shadow-md ring-2 ring-fondo"
    >
      <IconoCampana size={14} />
    </span>
  );
}
