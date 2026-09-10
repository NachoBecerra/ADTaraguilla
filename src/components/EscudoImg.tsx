import Image from "next/image";
import { IconoEscudo } from "@/components/Iconos";

/**
 * Pinta un escudo ya resuelto.
 *
 * Vive en su propio archivo, sin importar nada de la capa de datos, porque
 * también se usa desde componentes cliente y `competicion.ts` lee del sistema
 * de archivos: bastaría con importarlo para arrastrar `node:fs` al navegador.
 */

/**
 * Cuánto mide el disco respecto al escudo.
 *
 * Lo justo para que el cuadrado del escudo quede dentro del círculo salvo por
 * las cuatro esquinas, que es donde no hay nunca dibujo: solo margen. Más
 * grande y el escudo se vería flotando en una moneda; más pequeño y empezaría
 * a comerse el escudo por los lados.
 */
const HOLGURA = 1.28;

/**
 * El disco blanco de detrás, con el borde difuminado hacia fuera.
 *
 * De los 74 escudos que sirve la RFAF, 60 traen el fondo macizo —muchos son
 * JPEG, que ni siquiera sabe guardar transparencia— y sobre el verde del
 * directo se veían como un recuadro blanco recortado a tijera.
 *
 * **Un degradado por sí solo no lo arregla**, y merece la pena dejarlo escrito
 * porque parece que sí: la esquina de un cuadrado está un 41% más lejos del
 * centro que su lado, así que para que las esquinas cayeran dentro de la parte
 * opaca del degradado el disco tendría que ser más del doble de grande que el
 * escudo. Se vería una moneda enorme con un escudo diminuto en medio.
 *
 * Lo que sí funciona es recortar: el disco es blanco y opaco, recorta lo que
 * sobresale —solo esquinas de margen— y el fondo blanco del JPEG se funde con
 * él sin costura. Lo que se difumina es el **exterior** del disco, con un halo
 * que lo separa del verde sin línea dura.
 *
 * Blanco en los dos temas a propósito. Un disco oscuro en modo noche
 * devolvería el recuadro blanco al centro, que es justo lo que se venía a
 * arreglar.
 */
const HALO = "0 0 0 3px rgba(255,255,255,0.45), 0 0 9px 5px rgba(255,255,255,0.22)";

export default function EscudoImg({
  src,
  size = 32,
  halo = false,
  className = "",
}: {
  src?: string | null;
  size?: number;
  /** Disco blanco con el borde difuminado. Para el escudo que va sobre color. */
  halo?: boolean;
  className?: string;
}) {
  const escudo = !src ? (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center bg-panel-2 ${
        halo ? "rounded-full" : "rounded-md"
      } ${halo ? "" : className}`}
      style={{ width: size, height: size }}
    >
      <IconoEscudo size={Math.round(size * 0.6)} className="text-mute" />
    </span>
  ) : (
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
      className={`shrink-0 object-contain ${halo ? "" : className}`}
      style={{ width: size, height: size }}
    />
  );

  if (!halo) return escudo;

  const disco = Math.round(size * HOLGURA);
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-white ${className}`}
      style={{ width: disco, height: disco, boxShadow: HALO }}
    >
      {escudo}
    </span>
  );
}
