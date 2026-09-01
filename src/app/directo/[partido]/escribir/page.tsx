import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { leerRegistro } from "@/lib/directo/almacen";
import { estadoDelEnlace } from "@/lib/directo/enlace";
import Botonera from "./Botonera";

/**
 * La pantalla desde la que se escribe el partido, en el campo.
 *
 * No lleva contraseña: la credencial es el propio enlace, firmado para este
 * partido y con caducidad. Un token que no es nuestro responde 404 y no "no
 * autorizado", para no confirmar siquiera qué partidos existen a quien vaya
 * probando direcciones.
 */

export const metadata: Metadata = {
  title: "Retransmitir",
  robots: { index: false, follow: false },
};

/* El registro cambia cada pocos segundos: nada que guardar en caché. */
export const dynamic = "force-dynamic";

export default async function Escribir({
  params,
  searchParams,
}: {
  params: Promise<{ partido: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { partido } = await params;
  const { t } = await searchParams;

  const estado = estadoDelEnlace(partido, t);
  if (estado === "falso") notFound();

  /*
   * Caducado no es 404: quien llega al campo con el enlace de la semana pasada
   * necesita saber que tiene que pedir otro, no toparse con una página de error.
   */
  if (estado === "caducado") {
    return (
      <section className="mx-auto max-w-sm px-5 py-16 text-center">
        <p className="eyebrow">Directo</p>
        <h1 className="title mt-2 text-3xl text-tinta">Este enlace ha caducado</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          Los enlaces para retransmitir dejan de valer unas horas después del
          partido. Pide uno nuevo en el panel del club y vuelve a intentarlo.
        </p>
      </section>
    );
  }

  const registro = await leerRegistro(partido);
  if (!registro) notFound();

  return <Botonera inicial={registro} token={t as string} />;
}
