import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { leerRegistro } from "@/lib/directo/almacen";
import { site } from "@/data/site";
import { IconoFlecha } from "@/components/Iconos";
import Seguimiento from "./Seguimiento";

/**
 * El partido en directo, para el público.
 *
 * No se indexa: es una página que existe hora y media y luego queda vacía.
 * Dejarla en el buscador solo serviría para que alguien llegara meses después a
 * un marcador muerto. Compartir el enlace por WhatsApp sigue funcionando igual.
 */

/**
 * El título lleva los dos equipos porque es lo que se ve en WhatsApp.
 *
 * Al compartir el enlace, la vista previa del mensaje usa este título: con un
 * "En directo" a secas, quien lo recibe no sabe de qué partido le hablan.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ partido: string }>;
}): Promise<Metadata> {
  const registro = await leerRegistro((await params).partido);
  if (!registro) return { title: "En directo", robots: { index: false, follow: false } };

  const { local, visitante, nombreEquipo } = registro.partido;
  return {
    title: `${local} · ${visitante}`,
    description: `Sigue en directo el partido del ${nombreEquipo} de la ${site.nombre}.`,
    robots: { index: false, follow: false },
  };
}

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
      {/* La dirección la compone el servidor: con window.location el servidor y
          el navegador pintarían enlaces distintos y React daría la página por
          inconsistente. Y además así se comparte siempre la pública. */}
      <Seguimiento inicial={registro} url={`${site.url}/directo/${registro.partido.id}`} />
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
