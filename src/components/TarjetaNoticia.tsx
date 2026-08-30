import Link from "next/link";
import type { Noticia } from "@/lib/contenido";
import { fechaLarga } from "@/lib/formato";
import Media from "@/components/Media";

export function TarjetaNoticia({
  noticia,
  destacada = false,
}: {
  noticia: Noticia;
  destacada?: boolean;
}) {
  return (
    <Link
      href={`/noticias/${noticia.slug}`}
      className="group card block overflow-hidden transition-colors hover:border-club"
    >
      {/*
        La foto se ve entera dentro de un marco de altura fija: así las
        tarjetas del listado quedan alineadas sin recortar caras.
      */}
      <div
        className={`relative w-full bg-panel-2 ${destacada ? "aspect-16/10" : "aspect-16/9"}`}
      >
        <Media
          src={noticia.portada}
          alt={noticia.titulo}
          className="h-full w-full !object-contain transition-transform duration-500 group-hover:scale-[1.03]"
          sizes="(min-width: 1024px) 33vw, 100vw"
        />
        <span className="absolute left-3 top-3 rounded-full bg-club px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
          {noticia.categoria}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <time dateTime={noticia.fecha} className="text-xs font-semibold uppercase tracking-wider text-mute">
          {fechaLarga(noticia.fecha)}
        </time>
        <h3
          className={`title mt-2 text-tinta ${destacada ? "text-2xl sm:text-3xl" : "text-xl"}`}
        >
          {noticia.titulo}
        </h3>
        {noticia.resumen ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mute">
            {noticia.resumen}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/** Variante compacta en horizontal, para listados densos en móvil. */
export function TarjetaNoticiaCompacta({ noticia }: { noticia: Noticia }) {
  return (
    <Link
      href={`/noticias/${noticia.slug}`}
      className="group flex gap-4 border-b border-linea py-4 last:border-0"
    >
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-panel-2">
        <Media
          src={noticia.portada}
          alt={noticia.titulo}
          className="h-full w-full !object-contain"
          sizes="112px"
        />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-club-soft">
          {noticia.categoria}
        </p>
        <h3 className="title mt-1 line-clamp-2 text-lg text-tinta">{noticia.titulo}</h3>
        <time dateTime={noticia.fecha} className="mt-1 block text-xs text-mute">
          {fechaLarga(noticia.fecha)}
        </time>
      </div>
    </Link>
  );
}
