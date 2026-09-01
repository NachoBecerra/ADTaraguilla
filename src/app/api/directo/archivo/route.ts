import { listarRegistros } from "@/lib/directo/almacen";

/**
 * De qué partidos de un equipo hay retransmisión guardada.
 *
 * Solo las fechas, y salen **del nombre de los archivos**: el identificador de
 * una retransmisión es `<equipo>-<fecha>`, así que no hay que abrir ninguna. Una
 * temporada son unos trescientos partidos, y leerlos todos para pintar una
 * lista de enlaces sería absurdo.
 *
 * Lo que pasó en cada uno se lee ya dentro, en la página del partido.
 */

export const dynamic = "force-dynamic";

const EQUIPO_VALIDO = /^[a-z0-9-]{3,60}$/;

export async function GET(peticion: Request): Promise<Response> {
  const equipo = new URL(peticion.url).searchParams.get("equipo") ?? "";
  if (!EQUIPO_VALIDO.test(equipo)) {
    return Response.json({ error: "Equipo no válido" }, { status: 400 });
  }

  const rutas = await listarRegistros();
  const fechas = rutas
    .map((r) => r.replace(/^directo\//, "").replace(/\.json$/, ""))
    .filter((id) => id.startsWith(`${equipo}-`))
    .map((id) => id.slice(equipo.length + 1))
    // Solo lo que de verdad es una fecha: así "alevin-a" no se cuela en "alevin"
    .filter((fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha))
    .sort()
    .reverse();

  return Response.json(
    { fechas },
    {
      /*
       * Cambia una vez por semana como mucho, así que la CDN puede servirlo un
       * rato: es una lista de enlaces, no un marcador.
       */
      headers: {
        "Vercel-CDN-Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        "CDN-Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        "Cache-Control": "no-store",
      },
    },
  );
}
