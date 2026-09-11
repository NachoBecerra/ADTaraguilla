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
  ORIGEN_TABLA,
  clavePartido,
  partidosCongelados,
  resultadoCreible,
  resultadoPorClasificacion,
} from "./reglas.mjs";
import {
  extraerEquipos,
  extraerCompeticiones,
  extraerGrupo,
  extraerCalendario,
  extraerJornada,
  extraerClasificacion,
  extraerHistorico,
  extraerCoordenadas,
  nombreDesdeCategoria,
} from "./extraer.mjs";

const RAIZ = process.cwd();
const DIR_SALIDA = path.join(RAIZ, "src", "data", "rfaf");
const DIR_EQUIPOS = path.join(DIR_SALIDA, "equipos");
const CONFIG = path.join(RAIZ, "src", "data", "equipos.json");
const RUTA_ESCUDOS = path.join(DIR_SALIDA, "escudos.json");
const RUTA_FORMAS = path.join(DIR_SALIDA, "formas.json");
const RUTA_CAMPOS = path.join(DIR_SALIDA, "campos.json");
const DIR_HISTORICO = path.join(DIR_SALIDA, "historico");

/**
 * Peticiones que cada pasada dedica a rellenar el histórico, además de su
 * trabajo normal. Se hace a fuego lento a propósito: son ~140 peticiones de
 * una sola vez y la RFAF corta a las 40, así que se reparten entre pasadas y
 * en un día está completo. Cuando no queda nada pendiente, no gasta nada.
 */
const PRESUPUESTO_HISTORICO = 12;

/**
 * Fichas de campo que se consultan por pasada.
 *
 * Un campo no se mueve: se lee una vez, se guardan sus coordenadas y no se
 * vuelve a pedir nunca. Con unas pocas por pasada, en dos días están todos
 * los de la temporada y a partir de ahí sale gratis.
 */
const PRESUPUESTO_CAMPOS = 4;

const COMPLETO = process.argv.includes("--completo");
const FORZAR = process.argv.includes("--forzar");

/** Horas durante las que un equipo ya sincronizado se considera al día. */
const HORAS_FRESCURA = 20;

/**
 * Lo mismo, pero para un equipo al que la RFAF todavía no le ha publicado
 * calendario.
 *
 * A ese no le sirve la excepción de los resultados pendientes —no tiene
 * partidos que reclamar—, así que con la frescura normal se pasaba un día
 * entero sin mirar. En pretemporada, que es justo cuando van apareciendo los
 * calendarios, eso significa enseñar un equipo vacío que en la federación ya
 * está completo. Revisarlo cuesta una petición: sale barato mirar a menudo.
 */
const HORAS_FRESCURA_SIN_CALENDARIO = 3;

/**
 * Días que se sigue mirando una jornada ya jugada.
 *
 * No es por el resultado —ese sale de la clasificación en cuanto la tabla lo
 * recoge—, sino porque la RFAF rectifica fechas y campos y publica el acta con
 * retraso. Antes se miraban sesenta días hacia atrás buscando resultados que
 * nunca iban a llegar de ahí.
 */
const DIAS_DE_RECTIFICACION = 4;
/** Días hacia delante en los que ya puede haber horario y campo asignados. */
const DIAS_ADELANTE = 14;

/**
 * Días dentro de los cuales un partido sin hora es motivo para volver a mirar.
 *
 * La RFAF asigna los horarios durante la semana del partido, casi siempre de
 * martes a jueves, y a veces por la tarde. Un partido a menos de una semana
 * sin hora significa que aún puede aparecer en cualquier momento.
 */
const DIAS_HORARIO = 7;

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
 *
 * **Los goles no salen de aquí.** El portal ofusca los marcadores a propósito
 * —dígitos señuelo escondidos con CSS, otros puestos desde JavaScript, y
 * distintos en cada petición— y lo que leíamos eran las trampas: un domingo
 * entero publicando 1-12 y 0-18 en primera andaluza. De la página de jornada se
 * cogen la hora, el campo, los códigos y el acta, que van en texto plano y sí
 * son de fiar. El resultado se deduce después, de la clasificación.
 */
function fusionarJornada(jornada, deLaJornada, previos) {
  const fusionados = jornada.partidos.map((base) => {
    const buscar = (lista) =>
      lista?.find((p) => p.local === base.local && p.visitante === base.visitante);

    const nuevo = buscar(deLaJornada);
    const viejo = buscar(previos);
    const fuente = nuevo ?? viejo ?? {};

    const fecha = fuente.fecha ?? jornada.fecha ?? null;

    /*
     * El resultado se conserva de lo que ya teníamos, **pero solo si sabemos de
     * dónde salió**. Lo que venga en el marcador de la página de jornada se
     * ignora: no es un dato, es un señuelo.
     *
     * Ese `origen` no es un adorno. Los resultados guardados antes de saber que
     * el marcador estaba trucado no lo llevan, y hay que tirarlos: si se
     * quedaran, la cuenta de goles ya contados no cuadraría con la tabla y
     * todas las deducciones siguientes de esa competición saldrían torcidas.
     * Al no llevar marca, desaparecen solos en la primera pasada.
     */
    const hayGoles =
      viejo?.origen === ORIGEN_TABLA &&
      viejo.golesLocal !== null &&
      viejo.golesLocal !== undefined &&
      resultadoCreible(fecha, viejo.hora ?? fuente.hora ?? null);

    return {
      local: base.local,
      visitante: base.visitante,
      codLocal: fuente.codLocal ?? null,
      codVisitante: fuente.codVisitante ?? null,
      fecha,
      hora: fuente.hora ?? null,
      golesLocal: hayGoles ? viejo.golesLocal : null,
      golesVisitante: hayGoles ? (viejo.golesVisitante ?? null) : null,
      origen: hayGoles ? ORIGEN_TABLA : null,
      localidad: fuente.localidad ?? null,
      campo: fuente.campo ?? null,
      superficie: fuente.superficie ?? null,
      codCampo: fuente.codCampo ?? null,
      urlActa: fuente.urlActa ? urlAbsoluta(fuente.urlActa) : null,
      jugado: hayGoles,
    };
  });

  /*
   * Un partido con resultado no se borra porque el calendario deje de traerlo.
   *
   * Pasó dos veces en tres días con la jornada 1 del senior: primero la RFAF
   * dejó de listar la jornada entera, y cuando volvió lo hizo con un solo
   * partido de los nueve. Como la lista sale del calendario, el 0-2 de Tarifa
   * —el único resultado del equipo en toda la temporada— desapareció de la web
   * las dos veces.
   *
   * La regla, entonces: el calendario manda para lo que está por jugarse, y un
   * partido ya jugado está congelado. No se mueve de jornada ni se cae del
   * calendario: si ya tiene resultado, es historia y se queda.
   */
  const congelados = partidosCongelados(previos, fusionados);

  if (congelados.length > 0) {
    aviso(
      `  ${jornada.nombre}: el calendario ya no trae ${congelados.length} partido(s) ya jugado(s);` +
        ` se conservan (${congelados.map(clavePartido).join(", ")})`,
    );
  }

  return [...fusionados, ...congelados];
}

/**
 * Con qué se reconoce una jornada de una pasada a la siguiente.
 *
 * Por número, que es lo que la RFAF respeta. Las eliminatorias de copa no lo
 * llevan, y ahí solo queda el nombre: "Cuartos", "Semifinales".
 */
const claveJornada = (j) => j.numero ?? `n:${j.nombre}`;

/** El orden en que se juegan: por número, y sin número, por fecha. */
function porJornada(a, b) {
  if (a.numero != null && b.numero != null) return a.numero - b.numero;
  return (a.fecha ?? "9999-99-99").localeCompare(b.fecha ?? "9999-99-99");
}

/** Cuántos partidos ya jugados tenemos de este equipo. */
function cuentaResultados(datos) {
  let n = 0;
  for (const c of datos?.competiciones ?? []) {
    for (const j of c.jornadas ?? []) {
      for (const p of j.partidos ?? []) {
        const nuestro = p.local === datos.nombreRfaf || p.visitante === datos.nombreRfaf;
        if (nuestro && p.jugado) n++;
      }
    }
  }
  return n;
}

/**
 * La red de seguridad: un equipo nunca debería tener menos resultados que ayer.
 *
 * Los resultados solo se suman. Si una pasada deja menos que la anterior es que
 * algo de la RFAF vino a medias y nos lo hemos creído, y eso en la web se ve
 * enseguida: la portada se queda sin "Últimos resultados". Ha pasado dos veces
 * con la jornada 1 del senior, las dos en silencio.
 *
 * Aquí solo se avisa, bien fuerte, en el resumen de la pasada. Deshacerlo a lo
 * bruto sería peor: hay bajas y retiradas de equipos en las que un partido
 * desaparece de verdad, y no se puede decidir eso contando.
 */
function avisarSiSePierdenResultados(equipo, previo, ahora) {
  if (!previo) return;

  const antes = cuentaResultados(previo);
  const despues = cuentaResultados(ahora);
  if (despues >= antes) return;

  aviso(
    `  ¡OJO! ${equipo.nombre} pasa de ${antes} a ${despues} resultado(s). Los resultados no se` +
      ` pierden solos: revisa qué ha devuelto la RFAF antes de dar por buena esta pasada.`,
  );
}

/**
 * Avisa de los escudos que todavía nadie ha medido.
 *
 * La medida dice hasta dónde llega el dibujo de cada escudo, y con ella la web
 * los pinta a un tamaño parejo dentro de su disco. La toma un script aparte
 * —`scripts/rfaf/medirEscudos.mjs`— porque hay que descodificar imágenes y
 * esta pasada corre en GitHub **sin instalar dependencias**, que es lo que la
 * hace rápida y sin sorpresas.
 *
 * Aquí solo se mira y se avisa: un rival nuevo se pintará como se pintaba
 * antes hasta que alguien pase el medidor. No es un fallo, es un pendiente.
 */
async function avisarEscudosSinMedir(escudos) {
  const formas = (await leerJson(RUTA_FORMAS, { formas: {} }))?.formas ?? {};
  const sinMedir = [...new Set(escudos.values())].filter((u) => formas[u] === undefined);
  if (sinMedir.length === 0) return;

  aviso(
    `${sinMedir.length} escudo(s) sin medir. Para que se pinten al tamaño de los demás:` +
      ` node scripts/rfaf/medirEscudos.mjs`,
  );
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

  // Sin fecha en el calendario (pasa en las eliminatorias de copa) la única
  // forma de saber cuándo se juega es preguntar por la jornada.
  const dias = diasHasta(jornada.fecha ?? previa?.fecha);
  if (dias === null) return true;

  /*
   * Ya jugada: se sigue mirando unos días. Lo que se busca aquí no es el
   * resultado —ese sale de la clasificación— sino que la RFAF rectifique la
   * fecha, el campo o publique el acta.
   */
  if (dias < 0) return dias >= -DIAS_DE_RECTIFICACION;

  // Las próximas dos semanas: es cuando se asignan horarios y campos.
  return dias <= DIAS_ADELANTE;
}

/* ------------------------------------------------------------------ proceso */

async function sincronizarCompeticion(cliente, competicion, previa, escudos, nombreRfaf) {
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
    /* Por la misma clave con la que se rescatan, y no solo por número: las
       eliminatorias de copa no lo llevan y todas se emparejaban con la primera */
    const previaJ = previa?.jornadas?.find((j) => claveJornada(j) === claveJornada(jornada));

    let partidosJornada = null;
    /*
     * Sin número no hay forma de pedir la jornada: la dirección lleva
     * CodJornada y quedaría vacío, con lo que la RFAF devuelve otra
     * cualquiera. Pasa en las eliminatorias de copa. Antes se pedían igual
     * y eran cinco peticiones por pasada tiradas, de un cupo de cuarenta.
     */
    const sePuedePedir = jornada.numero !== null && jornada.numero !== undefined;

    if (sePuedePedir && (hayQueRefrescar(jornada, previaJ) || faltanEscudos)) {
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

  /*
   * Una jornada que ya conocíamos no desaparece porque el calendario deje de
   * listarla.
   *
   * Pasó de verdad: el 9 de septiembre de 2026 el calendario de 1ª Andaluza
   * dejó de traer la jornada 1, y con ella se fue el 0-2 de Tarifa —el único
   * partido jugado del senior—. La portada se quedó sin "Últimos resultados"
   * y la ficha del equipo, sin resultados. El calendario manda para lo que
   * está por venir; para lo ya jugado, lo que tenemos vale más que un hueco.
   */
  const enCalendario = new Set(jornadas.map(claveJornada));
  const olvidadas = (previa?.jornadas ?? []).filter((j) => !enCalendario.has(claveJornada(j)));
  if (olvidadas.length > 0) {
    aviso(
      `  ${competicion.nombre}: el calendario ya no trae ${olvidadas.length} jornada(s) ` +
        `(${olvidadas.map((j) => j.nombre).join(", ")}); se conservan las que teníamos`,
    );
    jornadas.push(...olvidadas);
    jornadas.sort(porJornada);
  }

  let clasificacion = previa?.clasificacion ?? [];
  if (grupo.urlClasificacion) {
    try {
      clasificacion = extraerClasificacion(await cliente.pedir(grupo.urlClasificacion));
    } catch (e) {
      if (e instanceof ErrorDeCupo) throw e;
      aviso(`  clasificación de ${competicion.nombre}: ${e.message}`);
    }
  }

  /*
   * Y aquí sale el resultado: de la diferencia en la clasificación, no del
   * marcador. Se hace al final porque necesita las dos cosas a la vez, las
   * jornadas y la tabla.
   */
  const deducido = resultadoPorClasificacion({ nombreRfaf, clasificacion, jornadas });
  if (deducido) {
    const p = jornadas[deducido.jornada].partidos[deducido.partido];
    p.golesLocal = deducido.golesLocal;
    p.golesVisitante = deducido.golesVisitante;
    p.origen = ORIGEN_TABLA;
    p.jugado = true;
    log(
      `    resultado deducido de la clasificación: ${p.local} ${p.golesLocal}-${p.golesVisitante} ${p.visitante}`,
    );
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

  /** Competiciones que no se publican, por código de grupo. */
  const excluidas = config.competicionesExcluidas ?? {};

  /** Lo que ha cambiado en esta pasada y merece un aviso. */
  const novedades = [];

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

      // El palmarés sale de esta misma página: ni una petición extra
      await guardarPalmares(equipo, extraerHistorico(html, temporada));

      /*
       * Las competiciones apartadas a mano en src/data/equipos.json ni se
       * piden. Son las que la RFAF deja a medias —una copa de la que no
       * publica resultados ni clasificación—, y arrastrarlas costaba una
       * petición por pasada y dejaba al equipo con partidos eternamente sin
       * resultado, que es justo lo que hace que no se le pueda saltar nunca.
       */
      const competiciones = extraerCompeticiones(html, temporada).filter((c) => {
        const motivo = excluidas[c.codGrupo];
        if (motivo) log(`  ${c.nombre}: apartada a mano (${motivo})`);
        return !motivo;
      });
      if (competiciones.length === 0) {
        aviso(`  sin competiciones asignadas todavía en ${temporada}`);
      }

      const detalladas = [];
      for (const competicion of competiciones) {
        const previa = previo?.competiciones?.find((c) => c.codGrupo === competicion.codGrupo);
        try {
          detalladas.push(
            await sincronizarCompeticion(cliente, competicion, previa, escudos, equipo.nombreRfaf),
          );
        } catch (e) {
          if (e instanceof ErrorDeCupo) throw e;
          aviso(`  ${competicion.nombre}: ${e.message} — se conservan los datos anteriores`);
          if (previa) detalladas.push(previa);
        }
      }

      const datosEquipo = {
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
      };

      // Antes de guardar: qué ha cambiado respecto a lo que había
      novedades.push(...novedadesDe(equipo, previo, datosEquipo));
      avisarSiSePierdenResultados(equipo, previo, datosEquipo);
      await escribirJson(rutaEquipo, datosEquipo);
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

  await avisarEscudosSinMedir(escudos);

  await mandarAvisos(novedades);

  // Con lo que sobre del cupo, se completan campos e histórico
  if (!incompleto) await rellenarCampos(cliente, equipos);
  if (!incompleto) await rellenarHistorico(cliente, equipos, temporada, config);

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

  // Un equipo sin competición todavía se vuelve a mirar mucho antes
  const sinCalendario =
    (previo.competiciones ?? []).length === 0 ||
    (previo.competiciones ?? []).every((c) => c.estado === "sin-calendario");

  const horas = (Date.now() - new Date(previo.actualizado)) / 3_600_000;
  if (horas >= (sinCalendario ? HORAS_FRESCURA_SIN_CALENDARIO : HORAS_FRESCURA)) return false;

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
  // Falta un resultado de un partido ya jugado, o la hora de uno inminente:
  // en los dos casos el dato puede aparecer en cualquier momento
  return !faltaAlgunResultado(previo) && !faltaAlgunHorario(previo);
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

/**
 * Solo los partidos de nuestro equipo, que son los únicos que la web enseña.
 *
 * Los demás de la jornada están para los escudos y para saber quién juega con
 * quién; su resultado no se deduce ni se publica, así que esperarlo dejaría al
 * equipo pidiendo páginas para siempre.
 */
const esNuestro = (p, nombreRfaf) => p.local === nombreRfaf || p.visitante === nombreRfaf;

function faltaAlgunResultado(previo) {
  return (previo.competiciones ?? []).some((c) =>
    (c.jornadas ?? []).some((j) =>
      j.partidos.some((p) => esNuestro(p, previo.nombreRfaf) && yaDeberiaTenerResultado(p)),
    ),
  );
}

/**
 * ¿Hay algún partido a la vuelta de la esquina al que aún le falte la hora?
 *
 * Sin esto, un equipo "al día" se saltaba veinte horas seguidas, y el horario
 * que la RFAF publica un martes por la tarde no se veía hasta el día
 * siguiente. Es el mismo razonamiento que con los resultados: mientras falte
 * un dato que puede aparecer en cualquier momento, hay que seguir mirando.
 */
function faltaAlgunHorario(previo) {
  return (previo.competiciones ?? []).some((c) =>
    (c.jornadas ?? []).some((j) =>
      j.partidos.some((p) => {
        if (!esNuestro(p, previo.nombreRfaf)) return false;
        if (p.jugado || p.hora || !p.fecha) return false;
        const dias = diasHasta(p.fecha);
        return dias !== null && dias >= 0 && dias <= DIAS_HORARIO;
      }),
    ),
  );
}

/* --------------------------------------------------------------- histórico */

const rutaHistorico = (id) => path.join(DIR_HISTORICO, `${id}.json`);

/**
 * Guarda el palmarés del equipo conservando las clasificaciones ya recogidas.
 * Las temporadas pasadas no cambian, así que lo que ya está no se vuelve a
 * pedir nunca.
 */
async function guardarPalmares(equipo, temporadas) {
  if (temporadas.length === 0) return;

  const previo = await leerJson(rutaHistorico(equipo.id));
  const yaTengo = new Map();
  for (const t of previo?.temporadas ?? []) {
    for (const c of t.competiciones) {
      if (c.clasificacion?.length || c.sinClasificacion) {
        yaTengo.set(`${t.temporada}|${c.codGrupo}`, c);
      }
    }
  }

  // Lo que vino de un código anterior no está en esta página: si no se
  // conservara, cada pasada lo borraría. Se compara competición a competición
  // por si una temporada tuviera datos de los dos códigos.
  const enEstaPagina = new Set(
    temporadas.flatMap((t) => t.competiciones.map((c) => `${t.temporada}|${c.codGrupo}`)),
  );
  const heredadas = (previo?.temporadas ?? [])
    .map((t) => ({
      temporada: t.temporada,
      competiciones: t.competiciones.filter(
        (c) => !enEstaPagina.has(`${t.temporada}|${c.codGrupo}`),
      ),
    }))
    .filter((t) => t.competiciones.length > 0);

  await escribirJson(rutaHistorico(equipo.id), {
    id: equipo.id,
    nombre: equipo.nombre,
    nombreRfaf: equipo.nombreRfaf,
    codigo: equipo.codigo,
    orden: equipo.orden,
    actualizado: new Date().toISOString(),
    codigosLeidos: previo?.codigosLeidos ?? [],
    temporadas: [
      ...temporadas.map((t) => ({
        temporada: t.temporada,
        competiciones: t.competiciones.map((c) => {
          const guardada = yaTengo.get(`${t.temporada}|${c.codGrupo}`);
          return guardada ? { ...c, ...guardada } : c;
        }),
      })),
      ...heredadas,
    ]
      .reduce((acc, t) => {
        // Una misma temporada puede llegar por los dos caminos: se juntan
        const ya = acc.find((x) => x.temporada === t.temporada);
        if (ya) ya.competiciones.push(...t.competiciones);
        else acc.push({ ...t, competiciones: [...t.competiciones] });
        return acc;
      }, [])
      .sort((a, b) => b.temporada.localeCompare(a.temporada)),
  });
}

/**
 * Completa las clasificaciones finales que falten, gastando como mucho el
 * presupuesto de la pasada. Se empieza por lo más reciente, que es lo que la
 * gente mira primero.
 */
/* ------------------------------------------------------------------ avisos */

/**
 * Fecha para el aviso: "sáb 3 oct".
 *
 * El mismo formato que usa la web, para que quien reciba el aviso y luego
 * entre vea escrita la fecha igual. Sin año, que siempre es el de la temporada.
 */
function fechaCorta(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Madrid",
  })
    .format(d)
    .replace(/[.,]/g, "");
}

/** Los partidos de un equipo, aplanados y con clave para poder compararlos. */
function partidosPorClave(datos) {
  const mapa = new Map();
  for (const c of datos?.competiciones ?? []) {
    for (const j of c.jornadas ?? []) {
      for (const p of j.partidos ?? []) {
        if (!p.local || !p.visitante) continue;
        mapa.set(`${c.codGrupo}|${j.numero}|${p.local}|${p.visitante}`, p);
      }
    }
  }
  return mapa;
}

/**
 * Qué ha cambiado que merezca avisar.
 *
 * Solo dos cosas, y solo de nuestros partidos:
 *
 * - un resultado que antes no estaba;
 * - una hora ya definida: cuando se asigna por primera vez o cuando cambia,
 *   que se cuentan igual porque lo que importa es a qué hora se juega. Nunca
 *   mientras siga pendiente; avisar de "sigue sin hora" sería el ruido que
 *   hace que la gente apague los avisos.
 */
function novedadesDe(equipo, previo, nuevo) {
  const antes = partidosPorClave(previo);
  const ahora = partidosPorClave(nuevo);
  const avisos = [];

  for (const [clave, p] of ahora) {
    const nombre = nuevo.nombreRfaf;
    if (p.local !== nombre && p.visitante !== nombre) continue;

    const viejo = antes.get(clave);
    if (!viejo) continue; // partido nuevo en el calendario: no es para avisar

    const esLocal = p.local === nombre;
    const rival = esLocal ? p.visitante : p.local;
    if (esDescanso(rival)) continue;

    if (!viejo.jugado && p.jugado) {
      const propios = esLocal ? p.golesLocal : p.golesVisitante;
      const rivales = esLocal ? p.golesVisitante : p.golesLocal;
      const desenlace =
        propios > rivales ? "Victoria" : propios === rivales ? "Empate" : "Derrota";
      avisos.push({
        equipo: equipo.id,
        titulo: `${equipo.nombre}: ${propios} - ${rivales}`,
        cuerpo: `${desenlace} del ${equipo.nombre}`,
        url: `/equipos/${equipo.id}`,
      });
      continue;
    }

    if (p.jugado || !p.hora) continue;

    // Estrenar hora y cambiarla se cuentan igual: lo que importa es la que hay
    if (!viejo.hora || viejo.hora !== p.hora) {
      const cuando = fechaCorta(p.fecha);
      avisos.push({
        equipo: equipo.id,
        titulo: `${equipo.nombre}: cambio de hora`,
        // Dos líneas: cuándo primero, contra quién debajo
        cuerpo: `${cuando ? `${cuando} a las ` : ""}${p.hora}
${rival}`,
        url: `/equipos/${equipo.id}`,
      });
    }
  }

  return avisos;
}

/** Manda los avisos a la web, que es quien tiene las suscripciones. */
async function mandarAvisos(avisos) {
  if (avisos.length === 0) return;

  const secreto = process.env.AVISOS_SECRETO;
  const sitio = process.env.SITIO_URL;
  if (!secreto || !sitio) {
    aviso(`${avisos.length} aviso(s) sin mandar: falta AVISOS_SECRETO o SITIO_URL`);
    return;
  }

  try {
    const r = await fetch(`${sitio}/api/avisar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-avisos-secreto": secreto },
      body: JSON.stringify({ avisos }),
    });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) {
      aviso(`Avisos: la web respondió ${r.status}`);
      return;
    }
    log(`Avisos: ${avisos.length} novedad(es), ${cuerpo.enviados ?? 0} enviado(s)`);
  } catch (e) {
    // Que fallen los avisos no debe tumbar la sincronización
    aviso(`Avisos: no se han podido mandar (${e.message})`);
  }
}

/* ------------------------------------------------------------------ campos */

/**
 * Guarda dónde está cada campo, para poder abrirlo en el mapa.
 *
 * La ficha de campo de la RFAF trae un enlace a Google Maps con la posición
 * exacta. Solo se consultan los campos donde juega alguno de nuestros
 * equipos, y cada uno una sola vez en toda la vida del proyecto: un campo de
 * fútbol no se muda.
 */
async function rellenarCampos(cliente, equipos) {
  const guardados = (await leerJson(RUTA_CAMPOS, { campos: {} })).campos ?? {};

  // Los campos de nuestros partidos, no los de toda la competición
  const pendientes = new Map();
  for (const equipo of equipos) {
    const datos = await leerJson(path.join(DIR_EQUIPOS, `${equipo.id}.json`));
    for (const c of datos?.competiciones ?? []) {
      for (const j of c.jornadas ?? []) {
        for (const p of j.partidos ?? []) {
          if (!p.codCampo || guardados[p.codCampo]) continue;
          const nuestro = [p.local, p.visitante].some(
            (n) => n && n === datos.nombreRfaf,
          );
          if (nuestro) pendientes.set(p.codCampo, p.campo ?? null);
        }
      }
    }
  }

  if (pendientes.size === 0) return;

  let quedan = PRESUPUESTO_CAMPOS;
  let nuevos = 0;

  for (const [codigo, nombre] of pendientes) {
    if (quedan <= 0) break;
    try {
      const html = await cliente.pedir(
        `/pnfg/NPcd/NFG_VisCampos?cod_primaria=1000122&Codigo_Campo=${codigo}`,
      );
      quedan--;
      const punto = extraerCoordenadas(html);
      // Se apunta aunque no haya coordenadas: así no se vuelve a pedir cada
      // pasada un campo que sencillamente no las tiene publicadas
      guardados[codigo] = { nombre, ...(punto ?? {}) };
      if (punto) nuevos++;
    } catch (e) {
      if (e instanceof ErrorDeCupo) break;
      aviso(`  campo ${codigo}: ${e.message}`);
    }
  }

  await escribirJson(RUTA_CAMPOS, {
    generado: new Date().toISOString(),
    _nota: "Ubicación de los campos, para enlazar con el mapa.",
    campos: Object.fromEntries(
      Object.entries(guardados).sort(([a], [b]) => a.localeCompare(b)),
    ),
  });

  const restantes = pendientes.size - (PRESUPUESTO_CAMPOS - quedan);
  log(
    `Campos: ${nuevos} nuevo(s) situado(s)` +
      (restantes > 0 ? `, ${restantes} para las próximas pasadas` : ""),
  );
}

async function rellenarHistorico(cliente, equipos, temporadaActual, config) {
  let quedan = PRESUPUESTO_HISTORICO;

  for (const equipo of equipos) {
    if (quedan <= 0) break;

    const ruta = rutaHistorico(equipo.id);
    let datos = await leerJson(ruta);

    // Un equipo que hoy se saltó no tiene todavía su palmarés: se pide una vez
    if (!datos) {
      if (quedan < 3) break;
      try {
        const html = await cliente.pedir(
          `/pnfg/NPcd/NFG_VisCompeticiones_Equipo?cod_primaria=1000123&codequipo=${equipo.codigo}`,
        );
        quedan--;
        await guardarPalmares(equipo, extraerHistorico(html, temporadaActual));
        datos = await leerJson(ruta);
      } catch (e) {
        if (e instanceof ErrorDeCupo) return;
        continue;
      }
    }
    if (!datos) continue;

    // La RFAF cambia el código del equipo al cambiar de categoría, así que su
    // historial anterior cuelga de otro código. Se lee una sola vez y se
    // fusiona; después queda anotado para no volver a pedirlo.
    const anteriores = config?.codigosAnteriores?.[equipo.id] ?? [];
    const leidos = datos.codigosLeidos ?? [];
    let fusionado = false;

    for (const codigo of anteriores) {
      if (leidos.includes(codigo) || quedan < 1) continue;
      try {
        const html = await cliente.pedir(
          `/pnfg/NPcd/NFG_VisCompeticiones_Equipo?cod_primaria=1000123&codequipo=${codigo}`,
        );
        quedan--;

        const previas = extraerHistorico(html, temporadaActual);
        const yaHay = new Set(
          datos.temporadas.flatMap((t) => t.competiciones.map((c) => `${t.temporada}|${c.codGrupo}`)),
        );
        for (const t of previas) {
          const nuevas = t.competiciones.filter((c) => !yaHay.has(`${t.temporada}|${c.codGrupo}`));
          if (nuevas.length === 0) continue;
          const existente = datos.temporadas.find((x) => x.temporada === t.temporada);
          if (existente) existente.competiciones.push(...nuevas);
          else datos.temporadas.push({ temporada: t.temporada, competiciones: nuevas });
        }

        leidos.push(codigo);
        fusionado = true;
        log(`  histórico ${equipo.nombre}: código anterior ${codigo}, ${previas.length} temporadas`);
      } catch (e) {
        if (e instanceof ErrorDeCupo) return;
      }
    }

    if (fusionado) {
      datos.codigosLeidos = leidos;
      datos.temporadas.sort((a, b) => b.temporada.localeCompare(a.temporada));
      await escribirJson(ruta, datos);
    }

    let tocado = false;
    for (const t of datos.temporadas) {
      for (const c of t.competiciones) {
        if (quedan < 2) break;
        if (c.clasificacion?.length || c.sinClasificacion) continue;

        try {
          const grupo = extraerGrupo(
            await cliente.pedir(
              `/pnfg/NPcd/NFG_VisGrupos_Vis?cod_primaria=1000123&codgrupo=${c.codGrupo}`,
            ),
          );
          quedan--;

          if (!grupo.urlClasificacion) {
            // Algunas copas no tienen tabla: se marca para no volver a pedirla
            c.sinClasificacion = true;
            tocado = true;
            continue;
          }

          c.clasificacion = extraerClasificacion(await cliente.pedir(grupo.urlClasificacion));
          quedan--;
          c.urlClasificacion = urlAbsoluta(grupo.urlClasificacion);
          if (c.clasificacion.length === 0) c.sinClasificacion = true;
          tocado = true;
          log(`  histórico ${equipo.nombre} ${t.temporada}: ${c.clasificacion.length} equipos`);
        } catch (e) {
          if (e instanceof ErrorDeCupo) {
            if (tocado) await escribirJson(ruta, datos);
            return;
          }
          c.sinClasificacion = true;
          tocado = true;
        }
      }
    }

    if (tocado) await escribirJson(ruta, datos);
  }

  if (quedan < PRESUPUESTO_HISTORICO) {
    log(`Histórico: ${PRESUPUESTO_HISTORICO - quedan} peticiones usadas en esta pasada`);
  }
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
