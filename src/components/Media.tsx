import Image from "next/image";
import { IconoImagen } from "@/components/Iconos";

/**
 * Imagen recortada al hueco (object-cover) con marcador de posición.
 *
 * No importa nada de la capa de datos a propósito: la usan componentes
 * cliente, y `@/lib/imagenes` lee del sistema de archivos.
 *
 * Si `src` está vacío (aún no hay foto subida) pinta un bloque con los
 * colores del club en lugar de romper el diseño.
 */
export default function Media({
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
        className={`grid place-items-center bg-linear-to-br from-club/15 via-panel-2 to-linea ${className}`}
        role="img"
        aria-label={alt}
      >
        <IconoImagen size={30} className="text-club/35" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${className}`}
    />
  );
}
