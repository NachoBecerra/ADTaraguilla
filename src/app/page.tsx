import Link from "next/link";
import Image from "next/image";
import { site } from "@/data/site";
import { getNoticias, getGaleria } from "@/lib/contenido";
import {
  resumenEquipos,
  temporada,
  getEquipos,
} from "@/lib/competicion";
import { TarjetaNoticia } from "@/components/TarjetaNoticia";
import { TarjetaProximoPartido } from "@/components/Partidos";
import { idPartido } from "@/lib/directo/idPartido";
import ResumenPartido from "@/components/ResumenPartido";
import { DirectosAhora } from "@/components/EnDirecto";
import SeccionRedes from "@/components/SeccionRedes";
import Media from "@/components/Media";
import { IconoFlecha } from "@/components/Iconos";

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
  // Lo que viene primero, y lo ya jugado de más reciente a más antiguo.
  // Sin fecha van al final: no se puede ordenar lo que no la tiene.
  const orden = (f?: string | null) => f ?? "9999-99-99";

  const proximos = equipos
    .filter((e) => e.proximo && !e.proximo.descanso)
    .sort((a, b) => orden(a.proximo?.fecha).localeCompare(orden(b.proximo?.fecha)));

  const resultados = equipos
    .filter((e) => e.ultimo)
    .sort((a, b) => orden(b.ultimo?.fecha).localeCompare(orden(a.ultimo?.fecha)));

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
              width={843}
              height={836}
              sizes="96px"
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

          <h1 className="mt-7 inline-block text-[3.25rem] leading-[0.88] sm:text-7xl lg:text-8xl">
            {/*
              Las dos líneas ocupan lo mismo sin forzar nada.

              "Agrupación Deportiva" y "Taraguilla" van en la misma tipografía,
              así que la proporción entre sus anchos es fija: medida, 1,9536.
              Poniendo el antetítulo a 0.512em del tamaño grande, las dos
              líneas miden igual con un espacio normal entre palabras, y sigue
              cuadrando en cualquier pantalla sin tocar cada breakpoint.
            */}
            <span className="title block text-[0.512em] leading-none text-white/75">
              {site.nombreLargo.split(" ").slice(0, -1).join(" ")}
            </span>
            <span className="title block leading-[0.88] text-club-claro">
              {site.nombreLargo.split(" ").at(-1)}
            </span>
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
      {/*
        Si hay partido ahora mismo, va lo primero: es lo único de esta página
        que caduca en noventa minutos. No ocupa nada el resto de la semana.
      */}
      {/* El primer equipo se salta si su tarjeta de abajo ya lo enseña: el
          mismo partido dos veces en la misma pantalla sobra */}
      <DirectosAhora
        omitir={idPartido(primerEquipo?.equipo.id ?? "", primerEquipo?.proximo?.fecha)}
      />

      {primerEquipo?.proximo ? (
        <div className="mx-auto max-w-6xl px-5 pt-10">
          <TarjetaProximoPartido
            partido={primerEquipo.proximo}
            equipo={primerEquipo.equipo.id}
            titulo={`${primerEquipo.equipo.nombre} · próximo partido`}
          />
        </div>
      ) : null}

      {/* -------------------------------------------- próximos y resultados */}
      {proximos.length > 0 ? (
        <section className="mx-auto max-w-6xl px-5 pt-14">
          <TituloSeccion
            epigrafe="Lo que viene"
            titulo="Próximos partidos"
            href="/equipos"
            enlace="Todos los equipos"
          />
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {proximos.map(({ equipo, proximo }) => (
              <ResumenPartido key={equipo.id} equipo={equipo} partido={proximo!} />
            ))}
          </div>
        </section>
      ) : null}

      {resultados.length > 0 ? (
        <section className="mx-auto max-w-6xl px-5 pt-14">
          <TituloSeccion
            epigrafe="Lo último"
            titulo="Últimos resultados"
            href="/equipos"
            enlace="Todos los equipos"
          />
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resultados.map(({ equipo, ultimo }) => (
              <ResumenPartido key={equipo.id} equipo={equipo} partido={ultimo!} />
            ))}
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

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TarjetaNoticia noticia={destacada} destacada />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
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
                  src={item.src}
                  alt={item.titulo}
                  className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                  sizes="176px"
                />

                <span className="pie-foto absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-7 text-xs font-semibold leading-snug text-white">
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
