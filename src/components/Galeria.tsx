"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemGaleria } from "@/lib/contenido";
import Media from "@/components/Media";
import { IconoPlay, IconoCerrar, IconoFlecha } from "@/components/Iconos";
import { fechaLarga } from "@/lib/formato";

type Filtro = "todo" | "foto" | "video";

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: "todo", texto: "Todo" },
  { id: "foto", texto: "Fotos" },
  { id: "video", texto: "Vídeos" },
];

/** Miniatura de YouTube cuando el vídeo no tiene imagen propia. */
function miniatura(item: ItemGaleria): string {
  if (item.src) return item.src;
  if (item.youtubeId) return `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`;
  return "";
}

export default function Galeria({ items }: { items: ItemGaleria[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [album, setAlbum] = useState<string>("todos");
  const [abierto, setAbierto] = useState<number | null>(null);

  const albumes = useMemo(
    () => ["todos", ...new Set(items.map((i) => i.album))],
    [items],
  );

  const visibles = useMemo(
    () =>
      items.filter(
        (i) =>
          (filtro === "todo" || i.tipo === filtro) &&
          (album === "todos" || i.album === album),
      ),
    [items, filtro, album],
  );

  const cerrar = useCallback(() => setAbierto(null), []);
  const mover = useCallback(
    (paso: number) =>
      setAbierto((i) =>
        i === null ? null : (i + paso + visibles.length) % visibles.length,
      ),
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
      <div className="flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              // Al cambiar de filtro el índice abierto deja de ser válido
              setFiltro(f.id);
              setAbierto(null);
            }}
            aria-pressed={filtro === f.id}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              filtro === f.id
                ? "bg-club text-white"
                : "border border-linea bg-panel text-mute hover:border-club hover:text-club"
            }`}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {albumes.length > 2 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {albumes.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAlbum(a);
                setAbierto(null);
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
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibles.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAbierto(i)}
              className="group relative aspect-square overflow-hidden rounded-xl border border-linea text-left"
            >
              <Media
                src={miniatura(item)}
                alt={item.titulo}
                className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                sizes="(min-width: 1024px) 25vw, 50vw"
              />
              <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent" />

              {item.tipo === "video" ? (
                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-club text-white shadow-lg">
                    <IconoPlay size={22} />
                  </span>
                </span>
              ) : null}

              <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
                <span className="line-clamp-2 text-xs font-semibold leading-snug text-white">
                  {item.titulo}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {actual ? (
        <div
          className="fixed inset-0 z-70 flex flex-col bg-club-dark/97 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={actual.titulo}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-white/70">
              {(abierto ?? 0) + 1} / {visibles.length} · {actual.album}
            </p>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-white"
            >
              <IconoCerrar />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center px-4 pb-4">
            {actual.tipo === "video" ? (
              actual.youtubeId ? (
                <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-xl bg-black">
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${actual.youtubeId}`}
                    title={actual.titulo}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <p className="max-w-sm text-center text-white/70">
                  Este vídeo todavía no tiene enlace de YouTube configurado.
                </p>
              )
            ) : (
              <div className="relative h-full max-h-[70vh] w-full max-w-4xl overflow-hidden rounded-xl">
                <Media
                  src={actual.src}
                  alt={actual.titulo}
                  className="h-full w-full !object-contain"
                  sizes="100vw"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/15 px-5 py-4">
            <button
              type="button"
              onClick={() => mover(-1)}
              aria-label="Anterior"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 text-white"
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
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 text-white"
            >
              <IconoFlecha size={20} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
