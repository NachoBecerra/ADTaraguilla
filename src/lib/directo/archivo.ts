"use client";

import { useEffect, useState } from "react";

/**
 * De qué partidos hay retransmisión guardada, preguntado una sola vez.
 *
 * Las páginas se generan al compilar y una retransmisión ocurre después, así
 * que quién la tiene solo lo puede saber el navegador. Lo piden a la vez
 * muchas tarjetas —la portada enseña los nueve equipos, y la ficha de uno,
 * treinta partidos—, de modo que las peticiones se juntan en **una sola**: lo
 * que se pide en el mismo instante sale en la misma consulta, y lo ya
 * contestado no se vuelve a pedir.
 *
 * Mismo motivo que el sondeo compartido de EnDirecto: al almacén se le
 * pregunta una vez por página, no una vez por tarjeta.
 */

/** Lo ya pedido en esta visita, por equipo. */
const cache = new Map<string, Promise<string[]>>();

/** Equipos que esperan a salir en la próxima consulta. */
let pendientes = new Set<string>();
let lote: Promise<Record<string, string[]>> | null = null;

async function pedir(equipos: string[]): Promise<Record<string, string[]>> {
  if (equipos.length === 0) return {};

  try {
    const r = await fetch(
      `/api/directo/archivo?equipos=${encodeURIComponent(equipos.join(","))}`,
      { cache: "no-store" },
    );
    if (!r.ok) return {};

    const datos = (await r.json()) as { porEquipo?: Record<string, string[]> };
    return datos.porEquipo ?? {};
  } catch {
    // Sin respuesta no se enseña el enlace, que es un extra
    return {};
  }
}

/**
 * El lote que se está llenando ahora mismo. Se cierra en cuanto acaba el turno
 * actual, que es cuando ya han pedido lo suyo todas las tarjetas de la página.
 */
function loteAbierto(): Promise<Record<string, string[]>> {
  lote ??= new Promise((resolver) => {
    setTimeout(() => {
      const equipos = [...pendientes];
      pendientes = new Set();
      lote = null;
      resolver(pedir(equipos));
    }, 0);
  });

  return lote;
}

export function fechasConRetransmision(equipo: string): Promise<string[]> {
  const yaPedido = cache.get(equipo);
  if (yaPedido) return yaPedido;

  pendientes.add(equipo);
  const fechas = loteAbierto().then((porEquipo) => porEquipo[equipo] ?? []);
  cache.set(equipo, fechas);
  return fechas;
}

/** Las fechas con retransmisión de un equipo, o null mientras se preguntan. */
export function useRetransmisionesDe(equipo: string): string[] | null {
  const [fechas, setFechas] = useState<string[] | null>(null);

  useEffect(() => {
    let vigente = true;

    void fechasConRetransmision(equipo).then((suyas) => {
      if (vigente) setFechas(suyas);
    });

    return () => {
      vigente = false;
    };
  }, [equipo]);

  return fechas;
}

/** ¿Se retransmitió este partido? */
export function useTieneRetransmision(equipo: string, fecha: string | null): boolean {
  const fechas = useRetransmisionesDe(equipo);
  return !!fecha && !!fechas?.includes(fecha);
}
