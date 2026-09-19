"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { site } from "@/data/site";
import { useEntorno } from "@/lib/usarEntorno";
import { IconoCerrar, IconoDescarga, IconoFlecha } from "@/components/Iconos";

/**
 * Ofrece instalar la web como aplicación del móvil.
 *
 * Cada sitio lo hace a su manera:
 *
 * - Android y escritorio avisan con `beforeinstallprompt` cuando la web cumple
 *   los requisitos, y entonces se abre el diálogo del sistema con un botón. Ese
 *   evento solo sirve una vez.
 * - iPhone no tiene nada parecido: hay que explicar Compartir → «Añadir a
 *   pantalla de inicio», y eso no cabe en un aviso.
 * - Dentro de Instagram o Facebook no se puede instalar de ninguna manera, y
 *   ahí es donde se perdía la gente: el aviso mandaba pulsar Compartir y esa
 *   opción no existe en el navegador de esas apps.
 *
 * Así que el aviso ya no intenta explicar nada: dice lo justo y lleva a
 * /instalar, que sí tiene sitio para los pasos.
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

/** Ya instalada: la app arranca sin barra de direcciones. */
function yaInstalada(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // Safari en iPhone no implementa display-mode y usa esto otro
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function AvisoInstalar() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null);
  const [visible, setVisible] = useState(false);
  const entorno = useEntorno();

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

    /*
     * Donde no hay diálogo del sistema —el iPhone, y cualquier navegador
     * metido dentro de otra app— el aviso sale solo, pasado un rato.
     */
    let reloj: ReturnType<typeof setTimeout> | undefined;
    if (entorno && entorno.donde !== "navegador-android" && entorno.donde !== "otro") {
      reloj = setTimeout(() => setVisible(true), ESPERA_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
      if (reloj) clearTimeout(reloj);
    };
  }, [entorno]);

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

  /* Dentro de Instagram o Facebook lo primero no es instalar, es salir de ahí */
  const atrapado = entorno?.donde === "dentro-de-una-app";

  const frase = atrapado
    ? `Estás dentro de ${entorno?.app}. Para tenerla en la pantalla de inicio hay que abrirla fuera.`
    : evento
      ? "Tenla en la pantalla de inicio y entra de un toque, sin buscarla."
      : "Se añade a la pantalla de inicio en cuatro toques. Te contamos cómo.";

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
          <p className="title text-base leading-tight">
            {atrapado ? "Ábrela fuera para instalarla" : `Instala ${site.nombre}`}
          </p>
          <p className="mt-1 text-sm leading-snug text-white/85">{frase}</p>

          {evento && !atrapado ? (
            <button
              type="button"
              onClick={instalar}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-club transition-transform active:scale-95"
            >
              <IconoDescarga size={16} />
              Instalar
            </button>
          ) : (
            <Link
              href="/instalar"
              onClick={() => setVisible(false)}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-club transition-transform active:scale-95"
            >
              Ver cómo se hace
              <IconoFlecha size={15} />
            </Link>
          )}
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
