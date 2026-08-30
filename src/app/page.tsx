import Link from "next/link";
import Image from "next/image";
import { site } from "@/data/site";
import { getNoticias, getGaleria } from "@/lib/contenido";
import {
  resumenEquipos,
  temporada,
  haEmpezado,
  getEquipos,
} from "@/lib/competicion";
import { TarjetaNoticia } from "@/components/TarjetaNoticia";
import { TarjetaProximoPartido, Marcador } from "@/components/Partidos";
import SeccionRedes from "@/components/SeccionRedes";
import Media from "@/components/Media";
import { IconoFlecha, IconoPlay } from "@/components/Iconos";
import { fechaLarga } from "@/lib/formato";

function TituloSeccion({
  epigrafe,
  titulo,
  href,
  enlace,
}: {
  epigrafe: string;
  titulo: string;
  href?: string;
  enlace?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{epigrafe}</p>
        <h2 className="title mt-1.5 text-3xl text-tinta sm:text-4xl">{titulo}</h2>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-sm font-bold text-club-soft"
        >
          {enlace ?? "Ver todo"}
          <IconoFlecha size={16} />
        </Link>
      ) : null}
    </div>
  );
}

export default function Inicio() {
  const noticias = getNoticias();
  const galeria = getGaleria().slice(0, 8);
  const equipos = resumenEquipos();

  const primerEquipo = equipos[0];

  // En la tira de equipos solo entran los que ya tienen algo que contar
  const conActividad = equipos.filter((e) => e.proximo || e.ultimo);

  const [destacada, ...resto] = noticias;

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-club text-white">
        <div
          aria-hidden
          className="absolute inset-y-0 -right-40 w-2/3 skew-x-[-14deg] bg-club-dark/70"
        />
        <div
          aria-hidden
          className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-white/8 blur-3xl"
        />

        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-10 sm:pb-16 sm:pt-14">
          <div className="flex items-center gap-4">
            <Image
              src={site.escudo}
              alt=""
              width={88}
              height={86}
              priority
              className="h-20 w-auto drop-shadow-[0_10px_28px_rgba(0,0,0,0.35)] sm:h-24"
            />
            <div>
              <p className="eyebrow eyebrow-claro">Web oficial · {site.localidad}</p>
              <p className="mt-1 text-sm text-white/80">
                {getEquipos().length} equipos · Temporada {temporada}
              </p>
            </div>
          </div>

          <h1 className="title mt-7 text-[3.25rem] leading-[0.88] sm:text-7xl lg:text-8xl">
            {site.nombreLargo.split(" ").slice(0, -1).join(" ")}
            <br />
            <span className="text-club-claro">{site.nombreLargo.split(" ").at(-1)}</span>
          </h1>

          <p className="mt-4 max-w-md text-base leading-relaxed text-white/85">
            {site.lema}. Resultados y calendarios de todos nuestros equipos, actualizados
            directamente desde la {site.federacion.siglas}.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/equipos" className="btn btn-sobre-verde">
              Nuestros equipos
              <IconoFlecha size={17} />
            </Link>
            <Link
              href="/noticias"
              className="btn border border-white/40 text-white hover:bg-white/10"
            >
              Últimas noticias
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------- próximo partido del primer equipo */}
      {primerEquipo?.proximo ? (
        <div className="mx-auto max-w-6xl px-5 pt-10">
          <TarjetaProximoPartido
            partido={primerEquipo.proximo}
            titulo={`${primerEquipo.equipo.nombre} · próximo partido`}
          />
        </div>
      ) : null}

      {/* ------------------------------------------------- todos los equipos */}
      {conActividad.length > 0 ? (
        <section className="pt-14">
          <div className="mx-auto max-w-6xl px-5">
            <TituloSeccion
              epigrafe="El club al completo"
              titulo="Todos los equipos"
              href="/equipos"
              enlace="Ver todos"
            />
          </div>

          {/* Carrusel: en el móvil caben nueve equipos sin hacer scroll eterno */}
          <div className="rail mt-6 mx-auto max-w-6xl">
            {conActividad.map(({ equipo, proximo, ultimo, competicion }) => {
              const fila = haEmpezado(competicion)
                ? competicion?.clasificacion.find((f) => f.equipo === equipo.nombreRfaf)
                : null;
              return (
                <Link
                  key={equipo.id}
                  href={`/equipos/${equipo.id}`}
                  className="card w-64 p-4 transition-colors hover:border-club"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="title text-xl text-tinta">{equipo.nombre}</h3>
                    {fila ? (
                      <span className="shrink-0 rounded-lg bg-panel-2 px-2 py-1 text-xs font-bold text-club">
                        {fila.posicion}º
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2 border-t border-linea pt-3 text-sm">
                    {ultimo ? (
                      <div className="flex items-center gap-2">
                        <Marcador partido={ultimo} />
                        <span className="min-w-0 truncate text-mute">{ultimo.rival}</span>
                      </div>
                    ) : null}
                    {proximo ? (
                      <p className="truncate text-xs text-mute">
                        <span className="font-bold uppercase text-club-soft">Próximo</span>{" "}
                        {proximo.rival}
                        {proximo.fecha ? ` · ${fechaLarga(proximo.fecha)}` : ""}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- noticias */}
      {destacada ? (
        <section className="mx-auto max-w-6xl px-5 pt-14">
          <TituloSeccion
            epigrafe="Actualidad"
            titulo="Noticias del club"
            href="/noticias"
            enlace="Todas"
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TarjetaNoticia noticia={destacada} destacada />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {resto.slice(0, 2).map((n) => (
                <TarjetaNoticia key={n.slug} noticia={n} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------------- galería */}
      {galeria.length > 0 ? (
        <section className="pt-14">
          <div className="mx-auto max-w-6xl px-5">
            <TituloSeccion epigrafe="Fotos y vídeos" titulo="La galería" href="/galeria" />
          </div>

          <div className="rail mt-6 mx-auto max-w-6xl">
            {galeria.map((item) => (
              <Link
                key={item.id}
                href="/galeria"
                className="group relative h-44 w-36 overflow-hidden rounded-xl border border-linea sm:h-52 sm:w-44"
              >
                <Media
                  src={
                    item.src ||
                    (item.youtubeId
                      ? `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`
                      : "")
                  }
                  alt={item.titulo}
                  className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                  sizes="176px"
                />
                <span className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent" />
                {item.tipo === "video" ? (
                  <span className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-club text-white">
                    <IconoPlay size={15} />
                  </span>
                ) : null}
                <span className="absolute inset-x-0 bottom-0 p-3 text-xs font-semibold leading-snug text-white">
                  <span className="line-clamp-2">{item.titulo}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}


      {/* ------------------------------------------------------------- redes */}
      <div className="pt-14">
        <SeccionRedes />
      </div>
    </>
  );
}
