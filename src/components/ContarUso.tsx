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
    // Una vez por sesión: abrir cinco páginas seguidas es una visita, no cinco
    try {
      if (sessionStorage.getItem(YA_CONTADO)) return;
      sessionStorage.setItem(YA_CONTADO, "1");
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
