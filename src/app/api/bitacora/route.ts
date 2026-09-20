import { apuntar } from "@/lib/bitacora";

/**
 * Por donde el bot de la RFAF apunta lo suyo en el historial.
 *
 * Lo que hace el panel se apunta desde dentro, pero la sincronización corre en
 * GitHub, sin acceso al almacén privado, así que lo manda por aquí. Con esto,
 * en `/panel/logs` está todo junto: lo que publica el club y lo que publica el
 * bot, incluidas las pasadas que fallan, que hasta ahora solo se veían
 * entrando en GitHub.
 *
 * Mismo secreto compartido que los avisos al móvil: una cabecera y nada más.
 * Lo que se guarda no es dato de nadie, es una línea de texto.
 */

export const dynamic = "force-dynamic";

const LARGO_MAXIMO = 300;

export async function POST(peticion: Request): Promise<Response> {
  const secreto = process.env.AVISOS_SECRETO;
  if (!secreto || peticion.headers.get("x-avisos-secreto") !== secreto) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  let cuerpo: { accion?: unknown; detalle?: unknown; ok?: unknown };
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return Response.json({ error: "Petición ilegible" }, { status: 400 });
  }

  const accion = typeof cuerpo.accion === "string" ? cuerpo.accion.trim().slice(0, 80) : "";
  if (!accion) return Response.json({ error: "Falta qué apuntar" }, { status: 400 });

  await apuntar({
    area: "rfaf",
    accion,
    detalle:
      typeof cuerpo.detalle === "string" ? cuerpo.detalle.trim().slice(0, LARGO_MAXIMO) : undefined,
    // Solo un `false` explícito cuenta como fallo: lo normal es apuntar aciertos
    ok: cuerpo.ok !== false,
    quien: "bot",
  });

  return Response.json({ apuntado: true });
}
