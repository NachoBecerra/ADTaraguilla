"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { site } from "@/data/site";
import { IconoCerrar, IconoDescarga, IconoCompartir } from "@/components/Iconos";

/**
 * Ofrece instalar la web como aplicación del móvil.
 *
 * Cada sistema lo hace a su manera:
 *
 * - Android y escritorio avisan con `beforeinstallprompt` cuando la web cumple
 *   los requisitos, y entonces se puede abrir el diálogo del sistema con un
 *   botón. Ese evento solo sirve una vez.
 * - iPhone no tiene nada parecido: hay que explicarle a la persona que use
 *   Compartir → Añadir a pantalla de inicio.
 *
 * No se enseña a quien ya la tiene instalada (la app se abre en modo
 * `standalone`), ni en ordenador, ni a quien ya dijo que no.
 */

const CLAVE = "aviso-instalar-descartado";
/** Si lo descarta, no se le vuelve a ofrecer en un mes. */
const DIAS_DE_TREGUA = 30;
/** Un aviso nada más entrar molesta; se espera a que esté leyendo. */
const ESPERA_MS = 4000;

type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** localStorage puede fallar (modo privado); nunca debe tumbar el aviso. */
function loDescarto(): boolean {
  try {
    const cuando = Number(localStorage.getItem(CLAVE));
    if (!cuando) return false;
    return Date.now() - cuando < DIAS_DE_TREGUA * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function apuntarDescarte() {
  try {
    localStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // Sin almacenamiento se le volverá a ofrecer otro día: molesto, no grave
  }
}

/** iPadOS se presenta como un Mac, así que se mira también si hay pantalla táctil. */
function esIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** Ya instalada: la app arranca sin barra de direcciones. */
function yaInstalada(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // Safari en iPhone no implementa display-mode y usa esto otro
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function AvisoInstalar() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [modoIOS, setModoIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (yaInstalada() || loDescarto()) return;

    // Solo en móvil: en el ordenador no aporta nada
    const enMovil = window.matchMedia("(max-width: 820px)").matches;
    if (!enMovil) return;

    const alPoderInstalar = (e: Event) => {
      // Sin esto, Chrome enseña su propia barra además de la nuestra
      e.preventDefault();
      setEvento(e as EventoInstalacion);
      setVisible(true);
    };

    const alInstalar = () => setVisible(false);

    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);

    // En iPhone ese evento no llega nunca: se enseñan las instrucciones
    let reloj: ReturnType<typeof setTimeout> | undefined;
    if (esIOS()) {
      reloj = setTimeout(() => {
        setModoIOS(true);
        setVisible(true);
      }, ESPERA_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
      if (reloj) clearTimeout(reloj);
    };
  }, []);

  if (!visible) return null;

  const cerrar = () => {
    apuntarDescarte();
    setVisible(false);
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    // El evento no se puede reutilizar, así que el aviso se retira
    setEvento(null);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Instalar la aplicación"
      className="fixed inset-x-3 bottom-3 z-80 rounded-2xl border border-club-soft/40 bg-club-dark/97 p-4 text-white shadow-2xl backdrop-blur-sm"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        <Image
          src={site.escudo}
          alt=""
          width={843}
          height={836}
          sizes="44px"
          className="h-11 w-auto shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="title text-base leading-tight">Instala {site.nombre}</p>

          {modoIOS ? (
            <p className="mt-1 text-sm leading-snug text-white/85">
              Pulsa <IconoCompartir size={14} className="inline align-text-bottom" />{" "}
              Compartir y luego «Añadir a pantalla de inicio».
            </p>
          ) : (
            <p className="mt-1 text-sm leading-snug text-white/85">
              Tenla en la pantalla de inicio y entra de un toque, sin buscarla.
            </p>
          )}

          {!modoIOS ? (
            <button
              type="button"
              onClick={instalar}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-club transition-transform active:scale-95"
            >
              <IconoDescarga size={16} />
              Instalar
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={cerrar}
          aria-label="Ahora no"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/25 text-white"
        >
          <IconoCerrar size={14} />
        </button>
      </div>
    </div>
  );
}
