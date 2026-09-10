import Image from "next/image";
import { IconoEscudo } from "@/components/Iconos";
import formasJson from "@/data/rfaf/formas.json";

/**
 * Pinta un escudo ya resuelto.
 *
 * Vive en su propio archivo, sin importar nada de la capa de datos, porque
 * también se usa desde componentes cliente y `competicion.ts` lee del sistema
 * de archivos: bastaría con importarlo para arrastrar `node:fs` al navegador.
 * Lo de las formas sí puede entrar: es un JSON pelado.
 */

/** Cuánto mide el disco blanco respecto al escudo. */
const HOLGURA = 1.28;

/**
 * Hasta dónde llega el dibujo de cada escudo, medido de sus píxeles.
 *
 * En anchos de caja: 0,5 es un dibujo que toca el borde por el lado y 0,707
 * uno que llega a las esquinas. Lo escribe `scripts/rfaf/medirEscudos.mjs`.
 */
const FORMAS: Record<string, number> = formasJson.formas;

/**
 * Tope de agrandado.
 *
 * Un escudo diminuto en medio de un lienzo enorme no se puede estirar sin
 * límite: saldría emborronado. Con los escudos de hoy no llega a aplicarse
 * ninguno —el que más se agranda va a 1,51— pero mañana puede aparecer uno.
 */
const TOPE = 1.6;

/**
 * A qué tamaño se pinta un escudo para que **su dibujo** llene el disco.
 *
 * Aquí está el arreglo de un defecto que se veía y costaba explicar: dos
 * escudos pintados al mismo tamaño se leían distintos. Uno con fondo macizo
 * toma prestado el disco blanco como fondo propio y llega hasta el borde;
 * uno recortado, con el fondo transparente, deja blanco alrededor y parece
 * más pequeño. El del club salía un 21% más chico que el del rival sin que
 * nadie hubiera decidido eso.
 *
 * Sabiendo de cada escudo dónde acaba su dibujo, cada uno se agranda —o se
 * encoge— lo justo para tocar el borde del disco. Lo que sobresale es fondo, y
 * el disco lo recorta: sobre blanco, invisible.
 *
 * Sin medida no se toca nada. Pasa con los escudos que sube el club a mano y
 * con un rival nuevo hasta que se pase el medidor.
 */
function escalaDe(src: string): number {
  const radio = FORMAS[src];
  if (!radio) return 1;
  return Math.min(TOPE, HOLGURA / (2 * radio));
}

/**
 * El disco blanco de detrás, con el borde difuminado hacia fuera.
 *
 * De los 74 escudos que sirve la RFAF, 60 traen el fondo macizo —muchos son
 * JPEG, que ni siquiera sabe guardar transparencia— y sobre el verde del
 * directo se veían como un recuadro blanco recortado a tijera. El disco los
 * absorbe: su fondo se funde con él y lo que sobresale se recorta.
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
  /* El agrandado solo tiene sentido con disco: es él quien recorta lo que
     sobresale. Suelto, un escudo estirado se saldría de su sitio */
  const lado = halo && src ? Math.round(size * escalaDe(src)) : size;

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
      width={lado}
      height={lado}
      /*
       * Sin esto Next solo ofrece el escudo a 1x y 2x, y en un móvil de 3x
       * se ve blando. Diciéndole a qué tamaño se pinta, el navegador puede
       * pedir el triple de píxeles; si el original no da para tanto, el
       * optimizador devuelve lo que haya y no pasa nada.
       */
      sizes={`${lado}px`}
      className={`shrink-0 object-contain ${halo ? "max-w-none" : className}`}
      style={{ width: lado, height: lado }}
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
