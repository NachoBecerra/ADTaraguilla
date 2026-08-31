"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconoFlecha } from "@/components/Iconos";

/**
 * Avisa cuando hay resultados u horarios nuevos.
 *
 * La web se reconstruye con cada sincronización, así que una aplicación ya
 * abierta se queda con los datos del momento en que se abrió: durante una
 * tarde de partidos, mirando el marcador, no se enteraría de nada.
 *
 * Se pregunta por la marca de generación de los datos y se compara con la que
 * traía la página. Si cambió:
 *
 * - con la aplicación en segundo plano, se recarga sin más: nadie está
 *   leyendo y al volver se encuentra lo último;
 * - si está delante, no se le mueve la página bajo las manos: se ofrece un
 *   aviso discreto y decide.
 */

/** Cada cuánto se pregunta, mientras la aplicación esté a la vista. */
const CADA_MS = 90_000;

export default function AvisoDatosNuevos({ generado }: { generado: string }) {
  const [hayNuevos, setHayNuevos] = useState(false);
  // Si estuvo oculta, al volver se recarga en vez de preguntar
  const estuvoOculta = useRef(false);

  const comprobar = useCallback(async () => {
    // En el panel no: recargar tiraría las fotos que se estén preparando
    if (window.location.pathname.startsWith("/panel")) return;

    try {
      const r = await fetch("/api/version", { cache: "no-store" });
      if (!r.ok) return;
      const datos = (await r.json()) as { generado?: string };
      if (!datos.generado || datos.generado === generado) return;

      if (estuvoOculta.current) window.location.reload();
      else setHayNuevos(true);
    } catch {
      // Sin conexión no hay nada que comprobar; se reintenta más tarde
    }
  }, [generado]);

  useEffect(() => {
    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        estuvoOculta.current = true;
        return;
      }
      comprobar().finally(() => {
        estuvoOculta.current = false;
      });
    };

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    const reloj = setInterval(() => {
      if (!document.hidden) comprobar();
    }, CADA_MS);

    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      clearInterval(reloj);
    };
  }, [comprobar]);

  if (!hayNuevos) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-90 mx-auto max-w-sm rounded-2xl bg-club-dark/97 p-3 pl-4 text-white shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">
          Hay resultados nuevos
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-club transition-transform active:scale-95"
        >
          Actualizar
          <IconoFlecha size={15} />
        </button>
      </div>
    </div>
  );
}
