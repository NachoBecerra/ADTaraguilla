import fs from "node:fs/promises";
import path from "node:path";
import { escribirPrivado, hayAlmacenPrivado, leerPrivado } from "@/lib/privado";
import { MAX_EVENTOS, type Evento } from "@/lib/directo/modelo";

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
  /*
   * Sin caché, siempre. El almacén sirve por una caché cuya vigencia mínima es
   * de un minuto, y aquí se lee para modificar y volver a guardar cada pocos
   * segundos: una lectura de hace un minuto haría perder todo lo apuntado en
   * ese minuto.
   */
  return leerPrivado<Registro | null>(rutaDe(id), null, { sinCache: true });
}

async function escribir(registro: Registro): Promise<boolean> {
  if (enDisco) {
    await fs.mkdir(CARPETA_LOCAL, { recursive: true });
    await fs.writeFile(rutaLocal(registro.partido.id), JSON.stringify(registro), "utf8");
    return true;
  }
  // El mínimo que admite el almacén. Un partido en directo no se parece en
  // nada a lo que justifica el mes de caché que trae por defecto.
  return escribirPrivado(rutaDe(registro.partido.id), registro, { cacheMaxAge: 60 });
}

/* ------------------------------------------------------------------ lectura */

export const leerRegistro = leer;

/* ----------------------------------------------------------------- escritura */

/**
 * Crea el partido **solo si no existe**. Devuelve false si ya estaba.
 *
 * No vale con haber mirado antes: leer devuelve lo mismo cuando el partido no
 * existe que cuando el almacén no contesta, y confundir esas dos cosas
 * significaría arrasar un partido en curso.
 */
async function crear(registro: Registro): Promise<boolean> {
  if (enDisco) {
    await fs.mkdir(CARPETA_LOCAL, { recursive: true });
    try {
      // "wx": falla si el archivo ya existe
      await fs.writeFile(rutaLocal(registro.partido.id), JSON.stringify(registro), {
        encoding: "utf8",
        flag: "wx",
      });
      return true;
    } catch {
      return false;
    }
  }
  return escribirPrivado(rutaDe(registro.partido.id), registro, {
    cacheMaxAge: 60,
    sobrescribir: false,
  });
}

/**
 * Abre la retransmisión de un partido, o devuelve la que ya estuviera abierta.
 *
 * Es lo que se llama al pedir el enlace desde el panel, y se pide más de una
 * vez: para mandárselo a otra persona si al del campo se le muere el móvil, o
 * simplemente para volver a copiarlo. Por eso **nunca** puede empezar de cero
 * un partido que ya se está jugando.
 */
export async function abrirRegistro(partido: FichaPartido): Promise<Registro> {
  const existente = await leer(partido.id);
  if (existente) return existente;

  const nuevo: Registro = {
    partido,
    eventos: [],
    version: 1,
    actualizado: new Date().toISOString(),
  };

  if (await crear(nuevo)) return nuevo;

  /*
   * No se ha podido crear, casi siempre porque ya existía y la lectura de
   * arriba falló. Se vuelve a leer antes que dar por bueno un partido vacío.
   */
  return (await leer(partido.id)) ?? nuevo;
}

/**
 * Une lo recibido con lo guardado y devuelve el partido entero.
 *
 * Quien escribe manda **todo lo que sabe**, no solo lo último, y aquí se hace
 * la unión por id. Parece redundante y es justo lo que salva el directo: si la
 * lectura de arriba devolviera una versión atrasada, quedarse solo con ella y
 * añadirle el gol nuevo borraría media cronología. Mandando el registro
 * completo, lo peor que puede pasar es reescribir lo mismo.
 *
 * Por eso nunca se depende de la relectura para tener razón: el móvil del
 * campo es quien la tiene mientras dura el partido.
 *
 * Se devuelve la unión y no lo leído, para que quien escribe pueda comparar con
 * su cola y reenviar lo que no vea confirmado. Con dos dispositivos a la vez,
 * cada uno sigue mandando su lista entera y el registro converge solo.
 */
export async function anotarEventos(
  id: string,
  recibidos: Evento[],
): Promise<Registro | null> {
  const registro = await leer(id);
  if (!registro) return null;

  const union = new Map(registro.eventos.map((e) => [e.id, e]));
  let nuevos = 0;
  for (const e of recibidos) {
    if (union.has(e.id)) continue;
    union.set(e.id, e);
    nuevos++;
  }

  const eventos = [...union.values()]
    .sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id))
    .slice(0, MAX_EVENTOS);

  // Nada que no tuviéramos: se contesta con lo que hay, sin gastar una escritura
  if (nuevos === 0) return { ...registro, eventos };

  const actualizado: Registro = {
    ...registro,
    eventos,
    version: registro.version + 1,
    actualizado: new Date().toISOString(),
  };

  if (!(await escribir(actualizado))) return null;
  return actualizado;
}
