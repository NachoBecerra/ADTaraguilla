"use client";

import { useActionState } from "react";
import { entrar } from "./acciones";

export default function Acceso() {
  const [error, accion, enviando] = useActionState(entrar, null);

  return (
    <section className="mx-auto max-w-sm px-5 py-16">
      <p className="eyebrow">Panel del club</p>
      <h1 className="title mt-2 text-4xl text-tinta">Acceso</h1>

      {/*
        Esta pantalla la ve sobre todo quien NO tiene la contraseña: llega desde
        el engranaje de la cabecera por curiosidad. Antes solo decía «para
        publicar noticias y subir fotos», y con eso nadie se hacía una idea de
        lo que el club lleva desde aquí. Contarlo no cuesta nada —lo que protege
        el panel es la contraseña, no el secreto— y de paso explica por qué la
        web está siempre al día.
      */}
      <ul className="mt-5 space-y-3 text-sm leading-relaxed text-mute">
        <li className="border-l-2 border-club-claro pl-3">
          <strong className="font-bold text-tinta">Retransmitir un partido.</strong>{" "}
          Goles, tarjetas y comentarios según pasan, desde la banda. Quien no
          puede ir al campo lo sigue al momento.
        </li>
        <li className="border-l-2 border-club-claro pl-3">
          <strong className="font-bold text-tinta">Publicar noticias.</strong>{" "}
          Con sus fotos, que van también a la galería.
        </li>
        <li className="border-l-2 border-club-claro pl-3">
          <strong className="font-bold text-tinta">Subir fotos.</strong>{" "}
          De un partido o de una presentación, agrupadas y asignadas a su
          equipo.
        </li>
      </ul>

      {/*
        Lo que más se malinterpreta: mucha gente da por hecho que alguien copia
        los resultados a mano, y de ahí que pregunten por qué no está puesto ya.
      */}
      <p className="mt-4 rounded-xl bg-panel-2 p-3 text-xs leading-relaxed text-mute">
        Los resultados, las clasificaciones y el calendario{" "}
        <strong className="font-semibold text-tinta">no se tocan aquí</strong>:
        llegan solos desde la RFAF varias veces al día. Nadie los escribe a mano.
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

      {/* Para quien debería tenerla y no la tiene: sin esto, la pantalla es un
          muro sin salida */}
      <p className="mt-5 text-xs leading-relaxed text-mute">
        Contraseñas gestionadas por el club, solicitarla a la directiva.
      </p>
    </section>
  );
}
