"use client";

import { useEffect } from "react";

/**
 * Pone en marcha el service worker.
 *
 * Se registra después de cargar la página para no competir por la red con lo
 * que la persona ha venido a ver.
 */
export default function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin él la web funciona igual: solo se pierde la apertura rápida
      });
    };

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });

    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
