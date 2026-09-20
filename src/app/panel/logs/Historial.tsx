"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { porDias, type Apunte, type Area } from "@/lib/bitacoraReglas";

/**
 * El historial, solo desde un navegador.
 *
 * No se enseña dentro de la aplicación instalada: es una pantalla para
 * revisar, no para el día a día del club, y no tiene que aparecerle a quien
 * usa la app. Como estar o no dentro de la aplicación solo lo sabe el
 * navegador, los apuntes **no viajan en la página**: se piden después de
 * comprobarlo, y en la app no se piden nunca.
 *
 * No hay enlace a esto en ninguna parte: se llega escribiendo la dirección.
 */

const NOMBRE_AREA: Record<Area, string> = {
  noticias: "Noticias",
  galeria: "Galería",
  directo: "Directo",
  panel: "Panel",
  rfaf: "RFAF",
};

const COLOR_AREA: Record<Area, string> = {
  noticias: "bg-club text-white",
  galeria: "bg-panel-2 text-tinta",
  directo: "bg-vivo text-white",
  panel: "bg-aviso-fuerte text-white",
  rfaf: "bg-rfaf text-white",
};

const hora = (ts: number) =>
  new Date(ts).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });

const diaLargo = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  });

/** Dentro de la aplicación instalada: sin barra de direcciones. */
function enLaApp(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  // Safari en iPhone no implementa display-mode y usa esto otro
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const sinSuscripcion = () => () => {};

function Fila({ apunte }: { apunte: Apunte }) {
  return (
    <li className="flex gap-3 border-b border-linea py-3 last:border-0">
      <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-mute">
        {hora(apunte.ts)}
      </span>

      <span
        className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${COLOR_AREA[apunte.area]}`}
      >
        {NOMBRE_AREA[apunte.area]}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${apunte.ok ? "text-tinta" : "text-roja-tinta"}`}>
          {apunte.ok ? "" : "No salió bien: "}
          {apunte.accion}
        </p>
        {apunte.detalle ? (
          <p className="text-xs leading-snug text-mute">{apunte.detalle}</p>
        ) : null}
      </div>

      <span className="h-fit shrink-0 text-[10px] font-bold uppercase tracking-wide text-mute">
        {apunte.quien === "campo" ? "campo" : apunte.quien === "bot" ? "bot" : ""}
      </span>
    </li>
  );
}

export default function Historial() {
  /* En el servidor vale `true`: así no se pinta nada hasta comprobarlo */
  const app = useSyncExternalStore(sinSuscripcion, enLaApp, () => true);
  const [apuntes, setApuntes] = useState<Apunte[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (app) return;

    let vigente = true;

    void (async () => {
      try {
        const r = await fetch("/api/bitacora", { cache: "no-store" });
        if (!r.ok) throw new Error(r.status === 401 ? "La sesión ha caducado." : `Error ${r.status}`);
        const datos = (await r.json()) as { apuntes: Apunte[] };
        if (vigente) setApuntes(datos.apuntes ?? []);
      } catch (e) {
        if (vigente) setError((e as Error).message);
      }
    })();

    return () => {
      vigente = false;
    };
  }, [app]);

  if (app) {
    return (
      <p className="card mt-8 p-5 text-sm leading-relaxed text-mute">
        El historial no se consulta desde la aplicación. Abre{" "}
        <strong className="text-tinta">ad-taraguilla.es/panel/logs</strong> en un navegador.
      </p>
    );
  }

  if (error) {
    return (
      <p className="mt-8 rounded-xl border border-roja-linea bg-roja p-5 text-sm font-bold text-roja-tinta">
        {error}
      </p>
    );
  }

  if (!apuntes) {
    return <p className="mt-8 text-sm text-mute">Cargando el historial…</p>;
  }

  const dias = porDias(apuntes);
  const fallidos = apuntes.filter((a) => !a.ok).length;

  if (dias.length === 0) {
    return (
      <p className="card mt-8 p-5 text-sm leading-relaxed text-mute">
        Todavía no hay nada apuntado. Aparecerá en cuanto se publique una noticia, se suban
        fotos o se abra una retransmisión.
      </p>
    );
  }

  return (
    <>
      <p className="mt-3 text-sm leading-relaxed text-mute">
        {apuntes.length} {apuntes.length === 1 ? "apunte" : "apuntes"}
        {fallidos > 0 ? (
          <>
            , <strong className="text-roja-tinta">{fallidos} con problemas</strong>
          </>
        ) : null}
        .
      </p>

      <div className="mt-8 space-y-7">
        {dias.map(({ dia, apuntes: delDia }) => (
          <div key={dia}>
            <h2 className="eyebrow mb-1.5">{diaLargo(dia)}</h2>
            <ul className="card px-4 py-1">
              {delDia.map((a) => (
                <Fila key={`${a.ts}-${a.accion}`} apunte={a} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
