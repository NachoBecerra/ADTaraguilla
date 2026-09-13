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
import { IconoCandado, IconoFlecha, IconoMegafono, IconoWhatsApp } from "@/components/Iconos";

/**
 * Los partidos de los próximos días, para abrir la retransmisión de uno.
 *
 * El enlace se compone con el origen del navegador y no en el servidor: así lo
 * que se copia funciona igual probando en local que en producción.
 *
 * **Dos tareas, dos pasos, dos colores.** La tarjeta mezclaba en el mismo verde
 * y con párrafos largos lo que es para quien cuenta el partido y lo que es para
 * la afición, más tres acciones que borran cosas sueltas entre medias. El club
 * dijo que ni quien lo lleva viendo días lo tenía claro. Ahora:
 *
 * 1. **Quién lo cuenta**, en ámbar y con candado: es privado, quien tenga el
 *    enlace escribe.
 * 2. **Avisar a la afición**, en verde: lo público y la portada.
 *
 * Un solo botón grande por paso, una línea de texto como mucho, y lo que se usa
 * poco o borra algo, dentro de «Más opciones».
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
  abierta: { texto: "Preparado", clase: "bg-panel-2 text-mute" },
  "en-directo": { texto: "En directo", clase: "bg-club text-white" },
  terminada: { texto: "Terminado", clase: "bg-panel-2 text-mute" },
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
      <p className="text-xs font-semibold text-tinta">
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

/**
 * Un interruptor de verdad, en vez de una casilla con un párrafo al lado.
 *
 * Se lee como «encendido o apagado» sin leer nada, que es justo lo que es
 * anunciar un partido en la portada.
 */
function Interruptor({
  activo,
  alCambiar,
  etiqueta,
}: {
  activo: boolean;
  alCambiar: (activo: boolean) => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => alCambiar(!activo)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        activo ? "bg-club" : "bg-mute/35"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          activo ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/** El número y el título de cada paso, para que se lea como una secuencia. */
function CabeceraDePaso({
  numero,
  titulo,
  sello,
  icono,
  tonos,
}: {
  numero: number;
  titulo: string;
  sello: string;
  icono: React.ReactNode;
  tonos: { numero: string; texto: string };
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${tonos.numero}`}
      >
        {numero}
      </span>
      <h3 className={`title text-lg leading-none ${tonos.texto}`}>{titulo}</h3>
      <span
        className={`ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${tonos.texto}`}
      >
        {icono}
        {sello}
      </span>
    </div>
  );
}

const BOTON_GRANDE =
  "mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-base font-bold text-white transition-transform active:scale-[0.98]";
const BOTON_PEQUENO =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-linea bg-panel px-3.5 py-2 text-sm font-bold text-tinta transition-colors hover:border-club";

export default function Listado({ partidos }: { partidos: Fila[] }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  /* La página que ve el público, aparte de la de escribir: son dos enlaces
     distintos y confundirlos es dejar escribir a cualquiera */
  const [publicos, setPublicos] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState<string | null>(null);
  /* Lo marcado se pinta al momento, sin esperar al servidor: un interruptor
     que tarda medio segundo en moverse parece que no ha funcionado */
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
  /* Cerrar una tarjeta abierta no tiene por qué volver a pedir el enlace */
  const [plegados, setPlegados] = useState<Record<string, boolean>>({});

  async function abrir(id: string) {
    setTrabajando(id);
    setErrores((e) => ({ ...e, [id]: "" }));

    const r = await empezarRetransmision(id);
    if (r.ok && r.ruta) {
      setEnlaces((e) => ({ ...e, [id]: `${window.location.origin}${r.ruta}` }));
      setPublicos((e) => ({ ...e, [id]: `${window.location.origin}/directo/${id}` }));
      setPlegados((e) => ({ ...e, [id]: false }));
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
   * El interruptor se mueve antes de preguntar y se vuelve atrás si el servidor
   * dice que no: el caso normal es que salga bien, y esperar por si acaso hace
   * que parezca roto.
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
      {partidos.map((p) => {
        const abierta = Boolean(enlaces[p.id]) && !plegados[p.id];
        const cuando = [p.fecha ? fechaPartido(p.fecha) : "Sin fecha", p.hora ?? "sin hora"].join(" · ");

        return (
          /* El identificador va en el propio elemento: sin esto, una prueba que
             quiera un partido por jugar tiene que adivinar la fecha leyendo el
             texto de la tarjeta */
          <li key={p.id} data-partido={p.id} className="card p-4">
            {/* ------------------------------------------------ el partido */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-club-soft">
                  {p.nombreEquipo} · {cuando}
                </p>
                <p className="title mt-1 text-lg leading-tight text-tinta">
                  {p.local} <span className="text-mute">vs</span> {p.visitante}
                </p>
                {p.campo ? <p className="mt-0.5 truncate text-xs text-mute">{p.campo}</p> : null}

                <div className="mt-1.5 flex flex-wrap gap-1">
                  {CHIP[p.estado] ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CHIP[p.estado]!.clase}`}
                    >
                      {CHIP[p.estado]!.texto}
                    </span>
                  ) : null}
                  {anunciados[p.id] ? (
                    <span className="rounded-full border border-club px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-club">
                      En portada
                    </span>
                  ) : null}
                  {p.amistoso ? (
                    <span className="rounded-full border border-linea px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mute">
                      Amistoso
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  abierta
                    ? setPlegados((e) => ({ ...e, [p.id]: true }))
                    : enlaces[p.id]
                      ? setPlegados((e) => ({ ...e, [p.id]: false }))
                      : abrir(p.id)
                }
                disabled={trabajando === p.id}
                className={`btn shrink-0 px-4 py-2 text-sm ${abierta ? "btn-ghost" : "btn-primary"}`}
              >
                {trabajando === p.id && !enlaces[p.id]
                  ? "Abriendo…"
                  : abierta
                    ? "Cerrar"
                    : p.estado === "sin-abrir" && !enlaces[p.id]
                      ? "Preparar directo"
                      : "Gestionar"}
              </button>
            </div>

            {errores[p.id] ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-roja-tinta">
                {errores[p.id]}
              </p>
            ) : null}

            {abierta ? (
              <div className="mt-4 space-y-3">
                {/* ------------------------------------ 1 · quién lo cuenta */}
                <section className="rounded-xl border border-aviso-linea bg-aviso p-3.5">
                  <CabeceraDePaso
                    numero={1}
                    titulo="Quién lo cuenta"
                    sello="Privado"
                    icono={<IconoCandado size={14} />}
                    tonos={{ numero: "bg-aviso-fuerte", texto: "text-aviso-tinta" }}
                  />
                  <p className="mt-1.5 text-sm leading-snug text-aviso-tinta">
                    Solo para quien lo va a contar: con este enlace se puede escribir.
                  </p>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(mensajeDe(p, enlaces[p.id]))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${BOTON_GRANDE} bg-aviso-fuerte`}
                  >
                    <IconoWhatsApp size={20} />
                    Enviárselo por WhatsApp
                  </a>

                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => copiar(`${p.id}-escribir`, enlaces[p.id])}
                      className={BOTON_PEQUENO}
                    >
                      {copiado === `${p.id}-escribir` ? "¡Copiado!" : "Copiar enlace"}
                    </button>
                    <a
                      href={enlaces[p.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={BOTON_PEQUENO}
                    >
                      Contarlo yo
                      <IconoFlecha size={15} />
                    </a>
                  </div>

                  <ADedo visible={aMano === `${p.id}-escribir`} valor={enlaces[p.id]} />

                  {renovado === p.id ? (
                    <p className="mt-3 rounded-lg border border-aviso-linea bg-panel p-2.5 text-sm leading-snug text-tinta">
                      <strong className="font-bold">Enlace nuevo listo.</strong> El de antes
                      ya no sirve. Manda este: el partido sigue donde iba.
                    </p>
                  ) : null}
                </section>

                {/* -------------------------------- 2 · avisar a la afición */}
                <section className="rounded-xl border border-favor-linea bg-favor p-3.5">
                  <CabeceraDePaso
                    numero={2}
                    titulo="Avisar a la afición"
                    sello="Público"
                    icono={<IconoMegafono size={14} />}
                    tonos={{ numero: "bg-club", texto: "text-favor-tinta" }}
                  />

                  {/*
                    Anunciarlo es una decisión aparte y a mano, nunca automática:
                    el enlace se prepara siempre, pero solo habrá directo si
                    alguien puede pasarse el partido en la grada apuntando. Un
                    aviso de un directo que luego no llega sienta peor que no
                    haber dicho nada.
                  */}
                  <div className="mt-3 flex items-center gap-3 rounded-lg bg-panel px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-tinta">Mostrar en la portada</p>
                      <p className="text-xs leading-snug text-mute">
                        Solo si ya hay alguien para contarlo.
                      </p>
                    </div>
                    <Interruptor
                      activo={anunciados[p.id] ?? false}
                      alCambiar={(activo) => anunciar(p.id, activo)}
                      etiqueta="Mostrar en la portada que este partido se retransmite"
                    />
                  </div>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(mensajePublico(p, publicos[p.id]))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${BOTON_GRANDE} bg-club`}
                  >
                    <IconoWhatsApp size={20} />
                    Compartir por WhatsApp
                  </a>

                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => copiar(`${p.id}-publico`, publicos[p.id])}
                      className={BOTON_PEQUENO}
                    >
                      {copiado === `${p.id}-publico` ? "¡Copiado!" : "Copiar enlace"}
                    </button>
                    <a
                      href={publicos[p.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={BOTON_PEQUENO}
                    >
                      Ver la página
                      <IconoFlecha size={15} />
                    </a>
                  </div>

                  <ADedo visible={aMano === `${p.id}-publico`} valor={publicos[p.id]} />
                </section>

                {/* ------------------------------------------ más opciones
                    Lo que casi nunca hace falta y lo que borra algo, fuera de
                    la vista hasta que se busca. Cada acción peligrosa pide
                    confirmación en dos toques, igual que antes. */}
                <details className="rounded-xl border border-linea px-3.5 py-2.5">
                  <summary className="cursor-pointer text-sm font-bold text-mute">
                    Más opciones
                  </summary>

                  <div className="mt-3 space-y-3 border-t border-linea pt-3">
                    {/* Cambiar la cerradura sin tocar el partido: para cuando el
                        enlace privado se ha reenviado a quien no debía */}
                    {confirmando === `renovar-${p.id}` ? (
                      <div className="rounded-lg border border-aviso-linea bg-aviso p-3">
                        <p className="text-sm leading-snug text-aviso-tinta">
                          <strong className="font-bold">
                            Quien tenga el enlace de ahora dejará de poder escribir.
                          </strong>{" "}
                          Lo apuntado no se pierde.
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => renovar(p.id)}
                            disabled={trabajando === p.id}
                            className="btn bg-aviso-fuerte px-3.5 py-2 text-sm text-white"
                          >
                            {trabajando === p.id ? "Generando…" : "Sí, cambiar el enlace"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmando(null)}
                            className={BOTON_PEQUENO}
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
                        className="block text-left"
                      >
                        <span className="block text-sm font-bold text-tinta">
                          Cambiar el enlace privado
                        </span>
                        <span className="block text-xs text-mute">
                          Si se ha reenviado a quien no debía. Lo apuntado se queda.
                        </span>
                      </button>
                    )}

                    {/*
                      Empezar de cero. Borra la cronología del partido, y eso no se
                      guarda en ningún otro sitio.

                      Un amistoso además se puede borrar entero: como no existe en
                      la RFAF, borrarlo lo hace desaparecer sin dejar nada. Un
                      partido oficial no se borra nunca desde aquí, solo se reinicia.
                    */}
                    {confirmando === p.id ? (
                      <div className="rounded-lg border border-roja-linea bg-roja p-3">
                        <p className="text-sm font-bold text-roja-tinta">
                          Se borra todo lo apuntado. No se puede deshacer.
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => reiniciar(p.id)}
                            disabled={trabajando === p.id}
                            className="btn bg-roja-tinta px-3.5 py-2 text-sm text-white"
                          >
                            {trabajando === p.id ? "Borrando…" : "Sí, empezar de cero"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmando(null)}
                            className={BOTON_PEQUENO}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmando(p.id)}
                        className="block text-left"
                      >
                        <span className="block text-sm font-bold text-roja-tinta">
                          Reiniciar el partido
                        </span>
                        <span className="block text-xs text-mute">
                          Borra todo lo apuntado y empieza de cero.
                        </span>
                      </button>
                    )}

                    {p.amistoso ? (
                      confirmando === `borrar-${p.id}` ? (
                        <div className="rounded-lg border border-roja-linea bg-roja p-3">
                          <p className="text-sm font-bold text-roja-tinta">
                            El amistoso desaparece de la web entera. No se puede deshacer.
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => eliminar(p.id)}
                              disabled={trabajando === p.id}
                              className="btn bg-roja-tinta px-3.5 py-2 text-sm text-white"
                            >
                              {trabajando === p.id ? "Eliminando…" : "Sí, eliminarlo"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmando(null)}
                              className={BOTON_PEQUENO}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmando(`borrar-${p.id}`)}
                          className="block text-left"
                        >
                          <span className="block text-sm font-bold text-roja-tinta">
                            Eliminar el amistoso
                          </span>
                          <span className="block text-xs text-mute">
                            Desaparece de la web con todo lo apuntado.
                          </span>
                        </button>
                      )
                    ) : null}
                  </div>
                </details>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
