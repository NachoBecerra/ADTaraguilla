import Image from "next/image";
import { IconoEscudo } from "@/components/Iconos";

/**
 * Pinta un escudo ya resuelto.
 *
 * Vive en su propio archivo, sin importar nada de la capa de datos, porque
 * también se usa desde componentes cliente y `competicion.ts` lee del sistema
 * de archivos: bastaría con importarlo para arrastrar `node:fs` al navegador.
 */
export default function EscudoImg({
  src,
  size = 32,
  className = "",
}: {
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded-md bg-panel-2 ${className}`}
        style={{ width: size, height: size }}
      >
        <IconoEscudo size={Math.round(size * 0.6)} className="text-mute" />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
