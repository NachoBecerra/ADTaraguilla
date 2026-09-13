/**
 * Manda los avisos que dejó apuntados la sincronización.
 *
 *   node scripts/rfaf/avisar.mjs avisos-pendientes.json
 *
 * **Por qué va aparte.** Antes los avisos salían en mitad de la pasada, antes
 * de publicar. Si el `git push` fallaba —pasó el 31 de agosto y el 3 y el 10 de
 * septiembre de 2026, siempre por un commit del panel que llegó antes—, la
 * gente recibía un resultado que no estaba en la web, y la pasada siguiente,
 * que volvía a encontrar la misma novedad, lo avisaba otra vez. Ahora el
 * workflow solo llama a esto cuando la publicación ha salido bien.
 */

import fs from "node:fs/promises";
import { mandarAvisos } from "./avisos.mjs";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Falta el archivo de avisos pendientes");
  process.exit(1);
}

let avisos = [];
try {
  avisos = JSON.parse(await fs.readFile(ruta, "utf8"));
} catch {
  console.log("Sin avisos pendientes.");
  process.exit(0);
}

await mandarAvisos(avisos);
