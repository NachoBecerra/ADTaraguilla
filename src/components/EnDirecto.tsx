"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { ResumenDirecto } from "@/lib/directo/resumen";
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

function useDirecto(equipo: string): ResumenDirecto | undefined {
  const todos = useSyncExternalStore(suscribir, leer, leerEnServidor);
  return todos.find((d) => d.equipo === equipo);
}

const marcador = (d: ResumenDirecto) => `${d.goles.local}-${d.goles.visitante}`;

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

/** Banda en la ficha del equipo, que sí lleva al partido. */
export function BandaDirecto({ equipo }: { equipo: string }) {
  const d = useDirecto(equipo);
  if (!d) return null;

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
