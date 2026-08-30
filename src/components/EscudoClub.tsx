import { escudoDe } from "@/lib/competicion";
import { site } from "@/data/site";
import EscudoImg from "@/components/EscudoImg";

/**
 * Escudo de un club, buscándolo por código o por nombre entre los que sirve la
 * CDN de la RFAF. Solo para componentes de servidor; en los de cliente se usa
 * EscudoImg directamente, con la URL ya resuelta.
 */
export default function EscudoClub({
  nombre,
  codigo,
  size = 32,
  esNuestro = false,
  className = "",
}: {
  nombre?: string | null;
  codigo?: string | null;
  size?: number;
  /** Usa el escudo local del club, de mejor calidad que el de la RFAF. */
  esNuestro?: boolean;
  className?: string;
}) {
  const src = esNuestro ? site.escudo : escudoDe({ codigo, nombre });
  return <EscudoImg src={src} size={size} className={className} />;
}
