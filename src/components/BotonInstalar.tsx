"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { IconoDescarga } from "@/components/Iconos";

/**
 * Botón de instalar, siempre a la vista en la cabecera.
 *
 * El aviso de abajo sale una vez, se cierra y no vuelve en un mes; quien lo
 * descartó sin leerlo se quedaba sin manera de instalar la aplicación, y la
 * web está pensada para usarse desde el móvil, no desde el escritorio. Esto no
 * se cierra ni se esconde: está mientras no esté instalada.
 *
 * Donde el navegador ofrece instalar solo (Android, escritorio) abre su
 * diálogo. Donde no —el iPhone es el caso— lleva a /instalar, que cuenta los
 * pasos. Nunca se queda sin hacer nada.
 *
 * Desaparece en cuanto la aplicación está instalada: ahí ya sobra.
 */

type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Ya instalada: la aplicación arranca sin barra de direcciones. */
function instalada(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // Safari en iPhone no implementa display-mode y usa esto otro
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/* Como todo lo que solo sabe el navegador: en el servidor se pinta vacío, y
   así el HTML del servidor y el del navegador no se contradicen */
const sinSuscripcion = () => () => {};

export default function BotonInstalar() {
  const yaEsta = useSyncExternalStore(sinSuscripcion, instalada, () => true);
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [instalando, setInstalando] = useState(false);

  useEffect(() => {
    const alPoderInstalar = (e: Event) => {
      // Sin esto, Chrome enseña además su propia barra
      e.preventDefault();
      setEvento(e as EventoInstalacion);
    };

    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    return () => window.removeEventListener("beforeinstallprompt", alPoderInstalar);
  }, []);

  if (yaEsta) return null;

  const clases =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-club px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-club-dark active:scale-95 sm:px-4 sm:text-sm";

  if (evento) {
    return (
      <button
        type="button"
        disabled={instalando}
        onClick={async () => {
          setInstalando(true);
          try {
            await evento.prompt();
            await evento.userChoice;
            // El evento no se puede reutilizar
            setEvento(null);
          } finally {
            setInstalando(false);
          }
        }}
        className={clases}
      >
        <IconoDescarga size={16} />
        Instalar app
      </button>
    );
  }

  return (
    <Link href="/instalar" className={clases}>
      <IconoDescarga size={16} />
      Instalar app
    </Link>
  );
}
