import { anotarSeguidor, cuantosSiguen } from "@/lib/directo/seguidores";

/**
 * Cuánta gente ha seguido un partido.
 *
 * Va en su propia dirección y no dentro del partido a propósito: el partido se
 * pregunta cada cinco segundos y casi siempre contesta "nada nuevo" sin cuerpo.
 * Si la cifra viajara ahí, cada visita nueva rompería esa respuesta vacía para
 * todo el mundo y se perdería lo que hace barato el directo.
 */

export const dynamic = "force-dynamic";

const ID_PARTIDO = /^[a-z0-9-]{3,80}$/;
/** El que se inventa el navegador: aleatorio, corto y de un solo partido. */
const ID_VISITA = /^[A-Za-z0-9_-]{8,64}$/;

type Contexto = { params: Promise<{ partido: string }> };

export async function GET(_peticion: Request, { params }: Contexto): Promise<Response> {
  const { partido } = await params;
  if (!ID_PARTIDO.test(partido)) {
    return Response.json({ error: "Partido no válido" }, { status: 400 });
  }

  return Response.json(
    { total: await cuantosSiguen(partido) },
    {
      /*
       * Media rueda de caché: la cifra sube despacio y no pasa nada por
       * enseñarla con medio minuto de retraso. Con esto, aunque medio pueblo
       * tenga el partido abierto, al almacén se le pregunta dos veces por
       * minuto.
       */
      headers: {
        "Vercel-CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(peticion: Request, { params }: Contexto): Promise<Response> {
  const { partido } = await params;
  if (!ID_PARTIDO.test(partido)) {
    return Response.json({ error: "Partido no válido" }, { status: 400 });
  }

  let id = "";
  try {
    ({ id } = (await peticion.json()) as { id: string });
  } catch {
    return Response.json({ error: "Petición ilegible" }, { status: 400 });
  }

  if (!ID_VISITA.test(id)) {
    return Response.json({ error: "Visita no válida" }, { status: 400 });
  }

  return Response.json(
    { total: await anotarSeguidor(partido, id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
