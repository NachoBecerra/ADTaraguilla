"use client";

import { useState, useSyncExternalStore } from "react";
import {
  IconoWhatsApp,
  IconoX,
  IconoFacebook,
  IconoDescarga,
  IconoEnlaceExterno,
} from "@/components/Iconos";

/**
 * Botones de compartir de una noticia.
 *
 * Instagram no tiene dirección de compartir como WhatsApp o Facebook: no se
 * puede rellenar una publicación desde la web. Lo que sí funciona es el menú
 * del propio móvil, donde Instagram aparece con el resto de apps. Y como allí
 * los enlaces no son clicables, se comparte la foto de la noticia en vez del
 * enlace cuando el navegador lo permite.
 */
export default function Compartir({
  titulo,
  resumen,
  url,
  portada,
}: {
  titulo: string;
  resumen: string;
  url: string;
  portada?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // Si hay menú de compartir solo se sabe en el navegador. Con
  // useSyncExternalStore se lee sin desajustar la primera pintada: en el
  // servidor vale false y no cambia nunca después.
  const hayMenuNativo = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== "undefined" && !!navigator.share,
    () => false,
  );

  const texto = `${titulo}${resumen ? ` — ${resumen}` : ""}`;

  async function compartir() {
    setOcupado(true);
    try {
      // Con foto: es lo que Instagram sabe publicar
      if (portada) {
        try {
          const respuesta = await fetch(portada);
          const blob = await respuesta.blob();
          const archivo = new File([blob], `${titulo}.jpg`, { type: blob.type });

          if (navigator.canShare?.({ files: [archivo] })) {
            await navigator.share({ files: [archivo], title: titulo, text: texto });
            return;
          }
        } catch {
          // Si la foto no se puede compartir, se comparte el enlace y ya
        }
      }
      await navigator.share({ title: titulo, text: texto, url });
    } catch {
      // El usuario ha cancelado el menú: no hay nada que avisar
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  const directos = [
    {
      id: "wa",
      nombre: "WhatsApp",
      Icono: IconoWhatsApp,
      href: `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`,
    },
    {
      id: "fb",
      nombre: "Facebook",
      Icono: IconoFacebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      id: "x",
      nombre: "X",
      Icono: IconoX,
      href: `https://x.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(url)}`,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {hayMenuNativo ? (
        <button
          type="button"
          onClick={compartir}
          disabled={ocupado}
          className="btn btn-primary px-4 py-2.5 text-sm"
        >
          <IconoDescarga size={17} className="rotate-180" />
          {ocupado ? "Preparando…" : "Compartir"}
        </button>
      ) : null}

      {directos.map(({ id, nombre, Icono, href }) => (
        <a
          key={id}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost px-4 py-2.5 text-sm"
        >
          <Icono size={18} />
          {nombre}
        </a>
      ))}

      <button type="button" onClick={copiar} className="btn btn-ghost px-4 py-2.5 text-sm">
        <IconoEnlaceExterno size={16} />
        {copiado ? "Enlace copiado" : "Copiar enlace"}
      </button>
    </div>
  );
}
