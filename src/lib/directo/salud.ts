/**
 * Si lo que se apunta en el campo está llegando o no a la web.
 *
 * El 20 de septiembre de 2026 el senior se retransmitió entero desde el campo
 * del Rota y no llegó ni un evento: una redirección del dominio convertía cada
 * envío en una petición a otro dominio y el navegador la bloqueaba. La
 * botonera guarda en una cola y reintenta en silencio, así que en la pantalla
 * de quien narraba todo se veía normal: los goles estaban ahí, pintados, y la
 * web vacía. Nadie se enteró hasta que llamaron.
 *
 * La regla que faltaba: **si lo apuntado no llega al servidor, quien apunta
 * tiene que enterarse en segundos, sin tener que interpretar nada**. Un fallo
 * de cobertura de medio minuto no merece alarma; noventa minutos sin guardar
 * no puede pasar desapercibido.
 *
 * Sin dependencias: se prueba con `node scripts/directo/probar.mjs`.
 */

/**
 * Cuánto se aguanta sin guardar antes de avisar a gritos.
 *
 * Con margen para un túnel o un cambio de antena, que son segundos, y muy por
 * debajo de lo que tarda en pasar algo digno de contarse.
 */
export const MARGEN_ATASCO_MS = 40_000;

/**
 * ¿Hay algo apuntado que no consigue guardarse?
 *
 * `ultimoGuardadoMs` es el instante del último envío que el servidor aceptó, o
 * el de abrir la pantalla si todavía no hubo ninguno.
 */
export function escrituraAtascada(
  sinMandar: number,
  ultimoGuardadoMs: number,
  ahora: number,
  margen: number = MARGEN_ATASCO_MS,
): boolean {
  if (sinMandar <= 0) return false;
  return ahora - ultimoGuardadoMs >= margen;
}

/**
 * La misma dirección, en el dominio bueno.
 *
 * La web responde con y sin `www`, y quien tenga la aplicación instalada desde
 * el enlace con `www` escribe desde ahí. Si algún día vuelve a haber una
 * redirección entre los dos dominios, esa botonera deja de guardar sin decir
 * nada: el navegador no deja mandar datos a un dominio distinto del de la
 * página. Se detecta y se ofrece el enlace bueno antes de que empiece el
 * partido.
 */
export function sinWww(href: string): string | null {
  try {
    const url = new URL(href);
    if (!url.hostname.startsWith("www.")) return null;
    url.hostname = url.hostname.slice(4);
    return url.toString();
  } catch {
    return null;
  }
}
