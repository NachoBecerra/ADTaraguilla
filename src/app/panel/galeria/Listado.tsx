"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import {
  guardarEntrada,
  borrarFoto,
  borrarEntrada,
  type Resultado,
} from "./acciones";
import { IconoCerrar, IconoFlecha } from "@/components/Iconos";
import { fechaLarga } from "@/lib/formato";

export type EntradaPanel = {
  id: string;
  tipo: "foto" | "video";
  titulo: string;
  album: string;
  fecha: string;
  fotos: string[];
};

/** Aviso corto tras guardar o borrar. */
function Aviso({ resultado }: { resultado: Resultado | null }) {
  if (!resultado) return null;
  return (
    <p role="status" className="mt-3 text-sm font-semibold text-club">
      {resultado.mensaje}
    </p>
  );
}

function Entrada({ entrada }: { entrada: EntradaPanel }) {
  const [abierta, setAbierta] = useState(false);
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

  return (
    <li className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        {entrada.fotos[0] ? (
          <Image
            src={entrada.fotos[0]}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-panel-2 text-xs text-mute">
            vídeo
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-tinta">{entrada.titulo}</span>
          <span className="block truncate text-xs text-mute">
            {entrada.album}
            {entrada.fecha ? ` · ${fechaLarga(entrada.fecha)}` : ""}
            {entrada.fotos.length > 1 ? ` · ${entrada.fotos.length} fotos` : ""}
          </span>
        </span>

        <IconoFlecha
          size={18}
          className={`shrink-0 text-mute transition-transform ${abierta ? "rotate-90" : ""}`}
        />
      </button>

      {abierta ? (
        <div className="border-t border-linea p-4">
          <form action={guardar} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={entrada.id} />

            <label className="block sm:col-span-3">
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

            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                Álbum
              </span>
              <input
                name="album"
                defaultValue={entrada.album}
                list="albumes-publicados"
                className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-tinta focus:border-club focus:outline-none"
              />
            </label>

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

            <div className="sm:col-span-3">
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
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-mute">
                Fotos de esta entrada
              </p>
              <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {entrada.fotos.map((foto) => (
                  <li key={foto} className="relative">
                    <Image
                      src={foto}
                      alt=""
                      width={140}
                      height={140}
                      className="aspect-square w-full rounded-lg border border-linea object-cover"
                    />
                    <form action={quitarFoto}>
                      <input type="hidden" name="id" value={entrada.id} />
                      <input type="hidden" name="foto" value={foto} />
                      <button
                        type="submit"
                        aria-label="Quitar esta foto"
                        className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-tinta text-white"
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

          <form action={quitarEntrada} className="mt-5 border-t border-linea pt-4">
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
      ) : null}
    </li>
  );
}

export default function Listado({
  entradas,
  albumes,
}: {
  entradas: EntradaPanel[];
  albumes: string[];
}) {
  if (entradas.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-linea bg-panel p-4 text-sm text-mute">
        Todavía no hay nada en la galería.
      </p>
    );
  }

  return (
    <>
      {/* Lista propia para no depender del formulario de subida */}
      <datalist id="albumes-publicados">
        {albumes.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      <ul className="mt-6 space-y-3">
        {entradas.map((e) => (
          <Entrada key={e.id} entrada={e} />
        ))}
      </ul>
    </>
  );
}
