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
import { resultadoCreible, saqueEnMs } from "./reglas.mjs";

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
comprobar(
  "sin hora, se cuenta desde la medianoche",
  resultadoCreible("2026-09-06", null, aLas("02:00")),
  true,
);
comprobar(
  "y sin fecha no se puede juzgar: pasa",
  resultadoCreible(null, null, Date.now()),
  true,
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
