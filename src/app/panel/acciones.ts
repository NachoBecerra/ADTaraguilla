"use server";

import { redirect } from "next/navigation";
import { claveCorrecta, abrirSesion, cerrarSesion } from "@/lib/panel/sesion";

export async function entrar(_previo: string | null, datos: FormData) {
  const clave = String(datos.get("clave") ?? "");

  if (!process.env.CLAVE_PANEL) {
    return "El panel no está configurado todavía: falta CLAVE_PANEL en el servidor.";
  }
  if (!claveCorrecta(clave)) {
    return "Contraseña incorrecta.";
  }

  await abrirSesion();
  redirect("/panel");
}

export async function salir() {
  await cerrarSesion();
  redirect("/panel");
}
