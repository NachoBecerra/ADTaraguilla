"use client";

import { useActionState, useRef, useState } from "react";
import { subirFotos, type Resultado } from "./acciones";
import {
  prepararTanda,
  subirAlAlmacen,
  type FotoElegida,
} from "@/lib/panel/fotos";
import CampoEtiquetas from "@/components/CampoEtiquetas";
import SelectorEquipos, { type OpcionEquipo } from "@/components/SelectorEquipos";
import { IconoImagen, IconoCerrar } from "@/components/Iconos";

export default function Subidor({
  albumes,
  equipos,
}: {
  albumes: string[];
  equipos: OpcionEquipo[];
}) {
  const [elegidas, setElegidas] = useState<FotoElegida[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const [resultado, accion, subiendo] = useActionState<Resultado | null, FormData>(
    async (previo, datos) => {
      const titulo = String(datos.get("titulo") ?? "").trim() || "foto";

      let subidas;
      try {
        subidas = await subirAlAlmacen(elegidas, "galeria", titulo, (hechas, total) =>
          setProgreso({ hechas, total }),
        );
      } catch (e) {
        setProgreso(null);
        return { ok: false, mensaje: `No se han podido subir: ${(e as Error).message}` };
      }

      setProgreso(null);
      datos.set("fotos", JSON.stringify(subidas));

      const r = await subirFotos(previo, datos);
      if (r.ok) {
        for (const f of elegidas) URL.revokeObjectURL(f.vista);
        setElegidas([]);
        if (entrada.current) entrada.current.value = "";
      }
      return r;
    },
    null,
  );

  async function alElegir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setPreparando(true);
    setAviso(null);

    const { listas, fallos } = await prepararTanda(lista);
    setElegidas((antes) => [...antes, ...listas]);
    if (fallos.length > 0) setAviso(`No se pudieron preparar: ${fallos.join(", ")}`);
    setPreparando(false);
  }

  const totalKb = elegidas.reduce((s, f) => s + f.kb, 0);
  const peso = totalKb > 1024 ? `${(totalKb / 1024).toFixed(1)} MB` : `${totalKb} KB`;

  return (
    <form action={accion} className="mt-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-tinta">Título</span>
          <input
            name="titulo"
            required
            placeholder="Amistoso Infantil B — San Roque"
            className="mt-1.5 w-full rounded-xl border border-linea bg-panel px-4 py-3 text-tinta focus:border-club focus:outline-none"
          />
        </label>

        <div className="sm:col-span-2">
          <span className="text-sm font-semibold text-tinta">Equipo</span>
          <div className="mt-1.5">
            <SelectorEquipos nombre="equipos" equipos={equipos} />
          </div>
        </div>

        <div className="sm:col-span-2">
          <span className="text-sm font-semibold text-tinta">Etiquetas</span>
          <div className="mt-1.5">
            <CampoEtiquetas
              nombre="albumes"
              sugerencias={albumes}
              ayuda="Temporada, jugador, torneo… Además del equipo de arriba."
            />
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-tinta">Fecha</span>
          <input
            name="fecha"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1.5 w-full rounded-xl border border-linea bg-panel px-4 py-3 text-tinta focus:border-club focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-6">
        <input
          ref={entrada}
          id="fotos"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => alElegir(e.target.files)}
          className="sr-only"
        />
        <label
          htmlFor="fotos"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-linea bg-panel px-6 py-10 text-center transition-colors hover:border-club"
        >
          <IconoImagen size={30} className="text-club" />
          <span className="font-bold text-tinta">Elegir fotos</span>
          <span className="text-sm text-mute">
            Puedes marcar todas las que quieras de una vez
          </span>
        </label>
      </div>

      {preparando ? <p className="mt-3 text-sm text-mute">Preparando las fotos…</p> : null}
      {aviso ? <p className="mt-3 text-sm text-club">{aviso}</p> : null}

      {elegidas.length > 0 ? (
        <>
          <p className="mt-6 text-sm font-semibold text-tinta">
            {elegidas.length} {elegidas.length === 1 ? "foto lista" : "fotos listas"}
            <span className="font-normal text-mute"> · {peso} tras reducirlas</span>
          </p>

          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {elegidas.map((f, i) => (
              <li key={`${f.nombre}-${i}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.vista}
                  alt=""
                  className="aspect-square w-full rounded-lg border border-linea object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(f.vista);
                    setElegidas((a) => a.filter((_, j) => j !== i));
                  }}
                  aria-label={`Quitar ${f.nombre}`}
                  className="absolute -right-1.5 -top-1.5 grid grid-cols-1 h-6 w-6 place-items-center rounded-full bg-tinta text-white"
                >
                  <IconoCerrar size={13} />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {progreso ? (
        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full bg-club transition-all"
              style={{ width: `${(progreso.hechas / progreso.total) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-mute">
            Subiendo {progreso.hechas} de {progreso.total}…
          </p>
        </div>
      ) : null}

      {resultado ? (
        <p
          role="status"
          className="mt-5 rounded-xl bg-panel-2 px-4 py-3 text-sm font-semibold text-tinta"
        >
          {resultado.mensaje}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={subiendo || preparando || elegidas.length === 0}
        className="btn btn-primary mt-5 w-full disabled:opacity-40"
      >
        {subiendo
          ? "Subiendo…"
          : elegidas.length === 1
            ? "Publicar 1 foto"
            : `Publicar ${elegidas.length} fotos`}
      </button>
    </form>
  );
}
