"use client";

import { useState } from "react";
import { comoSalirDeLaApp } from "@/lib/instalar";
import { useEntorno } from "@/lib/usarEntorno";
import { site } from "@/data/site";
import { IconoCompartir, IconoEnlaceExterno } from "@/components/Iconos";

/**
 * El recuadro de arriba de la página de instalación: qué le toca hacer a quien
 * está leyendo, según desde dónde mire.
 *
 * Los pasos de iPhone y de Android están en la página, escritos siempre. Esto
 * solo señala cuál de los dos le sirve, y avisa del caso que trae las quejas:
 * dentro de Instagram o Facebook no se puede instalar y hay que salir antes.
 *
 * Se pinta después de cargar, porque al compilar no se sabe quién mira. En el
 * servidor no ocupa nada.
 */
export default function DondeEstas() {
  const entorno = useEntorno();
  const [copiado, setCopiado] = useState(false);

  if (!entorno) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(site.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Sin permiso para copiar: la dirección está escrita al lado
    }
  };

  /* ---------------------------------------- dentro de Instagram o Facebook */
  if (entorno.donde === "dentro-de-una-app") {
    return (
      <div className="rounded-2xl border border-aviso-linea bg-aviso p-4 text-aviso-tinta">
        <p className="title text-lg leading-tight">Antes de nada, sal de {entorno.app}</p>
        <p className="mt-2 text-sm leading-relaxed">
          {comoSalirDeLaApp(entorno.app, entorno.sistema)}
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          Si no encuentras esa opción, copia la dirección y pégala tú en{" "}
          {entorno.sistema === "ios" ? "Safari" : "Chrome"}:
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-2 rounded-full bg-aviso-fuerte px-4 py-2 text-sm font-bold text-white transition-transform active:scale-95"
          >
            <IconoCompartir size={15} />
            {copiado ? "¡Copiada!" : "Copiar la dirección"}
          </button>
          <code className="text-sm font-bold">{site.url.replace("https://", "")}</code>
        </div>
      </div>
    );
  }

  /* ------------------------------------------- otro navegador en el iPhone */
  if (entorno.donde === "otro-navegador-ios") {
    return (
      <div className="rounded-2xl border border-aviso-linea bg-aviso p-4 text-aviso-tinta">
        <p className="title text-lg leading-tight">Ábrelo en Safari</p>
        <p className="mt-2 text-sm leading-relaxed">
          En el iPhone y el iPad, la pantalla de inicio solo se puede añadir desde Safari.
          Abre Safari, escribe <strong>{site.url.replace("https://", "")}</strong> y sigue los
          pasos de aquí abajo.
        </p>
        <button
          type="button"
          onClick={copiar}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-aviso-fuerte px-4 py-2 text-sm font-bold text-white transition-transform active:scale-95"
        >
          <IconoCompartir size={15} />
          {copiado ? "¡Copiada!" : "Copiar la dirección"}
        </button>
      </div>
    );
  }

  /* ------------------------------------------------- donde sí se puede ya */
  const enIOS = entorno.sistema === "ios";
  if (enIOS || entorno.sistema === "android") {
    return (
      <div className="rounded-2xl border border-club-soft/30 bg-panel-2 p-4">
        <p className="title text-lg leading-tight text-tinta">
          Estás en {enIOS ? "Safari" : "Android"}: puedes instalarla ahora
        </p>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          Sigue los pasos {enIOS ? "de iPhone y iPad" : "de Android"}, aquí abajo. Son cuatro
          toques y no ocupa casi nada.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-linea bg-panel-2 p-4">
      <p className="title text-lg leading-tight text-tinta">Esto es para el móvil</p>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm leading-relaxed text-mute">
        Estás en un ordenador. Abre <strong>{site.url.replace("https://", "")}</strong> en el
        móvil para tener el escudo en la pantalla de inicio.
        <IconoEnlaceExterno size={14} className="shrink-0" />
      </p>
    </div>
  );
}
