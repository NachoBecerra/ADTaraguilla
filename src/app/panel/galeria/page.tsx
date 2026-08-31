import type { Metadata } from "next";
import Link from "next/link";
import { haySesion } from "@/lib/panel/sesion";
import { entradasDeGaleria, albumesDe } from "@/lib/panel/galeria";
import { getEquipos } from "@/lib/competicion";
import Acceso from "../Acceso";
import Subidor from "./Subidor";
import Listado from "./Listado";
import { IconoFlecha } from "@/components/Iconos";

export const metadata: Metadata = {
  title: "Galería · Panel",
  robots: { index: false, follow: false },
};

export default async function PanelGaleria() {
  if (!(await haySesion())) return <Acceso />;

  // Se leen del repositorio, no de la compilación: así un cambio recién
  // guardado se ve al momento y no dentro de dos minutos.
  const entradas = await entradasDeGaleria();
  const albumes = albumesDe(entradas);
  const totalFotos = entradas.reduce((n, e) => n + e.fotos.length, 0);

  // Solo id y nombre: lo demás no hace falta en el navegador
  const equipos = getEquipos().map((e) => ({ id: e.id, nombre: e.nombre }));

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/panel"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-mute transition-colors hover:text-club"
      >
        <IconoFlecha size={16} className="rotate-180" />
        Panel
      </Link>

      <p className="eyebrow mt-5">Galería</p>
      <h1 className="title mt-2 text-4xl text-tinta">Subir fotos</h1>
      <p className="mt-3 text-sm leading-relaxed text-mute">
        Elige todas las fotos de una vez. Se reducen en tu propio móvil antes de
        subirse, así que da igual que sean las originales de la cámara.
      </p>

      <Subidor albumes={albumes} equipos={equipos} />

      <div className="mt-14">
        <h2 className="title text-3xl text-tinta">Lo que ya está publicado</h2>
        <p className="mt-1 text-sm text-mute">
          {totalFotos} {totalFotos === 1 ? "foto" : "fotos"} en la{" "}
          <Link href="/galeria" className="text-club-soft underline underline-offset-2">
            galería
          </Link>
          . Pulsa en cualquiera para cambiar su título, su álbum o su fecha, quitar
          fotos sueltas o eliminarla entera.
        </p>

        <Listado entradas={entradas} albumes={albumes} equipos={equipos} />
      </div>
    </section>
  );
}
