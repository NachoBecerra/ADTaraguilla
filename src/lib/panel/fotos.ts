import { upload } from "@vercel/blob/client";
/* El mismo que usa el servidor para los identificadores: dos copias acabarían
   nombrando los archivos de una manera y buscándolos de otra */
import { aSlug } from "@/lib/panel/fotosDeEntrada";

/**
 * Preparar y subir fotos desde el navegador.
 *
 * Lo usan los tres sitios que suben fotos —la galería, las noticias y ahora
 * añadir fotos a un grupo ya publicado—, que hasta ahora llevaban cada uno su
 * copia de lo mismo. Tres copias de una función que decide a qué tamaño se
 * guardan las fotos del club es una manera segura de acabar con tres tamaños.
 */

/** Lado mayor al que se reducen las fotos antes de subirlas. */
const LADO_MAXIMO = 1800;
const CALIDAD = 0.82;

export type FotoElegida = {
  nombre: string;
  archivo: File;
  vista: string;
  ancho: number;
  alto: number;
  kb: number;
};

/** Una foto ya guardada: su URL en el almacenamiento y sus medidas reales. */
export type FotoSubida = { url: string; ancho: number; alto: number };

/**
 * Reduce la foto en el propio navegador.
 *
 * Las fotos del móvil pesan varios megas y no tiene sentido guardarlas así: ni
 * la web las necesita a ese tamaño, ni hay por qué pagar por almacenarlas.
 *
 * De paso se apuntan las medidas: como la foto ya no vive en el repositorio,
 * nadie podrá leerlas del archivo al compilar, y sin ellas la galería daría
 * saltos al cargar.
 */
export function reducir(original: File): Promise<FotoElegida> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error(original.name));
    lector.onload = () => {
      const img = new window.Image();
      img.onerror = () => rechazar(new Error(original.name));
      img.onload = () => {
        const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);

        const ctx = lienzo.getContext("2d");
        if (!ctx) return rechazar(new Error(original.name));
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

        lienzo.toBlob(
          (blob) => {
            if (!blob) return rechazar(new Error(original.name));
            const nombre = original.name.replace(/\.[^.]+$/, "") + ".jpg";
            resolver({
              nombre: original.name,
              archivo: new File([blob], nombre, { type: "image/jpeg" }),
              vista: URL.createObjectURL(blob),
              ancho: lienzo.width,
              alto: lienzo.height,
              kb: Math.round(blob.size / 1024),
            });
          },
          "image/jpeg",
          CALIDAD,
        );
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(original);
  });
}

/** Reduce una tanda, apartando las que no se puedan preparar. */
export async function prepararTanda(
  lista: FileList | File[],
): Promise<{ listas: FotoElegida[]; fallos: string[] }> {
  const listas: FotoElegida[] = [];
  const fallos: string[] = [];
  for (const archivo of Array.from(lista)) {
    try {
      listas.push(await reducir(archivo));
    } catch {
      fallos.push(archivo.name);
    }
  }
  return { listas, fallos };
}


/**
 * Sube las fotos al almacenamiento, una a una.
 *
 * Cada foto viaja por su cuenta y directamente al almacenamiento. Antes iban
 * todas dentro de la misma petición al servidor codificadas en base64, y ahí
 * chocaban con el límite de 1 MB: cabían dos y la tercera fallaba.
 *
 * El nombre lleva un sufijo del momento porque a un grupo se le añaden fotos
 * más de una vez, y sin él la segunda tanda pisaría los archivos de la primera.
 */
export async function subirAlAlmacen(
  fotos: FotoElegida[],
  carpeta: string,
  base: string,
  alAvanzar?: (hechas: number, total: number) => void,
): Promise<FotoSubida[]> {
  const marca = Date.now().toString(36);
  const subidas: FotoSubida[] = [];

  alAvanzar?.(0, fotos.length);
  for (const [i, f] of fotos.entries()) {
    const numero = String(i + 1).padStart(2, "0");
    const blob = await upload(`${carpeta}/${aSlug(base)}-${marca}-${numero}.jpg`, f.archivo, {
      access: "public",
      handleUploadUrl: "/api/subir",
    });
    subidas.push({ url: blob.url, ancho: f.ancho, alto: f.alto });
    alAvanzar?.(i + 1, fotos.length);
  }

  return subidas;
}
