/**
 * Sincroniza con la RFAF todo lo que la web muestra de competición.
 *
 *   node scripts/rfaf/sincronizar.mjs             pasada incremental (diaria)
 *   node scripts/rfaf/sincronizar.mjs --forzar    revisa todos los equipos
 *   node scripts/rfaf/sincronizar.mjs --completo  recarga todas las jornadas
 *
 * La RFAF limita por volumen: pasadas ~40 peticiones seguidas devuelve páginas
 * vacías. Por eso la pasada es reanudable: cada equipo se guarda en cuanto
 * está listo y, si nos cortan, la siguiente pasada sigue por donde se quedó.
 *
 * Parte de un único dato: el código del club en src/data/equipos.json.
 * A partir de ahí descubre equipos, competiciones, grupos, calendarios,
 * resultados y clasificaciones sin que nadie tenga que pegar URLs.
 *
 * Nunca descarga ni guarda datos personales (plantillas, árbitros, junta
 * directiva): la web solo enlaza a la ficha oficial de la RFAF.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { ClienteRfaf, ErrorDeCupo, urlAbsoluta } from "./cliente.mjs";
import { aSlug, bloquesPorTemporada } from "./html.mjs";
import {
  extraerEquipos,
  extraerCompeticiones,
  extraerGrupo,
  extraerCalendario,
  extraerJornada,
  extraerClasificacion,
  nombreDesdeCategoria,
} from "./extraer.mjs";

const RAIZ = process.cwd();
const DIR_SALIDA = path.join(RAIZ, "src", "data", "rfaf");
const DIR_EQUIPOS = path.join(DIR_SALIDA, "equipos");
const CONFIG = path.join(RAIZ, "src", "data", "equipos.json");
const RUTA_ESCUDOS = path.join(DIR_SALIDA, "escudos.json");

const COMPLETO = process.argv.includes("--completo");
const FORZAR = process.argv.includes("--forzar");

/** Horas durante las que un equipo ya sincronizado se considera al día. */
const HORAS_FRESCURA = 20;

/** Días hacia atrás que se siguen revisando en busca de resultados. */
const DIAS_ATRAS = 60;
/** Días hacia delante en los que ya puede haber horario y campo asignados. */
const DIAS_ADELANTE = 14;

/**
 * En los grupos impares una jornada la descansa un equipo, y la RFAF lo
 * escribe en el calendario como si fuese el rival.
 */
export const esDescanso = (nombre) => /^\s*descansa\s*$/i.test(nombre ?? "");

const log = (...a) => console.log("·", ...a);
const aviso = (...a) => console.warn("⚠", ...a);

/* ------------------------------------------------------------------ ayudas */

async function leerJson(ruta, porDefecto = null) {
  try {
    return JSON.parse(await fs.readFile(ruta, "utf8"));
  } catch {
    return porDefecto;
  }
}

async function escribirJson(ruta, datos) {
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  await fs.writeFile(ruta, JSON.stringify(datos, null, 2) + "\n", "utf8");
}

const hoy = () => new Date().toISOString().slice(0, 10);

function diasHasta(fechaIso) {
  if (!fechaIso) return null;
  const ms = new Date(fechaIso + "T12:00:00Z") - new Date(hoy() + "T12:00:00Z");
  return Math.round(ms / 86_400_000);
}

/** Identificadores únicos aunque dos equipos compartan categoría. */
function asignarIdentificadores(equipos, nombres) {
  const usados = new Set();

  return equipos.map((equipo) => {
    const config = nombres[equipo.codigo];
    const nombre = config?.nombre ?? nombreDesdeCategoria(equipo.categoria);

    let id = aSlug(nombre);
    if (usados.has(id)) id = `${id}-${equipo.codigo}`;
    usados.add(id);

    return { ...equipo, id, nombre, orden: config?.orden ?? 99 };
  });
}

/* -------------------------------------------------- fusión calendario/jornada */

/**
 * El calendario da la lista de partidos; la jornada, los detalles.
 * Al fusionar conservamos lo que ya teníamos si la RFAF aún no lo publica.
 */
function fusionarJornada(jornada, deLaJornada, previos) {
  return jornada.partidos.map((base) => {
    const buscar = (lista) =>
      lista?.find((p) => p.local === base.local && p.visitante === base.visitante);

    const nuevo = buscar(deLaJornada);
    const viejo = buscar(previos);
    const fuente = nuevo ?? viejo ?? {};

    return {
      local: base.local,
      visitante: base.visitante,
      codLocal: fuente.codLocal ?? null,
      codVisitante: fuente.codVisitante ?? null,
      fecha: fuente.fecha ?? jornada.fecha ?? null,
      hora: fuente.hora ?? null,
      golesLocal: fuente.golesLocal ?? null,
      golesVisitante: fuente.golesVisitante ?? null,
      localidad: fuente.localidad ?? null,
      campo: fuente.campo ?? null,
      superficie: fuente.superficie ?? null,
      urlActa: fuente.urlActa ? urlAbsoluta(fuente.urlActa) : null,
      jugado: fuente.golesLocal !== null && fuente.golesLocal !== undefined,
    };
  });
}

/**
 * ¿Merece la pena volver a pedir esta jornada?
 *
 * El calendario ya nos da fecha y emparejamientos de toda la temporada; la
 * página de jornada solo añade hora, campo y resultado. Así que solo se pide
 * cuando esos datos pueden existir o haber cambiado. En régimen normal son
 * dos o tres peticiones por competición y pasada.
 */
function hayQueRefrescar(jornada, previa) {
  if (COMPLETO) return true;

  // Jornada cerrada con todos los resultados: ya no cambia.
  if (previa && previa.partidos.every((p) => p.jugado)) return false;

  // Sin fecha en el calendario (pasa en las eliminatorias de copa) la única
  // forma de saber si ya se ha jugado es preguntar por la jornada.
  const dias = diasHasta(jornada.fecha ?? previa?.fecha);
  if (dias === null) return true;

  // Ya jugada pero sin resultados guardados: hay que traerlos.
  // Más allá de DIAS_ATRAS se da por perdida (aplazamientos sin fecha nueva):
  // se recupera con --completo.
  if (dias < 0) return dias >= -DIAS_ATRAS;

  // Las próximas dos semanas: es cuando se asignan horarios y campos.
  return dias <= DIAS_ADELANTE;
}

/* ------------------------------------------------------------------ proceso */

async function sincronizarCompeticion(cliente, competicion, previa, escudos) {
  // Los enlaces de la página de grupo no cambian en toda la temporada, así que
  // se reutilizan: es una petición menos por competición y por pasada, que con
  // el cupo que tiene la RFAF se nota.
  let grupo;
  if (!COMPLETO && previa?.urlCalendario && previa?.codCompeticion) {
    grupo = {
      urlCalendario: previa.urlCalendario,
      urlClasificacion: previa.urlClasificacion,
      codCompeticion: previa.codCompeticion,
      codTemporada: previa.codTemporada ?? null,
    };
  } else {
    grupo = extraerGrupo(
      await cliente.pedir(
        `/pnfg/NPcd/NFG_VisGrupos_Vis?cod_primaria=1000123&codgrupo=${competicion.codGrupo}`,
      ),
    );
  }

  if (!grupo.urlCalendario) {
    aviso(`  ${competicion.nombre}: todavía sin calendario publicado`);
    return {
      ...competicion,
      ...grupo,
      estado: "sin-calendario",
      jornadas: previa?.jornadas ?? [],
      clasificacion: previa?.clasificacion ?? [],
    };
  }

  const calendario = extraerCalendario(await cliente.pedir(grupo.urlCalendario));
  log(`  ${competicion.nombre}: ${calendario.length} jornadas en el calendario`);

  const jornadas = [];
  let pedidas = 0;

  // Una sola página de jornada trae el escudo de todos los equipos del grupo.
  // Si aún no los tenemos, se fuerza esa única petición.
  let faltanEscudos = !previa?.escudosRecogidos;

  for (const jornada of calendario) {
    const previaJ = previa?.jornadas?.find((j) => j.numero === jornada.numero);

    let partidosJornada = null;
    if (hayQueRefrescar(jornada, previaJ) || faltanEscudos) {
      const url =
        `/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120` +
        `&CodCompeticion=${grupo.codCompeticion}&CodGrupo=${competicion.codGrupo}` +
        `&CodTemporada=${grupo.codTemporada}&CodJornada=${jornada.numero ?? ""}`;
      try {
        partidosJornada = extraerJornada(await cliente.pedir(url));
        pedidas++;
        for (const p of partidosJornada) {
          if (p.codLocal && p.escudoLocal) escudos.set(p.codLocal, p.escudoLocal);
          if (p.codVisitante && p.escudoVisitante) escudos.set(p.codVisitante, p.escudoVisitante);
        }
        if (partidosJornada.some((p) => p.escudoLocal)) faltanEscudos = false;
      } catch (e) {
        if (e instanceof ErrorDeCupo) throw e;
        aviso(`  jornada ${jornada.numero}: ${e.message}`);
      }
    }

    jornadas.push({
      numero: jornada.numero,
      nombre: jornada.nombre,
      fecha: jornada.fecha,
      partidos: fusionarJornada(jornada, partidosJornada, previaJ?.partidos),
    });
  }

  log(`    ${pedidas} jornada(s) consultadas`);

  let clasificacion = previa?.clasificacion ?? [];
  if (grupo.urlClasificacion) {
    try {
      clasificacion = extraerClasificacion(await cliente.pedir(grupo.urlClasificacion));
    } catch (e) {
      if (e instanceof ErrorDeCupo) throw e;
      aviso(`  clasificación de ${competicion.nombre}: ${e.message}`);
    }
  }

  return {
    ...competicion,
    escudosRecogidos: !faltanEscudos || previa?.escudosRecogidos === true,
    codCompeticion: grupo.codCompeticion,
    codTemporada: grupo.codTemporada,
    urlCalendario: urlAbsoluta(grupo.urlCalendario),
    urlClasificacion: grupo.urlClasificacion ? urlAbsoluta(grupo.urlClasificacion) : null,
    estado: clasificacion.length > 0 || jornadas.length > 0 ? "activa" : "sin-datos",
    jornadas,
    clasificacion,
  };
}

async function principal() {
  const config = await leerJson(CONFIG);
  if (!config?.codigoClub) throw new Error("Falta codigoClub en src/data/equipos.json");

  const cliente = new ClienteRfaf();
  log("Abriendo sesión en rfaf.es…");
  await cliente.iniciarSesion();

  const urlClub = `/pnfg/NPcd/NFG_VerClub?cod_primaria=1000118&codigo_club=${config.codigoClub}`;
  const equipos = asignarIdentificadores(
    extraerEquipos(await cliente.pedir(urlClub)),
    config.nombres ?? {},
  ).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));

  if (equipos.length === 0) throw new Error("La ficha del club no devolvió equipos");
  log(`${equipos.length} equipos en la ficha del club`);

  // La temporada en curso es el bloque más reciente de la ficha de un equipo
  const htmlPrimero = await cliente.pedir(
    `/pnfg/NPcd/NFG_VisCompeticiones_Equipo?cod_primaria=1000123&codequipo=${equipos[0].codigo}`,
  );
  const temporada = bloquesPorTemporada(htmlPrimero)[0]?.temporada;
  if (!temporada) throw new Error("No se pudo determinar la temporada en curso");
  log(`Temporada ${temporada}`);

  // Escudos ya conocidos: nunca se pierden, solo se añaden o actualizan
  const escudos = new Map(
    Object.entries((await leerJson(RUTA_ESCUDOS, { escudos: {} })).escudos ?? {}),
  );

  let incompleto = false;

  // El orden de proceso NO es el de la web. Se atiende primero a quien tiene
  // un resultado pendiente y luego al que lleva más tiempo sin mirarse: si la
  // RFAF corta a mitad de pasada, sin esto los últimos de la lista no llegan
  // a sincronizarse nunca.
  const previos = new Map();
  for (const equipo of equipos) {
    previos.set(equipo.id, await leerJson(path.join(DIR_EQUIPOS, `${equipo.id}.json`)));
  }

  const porAtender = [...equipos].sort((a, b) => {
    const pa = previos.get(a.id);
    const pb = previos.get(b.id);
    const urgente = (p) => (p && faltaAlgunResultado(p) ? 0 : 1);
    if (urgente(pa) !== urgente(pb)) return urgente(pa) - urgente(pb);
    return (pa?.actualizado ?? "").localeCompare(pb?.actualizado ?? "");
  });

  for (const equipo of porAtender) {
    const rutaEquipo = path.join(DIR_EQUIPOS, `${equipo.id}.json`);
    const previo = previos.get(equipo.id);

    if (sePuedeSaltar(previo)) {
      log(`${equipo.nombre}: al día, se salta`);
      continue;
    }

    log(`${equipo.nombre} (${equipo.categoria})`);

    try {
      const html =
        equipo.codigo === equipos[0].codigo
          ? htmlPrimero
          : await cliente.pedir(
              `/pnfg/NPcd/NFG_VisCompeticiones_Equipo?cod_primaria=1000123&codequipo=${equipo.codigo}`,
            );

      const competiciones = extraerCompeticiones(html, temporada);
      if (competiciones.length === 0) {
        aviso(`  sin competiciones asignadas todavía en ${temporada}`);
      }

      const detalladas = [];
      for (const competicion of competiciones) {
        const previa = previo?.competiciones?.find((c) => c.codGrupo === competicion.codGrupo);
        try {
          detalladas.push(await sincronizarCompeticion(cliente, competicion, previa, escudos));
        } catch (e) {
          if (e instanceof ErrorDeCupo) throw e;
          aviso(`  ${competicion.nombre}: ${e.message} — se conservan los datos anteriores`);
          if (previa) detalladas.push(previa);
        }
      }

      await escribirJson(rutaEquipo, {
        id: equipo.id,
        nombre: equipo.nombre,
        nombreRfaf: equipo.nombreRfaf,
        categoria: equipo.categoria,
        codigo: equipo.codigo,
        orden: equipo.orden,
        enCompeticion: equipo.enCompeticion,
        temporada,
        actualizado: new Date().toISOString(),
        // Ficha del equipo, no su histórico de competiciones: es la vista que
        // enseña sus datos, la equipación y la plantilla de esta temporada.
        urlRfaf: urlAbsoluta(
          `NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=${equipo.codigo}`,
        ),
        competiciones: detalladas,
      });
    } catch (e) {
      if (!(e instanceof ErrorDeCupo)) throw e;
      // La RFAF nos ha cortado. Lo ya guardado se queda; el resto se recoge
      // en la siguiente pasada, que empezará justo por donde lo dejamos.
      aviso(`La RFAF ha cortado en ${equipo.nombre}. Se continuará en la próxima pasada.`);
      incompleto = true;
      break;
    }
  }

  await escribirJson(RUTA_ESCUDOS, {
    generado: new Date().toISOString(),
    _nota: "Escudos de los clubes, tal y como los sirve la CDN de la RFAF.",
    escudos: Object.fromEntries([...escudos].sort()),
  });

  await recomponerIndices(config, urlClub, temporada, equipos);

  if (incompleto) {
    console.warn("\n⚠ Pasada incompleta: quedan equipos por sincronizar.");
  } else {
    log("Listo: todos los equipos sincronizados.");
  }
}

/**
 * Un equipo sincronizado hace poco no se vuelve a pedir. Así, si la RFAF nos
 * corta a mitad, la siguiente pasada continúa por donde se quedó en vez de
 * gastar el cupo repitiendo lo que ya tenemos.
 *
 * Pero "sincronizado hace poco" no basta: un equipo guardado con los datos
 * vacíos (porque la pasada anterior falló al leerlos) sí hay que reintentarlo,
 * o se queda así hasta que caduque la frescura.
 */
function sePuedeSaltar(previo) {
  if (COMPLETO || FORZAR || !previo?.actualizado) return false;

  const horas = (Date.now() - new Date(previo.actualizado)) / 3_600_000;
  if (horas >= HORAS_FRESCURA) return false;

  // Una competición sin jornadas solo es aceptable si la RFAF aún no ha
  // publicado su calendario; si no, es que no logramos leerlo. Y si tiene
  // calendario pero no le hemos sacado los escudos, también queda trabajo.
  const incompleta = (previo.competiciones ?? []).some(
    (c) =>
      c.estado !== "sin-calendario" &&
      ((c.jornadas?.length ?? 0) === 0 || !c.escudosRecogidos),
  );
  if (incompleta) return false;

  // Y sobre todo: si el equipo ya ha jugado y no tenemos el resultado, hay
  // que mirar. Sin esto, las pasadas del sábado por la tarde se saltarían el
  // equipo sincronizado esa misma mañana y el resultado no aparecería hasta
  // el día siguiente, que es justo lo que la gente viene a ver.
  return !faltaAlgunResultado(previo);
}

/**
 * ¿Hay algún partido ya terminado del que no tengamos resultado?
 *
 * Se mira la hora, no solo el día: un partido de hoy a las 20:00 no aporta
 * nada si son las once de la mañana, y con una pasada cada media hora eso
 * serían veinte consultas inútiles. Se da por terminado dos horas después del
 * saque, que es cuando el árbitro puede haber cerrado el acta.
 */
const MINUTOS_DE_PARTIDO = 120;

function yaDeberiaTenerResultado(p) {
  if (p.jugado || !p.fecha) return false;

  const día = hoy();
  if (p.fecha < día) return true; // de días anteriores: siempre
  if (p.fecha > día) return false; // aún no ha llegado

  // Es hoy. Sin hora asignada no sabemos cuándo acaba: se mira igualmente.
  if (!p.hora) return true;

  const [h, m] = p.hora.split(":").map(Number);
  const fin = new Date(`${p.fecha}T${p.hora}:00`);
  if (Number.isNaN(fin.getTime()) || Number.isNaN(h) || Number.isNaN(m)) return true;

  fin.setMinutes(fin.getMinutes() + MINUTOS_DE_PARTIDO);
  return Date.now() >= fin.getTime();
}

function faltaAlgunResultado(previo) {
  return (previo.competiciones ?? []).some((c) =>
    (c.jornadas ?? []).some((j) => j.partidos.some(yaDeberiaTenerResultado)),
  );
}

/**
 * club.json se reconstruye siempre a partir de los archivos de equipo que
 * haya en disco, se haya completado la pasada o no.
 */
async function recomponerIndices(config, urlClub, temporada, equipos) {
  const resumen = [];

  for (const equipo of equipos) {
    const datos = await leerJson(path.join(DIR_EQUIPOS, `${equipo.id}.json`));
    if (!datos) continue;


    resumen.push({
      id: datos.id,
      nombre: datos.nombre,
      categoria: datos.categoria,
      codigo: datos.codigo,
      orden: datos.orden ?? equipo.orden,
      enCompeticion: datos.enCompeticion,
      actualizado: datos.actualizado,
      urlRfaf: datos.urlRfaf,
      competiciones: (datos.competiciones ?? []).map((c) => ({
        nombre: c.nombre,
        grupo: c.grupo,
        estado: c.estado,
        puntos: c.puntos,
        posicion: c.posicion,
        equiposEnGrupo: c.clasificacion?.length ?? 0,
        jornadas: c.jornadas?.length ?? 0,
      })),
    });
  }

  await escribirJson(path.join(DIR_SALIDA, "club.json"), {
    generado: new Date().toISOString(),
    temporada,
    club: { codigo: config.codigoClub, urlRfaf: urlAbsoluta(urlClub) },
    equipos: resumen.sort((a, b) => a.orden - b.orden),
  });


  log(`Índice: ${resumen.length} equipos`);
}

principal().catch((e) => {
  if (e instanceof ErrorDeCupo) {
    console.error("\n✗ La RFAF nos ha limitado el acceso y no ha levantado la mano.");
    console.error("  No se ha escrito nada nuevo; se reintenta en la próxima pasada.");
  } else {
    console.error("\n✗ La sincronización ha fallado:", e.message);
    console.error("  La web sigue mostrando los últimos datos válidos.");
  }
  process.exit(1);
});
