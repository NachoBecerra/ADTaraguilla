/**
 * El partido en directo: eventos dentro, estado fuera.
 *
 * La decisión de fondo es que **el marcador no se guarda en ninguna parte**.
 * Lo que se guarda es lo que fue pasando —empieza, gol, tarjeta, descanso— y
 * el marcador, el reloj y la fase se calculan plegando esa lista. De ahí salen
 * casi todas las propiedades buenas del directo:
 *
 * - La cronología y el resultado no pueden contradecirse, porque el resultado
 *   *es* la cronología sumada.
 * - Cada evento lo identifica quien lo escribe, así que reenviarlo es
 *   inofensivo. En un campo con cobertura mala se encola y se reintenta a
 *   ciegas, sin miedo a contar el gol dos veces.
 * - Corregir es añadir, no borrar: un evento `anula` retira otro y el registro
 *   queda entero.
 *
 * Aquí no hay red ni almacenamiento: son funciones puras, y por eso son las
 * que se pueden probar sin montar nada.
 */

/** Los dos lados del partido, tal y como los nombra la RFAF. */
export type Lado = "local" | "visitante";

/**
 * Momento en que ocurrió algo, en milisegundos, según el móvil de quien lo
 * escribe. Se guarda el instante y no el minuto: el minuto se deriva, así que
 * si hay que corregir el arranque del partido, todos los minutos se recolocan
 * solos en vez de quedarse mintiendo.
 */
type Marca = { id: string; ts: number };

export type Evento = Marca &
  (
    | { tipo: "inicio" }
    | { tipo: "gol"; equipo: Lado }
    | { tipo: "tarjeta"; equipo: Lado; color: "amarilla" | "roja" }
    /* El reloj se para por una asistencia, una lesión o lo que sea. */
    | { tipo: "parar" }
    | { tipo: "reanudar" }
    /* Fin de la parte que se esté jugando: no dice cuál. */
    | { tipo: "finParte" }
    | { tipo: "empezarParte" }
    | { tipo: "final" }
    | { tipo: "texto"; mensaje: string }
    | { tipo: "anula"; anulado: string }
  );

export type Fase = "sin-empezar" | "jugando" | "parado" | "descanso" | "final";

/**
 * Partes que tiene un partido. Todas las categorías del club juegan dos.
 *
 * Se cierra aquí, en el plegado, y no solo escondiendo el botón: una pantalla
 * abierta desde antes de un cambio, o un segundo móvil, podrían mandar un
 * "empezar parte" de más y el reloj se iría a un tercer tiempo que no existe.
 *
 * Si alguna categoría pasara a jugar tres tiempos, es cambiar este número.
 */
export const PARTES = 2;

/**
 * El minuto de un partido, que no es solo un número.
 *
 * Cada parte arranca en su minuto nominal —la segunda del benjamín empieza en
 * el 30 y la del juvenil en el 45— y lo que pase pasado el tiempo reglamentario
 * es descuento, que se enseña como "45+2" y no como "47'". Es la forma en que
 * se cuenta el fútbol en todas partes, y la única que cuadra con lo que ve
 * quien está en la grada.
 */
export type Minuto = {
  /** Minuto corrido del partido, contando desde el saque inicial. */
  valor: number;
  /** Dónde acaba el tiempo reglamentario de la parte en curso. */
  limite: number;
  descuento: boolean;
  /** Minutos que se llevan de descuento, 0 si aún se juega el reglamentario. */
  anadido: number;
  /** Lo que se pinta: "37'" o "45+2". */
  etiqueta: string;
};

/** Un evento ya colocado en la cronología, con el minuto que le corresponde. */
export type EventoEnLinea = Exclude<Evento, { tipo: "anula" }> & { minuto: Minuto };

export type Estado = {
  fase: Fase;
  /** 1 la primera parte, 2 la segunda… 0 si aún no ha empezado. */
  parte: number;
  goles: Record<Lado, number>;
  /** Lo que dura cada parte en esta categoría. */
  minutosPorParte: number;
  /** Tiempo jugado **de la parte en curso** hasta el último corte del reloj. */
  jugadoParteMs: number;
  /** Desde cuándo corre el reloj, o null si está parado. */
  corriendoDesde: number | null;
  /**
   * Cuándo se pitó el final, o null si el partido no se ha cerrado.
   *
   * Lo necesitan tres cosas distintas: cuánto sigue valiendo el enlace de quien
   * escribe, cuánto se sigue enseñando el partido en las tarjetas y cuándo
   * desaparece del panel.
   */
  finMs: number | null;
  /** Del más antiguo al más reciente: el último evento va al final. */
  linea: EventoEnLinea[];
};

/**
 * Minuto que marca el reloj en un instante dado.
 *
 * Es lo que permite sondear cada pocos segundos sin que se note: el reloj no lo
 * sirve el servidor, lo cuenta cada navegador a partir del último corte. Entre
 * pregunta y pregunta nadie ve un número congelado.
 */
export function minutoEn(estado: Estado, ahora: number): Minuto {
  const corriendo = estado.corriendoDesde === null ? 0 : ahora - estado.corriendoDesde;

  /*
   * Nunca por debajo de cero. El instante del evento lo pone el móvil de quien
   * escribe y el "ahora" lo pone cada espectador, así que basta con que un
   * reloj vaya unos segundos por detrás para que la resta salga negativa: sin
   * este tope, `Math.floor` de una fracción negativa daría un -1' en pantalla
   * justo al pitar el inicio.
   */
  const enLaParte = Math.max(0, Math.floor((estado.jugadoParteMs + corriendo) / 60_000));

  /* Antes del saque no hay parte en curso, pero el minuto que toca es el 0 */
  const parte = Math.max(estado.parte, 1);
  const limite = parte * estado.minutosPorParte;
  const valor = (parte - 1) * estado.minutosPorParte + enLaParte;
  const anadido = Math.max(0, valor - limite);
  const descuento = anadido > 0;

  /*
   * En el descuento no se sigue contando hacia arriba: se enseña "45+2", como
   * en cualquier retransmisión. Decir "47'" en un partido cuyo primer tiempo
   * dura 45 no se corresponde con nada de lo que ve quien está en la grada.
   */
  return {
    valor,
    limite,
    descuento,
    anadido,
    etiqueta: descuento ? `${limite}+${anadido}` : `${valor}'`,
  };
}

/**
 * Orden estable de los eventos, y uno solo por id.
 *
 * Por instante, y a igualdad de instante por id: dos dispositivos que mezclen
 * la misma lista tienen que llegar al mismo orden, o verían cronologías
 * distintas del mismo partido.
 *
 * Lo repetido se descarta **aquí** y no solo al guardar, porque es aquí donde
 * se sostiene la promesa de que reenviar es inofensivo. Quien escribe pliega
 * su propia cola pendiente junto a lo que ya le ha confirmado el servidor, así
 * que ve las dos copias del mismo gol antes de que ningún servidor intervenga.
 */
function enOrden(eventos: Evento[]): Evento[] {
  const unicos = new Map<string, Evento>();
  for (const e of eventos) if (!unicos.has(e.id)) unicos.set(e.id, e);
  return [...unicos.values()].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
}

/**
 * De la lista de eventos al estado del partido.
 *
 * El minuto de cada evento se calcula **antes** de aplicarlo, para que el gol
 * que hace empezar una parte no salga ya con el minuto de la siguiente.
 *
 * `minutosPorParte` viene de la categoría y se guarda con el partido, no se
 * deduce de los eventos: es lo que hace que la segunda parte del benjamín
 * empiece en el 30 aunque el árbitro pitara el descanso en el 32.
 */
export function plegar(eventos: Evento[], minutosPorParte: number): Estado {
  /* Lo anulado se recoge antes de recorrer nada: un evento puede anularse
     mucho después de haber ocurrido. */
  const anulados = new Set(
    eventos.flatMap((e) => (e.tipo === "anula" ? [e.anulado] : [])),
  );

  const estado: Estado = {
    fase: "sin-empezar",
    parte: 0,
    goles: { local: 0, visitante: 0 },
    minutosPorParte,
    jugadoParteMs: 0,
    corriendoDesde: null,
    finMs: null,
    linea: [],
  };

  /** Corta el reloj y guarda lo jugado de esta parte. */
  const detener = (ts: number) => {
    if (estado.corriendoDesde !== null) {
      estado.jugadoParteMs += ts - estado.corriendoDesde;
      estado.corriendoDesde = null;
    }
  };

  for (const evento of enOrden(eventos)) {
    // Un `anula` no se dibuja, y anular un `anula` no devuelve nada a la vida
    if (evento.tipo === "anula" || anulados.has(evento.id)) continue;

    // No hay tercera parte: se descarta en vez de inventar un tiempo que no existe
    if (evento.tipo === "empezarParte" && estado.parte >= PARTES) continue;

    /*
     * Casi todo se fecha con el reloj tal y como estaba justo antes: el gol
     * del 58 es del 58, y el pitido que cierra una parte pertenece a esa parte
     * —por eso sale "45+3" y no "48'"—.
     *
     * Los dos eventos que **inauguran** una parte son la excepción: se fechan
     * ya dentro de ella. Si no, "empieza la segunda parte" heredaría el
     * descuento de la primera y aparecería como "45+" en vez de como "45'",
     * que es justo el minuto en el que arranca.
     */
    const inauguraParte = evento.tipo === "inicio" || evento.tipo === "empezarParte";
    const minutoPrevio = inauguraParte ? null : minutoEn(estado, evento.ts);

    switch (evento.tipo) {
      case "inicio":
        estado.fase = "jugando";
        estado.parte = 1;
        estado.jugadoParteMs = 0;
        estado.corriendoDesde = evento.ts;
        estado.finMs = null;
        break;

      case "parar":
        detener(evento.ts);
        estado.fase = "parado";
        break;

      case "reanudar":
        estado.corriendoDesde = evento.ts;
        estado.fase = "jugando";
        break;

      case "finParte":
        detener(evento.ts);
        estado.fase = "descanso";
        break;

      case "empezarParte":
        /* El reloj de la parte nueva arranca de cero; el minuto que se enseña
           lo pone la parte, no lo que se jugó en la anterior. */
        estado.parte += 1;
        estado.jugadoParteMs = 0;
        estado.corriendoDesde = evento.ts;
        estado.fase = "jugando";
        // Reanudar tras un final anulado deja de contar como terminado
        estado.finMs = null;
        break;

      case "final":
        detener(evento.ts);
        estado.fase = "final";
        estado.finMs = evento.ts;
        break;

      case "gol":
        estado.goles[evento.equipo] += 1;
        break;

      case "tarjeta":
      case "texto":
        // No mueven ni el marcador ni el reloj: solo se cuentan
        break;
    }

    estado.linea.push({ ...evento, minuto: minutoPrevio ?? minutoEn(estado, evento.ts) });
  }

  return estado;
}

/* --------------------------------------------------------------- validación */

/** Tipos que acepta el registro. Lo que no esté aquí se descarta sin más. */
const TIPOS = new Set([
  "inicio", "gol", "tarjeta", "parar", "reanudar",
  "finParte", "empezarParte", "final", "texto", "anula",
]);

const LADOS = new Set<string>(["local", "visitante"]);

/** Como mucho, esto de largo tiene un comentario. Es una web, no un chat. */
export const LARGO_TEXTO = 200;

/**
 * Tope de eventos de un partido.
 *
 * Es a la vez lo que cabe en un envío, porque quien escribe manda siempre su
 * registro entero y no solo lo último. Noventa minutos dan de sobra con esto, y
 * pone un techo a lo que puede escribir un enlace que se haya ido de las manos.
 */
export const MAX_EVENTOS = 500;

/**
 * Convierte lo que llega por la red en eventos de verdad.
 *
 * Quien escribe manda desde su móvil, con un enlace que puede acabar reenviado
 * a un grupo de WhatsApp, así que nada de lo que entra se guarda tal cual.
 *
 * El instante se recorta al rango razonable en vez de rechazarse: si el móvil
 * llevaba media hora sin cobertura, ese gol es viejo y hay que quedárselo
 * igualmente; y si el reloj del dispositivo está mal puesto, más vale un
 * minuto algo torcido que perder el gol.
 */
export function sanearEventos(datos: unknown, ahora: number): Evento[] {
  if (!Array.isArray(datos)) return [];

  const antes = ahora - 6 * 60 * 60_000;
  const despues = ahora + 5 * 60_000;
  const limpios: Evento[] = [];

  for (const bruto of datos.slice(0, MAX_EVENTOS)) {
    if (typeof bruto !== "object" || bruto === null) continue;
    const e = bruto as Record<string, unknown>;

    const id = typeof e.id === "string" ? e.id.slice(0, 64) : "";
    if (!/^[A-Za-z0-9_-]+$/.test(id)) continue;
    if (typeof e.tipo !== "string" || !TIPOS.has(e.tipo)) continue;
    if (typeof e.ts !== "number" || !Number.isFinite(e.ts)) continue;

    const ts = Math.min(Math.max(e.ts, antes), despues);

    switch (e.tipo) {
      case "gol":
        if (!LADOS.has(e.equipo as string)) continue;
        limpios.push({ id, ts, tipo: "gol", equipo: e.equipo as Lado });
        break;

      case "tarjeta":
        if (!LADOS.has(e.equipo as string)) continue;
        if (e.color !== "amarilla" && e.color !== "roja") continue;
        limpios.push({ id, ts, tipo: "tarjeta", equipo: e.equipo as Lado, color: e.color });
        break;

      case "texto": {
        const mensaje = typeof e.mensaje === "string" ? e.mensaje.trim().slice(0, LARGO_TEXTO) : "";
        if (!mensaje) continue;
        limpios.push({ id, ts, tipo: "texto", mensaje });
        break;
      }

      case "anula": {
        const anulado = typeof e.anulado === "string" ? e.anulado.slice(0, 64) : "";
        if (!/^[A-Za-z0-9_-]+$/.test(anulado)) continue;
        limpios.push({ id, ts, tipo: "anula", anulado });
        break;
      }

      default:
        // Los de fase no llevan datos propios: basta con el tipo y el instante
        limpios.push({ id, ts, tipo: e.tipo } as Evento);
    }
  }

  return limpios;
}

/**
 * Un evento tal y como lo compone la pantalla, antes de ponerle identificador
 * e instante.
 *
 * Se distribuye sobre la unión a propósito: un `Omit` normal sobre una unión
 * se queda con las claves comunes, y perdería el equipo del gol o el color de
 * la tarjeta.
 */
export type EventoNuevo = Evento extends infer T
  ? T extends Evento
    ? Omit<T, "id" | "ts">
    : never
  : never;
