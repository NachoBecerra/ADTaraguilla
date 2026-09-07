/**
 * Repara la cronología de una retransmisión ya terminada.
 *
 * El caso para el que se escribe: nadie pulsó "final" al acabar el partido y
 * el reloj siguió corriendo, así que el pitido final quedó apuntado en el
 * 90+78. El instante de un evento es lo único que se guarda —el minuto se
 * deriva—, así que corregir el minuto es corregir ese instante.
 *
 *   node corregir.mjs <id>                        enseña la cronología
 *   node corregir.mjs <id> --final 90+2           mueve el pitido final
 *   node corregir.mjs <id> --quitar <idEvento>    quita un evento
 *   ... --escribir                                lo guarda de verdad
 *   ... --copia <archivo>                         dónde dejar el respaldo
 *
 * El almacén privado pide su token, que no está en .env.local:
 *
 *   npx vercel env pull .env.produccion --environment=production
 *   node --env-file=.env.produccion scripts/directo/corregir.mjs <id>
 *
 * Sin --escribir no toca nada: enseña cómo quedaría y para. Y antes de
 * guardar deja una copia de lo que había, que esto escribe sobre el partido
 * de verdad y no hay papelera donde buscarlo después.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/* El plegado es el del sitio, no una copia: el minuto que salga aquí tiene que
   ser exactamente el que verá quien abra el partido */
const { plegar } = await import(
  pathToFileURL(path.join(process.cwd(), "src", "lib", "directo", "modelo.ts")).href
);

const [id, ...resto] = process.argv.slice(2);
if (!id) {
  console.error("Falta el identificador del partido, por ejemplo primer-equipo-2026-09-06");
  process.exit(1);
}

const opcion = (nombre) => {
  const i = resto.indexOf(nombre);
  return i === -1 ? null : resto[i + 1] ?? null;
};
const bandera = (nombre) => resto.includes(nombre);

const RUTA = `directo/${id}.json`;
const EN_DISCO = bandera("--disco");
const RUTA_DISCO = path.join(process.cwd(), ".next", "cache", RUTA);

const TOKEN =
  process.env.BLOB_PRIVADO_READ_WRITE_TOKEN ?? process.env.BLOB_PRIVADO_TOKEN;

async function leer() {
  if (EN_DISCO) return JSON.parse(await fs.readFile(RUTA_DISCO, "utf8"));

  const { get } = await import("@vercel/blob");
  const encontrado = await get(RUTA, { access: "private", token: TOKEN, useCache: false });
  if (!encontrado) throw new Error(`No hay ninguna retransmisión guardada en ${RUTA}`);
  return await new Response(encontrado.stream).json();
}

async function guardar(registro) {
  if (EN_DISCO) {
    await fs.writeFile(RUTA_DISCO, JSON.stringify(registro), "utf8");
    return;
  }
  const { put } = await import("@vercel/blob");
  await put(RUTA, JSON.stringify(registro), {
    access: "private",
    token: TOKEN,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

/** La cronología tal y como la vería el público. */
function cronologia(registro) {
  const estado = plegar(registro.eventos, registro.partido.minutosPorParte);
  return estado.linea.map((e) => ({
    id: e.id,
    parte: e.parte,
    minuto: e.minuto.etiqueta,
    tipo: e.tipo,
    detalle: e.mensaje ?? e.clase ?? e.color ?? e.equipo ?? "",
  }));
}

const pintar = (titulo, registro) => {
  console.log(`\n${titulo}`);
  for (const e of cronologia(registro)) {
    console.log(
      `  ${String(e.parte)}ª  ${e.minuto.padStart(6)}  ${e.tipo.padEnd(13)} ${e.detalle}  [${e.id}]`,
    );
  }
};

/**
 * Mueve un evento hasta que su minuto sea el pedido.
 *
 * Se busca a tientas y se comprueba plegando, en vez de despejar la fórmula:
 * entre medias puede haber paradas de reloj, y lo único que dice de verdad en
 * qué minuto cae un instante es el mismo plegado que pinta la web.
 */
function moverA(registro, evento, etiqueta) {
  const minutos = registro.partido.minutosPorParte;
  const paso = 15_000;

  /* Cuatro horas hacia atrás en saltos de quince segundos: de sobra para un
     partido que nadie cerró, y acotado para no buscar sin fin */
  let mejor = null;
  for (let i = 0; i < 4 * 60 * 4; i++) {
    const ts = evento.ts - i * paso;
    const copia = registro.eventos.map((e) => (e.id === evento.id ? { ...e, ts } : e));
    const linea = plegar(copia, minutos).linea;
    const puesto = linea.find((e) => e.id === evento.id);
    if (!puesto) continue;
    if (puesto.minuto.etiqueta === etiqueta) mejor = ts; // el más tardío que cuadra
    else if (mejor !== null) break; // ya nos hemos pasado
  }

  if (mejor === null) throw new Error(`No hay ningún instante que caiga en el ${etiqueta}`);
  return registro.eventos.map((e) => (e.id === evento.id ? { ...e, ts: mejor } : e));
}

const registro = await leer();
pintar("Como está ahora:", registro);

let cambiado = { ...registro, eventos: [...registro.eventos] };
let hayCambios = false;

const quitar = opcion("--quitar");
if (quitar) {
  const fuera = new Set(quitar.split(",").map((s) => s.trim()));
  const antes = cambiado.eventos.length;
  cambiado.eventos = cambiado.eventos.filter((e) => !fuera.has(e.id));
  if (cambiado.eventos.length === antes) throw new Error(`Ningún evento con ese id: ${quitar}`);
  hayCambios = true;
}

const final = opcion("--final");
if (final) {
  const evento = [...cambiado.eventos].reverse().find((e) => e.tipo === "final");
  if (!evento) throw new Error("Este partido no tiene apuntado el final");
  cambiado.eventos = moverA(cambiado, evento, final);
  hayCambios = true;
}

if (!hayCambios) {
  console.log("\nNada que cambiar. Con --final o --quitar se corrige.");
  process.exit(0);
}

cambiado.version = (registro.version ?? 1) + 1;
cambiado.actualizado = new Date().toISOString();

pintar("Como quedaría:", cambiado);

if (!bandera("--escribir")) {
  console.log("\nEnsayo: no se ha tocado nada. Con --escribir se guarda.");
  process.exit(0);
}

const copia = opcion("--copia") ?? path.join(process.cwd(), `copia-${id}-${Date.now()}.json`);
await fs.writeFile(copia, JSON.stringify(registro, null, 2), "utf8");
console.log(`\nCopia de lo que había: ${copia}`);

await guardar(cambiado);
console.log("Guardado.");
