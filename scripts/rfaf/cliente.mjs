/**
 * Cliente HTTP para el portal PNFG de la RFAF.
 *
 * Cuatro particularidades del portal que hay que respetar:
 *  1. Sin cookie de sesión responde "No se ha aceptado el cookie". Hay que
 *     seguir la cadena de redirecciones a mano para quedarse el JSESSIONID.
 *  2. Las páginas van en ISO-8859-15, no en UTF-8.
 *  3. Manda "Content-Length: 0" y luego el cuerpo igualmente, así que no se
 *     puede confiar en esa cabecera.
 *  4. Limita por volumen: pasado cierto ritmo devuelve 200 con el cuerpo
 *     vacío. Por eso vamos despacio y, si aun así nos corta, esperamos.
 */

const BASE = "https://www.rfaf.es";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/** Milisegundos de espera entre peticiones, para no castigar al servidor. */
const PAUSA = 2500;
const REINTENTOS = 3;
const TIMEOUT = 30_000;

/**
 * Esperas crecientes cuando el portal nos corta el grifo. No merece la pena
 * insistir mucho más: el bloqueo dura del orden de diez minutos y la pasada es
 * reanudable, así que sale más barato rendirse y reintentar en la siguiente.
 */
const ESPERAS_CUPO = [60_000, 180_000];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** El portal nos está limitando: no es un fallo de la página. */
export class ErrorDeCupo extends Error {}

/** Los enlaces del portal llegan tanto absolutos como relativos a /pnfg/NPcd/. */
export const urlAbsoluta = (ruta) =>
  ruta.startsWith("http") ? ruta : BASE + (ruta.startsWith("/") ? ruta : `/pnfg/NPcd/${ruta}`);

export class ClienteRfaf {
  #cookies = new Map();
  #ultimaPeticion = 0;

  /** Cabecera Cookie con todo lo que llevamos acumulado. */
  get #cabeceraCookie() {
    return [...this.#cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  #guardarCookies(respuesta) {
    for (const linea of respuesta.headers.getSetCookie?.() ?? []) {
      const [par] = linea.split(";");
      const i = par.indexOf("=");
      if (i > 0) this.#cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
  }

  async #esperarTurno() {
    const desde = Date.now() - this.#ultimaPeticion;
    if (desde < PAUSA) await dormir(PAUSA - desde);
    this.#ultimaPeticion = Date.now();
  }

  /**
   * Pide una URL. Si el portal nos limita, espera y lo vuelve a intentar;
   * si insiste, propaga el error para que la pasada se aborte sin escribir
   * datos a medias.
   */
  async pedir(url) {
    for (let intento = 0; ; intento++) {
      try {
        return await this.#pedirUnaVez(url);
      } catch (e) {
        if (!(e instanceof ErrorDeCupo) || intento >= ESPERAS_CUPO.length) throw e;
        const espera = ESPERAS_CUPO[intento];
        console.warn(`⏳ La RFAF nos está limitando. Esperando ${espera / 1000}s…`);
        await dormir(espera);
      }
    }
  }

  /**
   * Sigue las redirecciones a mano para no perder cookies.
   * Devuelve el HTML ya decodificado.
   */
  async #pedirUnaVez(url, { saltos = 10 } = {}) {
    let destino = urlAbsoluta(url);

    for (let salto = 0; salto <= saltos; salto++) {
      await this.#esperarTurno();
      const respuesta = await this.#pedirConReintentos(destino);
      this.#guardarCookies(respuesta);

      if (respuesta.status >= 300 && respuesta.status < 400) {
        const siguiente = respuesta.headers.get("location");
        if (!siguiente) break;
        destino = new URL(siguiente, destino).toString();
        continue;
      }

      if (!respuesta.ok) {
        throw new Error(`La RFAF devolvió ${respuesta.status} en ${destino}`);
      }

      const bytes = await respuesta.arrayBuffer();
      const html = new TextDecoder("iso-8859-15").decode(bytes);

      if (html.includes("No se ha aceptado el cookie")) {
        throw new Error("La RFAF rechazó la sesión (cookie no aceptada)");
      }

      // El portal responde 200 con el cuerpo vacío cuando nos está limitando
      // por volumen de peticiones. No es un error de la página: es un "ahora
      // no". Se espera cada vez más y, si insiste, se aborta la pasada.
      if (bytes.byteLength === 0) {
        throw new ErrorDeCupo(`La RFAF devolvió una respuesta vacía en ${destino}`);
      }

      return html;
    }

    throw new Error(`Demasiadas redirecciones pidiendo ${url}`);
  }

  async #pedirConReintentos(destino) {
    let ultimoFallo;
    for (let intento = 1; intento <= REINTENTOS; intento++) {
      try {
        return await fetch(destino, {
          redirect: "manual",
          signal: AbortSignal.timeout(TIMEOUT),
          headers: {
            "User-Agent": UA,
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "es-ES,es;q=0.9",
            ...(this.#cookies.size ? { Cookie: this.#cabeceraCookie } : {}),
          },
        });
      } catch (e) {
        ultimoFallo = e;
        if (intento < REINTENTOS) await dormir(1500 * intento);
      }
    }
    throw ultimoFallo;
  }

  /** Primera visita: recoge el JSESSIONID que exige el portal. */
  async iniciarSesion() {
    await this.pedir("/");
  }
}

