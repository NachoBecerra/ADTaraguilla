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

/*
 * Con AVISOS se manda una lista concreta, para ensayar cómo se verá un aviso
 * de verdad. Sin ella, el mismo texto a todos los equipos.
 */
let avisos;
if (process.env.AVISOS) {
  try {
    avisos = JSON.parse(process.env.AVISOS);
  } catch (e) {
    console.error("✗ AVISOS no es un JSON válido:", e.message);
    process.exit(1);
  }
  if (!Array.isArray(avisos) || avisos.length === 0) {
    console.error("✗ AVISOS debe ser una lista con al menos un aviso");
    process.exit(1);
  }
} else {
  const equipos = readdirSync(DIR_EQUIPOS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(DIR_EQUIPOS, f), "utf8")));

  avisos = equipos.map((e) => ({
    equipo: e.id,
    titulo: "AD Taraguilla",
    cuerpo: mensaje,
    url: "/",
  }));
}

for (const a of avisos) console.log(`· ${a.equipo}: "${a.titulo}" / ${a.cuerpo}`);

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
