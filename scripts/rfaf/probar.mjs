/**
 * Prueba los extractores contra páginas guardadas, sin tocar la red.
 *   node scripts/rfaf/probar.mjs <carpeta-con-html>
 */
import fs from "node:fs";
import path from "node:path";
import {
  extraerEquipos, extraerCompeticiones, extraerCalendario,
  extraerJornada, extraerClasificacion,
} from "./extraer.mjs";

const dir = process.argv[2];
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
