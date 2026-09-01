import { directosDeHoy } from "@/lib/directo/resumen";

/**
 * Qué partidos se están jugando ahora mismo.
 *
 * Lo pregunta la web para encender el "en directo" en las tarjetas. Devuelve lo
 * mínimo —quién juega y cómo va—; la cronología se pide ya dentro del partido.
 *
 * Se responde con caché de CDN corta a propósito. Un sábado por la tarde puede
 * haber mucha gente en la portada, y sin esto cada visita sería una consulta al
 * almacén: con ella, el coste depende de lo que dura el partido y no de cuánta
 * gente lo mire.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const directos = await directosDeHoy();

  return Response.json(
    { directos },
    {
      headers: {
        /*
         * `Vercel-CDN-Cache-Control` manda sobre la CDN de Vercel aunque Next
         * ponga lo suyo en las rutas dinámicas; `CDN-Cache-Control` cubre
         * cualquier otra capa por delante. Al navegador no se le deja guardar
         * nada: quien mira quiere el marcador de ahora.
         */
        "Vercel-CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        "CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        "Cache-Control": "no-store",
      },
    },
  );
}
