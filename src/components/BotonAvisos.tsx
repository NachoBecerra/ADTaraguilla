"use client";

import { useEffect, useState } from "react";
import { IconoCampana, IconoCampanaTachada } from "@/components/Iconos";
import { guardarEquipos } from "@/components/IndicadorAvisos";

/**
 * Activa o desactiva los avisos de un equipo.
 *
 * Va en la ficha del equipo a propósito: elegir a quién seguir es simplemente
 * estar en su página y pulsar. No hay registro ni contraseña, porque la
 * suscripción que genera el navegador ya identifica al dispositivo.
 *
 * Se pueden seguir tantos equipos como se quiera: quien sigue a uno recibe un
 * aviso por semana y quien los sigue todos, seis. Es decisión de cada cual.
 */

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

type Estado = "cargando" | "no-disponible" | "hace-falta-instalar" | "off" | "on";

/** Pregunta al servidor qué equipos sigue este dispositivo. */
async function equiposDelServidor(endpoint: string): Promise<string[]> {
  const r = await fetch("/api/avisos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion: "consulta", endpoint }),
  });
  if (!r.ok) return [];
  const { equipos } = (await r.json()) as { equipos?: string[] };
  return equipos ?? [];
}

/**
 * En qué situación está este dispositivo. Devuelve el estado en vez de irlo
 * escribiendo, para que el componente lo aplique de una sola vez.
 *
 * La lista la manda el servidor, no el navegador: si alguien limpia los datos
 * del navegador, al volver sigue viendo lo que tenía activado.
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

    const equipos = await equiposDelServidor(suscripcion.endpoint);
    guardarEquipos(equipos);
    return equipos.includes(equipo) ? "on" : "off";
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

  async function cambiar(accion: "alta" | "baja") {
    setOcupado(true);
    setError(null);
    try {
      if (accion === "alta" && Notification.permission !== "granted") {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          setEstado("no-disponible");
          return;
        }
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
        body: JSON.stringify({ accion, endpoint: datos.endpoint, keys: datos.keys, equipo }),
      });
      if (!r.ok) throw new Error("no se pudo guardar");

      const { equipos } = (await r.json()) as { equipos: string[] };
      guardarEquipos(equipos);

      // Sin ningún equipo ya no hay a quién avisar: se suelta la suscripción
      if (equipos.length === 0) await suscripcion.unsubscribe();

      setEstado(equipos.includes(equipo) ? "on" : "off");
    } catch {
      setError("No ha podido cambiarse. Inténtalo de nuevo.");
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

  const activo = estado === "on";

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => cambiar(activo ? "baja" : "alta")}
        disabled={ocupado}
        className={`btn ${activo ? "btn-ghost" : "btn-primary"} disabled:opacity-50`}
      >
        {activo ? <IconoCampanaTachada size={17} /> : <IconoCampana size={17} />}
        {ocupado
          ? "Un momento…"
          : activo
            ? "Desactivar notificaciones"
            : "Activar notificaciones"}
      </button>

      {/* El nombre del equipo va aquí, no en el botón: ahí lo alargaba de más */}
      <p className="mt-2 text-xs text-mute">
        {activo
          ? `Recibes el resultado y la hora de cada partido de ${nombre}.`
          : `Un aviso cuando se publique el resultado de ${nombre}, y otro cuando le pongan hora al partido.`}
      </p>

      {error ? <p className="mt-2 text-xs font-semibold text-club">{error}</p> : null}
    </div>
  );
}
