import { listarRegistros } from "@/lib/directo/almacen";

/**
 * De qué partidos hay retransmisión guardada.
 *
 * Solo las fechas, y salen **del nombre de los archivos**: el identificador de
 * una retransmisión es `<equipo>-<fecha>`, así que no hay que abrir ninguna. Una
 * temporada son unos trescientos partidos, y leerlos todos para pintar una
 * lista de enlaces sería absurdo.
 *
 * Se piden varios equipos de una vez porque la portada los enseña todos: la
 * lista del almacén es la misma para los nueve, y pedirla nueve veces sería
 * nueve consultas para contestar lo mismo.
 *
 * Lo que pasó en cada uno se lee ya dentro, en la página del partido.
 */

export const dynamic = "force-dynamic";

const EQUIPO_VALIDO = /^[a-z0-9-]{3,60}$/;

/** Nueve equipos tiene el club; el tope es para que nadie pida una lista infinita. */
const MAX_EQUIPOS = 30;

export async function GET(peticion: Request): Promise<Response> {
  const parametros = new URL(peticion.url).searchParams;

  const equipos = [
    ...new Set(
      (parametros.get("equipos") ?? parametros.get("equipo") ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_EQUIPOS);

  if (equipos.length === 0 || !equipos.every((e) => EQUIPO_VALIDO.test(e))) {
    return Response.json({ error: "Equipo no válido" }, { status: 400 });
  }

  const ids = (await listarRegistros()).map((r) =>
    r.replace(/^directo\//, "").replace(/\.json$/, ""),
  );

  const porEquipo = Object.fromEntries(
    equipos.map((equipo) => [
      equipo,
      ids
        .filter((id) => id.startsWith(`${equipo}-`))
        .map((id) => id.slice(equipo.length + 1))
        // Solo lo que de verdad es una fecha: así "alevin-a" no se cuela en "alevin"
        .filter((fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha))
        .sort()
        .reverse(),
    ]),
  );

  return Response.json(
    { porEquipo },
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
