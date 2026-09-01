import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { leerRegistro } from "@/lib/directo/almacen";
import { IconoFlecha } from "@/components/Iconos";
import Seguimiento from "./Seguimiento";

/**
 * El partido en directo, para el público.
 *
 * No se indexa: es una página que existe hora y media y luego queda vacía.
 * Dejarla en el buscador solo serviría para que alguien llegara meses después a
 * un marcador muerto. Compartir el enlace por WhatsApp sigue funcionando igual.
 */

export const metadata: Metadata = {
  title: "En directo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Directo({
  params,
}: {
  params: Promise<{ partido: string }>;
}) {
  const { partido } = await params;

  const registro = await leerRegistro(partido);
  if (!registro) notFound();

  return (
    <>
      <Seguimiento inicial={registro} />
      <div className="mx-auto max-w-lg px-4 pb-10">
        <Link
          href={`/equipos/${registro.partido.equipo}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-club-soft transition-colors hover:text-club"
        >
          Ver la ficha de {registro.partido.nombreEquipo}
          <IconoFlecha size={15} />
        </Link>
      </div>
    </>
  );
}
