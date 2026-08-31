import type { Metadata } from "next";
import { Suspense } from "react";
import { getGaleria } from "@/lib/contenido";
import Galeria from "@/components/Galeria";
import SeccionRedes from "@/components/SeccionRedes";

export const metadata: Metadata = {
  title: "Galería",
  description:
    "Fotos y vídeos de los partidos, la cantera y la vida de la AD Taraguilla.",
  alternates: { canonical: "/galeria" },
};

export default function PaginaGaleria() {
  const items = getGaleria();

  return (
    <>
      <section className="border-b border-linea">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <p className="eyebrow">Fotos</p>
          <h1 className="title mt-2 text-5xl text-tinta sm:text-6xl">Galería</h1>
          <p className="mt-3 text-base text-mute">
            {items.length} {items.length === 1 ? "foto" : "fotos"}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        {/*
          La galería mira ?album= para poder llegar filtrada desde la ficha de
          un equipo, y leer la URL obliga a este Suspense.
        */}
        <Suspense fallback={<p className="py-10 text-center text-mute">Cargando fotos…</p>}>
          <Galeria items={items} />
        </Suspense>
      </section>

      <SeccionRedes />
    </>
  );
}
