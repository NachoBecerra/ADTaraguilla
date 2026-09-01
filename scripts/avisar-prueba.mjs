/**
 * Manda un aviso de prueba a todo el que tenga avisos activados.
 *
 * Sirve para comprobar que la cadena entera funciona —permiso, suscripción,
 * envío y llegada al móvil— sin esperar a que la RFAF publique algo.
 *
 * Se manda uno por cada equipo del club: como cada dispositivo sigue a uno
 * solo, cada persona recibe exactamente un aviso, no nueve.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const DIR_EQUIPOS = path.join(RAIZ, "src", "data", "rfaf", "equipos");

const secreto = process.env.AVISOS_SECRETO;
const sitio = process.env.SITIO_URL;
const mensaje = process.env.MENSAJE || "Notificación de pruebas, disculpa las molestias";

if (!secreto || !sitio) {
  console.error("✗ Faltan AVISOS_SECRETO o SITIO_URL");
  process.exit(1);
}

const equipos = readdirSync(DIR_EQUIPOS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(DIR_EQUIPOS, f), "utf8")));

const avisos = equipos.map((e) => ({
  equipo: e.id,
  titulo: "AD Taraguilla",
  cuerpo: mensaje,
  url: "/",
}));

console.log(`· Mandando la prueba a los ${avisos.length} equipos…`);

const r = await fetch(`${sitio}/api/avisar`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-avisos-secreto": secreto },
  body: JSON.stringify({ avisos }),
});

const cuerpo = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error(`✗ La web respondió ${r.status}:`, JSON.stringify(cuerpo));
  process.exit(1);
}

console.log(`· Enviados: ${cuerpo.enviados ?? 0}`);
if (cuerpo.caducadas) console.log(`· Suscripciones caducadas retiradas: ${cuerpo.caducadas}`);
if (!cuerpo.enviados) {
  console.log("⚠ Nadie tiene avisos activados todavía, así que no ha salido ninguno.");
}
