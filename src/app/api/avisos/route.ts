import {
  borrarSuscripcion,
  guardarSuscripcion,
  type Suscripcion,
} from "@/lib/avisos";
import { getEquipos } from "@/lib/competicion";

/**
 * Alta y baja de avisos.
 *
 * No hay registro ni contraseña: la suscripción que genera el navegador ya
 * identifica al dispositivo. Solo se guarda esa suscripción y de qué equipo
 * quiere avisos.
 */

export const dynamic = "force-dynamic";

type Cuerpo = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  equipo?: string;
};

export async function POST(peticion: Request): Promise<Response> {
  let cuerpo: Cuerpo;
  try {
    cuerpo = (await peticion.json()) as Cuerpo;
  } catch {
    return Response.json({ error: "Petición ilegible" }, { status: 400 });
  }

  const { endpoint, keys, equipo } = cuerpo;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: "Suscripción incompleta" }, { status: 400 });
  }

  // El equipo tiene que ser uno de los del club: no se guarda lo que llegue
  const valido = getEquipos().some((e) => e.id === equipo);
  if (!valido) {
    return Response.json({ error: "Ese equipo no existe" }, { status: 400 });
  }

  const suscripcion: Suscripcion = {
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    equipo: equipo as string,
    creada: new Date().toISOString(),
  };

  const ok = await guardarSuscripcion(suscripcion);
  if (!ok) {
    return Response.json(
      { error: "No se ha podido guardar la suscripción" },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}

export async function DELETE(peticion: Request): Promise<Response> {
  let endpoint: string | undefined;
  try {
    ({ endpoint } = (await peticion.json()) as { endpoint?: string });
  } catch {
    return Response.json({ error: "Petición ilegible" }, { status: 400 });
  }
  if (!endpoint) return Response.json({ error: "Falta la suscripción" }, { status: 400 });

  await borrarSuscripcion(endpoint);
  return Response.json({ ok: true });
}
