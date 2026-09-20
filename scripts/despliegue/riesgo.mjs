/**
 * ¿Este cambio puede tumbar la web sin que se note?
 *
 *   node scripts/despliegue/riesgo.mjs            (lo que hay sin subir)
 *   node scripts/despliegue/riesgo.mjs <desde>    (desde un commit concreto)
 *
 * Hay cambios que compilan, pasan todas las pruebas y aun así rompen la web
 * publicada, porque lo que tocan no vive en el código sino en cómo se sirve:
 * el dominio, las cabeceras, las rutas de la API, el service worker. El 20 de
 * septiembre de 2026 uno de esos —una redirección de `www`— hizo que un partido
 * entero se narrara sin guardarse.
 *
 * Esto no impide nada: **avisa**. Y el mismo criterio está en el workflow
 * `comprobar-despliegue.yml`, que lanza la comprobación contra la web
 * publicada cuando uno de estos archivos va a producción.
 */

import { execSync } from "node:child_process";

/**
 * Lo peligroso, y por qué.
 *
 * La lista es corta a propósito. Si crece con cualquier cosa, deja de leerse y
 * vuelve a valer lo mismo que no tenerla.
 */
const PELIGROSOS = [
  { patron: /^next\.config\.(ts|js|mjs)$/, porque: "redirecciones, cabeceras y dominios: puede bloquear las escrituras del directo" },
  { patron: /^vercel\.json$/, porque: "lo mismo, desde el lado de Vercel" },
  { patron: /^src\/middleware\.ts$/, porque: "se mete delante de todas las peticiones" },
  { patron: /^src\/app\/api\//, porque: "es por donde se escribe y se lee el directo" },
  { patron: /^public\/sw\.js$/, porque: "decide qué se sirve de la copia guardada en el móvil" },
  { patron: /^src\/app\/manifest\.ts$/, porque: "de ahí sale la aplicación instalada" },
  { patron: /^src\/lib\/(privado|directo\/(almacen|deposito|enlace))\.ts$/, porque: "el almacén y el permiso del directo" },
  { patron: /^package(-lock)?\.json$/, porque: "cambia lo que se ejecuta en producción" },
];

const desde = process.argv[2];
const orden = desde
  ? `git diff --name-only ${desde}..HEAD`
  : "git status --porcelain=v1 --untracked-files=all";

/*
 * Sin `trim()` sobre la salida entera: en `git status` el estado ocupa las dos
 * primeras columnas y un archivo modificado y sin preparar empieza por un
 * espacio. Recortarlo se comía una letra del nombre, no encajaba con ningún
 * patrón y este aviso habría nacido ya roto.
 */
const salida = execSync(orden, { encoding: "utf8" });
const archivos = salida
  .split("\n")
  .map((l) => (desde ? l.trim() : l.slice(3).trim()))
  .filter(Boolean);

const tocados = archivos
  .map((a) => ({ archivo: a, regla: PELIGROSOS.find((p) => p.patron.test(a)) }))
  .filter((x) => x.regla);

if (tocados.length === 0) {
  console.log(`Sin riesgo especial (${archivos.length} archivos tocados).`);
  process.exit(0);
}

console.log("CUIDADO: este cambio toca cosas que pueden romper la web publicada");
console.log("");
for (const { archivo, regla } of tocados) console.log(`  ${archivo}\n      ${regla.porque}`);
console.log("");
console.log("Antes de subir: que sea un día sin partido si se puede esperar.");
console.log("Después de subir, con el despliegue terminado:");
console.log("  node scripts/despliegue/comprobar.mjs");
console.log("");
console.log("El workflow «Comprobar la web publicada» lo lanza solo al llegar a main.");
