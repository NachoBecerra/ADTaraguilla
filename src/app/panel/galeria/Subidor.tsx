"use client";

import { useActionState, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { subirFotos, type Resultado } from "./acciones";
import CampoEtiquetas from "@/components/CampoEtiquetas";
import { IconoImagen, IconoCerrar } from "@/components/Iconos";

/** Lado mayor al que se reducen las fotos antes de subirlas. */
const LADO_MAXIMO = 1800;
const CALIDAD = 0.82;

type Elegida = {
  nombre: string;
  archivo: File;
  vista: string;
  ancho: number;
  alto: number;
  kb: number;
};

/**
 * Reduce la foto en el propio navegador.
 *
 * Las fotos del móvil pesan varios megas y no tiene sentido guardarlas así:
 * ni la web las necesita a ese tamaño, ni hay por qué pagar por almacenarlas.
 *
 * De paso se apuntan las medidas: como la foto ya no vive en el repositorio,
 * nadie podrá leerlas del archivo al compilar, y sin ellas la galería daría
 * saltos al cargar.
 */
function reducir(original: File): Promise<Elegida> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error(original.name));
    lector.onload = () => {
      const img = new window.Image();
      img.onerror = () => rechazar(new Error(original.name));
      img.onload = () => {
        const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);

        const ctx = lienzo.getContext("2d");
        if (!ctx) return rechazar(new Error(original.name));
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

        lienzo.toBlob(
          (blob) => {
            if (!blob) return rechazar(new Error(original.name));
            const nombre = original.name.replace(/\.[^.]+$/, "") + ".jpg";
            resolver({
              nombre: original.name,
              archivo: new File([blob], nombre, { type: "image/jpeg" }),
              vista: URL.createObjectURL(blob),
              ancho: lienzo.width,
              alto: lienzo.height,
              kb: Math.round(blob.size / 1024),
            });
          },
          "image/jpeg",
          CALIDAD,
        );
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(original);
  });
}

/** Nombre con el que se guarda la foto en el almacenamiento. */
function aSlug(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "foto"
  );
}

export default function Subidor({ albumes }: { albumes: string[] }) {
  const [elegidas, setElegidas] = useState<Elegida[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const [resultado, accion, subiendo] = useActionState<Resultado | null, FormData>(
    async (previo, datos) => {
      const titulo = String(datos.get("titulo") ?? "").trim() || "foto";

      /*
       * Cada foto viaja por su cuenta y directamente al almacenamiento. Antes
       * iban todas dentro de esta misma petición codificadas en base64, y ahí
       * chocaban con el límite de 1 MB: cabían dos y la tercera fallaba.
       */
      const subidas: { url: string; ancho: number; alto: number }[] = [];
      setProgreso({ hechas: 0, total: elegidas.length });

      try {
        for (const [i, f] of elegidas.entries()) {
          const numero = String(i + 1).padStart(2, "0");
          const blob = await upload(`galeria/${aSlug(titulo)}-${numero}.jpg`, f.archivo, {
            access: "public",
            handleUploadUrl: "/api/subir",
          });
          subidas.push({ url: blob.url, ancho: f.ancho, alto: f.alto });
          setProgreso({ hechas: i + 1, total: elegidas.length });
        }
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

    const nuevas: Elegida[] = [];
    const fallos: string[] = [];
    for (const archivo of Array.from(lista)) {
      try {
        nuevas.push(await reducir(archivo));
      } catch {
        fallos.push(archivo.name);
      }
    }

    setElegidas((antes) => [...antes, ...nuevas]);
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
          <span className="text-sm font-semibold text-tinta">Etiquetas</span>
          <div className="mt-1.5">
            <CampoEtiquetas
              nombre="albumes"
              sugerencias={albumes}
              ayuda="Equipo, temporada, jugador… Las fotos aparecen bajo todas las que lleven."
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
