import {
  borrarSuscripcion,
  guardarSuscripcion,
  leerSuscripcion,
  type Suscripcion,
} from "@/lib/avisos";
import { getEquipos } from "@/lib/competicion";

/**
 * Alta, baja y consulta de avisos.
 *
 * No hay registro ni contraseña: la suscripción que genera el navegador ya
 * identifica al dispositivo. Se guardan esa suscripción y la lista de equipos
 * de los que quiere avisos, tantos como quiera.
 *
 * La lista la lleva el servidor y no el navegador: si alguien limpia los datos
 * del navegador, al volver sigue viendo lo que tenía activado.
 */

export const dynamic = "force-dynamic";

type Cuerpo = {
  accion?: "alta" | "baja" | "consulta";
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  equipo?: string;
};

const respuesta = (equipos: string[]) => Response.json({ equipos });

export async function POST(peticion: Request): Promise<Response> {
  let cuerpo: Cuerpo;
  try {
    cuerpo = (await peticion.json()) as Cuerpo;
  } catch {
    return Response.json({ error: "Petición ilegible" }, { status: 400 });
  }

  const { accion = "alta", endpoint, keys, equipo } = cuerpo;
  if (!endpoint) return Response.json({ error: "Falta la suscripción" }, { status: 400 });

  const guardada = await leerSuscripcion(endpoint);
  const equipos = new Set(guardada?.equipos ?? []);

  if (accion === "consulta") return respuesta([...equipos]);

  // El equipo tiene que ser uno de los del club: no se guarda lo que llegue
  if (!equipo || !getEquipos().some((e) => e.id === equipo)) {
    return Response.json({ error: "Ese equipo no existe" }, { status: 400 });
  }

  if (accion === "baja") {
    equipos.delete(equipo);
    // Sin equipos no hay nada que avisar: se retira la suscripción entera
    if (equipos.size === 0) {
      await borrarSuscripcion(endpoint);
      return respuesta([]);
    }
  } else {
    if (!keys?.p256dh || !keys?.auth) {
      return Response.json({ error: "Suscripción incompleta" }, { status: 400 });
    }
    equipos.add(equipo);
  }

  const suscripcion: Suscripcion = {
    endpoint,
    keys: guardada?.keys ?? { p256dh: keys!.p256dh as string, auth: keys!.auth as string },
    equipos: [...equipos],
    creada: guardada?.creada ?? new Date().toISOString(),
  };

  if (!(await guardarSuscripcion(suscripcion))) {
    return Response.json({ error: "No se ha podido guardar" }, { status: 503 });
  }
  return respuesta(suscripcion.equipos);
}

/** Baja completa: se dejan de recibir avisos de todo. */
export async function DELETE(peticion: Request): Promise<Response> {
  let endpoint: string | undefined;
  try {
    ({ endpoint } = (await peticion.json()) as { endpoint?: string });
  } catch {
    return Response.json({ error: "Petición ilegible" }, { status: 400 });
  }
  if (!endpoint) return Response.json({ error: "Falta la suscripción" }, { status: 400 });

  await borrarSuscripcion(endpoint);
  return respuesta([]);
}
