import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sesión del panel del club.
 *
 * No hay cuentas de usuario: una sola contraseña compartida, la del club.
 * Al acertarla se entrega una cookie firmada con HMAC que dice hasta cuándo
 * vale. Sin base de datos ni servicios externos: la firma es la que impide
 * falsificarla.
 */

const COOKIE = "panel_ad_taraguilla";
const DIAS_VALIDA = 30;

function secreto(): string {
  const s = process.env.CLAVE_PANEL;
  if (!s) throw new Error("Falta la variable de entorno CLAVE_PANEL");
  return s;
}

function firmar(carga: string): string {
  return createHmac("sha256", secreto()).update(carga).digest("base64url");
}

/** Comparación en tiempo constante, para no filtrar la clave por el reloj. */
function igual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function claveCorrecta(intento: string): boolean {
  return igual(intento, secreto());
}

export async function abrirSesion(): Promise<void> {
  const caduca = Date.now() + DIAS_VALIDA * 86_400_000;
  const carga = `${caduca}.${randomBytes(8).toString("hex")}`;

  (await cookies()).set(COOKIE, `${carga}.${firmar(carga)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS_VALIDA * 86_400,
  });
}

export async function cerrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function haySesion(): Promise<boolean> {
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return false;

  const corte = valor.lastIndexOf(".");
  if (corte < 0) return false;

  const carga = valor.slice(0, corte);
  const firma = valor.slice(corte + 1);

  try {
    if (!igual(firma, firmar(carga))) return false;
  } catch {
    return false; // sin CLAVE_PANEL configurada no hay sesión posible
  }

  const caduca = Number(carga.split(".")[0]);
  return Number.isFinite(caduca) && caduca > Date.now();
}
