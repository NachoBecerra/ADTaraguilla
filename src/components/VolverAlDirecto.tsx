"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { IconoFlecha } from "@/components/Iconos";

/**
 * El atajo de vuelta a la retransmisión que se está escribiendo.
 *
 * Existe por algo que solo se ve en el campo: al bloquearse el móvil para
 * ahorrar batería, el sistema acaba cerrando la aplicación. Al volver a abrirla
 * desde el icono arranca en la portada —el `start_url` del manifiesto— y quien
 * está apuntando el partido tenía que entrar al panel, buscar el partido,
 * generar el enlace y abrirlo otra vez. Cinco pasos con el partido en marcha.
 *
 * Así que el móvil que abre la botonera se guarda el enlace, y durante unas
 * horas aparece un aviso arriba de cualquier página para volver de un toque.
 *
 * **Solo lo ve ese navegador.** Lo guardado vive en su `localStorage`: no sale
 * del dispositivo, no viaja al servidor y no está en el HTML de ninguna página.
 * Un visitante cualquiera no ve nada, y quien lo escribió no lo ve en su otro
 * navegador. Conviene tenerlo claro porque el aviso habla de retransmitir, y
 * visto sin contexto asusta.
 */

const CLAVE = "directo-mando";

/**
 * Cuánto se sigue ofreciendo el atajo desde que se abrió la botonera.
 *
 * No basta con que el enlace siga valiendo: un enlace vale hasta cuatro horas
 * después del saque, y el club los prepara días antes, así que uno generado el
 * jueves para el sábado vale casi dos días. Con esa sola condición, el aviso se
 * quedaba dos días en la pantalla de quien hubiera abierto la botonera una vez.
 *
 * El atajo sirve para volver al partido que se está retransmitiendo, y eso dura
 * una tarde: el desplazamiento, el partido y la vuelta.
 */
const VENTANA_MS = 6 * 60 * 60_000;

type Mando = {
  id: string;
  token: string;
  /** Cuándo se abrió la botonera, en milisegundos. */
  desde: number;
};

/**
 * Hasta cuándo vale el enlace, leído del propio token.
 *
 * El token empieza por su caducidad en milisegundos, así que el navegador puede
 * saber si sigue sirviendo sin preguntar nada. La firma la comprueba el
 * servidor: aquí solo se mira la fecha para no ofrecer un atajo muerto.
 */
function caduca(token: string): number {
  const corte = token.indexOf(".");
  const ms = Number(token.slice(0, corte < 0 ? 0 : corte));
  return Number.isFinite(ms) ? ms : 0;
}

/** Guarda el mando de este partido. Lo llama la botonera al abrirse. */
export function recordarMando(id: string, token: string): void {
  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ id, token, desde: Date.now() } satisfies Mando),
    );
  } catch {
    // Sin almacenamiento se pierde el atajo, no la retransmisión
  }
}

/**
 * Lo guardado, o null si no hay, no se entiende o ya no vale.
 *
 * Tienen que cumplirse las dos cosas: que el enlace siga sirviendo y que la
 * botonera se abriera hace poco. Lo guardado sin `desde` es de antes de que
 * existiera esta ventana y se da por caducado, que es justo lo que hay que
 * hacer con ello.
 */
function leerMando(crudo: string | null): Mando | null {
  if (!crudo) return null;
  try {
    const leido = JSON.parse(crudo) as Mando;
    if (!leido?.id || !leido?.token) return null;
    if (typeof leido.desde !== "number") return null;
    if (Date.now() - leido.desde > VENTANA_MS) return null;
    return caduca(leido.token) < Date.now() ? null : leido;
  } catch {
    return null;
  }
}

export default function VolverAlDirecto() {
  const ruta = usePathname();

  /*
   * Lo guardado en el navegador no existe al renderizar en el servidor. Se lee
   * así —y no en un efecto— para que la primera pintada del servidor y la del
   * navegador coincidan: en el servidor vale null y no cambia nunca después.
   * Se devuelve la cadena tal cual, que es estable; el objeto se arma aparte,
   * porque uno nuevo en cada lectura haría repintar sin fin.
   */
  const crudo = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(CLAVE);
      } catch {
        return null;
      }
    },
    () => null,
  );

  const mando = useMemo(() => leerMando(crudo), [crudo]);

  /* Un atajo que ya no lleva a ningún sitio es peor que ninguno: se tira */
  useEffect(() => {
    if (crudo && !mando) {
      try {
        localStorage.removeItem(CLAVE);
      } catch {
        // Si no se puede limpiar, tampoco se enseña: no molesta a nadie
      }
    }
  }, [crudo, mando]);

  // Estando ya en la botonera de ese partido, el atajo sobra
  if (!mando || ruta?.startsWith(`/directo/${mando.id}/escribir`)) return null;

  return (
    <div className="border-b border-club-dark bg-club">
      <Link
        href={`/directo/${mando.id}/escribir?t=${encodeURIComponent(mando.token)}`}
        className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3 text-white"
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-club-claro"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-club-claro">
            Estás retransmitiendo
          </span>
          <span className="block truncate text-sm font-bold">
            Volver a apuntar el partido
          </span>
        </span>
        <IconoFlecha size={17} className="shrink-0" />
      </Link>
    </div>
  );
}
