import clubJson from "@/data/rfaf/club.json";

/**
 * Qué está publicado ahora mismo: los datos y el código.
 *
 * `generado` es la marca de la última sincronización con la RFAF. A la
 * aplicación ya abierta le basta con comparar ese valor con el que tenía para
 * saber que hay resultados u horarios nuevos (`AvisoDatosNuevos`).
 *
 * `commit` es la versión del código, y existe para que la comprobación de
 * después de desplegar sepa **a qué está preguntando**: sin él, mide la web
 * vieja mientras Vercel todavía construye la nueva, la da por buena y el fallo
 * pasa. No descubre nada: el repositorio es público.
 *
 * Sin caché: es lo único que se pregunta para detectar el cambio, y una copia
 * guardada lo dejaría ciego justo para lo que sirve.
 */

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    {
      generado: clubJson.generado,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      entorno: process.env.VERCEL_ENV ?? "local",
    },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}
