import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * El enlace que se manda por WhatsApp a quien va al campo.
 *
 * Mismo planteamiento que la sesión del panel: no hay tabla de tokens ni base
 * de datos, solo una firma. Lo que se firma es "este partido, hasta esta
 * hora", así que el propio enlace lleva dentro su permiso y su caducidad.
 *
 * Se deriva de CLAVE_PANEL en vez de pedir una variable nueva. Dos ventajas:
 * no hay nada que configurar en Vercel, y si el club cambia su contraseña
 * todos los enlaces vivos mueren de golpe, que es justo lo que querría quien
 * la cambia. La firma es de ida, así que un enlace filtrado no revela la
 * contraseña.
 */

/**
 * Cuánto sigue valiendo el enlace después del saque.
 *
 * Da margen a prórrogas, a un retraso del árbitro y a rematar la cronología
 * con calma al acabar. Pasado eso deja de servir, que es lo que hace inofensivo
 * un enlace reenviado sin querer a un grupo de WhatsApp.
 */
const DESPUES_MS = 4 * 60 * 60_000;

function secreto(): string {
  const s = process.env.CLAVE_PANEL;
  if (!s) throw new Error("Falta la variable de entorno CLAVE_PANEL");
  return s;
}

/*
 * La etiqueta separa este uso de la cookie del panel. Sin ella, una firma
 * hecha para una cosa podría colarse como válida para la otra.
 */
const firmar = (carga: string) =>
  createHmac("sha256", secreto()).update(`directo:${carga}`).digest("base64url");

function igual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Token para escribir en un partido.
 *
 * Vale **desde que se genera**, no desde un rato antes del saque. El club
 * prepara el enlace el lunes y lo manda por WhatsApp; si no funcionara hasta el
 * sábado, quien lo recibe abriría un enlace roto y pediría otro. Lo que importa
 * es que caduque *después* del partido, y eso sí se mantiene.
 *
 * El mínimo de cuatro horas cubre abrir la retransmisión de un partido que ya
 * ha empezado, que es cuando más prisa hay.
 */
export function firmarEnlace(partido: string, saqueMs: number, ahora = Date.now()): string {
  const caduca = Math.max(saqueMs + DESPUES_MS, ahora + DESPUES_MS);
  const carga = `${partido}.${caduca}`;
  return `${caduca}.${firmar(carga)}`;
}

export type EstadoEnlace = "valido" | "caducado" | "falso";

/**
 * Qué le pasa a este token.
 *
 * Se distingue "caducado" de "falso" a propósito: a quien llega al campo con un
 * enlace de la semana pasada hay que decirle que pida otro, no darle un 404 que
 * no explica nada. Un token que nunca fue nuestro sí se trata como inexistente.
 */
export function estadoDelEnlace(
  partido: string,
  token: string | undefined,
  ahora = Date.now(),
): EstadoEnlace {
  if (!token) return "falso";

  const corte = token.indexOf(".");
  if (corte < 0) return "falso";

  const caduca = Number(token.slice(0, corte));
  const firma = token.slice(corte + 1);
  if (!Number.isFinite(caduca)) return "falso";

  try {
    // Que la firma sea nuestra y que sea de **este** partido, no de otro
    if (!igual(firma, firmar(`${partido}.${caduca}`))) return "falso";
  } catch {
    return "falso"; // sin CLAVE_PANEL configurada no hay enlace posible
  }

  return ahora <= caduca ? "valido" : "caducado";
}

/** ¿Este token sirve para escribir en este partido, ahora mismo? */
export const enlaceValido = (
  partido: string,
  token: string | undefined,
  ahora = Date.now(),
) => estadoDelEnlace(partido, token, ahora) === "valido";
