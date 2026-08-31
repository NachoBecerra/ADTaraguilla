/**
 * Extracción de datos de las páginas del portal PNFG.
 * Cada función recibe HTML y devuelve datos ya limpios.
 */

import {
  filas,
  enlaces,
  parametro,
  bloquesPorTemporada,
  fechaIso,
  hora,
  marcador,
  texto,
} from "./html.mjs";

/* ------------------------------------------------------------ ficha del club */

/**
 * Equipos del club. La RFAF marca con "*" los que no están en competición
 * (inscritos pero todavía sin calendario).
 */
export function extraerEquipos(html) {
  const equipos = [];

  for (const fila of filas(html)) {
    const codigo = parametro(fila.html, "Codigo_Equipo");
    if (!codigo || fila.celdas.length < 2) continue;

    const [nombre, categoria] = fila.celdas;
    if (!categoria || /^Categor/i.test(categoria)) continue;

    equipos.push({
      codigo,
      nombreRfaf: nombre.replace(/\s*\*\s*$/, "").trim(),
      categoria: categoria.trim(),
      // El asterisco significa "aún no está en competición"
      enCompeticion: !nombre.includes("*"),
    });
  }

  return equipos;
}

/* ------------------------------------------ competiciones de un equipo */

/**
 * Competiciones del equipo en una temporada concreta.
 * La página las agrupa por temporada, de la más reciente a la más antigua.
 */
export function extraerCompeticiones(html, temporada) {
  const bloque = bloquesPorTemporada(html).find((b) => b.temporada === temporada);
  return bloque ? extraerCompeticionesDeBloque(bloque.html) : [];
}

/** Las competiciones que hay dentro del bloque de una temporada. */
function extraerCompeticionesDeBloque(html) {
  const competiciones = [];

  for (const fila of filas(html)) {
    const urlGrupo = enlaces(fila.html, "NFG_VisGrupos_Vis")[0];
    if (!urlGrupo) continue;

    const [nombre, categoria, grupo, puntos, posicion] = fila.celdas;
    if (!nombre || /^Competic/i.test(nombre)) continue;

    competiciones.push({
      nombre: nombre.trim(),
      categoria: (categoria ?? "").trim(),
      grupo: (grupo ?? "").trim(),
      puntos: Number.isFinite(Number(puntos)) ? Number(puntos) : null,
      posicion: Number.isFinite(Number(posicion)) && Number(posicion) > 0 ? Number(posicion) : null,
      codGrupo: parametro(urlGrupo, "codgrupo"),
    });
  }

  return competiciones;
}

/**
 * Todas las temporadas del equipo salvo la indicada.
 *
 * Sale de la misma página que ya se pide en cada pasada para saber en qué
 * compite ahora, así que el palmarés no cuesta ni una petición extra.
 */
export function extraerHistorico(html, excluirTemporada) {
  return bloquesPorTemporada(html)
    .filter((b) => b.temporada !== excluirTemporada)
    .map((b) => ({
      temporada: b.temporada,
      competiciones: extraerCompeticionesDeBloque(b.html),
    }))
    .filter((t) => t.competiciones.length > 0);
}

/* --------------------------------------------------------- página de grupo */

/** Códigos y enlaces que cuelgan de la página de un grupo. */
export function extraerGrupo(html) {
  const calendario = enlaces(html, "NFG_VisCalendario_Vis")[0] ?? null;
  const clasificacion = enlaces(html, "NFG_VisClasificacion")[0] ?? null;

  return {
    urlCalendario: calendario,
    urlClasificacion: clasificacion,
    codCompeticion:
      parametro(calendario, "codcompeticion") ?? parametro(clasificacion, "codcompeticion"),
    codTemporada: parametro(calendario, "codtemporada"),
  };
}

/* -------------------------------------------------------------- calendario */

/**
 * Lista de jornadas con su fecha y sus emparejamientos.
 * El calendario completo no trae ni horas ni resultados: eso está en la
 * página de cada jornada.
 */
export function extraerCalendario(html) {
  const jornadas = [];
  let actual = null;

  for (const fila of filas(html)) {
    const unica = fila.celdas.length === 1 ? fila.celdas[0] : null;
    const cabecera = unica && /^(Jornada|Octavos|Cuartos|Semifinal|Final|Eliminatoria)/i.test(unica)
      ? unica
      : null;

    if (cabecera) {
      const numero = /Jornada\s*(\d+)/i.exec(cabecera);
      actual = {
        numero: numero ? Number(numero[1]) : null,
        nombre: cabecera.replace(/\s*[,(].*$/, "").trim(),
        fecha: fechaIso(cabecera),
        partidos: [],
      };
      jornadas.push(actual);
      continue;
    }

    if (actual && fila.celdas.length === 2) {
      const [local, visitante] = fila.celdas;
      if (local && visitante) actual.partidos.push({ local, visitante });
    }
  }

  return jornadas.filter((j) => j.partidos.length > 0);
}

/* ---------------------------------------------------------------- jornada */

/**
 * Partidos de una jornada con hora, campo, resultado y acta.
 * Cada partido ocupa dos filas: la del enfrentamiento y la del campo.
 */
export function extraerJornada(html) {
  const partidos = [];
  const todas = filas(html);

  for (let i = 0; i < todas.length; i++) {
    const { celdas, html: filaHtml } = todas[i];
    if (celdas.length !== 3) continue;

    const [local, centro, visitante] = celdas;
    const fecha = fechaIso(centro);
    if (!fecha || !local || !visitante) continue;

    // La fila siguiente lleva localidad, campo, superficie y árbitro
    const siguiente = todas[i + 1];
    const detalle = siguiente && siguiente.celdas.length === 1 ? siguiente.celdas[0] : "";

    // Esa misma fila enlaza a la ficha del campo, que es donde la RFAF guarda
    // sus coordenadas. El código no cambia nunca, así que basta con apuntarlo.
    const codCampo = siguiente
      ? (enlaces(siguiente.html, "NFG_VisCampos")
          .map((u) => parametro(u, "Codigo_Campo"))
          .find(Boolean) ?? null)
      : null;

    const goles = marcador(centro.replace(/\d{2}[-/]\d{2}[-/]\d{4}/, ""));
    // El portal escribe "CodActa" con mayúsculas: sin la /i no encajaba nunca.
    // Solo aparece en los partidos cuyo previo ya ha publicado; en el resto
    // pone "Previo no disponible" y no hay enlace que guardar.
    const acta = enlaces(filaHtml, "codacta=").find((u) => /codacta=\d+/i.test(u)) ?? null;

    // Los dos enlaces a ficha de equipo de la fila van en orden: local, visitante
    const codigos = enlaces(filaHtml, "NFG_VisEquipos").map((u) => parametro(u, "Codigo_Equipo"));
    // Y los dos escudos, en ese mismo orden
    const escudos = escudosDeFila(filaHtml);

    partidos.push({
      local,
      visitante,
      codLocal: codigos[0] ?? null,
      codVisitante: codigos[1] ?? null,
      escudoLocal: escudos[0] ?? null,
      escudoVisitante: escudos[1] ?? null,
      fecha,
      hora: hora(centro),
      golesLocal: goles ? goles[0] : null,
      golesVisitante: goles ? goles[1] : null,
      ...extraerCampo(detalle),
      codCampo,
      urlActa: acta,
    });
  }

  return partidos;
}

/**
 * Escudos de los dos equipos de una fila de partido, en orden local/visitante.
 * La RFAF los sirve desde su CDN; las rutas relativas se normalizan.
 */
function escudosDeFila(filaHtml) {
  return [...filaHtml.matchAll(/<img[^>]+src\s*=\s*["']?([^"'>\s]*pimg\/Clubes\/[^"'>\s]+)/gi)].map(
    (m) => (m[1].startsWith("http") ? m[1] : `https://rfaf.filesnovanet.es${m[1]}`),
  );
}

/** "San Roque - HERMANOS GARCIA MOTA (F11) Hierba Artificial Árbitro: X, Y" */
function extraerCampo(detalle) {
  if (!detalle) return { localidad: null, campo: null, superficie: null };

  const sinArbitro = detalle.split(/\s*Árbitro\s*:/i)[0].trim();
  const guion = sinArbitro.indexOf(" - ");
  const localidad = guion > 0 ? sinArbitro.slice(0, guion).trim() : null;
  let resto = guion > 0 ? sinArbitro.slice(guion + 3).trim() : sinArbitro;

  const superficie = /(Hierba Artificial|Hierba Natural|Tierra|Pista|Cemento)/i.exec(resto);
  if (superficie) resto = resto.replace(superficie[0], "").trim();

  return {
    localidad,
    campo: resto.replace(/\s*\([^)]*\)\s*$/, "").trim() || null,
    superficie: superficie ? superficie[1] : null,
  };
}

/**
 * Coordenadas de un campo, de su ficha en la RFAF.
 *
 * La federación pinta un enlace a Google Maps con la posición exacta; de ahí
 * se sacan la latitud y la longitud. Un campo no se mueve, así que basta con
 * leerlo una vez y guardarlo.
 */
export function extraerCoordenadas(html) {
  const m = /maps\?[^"']*q=loc:(-?\d+\.\d+)\+(-?\d+\.\d+)/i.exec(html);
  if (!m) return null;

  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // Andalucía queda holgadamente dentro de este recuadro: descarta lecturas
  // absurdas si la RFAF cambia el formato algún día
  if (lat < 35 || lat > 39 || lon < -8 || lon > -1) return null;

  return { lat, lon };
}

/* ----------------------------------------------------------- clasificación */

/**
 * Tabla de clasificación. Las columnas son, por orden:
 * pos | equipo | pts/pj | pts | casa J G E P | fuera J G E P | GF | GC | racha | sanción
 */
export function extraerClasificacion(html) {
  const tabla = [];

  for (const { celdas } of filas(html)) {
    if (celdas.length < 14) continue;

    const posicion = Number(celdas[0]);
    if (!Number.isInteger(posicion) || posicion < 1) continue;

    const n = (i) => {
      const v = Number(celdas[i]);
      return Number.isFinite(v) ? v : 0;
    };

    const casa = { j: n(4), g: n(5), e: n(6), p: n(7) };
    const fuera = { j: n(8), g: n(9), e: n(10), p: n(11) };

    tabla.push({
      posicion,
      equipo: celdas[1],
      puntos: n(3),
      jugados: casa.j + fuera.j,
      ganados: casa.g + fuera.g,
      empatados: casa.e + fuera.e,
      perdidos: casa.p + fuera.p,
      golesFavor: n(12),
      golesContra: n(13),
      // "G P G P P" -> ["G","P","G","P","P"], del más reciente al más antiguo
      racha: (celdas[14] ?? "").split(/\s+/).filter((r) => /^[GEP]$/.test(r)),
    });
  }

  return tabla;
}

/** Nombre por defecto de un equipo a partir de su categoría en la RFAF. */
export function nombreDesdeCategoria(categoria) {
  const c = texto(categoria).toUpperCase();
  const escalones = [
    ["PREBENJAMIN", "Prebenjamín"],
    ["BENJAMIN", "Benjamín"],
    ["ALEVIN", "Alevín"],
    ["INFANTIL", "Infantil"],
    ["CADETE", "Cadete"],
    ["JUVENIL", "Juvenil"],
    ["SENIOR", "Primer equipo"],
  ];
  return escalones.find(([clave]) => c.includes(clave))?.[1] ?? texto(categoria);
}
