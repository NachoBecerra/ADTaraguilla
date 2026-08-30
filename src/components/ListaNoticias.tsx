"use client";

import { useMemo, useState } from "react";
import type { Noticia } from "@/lib/contenido";
import { TarjetaNoticia } from "@/components/TarjetaNoticia";

export default function ListaNoticias({
  noticias,
  categorias,
}: {
  noticias: Noticia[];
  categorias: string[];
}) {
  const [categoria, setCategoria] = useState("todas");
  const [visibles, setVisibles] = useState(9);

  const filtradas = useMemo(
    () =>
      categoria === "todas"
        ? noticias
        : noticias.filter((n) => n.categoria === categoria),
    [noticias, categoria],
  );

  const mostradas = filtradas.slice(0, visibles);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {["todas", ...categorias].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCategoria(c);
              setVisibles(9);
            }}
            aria-pressed={categoria === c}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition-colors ${
              categoria === c
                ? "bg-club text-white"
                : "border border-linea bg-panel text-mute hover:border-club hover:text-club"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {mostradas.length === 0 ? (
        <p className="mt-12 text-center text-mute">
          Todavía no hay noticias en esta categoría.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mostradas.map((n) => (
            <TarjetaNoticia key={n.slug} noticia={n} />
          ))}
        </div>
      )}

      {visibles < filtradas.length ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibles((v) => v + 9)}
            className="btn btn-ghost"
          >
            Cargar más noticias
          </button>
        </div>
      ) : null}
    </>
  );
}
