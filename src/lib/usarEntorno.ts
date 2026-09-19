"use client";

import { useSyncExternalStore } from "react";
import { entornoDe, type Entorno } from "@/lib/instalar";

/**
 * Desde dónde se está mirando la web, para lo que se pinta en pantalla.
 *
 * Lo mismo que hace el resto de la web con lo que solo sabe el navegador: en
 * el servidor vale `null` y no se pinta nada, así no hay dos versiones del
 * HTML que no cuadren al hidratar.
 *
 * Se calcula una sola vez y se guarda: `useSyncExternalStore` vuelve a pedir
 * el valor en cada pintada y tiene que salir siempre el mismo objeto.
 */

let guardado: Entorno | null = null;

function entornoActual(): Entorno {
  guardado ??= entornoDe(
    navigator.userAgent,
    navigator.maxTouchPoints > 1 && navigator.platform === "MacIntel",
  );
  return guardado;
}

/** Nada a lo que suscribirse: el navegador no cambia a mitad de visita. */
const sinCambios = () => () => {};

export function useEntorno(): Entorno | null {
  return useSyncExternalStore(sinCambios, entornoActual, () => null);
}
