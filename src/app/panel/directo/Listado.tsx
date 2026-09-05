"use client";

import { useState } from "react";
import {
  anunciarRetransmision,
  eliminarAmistoso,
  empezarRetransmision,
  reiniciarRetransmision,
  renovarEnlace,
} from "./acciones";
import type { EstadoPanel } from "@/lib/directo/panel";
import { fechaPartido } from "@/lib/formato";
import { IconoFlecha } from "@/components/Iconos";

/**
 * Los partidos de los próximos días, para abrir la retransmisión de uno.
 *
 * El enlace se compone con el origen del navegador y no en el servidor: así lo
 * que se copia funciona igual probando en local que en producción.
 */

export type Fila = {
  id: string;
  nombreEquipo: string;
  local: string;
  visitante: string;
  fecha: string | null;
  hora: string | null;
  campo: string | null;
  estado: EstadoPanel;
  /** El club ya ha dicho en la portada que este partido se retransmitirá. */
  anunciado: boolean;
  /** Creado a mano por el club: no existe en la RFAF y se puede borrar entero. */
  amistoso: boolean;
};

/** Cómo se ve de un vistazo en qué punto está cada partido. */
const CHIP: Record<EstadoPanel, { texto: string; clase: string } | null> = {
  "sin-abrir": null,
  abierta: { texto: "Preparada", clase: "bg-panel-2 text-mute" },
  "en-directo": { texto: "En directo", clase: "bg-club text-white" },
  terminada: { texto: "Terminada", clase: "bg-panel-2 text-mute" },
  // No se llega a pintar: el panel no las lista
  caducada: null,
};

/** Cuándo se juega, tal y como se escribe en un mensaje. */
function cuandoDe(p: Fila): string {
  return [p.fecha ? fechaPartido(p.fecha) : null, p.hora].filter(Boolean).join(", ");
}

/**
 * Lo que lee quien va a retransmitir.
 *
 * Un enlace pelado en WhatsApp no dice de qué partido es ni qué hay que hacer
 * con él, y quien lo recibe puede tener tres de partidos distintos. Así que va
 * con el equipo, el rival y cuándo se juega, y con la frase que quita el miedo:
 * no hay que instalar nada ni saber ninguna contraseña.
 */
function mensajeDe(p: Fila, url: string): string {
  const cuando = cuandoDe(p);

  return [
    `Panel de retransmisión · ${p.nombreEquipo}`,
    `${p.local} · ${p.visitante}${cuando ? ` — ${cuando}` : ""}`,
    "",
    "Abre este enlace en el móvil desde el campo para ir apuntando el partido. No hace falta instalar nada ni saber ninguna contraseña.",
    "",
    url,
  ].join("\n");
}

/**
 * Lo que se publica en Facebook, en X o en el grupo del pueblo.
 *
 * **Sin marcador y sin nada que caduque**: una publicación no se actualiza, y
 * lo que se comparte el jueves se sigue leyendo el martes siguiente. Lo que
 * cambia está en la página, que esa sí está viva.
 */
function mensajePublico(p: Fila, url: string): string {
  const cuando = cuandoDe(p);

  return [
    `${p.local} · ${p.visitante}`,
    `${p.nombreEquipo}${cuando ? ` — ${cuando}` : ""}`,
    "",
    "Lo retransmitimos en directo. Sigue el partido minuto a minuto aquí:",
    url,
  ].join("\n");
}

/**
 * La dirección a la vista, para copiarla a mano.
 *
 * Solo aparece cuando el portapapeles falla —hay navegadores que no dejan
 * copiar, o no sin HTTPS—. Tenerla siempre puesta no le dice nada a quien no es
 * informático y encima invita a tocarla.
 */
function ADedo({ visible, valor }: { visible: boolean; valor: string }) {
  if (!visible) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-club">
        Este navegador no deja copiar solo. Cópialo a mano:
      </p>
      <input
        readOnly
        value={valor}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-1 w-full rounded-lg border border-linea bg-panel px-3 py-2 text-xs text-tinta"
      />
    </div>
  );
}

export default function Listado({ partidos }: { partidos: Fila[] }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  /* La página que ve el público, aparte de la de escribir: son dos enlaces
     distintos y confundirlos es dejar escribir a cualquiera */
  const [publicos, setPublicos] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState<string | null>(null);
  /* Lo marcado se pinta al momento, sin esperar al servidor: una casilla que
     tarda medio segundo en moverse parece que no ha funcionado */
  const [anunciados, setAnunciados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(partidos.map((p) => [p.id, p.anunciado])),
  );
  /* Reiniciar borra la cronología: no puede pasar de un solo toque */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  /* La dirección solo se enseña si el portapapeles falla: si no, estorba */
  const [aMano, setAMano] = useState<string | null>(null);
  /* Que el enlace de la pantalla ya no es el de antes conviene decirlo: los dos
     se parecen y sin aviso no hay forma de saber si el botón hizo algo */
  const [renovado, setRenovado] = useState<string | null>(null);

  async function abrir(id: string) {
    setTrabajando(id);
    setErrores((e) => ({ ...e, [id]: "" }));

    const r = await empezarRetransmision(id);
    if (r.ok && r.ruta) {
      setEnlaces((e) => ({ ...e, [id]: `${window.location.origin}${r.ruta}` }));
      setPublicos((e) => ({ ...e, [id]: `${window.location.origin}/directo/${id}` }));
    } else {
      setErrores((e) => ({ ...e, [id]: r.mensaje }));
    }
    setTrabajando(null);
  }

  async function reiniciar(id: string) {
    setTrabajando(id);
    setErrores((e) => ({ ...e, [id]: "" }));

    const r = await reiniciarRetransmision(id);
    if (r.ok && r.ruta) {
      setEnlaces((e) => ({ ...e, [id]: `${window.location.origin}${r.ruta}` }));
      setPublicos((e) => ({ ...e, [id]: `${window.location.origin}/directo/${id}` }));
    } else {
      setErrores((e) => ({ ...e, [id]: r.mensaje }));
    }
    setConfirmando(null);
    setTrabajando(null);
  }

  /**
   * Cambia la cerradura del partido: los enlaces repartidos dejan de escribir.
   *
   * Para cuando el enlace se le manda al entrenador, el entrenador lo pone en
   * el grupo de padres y acaba en cuarenta móviles. No se pierde nada de lo
   * apuntado: es lo que lo diferencia de reiniciar.
   */
  async function renovar(id: string) {
    setTrabajando(id);
    setErrores((e) => ({ ...e, [id]: "" }));

    const r = await renovarEnlace(id);
    if (r.ok && r.ruta) {
      setEnlaces((e) => ({ ...e, [id]: `${window.location.origin}${r.ruta}` }));
      setRenovado(id);
      /* El de antes ya no vale, así que tampoco puede quedarse copiado a la
         vista de la pantalla anterior */
      setAMano(null);
      setCopiado(null);
    } else {
      setErrores((e) => ({ ...e, [id]: r.mensaje }));
    }

    setConfirmando(null);
    setTrabajando(null);
  }

  async function eliminar(id: string) {
    setTrabajando(id);
    setErrores((e) => ({ ...e, [id]: "" }));

    const r = await eliminarAmistoso(id);
    if (r.ok) {
      // Recargar: el partido ya no existe, no tiene sentido dejar su tarjeta
      window.location.reload();
      return;
    }

    setErrores((e) => ({ ...e, [id]: r.mensaje }));
    setConfirmando(null);
    setTrabajando(null);
  }

  /**
   * `clave` no es el partido sino el botón: hay dos enlaces por tarjeta y con
   * el id a secas los dos dirían «Copiado» a la vez, que es justo la duda que
   * no puede haber aquí.
   */
  async function copiar(clave: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      /*
       * Hay navegadores que no dejan copiar sin más (o sin HTTPS). Solo
       * entonces aparece la dirección, para poder seleccionarla a mano: tenerla
       * siempre a la vista no le dice nada a quien no es informático, y encima
       * invita a tocarla.
       */
      setAMano(clave);
    }
  }

  /**
   * Dice si el club anuncia el partido en la portada, o deja de anunciarlo.
   *
   * La casilla se mueve antes de preguntar y se vuelve atrás si el servidor
   * dice que no: el caso normal es que salga bien, y esperar por si acaso hace
   * que parezca rota.
   */
  async function anunciar(id: string, quiere: boolean) {
    setAnunciados((a) => ({ ...a, [id]: quiere }));
    setErrores((e) => ({ ...e, [id]: "" }));

    const r = await anunciarRetransmision(id, quiere);
    if (!r.ok) {
      setAnunciados((a) => ({ ...a, [id]: !quiere }));
      setErrores((e) => ({ ...e, [id]: r.mensaje }));
    }
  }

  if (partidos.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-linea bg-panel p-4 text-sm text-mute">
        No hay partidos en los próximos días. Cuando la RFAF publique el
        calendario aparecerán aquí.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {partidos.map((p) => (
        <li key={p.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-club-soft">
                {p.nombreEquipo}
              </p>
              <p className="title mt-0.5 truncate text-lg text-tinta">
                {p.local} · {p.visitante}
              </p>
              {p.amistoso ? (
                <span className="mt-1 mr-1 inline-block rounded-full border border-linea px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mute">
                  Amistoso
                </span>
              ) : null}
              {CHIP[p.estado] ? (
                <span
                  className={`mt-1 mr-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CHIP[p.estado]!.clase}`}
                >
                  {CHIP[p.estado]!.texto}
                </span>
              ) : null}
              {/* Se ve sin abrir la tarjeta: lo que hay anunciado en la portada
                  es lo que el club ha prometido, y conviene tenerlo a la vista */}
              {anunciados[p.id] ? (
                <span className="mt-1 inline-block rounded-full border border-club px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-club">
                  Anunciado
                </span>
              ) : null}
              <p className="mt-1 text-xs text-mute">
                {p.fecha ? fechaPartido(p.fecha) : "Sin fecha"}
                {p.hora ? ` · ${p.hora}` : " · sin hora"}
                {p.campo ? ` · ${p.campo}` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={() => abrir(p.id)}
              disabled={trabajando === p.id}
              className="btn btn-primary shrink-0 px-4 py-2 text-sm"
            >
              {trabajando === p.id
                ? "Abriendo…"
                : p.estado !== "sin-abrir" || enlaces[p.id]
                  ? "Ver enlace"
                  : "Retransmitir"}
            </button>
          </div>

          {errores[p.id] ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-club">
              {errores[p.id]}
            </p>
          ) : null}

          {enlaces[p.id] ? (
            <div className="mt-3 rounded-xl bg-panel-2 p-3">
              {/* ------------------------------- el enlace de quien apunta */}
              <p className="text-[11px] font-bold uppercase tracking-wide text-club-soft">
                Para quien va al campo
              </p>
              <p className="mt-1 text-xs leading-relaxed text-mute">
                Manda este enlace a quien vaya al campo. Funciona desde ya, vale
                solo para este partido y deja de servir unas horas después de
                acabar.{" "}
                {/* Se avisa aquí mismo: los dos enlaces se parecen mucho y
                    publicar el que no es deja escribir a cualquiera */}
                <strong className="font-bold text-tinta">
                  No lo publiques en Facebook ni en grupos
                </strong>
                : quien lo abra puede escribir en la retransmisión.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copiar(`${p.id}-escribir`, enlaces[p.id])}
                  className="btn btn-primary px-4 py-2 text-sm"
                >
                  {copiado === `${p.id}-escribir` ? "Copiado" : "Copiar enlace"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(mensajeDe(p, enlaces[p.id]))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary px-4 py-2 text-sm"
                >
                  Enviar por WhatsApp
                </a>
                <a
                  href={enlaces[p.id]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm"
                >
                  Iniciar retransmisión
                  <IconoFlecha size={15} />
                </a>
              </div>

              <ADedo visible={aMano === `${p.id}-escribir`} valor={enlaces[p.id]} />

              {renovado === p.id ? (
                <p className="mt-3 rounded-lg border border-club bg-panel p-2.5 text-xs leading-relaxed text-tinta">
                  <strong className="font-bold text-club">Enlace nuevo.</strong> El
                  de antes ha dejado de valer al momento. Manda este a quien tenga
                  que seguir apuntando: el partido continúa donde iba.
                </p>
              ) : null}

              {/*
                Cambiar la cerradura sin tocar el partido. El caso es siempre el
                mismo: el enlace se reenvía, acaba en un grupo de cuarenta
                personas y empieza a aparecer lo que no debe. Va aquí, con el
                enlace que deja de valer, y no abajo con lo destructivo: esto no
                borra nada.
              */}
              {confirmando === `renovar-${p.id}` ? (
                <div className="mt-3 rounded-lg border border-club bg-panel p-3">
                  <p className="text-xs leading-relaxed text-tinta">
                    <strong className="font-bold text-club">
                      Quien tenga el enlace de ahora dejará de poder escribir
                    </strong>
                    , incluida la persona que esté apuntando el partido en este
                    momento. Lo apuntado no se toca: sigue todo, y quien reciba el
                    enlace nuevo continúa desde donde iba.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => renovar(p.id)}
                      disabled={trabajando === p.id}
                      className="btn btn-primary px-3 py-1.5 text-xs"
                    >
                      {trabajando === p.id ? "Generando…" : "Sí, generar uno nuevo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="btn btn-ghost px-3 py-1.5 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRenovado(null);
                    setConfirmando(`renovar-${p.id}`);
                  }}
                  className="mt-3 text-xs font-bold text-mute underline transition-colors hover:text-club"
                >
                  Generar un enlace nuevo
                </button>
              )}

              {/* ------------------------ el enlace que sí se puede publicar */}
              <div className="mt-4 border-t border-linea pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-club-soft">
                  Para compartir con la gente
                </p>
                <p className="mt-1 text-xs leading-relaxed text-mute">
                  Esta es la página que ve el público, y se puede publicar días
                  antes: hasta que empiece enseña los equipos y la hora, y se va
                  llenando sola en cuanto se apunte lo primero. Desde aquí nadie
                  puede escribir nada.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copiar(`${p.id}-publico`, publicos[p.id])}
                    className="btn btn-primary px-4 py-2 text-sm"
                  >
                    {copiado === `${p.id}-publico` ? "Copiado" : "Copiar enlace público"}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(mensajePublico(p, publicos[p.id]))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary px-4 py-2 text-sm"
                  >
                    {/* No se llama igual que el de arriba a proposito: dos
                        botones con el mismo nombre en la misma tarjeta son dos
                        oportunidades de mandar el enlace que no era */}
                    Compartir por WhatsApp
                  </a>
                  <a
                    href={publicos[p.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm"
                  >
                    Ver la página
                    <IconoFlecha size={15} />
                  </a>
                </div>

                <ADedo visible={aMano === `${p.id}-publico`} valor={publicos[p.id]} />

                {/*
                  Anunciarlo es una decisión aparte y a mano, nunca automática:
                  el enlace se prepara siempre, pero solo habrá directo si
                  alguien puede pasarse el partido en la grada apuntando. Un
                  aviso de un directo que luego no llega sienta peor que no
                  haber dicho nada.
                */}
                <label className="mt-4 flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={anunciados[p.id] ?? false}
                    onChange={(e) => anunciar(p.id, e.currentTarget.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--club)]"
                  />
                  <span className="text-xs leading-relaxed text-mute">
                    <strong className="font-bold text-tinta">
                      Anunciar en la portada que este partido se retransmite.
                    </strong>{" "}
                    Márcalo solo si ya sabes que habrá alguien apuntando el
                    partido. Se puede quitar en cualquier momento.
                  </span>
                </label>
              </div>

              {/*
                Empezar de cero. Va aparte y en dos pasos porque borra la
                cronología del partido, y eso no se guarda en ningún otro sitio.

                Un amistoso además se puede borrar entero: como no existe en la
                RFAF, borrarlo lo hace desaparecer sin dejar nada. Un partido
                oficial no se borra nunca desde aquí, solo se reinicia.
              */}
              <div className="mt-3 border-t border-linea pt-3">
                {confirmando === p.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-club">
                      Se borra todo lo apuntado. No se puede deshacer.
                    </span>
                    <button
                      type="button"
                      onClick={() => reiniciar(p.id)}
                      disabled={trabajando === p.id}
                      className="btn btn-primary px-3 py-1.5 text-xs"
                    >
                      {trabajando === p.id ? "Borrando…" : "Sí, empezar de cero"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="btn btn-ghost px-3 py-1.5 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : confirmando === `borrar-${p.id}` ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-club">
                      El amistoso desaparece de la web entera. No se puede deshacer.
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminar(p.id)}
                      disabled={trabajando === p.id}
                      className="btn btn-primary px-3 py-1.5 text-xs"
                    >
                      {trabajando === p.id ? "Eliminando…" : "Sí, eliminarlo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="btn btn-ghost px-3 py-1.5 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={() => setConfirmando(p.id)}
                      className="text-xs font-bold text-mute underline transition-colors hover:text-club"
                    >
                      Reiniciar el partido
                    </button>
                    {p.amistoso ? (
                      <button
                        type="button"
                        onClick={() => setConfirmando(`borrar-${p.id}`)}
                        className="text-xs font-bold text-mute underline transition-colors hover:text-club"
                      >
                        Eliminar el amistoso
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
