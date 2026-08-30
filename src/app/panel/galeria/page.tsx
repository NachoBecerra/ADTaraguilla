import type { Metadata } from "next";
import Link from "next/link";
import { haySesion } from "@/lib/panel/sesion";
import { getGaleria, getAlbumes } from "@/lib/contenido";
import Acceso from "../Acceso";
import Subidor from "./Subidor";
import { IconoFlecha } from "@/components/Iconos";

export const metadata: Metadata = {
  title: "Galería · Panel",
  robots: { index: false, follow: false },
};

export default async function PanelGaleria() {
  if (!(await haySesion())) return <Acceso />;

  const fotos = getGaleria();

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

      <Subidor albumes={getAlbumes()} />

      {fotos.length > 0 ? (
        <p className="mt-10 text-sm text-mute">
          Ahora mismo hay {fotos.length} {fotos.length === 1 ? "foto" : "fotos"} en la{" "}
          <Link href="/galeria" className="text-club-soft underline underline-offset-2">
            galería
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
