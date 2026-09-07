"use client";

import Link from "next/link";
import { useTieneRetransmision } from "@/lib/directo/archivo";
import { IconoPlay } from "@/components/Iconos";

/**
 * Enlace a la retransmisión de un partido ya jugado, si la hubo.
 *
 * Es lo único de la tarjeta de resultado que no se sabe al compilar, así que
 * lo pregunta el navegador. Mientras no conteste —o si el partido no se
 * retransmitió— no ocupa nada.
 */
export default function EnlaceRetransmision({
  equipo,
  fecha,
  className = "",
}: {
  equipo: string;
  fecha: string | null;
  className?: string;
}) {
  const hay = useTieneRetransmision(equipo, fecha);
  if (!hay) return null;

  return (
    <Link
      href={`/directo/${equipo}-${fecha}`}
      className={className}
      title="Cómo se contó el partido, minuto a minuto"
    >
      <IconoPlay size={13} className="shrink-0" />
      Directo
    </Link>
  );
}
