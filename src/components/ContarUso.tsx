"use client";

import { useEffect } from "react";

/**
 * Avisa una vez por sesión de si la web se está usando instalada o desde el
 * navegador, y en qué tipo de dispositivo.
 *
 * La analítica de Vercel ya cuenta lo demás. Esto cubre lo único que en el
 * plan gratuito no puede contar: cuánta gente la tiene instalada como
 * aplicación, que es el dato que decide si merece la pena mandar avisos.
 *
 * No manda nada que identifique a nadie: solo "app o navegador" y "iOS,
 * Android o escritorio".
 */

const YA_CONTADO = "uso-contado";

/** Hoy, en el huso de aquí: a las 00:00 empieza a contar de nuevo. */
function hoy(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

function plataforma(): string {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/mobile/i.test(ua)) return "otro";
  return "escritorio";
}

function instalada(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function ContarUso() {
  useEffect(() => {
    /*
     * El panel es trabajo del club, no audiencia: quien sube fotos no debe
     * inflar las visitas que algún día se le enseñen a un anunciante.
     */
    if (window.location.pathname.startsWith("/panel")) return;

    /*
     * Una vez por dispositivo y día.
     *
     * Antes era una vez por sesión, y en la aplicación instalada cerrarla y
     * abrirla empieza sesión nueva: una tarde de pruebas sumaba diez visitas
     * de la misma persona.
     */
    const dia = hoy();
    try {
      if (localStorage.getItem(YA_CONTADO) === dia) return;
      localStorage.setItem(YA_CONTADO, dia);
    } catch {
      // Sin almacenamiento (modo privado) se contará de más: mejor que nada
    }

    // Sin bloquear la carga: esto no le corre prisa a nadie
    const enviar = () => {
      fetch("/api/uso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: instalada() ? "app" : "navegador",
          plataforma: plataforma(),
        }),
        keepalive: true,
      }).catch(() => {
        // Que falle el recuento no debe notarse en la web
      });
    };

    const reloj = setTimeout(enviar, 2500);
    return () => clearTimeout(reloj);
  }, []);

  return null;
}
