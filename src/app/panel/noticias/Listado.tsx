"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import { guardarNoticia, borrarNoticia, type Resultado } from "./acciones";
import type { NoticiaPanel } from "@/lib/panel/noticias";
import { IconoCerrar, IconoBuscar, IconoImagen } from "@/components/Iconos";
import { fechaCorta } from "@/lib/formato";

/** Lado mayor al que se reduce la portada antes de subirla. */
const LADO_MAXIMO = 1800;
const CALIDAD = 0.82;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Reduce la portada en el navegador, igual que en la galería. */
function reducir(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error(archivo.name));
    lector.onload = () => {
      // window.Image, no el Image de next/image que está importado arriba
      const img = new window.Image();
      img.onerror = () => rechazar(new Error(archivo.name));
      img.onload = () => {
        const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        const ctx = lienzo.getContext("2d");
        if (!ctx) return rechazar(new Error(archivo.name));
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        resolver(lienzo.toDataURL("image/jpeg", CALIDAD));
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(archivo);
  });
}

function Aviso({ resultado }: { resultado: Resultado | null }) {
  if (!resultado) return null;
  return (
    <p role="status" className="mt-3 text-sm font-semibold text-club">
      {resultado.mensaje}
    </p>
  );
}

const VACIA: NoticiaPanel = {
  archivo: "",
  titulo: "",
  slug: "",
  fecha: new Date().toISOString().slice(0, 10),
  categoria: "Club",
  resumen: "",
  portada: "",
  autor: "AD Taraguilla",
  destacada: false,
  cuerpo: "",
};

/* ------------------------------------------------------------------ modal */

function Editor({
  noticia,
  categorias,
  alCerrar,
}: {
  noticia: NoticiaPanel;
  categorias: readonly string[];
  alCerrar: () => void;
}) {
  const esNueva = noticia.archivo === "";
  const [portadaNueva, setPortadaNueva] = useState<string | null>(null);
  const [guardado, guardar, guardando] = useActionState<Resultado | null, FormData>(
    async (previo, datos) => {
      if (portadaNueva) datos.set("imagen", portadaNueva);
      return guardarNoticia(previo, datos);
    },
    null,
  );
  const [borrado, borrar, borrando] = useActionState<Resultado | null, FormData>(
    borrarNoticia,
    null,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && alCerrar();
    window.addEventListener("keydown", onKey);
    document.body.dataset.menuOpen = "true";
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.body.dataset.menuOpen;
    };
  }, [alCerrar]);

  const vistaPrevia = portadaNueva ?? (noticia.portada || null);

  return (
    <div
      className="fixed inset-0 z-70 flex items-end justify-center bg-tinta/60 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={esNueva ? "Nueva noticia" : `Editar ${noticia.titulo}`}
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-panel sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-linea bg-panel px-5 py-3">
          <p className="title truncate text-xl text-tinta">
            {esNueva ? "Nueva noticia" : "Editar noticia"}
          </p>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-linea text-tinta"
          >
            <IconoCerrar size={18} />
          </button>
        </div>

        <form action={guardar} className="grid gap-4 p-5">
          <input type="hidden" name="archivo" value={noticia.archivo} />
          <input type="hidden" name="portada" value={noticia.portada} />

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-mute">
              Título
            </span>
            <input
              name="titulo"
              defaultValue={noticia.titulo}
              required
              className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-tinta focus:border-club focus:outline-none"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                Fecha
              </span>
              <input
                name="fecha"
                type="date"
                defaultValue={noticia.fecha}
                className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-tinta focus:border-club focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                Categoría
              </span>
              <select
                name="categoria"
                defaultValue={noticia.categoria}
                className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-tinta focus:border-club focus:outline-none"
              >
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                Autor
              </span>
              <input
                name="autor"
                defaultValue={noticia.autor}
                className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-tinta focus:border-club focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-mute">
              Resumen
            </span>
            <textarea
              name="resumen"
              defaultValue={noticia.resumen}
              rows={2}
              placeholder="Dos líneas. Es lo que se ve en el listado y al compartir."
              className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-tinta focus:border-club focus:outline-none"
            />
          </label>

          {/* Portada */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-mute">
              Foto de portada
            </span>
            <div className="mt-1 flex items-center gap-3">
              {vistaPrevia ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={vistaPrevia}
                  alt=""
                  className="h-20 w-28 shrink-0 rounded-lg border border-linea object-cover"
                />
              ) : (
                <span className="grid h-20 w-28 shrink-0 place-items-center rounded-lg border border-dashed border-linea text-mute">
                  <IconoImagen size={22} />
                </span>
              )}

              <label className="btn btn-ghost cursor-pointer px-4 py-2 text-sm">
                {vistaPrevia ? "Cambiar foto" : "Elegir foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setPortadaNueva(await reducir(f));
                  }}
                />
              </label>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-mute">
              Cuerpo de la noticia
            </span>
            <textarea
              name="cuerpo"
              defaultValue={noticia.cuerpo}
              rows={12}
              required
              placeholder="Escribe aquí. Una línea en blanco separa párrafos."
              className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 font-mono text-sm text-tinta focus:border-club focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              name="destacada"
              defaultChecked={noticia.destacada}
              className="h-4 w-4 accent-club"
            />
            <span className="text-sm text-tinta">Destacar en la portada</span>
          </label>

          <div>
            <button
              type="submit"
              disabled={guardando}
              className="btn btn-primary px-5 py-2.5 text-sm"
            >
              {guardando ? "Guardando…" : esNueva ? "Publicar noticia" : "Guardar cambios"}
            </button>
            <Aviso resultado={guardado} />
          </div>
        </form>

        {!esNueva ? (
          <form action={borrar} className="border-t border-linea px-5 py-4">
            <input type="hidden" name="archivo" value={noticia.archivo} />
            <button
              type="submit"
              disabled={borrando}
              onClick={(e) => {
                if (!confirm(`¿Eliminar «${noticia.titulo}»?`)) e.preventDefault();
              }}
              className="btn border border-linea bg-panel px-4 py-2 text-sm text-club hover:border-club"
            >
              {borrando ? "Eliminando…" : "Eliminar la noticia"}
            </button>
            <Aviso resultado={borrado} />
          </form>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- listado */

export default function Listado({
  noticias,
  categorias,
}: {
  noticias: NoticiaPanel[];
  categorias: readonly string[];
}) {
  const [consulta, setConsulta] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [editando, setEditando] = useState<NoticiaPanel | null>(null);

  const visibles = useMemo(() => {
    const q = normalizar(consulta.trim());
    return noticias.filter(
      (n) =>
        (categoria === "todas" || n.categoria === categoria) &&
        (q === "" ||
          normalizar(n.titulo).includes(q) ||
          normalizar(n.categoria).includes(q) ||
          normalizar(n.resumen).includes(q)),
    );
  }, [noticias, consulta, categoria]);

  const usadas = [...new Set(noticias.map((n) => n.categoria))].sort();

  return (
    <>
      <button
        type="button"
        onClick={() => setEditando(VACIA)}
        className="btn btn-primary mt-6 w-full"
      >
        Escribir una noticia
      </button>

      <div className="relative mt-6">
        <IconoBuscar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar por título o categoría…"
          aria-label="Buscar noticia"
          className="w-full rounded-full border border-linea bg-panel py-3 pl-12 pr-4 text-base text-tinta placeholder:text-mute focus:border-club focus:outline-none"
        />
      </div>

      {usadas.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {["todas", ...usadas].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                categoria === c
                  ? "bg-club text-white"
                  : "border border-linea bg-panel text-mute hover:border-club hover:text-club"
              }`}
            >
              {c === "todas" ? "Todas" : c}
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-sm text-mute">
        {visibles.length} {visibles.length === 1 ? "noticia" : "noticias"}
      </p>

      <ul className="mt-3 grid grid-cols-3 gap-3">
        {visibles.map((n) => (
          <li key={n.archivo || n.slug}>
            <button
              type="button"
              onClick={() => setEditando(n)}
              className="block w-full overflow-hidden rounded-xl border border-linea bg-panel text-left transition-colors hover:border-club"
            >
              <span className="relative block aspect-square w-full bg-panel-2">
                {n.portada ? (
                  <Image
                    src={n.portada}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 220px, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-mute">
                    <IconoImagen size={22} />
                  </span>
                )}
                {n.destacada ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-club px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    Portada
                  </span>
                ) : null}
              </span>

              <span className="block p-2.5">
                <span className="line-clamp-2 text-xs font-semibold leading-snug text-tinta">
                  {n.titulo}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-mute">
                  {n.categoria}
                  {n.fecha ? ` · ${fechaCorta(n.fecha)}` : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {visibles.length === 0 ? (
        <p className="mt-8 text-center text-sm text-mute">
          {noticias.length === 0
            ? "Todavía no hay noticias."
            : "Nada coincide con la búsqueda."}
        </p>
      ) : null}

      {editando ? (
        <Editor
          key={editando.archivo || "nueva"}
          noticia={editando}
          categorias={categorias}
          alCerrar={() => setEditando(null)}
        />
      ) : null}
    </>
  );
}
