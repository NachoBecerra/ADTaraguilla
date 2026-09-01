"use server";

import { haySesion } from "@/lib/panel/sesion";
import { abrirRegistro, leerRegistro } from "@/lib/directo/almacen";
import { firmarEnlace } from "@/lib/directo/enlace";
import { partidosRetransmitibles } from "@/lib/directo/partidos";

export type Resultado = { ok: boolean; mensaje: string; ruta?: string };

/**
 * Abre la retransmisión de un partido y devuelve el enlace para quien va al
 * campo.
 *
 * Se guarda aquí la foto del partido —nombres, escudos, hora, campo— para que
 * a partir de este momento el directo no dependa ya de nada de la RFAF.
 *
 * Se devuelve la ruta y no la dirección completa: la compone el navegador con
 * su propio origen, así el enlace copiado sirve igual en producción que
 * probando en local.
 */
export async function empezarRetransmision(id: string): Promise<Resultado> {
  if (!(await haySesion())) {
    return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };
  }

  const candidato = partidosRetransmitibles().find((c) => c.ficha.id === id);
  if (!candidato) {
    return { ok: false, mensaje: "Ese partido no está en el calendario." };
  }

  try {
    await abrirRegistro(candidato.ficha);
  } catch {
    return { ok: false, mensaje: "No se ha podido abrir la retransmisión." };
  }

  let token: string;
  try {
    token = firmarEnlace(id, candidato.saqueMs);
  } catch {
    return { ok: false, mensaje: "Falta CLAVE_PANEL en el servidor." };
  }

  return {
    ok: true,
    mensaje: "Retransmisión abierta.",
    ruta: `/directo/${id}/escribir?t=${encodeURIComponent(token)}`,
  };
}

/** ¿De qué partidos hay ya una retransmisión abierta? */
export async function retransmisionesAbiertas(ids: string[]): Promise<string[]> {
  const abiertas = await Promise.all(
    ids.map(async (id) => ((await leerRegistro(id)) ? id : null)),
  );
  return abiertas.filter((id): id is string => id !== null);
}
