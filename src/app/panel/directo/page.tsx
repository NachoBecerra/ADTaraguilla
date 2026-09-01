import type { Metadata } from "next";
import Link from "next/link";
import { haySesion } from "@/lib/panel/sesion";
import { partidosRetransmitibles } from "@/lib/directo/partidos";
import { retransmisionesAbiertas } from "./acciones";
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

  const candidatos = partidosRetransmitibles();
  const abiertas = new Set(await retransmisionesAbiertas(candidatos.map((c) => c.ficha.id)));

  const partidos: Fila[] = candidatos.map(({ ficha }) => ({
    id: ficha.id,
    nombreEquipo: ficha.nombreEquipo,
    local: ficha.local,
    visitante: ficha.visitante,
    fecha: ficha.fecha,
    hora: ficha.hora,
    campo: ficha.campo,
    abierta: abiertas.has(ficha.id),
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
    </section>
  );
}
