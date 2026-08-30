import Image from "next/image";
import { dimensionesOPorDefecto } from "@/lib/imagenes";
import { IconoImagen } from "@/components/Iconos";

/**
 * Imagen entera, con su proporción real y sin recortar.
 *
 * Las fotos del club son de todo tipo —verticales del móvil, cuadradas,
 * apaisadas— y forzarlas a un marco fijo cortaba caras. Aquí el hueco se
 * adapta a la foto, no al revés. Al conocer las dimensiones de antemano la
 * página no da saltos mientras carga.
 */
export default function MediaCompleta({
  src,
  alt,
  className = "",
  sizes = "100vw",
  priority = false,
}: {
  src?: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div
        className={`grid aspect-4/3 w-full place-items-center rounded-xl bg-linear-to-br from-club/15 via-panel-2 to-linea ${className}`}
        role="img"
        aria-label={alt}
      >
        <IconoImagen size={30} className="text-club/35" />
      </div>
    );
  }

  const { ancho, alto } = dimensionesOPorDefecto(src);

  return (
    <Image
      src={src}
      alt={alt}
      width={ancho}
      height={alto}
      sizes={sizes}
      priority={priority}
      className={`h-auto w-full ${className}`}
    />
  );
}
