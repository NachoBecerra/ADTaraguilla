import clubJson from "@/data/rfaf/club.json";

/**
 * Marca de cuándo se generaron los datos que sirve este despliegue.
 *
 * Cambia con cada sincronización desde la RFAF, así que a la aplicación ya
 * abierta le basta con comparar este valor con el que tenía para saber que
 * hay resultados u horarios nuevos.
 *
 * Sin caché: es lo único que se pregunta para detectar el cambio, y una copia
 * guardada lo dejaría ciego justo para lo que sirve.
 */

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { generado: clubJson.generado },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
