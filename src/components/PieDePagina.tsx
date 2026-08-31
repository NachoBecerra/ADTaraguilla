import Link from "next/link";
import Image from "next/image";
import { site, redesActivas } from "@/data/site";
import { iconosRed, IconoUbicacion, IconoEnlaceExterno } from "@/components/Iconos";

export default function PieDePagina() {
  return (
    <footer className="mt-20 bg-club-dark text-white">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-3">
              <Image
                src={site.escudo}
                alt=""
                width={843}
                height={836}
                sizes="46px"
                className="h-11 w-auto"
              />
              <div>
                <p className="title text-xl text-white">{site.nombreLargo}</p>
                <p className="text-sm text-club-claro">{site.lema}</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
              {site.descripcion}
            </p>
          </div>

          <div>
            <p className="eyebrow eyebrow-claro mb-4">Secciones</p>
            <ul className="space-y-2.5 text-sm">
              {[
                { href: "/equipos", t: "Equipos" },
                { href: "/noticias", t: "Noticias" },
                { href: "/galeria", t: "Galería" },
                { href: "/historico", t: "Histórico" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-white/75 transition-colors hover:text-white">
                    {l.t}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={site.federacion.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-white/75 transition-colors hover:text-white"
                >
                  {site.federacion.siglas}
                  <IconoEnlaceExterno size={13} />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="eyebrow eyebrow-claro mb-4">El club</p>
            <a
              href={site.contacto.mapaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-white/75 transition-colors hover:text-white"
            >
              <IconoUbicacion size={17} className="mt-0.5 shrink-0 text-club-claro" />
              <span>
                {site.contacto.campo}
                <br />
                {site.contacto.direccion}
              </span>
            </a>
            {site.contacto.email ? (
              <a
                href={`mailto:${site.contacto.email}`}
                className="mt-3 inline-block text-sm text-white/75 transition-colors hover:text-white"
              >
                {site.contacto.email}
              </a>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {redesActivas.map((r) => {
                const Icono = iconosRed[r.id];
                return (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={r.nombre}
                    className="grid grid-cols-1 h-10 w-10 place-items-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-white hover:bg-white hover:text-club-dark"
                  >
                    {Icono ? <Icono size={19} /> : r.nombre[0]}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/15 pt-6 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.nombreLargo}. Todos los derechos reservados.
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Datos de competición: {site.federacion.nombre} ·{" "}
              {site.federacion.delegacion}
            </span>
            <span aria-hidden className="hidden sm:inline">
              ·
            </span>
            {/* Discreto a propósito: lo que protege el panel es la contraseña,
                no que su dirección sea difícil de encontrar. */}
            <Link
              href="/panel"
              className="underline underline-offset-2 transition-colors hover:text-white"
            >
              Panel del club
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
