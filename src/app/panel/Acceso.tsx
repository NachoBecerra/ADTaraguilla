"use client";

import { useActionState } from "react";
import { entrar } from "./acciones";

export default function Acceso() {
  const [error, accion, enviando] = useActionState(entrar, null);

  return (
    <section className="mx-auto max-w-sm px-5 py-16">
      <p className="eyebrow">Panel del club</p>
      <h1 className="title mt-2 text-4xl text-tinta">Acceso</h1>
      <p className="mt-3 text-sm text-mute">
        Para publicar noticias y subir fotos a la galería.
      </p>

      <form action={accion} className="mt-8">
        <label htmlFor="clave" className="text-sm font-semibold text-tinta">
          Contraseña del club
        </label>
        <input
          id="clave"
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="mt-2 w-full rounded-xl border border-linea bg-panel px-4 py-3 text-base text-tinta focus:border-club focus:outline-none"
        />

        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-club">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={enviando} className="btn btn-primary mt-5 w-full">
          {enviando ? "Comprobando…" : "Entrar"}
        </button>
      </form>
    </section>
  );
}
