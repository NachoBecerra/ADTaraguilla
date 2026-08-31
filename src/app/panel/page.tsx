import type { Metadata } from "next";
import Link from "next/link";
import { haySesion } from "@/lib/panel/sesion";
import { getNoticias } from "@/lib/contenido";
import { entradasDeGaleria } from "@/lib/panel/galeria";
import Acceso from "./Acceso";
import { salir } from "./acciones";
import { IconoFlecha, IconoImagen } from "@/components/Iconos";

export const metadata: Metadata = {
  title: "Panel del club",
  robots: { index: false, follow: false },
};

export default async function Panel() {
  if (!(await haySesion())) return <Acceso />;

  const noticias = getNoticias().length;
  const fotos = (await entradasDeGaleria()).reduce((n, e) => n + e.fotos.length, 0);

  const secciones = [
    {
      href: "/panel/galeria",
      titulo: "Galería",
      texto: `${fotos} ${fotos === 1 ? "foto" : "fotos"} publicadas. Sube varias de una vez.`,
    },
    {
      href: "/panel/noticias",
      titulo: "Noticias",
      texto: `${noticias} ${noticias === 1 ? "noticia" : "noticias"} publicadas.`,
    },
  ];

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Panel del club</p>
          <h1 className="title mt-2 text-4xl text-tinta">Qué quieres hacer</h1>
        </div>
        <form action={salir}>
          <button type="submit" className="btn btn-ghost px-4 py-2 text-sm">
            Salir
          </button>
        </form>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card block p-5 transition-colors hover:border-club"
          >
            <IconoImagen size={24} className="text-club" />
            <h2 className="title mt-3 text-2xl text-tinta">{s.titulo}</h2>
            <p className="mt-1 text-sm text-mute">{s.texto}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-club-soft">
              Abrir
              <IconoFlecha size={15} />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 rounded-xl border border-linea bg-panel p-4 text-xs leading-relaxed text-mute">
        Lo que publiques aquí se guarda en el repositorio del club y la web se
        actualiza sola en un par de minutos. Los resultados y clasificaciones no se
        tocan desde aquí: vienen de la RFAF.
      </p>
    </section>
  );
}
