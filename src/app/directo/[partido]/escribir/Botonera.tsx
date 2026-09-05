"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  plegar,
  minutoEn,
  LARGO_TEXTO,
  PARTES,
  type Evento,
  type EventoNuevo,
  type Jugada,
  type Lado,
} from "@/lib/directo/modelo";
import type { Registro } from "@/lib/directo/almacen";
import CampoQueCrece from "@/components/CampoQueCrece";
import Cronologia from "@/components/Cronologia";
import ContadorSeguidores from "@/components/ContadorSeguidores";
import { olvidarMando, recordarMando } from "@/components/VolverAlDirecto";

/**
 * La pantalla de quien está en el campo.
 *
 * Todo lo de aquí está pensado para un móvil al sol, con una mano y con prisa:
 *
 * - **Se apunta al instante y se pregunta después.** El evento entra en la
 *   cronología en cuanto se pulsa; el envío va por detrás. Esperar a que
 *   conteste el servidor para pintar el gol haría la pantalla inservible en un
 *   campo con cobertura intermitente.
 * - **La cola sobrevive a todo.** Lo que está sin mandar se guarda en el propio
 *   móvil, así que cerrar el navegador o quedarse sin cobertura media parte no
 *   pierde nada: al volver se reenvía.
 * - **Reintentar es gratis.** Cada evento lleva su identificador y el servidor
 *   mezcla por identificador, así que mandar dos veces el mismo gol no lo
 *   cuenta dos veces.
 * - **Un solo botón de fase.** Nunca se ve un botón que no toca, de modo que no
 *   se puede pulsar "Final" en el minuto tres.
 * - **Se pregunta además de mandar.** Si hay dos personas apuntando, cada una
 *   ve lo que hace la otra.
 */

const CADA_REINTENTO_MS = 5_000;

/**
 * Cada cuánto se pregunta al servidor qué hay.
 *
 * Puede haber dos personas apuntando el mismo partido —el delegado y alguien de
 * la directiva, o el mismo móvil abierto dos veces—. Sin esto, cada uno vería
 * solo lo suyo y el marcador de su pantalla no cuadraría con el de la web.
 */
const CADA_PREGUNTA_MS = 5_000;

/**
 * Lo que los botones quedan sordos después de apuntar algo.
 *
 * Se celebra un gol con el móvil en la mano, y el dedo se va. Sin esto, un
 * doble toque mete dos goles y hay que darse cuenta y corregirlo. Tres segundos
 * no estorban —no hay dos goles seguidos en un partido de fútbol— y evitan el
 * error más tonto de todos.
 *
 * **Deshacer no se bloquea nunca.** Si uno se equivoca, se da cuenta en el
 * segundo siguiente: bloquear también la corrección sería dejarle mirando la
 * pantalla mientras el error está publicado.
 */
const BLOQUEO_MS = 3_000;

/**
 * Pone identificador e instante a lo que se acaba de pulsar.
 *
 * Vive fuera del componente porque el instante es del momento de la pulsación
 * y no del momento de dibujar la pantalla: son cosas distintas y mezclarlas
 * daría minutos que cambian solos al repintarse.
 */
function sellar(evento: EventoNuevo, cuando = Date.now()): Evento {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return { ...evento, id, ts: cuando } as Evento;
}

/**
 * Dónde guarda este móvil lo que aún no ha podido mandar.
 *
 * La clave lleva **la apertura además del partido**. Si no, al reiniciar el
 * partido desde el panel la cola pendiente sobreviviría a la recarga y volvería
 * a colar en el partido nuevo lo que se acababa de borrar: el rechazo del
 * servidor evita que se cuele en caliente, pero no vacía lo que ya estaba
 * guardado en el teléfono.
 */
const PREFIJO = "directo-pendientes-";

/**
 * Si este móvil quiere que la pantalla no se apague, recordado por dispositivo.
 *
 * Se lee con `useSyncExternalStore` y no con un efecto porque el almacenamiento
 * del navegador no existe en el servidor: así React pinta primero lo del
 * servidor y cambia después, sin dar la página por inconsistente.
 */
const CLAVE_PANTALLA = "directo-pantalla-encendida";

const oyentes = new Set<() => void>();

function guardarPreferencia(encendida: boolean) {
  try {
    localStorage.setItem(CLAVE_PANTALLA, encendida ? "si" : "no");
  } catch {
    // Sin almacenamiento la preferencia dura lo que dure la pantalla abierta
  }
  for (const avisar of oyentes) avisar();
}

const suscribir = (alCambiar: () => void) => {
  oyentes.add(alCambiar);
  return () => void oyentes.delete(alCambiar);
};

const leerPreferencia = () => {
  try {
    return localStorage.getItem(CLAVE_PANTALLA);
  } catch {
    return null;
  }
};

/** Si el móvil sabe mantener la pantalla encendida. En el ordenador, casi nunca. */
const sabeMantenerla = () => typeof navigator !== "undefined" && "wakeLock" in navigator;

const clave = (partido: string, abierto: string) => `${PREFIJO}${partido}-${abierto}`;

/**
 * Minutos de descuento a partir de los cuales se recuerda cerrar la parte.
 *
 * Nadie pita veinte minutos de descuento. Cuando el reloj llega ahí es que a
 * quien apunta se le pasó marcar el final —está mirando el partido, no el
 * móvil— y mientras tanto la web enseña "45+22" en la portada, que queda fatal
 * y además es mentira.
 *
 * Diez es holgado: un descuento largo de verdad son seis o siete.
 */
/**
 * Por qué esta pantalla ha dejado de servir.
 *
 * Se dice el motivo de verdad en cada caso. Quien está en la banda con el móvil
 * en la mano necesita saber si tiene que recargar, si ya no hay nada que hacer
 * o si hay un enlace nuevo que pedir; un «error» a secas le deja pulsando.
 */
const TITULO_CIERRE = {
  reiniciado: "Este partido se ha reiniciado.",
  cerrado: "Este partido ya está cerrado.",
  revocado: "Este enlace ya no vale.",
} as const;

const MOTIVO_CIERRE = {
  reiniciado:
    "Alguien lo ha empezado de cero desde el panel del club, así que desde aquí ya no se puede apuntar nada. Recarga la página para seguir.",
  cerrado:
    "Pasan unas horas desde el final y la retransmisión se cierra sola. La cronología sigue publicada; para cambiar algo, pide un enlace nuevo en el panel del club.",
  revocado:
    "El club ha generado un enlace nuevo para este partido. La retransmisión sigue adelante con todo lo apuntado: pide el enlace nuevo y podrás seguir desde donde iba.",
} as const;

const DESCUENTO_LARGO = 10;

/**
 * Los botones de cada equipo, en el orden en que se ven.
 *
 * Con texto y sin dibujo. Los iconos ocupaban la mitad del botón para decir
 * menos que la palabra: a 17 píxeles, un banderín de córner y uno de fuera de
 * juego son la misma mancha, y quien apunta desde la banda va con prisa.
 *
 * **El color dice el sentido**, que es lo que no cabe en la etiqueta: verde lo
 * que ese equipo hace bien —remata, saca, tira— y gris lo que hace mal. Así no
 * hay que recordar botón a botón si va a favor o en contra, que era la duda
 * que traía esto. Las tarjetas van con su color de siempre.
 *
 * El orden deja cuatro filas de dos justas debajo del gol, sin ningún botón
 * suelto al final, y los dos disparos juntos, que es donde se buscan.
 */
type BotonJugada = {
  clase: Jugada;
  texto: string;
  /** `favor` pinta verde; `contra`, gris. */
  sentido: "favor" | "contra";
};

const JUGADAS: BotonJugada[] = [
  { clase: "falta", texto: "Falta", sentido: "contra" },
  { clase: "fueraDeJuego", texto: "Fuera de juego", sentido: "contra" },
  { clase: "disparo", texto: "Disparo a puerta", sentido: "favor" },
  { clase: "disparoFuera", texto: "Disparo fuera", sentido: "favor" },
  { clase: "corner", texto: "Córner", sentido: "favor" },
  { clase: "penalti", texto: "Penalti", sentido: "favor" },
];

/* Fondo, borde y tinta de cada sentido. Los colores viven en globals.css */
const PINTA = {
  favor: "bg-favor border-favor-linea text-favor-tinta",
  contra: "bg-contra border-contra-linea text-contra-tinta",
  amarilla: "bg-amarilla border-amarilla-linea text-amarilla-tinta",
  roja: "bg-roja border-roja-linea text-roja-tinta",
} as const;

/** Común a todos: mismo alto, mismo tipo, y hueco para dos líneas. */
const BOTON_JUGADA =
  "flex min-h-14 items-center justify-center rounded-xl border px-1.5 py-2" +
  " text-center font-display text-[13px] font-bold uppercase leading-[1.15]" +
  " tracking-wide transition-transform active:scale-[.97] disabled:opacity-40";

export default function Botonera({
  inicial,
  token,
}: {
  inicial: Registro;
  token: string;
}) {
  const partido = inicial.partido;

  const [confirmados, setConfirmados] = useState<Evento[]>(inicial.eventos);
  /* Igual que la cola: el envío necesita la lista de verdad, no la del último
     render. */
  const confirmadosRef = useRef<Evento[]>(inicial.eventos);
  const [pendientes, setPendientes] = useState<Evento[]>([]);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  /* Para que el reloj avance solo entre pulsación y pulsación */
  const [ahora, setAhora] = useState(() => Date.now());

  const enviando = useRef(false);
  /* Para no retroceder si llega una respuesta más vieja que lo que ya tenemos */
  const version = useRef(inicial.version);
  const etag = useRef<string | null>(null);
  /**
   * Motivos por los que esta pantalla deja de servir del todo. En los tres
   * casos no es un fallo pasajero: no tiene sentido seguir pulsando.
   */
  const [cierre, setCierre] = useState<null | "reiniciado" | "cerrado" | "revocado">(null);

  /* Dar el partido por terminado cierra el directo: se pregunta antes */
  const [confirmandoFinal, setConfirmandoFinal] = useState(false);

  /**
   * Que el móvil no se apague mientras se apunta el partido.
   *
   * Es el arreglo de raíz de un problema que salió en el campo: al bloquearse
   * la pantalla, el sistema acaba cerrando la aplicación y hay que rehacer todo
   * el camino. Viene activado porque es lo que quiere quien está retransmitiendo,
   * y se puede apagar si se prefiere ahorrar batería.
   */
  const preferencia = useSyncExternalStore(suscribir, leerPreferencia, () => null);
  const hayWakeLock = useSyncExternalStore(() => () => {}, sabeMantenerla, () => false);
  /* Encendida salvo que se haya pedido lo contrario: es lo que quiere quien está
     retransmitiendo, y apagarla es cosa de un toque */
  const pantalla = preferencia !== "no";

  /* Botones sordos un momento después de cada acción, para el doble toque */
  const [bloqueado, setBloqueado] = useState(false);
  const relojBloqueo = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (relojBloqueo.current) clearTimeout(relojBloqueo.current);
    },
    [],
  );

  /*
   * La cola vive en un ref además de en el estado. El estado es para pintarla;
   * el ref es el que consultan el envío y el reintento, que ocurren fuera del
   * ciclo de render y necesitan la lista de verdad, no la de la última vez que
   * se dibujó la pantalla.
   */
  const cola = useRef<Evento[]>([]);

  const fijarCola = useCallback(
    (siguiente: Evento[]) => {
      cola.current = siguiente;
      setPendientes(siguiente);
      try {
        localStorage.setItem(clave(partido.id, inicial.abierto), JSON.stringify(siguiente));
      } catch {
        // Cuota llena: no es motivo para dejar de apuntar el partido
      }
    },
    [partido.id, inicial.abierto],
  );

  /* Al abrir: recuperar lo que quedó sin mandar de una sesión anterior */
  useEffect(() => {
    const mia = clave(partido.id, inicial.abierto);
    try {
      /*
       * Antes de nada, tirar las colas de aperturas anteriores de este mismo
       * partido: son de una retransmisión que ya se reinició y no deben volver.
       */
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(`${PREFIJO}${partido.id}-`) && k !== mia) localStorage.removeItem(k);
      }

      const guardado = localStorage.getItem(mia);
      if (!guardado) return;
      /*
       * El almacenamiento del navegador no existe mientras se renderiza en el
       * servidor, así que la cola no puede recuperarse antes de este momento.
       */
      cola.current = JSON.parse(guardado) as Evento[];
      setPendientes(cola.current);
    } catch {
      // Sin almacenamiento local se sigue igual, pero sin red de seguridad
    }
  }, [partido.id, inicial.abierto]);

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);

  /*
   * Mantener la pantalla encendida.
   *
   * El sistema lo suelta solo al pasar la aplicación a segundo plano, así que
   * hay que volver a pedirlo cada vez que se vuelve a ella. Si el navegador no
   * lo admite, no pasa nada: simplemente no se ofrece.
   */
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let permiso: WakeLockSentinel | null = null;

    const pedir = async () => {
      if (!pantalla || document.hidden) return;
      try {
        permiso = await navigator.wakeLock.request("screen");
      } catch {
        // Batería baja o pestaña de fondo: el sistema puede negarlo
      }
    };

    const soltar = async () => {
      try {
        await permiso?.release();
      } catch {
        // Ya estaba suelto
      }
      permiso = null;
    };

    if (pantalla) void pedir();
    else void soltar();

    const alVolver = () => {
      if (!document.hidden) void pedir();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      void soltar();
    };
  }, [pantalla]);

  /*
   * Este móvil se queda con el enlace. Si el sistema cierra la aplicación por
   * estar bloqueada, al volver a abrirla aparece un atajo arriba para seguir
   * apuntando de un toque, en vez de rehacer el camino por el panel.
   */
  useEffect(() => {
    if (!cierre) recordarMando(partido.id, token);
  }, [partido.id, token, cierre]);

  /**
   * Manda la cola y se queda con lo que el servidor dice que tiene guardado.
   *
   * Lo que no aparezca en la respuesta sigue pendiente y se reintenta: así, si
   * dos dispositivos escriben a la vez y una escritura se pierde, se recupera
   * sola en el envío siguiente.
   */
  const enviar = useCallback(async () => {
    if (enviando.current || cola.current.length === 0) return;

    enviando.current = true;
    try {
      /*
       * Se manda **todo** lo que sabe este móvil, no solo lo pendiente. El
       * almacén sirve por una caché con un minuto de vigencia mínima, así que
       * el servidor puede leer una versión atrasada del partido; si le
       * mandáramos únicamente el gol nuevo, lo añadiría a esa versión vieja y
       * borraría lo anterior. Mandando la lista entera, lo peor que puede pasar
       * es reescribir lo mismo.
       */
      const r = await fetch(`/api/directo/${partido.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          // Para que un envío de antes de un reinicio no resucite lo borrado
          abierto: inicial.abierto,
          eventos: [...confirmadosRef.current, ...cola.current],
        }),
        cache: "no-store",
      });

      if (r.status === 401) {
        /*
         * Caducar y quedarse fuera no es lo mismo, y a quien está en la banda
         * le cambia mucho: si el club ha repartido un enlace nuevo, esta
         * pantalla ya no vuelve sola y hay que decirlo, no dejar un aviso que
         * parece pasajero.
         */
        const detalle = (await r.json().catch(() => null)) as { revocado?: boolean } | null;
        if (detalle?.revocado) {
          /* Y se tira el atajo de vuelta: lleva a un enlace que ya no escribe */
          olvidarMando();
          setCierre("revocado");
          return;
        }
        setAviso("El enlace ha caducado. Pide uno nuevo en el panel del club.");
        return;
      }
      if (r.status === 409) {
        setCierre("reiniciado");
        return;
      }
      if (r.status === 403) {
        setCierre("cerrado");
        return;
      }
      if (!r.ok) return; // se reintenta solo

      const registro = (await r.json()) as Registro;
      const guardados = new Set(registro.eventos.map((e) => e.id));

      version.current = registro.version;
      etag.current = r.headers.get("etag");
      confirmadosRef.current = registro.eventos;
      setConfirmados(registro.eventos);
      fijarCola(cola.current.filter((e) => !guardados.has(e.id)));
      setAviso(null);
    } catch {
      // Sin cobertura: la cola se queda donde está y el reintento la recoge
    } finally {
      enviando.current = false;
    }
  }, [partido.id, token, fijarCola, inicial.abierto]);

  /**
   * Trae lo que haya apuntado otra persona.
   *
   * No se pregunta mientras hay un envío en marcha, ni se acepta una respuesta
   * con una versión igual o más vieja que la que ya tenemos: si no, una
   * respuesta que salió antes del último gol podría llegar después y borrarlo
   * de la pantalla durante unos segundos.
   *
   * Lo que este móvil tenga pendiente no se toca: se dibuja junto a lo que
   * llega, así que un gol recién pulsado no desaparece por preguntar.
   */
  const preguntar = useCallback(async () => {
    if (enviando.current || document.hidden) return;

    try {
      const r = await fetch(`/api/directo/${partido.id}`, {
        cache: "no-store",
        headers: etag.current ? { "If-None-Match": etag.current } : {},
      });
      if (r.status === 304 || !r.ok) return;

      const registro = (await r.json()) as Registro;

      // Reiniciado desde el panel: mejor enterarse sin tener que pulsar nada
      if (registro.abierto && registro.abierto !== inicial.abierto) {
        setCierre("reiniciado");
        return;
      }
      if (registro.version <= version.current) return;

      version.current = registro.version;
      etag.current = r.headers.get("etag");
      confirmadosRef.current = registro.eventos;
      setConfirmados(registro.eventos);
    } catch {
      // Sin cobertura se sigue con lo que hay; ya llegará la siguiente
    }
  }, [partido.id, inicial.abierto]);

  useEffect(() => {
    if (cierre) return;
    const reloj = setInterval(() => void preguntar(), CADA_PREGUNTA_MS);
    return () => clearInterval(reloj);
  }, [preguntar, cierre]);

  /* El reintento, para lo que se quedó sin mandar por falta de cobertura */
  useEffect(() => {
    const reloj = setInterval(() => void enviar(), CADA_REINTENTO_MS);
    return () => clearInterval(reloj);
  }, [enviar]);

  /* Se apunta y se manda ya; si falla, queda en la cola y el reloj lo recoge */
  const apuntar = (evento: EventoNuevo, cuando?: number) => {
    fijarCola([...cola.current, sellar(evento, cuando)]);
    void enviar();
  };

  /** Algo que pasó en el partido: deja los botones sordos un momento. */
  const anotar = (evento: EventoNuevo) => {
    apuntar(evento);

    setBloqueado(true);
    if (relojBloqueo.current) clearTimeout(relojBloqueo.current);
    relojBloqueo.current = setTimeout(() => setBloqueado(false), BLOQUEO_MS);
  };

  /** Una corrección. Nunca se bloquea: es justo lo que hay que poder hacer ya. */
  const anular = (id: string) => apuntar({ tipo: "anula", anulado: id });

  /**
   * Corrige un comentario ya publicado.
   *
   * No hay "editar" en el modelo, y no hace falta: se anula el viejo y se pone
   * el nuevo. Lo importante es que el nuevo lleve **el instante del original**,
   * porque si no se iría al minuto actual y saltaría al principio de la
   * cronología como si acabara de escribirse. Con su instante se queda en su
   * sitio y con su minuto, y quien lo lee solo ve el texto corregido.
   */
  const publicarComentario = () => {
    // El Intro del teclado también publica, así que el bloqueo entre eventos
    // hay que mirarlo aquí y no solo en el botón
    if (sordo) return;
    const mensaje = texto.trim();
    if (!mensaje) return;
    anotar({ tipo: "texto", mensaje });
    setTexto("");
  };

  const editarTexto = (id: string, cuando: number, mensaje: string) => {
    anular(id);
    apuntar({ tipo: "texto", mensaje }, cuando);
  };

  const estado = plegar([...confirmados, ...pendientes], partido.minutosPorParte);
  const minuto = minutoEn(estado, ahora);
  const { fase } = estado;

  const enJuego = fase !== "sin-empezar" && fase !== "final";
  /* Ni durante el bloqueo por doble toque, ni si la pantalla ya no sirve */
  const sordo = bloqueado || cierre !== null;
  const sinMandar = pendientes.length;

  /* Un solo botón de fase: el que toca según dónde esté el partido */
  const faseSiguiente =
    fase === "sin-empezar"
      ? { texto: "Iniciar partido", tipo: "inicio" as const }
      : fase === "descanso"
        ? /* Solo hay dos partes: tras la segunda no queda más que terminar */
          estado.parte < PARTES
          ? { texto: `Empezar la ${estado.parte + 1}ª parte`, tipo: "empezarParte" as const }
          : null
        : fase === "final"
          ? null
          : { texto: "Fin de la parte", tipo: "finParte" as const };

  /*
   * El reloj lo cuenta cada dispositivo con su propia hora, así que el minuto
   * que pinta el servidor y el que pinta el navegador pueden no coincidir: basta
   * con que la página se cargue justo en el cambio de minuto. No es un error, es
   * lo que tiene un reloj; se le dice a React que no compare este texto.
   */
  const marcador = (
    <span className="tabular-nums" suppressHydrationWarning>
      {fase === "sin-empezar"
        ? "Sin empezar"
        : fase === "final"
          ? `Final · ${minuto.etiqueta}`
          : fase === "descanso"
            ? `Descanso · ${minuto.etiqueta}`
            : fase === "parado"
              ? `${minuto.etiqueta} · parado`
              : minuto.etiqueta}
    </span>
  );

  const ultimo = estado.linea.at(-1);

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      {/* -------------------------------------------------- marcador y reloj */}
      <div className="rounded-2xl bg-club p-4 text-white">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide">
          <span className="text-club-claro">{partido.nombreEquipo}</span>
          {marcador}
        </div>

        <div className="mt-3 space-y-1.5">
          {(["local", "visitante"] as Lado[]).map((lado) => (
            <div key={lado} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-base font-semibold">
                {lado === "local" ? partido.local : partido.visitante}
              </span>
              <span className="title text-3xl leading-none tabular-nums">
                {estado.goles[lado]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {cierre ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-club bg-panel p-4 text-sm leading-relaxed text-tinta"
        >
          <p className="font-bold text-club">{TITULO_CIERRE[cierre]}</p>
          <p className="mt-1">{MOTIVO_CIERRE[cierre]}</p>
          {cierre === "reiniciado" ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary mt-3 w-full py-3 text-sm"
            >
              Recargar
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Sin `registrar`: quien escribe no es un espectador, y con dos personas
          apuntando el partido irían dos de más en la cuenta */}
      <ContadorSeguidores partido={partido.id} />

      {aviso ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-club bg-panel p-3 text-sm font-semibold text-club"
        >
          {aviso}
        </p>
      ) : null}

      {/* -------------------------------------------------- goles y tarjetas */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(["local", "visitante"] as Lado[]).map((lado) => (
          <div key={lado} className="card p-3">
            <p className="truncate text-center text-[11px] font-bold uppercase tracking-wide text-mute">
              {lado === "local" ? partido.local : partido.visitante}
            </p>
            <button
              type="button"
              disabled={!enJuego || sordo}
              onClick={() => anotar({ tipo: "gol", equipo: lado })}
              className="btn btn-primary mt-2 w-full py-6 text-xl disabled:opacity-40"
            >
              GOL
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {/* Las tarjetas con la misma forma que las jugadas: ocho botones
                  iguales se recorren de un vistazo, dos raros no. */}
              {(["amarilla", "roja"] as const).map((color) => (
                <button
                  key={color}
                  type="button"
                  disabled={!enJuego || sordo}
                  onClick={() => anotar({ tipo: "tarjeta", equipo: lado, color })}
                  className={`${BOTON_JUGADA} ${PINTA[color]}`}
                >
                  Tarjeta {color}
                  <span className="sr-only">
                    para {lado === "local" ? partido.local : partido.visitante}
                  </span>
                </button>
              ))}

              {JUGADAS.map(({ clase, texto, sentido }) => (
                <button
                  key={clase}
                  type="button"
                  disabled={!enJuego || sordo}
                  onClick={() => anotar({ tipo: "jugada", equipo: lado, clase })}
                  className={`${BOTON_JUGADA} ${PINTA[sentido]}`}
                >
                  {texto}
                  <span className="sr-only">
                    {" "}
                    de {lado === "local" ? partido.local : partido.visitante}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* --------------------------------------------------------- las fases */}
      <button
        type="button"
        disabled={sordo || (fase !== "jugando" && fase !== "parado")}
        onClick={() => anotar({ tipo: fase === "parado" ? "reanudar" : "parar" })}
        className="btn btn-ghost mt-3 w-full py-3 text-sm disabled:opacity-40"
      >
        {fase === "parado" ? "Reanudar reloj" : "Parar reloj"}
      </button>

      {/* No es un error, es un recordatorio: el reloj sigue corriendo y quien
          apunta está mirando el campo */}
      {faseSiguiente?.tipo === "finParte" && minuto.anadido >= DESCUENTO_LARGO ? (
        <p
          role="status"
          className="mt-3 rounded-xl border border-amarilla-linea bg-amarilla p-3 text-center text-sm font-semibold leading-relaxed text-amarilla-tinta"
        >
          Llevas {minuto.anadido} minutos de descuento. Si la parte ya ha
          terminado, márcalo aquí debajo.
        </p>
      ) : null}

      {faseSiguiente ? (
        <button
          type="button"
          disabled={sordo}
          onClick={() => anotar({ tipo: faseSiguiente.tipo })}
          className="btn btn-primary mt-2 w-full py-4 text-base disabled:opacity-40"
        >
          {faseSiguiente.texto}
        </button>
      ) : null}

      {/*
        Con la pantalla encendida el móvil no se bloquea, y sin bloquearse el
        sistema no cierra la aplicación: es lo que evitaba tener que rehacer todo
        el camino por el panel a mitad de partido. Solo aparece si el móvil lo
        admite.
      */}
      {hayWakeLock ? (
        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-panel-2 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-sm font-bold text-tinta">
              Pantalla siempre encendida
            </span>
            <span className="block text-xs leading-snug text-mute">
              Para que el móvil no se bloquee y no haya que volver a entrar. Gasta
              más batería.
            </span>
          </span>
          <input
            type="checkbox"
            checked={pantalla}
            onChange={(e) => guardarPreferencia(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-club"
          />
        </label>
      ) : null}

      {/*
        Terminar cierra el directo para todo el mundo, así que se pregunta
        antes. Es la única acción de esta pantalla que no se arregla con un
        toque: deshacer un final es posible, pero mientras tanto el club entero
        ha visto el partido como acabado.
      */}
      {fase === "descanso" ? (
        confirmandoFinal ? (
          <div className="mt-2 rounded-xl border border-club bg-panel p-4">
            <p className="font-bold text-club">¿Damos el partido por terminado?</p>
            <p className="mt-1 text-sm leading-relaxed text-mute">
              El marcador queda como definitivo y así lo verá todo el mundo. Si
              te has equivocado todavía podrás corregirlo un rato, pero al cabo
              de unas horas este enlace deja de funcionar y ya no se puede tocar
              nada.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={sordo}
                onClick={() => {
                  setConfirmandoFinal(false);
                  anotar({ tipo: "final" });
                }}
                className="btn btn-primary flex-1 py-3 text-sm disabled:opacity-40"
              >
                Sí, terminar
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoFinal(false)}
                className="btn btn-ghost flex-1 py-3 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={sordo}
            onClick={() => setConfirmandoFinal(true)}
            className={`mt-2 w-full disabled:opacity-40 ${
              faseSiguiente ? "btn btn-ghost py-3 text-sm" : "btn btn-primary py-4 text-base"
            }`}
          >
            Terminar partido
          </button>
        )
      ) : null}

      {fase === "final" ? (
        <p className="mt-2 rounded-xl bg-panel-2 p-3 text-center text-sm font-semibold text-mute">
          Partido terminado.
        </p>
      ) : null}

      {/* ---------------------------------------------------- el comentario */}
      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          publicarComentario();
        }}
      >
        <CampoQueCrece
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          alEnviar={publicarComentario}
          maxLength={LARGO_TEXTO}
          placeholder="Comentario…"
          aria-label="Comentario"
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-xl border border-linea bg-panel px-3 py-3 text-base text-tinta focus:border-club focus:outline-none"
        />
        <button
          type="submit"
          disabled={sordo}
          className="btn btn-ghost px-4 py-3 text-sm disabled:opacity-40"
        >
          Añadir
        </button>
      </form>
      <p className="mt-1.5 text-xs leading-relaxed text-mute">
        Lo que escribas se publica al momento en la web del club y lo lee
        cualquiera. Casi todos los equipos son de menores: mejor no nombrar a
        nadie.
      </p>

      {/* ----------------------------------------------------- la cronología */}
      <div className="mt-5 flex items-center justify-between">
        <h2 className="title text-xl text-tinta">Lo que llevamos</h2>
        <span className="text-xs text-mute">
          {sinMandar > 0 ? `${sinMandar} sin enviar` : "Todo guardado"}
        </span>
      </div>

      {ultimo ? (
        <button
          type="button"
          onClick={() => anular(ultimo.id)}
          className="btn btn-ghost mt-2 w-full py-3 text-sm"
        >
          Deshacer lo último
        </button>
      ) : null}

      <Cronologia
        linea={estado.linea}
        partido={partido}
        alAnular={anular}
        alEditar={editarTexto}
      />
    </div>
  );
}
