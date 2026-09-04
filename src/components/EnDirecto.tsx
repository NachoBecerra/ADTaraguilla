"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { ResumenDirecto } from "@/lib/directo/resumen";
import { idPartido } from "@/lib/directo/idPartido";
import { IconoFlecha } from "@/components/Iconos";

/**
 * Avisa de que un equipo está jugando ahora mismo.
 *
 * Lo usan varias tarjetas a la vez —la portada enseña los nueve equipos—, así
 * que el sondeo es **uno solo y compartido**: un almacén de módulo al que se
 * suscriben todas. Con una consulta por tarjeta, abrir la portada un sábado
 * serían nueve peticiones iguales.
 *
 * El servidor contesta con caché de CDN corta, de modo que aunque medio pueblo
 * tenga la portada abierta, al almacén se pregunta unas pocas veces por minuto.
 */

const CADA_MS = 30_000;

/* Referencia estable: si no cambia nada, tiene que devolverse la misma. */
const VACIO: ResumenDirecto[] = [];

let directos: ResumenDirecto[] = VACIO;
const suscriptores = new Set<() => void>();
let reloj: ReturnType<typeof setInterval> | null = null;

async function refrescar() {
  if (document.hidden) return; // nadie mirando, nada que preguntar
  try {
    const r = await fetch("/api/directo", { cache: "no-store" });
    if (!r.ok) return;

    const { directos: nuevos } = (await r.json()) as { directos: ResumenDirecto[] };
    const siguiente = nuevos?.length ? nuevos : VACIO;

    /* Solo se avisa si de verdad cambió algo, o se repintaría cada 30 s */
    if (JSON.stringify(siguiente) === JSON.stringify(directos)) return;

    directos = siguiente;
    for (const avisar of suscriptores) avisar();
  } catch {
    // Sin cobertura no pasa nada: simplemente no se enciende el aviso
  }
}

function suscribir(alCambiar: () => void) {
  suscriptores.add(alCambiar);

  if (reloj === null) {
    void refrescar();
    reloj = setInterval(refrescar, CADA_MS);
    document.addEventListener("visibilitychange", refrescar);
  }

  return () => {
    suscriptores.delete(alCambiar);
    if (suscriptores.size === 0 && reloj !== null) {
      clearInterval(reloj);
      reloj = null;
      document.removeEventListener("visibilitychange", refrescar);
    }
  };
}

const leer = () => directos;
const leerEnServidor = () => VACIO;

/**
 * ¿Está jugando este equipo, sea el partido que sea?
 *
 * Vale para los avisos que solo dicen «este equipo está en directo»: el
 * distintivo de una tarjeta de equipo y la banda de su ficha.
 */
function useDirecto(equipo: string): ResumenDirecto | undefined {
  const todos = useSyncExternalStore(suscribir, leer, leerEnServidor);
  return todos.find((d) => d.equipo === equipo);
}

/**
 * La retransmisión **de este partido concreto**, o ninguna.
 *
 * La tarjeta del próximo partido lleva unos escudos, una competición y una
 * jornada, así que el marcador que enseñe tiene que ser el de ese partido y no
 * el de otro del mismo equipo. Con emparejar por equipo bastaba para que un
 * amistoso, o la retransmisión de la jornada anterior que nadie cerró, pintara
 * su resultado debajo de los escudos equivocados.
 *
 * El identificador de una retransmisión es `<equipo>-<fecha>`, que es lo que
 * permite comprobarlo sin pedir nada más.
 */
function useDirectoDePartido(equipo: string, fecha: string | null): ResumenDirecto | undefined {
  const todos = useSyncExternalStore(suscribir, leer, leerEnServidor);
  const id = idPartido(equipo, fecha);
  return id ? todos.find((d) => d.id === id) : undefined;
}

const marcador = (d: ResumenDirecto) => `${d.goles.local}-${d.goles.visitante}`;

/**
 * La hora del navegador, o null mientras se pinta en el servidor.
 *
 * Hace falta para saber si la hora del partido ya pasó, y eso no se puede
 * decidir en el servidor: entre que él pinta la página y el navegador la
 * hidrata puede cruzarse la hora del saque, y React daría la página por
 * inconsistente. Devolviendo null en el servidor, la primera pintada es la
 * misma en los dos lados y el cambio llega después.
 */
function useAhora(): number | null {
  return useSyncExternalStore(
    (avisar) => {
      const reloj = setInterval(avisar, 30_000);
      return () => clearInterval(reloj);
    },
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => null,
  );
}

/** El punto rojo que late mientras se está retransmitiendo. */
function PuntoVivo({ claro = false }: { claro?: boolean }) {
  return (
    <span
      aria-hidden
      className={`late inline-block h-2 w-2 shrink-0 rounded-full ${
        claro ? "bg-vivo-claro" : "bg-vivo"
      }`}
    />
  );
}

/**
 * El centro de la tarjeta del próximo partido.
 *
 * Con retransmisión abierta enseña el marcador y el minuto; sin ella, el «VS» y
 * la hora de siempre. Antes esto vivía en una tarjeta verde aparte encima de la
 * del partido, y con las dos a la vez se leían dos cosas del mismo partido.
 */
export function CentroDelPartido({
  equipo,
  fecha,
  hora,
}: {
  equipo: string;
  fecha: string | null;
  hora: string | null;
}) {
  const d = useDirectoDePartido(equipo, fecha);

  if (!d) {
    return (
      <>
        <span className="title text-3xl text-club sm:text-4xl">VS</span>
        <span
          className={`mt-1 whitespace-nowrap rounded-full px-3 py-1 font-bold ${
            hora
              ? "bg-club text-sm tabular-nums text-white"
              : "bg-panel-2 text-[10px] uppercase tracking-wide text-mute"
          }`}
        >
          {hora ?? "Hora sin fijar"}
        </span>
      </>
    );
  }

  const enJuego = d.fase !== "final";

  return (
    <>
      <span className="title text-3xl leading-none tabular-nums text-tinta sm:text-4xl">
        {d.goles.local} - {d.goles.visitante}
      </span>
      <span
        className={`mt-1.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
          enJuego ? "bg-panel-2 text-tinta" : "bg-panel-2 text-mute"
        }`}
      >
        {enJuego ? <PuntoVivo /> : null}
        {enJuego ? d.minuto : "Final"}
      </span>
    </>
  );
}

/**
 * Lo que se dice debajo de la tarjeta, según en qué punto esté el partido.
 *
 * Son tres avisos y ninguno sobra:
 *
 * - **Retransmitiendo**: el botón para entrar, que es lo que la gente busca.
 * - **Retransmisión terminada**: el marcador vale, pero es provisional hasta
 *   que llega el acta. Decirlo evita que alguien lo dé por oficial.
 * - **Pasó la hora y nadie abrió retransmisión**: es lo más probable un sábado
 *   cualquiera, y sin decir nada la tarjeta se queda enseñando una hora ya
 *   pasada como si el partido estuviera por jugarse.
 */
export function AvisoDelPartido({
  equipo,
  fecha,
  hora,
}: {
  equipo: string;
  fecha: string | null;
  hora: string | null;
}) {
  const d = useDirectoDePartido(equipo, fecha);
  const ahora = useAhora();

  if (d) {
    const enJuego = d.fase !== "final";

    if (enJuego) {
      return (
        <Link
          href={`/directo/${d.id}`}
          className="btn btn-primary mt-4 w-full gap-2 py-3 text-sm"
        >
          <PuntoVivo claro />
          En directo
          <IconoFlecha size={16} />
        </Link>
      );
    }

    return (
      <div className="mt-4">
        <Link href={`/directo/${d.id}`} className="btn btn-ghost w-full gap-2 py-3 text-sm">
          Ver cómo fue
          <IconoFlecha size={16} />
        </Link>
        <p className="mt-2 text-center text-xs leading-relaxed text-mute">
          Partido terminado, resultado provisional. El definitivo llega con el
          acta de la RFAF.
        </p>
      </div>
    );
  }

  /* Sin retransmisión: solo se dice algo si la hora del saque ya pasó */
  if (ahora === null || !fecha || !hora) return null;
  const saque = Date.parse(`${fecha}T${hora}:00`);
  if (Number.isNaN(saque) || ahora < saque) return null;

  return (
    <p className="mt-4 rounded-xl bg-panel-2 p-3 text-center text-xs leading-relaxed text-mute">
      Este partido empezó a las <strong className="font-bold text-tinta">{hora}</strong>.
      El resultado se actualizará con el acta oficial de la RFAF.
    </p>
  );
}

/**
 * Distintivo para una tarjeta de equipo.
 *
 * No es un enlace a propósito: la tarjeta entera ya lo es, y un enlace dentro
 * de otro no es HTML válido. Desde la ficha del equipo se entra al directo.
 */
export function DistintivoDirecto({ equipo }: { equipo: string }) {
  const d = useDirecto(equipo);
  if (!d) return null;

  const enJuego = d.fase !== "final";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
        enJuego ? "bg-club text-white" : "bg-panel-2 text-mute"
      }`}
    >
      {enJuego ? (
        <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-club-claro" />
      ) : null}
      {enJuego ? "En directo" : "Final"} {marcador(d)}
    </span>
  );
}

/**
 * Banda en la ficha del equipo, que sí lleva al partido.
 *
 * Se salta el partido que ya enseña la tarjeta de próximo partido —para no
 * decir lo mismo dos veces— pero **solo ese**. Un amistoso, o la retransmisión
 * de otra fecha, se quedaría sin ninguna forma de llegar a él: la tarjeta no lo
 * enseña porque no es su partido, y esta banda es lo único que queda.
 */
export function BandaDirecto({
  equipo,
  omitirPartido,
}: {
  equipo: string;
  omitirPartido?: string | null;
}) {
  const d = useDirecto(equipo);
  if (!d || d.id === omitirPartido) return null;

  const enJuego = d.fase !== "final";

  return (
    <Link
      href={`/directo/${d.id}`}
      className="mt-4 flex items-center gap-3 rounded-2xl bg-club p-4 text-white transition-colors hover:bg-club-dark"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-club-claro">
          {enJuego ? (
            <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-club-claro" />
          ) : null}
          {enJuego ? `En directo · ${d.minuto}` : "Ha terminado"}
        </span>
        <span className="title mt-1 block truncate text-xl">
          {d.local} {marcador(d)} {d.visitante}
        </span>
      </span>
      <IconoFlecha size={18} className="shrink-0" />
    </Link>
  );
}

/**
 * Todos los partidos que se están jugando ahora, como sección de página.
 *
 * Existe porque el distintivo de las tarjetas **no puede ser un enlace**: la
 * tarjeta entera ya lo es, y un enlace dentro de otro no es HTML válido.
 * Superponer uno encima sería un apaño frágil, así que la entrada al directo va
 * arriba de la página, donde además se ve mucho más que una pastilla pequeña.
 *
 * No ocupa nada cuando no hay partido: no se pinta.
 */
export function DirectosAhora({ omitir }: { omitir?: string | null } = {}) {
  const puestos = useSyncExternalStore(suscribir, leer, leerEnServidor);

  /* Se salta el PARTIDO que ya enseña una tarjeta de esta misma página, no
     todos los del equipo: si no, un amistoso del mismo equipo desaparecería
     sin que nada lo enseñara en su lugar. */
  const todos = omitir ? puestos.filter((d) => d.id !== omitir) : puestos;
  if (todos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 pt-8">
      <p className="eyebrow">Ahora mismo</p>
      <h2 className="title mt-1 text-2xl text-tinta">
        {todos.length === 1 ? "Hay un partido en directo" : `Hay ${todos.length} partidos en directo`}
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {todos.map((d) => {
          const enJuego = d.fase !== "final";
          return (
            <Link
              key={d.id}
              href={`/directo/${d.id}`}
              className="flex items-center gap-3 rounded-2xl bg-club p-4 text-white transition-colors hover:bg-club-dark"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-club-claro">
                  {enJuego ? (
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 animate-pulse rounded-full bg-club-claro"
                    />
                  ) : null}
                  {d.nombreEquipo}
                  {enJuego ? ` · ${d.minuto}` : " · final"}
                </span>
                <span className="title mt-1 block truncate text-lg">
                  {d.local} {marcador(d)} {d.visitante}
                </span>
              </span>
              <IconoFlecha size={18} className="shrink-0" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
