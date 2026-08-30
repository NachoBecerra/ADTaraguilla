import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNoticia, getNoticias } from "@/lib/contenido";
import { fechaLarga } from "@/lib/formato";
import { site } from "@/data/site";
import MediaCompleta from "@/components/MediaCompleta";
import { TarjetaNoticia } from "@/components/TarjetaNoticia";
import Compartir from "@/components/Compartir";
import { IconoFlecha } from "@/components/Iconos";

export function generateStaticParams() {
  return getNoticias().map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/noticias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const noticia = getNoticia(slug);
  if (!noticia) return { title: "Noticia no encontrada" };

  return {
    title: noticia.titulo,
    description: noticia.resumen,
    openGraph: {
      type: "article",
      title: noticia.titulo,
      description: noticia.resumen,
      publishedTime: noticia.fecha,
      images: noticia.portada ? [noticia.portada] : undefined,
    },
  };
}

export default async function PaginaNoticia({ params }: PageProps<"/noticias/[slug]">) {
  const { slug } = await params;
  const noticia = getNoticia(slug);
  if (!noticia) notFound();

  const url = `${site.url}/noticias/${noticia.slug}`;

  const relacionadas = getNoticias()
    .filter((n) => n.slug !== noticia.slug)
    .slice(0, 3);

  return (
    <article>
      <div className="mx-auto max-w-3xl px-5 pt-8">
        <Link
          href="/noticias"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-mute transition-colors hover:text-club"
        >
          <IconoFlecha size={16} className="rotate-180" />
          Todas las noticias
        </Link>

        <p className="eyebrow mt-6">{noticia.categoria}</p>
        <h1 className="title mt-2 text-4xl leading-[0.95] text-tinta sm:text-5xl">
          {noticia.titulo}
        </h1>

        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mute">
          <time dateTime={noticia.fecha}>{fechaLarga(noticia.fecha)}</time>
          <span aria-hidden>·</span>
          <span>{noticia.autor}</span>
        </p>
      </div>

      <div className="mx-auto mt-7 max-w-4xl px-5">
        <div className="overflow-hidden rounded-2xl border border-linea bg-panel">
          <MediaCompleta
            src={noticia.portada}
            alt={noticia.titulo}
            sizes="(min-width: 896px) 896px, 100vw"
            priority
          />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 pt-8">
        {noticia.resumen ? (
          <p className="border-l-2 border-club pl-4 text-lg font-medium leading-relaxed text-tinta">
            {noticia.resumen}
          </p>
        ) : null}

        <div
          className="prosa mt-8"
          dangerouslySetInnerHTML={{ __html: noticia.cuerpoHtml }}
        />

        <div className="mt-10 border-t border-linea pt-6">
          <p className="eyebrow mb-3">Compartir</p>
          <Compartir
            titulo={noticia.titulo}
            resumen={noticia.resumen}
            url={url}
            portada={noticia.portada}
          />
        </div>
      </div>

      {relacionadas.length > 0 ? (
        <section className="mx-auto max-w-6xl px-5 pt-16">
          <h2 className="title text-3xl text-tinta">Más noticias</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relacionadas.map((n) => (
              <TarjetaNoticia key={n.slug} noticia={n} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
