"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  plegar,
  minutoEn,
  LARGO_TEXTO,
  type Evento,
  type EventoNuevo,
  type Lado,
} from "@/lib/directo/modelo";
import type { Registro } from "@/lib/directo/almacen";
import Cronologia from "@/components/Cronologia";

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
 */

const CADA_REINTENTO_MS = 5_000;

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
function sellar(evento: EventoNuevo): Evento {
  const ahora = Date.now();
  const id = `${ahora.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return { ...evento, id, ts: ahora } as Evento;
}

const clave = (partido: string) => `directo-pendientes-${partido}`;

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
        localStorage.setItem(clave(partido.id), JSON.stringify(siguiente));
      } catch {
        // Cuota llena: no es motivo para dejar de apuntar el partido
      }
    },
    [partido.id],
  );

  /* Al abrir: recuperar lo que quedó sin mandar de una sesión anterior */
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(clave(partido.id));
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
  }, [partido.id]);

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);

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
          eventos: [...confirmadosRef.current, ...cola.current],
        }),
        cache: "no-store",
      });

      if (r.status === 401) {
        setAviso("El enlace ha caducado. Pide uno nuevo en el panel del club.");
        return;
      }
      if (!r.ok) return; // se reintenta solo

      const registro = (await r.json()) as Registro;
      const guardados = new Set(registro.eventos.map((e) => e.id));

      confirmadosRef.current = registro.eventos;
      setConfirmados(registro.eventos);
      fijarCola(cola.current.filter((e) => !guardados.has(e.id)));
      setAviso(null);
    } catch {
      // Sin cobertura: la cola se queda donde está y el reintento la recoge
    } finally {
      enviando.current = false;
    }
  }, [partido.id, token, fijarCola]);

  /* El reintento, para lo que se quedó sin mandar por falta de cobertura */
  useEffect(() => {
    const reloj = setInterval(() => void enviar(), CADA_REINTENTO_MS);
    return () => clearInterval(reloj);
  }, [enviar]);

  /* Se apunta y se manda ya; si falla, queda en la cola y el reloj lo recoge */
  const apuntar = (evento: EventoNuevo) => {
    fijarCola([...cola.current, sellar(evento)]);
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

  const estado = plegar([...confirmados, ...pendientes], partido.minutosPorParte);
  const minuto = minutoEn(estado, ahora);
  const { fase } = estado;

  const enJuego = fase !== "sin-empezar" && fase !== "final";
  const sinMandar = pendientes.length;

  /* Un solo botón de fase: el que toca según dónde esté el partido */
  const faseSiguiente =
    fase === "sin-empezar"
      ? { texto: "Iniciar partido", tipo: "inicio" as const }
      : fase === "descanso"
        ? { texto: `Empezar la parte ${estado.parte + 1}`, tipo: "empezarParte" as const }
        : fase === "final"
          ? null
          : { texto: "Fin de la parte", tipo: "finParte" as const };

  const marcador = (
    <span className="tabular-nums">
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
              disabled={!enJuego || bloqueado}
              onClick={() => anotar({ tipo: "gol", equipo: lado })}
              className="btn btn-primary mt-2 w-full py-6 text-xl disabled:opacity-40"
            >
              GOL
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!enJuego || bloqueado}
                onClick={() => anotar({ tipo: "tarjeta", equipo: lado, color: "amarilla" })}
                className="btn btn-ghost py-3 disabled:opacity-40"
              >
                <span aria-hidden>🟨</span>
                <span className="sr-only">
                  Tarjeta amarilla para {lado === "local" ? partido.local : partido.visitante}
                </span>
              </button>
              <button
                type="button"
                disabled={!enJuego || bloqueado}
                onClick={() => anotar({ tipo: "tarjeta", equipo: lado, color: "roja" })}
                className="btn btn-ghost py-3 disabled:opacity-40"
              >
                <span aria-hidden>🟥</span>
                <span className="sr-only">
                  Tarjeta roja para {lado === "local" ? partido.local : partido.visitante}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* --------------------------------------------------------- las fases */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={bloqueado || (fase !== "jugando" && fase !== "parado")}
          onClick={() => anotar({ tipo: fase === "parado" ? "reanudar" : "parar" })}
          className="btn btn-ghost flex-1 py-3 text-sm disabled:opacity-40"
        >
          {fase === "parado" ? "Reanudar reloj" : "Parar reloj"}
        </button>
        {fase === "descanso" ? (
          <button
            type="button"
            disabled={bloqueado}
            onClick={() => anotar({ tipo: "final" })}
            className="btn btn-ghost flex-1 py-3 text-sm disabled:opacity-40"
          >
            Terminar partido
          </button>
        ) : null}
      </div>

      {faseSiguiente ? (
        <button
          type="button"
          disabled={bloqueado}
          onClick={() => anotar({ tipo: faseSiguiente.tipo })}
          className="btn btn-primary mt-2 w-full py-4 text-base disabled:opacity-40"
        >
          {faseSiguiente.texto}
        </button>
      ) : (
        <p className="mt-2 rounded-xl bg-panel-2 p-3 text-center text-sm font-semibold text-mute">
          Partido terminado.
        </p>
      )}

      {/* ---------------------------------------------------- el comentario */}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          // El Intro del teclado envía el formulario aunque el botón esté
          // deshabilitado, así que el bloqueo hay que mirarlo también aquí
          if (bloqueado) return;
          const mensaje = texto.trim();
          if (!mensaje) return;
          anotar({ tipo: "texto", mensaje });
          setTexto("");
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={LARGO_TEXTO}
          placeholder="Comentario…"
          aria-label="Comentario"
          className="min-w-0 flex-1 rounded-xl border border-linea bg-panel px-3 py-3 text-base text-tinta focus:border-club focus:outline-none"
        />
        <button
          type="submit"
          disabled={bloqueado}
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
      />
    </div>
  );
}
