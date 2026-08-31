"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ItemGaleria } from "@/lib/contenido";
import {
  IconoCerrar,
  IconoFlecha,
  IconoDescarga,
  IconoImagen,
} from "@/components/Iconos";
import { fechaLarga } from "@/lib/formato";

/**
 * Fotos que se pintan de una vez.
 * Son 6 filas en escritorio y 12 en el móvil: suficiente para llenar la
 * pantalla sin mandar la galería entera en el HTML de la primera carga.
 */
const POR_TANDA = 24;

/**
 * Etiqueta pedida por la URL, tal y como está escrita en los datos.
 *
 * La ficha de un equipo enlaza aquí con ?album=Infantil B para enseñar solo
 * sus fotos. Se compara sin distinguir mayúsculas ni acentos del enlace.
 */
function albumPedido(items: ItemGaleria[], pedido: string | null): string {
  if (!pedido) return "todos";
  for (const i of items) {
    const encaja = i.albumes.find((a) => a.toLowerCase() === pedido.toLowerCase());
    if (encaja) return encaja;
  }
  return "todos";
}

/** Nombre con el que se guarda la foto al descargarla. */
function nombreDescarga(item: ItemGaleria): string {
  const extension = item.src?.split(".").pop() ?? "jpg";
  const base = item.titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || item.id}.${extension}`;
}

export default function Galeria({ items }: { items: ItemGaleria[] }) {
  const parametros = useSearchParams();
  // Se resuelve en el primer pintado: sin efecto no hay parpadeo de "todas"
  const [album, setAlbum] = useState<string>(() =>
    albumPedido(items, parametros.get("album")),
  );
  const [abierto, setAbierto] = useState<number | null>(null);
  const [tanda, setTanda] = useState(POR_TANDA);

  // Una foto puede llevar varias etiquetas y aparece bajo todas ellas
  const albumes = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const i of items) for (const a of i.albumes) cuenta.set(a, (cuenta.get(a) ?? 0) + 1);
    return [
      "todos",
      ...[...cuenta.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
        .map(([a]) => a),
    ];
  }, [items]);

  const visibles = useMemo(
    () =>
      items.filter((i) => album === "todos" || i.albumes.includes(album)),
    [items, album],
  );

  const mostradas = useMemo(() => visibles.slice(0, tanda), [visibles, tanda]);

  const cerrar = useCallback(() => setAbierto(null), []);
  const mover = useCallback(
    (paso: number) =>
      setAbierto((i) => {
        if (i === null) return null;
        const siguiente = (i + paso + visibles.length) % visibles.length;
        // El visor pasa por todas, así que la cuadrícula se estira detrás
        setTanda((t) => (siguiente < t ? t : siguiente + 1));
        return siguiente;
      }),
    [visibles.length],
  );

  // Teclado: Esc cierra, flechas navegan. Bloquea el scroll del fondo.
  useEffect(() => {
    if (abierto === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.dataset.menuOpen = "true";
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.body.dataset.menuOpen;
    };
  }, [abierto, cerrar, mover]);

  const actual = abierto === null ? null : visibles[abierto];

  return (
    <>
      {albumes.length > 2 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {albumes.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAlbum(a);
                setAbierto(null);
                setTanda(POR_TANDA);
              }}
              aria-pressed={album === a}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                album === a ? "bg-panel-2 text-tinta" : "text-mute hover:text-club"
              }`}
            >
              {a === "todos" ? "Todos los álbumes" : a}
            </button>
          ))}
        </div>
      ) : null}

      {visibles.length === 0 ? (
        <p className="mt-10 text-center text-mute">
          Todavía no hay contenido en esta sección.
        </p>
      ) : (
        /*
         * Mosaico en columnas: cada foto conserva su proporción y la columna
         * se va rellenando. Es lo que mejor encaja cuando se mezclan fotos
         * verticales del móvil con apaisadas, sin recortar ninguna.
         */
        <div className="mt-6 columns-2 gap-3 sm:columns-3 lg:columns-4 *:mb-3">
          {mostradas.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAbierto(i)}
                className="group relative block w-full break-inside-avoid overflow-hidden rounded-xl border border-linea bg-panel text-left"
              >
                {item.src ? (
                  <Image
                    src={item.src}
                    alt={item.titulo}
                    width={item.ancho}
                    height={item.alto}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="grid grid-cols-1 aspect-4/3 w-full place-items-center bg-linear-to-br from-club/15 via-panel-2 to-linea">
                    <IconoImagen size={28} className="text-club/35" />
                  </span>
                )}

                <span className="pie-foto pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-7">
                  <span className="line-clamp-2 text-xs font-semibold leading-snug text-white">
                    {item.titulo}
                  </span>
                </span>

              </button>
            ))}
        </div>
      )}

      {tanda < visibles.length ? (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setTanda((t) => t + POR_TANDA)}
            className="btn btn-ghost"
          >
            Cargar más fotos
          </button>
          <p className="mt-2 text-xs text-mute">
            {mostradas.length} de {visibles.length}
          </p>
        </div>
      ) : null}

      {actual ? (
        <div
          className="fixed inset-0 z-70 flex flex-col bg-club-dark/97 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={actual.titulo}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-white/70">
              {(abierto ?? 0) + 1} / {visibles.length}
              {actual.albumes.length > 0 ? ` · ${actual.albumes.join(" · ")}` : ""}
            </p>

            <div className="flex items-center gap-2">
              {actual.src ? (
                <a
                  href={actual.src}
                  download={nombreDescarga(actual)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-club transition-transform active:scale-95"
                >
                  <IconoDescarga size={17} />
                  <span className="hidden sm:inline">Descargar</span>
                </a>
              ) : null}

              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                className="grid grid-cols-1 h-11 w-11 place-items-center rounded-full border border-white/25 text-white"
              >
                <IconoCerrar />
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden px-4 pb-4">
            {actual.src ? (
              <Image
                src={actual.src}
                alt={actual.titulo}
                width={actual.ancho}
                height={actual.alto}
                sizes="100vw"
                className="max-h-full w-auto rounded-xl object-contain"
              />
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/15 px-5 py-4">
            <button
              type="button"
              onClick={() => mover(-1)}
              aria-label="Anterior"
              className="grid grid-cols-1 h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 text-white"
            >
              <IconoFlecha size={20} className="rotate-180" />
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate text-sm font-bold text-white">{actual.titulo}</p>
              <p className="text-xs text-white/70">{fechaLarga(actual.fecha)}</p>
            </div>
            <button
              type="button"
              onClick={() => mover(1)}
              aria-label="Siguiente"
              className="grid grid-cols-1 h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 text-white"
            >
              <IconoFlecha size={20} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
