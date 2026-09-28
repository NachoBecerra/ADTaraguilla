"use client";

import { useEffect } from "react";
import { seccionDesdeUrl } from "@/lib/seccionesInicio";

/**
 * Coloca la portada en el bloque que pide la dirección.
 *
 * El `#` lo resuelve el navegador solo, pero no siempre: en la aplicación
 * instalada, y cuando el enlace se abre desde Facebook o WhatsApp, la página
 * llega a pintarse después del salto y se queda arriba. Y `?resultados` no lo
 * mueve nadie. Así que se mira aquí, una vez, al cargar.
 *
 * No toca el historial ni la dirección: quien copie el enlace de la barra
 * sigue teniendo el que le pasaron.
 */
export default function IrALaSeccion() {
  useEffect(() => {
    const seccion = seccionDesdeUrl(window.location.search, window.location.hash);
    if (!seccion) return;

    /* Un cuadro de espera: el salto tiene que ocurrir con el bloque ya
       pintado, o se va a un sitio que todavía no existe */
    const reloj = window.setTimeout(() => {
      document.getElementById(seccion)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    return () => window.clearTimeout(reloj);
  }, []);

  return null;
}
