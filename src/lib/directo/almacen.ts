import fs from "node:fs/promises";
import path from "node:path";
import { escribirPrivado, hayAlmacenPrivado, leerPrivado } from "@/lib/privado";
import type { Evento } from "@/lib/directo/modelo";

/**
 * Dónde vive un partido en directo.
 *
 * Un archivo por partido, no una lista común: el sábado hay tres partidos a la
 * vez y dos escrituras simultáneas sobre el mismo archivo se pisarían.
 *
 * Dentro va la **foto del partido** (nombres, escudos, hora, campo) copiada al
 * abrir la retransmisión. Gracias a eso el directo no depende de los datos que
 * se generan al compilar: funciona igual en una eliminatoria de copa, de las
 * que la RFAF no nos da detalle, y no hace falta consultar nada a la
 * federación mientras se juega.
 */

export type FichaPartido = {
  /** `<equipo>-<fecha>`: un equipo juega un partido al día, así que es único. */
  id: string;
  equipo: string;
  nombreEquipo: string;
  local: string;
  visitante: string;
  escudoLocal: string | null;
  escudoVisitante: string | null;
  competicion: string;
  jornada: string;
  /**
   * Minutos por parte de esta categoría. Se copia aquí y no se deduce después
   * para que el reloj no dependa de nada externo: si mañana cambia la tabla o
   * el equipo sube de categoría, un partido ya retransmitido sigue contando
   * como se contó.
   */
  minutosPorParte: number;
  fecha: string | null;
  hora: string | null;
  campo: string | null;
};

export type Registro = {
  partido: FichaPartido;
  eventos: Evento[];
  /** Sube con cada escritura. Es lo que va en el ETag de la lectura. */
  version: number;
  actualizado: string;
};

const rutaDe = (id: string) => `directo/${id}.json`;

/**
 * Un partido no puede crecer sin fin. Noventa minutos dan de sobra con esto, y
 * pone un techo a lo que puede escribir un enlace que se haya ido de las manos.
 */
export const MAX_EVENTOS = 500;

/* ------------------------------------------------------------ almacenamiento */

/*
 * En producción manda el almacén privado. Fuera de producción, si no hay token
 * configurado, se guarda en disco dentro de .next/cache para poder desarrollar
 * y probar el directo sin necesitar secretos. El respaldo NUNCA actúa en
 * producción: allí, si falta el token, es un fallo de configuración que hay que
 * ver, no algo que disimular.
 */
const enDisco = !hayAlmacenPrivado && process.env.NODE_ENV !== "production";
const CARPETA_LOCAL = path.join(process.cwd(), ".next", "cache", "directo");

const rutaLocal = (id: string) => path.join(CARPETA_LOCAL, `${id}.json`);

async function leer(id: string): Promise<Registro | null> {
  if (enDisco) {
    try {
      return JSON.parse(await fs.readFile(rutaLocal(id), "utf8")) as Registro;
    } catch {
      return null;
    }
  }
  return leerPrivado<Registro | null>(rutaDe(id), null);
}

async function escribir(registro: Registro): Promise<boolean> {
  if (enDisco) {
    await fs.mkdir(CARPETA_LOCAL, { recursive: true });
    await fs.writeFile(rutaLocal(registro.partido.id), JSON.stringify(registro), "utf8");
    return true;
  }
  return escribirPrivado(rutaDe(registro.partido.id), registro);
}

/* ------------------------------------------------------------------ lectura */

export const leerRegistro = leer;

/* ----------------------------------------------------------------- escritura */

/** Abre la retransmisión de un partido, o devuelve la que ya estuviera abierta. */
export async function abrirRegistro(partido: FichaPartido): Promise<Registro> {
  const existente = await leer(partido.id);
  if (existente) return existente;

  const nuevo: Registro = {
    partido,
    eventos: [],
    version: 1,
    actualizado: new Date().toISOString(),
  };
  await escribir(nuevo);
  return nuevo;
}

/**
 * Añade eventos al partido y devuelve el registro entero.
 *
 * La mezcla es por id, así que reenviar lo ya guardado no duplica nada: es lo
 * que permite que el móvil del campo reintente a ciegas cuando la cobertura va
 * y viene. Se devuelve el registro completo para que quien escribe pueda
 * comparar con su cola y reenviar lo que no vea confirmado; así, si dos
 * dispositivos escriben a la vez y una escritura se pierde, se recupera sola
 * en el evento siguiente.
 */
export async function anotarEventos(
  id: string,
  nuevos: Evento[],
): Promise<Registro | null> {
  const registro = await leer(id);
  if (!registro) return null;

  const conocidos = new Set(registro.eventos.map((e) => e.id));
  const anadir = nuevos.filter((e) => !conocidos.has(e.id));

  if (anadir.length === 0) return registro;

  const eventos = [...registro.eventos, ...anadir].slice(0, MAX_EVENTOS);
  const actualizado: Registro = {
    ...registro,
    eventos,
    version: registro.version + 1,
    actualizado: new Date().toISOString(),
  };

  if (!(await escribir(actualizado))) return null;
  return actualizado;
}
