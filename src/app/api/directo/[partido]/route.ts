import { anotarEventos, leerRegistro } from "@/lib/directo/almacen";
import { enlaceValido } from "@/lib/directo/enlace";
import { plegar, sanearEventos } from "@/lib/directo/modelo";

/**
 * El partido en directo: leer lo que hay y anotar lo que va pasando.
 *
 * Es la única puerta del directo. No consulta nada a la RFAF: todo lo que sale
 * de aquí lo ha escrito alguien del club desde el campo.
 */

export const dynamic = "force-dynamic";

/** Lo que se sigue pudiendo escribir después de dar el partido por terminado. */
const TRAS_EL_FINAL_MS = 180 * 60_000;

/** El identificador viaja en la ruta y acaba siendo un nombre de archivo. */
const ID_VALIDO = /^[a-z0-9-]{3,80}$/;

type Contexto = { params: Promise<{ partido: string }> };

export async function GET(peticion: Request, { params }: Contexto): Promise<Response> {
  const { partido } = await params;
  if (!ID_VALIDO.test(partido)) {
    return Response.json({ error: "Partido no válido" }, { status: 400 });
  }

  const registro = await leerRegistro(partido);
  if (!registro) {
    return Response.json({ error: "No hay retransmisión" }, { status: 404 });
  }

  /*
   * En un partido pasan veinte o treinta cosas en hora y media, así que casi
   * todas las preguntas se contestan con "nada nuevo". El ETag las despacha
   * sin cuerpo, que es lo que hace barato preguntar cada pocos segundos.
   */
  const etag = `W/"v${registro.version}"`;
  if (peticion.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return Response.json(registro, {
    headers: { ETag: etag, "Cache-Control": "no-store" },
  });
}

export async function POST(peticion: Request, { params }: Contexto): Promise<Response> {
  const { partido } = await params;
  if (!ID_VALIDO.test(partido)) {
    return Response.json({ error: "Partido no válido" }, { status: 400 });
  }

  let cuerpo: { token?: string; eventos?: unknown; abierto?: string };
  try {
    cuerpo = (await peticion.json()) as {
      token?: string;
      eventos?: unknown;
      abierto?: string;
    };
  } catch {
    return Response.json({ error: "Petición ilegible" }, { status: 400 });
  }

  // El enlace autoriza este partido y ninguno más, y solo durante su ventana
  if (!enlaceValido(partido, cuerpo.token)) {
    return Response.json({ error: "El enlace no vale o ha caducado" }, { status: 401 });
  }

  const eventos = sanearEventos(cuerpo.eventos, Date.now());
  if (eventos.length === 0) {
    return Response.json({ error: "Nada que anotar" }, { status: 400 });
  }

  /*
   * Si el partido se reinició desde el panel, quien tenga la botonera abierta
   * desde antes sigue guardando la cronología vieja y la mandaría entera al
   * pulsar cualquier cosa. Se rechaza y se le pide que recargue.
   *
   * Las retransmisiones abiertas antes de que existiera esta marca no traen
   * `abierto`: esas se aceptan, o dejarían de funcionar a media jornada.
   */
  const actual = await leerRegistro(partido);
  if (actual?.abierto && cuerpo.abierto && cuerpo.abierto !== actual.abierto) {
    return Response.json(
      { error: "La retransmisión se ha reiniciado", reiniciado: true },
      { status: 409 },
    );
  }

  /*
   * El enlace deja de valer tres horas después del pitido final, no de la hora
   * del saque: un partido que se adelanta o se alarga no tiene por qué llevarse
   * por delante el margen para rematar la cronología. Se decide aquí y no en la
   * firma del token porque cuando se firma todavía no se sabe cuándo acabará.
   */
  if (actual) {
    const estado = plegar(actual.eventos, actual.partido.minutosPorParte);
    if (estado.finMs !== null && Date.now() - estado.finMs > TRAS_EL_FINAL_MS) {
      return Response.json(
        { error: "El partido se cerró hace horas", cerrado: true },
        { status: 403 },
      );
    }
  }

  const registro = await anotarEventos(partido, eventos);
  if (!registro) {
    return Response.json({ error: "No se ha podido guardar" }, { status: 503 });
  }

  /*
   * Se devuelve el registro entero, no un "vale". Quien escribe lo compara con
   * su cola: lo que no aparezca, lo vuelve a mandar. Así una escritura perdida
   * se arregla sola en el evento siguiente.
   */
  return Response.json(registro, {
    headers: { ETag: `W/"v${registro.version}"`, "Cache-Control": "no-store" },
  });
}
