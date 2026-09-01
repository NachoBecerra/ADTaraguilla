"use server";

import { haySesion } from "@/lib/panel/sesion";
import { abrirRegistro, leerRegistro, reiniciarRegistro } from "@/lib/directo/almacen";
import { firmarEnlace } from "@/lib/directo/enlace";
import { partidosRetransmitibles } from "@/lib/directo/partidos";
import { plegar } from "@/lib/directo/modelo";

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

/**
 * Borra lo apuntado de un partido y lo deja como recién abierto.
 *
 * Para empezar de cero una prueba, o para rescatar una retransmisión que se
 * lió de verdad. Es destructivo y no tiene vuelta atrás: la cronología no se
 * guarda en ninguna otra parte.
 *
 * Devuelve un enlace nuevo. Quien tuviera la botonera abierta con el partido
 * anterior dejará de poder escribir y se le pedirá que recargue, para que no
 * devuelva lo borrado en su siguiente envío.
 */
export async function reiniciarRetransmision(id: string): Promise<Resultado> {
  if (!(await haySesion())) {
    return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };
  }

  const candidato = partidosRetransmitibles().find((c) => c.ficha.id === id);
  if (!candidato) {
    return { ok: false, mensaje: "Ese partido no está en el calendario." };
  }

  if (!(await reiniciarRegistro(candidato.ficha))) {
    return { ok: false, mensaje: "No se ha podido reiniciar." };
  }

  let token: string;
  try {
    token = firmarEnlace(id, candidato.saqueMs);
  } catch {
    return { ok: false, mensaje: "Falta CLAVE_PANEL en el servidor." };
  }

  return {
    ok: true,
    mensaje: "Retransmisión reiniciada.",
    ruta: `/directo/${id}/escribir?t=${encodeURIComponent(token)}`,
  };
}

/** Lo que se sigue pudiendo escribir después de dar el partido por terminado. */
const TRAS_EL_FINAL_MS = 180 * 60_000;

export type EstadoPanel =
  /** Nadie la ha abierto todavía. */
  | "sin-abrir"
  /** Abierta pero sin pitar el inicio. */
  | "abierta"
  | "en-directo"
  /** Terminada, pero aún se puede rematar la cronología. */
  | "terminada"
  /** Terminada hace horas: ya no se puede escribir y sale del panel. */
  | "caducada";

/** En qué punto está la retransmisión de cada partido. */
export async function estadoDeRetransmisiones(
  ids: string[],
): Promise<Record<string, EstadoPanel>> {
  const pares = await Promise.all(
    ids.map(async (id): Promise<[string, EstadoPanel]> => {
      const registro = await leerRegistro(id);
      if (!registro) return [id, "sin-abrir"];

      const estado = plegar(registro.eventos, registro.partido.minutosPorParte);
      if (estado.fase === "sin-empezar") return [id, "abierta"];
      if (estado.finMs === null) return [id, "en-directo"];

      return [
        id,
        Date.now() - estado.finMs > TRAS_EL_FINAL_MS ? "caducada" : "terminada",
      ];
    }),
  );

  return Object.fromEntries(pares);
}
