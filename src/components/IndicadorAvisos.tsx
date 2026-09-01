"use client";

import { useSyncExternalStore } from "react";
import { IconoCampanaLlena } from "@/components/Iconos";

/**
 * Campanita en la esquina de las tarjetas de los equipos que se siguen.
 *
 * Los equipos elegidos viven en el almacenamiento del navegador, que no es
 * estado de React. Se leen con `useSyncExternalStore`, que es lo que existe
 * justo para eso: no da problemas al pintar en el servidor y se entera de los
 * cambios hechos en otra pestaña.
 */

export const CLAVE_AVISOS = "avisos-equipos";
/** Aviso propio: `storage` solo salta en las OTRAS pestañas, no en la actual. */
export const EVENTO_AVISOS = "avisos-equipos-cambio";

/**
 * La lista guardada, tal cual está en el almacenamiento.
 *
 * Se devuelve el texto en crudo y no la lista ya interpretada a propósito:
 * `useSyncExternalStore` compara por identidad, y devolver un array nuevo en
 * cada lectura provocaría un repintado sin fin.
 */
export function equiposGuardados(): string {
  try {
    return localStorage.getItem(CLAVE_AVISOS) ?? "[]";
  } catch {
    return "[]";
  }
}

/** Guarda la lista y avisa a las campanitas de esta pestaña. */
export function guardarEquipos(equipos: string[]): void {
  try {
    localStorage.setItem(CLAVE_AVISOS, JSON.stringify(equipos));
  } catch {
    // Sin almacenamiento se pierde la marca visual, no los avisos
  }
  window.dispatchEvent(new Event(EVENTO_AVISOS));
}

export function comoLista(crudo: string): string[] {
  try {
    const leido = JSON.parse(crudo) as unknown;
    return Array.isArray(leido) ? (leido as string[]) : [];
  } catch {
    return [];
  }
}

function suscribir(alCambiar: () => void): () => void {
  window.addEventListener("storage", alCambiar);
  window.addEventListener(EVENTO_AVISOS, alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener(EVENTO_AVISOS, alCambiar);
  };
}

/** En el servidor no hay navegador, así que no se pinta nada. */
const enElServidor = (): string => "[]";

export default function IndicadorAvisos({
  equipo,
  posicion = "right-2.5 top-2.5",
}: {
  equipo: string;
  /**
   * Dónde colgarla. Por defecto dentro de la esquina, que es donde hay hueco
   * en las tarjetas grandes; en las filas compactas esa esquina la ocupa la
   * hora y hay que apoyarla en el borde.
   */
  posicion?: string;
}) {
  const crudo = useSyncExternalStore(suscribir, equiposGuardados, enElServidor);
  if (!comoLista(crudo).includes(equipo)) return null;

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
      <IconoCampanaLlena size={22} />
    </span>
  );
}
