import type { Metadata } from "next";
import Link from "next/link";
import { haySesion } from "@/lib/panel/sesion";
import { leerBitacora } from "@/lib/bitacora";
import { porDias, type Apunte, type Area } from "@/lib/bitacoraReglas";
import Acceso from "../Acceso";
import { IconoFlecha } from "@/components/Iconos";

/**
 * El historial de todo lo que se hace con los datos del club.
 *
 * Publicar, borrar, abrir un directo, entrar al panel… y lo que salió mal.
 * Antes esto no estaba en ningún sitio: el panel enseñaba un mensaje que
 * desaparecía y ya. Cuando algo no cuadra —«¿quién borró esa foto?», «¿se
 * llegó a abrir la retransmisión?»— se mira aquí.
 */

export const metadata: Metadata = {
  title: "Historial · Panel",
  robots: { index: false, follow: false },
};

/* Se lee del almacén en cada visita: un historial con retraso no sirve */
export const dynamic = "force-dynamic";

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

      {/* Quién lo hizo: el panel, alguien en el campo o el bot de la RFAF */}
      <span className="h-fit shrink-0 text-[10px] font-bold uppercase tracking-wide text-mute">
        {apunte.quien === "campo" ? "campo" : apunte.quien === "bot" ? "bot" : ""}
      </span>
    </li>
  );
}

export default async function PanelLogs() {
  if (!(await haySesion())) return <Acceso />;

  const apuntes = await leerBitacora();
  const dias = porDias(apuntes);
  const fallidos = apuntes.filter((a) => !a.ok).length;

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/panel"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-mute transition-colors hover:text-club"
      >
        <IconoFlecha size={16} className="rotate-180" />
        Panel
      </Link>

      <p className="eyebrow mt-5">Panel del club</p>
      <h1 className="title mt-2 text-4xl text-tinta">Historial</h1>
      <p className="mt-3 text-sm leading-relaxed text-mute">
        Todo lo que se ha hecho con los datos de la web en los últimos meses, y lo que
        falló al intentarlo. {apuntes.length} {apuntes.length === 1 ? "apunte" : "apuntes"}
        {fallidos > 0 ? (
          <>
            , <strong className="text-roja-tinta">{fallidos} con problemas</strong>
          </>
        ) : null}
        .
      </p>

      {dias.length === 0 ? (
        <p className="card mt-8 p-5 text-sm leading-relaxed text-mute">
          Todavía no hay nada apuntado. Aparecerá en cuanto se publique una noticia, se
          suban fotos o se abra una retransmisión.
        </p>
      ) : (
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
      )}
    </section>
  );
}
