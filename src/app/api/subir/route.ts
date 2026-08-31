import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { haySesion } from "@/lib/panel/sesion";

/**
 * Emite el permiso para que el navegador suba la foto DIRECTAMENTE a Blob.
 *
 * Antes la foto viajaba en base64 dentro de la propia acción de servidor, y
 * ahí chocaba con el límite de 1 MB por petición: cabían dos fotos y la
 * tercera fallaba. Subiendo desde el navegador ese límite deja de existir,
 * porque el archivo nunca pasa por aquí: solo pasa el permiso.
 *
 * El permiso se emite únicamente si quien lo pide tiene sesión abierta en el
 * panel, y solo sirve para imágenes.
 */

const MAXIMO_POR_FOTO = 8 * 1024 * 1024;

export async function POST(peticion: Request): Promise<Response> {
  const cuerpo = (await peticion.json()) as HandleUploadBody;

  try {
    const respuesta = await handleUpload({
      body: cuerpo,
      request: peticion,
      onBeforeGenerateToken: async () => {
        if (!(await haySesion())) throw new Error("Sin sesión");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: MAXIMO_POR_FOTO,
          // Dos fotos distintas pueden llamarse igual: el sufijo las separa
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // La entrada de la galería la escribe la acción del panel cuando el
        // navegador termina de subirlas todas, así que aquí no hay nada que hacer.
      },
    });

    return Response.json(respuesta);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
