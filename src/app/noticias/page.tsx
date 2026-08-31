import type { Metadata } from "next";
import { getNoticias, getCategorias } from "@/lib/contenido";
import ListaNoticias from "@/components/ListaNoticias";
import SeccionRedes from "@/components/SeccionRedes";

export const metadata: Metadata = {
  title: "Noticias",
  description:
    "Toda la actualidad de la AD Taraguilla: crónicas de partido, fichajes, cantera y vida del club.",
  alternates: { canonical: "/noticias" },
};

export default function PaginaNoticias() {
  const noticias = getNoticias();
  const categorias = getCategorias();

  return (
    <>
      <section className="border-b border-linea">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <p className="eyebrow">Actualidad</p>
          <h1 className="title mt-2 text-5xl text-tinta sm:text-6xl">Noticias</h1>
          <p className="mt-3 max-w-md text-base text-mute">
            Crónicas, convocatorias, fichajes y todo lo que pasa en el club.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <ListaNoticias noticias={noticias} categorias={categorias} />
      </section>

      <SeccionRedes />
    </>
  );
}
