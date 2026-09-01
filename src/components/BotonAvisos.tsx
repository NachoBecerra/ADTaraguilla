"use client";

import { useEffect, useState } from "react";
import { IconoCampana, IconoCampanaTachada } from "@/components/Iconos";

/**
 * Activa los avisos de un equipo.
 *
 * Va en la ficha del equipo a propósito: así elegir equipo favorito es
 * simplemente estar en su página y pulsar. No hay lista que rellenar ni
 * registro que hacer — la suscripción del navegador ya identifica al
 * dispositivo.
 *
 * Solo se puede seguir a un equipo: es lo que mantiene los avisos en dos por
 * semana en vez de quince.
 */

const CLAVE = "avisos-equipo";

/** La clave pública viaja al navegador; la privada nunca sale del servidor. */
const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_CLAVE_PUBLICA;

/** El navegador quiere la clave en bytes, no en texto. */
function aBytes(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const limpio = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = window.atob(limpio);
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

function esIOS(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function instalada(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

type Estado = "cargando" | "no-disponible" | "hace-falta-instalar" | "off" | "otro" | "on";

/**
 * En qué situación está este dispositivo. Devuelve el estado en vez de irlo
 * escribiendo, para que el componente lo aplique de una sola vez.
 */
async function calcularEstado(equipo: string): Promise<Estado> {
  try {
    if (!CLAVE_PUBLICA || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      // En iPhone, Push solo existe si la web está instalada
      return esIOS() && !instalada() ? "hace-falta-instalar" : "no-disponible";
    }
    if (Notification.permission === "denied") return "no-disponible";

    const registro = await navigator.serviceWorker.ready;
    const suscripcion = await registro.pushManager.getSubscription();
    if (!suscripcion) return "off";

    let elegido: string | null = null;
    try {
      elegido = localStorage.getItem(CLAVE);
    } catch {
      // Sin almacenamiento no se sabe cuál eligió: se ofrece cambiarlo
    }
    return elegido === equipo ? "on" : "otro";
  } catch {
    return "no-disponible";
  }
}

export default function BotonAvisos({
  equipo,
  nombre,
}: {
  equipo: string;
  nombre: string;
}) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void calcularEstado(equipo).then((nuevo) => {
      if (vivo) setEstado(nuevo);
    });
    return () => {
      vivo = false;
    };
  }, [equipo]);

  async function activar() {
    setOcupado(true);
    setError(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado("no-disponible");
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const suscripcion =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: aBytes(CLAVE_PUBLICA as string),
        }));

      const datos = suscripcion.toJSON();
      const r = await fetch("/api/avisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: datos.endpoint, keys: datos.keys, equipo }),
      });
      if (!r.ok) throw new Error("no se pudo guardar");

      try {
        localStorage.setItem(CLAVE, equipo);
      } catch {
        // El aviso funcionará igual; solo se pierde saber cuál se eligió
      }
      setEstado("on");
    } catch {
      setError("No se han podido activar. Inténtalo de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    setOcupado(true);
    setError(null);
    try {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();
      if (suscripcion) {
        await fetch("/api/avisos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: suscripcion.endpoint }),
        });
        await suscripcion.unsubscribe();
      }
      try {
        localStorage.removeItem(CLAVE);
      } catch {
        // Da igual: el estado se recalcula al volver
      }
      setEstado("off");
    } catch {
      setError("No se han podido desactivar.");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "cargando" || estado === "no-disponible") return null;

  if (estado === "hace-falta-instalar") {
    return (
      <p className="mt-4 text-sm text-mute">
        Para recibir avisos de {nombre} en el iPhone, primero añade la web a la
        pantalla de inicio.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {estado === "on" ? (
        <button
          type="button"
          onClick={desactivar}
          disabled={ocupado}
          className="btn btn-ghost disabled:opacity-50"
        >
          <IconoCampanaTachada size={17} />
          {ocupado ? "Un momento…" : "Dejar de recibir avisos"}
        </button>
      ) : (
        <button
          type="button"
          onClick={activar}
          disabled={ocupado}
          className="btn btn-primary disabled:opacity-50"
        >
          <IconoCampana size={17} />
          {ocupado
            ? "Un momento…"
            : estado === "otro"
              ? `Avisarme de ${nombre} en su lugar`
              : `Avisarme de ${nombre}`}
        </button>
      )}

      <p className="mt-2 text-xs text-mute">
        {estado === "on"
          ? "Recibirás el resultado y la hora de cada partido de este equipo."
          : "Un aviso cuando se publique el resultado, y otro cuando le pongan hora al partido."}
      </p>

      {error ? <p className="mt-2 text-xs font-semibold text-club">{error}</p> : null}
    </div>
  );
}
