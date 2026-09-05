"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hayRetransmision, minutoEn, plegar } from "@/lib/directo/modelo";
import type { Registro } from "@/lib/directo/almacen";
import EscudoImg from "@/components/EscudoImg";
import EstadisticasDirecto from "@/components/EstadisticasDirecto";
import { IconoWhatsApp } from "@/components/Iconos";
import { fechaPartido } from "@/lib/formato";
import Cronologia from "@/components/Cronologia";
import ContadorSeguidores from "@/components/ContadorSeguidores";

/**
 * El partido en directo, para quien lo sigue desde casa.
 *
 * Se pregunta cada pocos segundos en vez de recibir empujones del servidor. En
 * Vercel las funciones se despliegan como lambdas y no pueden mantener una
 * conexión abierta ni enterarse de lo que pasó en otra, así que un WebSocket
 * propio no es posible; y como el reloj lo cuenta el navegador a partir de la
 * hora del saque, entre pregunta y pregunta nadie ve un número congelado.
 *
 * El ETag hace barato preguntar: en hora y media pasan veinte o treinta cosas,
 * así que casi todas las respuestas son "nada nuevo", sin cuerpo.
 */

/** Cada cuánto se pregunta mientras se juega. */
const CADA_MS = 5_000;

/** Y cuando ya terminó: solo por si hay una corrección. */
const CADA_MS_TERMINADO = 30_000;

/**
 * Lo que le llega a quien recibe el enlace por WhatsApp.
 *
 * El partido y cuándo se juega, y nada más. **Sin el marcador a propósito**: un
 * mensaje de WhatsApp no se actualiza, así que un "2-1" enviado en el minuto 30
 * seguiría diciendo 2-1 el martes siguiente. El marcador que se vea que sea el
 * de la página, que ese sí está vivo.
 */
function mensajeDe(partido: Registro["partido"], url: string): string {
  const cuando = [partido.fecha ? fechaPartido(partido.fecha) : null, partido.hora]
    .filter(Boolean)
    .join(", ");

  return [`${partido.local} · ${partido.visitante}`, cuando, "", url]
    .filter((l) => l !== null)
    .join("\n");
}

export default function Seguimiento({
  inicial,
  url,
}: {
  inicial: Registro;
  url: string;
}) {
  const [registro, setRegistro] = useState(inicial);
  const [ahora, setAhora] = useState(() => Date.now());
  const etag = useRef<string | null>(null);

  const partido = registro.partido;
  const estado = plegar(registro.eventos, partido.minutosPorParte);
  const minuto = minutoEn(estado, ahora);
  const terminado = estado.fase === "final";

  const preguntar = useCallback(async () => {
    try {
      const r = await fetch(`/api/directo/${partido.id}`, {
        cache: "no-store",
        headers: etag.current ? { "If-None-Match": etag.current } : {},
      });
      if (r.status === 304 || !r.ok) return; // nada nuevo, o un tropiezo pasajero

      etag.current = r.headers.get("etag");
      setRegistro((await r.json()) as Registro);
    } catch {
      // Sin cobertura se sigue viendo lo último; ya llegará la siguiente
    }
  }, [partido.id]);

  useEffect(() => {
    /* Con la pestaña oculta no se pregunta: nadie está mirando */
    const alVolver = () => {
      if (!document.hidden) void preguntar();
    };
    document.addEventListener("visibilitychange", alVolver);

    const cada = terminado ? CADA_MS_TERMINADO : CADA_MS;
    const reloj = setInterval(() => {
      if (!document.hidden) void preguntar();
    }, cada);

    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      clearInterval(reloj);
    };
  }, [preguntar, terminado]);

  /* El reloj lo lleva este navegador: no hace falta preguntar para que avance */
  useEffect(() => {
    if (terminado) return;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, [terminado]);

  /*
   * Que haya alguien contando el partido no es lo mismo que que el partido haya
   * empezado. El enlace se comparte días antes, así que hasta que se apunta lo
   * primero esto decía «En directo · Aún no ha empezado», que es una
   * contradicción en la misma línea.
   */
  const enMarcha = hayRetransmision(estado);

  const estadoTexto =
    estado.fase === "sin-empezar"
      ? enMarcha
        ? "Aún no ha empezado"
        : partido.hora
          ? `Empieza a las ${partido.hora}`
          : "Hora sin fijar"
      : terminado
        ? "Final"
        : estado.fase === "descanso"
          ? `Descanso · ${minuto.etiqueta}`
          : estado.fase === "parado"
            ? `${minuto.etiqueta} · parado`
            : minuto.etiqueta;

  return (
    <section className="mx-auto max-w-lg px-4 py-6">
      <p className="eyebrow">{partido.nombreEquipo}</p>
      <h1 className="title mt-1 text-3xl text-tinta">
        {partido.local} · {partido.visitante}
      </h1>
      <p className="mt-1 text-xs text-mute">
        {partido.competicion}
        {partido.jornada ? ` · ${partido.jornada}` : ""}
        {partido.campo ? ` · ${partido.campo}` : ""}
      </p>

      {/* ---------------------------------------------- marcador y reloj */}
      <div className="mt-4 rounded-2xl bg-club p-5 text-white">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide">
          <span className="inline-flex items-center gap-2 text-club-claro">
            {/* El punto late mientras se está retransmitiendo, aunque el
                partido no haya arrancado: alguien está contando algo */}
            {!terminado && enMarcha ? (
              <span
                aria-hidden
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-club-claro"
              />
            ) : null}
            {terminado ? "Terminado" : enMarcha ? "En directo" : "Se retransmite aquí"}
          </span>
          {/* El minuto lo cuenta este navegador con su hora: no tiene por qué
              coincidir con el que pintó el servidor, y no es un error */}
          <span className="tabular-nums" suppressHydrationWarning>
            {estadoTexto}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
            <EscudoImg src={partido.escudoLocal} size={52} />
            <span className="text-sm font-semibold leading-tight">{partido.local}</span>
          </div>

          {/* Antes de que se apunte nada no hay marcador que enseñar: un
              «0 - 0» se lee como que el partido va empatado */}
          <span className="title shrink-0 text-4xl leading-none tabular-nums">
            {enMarcha ? `${estado.goles.local} - ${estado.goles.visitante}` : "VS"}
          </span>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
            <EscudoImg src={partido.escudoVisitante} size={52} />
            <span className="text-sm font-semibold leading-tight">{partido.visitante}</span>
          </div>
        </div>
      </div>

      {/*
        La regla del club, y va delante de la cronología para que no haya duda:
        esto lo escribe alguien desde la banda. Los resultados y las
        clasificaciones de la web salen solo de la RFAF, y el acta es la que
        manda cuando llega.
      */}
      <p className="mt-3 rounded-xl border border-linea bg-panel-2 p-3 text-xs leading-relaxed text-mute">
        <strong className="font-bold text-tinta">Marcador orientativo.</strong> Lo
        va apuntando alguien del club desde el campo, así que puede llevar unos
        segundos de retraso o tener algún error.{" "}
        {partido.amistoso ? (
          <>
            Además es un <strong className="font-bold text-tinta">amistoso</strong>:
            no cuenta para la competición y no aparecerá en los resultados ni en la
            clasificación.
          </>
        ) : (
          <>
            El resultado oficial es el del acta arbitral, y aparece en la ficha del
            equipo cuando la RFAF lo publica.
          </>
        )}
      </p>

      {/* Compartir va aquí, con el marcador todavía a la vista: es cuando a uno
          le entran ganas de avisar a alguien, no al final de la cronología. */}
      <a
        href={`https://wa.me/?text=${encodeURIComponent(mensajeDe(partido, url))}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary mt-3 w-full py-3 text-sm"
      >
        <IconoWhatsApp size={18} />
        Compartir por WhatsApp
      </a>

      {/* Debajo de compartir: es la cifra que anima a mandarle el enlace a otro */}
      <ContadorSeguidores partido={partido.id} registrar />

      {/* Antes de la cronología: las cuentas resumen lo mismo que la lista, y
          quien las quiere las quiere en vez de leerse la lista entera */}
      <EstadisticasDirecto linea={estado.linea} partido={partido} />

      {/* Quien llega antes del partido no ve nada y no sabe si se ha
          equivocado de sitio: se le dice que está en el sitio bueno */}
      {!enMarcha ? (
        <p className="mt-3 rounded-xl border border-linea bg-panel-2 p-3 text-xs leading-relaxed text-mute">
          Todavía no ha empezado.{" "}
          <strong className="font-bold text-tinta">Guarda esta página</strong>: en
          cuanto empiece el partido, esto se va actualizando solo sin tener que
          recargar.
        </p>
      ) : null}

      <h2 className="title mt-6 text-xl text-tinta">Cómo va</h2>
      <Cronologia linea={estado.linea} partido={partido} />
    </section>
  );
}
