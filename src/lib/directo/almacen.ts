import {
  almacenEnDisco,
  borrarJson,
  crearJson,
  escribirJson,
  leerJson,
  listarJson,
} from "@/lib/directo/deposito";
import { revalidateTag, unstable_cache } from "next/cache";
import { MAX_EVENTOS, type Evento } from "@/lib/directo/modelo";
import { borrarSeguidores } from "@/lib/directo/seguidores";

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
  /**
   * Un partido que no existe en la RFAF: un amistoso, un torneo de verano.
   *
   * Se marca porque hay que decirlo en pantalla —no va a aparecer nunca en
   * resultados ni en la clasificación— y porque es lo único que el club puede
   * borrar entero desde el panel. Lo de la federación no se borra: se reinicia.
   */
  amistoso?: boolean;
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
  /**
   * Cuándo se abrió esta retransmisión. Cambia al reiniciarla desde el panel.
   *
   * Sirve para distinguir "el mismo partido" de "el mismo partido, empezado de
   * cero". Quien escribe manda todo lo que sabe en cada envío, así que sin esto
   * una botonera abierta desde antes del reinicio devolvería el partido viejo
   * entero en cuanto pulsara cualquier cosa.
   */
  abierto: string;
  /**
   * El club ha dicho en la web que este partido se va a retransmitir.
   *
   * Es una decisión aparte de abrir la retransmisión, y a propósito: abrirla
   * solo prepara el enlace, y muchos partidos se quedan sin retransmitir
   * porque nadie puede estar en la grada apuntando. Anunciar un directo que
   * luego no llega es peor que no anunciarlo, así que se marca a mano y solo
   * cuando ya se sabe que habrá alguien.
   */
  anunciado?: boolean;
  /**
   * Qué generación del enlace de escribir vale ahora mismo.
   *
   * El enlace se reenvía: se le manda al entrenador, el entrenador lo pone en
   * el grupo de padres y de pronto lo tienen cuarenta personas. Si eso se va de
   * las manos a mitad de partido, subir este número deja fuera de golpe a todos
   * los enlaces repartidos **sin tocar la retransmisión**: la cronología sigue
   * donde estaba y se reparte un enlace limpio.
   *
   * Sin número es la primera generación. Los enlaces repartidos antes de que
   * esto existiera siguen valiendo, que si no una retransmisión en marcha se
   * quedaría muda al desplegar.
   */
  llave?: number;
};

/** La generación de enlace que vale para este partido. */
export const llaveDe = (registro: { llave?: number } | null | undefined): number =>
  registro?.llave && registro.llave > 0 ? registro.llave : 1;

const CARPETA = "directo";

/**
 * Cada cuánto se vuelve a pedir la lista del almacén, como mucho.
 *
 * Larga a propósito, porque no es la que manda: la lista se tira en cuanto se
 * abre o se borra una retransmisión, que son las dos únicas cosas que la
 * cambian. Esto es solo la red de seguridad por si alguna vez se colara un
 * cambio por otro sitio.
 */
const VIGENCIA_LISTA_S = 4 * 3600;

const ETIQUETA_LISTA = "directo-rutas";
const rutaDe = (id: string) => `${CARPETA}/${id}.json`;

/* ------------------------------------------------------------ almacenamiento */

/*
 * Todo pasa por el depósito, que además del almacén privado sabe caer a disco
 * fuera de producción para poder desarrollar el directo sin secretos.
 */
const leer = (id: string) => leerJson<Registro | null>(rutaDe(id), null);
const escribir = (r: Registro) => escribirJson(rutaDe(r.partido.id), r);
const crear = (r: Registro) => crearJson(rutaDe(r.partido.id), r);

/**
 * Rutas de todas las retransmisiones guardadas.
 *
 * Vive aquí, con el resto del acceso al almacén, y no en quien la usa: si se
 * llamara a `listarPrivado` desde fuera, el respaldo en disco de desarrollo se
 * saltaría y en local no se encontraría nunca nada.
 */
const listaCacheada = unstable_cache(() => listarJson(CARPETA), [ETIQUETA_LISTA], {
  tags: [ETIQUETA_LISTA],
  revalidate: VIGENCIA_LISTA_S,
});

export async function listarRegistros(): Promise<string[]> {
  /* Contra el disco no hay nada que ahorrar, y una caché rompería las pruebas,
     que borran la carpeta entre suite y suite */
  return almacenEnDisco ? listarJson(CARPETA) : listaCacheada();
}

/**
 * Tira la lista guardada. Se llama al abrir o al borrar una retransmisión.
 *
 * Solo puede llamarse desde una acción de servidor o una ruta de API, que es de
 * donde vienen las dos cosas que cambian la lista.
 */
function olvidarLista(): void {
  /* En disco no hay lista guardada que tirar, y hacerlo igualmente le da un
     repaso de mas al router de Next en desarrollo */
  if (almacenEnDisco) return;

  try {
    /* `expire: 0`: no vale servir la lista vieja mientras se rehace. Un partido
       que se acaba de abrir tiene que salir ya, y esto pasa cuatro veces por
       semana, no cuatro veces por minuto */
    revalidateTag(ETIQUETA_LISTA, { expire: 0 });
  } catch {
    // Fuera de una acción no se puede, y tampoco hace falta: caduca sola
  }
}

/**
 * Se asegura de que este partido esté en la lista guardada.
 *
 * La lista se tira al abrir una retransmisión, que es cuando cambia. Esto es lo
 * que pasa si aquello falla: en cuanto se apunta la primera jugada se comprueba
 * que el partido figura, y si no, se tira la lista.
 *
 * Parece de más y no lo es. La lista guardada dura horas, y lo que decide es si
 * la portada enseña el partido: quedarse fuera significaría un directo que se
 * está escribiendo y que nadie ve. Comprobarlo no cuesta nada —la lista ya está
 * guardada— y en el caso normal no hace nada.
 */
async function asegurarEnLista(id: string): Promise<void> {
  if (almacenEnDisco) return;

  const rutas = await listarRegistros();
  if (!rutas.includes(rutaDe(id))) olvidarLista();
}

/* ------------------------------------------------------------------ lectura */

export const leerRegistro = leer;

/**
 * Borra una retransmisión y todo lo que tenga dentro.
 *
 * Solo para los partidos que creó el club a mano. Un partido de la RFAF no se
 * borra nunca desde aquí: se reinicia, que deja la cronología en blanco pero
 * mantiene el partido. Este sí desaparece sin dejar rastro, que es justo para
 * lo que se creó.
 */
export async function borrarRegistro(id: string): Promise<void> {
  await borrarJson(rutaDe(id));
  olvidarLista();
  // Y su cuenta de seguidores: borrar un amistoso no puede dejar restos
  await borrarSeguidores(id);
}

/* ----------------------------------------------------------------- escritura */

/** Un partido recién abierto: sin nada apuntado todavía. */
function enBlanco(partido: FichaPartido, anunciado = false, llave = 1): Registro {
  const ahora = new Date().toISOString();
  return {
    partido,
    eventos: [],
    version: 1,
    actualizado: ahora,
    abierto: ahora,
    anunciado,
    llave,
  };
}

/**
 * Invalida los enlaces de escribir repartidos hasta ahora y devuelve el nuevo.
 *
 * Lo que se busca es cortar por lo sano cuando un enlace se reparte más de la
 * cuenta y empieza a aparecer lo que no debe. **No borra nada**: la cronología,
 * el marcador y los seguidores se quedan como están, y quien reciba el enlace
 * nuevo sigue el partido justo donde iba. Es la diferencia con reiniciar.
 *
 * El enlace del público no se toca: ese es de solo mirar y no hay nada que
 * proteger en él.
 */
export async function renovarLlave(id: string): Promise<number | null> {
  const registro = await leer(id);
  if (!registro) return null;

  const llave = llaveDe(registro) + 1;
  const guardado = await escribir({
    ...registro,
    llave,
    version: registro.version + 1,
    actualizado: new Date().toISOString(),
  });

  return guardado ? llave : null;
}

/**
 * Dice si el club anuncia este partido en la web, o deja de anunciarlo.
 *
 * Se lee y se vuelve a escribir en vez de escribir a ciegas: aquí puede haber
 * una retransmisión en marcha, y machacarla con un registro vacío por cambiar
 * una casilla sería perder el partido entero.
 */
export async function marcarAnuncio(id: string, anunciado: boolean): Promise<boolean> {
  const registro = await leer(id);
  if (!registro) return false;
  if (Boolean(registro.anunciado) === anunciado) return true;

  return escribir({
    ...registro,
    anunciado,
    version: registro.version + 1,
    actualizado: new Date().toISOString(),
  });
}

/**
 * Borra lo apuntado y deja el partido como recién abierto.
 *
 * Se escribe encima a propósito, sin mirar antes lo que hubiera: es una acción
 * deliberada desde el panel y con la contraseña del club, así que aquí la
 * intención es justo pisar lo que hay.
 *
 * Al cambiar `abierto`, cualquier botonera que siguiera abierta con el partido
 * anterior deja de poder escribir, y se le pide que recargue. Sin eso volvería
 * a mandar todo lo viejo y el reinicio no serviría de nada.
 */
export async function reiniciarRegistro(partido: FichaPartido): Promise<Registro | null> {
  /* El anuncio sobrevive al reinicio. No es algo apuntado del partido, es una
     decisión del club sobre la portada: quien borra una prueba del sábado por
     la mañana no está diciendo que ya no vaya a haber directo, y que el aviso
     desapareciera sin avisar sería peor que dejarlo. Para quitarlo está la
     casilla. */
  const previo = await leer(partido.id);
  /* La llave también se conserva: empezar el partido de cero no tiene por qué
     revivir los enlaces que el club dejó fuera a propósito */
  const nuevo = enBlanco(partido, Boolean(previo?.anunciado), llaveDe(previo));
  return (await escribir(nuevo)) ? nuevo : null;
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

  const nuevo = enBlanco(partido);
  if (await crear(nuevo)) {
    // Hay un partido más en el almacén: la lista guardada ya no vale
    olvidarLista();
    return nuevo;
  }

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

  /* Y de paso, que la portada se entere de que este partido existe */
  await asegurarEnLista(registro.partido.id);

  return actualizado;
}
