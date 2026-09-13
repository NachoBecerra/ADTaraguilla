/**
 * Prueba los extractores.
 *
 *   node scripts/rfaf/probar.mjs                    solo lo que no necesita red
 *   node scripts/rfaf/probar.mjs <carpeta-con-html> además, contra páginas guardadas
 */
import fs from "node:fs";
import path from "node:path";
import {
  extraerEquipos, extraerCompeticiones, extraerCalendario,
  extraerJornada, extraerClasificacion,
} from "./extraer.mjs";
import { marcador } from "./html.mjs";
import {
  ORIGEN_TABLA,
  atascoDeResultados,
  equiposAusentes,
  partidosCongelados,
  partidosDelCalendario,
  resultadoCreible,
  resultadoPorClasificacion,
  saqueEnMs,
  yaDeberiaTenerResultado,
} from "./reglas.mjs";

let fallos = 0;
function comprobar(que, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? "ok   " : "FALLA"} ${que}${ok ? "" : `  (dio ${JSON.stringify(real)}, se esperaba ${JSON.stringify(esperado)})`}`);
}

/* ==================== leer el marcador de una celda ==================== */

/*
 * Todas estas celdas son de verdad: las servía la RFAF el 6 de septiembre de
 * 2026, la tarde del primer partido del senior. Media liga con el acta a medio
 * escribir, y la web del club publicando 1-12 y 0-18 en primera andaluza.
 *
 * La celda del centro trae el marcador, la fecha y la hora pegados. Lo que
 * costó el disgusto fue buscar "número - número" en cualquier parte: con el
 * resultado a medias, la hora hacía de goles.
 */
const golesDe = (celda) =>
  marcador(
    celda
      .replace(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/g, " ")
      .replace(/\b\d{1,2}:\d{2}\b/g, " ")
      .trim(),
  );

comprobar("un partido jugado da su resultado", golesDe("4 - 1 06-09-2026 12:00"), [4, 1]);
comprobar("y un cero a cero también", golesDe("0 - 0 06-09-2026 12:00"), [0, 0]);
comprobar("sin jugar todavía, no hay resultado", golesDe("- 06-09-2026 18:30"), null);
comprobar(
  "con el acta a medias, tampoco: la hora no son los goles del visitante",
  golesDe("5 - 06-09-2026 12:00"),
  null,
);
comprobar("ni al revés, con el local sin poner", golesDe("- 6 06-09-2026 18:00"), null);
comprobar("y una celda con tres números es basura", golesDe("- 1 4 06-09-2026 19:00"), null);
comprobar("una goleada de verdad sí pasa", golesDe("10 - 0 06-09-2026 12:00"), [10, 0]);

/* ============ cuando creerse un resultado de la federacion ============ */

console.log("");

/* La hora del campo, no la del servidor: GitHub va en UTC y España no */
comprobar(
  "un partido de las 19:00 del 6 de septiembre saca a las 17:00 UTC",
  new Date(saqueEnMs("2026-09-06", "19:00")).toISOString(),
  "2026-09-06T17:00:00.000Z",
);
comprobar(
  "y en diciembre, con una hora menos de desfase, a las 18:00 UTC",
  new Date(saqueEnMs("2026-12-06", "19:00")).toISOString(),
  "2026-12-06T18:00:00.000Z",
);

/*
 * El caso que costó el disgusto: a las 18:22 la RFAF daba por jugado, con
 * resultado, el partido que empezaba a las 19:00.
 */
const aLas = (hhmm) => saqueEnMs("2026-09-06", hhmm);

comprobar(
  "a las 18:22, con el partido de las 19:00 sin empezar, no hay resultado que valga",
  resultadoCreible("2026-09-06", "19:00", aLas("18:22")),
  false,
);
comprobar(
  "en el descanso, tampoco",
  resultadoCreible("2026-09-06", "19:00", aLas("19:50")),
  false,
);
comprobar(
  "una hora después del saque ya puede haber acabado",
  resultadoCreible("2026-09-06", "19:00", aLas("20:05")),
  true,
);
comprobar(
  "y al día siguiente, por supuesto",
  resultadoCreible("2026-09-06", "19:00", Date.parse("2026-09-07T10:00:00Z")),
  true,
);
/* Sin hora, el partido se da por jugado al acabar su día. Antes se contaba
   desde la medianoche, y a la una de la madrugada ya competía como candidato a
   resultado con otro partido del equipo que sí se había jugado */
comprobar(
  "sin hora, no se da por jugado en su propio día",
  resultadoCreible("2026-09-06", null, aLas("20:00")),
  false,
);
comprobar(
  "y al día siguiente, sí",
  resultadoCreible("2026-09-06", null, Date.parse("2026-09-07T08:00:00Z")),
  true,
);
comprobar(
  "y sin fecha no se puede juzgar: pasa",
  resultadoCreible(null, null, Date.now()),
  true,
);

/*
 * ¿Merece la pena volver a pedir el equipo? El fallo de verdad: calculado en la
 * hora del servidor, en GitHub —que va en UTC— un partido de las 19:00 se daba
 * por terminado a las 23:00 españolas, y durante dos horas su resultado no se
 * pedía. Estas cuentas van en hora española y dan lo mismo en cualquier servidor.
 */
const delSabado = (hora) => ({ fecha: "2026-09-06", hora, jugado: false });
comprobar(
  "a las 20:30 el partido de las 19:00 aún no tiene acta",
  yaDeberiaTenerResultado(delSabado("19:00"), aLas("20:30")),
  false,
);
comprobar(
  "a las 21:05 ya puede tenerla: se vuelve a pedir el equipo",
  yaDeberiaTenerResultado(delSabado("19:00"), aLas("21:05")),
  true,
);
comprobar(
  "uno ya jugado no pide nada",
  yaDeberiaTenerResultado({ ...delSabado("19:00"), jugado: true }, aLas("23:00")),
  false,
);
comprobar(
  "uno sin hora espera a que acabe su día",
  yaDeberiaTenerResultado(delSabado(null), aLas("22:00")),
  false,
);
comprobar(
  "y uno de días anteriores, siempre",
  yaDeberiaTenerResultado({ fecha: "2026-09-05", hora: "12:00", jugado: false }, aLas("09:00")),
  true,
);

/* ========== el resultado deducido de la clasificacion ========== */

console.log("");

/*
 * El caso de verdad: jornada 1 de 1a andaluza senior, 6 de septiembre de 2026.
 * El Taraguilla gano 0-2 en Tarifa. El marcador de la RFAF decia 4-4, 0-4, 2-2
 * y 4-0 segun la hora a la que se mirara —son señuelos contra el copiado—, pero
 * la tabla dice 3 puntos, 1 jugado, 2 a favor y 0 en contra. Con eso sobra.
 */
const DESPUES = Date.parse("2026-09-07T10:00:00Z");
const laTabla = (extra = {}) => [
  { equipo: "A.D. TARAGUILLA", puntos: 3, jugados: 1, golesFavor: 2, golesContra: 0, ...extra },
  { equipo: "TARIFA U.D.", puntos: 0, jugados: 1, golesFavor: 0, golesContra: 2 },
];
const elCalendario = () => [
  {
    numero: 1,
    fecha: "2026-09-06",
    partidos: [
      { local: "XEREZ DEPORTIVO F.C.", visitante: "BARBATE C.F.", fecha: "2026-09-06", hora: "12:00", golesLocal: null, golesVisitante: null },
      { local: "TARIFA U.D.", visitante: "A.D. TARAGUILLA", fecha: "2026-09-06", hora: "19:00", golesLocal: null, golesVisitante: null },
    ],
  },
  {
    numero: 2,
    fecha: "2026-09-13",
    partidos: [
      { local: "A.D. TARAGUILLA", visitante: "C.D. GUADIARO", fecha: "2026-09-13", hora: "19:00", golesLocal: null, golesVisitante: null },
    ],
  },
];

const deducir = (clasificacion, jornadas, ahora = DESPUES) =>
  resultadoPorClasificacion({ nombreRfaf: "A.D. TARAGUILLA", clasificacion, jornadas, ahora });

comprobar(
  "de 1 jugado y 2-0 a favor sale el 0-2 de Tarifa",
  deducir(laTabla(), elCalendario()),
  { jornada: 0, partido: 1, golesLocal: 0, golesVisitante: 2 },
);

/* Jugando en casa, los mismos numeros van al reves */
const enCasa = elCalendario();
enCasa[0].partidos[1] = { local: "A.D. TARAGUILLA", visitante: "TARIFA U.D.", fecha: "2026-09-06", hora: "19:00", golesLocal: null, golesVisitante: null };
comprobar(
  "y jugando en casa, 2-0",
  deducir(laTabla(), enCasa),
  { jornada: 0, partido: 1, golesLocal: 2, golesVisitante: 0 },
);

/* Con el resultado ya guardado no hay nada nuevo que deducir */
const yaPuesto = elCalendario();
yaPuesto[0].partidos[1].golesLocal = 0;
yaPuesto[0].partidos[1].golesVisitante = 2;
comprobar("con el resultado ya puesto, no se toca nada", deducir(laTabla(), yaPuesto), null);

/* La segunda jornada, con la primera ya contada */
const dosJornadas = elCalendario();
dosJornadas[0].partidos[1].golesLocal = 0;
dosJornadas[0].partidos[1].golesVisitante = 2;
comprobar(
  "la 2a jornada se deduce descontando la 1a",
  resultadoPorClasificacion({
    nombreRfaf: "A.D. TARAGUILLA",
    clasificacion: [{ equipo: "A.D. TARAGUILLA", puntos: 4, jugados: 2, golesFavor: 3, golesContra: 1 }],
    jornadas: dosJornadas,
    ahora: Date.parse("2026-09-14T10:00:00Z"),
  }),
  { jornada: 1, partido: 0, golesLocal: 1, golesVisitante: 1 },
);

/* Y lo que NO se puede deducir, no se inventa */
comprobar(
  "con dos partidos pendientes a la vez, no se deduce nada",
  resultadoPorClasificacion({
    nombreRfaf: "A.D. TARAGUILLA",
    clasificacion: [{ equipo: "A.D. TARAGUILLA", puntos: 4, jugados: 2, golesFavor: 3, golesContra: 1 }],
    jornadas: elCalendario(),
    ahora: Date.parse("2026-09-14T10:00:00Z"),
  }),
  null,
);
comprobar(
  "si la tabla no ha contado el partido todavía, tampoco",
  deducir([{ equipo: "A.D. TARAGUILLA", puntos: 0, jugados: 0, golesFavor: 0, golesContra: 0 }], elCalendario()),
  null,
);
comprobar(
  "ni antes de que el partido pueda haber acabado",
  deducir(laTabla(), elCalendario(), Date.parse("2026-09-06T16:00:00Z")),
  null,
);
comprobar(
  "sin nuestro equipo en la tabla, no hay nada que hacer",
  deducir([{ equipo: "OTRO C.F.", puntos: 3, jugados: 1, golesFavor: 2, golesContra: 0 }], elCalendario()),
  null,
);
comprobar(
  "y una diferencia absurda se descarta antes que publicarla",
  deducir(laTabla({ golesFavor: 400 }), elCalendario()),
  null,
);

/*
 * El partido suspendido. La jornada 1 en casa se suspende y no tendrá resultado
 * nunca; la 2 se juega en Tarifa y se gana 0-2. Con dos pendientes, antes no se
 * deducía nada ese día ni ninguno de los siguientes de la temporada.
 */
const conSuspendido = (visitaLaDos = true) => [
  {
    numero: 1,
    fecha: "2026-09-06",
    partidos: [
      { local: "A.D. TARAGUILLA", visitante: "C.D. GUADIARO", fecha: "2026-09-06", hora: "12:00", golesLocal: null, golesVisitante: null },
    ],
  },
  {
    numero: 2,
    fecha: "2026-09-13",
    partidos: [
      visitaLaDos
        ? { local: "TARIFA U.D.", visitante: "A.D. TARAGUILLA", fecha: "2026-09-13", hora: "19:00", golesLocal: null, golesVisitante: null }
        : { local: "A.D. TARAGUILLA", visitante: "TARIFA U.D.", fecha: "2026-09-13", hora: "19:00", golesLocal: null, golesVisitante: null },
    ],
  },
];
const LUNES = Date.parse("2026-09-14T10:00:00Z");
const tablaTrasLaDos = (porCampo) => [
  { equipo: "A.D. TARAGUILLA", puntos: 3, jugados: 1, golesFavor: 2, golesContra: 0, ...porCampo },
];
const deducirLunes = (tabla, jornadas) =>
  resultadoPorClasificacion({ nombreRfaf: "A.D. TARAGUILLA", clasificacion: tabla, jornadas, ahora: LUNES });
const atascoLunes = (tabla, jornadas) =>
  atascoDeResultados({ nombreRfaf: "A.D. TARAGUILLA", clasificacion: tabla, jornadas, ahora: LUNES });

comprobar(
  "con un suspendido en casa y la tabla sin separar por campo, se sigue sin deducir",
  deducirLunes(tablaTrasLaDos({}), conSuspendido()),
  null,
);
comprobar(
  "pero si la tabla dice que el partido nuevo fue fuera, es el de Tarifa: 0-2",
  deducirLunes(tablaTrasLaDos({ jugadosCasa: 0, jugadosFuera: 1 }), conSuspendido()),
  { jornada: 1, partido: 0, golesLocal: 0, golesVisitante: 2 },
);
comprobar(
  "y entonces no hay atasco que avisar",
  atascoLunes(tablaTrasLaDos({ jugadosCasa: 0, jugadosFuera: 1 }), conSuspendido()),
  null,
);
comprobar(
  "si los dos pendientes son en casa, el campo no desempata: no se deduce",
  deducirLunes(tablaTrasLaDos({ jugadosCasa: 1, jugadosFuera: 0 }), conSuspendido(false)),
  null,
);
comprobar(
  "y se avisa del atasco, con los dos partidos que hay que mirar",
  atascoLunes(tablaTrasLaDos({ jugadosCasa: 1, jugadosFuera: 0 }), conSuspendido(false))?.candidatos.length,
  2,
);
comprobar(
  "con un solo pendiente fuera y la tabla contando uno en casa, el que ha contado es otro: nada",
  deducirLunes(tablaTrasLaDos({ jugadosCasa: 1, jugadosFuera: 0 }), [conSuspendido()[1]]),
  null,
);
comprobar(
  "una tabla por campo que no cuadra con el total no se toca",
  deducirLunes(tablaTrasLaDos({ jugadosCasa: 1, jugadosFuera: 1 }), conSuspendido()),
  null,
);
comprobar(
  "sin nada que la tabla cuente de más, no hay atasco aunque haya pendientes",
  atascoLunes([{ ...tablaTrasLaDos({ jugadosCasa: 0, jugadosFuera: 0 })[0], jugados: 0, golesFavor: 0 }], conSuspendido()),
  null,
);

/* --------------------------------------------- lo ya jugado no se borra */

console.log("");

/*
 * Los dos casos reales, con tres días de diferencia. La RFAF sirvió el
 * calendario a medias: la jornada 1 del senior pasó de nueve partidos a uno, y
 * la del infantil A de ocho a dos. Cada recorte se llevó por delante un
 * partido de verdad, y la web se quedó sin él.
 */
const tarifa = {
  local: "TARIFA U.D.",
  visitante: "A.D. TARAGUILLA",
  fecha: "2026-09-06",
  golesLocal: 0,
  golesVisitante: 2,
  origen: ORIGEN_TABLA,
  jugado: true,
};
/* El del infantil A: jugado esta mañana, con el acta todavía sin cerrar */
const sevilla = {
  local: "SEVILLA F.C., S.A.D.",
  visitante: "A.D. TARAGUILLA",
  fecha: "2026-09-12",
  hora: "12:00",
  golesLocal: null,
  golesVisitante: null,
  origen: null,
  jugado: false,
};
const guadiaro = {
  local: "A.D. TARAGUILLA",
  visitante: "C.D. GUADIARO",
  fecha: "2026-09-13",
  hora: "19:00",
  jugado: false,
};

/* Las dos de la tarde del sábado 12: el del infantil A lleva dos horas jugado
   y el del senior es de mañana */
const AHORA = saqueEnMs("2026-09-12", "14:00");
const calendarioCon = (...partidos) => partidosDelCalendario([{ partidos }]);
const nombres = (lista) => lista.map((p) => `${p.local}|${p.visitante}`);

comprobar(
  "un partido con resultado que el calendario ya no trae se conserva",
  nombres(partidosCongelados([tarifa], calendarioCon(guadiaro), AHORA)),
  ["TARIFA U.D.|A.D. TARAGUILLA"],
);

comprobar(
  "y uno jugado esta misma mañana, con el acta sin cerrar, también",
  nombres(partidosCongelados([sevilla], calendarioCon(guadiaro), AHORA)),
  ["SEVILLA F.C., S.A.D.|A.D. TARAGUILLA"],
);

comprobar(
  "el que sigue en el calendario no se duplica",
  partidosCongelados([tarifa, guadiaro], calendarioCon(tarifa, guadiaro), AHORA).length,
  0,
);

/*
 * Y aquí está la diferencia entre un renuncio de la federación y una noticia:
 * si el partido reaparece en otra jornada es que lo han aplazado, y entonces
 * manda el calendario. Sin esto saldría dos veces, en su fecha vieja y en la
 * nueva.
 */
comprobar(
  "un partido recolocado en otra jornada no se rescata en la vieja",
  partidosCongelados([sevilla], calendarioCon(sevilla), AHORA).length,
  0,
);

comprobar(
  "uno que aún no ha empezado y se cae del calendario se ha aplazado: no se rescata",
  partidosCongelados([guadiaro], calendarioCon(), AHORA).length,
  0,
);

comprobar(
  "y si el calendario llega vacío del todo, lo jugado se queda",
  nombres(partidosCongelados([tarifa, sevilla, guadiaro], calendarioCon(), AHORA)),
  ["TARIFA U.D.|A.D. TARAGUILLA", "SEVILLA F.C., S.A.D.|A.D. TARAGUILLA"],
);

comprobar(
  "y el de esta tarde, que ni ha empezado, tampoco se congela",
  partidosCongelados([{ ...sevilla, hora: "18:00" }], calendarioCon(), AHORA).length,
  0,
);

comprobar("sin nada previo no hay nada que conservar", partidosCongelados(undefined, calendarioCon(), AHORA).length, 0);

/* ----------------------------------------- un equipo no se cae de golpe */

console.log("");

/*
 * La ficha del club también llega recortada. Un recorte no puede sacar a un
 * equipo de la web; una baja de verdad —el prebenjamín, sin inscribir esta
 * temporada— sí tiene que acabar saliendo.
 */
const MEDIODIA = Date.parse("2026-09-13T10:00:00Z");
const hace = (dias) => new Date(MEDIODIA - dias * 86_400_000).toISOString();
const indice = [{ id: "primer-equipo" }, { id: "juvenil" }, { id: "cadete" }];

comprobar(
  "con todos en la ficha, nadie se conserva ni se retira",
  equiposAusentes(indice, ["primer-equipo", "juvenil", "cadete"], MEDIODIA),
  { conservados: [], retirados: [] },
);
comprobar(
  "el que falta por primera vez se conserva, apuntando desde cuándo",
  equiposAusentes(indice, ["primer-equipo", "cadete"], MEDIODIA),
  { conservados: [{ id: "juvenil", ausenteDesde: new Date(MEDIODIA).toISOString() }], retirados: [] },
);
comprobar(
  "si sigue faltando al día siguiente, se conserva sin mover la fecha",
  equiposAusentes([...indice.slice(0, 1), { id: "juvenil", ausenteDesde: hace(1) }, indice[2]], ["primer-equipo", "cadete"], MEDIODIA),
  { conservados: [{ id: "juvenil", ausenteDesde: hace(1) }], retirados: [] },
);
comprobar(
  "pasados los días de gracia, se retira: es una baja de verdad",
  equiposAusentes([{ id: "prebenjamin", ausenteDesde: hace(4) }], ["primer-equipo"], MEDIODIA),
  { conservados: [], retirados: ["prebenjamin"] },
);
comprobar(
  "y el que vuelve a salir en la ficha no se toca: se rehace y pierde la marca",
  equiposAusentes([{ id: "juvenil", ausenteDesde: hace(2) }], ["juvenil"], MEDIODIA),
  { conservados: [], retirados: [] },
);

console.log("");
console.log(fallos === 0 ? "Todo correcto." : fallos + " comprobaciones fallan.");

const dir = process.argv[2];
if (!dir) {
  console.log("\n(sin carpeta de páginas guardadas: no se prueban los extractores)");
  process.exit(fallos === 0 ? 0 : 1);
}
console.log("");
const leer = (f) => new TextDecoder("iso-8859-15").decode(fs.readFileSync(path.join(dir, f)));

const cal = extraerCalendario(leer("cal22.html"));
console.log("CALENDARIO:", cal.length, "jornadas");
console.log("  ", cal[0]?.nombre, "|", cal[0]?.fecha, "|", cal[0]?.partidos.length, "partidos");
console.log("  ", JSON.stringify(cal[0]?.partidos[7]));

const jor = extraerJornada(leer("j21.html"));
console.log("\nJORNADA jugada:", jor.length, "partidos");
console.log("  ", JSON.stringify(jor[0]));

const clas = extraerClasificacion(leer("clas2.html"));
console.log("\nCLASIFICACION:", clas.length, "equipos");
console.log("  ", JSON.stringify(clas.find((c) => c.equipo.includes("TARAGUILLA"))));

console.log("\nEQUIPOS:", extraerEquipos(leer("club.html")).length);
console.log("COMPETICIONES 26/27:", JSON.stringify(extraerCompeticiones(leer("ce_38877699.html"), "2026-2027"), null, 1));
