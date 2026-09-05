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
 * Separa la parte legible del token de su firma.
 *
 * El token es `llave.caduca.firma`. Los dos primeros trozos viajan a la vista
 * a propósito: no son un secreto —la firma es la que manda— y hacen falta para
 * poder decirle a quien llega *por qué* su enlace no sirve.
 *
 * Los enlaces repartidos antes de que existieran las llaves no las llevan
 * (`caduca.firma`) y se leen como la primera generación. Sin esto, desplegar
 * esto un sábado dejaría muda a la persona que estuviera en el campo.
 */
function despiezar(token: string): { llave: number; caduca: number; firma: string; carga: string } | null {
  const trozos = token.split(".");

  if (trozos.length === 3) {
    const [llave, caduca, firma] = trozos;
    if (!/^\d+$/.test(llave) || !/^\d+$/.test(caduca)) return null;
    return {
      llave: Number(llave),
      caduca: Number(caduca),
      firma,
      carga: `${llave}.${caduca}`,
    };
  }

  if (trozos.length === 2) {
    const [caduca, firma] = trozos;
    if (!/^\d+$/.test(caduca)) return null;
    return { llave: 1, caduca: Number(caduca), firma, carga: caduca };
  }

  return null;
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
export function firmarEnlace(
  partido: string,
  saqueMs: number,
  llave = 1,
  ahora = Date.now(),
): string {
  const caduca = Math.max(saqueMs + DESPUES_MS, ahora + DESPUES_MS);
  return `${llave}.${caduca}.${firmar(`${partido}.${llave}.${caduca}`)}`;
}

export type EstadoEnlace = "valido" | "caducado" | "revocado" | "falso";

/**
 * Qué le pasa a este token.
 *
 * Los tres motivos por los que un enlace no sirve se distinguen a propósito, y
 * cada uno se cuenta distinto:
 *
 * - **caducado**: es de la semana pasada. Hay que pedir otro.
 * - **revocado**: el club ha generado un enlace nuevo para este mismo partido,
 *   normalmente porque el anterior acabó en un grupo de cuarenta personas. La
 *   retransmisión sigue viva; lo que ya no vale es este enlace.
 * - **falso**: nunca fue nuestro. Se trata como inexistente, para no confirmar
 *   siquiera qué partidos hay a quien vaya probando direcciones.
 *
 * Revocado se mira antes que caducado: si son las dos cosas, lo que le sirve a
 * quien lo abre es enterarse de que hay uno nuevo.
 */
export function estadoDelEnlace(
  partido: string,
  token: string | undefined,
  llaveActual = 1,
  ahora = Date.now(),
): EstadoEnlace {
  if (!token) return "falso";

  const partes = despiezar(token);
  if (!partes) return "falso";

  try {
    // Que la firma sea nuestra y que sea de **este** partido, no de otro
    if (!igual(partes.firma, firmar(`${partido}.${partes.carga}`))) return "falso";
  } catch {
    return "falso"; // sin CLAVE_PANEL configurada no hay enlace posible
  }

  if (partes.llave !== llaveActual) return "revocado";

  return ahora <= partes.caduca ? "valido" : "caducado";
}

/** ¿Este token sirve para escribir en este partido, ahora mismo? */
export const enlaceValido = (
  partido: string,
  token: string | undefined,
  llaveActual = 1,
  ahora = Date.now(),
) => estadoDelEnlace(partido, token, llaveActual, ahora) === "valido";
