import type { Metadata } from "next";
import Link from "next/link";
import { haySesion } from "@/lib/panel/sesion";
import { partidosRetransmitibles } from "@/lib/directo/partidos";
import { hoyEnMadrid } from "@/lib/directo/ventana";
import { seVeEnElPanel } from "@/lib/directo/panel";
import {
  amistososDelPanel,
  equiposDelClub,
  estadoDeRetransmisiones,
} from "./acciones";
import NuevoAmistoso from "./NuevoAmistoso";
import { saqueEnMs } from "@/lib/directo/partidos";
import Acceso from "../Acceso";
import Listado, { type Fila } from "./Listado";
import { IconoFlecha } from "@/components/Iconos";

export const metadata: Metadata = {
  title: "Directo · Panel",
  robots: { index: false, follow: false },
};

/** Siempre al día: un partido abierto hace un minuto tiene que salir ya. */
export const dynamic = "force-dynamic";

export default async function PanelDirecto() {
  if (!(await haySesion())) return <Acceso />;

  /*
   * Los del calendario de la RFAF y los que el club haya creado a mano. Los
   * segundos solo existen en el almacén del directo, así que hay que ir a
   * buscarlos aparte.
   */
  const [amistosos, equipos] = await Promise.all([amistososDelPanel(), equiposDelClub()]);

  const candidatos = [
    ...partidosRetransmitibles(),
    ...amistosos.map((ficha) => ({ ficha, saqueMs: saqueEnMs(ficha.fecha ?? "", ficha.hora) })),
  ].sort((a, b) => a.saqueMs - b.saqueMs);

  const estados = await estadoDeRetransmisiones(candidatos.map((c) => c.ficha.id));

  const partidos: Fila[] = candidatos
    .filter(({ ficha }) =>
      seVeEnElPanel(estados[ficha.id]?.estado ?? "sin-abrir", ficha.fecha, hoyEnMadrid()),
    )
    .map(({ ficha }) => ({
      id: ficha.id,
      nombreEquipo: ficha.nombreEquipo,
      local: ficha.local,
      visitante: ficha.visitante,
      fecha: ficha.fecha,
      hora: ficha.hora,
      campo: ficha.campo,
      estado: estados[ficha.id]?.estado ?? "sin-abrir",
      anunciado: estados[ficha.id]?.anunciado ?? false,
      amistoso: ficha.amistoso === true,
    }));

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/panel"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-mute transition-colors hover:text-club"
      >
        <IconoFlecha size={16} className="rotate-180" />
        Panel
      </Link>

      <p className="eyebrow mt-5">Directo</p>
      <h1 className="title mt-2 text-4xl text-tinta">Retransmitir un partido</h1>
      <p className="mt-3 text-sm leading-relaxed text-mute">
        Elige el partido y manda el enlace a quien vaya a estar en el campo. No
        necesita la contraseña del club ni instalar nada: con abrir el enlace en
        el móvil le sale la pantalla para ir apuntando.
      </p>

      <Listado partidos={partidos} />

      <NuevoAmistoso equipos={equipos} />
    </section>
  );
}
