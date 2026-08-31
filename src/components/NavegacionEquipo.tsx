"use client";

import { useEffect, useState } from "react";
import {
  IconoTabla,
  IconoCalendario,
  IconoMarcador,
  IconoImagen,
} from "@/components/Iconos";

/**
 * Barra inferior para saltar entre los bloques de la ficha de un equipo.
 *
 * En el móvil la ficha es larga: para llegar a las imágenes hay que pasar por
 * la clasificación entera y el calendario. Esta barra lleva a cada bloque de
 * un toque y va marcando en cuál estás.
 *
 * Solo en pantallas pequeñas: en el ordenador se ve casi todo de una vez y
 * estorbaría más que ayuda.
 */

export type Bloque = "clasificacion" | "calendario" | "resultados" | "imagenes";

const ETIQUETAS: Record<Bloque, { texto: string; Icono: typeof IconoTabla }> = {
  clasificacion: { texto: "Clasificación", Icono: IconoTabla },
  calendario: { texto: "Calendario", Icono: IconoCalendario },
  resultados: { texto: "Resultados", Icono: IconoMarcador },
  imagenes: { texto: "Imágenes", Icono: IconoImagen },
};

export default function NavegacionEquipo({ bloques }: { bloques: Bloque[] }) {
  const [activo, setActivo] = useState<Bloque | null>(bloques[0] ?? null);

  useEffect(() => {
    if (bloques.length < 2) return;

    /*
     * Se marca el bloque cuya cabecera está más arriba dentro de la franja
     * visible. El margen inferior grande evita que el último bloque, si es
     * corto, no llegue nunca a marcarse.
     */
    const observador = new IntersectionObserver(
      (entradas) => {
        const visibles = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visibles[0]) setActivo(visibles[0].target.id as Bloque);
      },
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 },
    );

    for (const b of bloques) {
      const el = document.getElementById(b);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, [bloques]);

  /*
   * Saltar no debe dejar rastro en el historial.
   *
   * Con el salto normal del navegador, cada toque apila una entrada y luego
   * "atrás" va deshaciendo saltos en vez de salir de la ficha. Se desplaza a
   * mano y se sustituye la entrada actual: el botón de volver sigue llevando
   * a donde estabas antes de entrar.
   */
  const saltar = (e: React.MouseEvent<HTMLAnchorElement>, b: Bloque) => {
    const destino = document.getElementById(b);
    if (!destino) return; // sin el bloque, que actúe el enlace de siempre
    e.preventDefault();
    destino.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${b}`);
    setActivo(b);
  };

  if (bloques.length < 2) return null;

  return (
    <nav
      aria-label="Secciones del equipo"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-panel shadow-[0_-6px_20px_rgba(16,24,12,0.10)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {bloques.map((b) => {
          const { texto, Icono } = ETIQUETAS[b];
          const esActivo = activo === b;
          return (
            <li key={b} className="flex-1">
              <a
                href={`#${b}`}
                onClick={(e) => saltar(e, b)}
                aria-current={esActivo ? "true" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors ${
                  esActivo ? "text-club" : "text-mute"
                }`}
              >
                <Icono size={21} />
                {texto}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
