"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  guardarEntrada,
  borrarFoto,
  borrarEntrada,
  type Resultado,
} from "./acciones";
import CampoEtiquetas from "@/components/CampoEtiquetas";
import { IconoCerrar, IconoBuscar } from "@/components/Iconos";
import { fechaCorta } from "@/lib/formato";

export type EntradaPanel = {
  id: string;
  titulo: string;
  albumes: string[];
  fecha: string;
  fotos: { url: string; ancho: number; alto: number }[];
};

/** Quita acentos para que "cadiz" encuentre "Cádiz". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function Aviso({ resultado }: { resultado: Resultado | null }) {
  if (!resultado) return null;
  return (
    <p role="status" className="mt-3 text-sm font-semibold text-club">
      {resultado.mensaje}
    </p>
  );
}

/* ------------------------------------------------------------------ modal */

function Editor({
  entrada,
  sugerencias,
  alCerrar,
}: {
  entrada: EntradaPanel;
  sugerencias: string[];
  alCerrar: () => void;
}) {
  const [guardado, guardar, guardando] = useActionState<Resultado | null, FormData>(
    guardarEntrada,
    null,
  );
  const [borradoFoto, quitarFoto] = useActionState<Resultado | null, FormData>(
    borrarFoto,
    null,
  );
  const [borrado, quitarEntrada, borrandoEntrada] = useActionState<Resultado | null, FormData>(
    borrarEntrada,
    null,
  );

  // Cerrar con Escape y bloquear el scroll del fondo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    window.addEventListener("keydown", onKey);
    document.body.dataset.menuOpen = "true";
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.body.dataset.menuOpen;
    };
  }, [alCerrar]);

  return (
    <div
      className="fixed inset-0 z-70 flex items-end justify-center bg-tinta/60 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${entrada.titulo}`}
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-panel sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-linea bg-panel px-5 py-3">
          <p className="title truncate text-xl text-tinta">Editar</p>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="grid grid-cols-1 h-10 w-10 shrink-0 place-items-center rounded-full border border-linea text-tinta"
          >
            <IconoCerrar size={18} />
          </button>
        </div>

        <div className="p-5">
          <form action={guardar} className="grid grid-cols-1 gap-3">
            <input type="hidden" name="id" value={entrada.id} />

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                Título
              </span>
              <input
                name="titulo"
                defaultValue={entrada.titulo}
                required
                className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-tinta focus:border-club focus:outline-none"
              />
            </label>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                Etiquetas
              </span>
              <div className="mt-1">
                <CampoEtiquetas
                  nombre="albumes"
                  iniciales={entrada.albumes}
                  sugerencias={sugerencias}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                  Fecha
                </span>
                <input
                  name="fecha"
                  type="date"
                  defaultValue={entrada.fecha?.slice(0, 10)}
                  className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-tinta focus:border-club focus:outline-none"
                />
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={guardando}
                className="btn btn-primary px-4 py-2 text-sm"
              >
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
              <Aviso resultado={guardado} />
            </div>
          </form>

          {entrada.fotos.length > 0 ? (
            <>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-mute">
                Fotos de esta entrada
              </p>
              <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {entrada.fotos.map((foto) => (
                  <li key={foto.url} className="relative">
                    <Image
                      src={foto.url}
                      alt=""
                      width={140}
                      height={140}
                      className="aspect-square w-full rounded-lg border border-linea object-cover"
                    />
                    <form action={quitarFoto}>
                      <input type="hidden" name="id" value={entrada.id} />
                      <input type="hidden" name="foto" value={foto.url} />
                      <button
                        type="submit"
                        aria-label="Quitar esta foto"
                        className="absolute -right-1.5 -top-1.5 grid grid-cols-1 h-6 w-6 place-items-center rounded-full bg-tinta text-white"
                      >
                        <IconoCerrar size={13} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <Aviso resultado={borradoFoto} />
            </>
          ) : null}

          <form action={quitarEntrada} className="mt-6 border-t border-linea pt-4">
            <input type="hidden" name="id" value={entrada.id} />
            <button
              type="submit"
              disabled={borrandoEntrada}
              onClick={(e) => {
                if (!confirm(`¿Eliminar «${entrada.titulo}» y todas sus fotos?`)) {
                  e.preventDefault();
                }
              }}
              className="btn border border-linea bg-panel px-4 py-2 text-sm text-club hover:border-club"
            >
              {borrandoEntrada ? "Eliminando…" : "Eliminar la entrada entera"}
            </button>
            <Aviso resultado={borrado} />
          </form>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- listado */

export default function Listado({
  entradas,
  albumes,
}: {
  entradas: EntradaPanel[];
  albumes: string[];
}) {
  const [consulta, setConsulta] = useState("");
  const [album, setAlbum] = useState("todos");
  const [editando, setEditando] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = normalizar(consulta.trim());
    return entradas.filter(
      (e) =>
        (album === "todos" || e.albumes.includes(album)) &&
        (q === "" ||
          normalizar(e.titulo).includes(q) ||
          e.albumes.some((a) => normalizar(a).includes(q))),
    );
  }, [entradas, consulta, album]);

  const abierta = entradas.find((e) => e.id === editando) ?? null;

  if (entradas.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-linea bg-panel p-4 text-sm text-mute">
        Todavía no hay nada en la galería.
      </p>
    );
  }

  return (
    <>
      <div className="relative mt-6">
        <IconoBuscar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar por título o álbum…"
          aria-label="Buscar por título o álbum"
          className="w-full rounded-full border border-linea bg-panel py-3 pl-12 pr-4 text-base text-tinta placeholder:text-mute focus:border-club focus:outline-none"
        />
      </div>

      {albumes.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {["todos", ...albumes].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAlbum(a)}
              aria-pressed={album === a}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                album === a
                  ? "bg-club text-white"
                  : "border border-linea bg-panel text-mute hover:border-club hover:text-club"
              }`}
            >
              {a === "todos" ? "Todos" : a}
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-sm text-mute">
        {visibles.length} {visibles.length === 1 ? "entrada" : "entradas"}
      </p>

      <ul className="mt-3 grid grid-cols-3 gap-3">
        {visibles.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => setEditando(e.id)}
              className="group block w-full overflow-hidden rounded-xl border border-linea bg-panel text-left transition-colors hover:border-club"
            >
              <span className="relative block aspect-square w-full bg-panel-2">
                {e.fotos[0] ? (
                  <Image
                    src={e.fotos[0].url}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 220px, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid grid-cols-1 h-full w-full place-items-center text-xs text-mute">
                    sin foto
                  </span>
                )}

                {e.fotos.length > 1 ? (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-tinta/80 px-2 py-0.5 text-[11px] font-bold text-white">
                    {e.fotos.length}
                  </span>
                ) : null}
              </span>

              <span className="block p-2.5">
                <span className="line-clamp-2 text-xs font-semibold leading-snug text-tinta">
                  {e.titulo}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-mute">
                  {e.albumes.join(" · ")}
                  {e.fecha ? ` · ${fechaCorta(e.fecha)}` : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {visibles.length === 0 ? (
        <p className="mt-8 text-center text-sm text-mute">
          Nada coincide con la búsqueda.
        </p>
      ) : null}

      {abierta ? (
        <Editor entrada={abierta} sugerencias={albumes} alCerrar={() => setEditando(null)} />
      ) : null}
    </>
  );
}
