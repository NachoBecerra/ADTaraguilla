"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { claveCorrecta, abrirSesion, cerrarSesion } from "@/lib/panel/sesion";
import { borrarJson, escribirJson, leerJson } from "@/lib/directo/deposito";
import { bloqueoRestante, trasUnFallo, BLOQUEO_MS, MAX_FALLOS, type Intentos } from "@/lib/panel/bloqueo";
import { avisarPorCorreo } from "@/lib/correo";

/**
 * De dónde llega el intento. Vercel pone la dirección real delante; en local
 * no hay ninguna y todo cuenta como el mismo sitio, que para probar vale.
 */
async function origen(): Promise<{ ip: string; navegador: string }> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  return { ip, navegador: h.get("user-agent") ?? "desconocido" };
}

/**
 * Dónde se apuntan los intentos de un sitio. La dirección va resumida y con la
 * clave del club de sal: en el almacén no queda ninguna IP en claro.
 */
function rutaDeIntentos(ip: string): string {
  const resumen = createHash("sha256")
    .update(`${process.env.CLAVE_PANEL ?? ""}|${ip}`)
    .digest("hex")
    .slice(0, 32);
  return `panel/intentos/${resumen}.json`;
}

const minutos = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

export async function entrar(_previo: string | null, datos: FormData) {
  const clave = String(datos.get("clave") ?? "");

  if (!process.env.CLAVE_PANEL) {
    return "El panel no está configurado todavía: falta CLAVE_PANEL en el servidor.";
  }

  const { ip, navegador } = await origen();
  const ruta = rutaDeIntentos(ip);
  const previos = await leerJson<Intentos | null>(ruta, null);
  const ahora = Date.now();

  /*
   * El bloqueo se mira ANTES que la contraseña. Al revés no serviría de nada:
   * quien la estuviera probando en bucle la acertaría igual durante el
   * bloqueo, solo que sin enterarse.
   */
  const quedan = bloqueoRestante(previos, ahora);
  if (quedan !== null) {
    return `Demasiados intentos fallidos. Vuelve a intentarlo dentro de ${minutos(quedan)} minutos.`;
  }

  if (!claveCorrecta(clave)) {
    const { intentos, acabaDeBloquearse } = trasUnFallo(previos, ahora);
    await escribirJson(ruta, intentos);

    if (acabaDeBloquearse) {
      const cuando = new Intl.DateTimeFormat("es-ES", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Europe/Madrid",
      }).format(ahora);
      await avisarPorCorreo(
        "Panel de la web: acceso bloqueado por intentos fallidos",
        [
          `Alguien ha fallado la contraseña del panel ${MAX_FALLOS} veces seguidas y se ha bloqueado su acceso durante ${minutos(BLOQUEO_MS)} minutos.`,
          "",
          `Cuándo: ${cuando}`,
          `Desde: ${ip}`,
          `Navegador: ${navegador}`,
          "",
          "Si no ha sido nadie del club equivocándose, conviene cambiar la contraseña (CLAVE_PANEL en Vercel). Al cambiarla se cierran también todas las sesiones abiertas y los enlaces de retransmitir.",
        ].join("\n"),
      );
      return `Demasiados intentos fallidos. Vuelve a intentarlo dentro de ${minutos(BLOQUEO_MS)} minutos.`;
    }

    return "Contraseña incorrecta.";
  }

  // Quien entra bien no arrastra los fallos de antes
  if (previos) await borrarJson(ruta);

  await abrirSesion();
  redirect("/panel");
}

export async function salir() {
  await cerrarSesion();
  redirect("/panel");
}
