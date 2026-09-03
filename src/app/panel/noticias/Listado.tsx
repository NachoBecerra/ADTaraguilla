"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { guardarNoticia, borrarNoticia, type Resultado } from "./acciones";
import type { NoticiaPanel } from "@/lib/panel/noticias";
import CampoEtiquetas from "@/components/CampoEtiquetas";
import SelectorEquipos, { type OpcionEquipo } from "@/components/SelectorEquipos";
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

/**
 * Una foto ya reducida y lista para subirse.
 *
 * Lleva las medidas porque las fotos que acompañan a la noticia acaban en la
 * galería, y allí hacen falta para reservarles el hueco antes de que carguen.
 * A la portada le sobran, pero tener dos funciones casi iguales sobra más.
 */
type FotoElegida = { archivo: File; vista: string; ancho: number; alto: number };

/** Reduce una foto en el navegador, igual que en la galería. */
function reducir(archivo: File): Promise<FotoElegida> {
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
        lienzo.toBlob(
          (blob) => {
            if (!blob) return rechazar(new Error(archivo.name));
            resolver({
              archivo: new File([blob], archivo.name.replace(/\.[^.]+$/, "") + ".jpg", {
                type: "image/jpeg",
              }),
              vista: URL.createObjectURL(blob),
              ancho: lienzo.width,
              alto: lienzo.height,
            });
          },
          "image/jpeg",
          CALIDAD,
        );
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
  etiquetas: [],
  resumen: "",
  portada: "",
  autor: "AD Taraguilla",
  destacada: false,
  galeria: "",
  cuerpo: "",
};

/* ------------------------------------------------------------------ modal */

function Editor({
  noticia,
  categorias,
  sugerencias,
  albumes,
  equipos,
  alCerrar,
}: {
  noticia: NoticiaPanel;
  categorias: readonly string[];
  sugerencias: string[];
  /** Etiquetas ya usadas en la galería, para sugerirlas en las fotos. */
  albumes: string[];
  equipos: OpcionEquipo[];
  alCerrar: () => void;
}) {
  const esNueva = noticia.archivo === "";
  const [portadaNueva, setPortadaNueva] = useState<FotoElegida | null>(null);
  /* Las fotos que se añaden al final de la noticia y van también a la galería */
  const [fotos, setFotos] = useState<FotoElegida[]>([]);
  const [subiendo, setSubiendo] = useState("");
  const [guardado, guardar, guardando] = useActionState<Resultado | null, FormData>(
    async (previo, datos) => {
      // La portada sube directa al almacenamiento; aquí solo viaja su URL
      if (portadaNueva) {
        try {
          const blob = await upload(
            `noticias/${portadaNueva.archivo.name}`,
            portadaNueva.archivo,
            { access: "public", handleUploadUrl: "/api/subir" },
          );
          // La que había deja de usarse: se apunta para borrarla del
          // almacenamiento y que no quede ocupando sitio para siempre
          const anterior = String(datos.get("portada") ?? "");
          if (anterior.startsWith("http")) datos.set("portadaAnterior", anterior);
          datos.set("portada", blob.url);
        } catch (e) {
          return { ok: false, mensaje: `No se ha podido subir la portada: ${(e as Error).message}` };
        }
      }

      /*
       * Las fotos del cuerpo suben una a una y directas al almacenamiento, igual
       * que en la galería: por la acción de servidor no caben, hay un límite de
       * un megabyte por petición y estas son varias de un mega largo cada una.
       * Aquí solo viajan sus direcciones y sus medidas.
       */
      if (fotos.length > 0) {
        const subidas: { url: string; ancho: number; alto: number }[] = [];
        try {
          for (const [i, foto] of fotos.entries()) {
            setSubiendo(`Subiendo foto ${i + 1} de ${fotos.length}…`);
            const blob = await upload(`noticias/${foto.archivo.name}`, foto.archivo, {
              access: "public",
              handleUploadUrl: "/api/subir",
            });
            subidas.push({ url: blob.url, ancho: foto.ancho, alto: foto.alto });
          }
        } catch (e) {
          setSubiendo("");
          return { ok: false, mensaje: `No se han podido subir las fotos: ${(e as Error).message}` };
        }
        setSubiendo("");
        datos.set("fotos", JSON.stringify(subidas));
      }

      const guardado = await guardarNoticia(previo, datos);
      // Ya están en el servidor: dejarlas aquí las volvería a subir al guardar
      if (guardado.ok) setFotos([]);
      return guardado;
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

  const vistaPrevia = portadaNueva?.vista ?? (noticia.portada || null);

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
            className="grid grid-cols-1 h-10 w-10 shrink-0 place-items-center rounded-full border border-linea text-tinta"
          >
            <IconoCerrar size={18} />
          </button>
        </div>

        <form action={guardar} className="grid grid-cols-1 gap-4 p-5">
          <input type="hidden" name="archivo" value={noticia.archivo} />
          <input type="hidden" name="portada" value={noticia.portada} />
          <input type="hidden" name="galeria" value={noticia.galeria} />

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-mute">
              Etiquetas
            </span>
            <div className="mt-1">
              <CampoEtiquetas
                nombre="etiquetas"
                iniciales={noticia.etiquetas}
                sugerencias={sugerencias}
                ayuda="Equipo, temporada, jugador… Sirven para encontrar la noticia después."
              />
            </div>
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
                <span className="grid grid-cols-1 h-20 w-28 shrink-0 place-items-center rounded-lg border border-dashed border-linea text-mute">
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

          {/*
            Fotos del final de la noticia. Van aparte de la portada a propósito:
            la portada es la que se ve en las tarjetas y la que sale al
            compartir, y mezclarlas dejaría al azar cuál de las dos hace ese
            papel. Estas además se publican en la galería.
          */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-mute">
              Fotos del final de la noticia
            </span>
            <p className="mt-1 text-xs leading-relaxed text-mute">
              Se enseñan debajo del texto y se publican también en la galería del
              club. La portada no cambia.
            </p>

            {fotos.length > 0 ? (
              <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {fotos.map((f, i) => (
                  <li key={f.vista} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.vista}
                      alt=""
                      className="aspect-square w-full rounded-lg border border-linea object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFotos((a) => a.filter((_, n) => n !== i))}
                      aria-label={`Quitar la foto ${i + 1}`}
                      className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-club text-white"
                    >
                      <IconoCerrar size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <label className="btn btn-ghost mt-2 cursor-pointer px-4 py-2 text-sm">
              {fotos.length > 0 ? "Añadir más fotos" : "Elegir fotos"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={async (e) => {
                  const elegidas = [...(e.target.files ?? [])];
                  e.target.value = ""; // para poder volver a elegir la misma
                  const reducidas = await Promise.all(elegidas.map(reducir));
                  setFotos((a) => [...a, ...reducidas]);
                }}
              />
            </label>

            {fotos.length > 0 ? (
              <div className="mt-3 space-y-3 rounded-xl bg-panel-2 p-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                    Etiquetas de las fotos
                  </span>
                  <div className="mt-1">
                    <CampoEtiquetas
                      nombre="fotoEtiquetas"
                      sugerencias={albumes}
                      ayuda="Con las que aparecerán en la galería. Si no pones ninguna se usa la categoría de la noticia."
                    />
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                    Equipo
                  </span>
                  <div className="mt-1">
                    <SelectorEquipos nombre="fotoEquipos" equipos={equipos} />
                  </div>
                </div>
              </div>
            ) : null}
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
              {/* Con varias fotos la subida tarda: mejor decir por dónde va que
                  dejar un "Guardando…" quieto medio minuto */}
              {guardando
                ? subiendo || "Guardando…"
                : esNueva
                  ? "Publicar noticia"
                  : "Guardar cambios"}
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
  albumes,
  equipos,
}: {
  noticias: NoticiaPanel[];
  categorias: readonly string[];
  /** Etiquetas y equipos de la galería: las fotos de una noticia acaban allí. */
  albumes: string[];
  equipos: OpcionEquipo[];
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
          normalizar(n.resumen).includes(q) ||
          n.etiquetas.some((e) => normalizar(e).includes(q))),
    );
  }, [noticias, consulta, categoria]);

  const usadas = [...new Set(noticias.map((n) => n.categoria))].sort();
  const etiquetasUsadas = [...new Set(noticias.flatMap((n) => n.etiquetas))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

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
                  <span className="grid grid-cols-1 h-full w-full place-items-center text-mute">
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
          sugerencias={etiquetasUsadas}
          albumes={albumes}
          equipos={equipos}
          alCerrar={() => setEditando(null)}
        />
      ) : null}
    </>
  );
}
