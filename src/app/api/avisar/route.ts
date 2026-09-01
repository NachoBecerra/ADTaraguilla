import webpush from "web-push";
import { borrarSuscripcion, todasLasSuscripciones } from "@/lib/avisos";
import { site } from "@/data/site";

/**
 * Manda los avisos a quien los haya pedido.
 *
 * Lo llama la sincronización cuando detecta algo que contar: un resultado que
 * acaba de publicarse, o un horario que la RFAF acaba de asignar. Va protegido
 * con un secreto compartido para que no pueda dispararlo cualquiera.
 */

export const dynamic = "force-dynamic";

type Aviso = {
  /** Identificador del equipo al que afecta. */
  equipo: string;
  titulo: string;
  cuerpo: string;
  /** A dónde lleva al tocarlo. */
  url?: string;
};

function configurado(): boolean {
  return Boolean(
    process.env.VAPID_CLAVE_PRIVADA && process.env.NEXT_PUBLIC_VAPID_CLAVE_PUBLICA,
  );
}

export async function POST(peticion: Request): Promise<Response> {
  const secreto = process.env.AVISOS_SECRETO;
  if (!secreto || peticion.headers.get("x-avisos-secreto") !== secreto) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!configurado()) {
    return Response.json({ error: "Faltan las claves de aviso" }, { status: 503 });
  }

  let avisos: Aviso[];
  try {
    ({ avisos } = (await peticion.json()) as { avisos: Aviso[] });
  } catch {
    return Response.json({ error: "Petición ilegible" }, { status: 400 });
  }
  if (!Array.isArray(avisos) || avisos.length === 0) {
    return Response.json({ enviados: 0, avisos: 0 });
  }

  webpush.setVapidDetails(
    site.url,
    process.env.NEXT_PUBLIC_VAPID_CLAVE_PUBLICA as string,
    process.env.VAPID_CLAVE_PRIVADA as string,
  );

  const suscripciones = await todasLasSuscripciones();
  let enviados = 0;
  let caducadas = 0;

  for (const aviso of avisos) {
    const destinatarios = suscripciones.filter((s) => s.equipo === aviso.equipo);
    if (destinatarios.length === 0) continue;

    const carga = JSON.stringify({
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      url: aviso.url ?? `/equipos/${aviso.equipo}`,
    });

    const resultados = await Promise.allSettled(
      destinatarios.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          carga,
          { TTL: 60 * 60 * 6 },
        ),
      ),
    );

    for (const [i, r] of resultados.entries()) {
      if (r.status === "fulfilled") {
        enviados++;
        continue;
      }
      /*
       * 404 y 410 significan que ese dispositivo ya no existe: desinstalaron
       * la aplicación o revocaron el permiso. Se borra, o quedarían
       * suscripciones muertas acumulándose para siempre.
       */
      const codigo = (r.reason as { statusCode?: number })?.statusCode;
      if (codigo === 404 || codigo === 410) {
        await borrarSuscripcion(destinatarios[i].endpoint);
        caducadas++;
      }
    }
  }

  return Response.json({ avisos: avisos.length, enviados, caducadas });
}
