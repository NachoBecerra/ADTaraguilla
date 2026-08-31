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
      /*
       * Sin esto Next solo ofrece el escudo a 1x y 2x, y en un móvil de 3x
       * se ve blando. Diciéndole a qué tamaño se pinta, el navegador puede
       * pedir el triple de píxeles; si el original no da para tanto, el
       * optimizador devuelve lo que haya y no pasa nada.
       */
      sizes={`${size}px`}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
