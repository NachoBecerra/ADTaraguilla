"use server";

import { haySesion } from "@/lib/panel/sesion";
import {
  abrirRegistro,
  borrarRegistro,
  leerRegistro,
  listarRegistros,
  llaveDe,
  marcarAnuncio,
  reiniciarRegistro,
  renovarLlave,
  type FichaPartido,
} from "@/lib/directo/almacen";
import { firmarEnlace } from "@/lib/directo/enlace";
import { partidosRetransmitibles, saqueEnMs } from "@/lib/directo/partidos";
import { hayRetransmision, plegar } from "@/lib/directo/modelo";
import { minutosPorParte } from "@/lib/directo/reglamento";
import { TRAS_EL_FINAL_MS, type EstadoPanel } from "@/lib/directo/panel";
import { getEquipo, getEquipos } from "@/lib/competicion";
import { site } from "@/data/site";

export type Resultado = { ok: boolean; mensaje: string; ruta?: string };

/**
 * De qué partido estamos hablando.
 *
 * Primero el calendario de la RFAF, que es lo normal. Si no está ahí, se mira
 * si hay una retransmisión ya guardada: son los amistosos y demás partidos que
 * crea el club a mano, que no existen en la federación pero sí en el almacén.
 *
 * La hora del saque se recalcula de la ficha en vez de guardarla, para que un
 * cambio de horario de la RFAF se recoja al volver a pedir el enlace.
 */
async function fichaDe(id: string): Promise<{ ficha: FichaPartido; saqueMs: number } | null> {
  const enCalendario = partidosRetransmitibles().find((c) => c.ficha.id === id);
  if (enCalendario) return enCalendario;

  const guardado = await leerRegistro(id);
  if (!guardado) return null;

  const { ficha } = { ficha: guardado.partido };
  return { ficha, saqueMs: saqueEnMs(ficha.fecha ?? "", ficha.hora) };
}

/**
 * Abre la retransmisión de un partido y devuelve el enlace para quien va al
 * campo.
 *
 * Se guarda aquí la foto del partido —nombres, escudos, hora, campo— para que
 * a partir de este momento el directo no dependa ya de nada de la RFAF.
 *
 * Se devuelve la ruta y no la dirección completa: la compone el navegador con
 * su propio origen, así el enlace copiado sirve igual en producción que
 * probando en local.
 */
export async function empezarRetransmision(id: string): Promise<Resultado> {
  if (!(await haySesion())) {
    return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };
  }

  const candidato = await fichaDe(id);
  if (!candidato) {
    return { ok: false, mensaje: "Ese partido no existe." };
  }

  let registro;
  try {
    registro = await abrirRegistro(candidato.ficha);
  } catch {
    return { ok: false, mensaje: "No se ha podido abrir la retransmisión." };
  }

  let token: string;
  try {
    /* Con la llave que tenga ya: si el club generó un enlace nuevo, volver a
       pedirlo desde el panel tiene que dar ese y no resucitar el viejo */
    token = firmarEnlace(id, candidato.saqueMs, llaveDe(registro));
  } catch {
    return { ok: false, mensaje: "Falta CLAVE_PANEL en el servidor." };
  }

  return {
    ok: true,
    mensaje: "Retransmisión abierta.",
    ruta: `/directo/${id}/escribir?t=${encodeURIComponent(token)}`,
  };
}

/**
 * Borra lo apuntado de un partido y lo deja como recién abierto.
 *
 * Para empezar de cero una prueba, o para rescatar una retransmisión que se
 * lió de verdad. Es destructivo y no tiene vuelta atrás: la cronología no se
 * guarda en ninguna otra parte.
 *
 * Devuelve un enlace nuevo. Quien tuviera la botonera abierta con el partido
 * anterior dejará de poder escribir y se le pedirá que recargue, para que no
 * devuelva lo borrado en su siguiente envío.
 */
export async function reiniciarRetransmision(id: string): Promise<Resultado> {
  if (!(await haySesion())) {
    return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };
  }

  const candidato = await fichaDe(id);
  if (!candidato) {
    return { ok: false, mensaje: "Ese partido no existe." };
  }

  const reiniciado = await reiniciarRegistro(candidato.ficha);
  if (!reiniciado) {
    return { ok: false, mensaje: "No se ha podido reiniciar." };
  }

  let token: string;
  try {
    token = firmarEnlace(id, candidato.saqueMs, llaveDe(reiniciado));
  } catch {
    return { ok: false, mensaje: "Falta CLAVE_PANEL en el servidor." };
  }

  return {
    ok: true,
    mensaje: "Retransmisión reiniciada.",
    ruta: `/directo/${id}/escribir?t=${encodeURIComponent(token)}`,
  };
}

/**
 * Deja fuera los enlaces de escribir repartidos y devuelve uno nuevo.
 *
 * El caso real: el enlace se le manda al entrenador, el entrenador lo reenvía
 * al grupo de padres y acaba en cuarenta móviles. Empieza el partido y se
 * apunta cualquier cosa. Desde aquí se corta de golpe, y **sin perder nada**:
 * la cronología, el marcador y la cuenta de seguidores siguen como estaban, y
 * quien reciba el enlace nuevo continúa el mismo partido.
 *
 * No es reiniciar. Reiniciar borra lo apuntado; esto solo cambia la cerradura.
 *
 * El enlace del público tampoco cambia: quien esté siguiendo el partido desde
 * casa no tiene por qué enterarse de nada.
 */
export async function renovarEnlace(id: string): Promise<Resultado> {
  if (!(await haySesion())) {
    return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };
  }

  const candidato = await fichaDe(id);
  if (!candidato) {
    return { ok: false, mensaje: "Ese partido no existe." };
  }

  const llave = await renovarLlave(id);
  if (llave === null) {
    return { ok: false, mensaje: "No se ha podido generar el enlace nuevo." };
  }

  let token: string;
  try {
    token = firmarEnlace(id, candidato.saqueMs, llave);
  } catch {
    return { ok: false, mensaje: "Falta CLAVE_PANEL en el servidor." };
  }

  return {
    ok: true,
    mensaje: "Enlace nuevo generado. El anterior ya no vale.",
    ruta: `/directo/${id}/escribir?t=${encodeURIComponent(token)}`,
  };
}

/**
 * Anuncia en la web que este partido se va a retransmitir, o retira el anuncio.
 *
 * Se marca a mano y nunca solo. Abrir la retransmisión no significa que vaya a
 * haberla: el enlace se prepara siempre por si acaso, pero estar hora y media
 * en la grada apuntando goles hace falta que alguien pueda, y en muchos
 * partidos no habrá nadie. Prometer un directo que luego no llega deja peor
 * sabor que no haber dicho nada, así que esto solo se activa cuando ya se sabe
 * quién va a estar.
 *
 * Quitarlo tiene que ser igual de fácil: si la persona falla a última hora, se
 * desmarca y el aviso desaparece de la portada.
 */
export async function anunciarRetransmision(
  id: string,
  anunciado: boolean,
): Promise<Resultado> {
  if (!(await haySesion())) {
    return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };
  }

  if (!(await marcarAnuncio(id, anunciado))) {
    return {
      ok: false,
      mensaje: "No se ha podido guardar. Abre la retransmisión y vuelve a probar.",
    };
  }

  return {
    ok: true,
    mensaje: anunciado ? "Anunciado en la web." : "Anuncio retirado.",
  };
}

/* ------------------------------------------------------- partidos amistosos */

export type DatosAmistoso = {
  equipo: string;
  rival: string;
  enCasa: boolean;
  fecha: string;
  hora: string;
  campo: string;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

/**
 * Crea a mano un partido que no está en la RFAF.
 *
 * Sirve para amistosos, torneos de verano o cualquier cosa que la federación no
 * publique. Vive **solo en el almacén**, no en los datos del repositorio: por
 * eso se puede borrar después sin dejar rastro ni tocar nada de la competición.
 *
 * Y no toca nada de lo oficial: no aparecerá en resultados, ni en el
 * calendario, ni en la clasificación. Solo existe como retransmisión.
 */
export async function crearAmistoso(datos: DatosAmistoso): Promise<Resultado> {
  if (!(await haySesion())) {
    return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };
  }

  const equipo = getEquipo(datos.equipo);
  if (!equipo) return { ok: false, mensaje: "Ese equipo no es del club." };

  const rival = datos.rival.trim().slice(0, 60);
  if (!rival) return { ok: false, mensaje: "Falta el nombre del rival." };

  if (!FECHA.test(datos.fecha)) return { ok: false, mensaje: "La fecha no vale." };
  if (datos.hora && !HORA.test(datos.hora)) {
    return { ok: false, mensaje: "La hora no vale." };
  }

  const id = `${equipo.id}-${datos.fecha}`;

  /*
   * El identificador es equipo y fecha, así que un amistoso el mismo día que un
   * partido oficial del mismo equipo se llamaría igual y lo suplantaría. Se
   * corta aquí: es un choque improbable y de consecuencias feas.
   */
  if (partidosRetransmitibles().some((c) => c.ficha.id === id)) {
    return {
      ok: false,
      mensaje: "Ese equipo ya tiene un partido oficial ese día. Elige otra fecha.",
    };
  }

  const nuestro = equipo.nombreRfaf ?? site.nombre;
  const ficha: FichaPartido = {
    id,
    equipo: equipo.id,
    nombreEquipo: equipo.nombre,
    local: datos.enCasa ? nuestro : rival,
    visitante: datos.enCasa ? rival : nuestro,
    escudoLocal: datos.enCasa ? site.escudo : null,
    escudoVisitante: datos.enCasa ? null : site.escudo,
    competicion: "Amistoso",
    jornada: "",
    // La duración de las partes sale de la categoría, igual que en un oficial
    minutosPorParte: minutosPorParte(equipo.categoria),
    fecha: datos.fecha,
    hora: datos.hora || null,
    campo: datos.campo.trim().slice(0, 80) || null,
    amistoso: true,
  };

  try {
    await abrirRegistro(ficha);
  } catch {
    return { ok: false, mensaje: "No se ha podido crear el partido." };
  }

  return { ok: true, mensaje: "Amistoso creado." };
}

/**
 * Borra un amistoso y su retransmisión, sin dejar rastro.
 *
 * Solo los amistosos: un partido de la RFAF no se borra desde aquí, se
 * reinicia. Confundir las dos cosas sería poder hacer desaparecer un partido
 * oficial de la temporada por error.
 */
export async function eliminarAmistoso(id: string): Promise<Resultado> {
  if (!(await haySesion())) {
    return { ok: false, mensaje: "La sesión ha caducado. Vuelve a entrar." };
  }

  const registro = await leerRegistro(id);
  if (!registro) return { ok: false, mensaje: "Ese partido ya no existe." };
  if (!registro.partido.amistoso) {
    return { ok: false, mensaje: "Los partidos de la RFAF no se borran: se reinician." };
  }

  await borrarRegistro(id);
  return { ok: true, mensaje: "Amistoso eliminado." };
}

/**
 * Los amistosos guardados que caen en los días que enseña el panel.
 *
 * Se filtra por el nombre del archivo antes de abrir ninguno, igual que en el
 * resto del directo: el identificador acaba en la fecha del partido.
 */
export async function amistososDelPanel(): Promise<FichaPartido[]> {
  if (!(await haySesion())) return [];

  const dia = 86_400_000;
  const desde = new Date(Date.now() - dia).toISOString().slice(0, 10);
  const hasta = new Date(Date.now() + 8 * dia).toISOString().slice(0, 10);

  const ids = (await listarRegistros())
    .map((r) => r.replace(/^directo\//, "").replace(/\.json$/, ""))
    .filter((id) => {
      const fecha = id.slice(-10);
      return FECHA.test(fecha) && fecha >= desde && fecha <= hasta;
    });

  const fichas = await Promise.all(
    ids.map((id) => leerRegistro(id).then((r) => r?.partido ?? null)),
  );

  return fichas.filter((f): f is FichaPartido => f?.amistoso === true);
}

/** Los equipos del club, para elegir en el formulario del amistoso. */
export async function equiposDelClub(): Promise<{ id: string; nombre: string }[]> {
  if (!(await haySesion())) return [];
  return getEquipos().map((e) => ({ id: e.id, nombre: e.nombre }));
}

/** Cómo está cada partido en el panel: su punto y si el club lo anuncia. */
export type SituacionPanel = { estado: EstadoPanel; anunciado: boolean };

/** En qué punto está la retransmisión de cada partido. */
export async function estadoDeRetransmisiones(
  ids: string[],
): Promise<Record<string, SituacionPanel>> {
  const pares = await Promise.all(
    ids.map(async (id): Promise<[string, SituacionPanel]> => {
      const registro = await leerRegistro(id);
      if (!registro) return [id, { estado: "sin-abrir", anunciado: false }];

      const anunciado = Boolean(registro.anunciado);
      const estado = plegar(registro.eventos, registro.partido.minutosPorParte);

      /* «Abierta» es la que no tiene nada escrito. En cuanto hay algo —aunque
         sea un aviso antes del saque— la retransmisión ya se ve en la web */
      if (!hayRetransmision(estado)) return [id, { estado: "abierta", anunciado }];
      if (estado.finMs === null) return [id, { estado: "en-directo", anunciado }];

      return [
        id,
        {
          estado: Date.now() - estado.finMs > TRAS_EL_FINAL_MS ? "caducada" : "terminada",
          anunciado,
        },
      ];
    }),
  );

  return Object.fromEntries(pares);
}
