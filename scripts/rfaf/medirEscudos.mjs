/**
 * Mide hasta dónde llega el dibujo de cada escudo.
 *
 *   node scripts/rfaf/medirEscudos.mjs            los que falten
 *   node scripts/rfaf/medirEscudos.mjs --todos    vuelve a medirlos todos
 *
 * **Para qué.** En el directo los escudos van sobre un disco blanco, y hasta
 * ahora todos se pintaban al mismo tamaño dentro de él. Eso hace que unos
 * parezcan grandes y otros pequeños sin motivo: un escudo con fondo macizo
 * toma prestado el disco como fondo propio y se lee hasta el borde, mientras
 * que uno recortado con fondo transparente deja blanco alrededor y parece
 * menor. Los dos están dibujados igual; lo que cambia es cuánto de su caja
 * ocupa el dibujo.
 *
 * Sabiendo de cada escudo a qué distancia del centro llega su píxel más
 * lejano, cada uno se puede escalar para que **su dibujo** toque el borde del
 * disco. El fondo blanco que sobresalga se recorta, y sobre un disco blanco
 * eso no se ve.
 *
 * **Por qué no lo hace el sincronizador.** Porque corre en GitHub sin instalar
 * dependencias —es node pelado a propósito— y esto necesita descodificar
 * imágenes. Así que se ejecuta a mano, de higos a brevas: solo cuando aparece
 * un rival nuevo. El sincronizador avisa cuando eso pasa.
 */

import fs from "node:fs/promises";
import path from "node:path";

const RAIZ = process.cwd();
const RUTA_ESCUDOS = path.join(RAIZ, "src", "data", "rfaf", "escudos.json");
const RUTA_FORMAS = path.join(RAIZ, "src", "data", "rfaf", "formas.json");
const NUESTRO = path.join(RAIZ, "public", "img", "escudo.png");

/** Lienzo de trabajo. Nada que ver con el tamaño en pantalla: solo precisión. */
const LADO = 240;

/** Por encima de esto un píxel es fondo blanco, no dibujo. */
const CASI_BLANCO = 240;

/** Por debajo de esto un píxel es transparente. */
const CASI_INVISIBLE = 32;

const TODOS = process.argv.includes("--todos");

/**
 * A qué distancia del centro llega el dibujo, en anchos de caja.
 *
 * 0,5 es un dibujo que toca justo el borde de su caja por el lado; 0,707, uno
 * que llega a las esquinas. Se mide con la imagen encajada en un cuadrado, que
 * es exactamente como la pinta la web.
 */
async function medir(sharp, datos) {
  const { data, info } = await sharp(datos)
    .resize(LADO, LADO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const canales = info.channels;
  const centro = (LADO - 1) / 2;
  let lejos = 0;
  let tinta = 0;

  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      const i = (y * LADO + x) * canales;
      if (data[i + canales - 1] < CASI_INVISIBLE) continue;
      const blanco =
        data[i] > CASI_BLANCO && data[i + 1] > CASI_BLANCO && data[i + 2] > CASI_BLANCO;
      if (blanco) continue;

      tinta++;
      const d = Math.hypot(x - centro, y - centro);
      if (d > lejos) lejos = d;
    }
  }

  /* Un escudo sin un solo píxel de dibujo no es un escudo: será un archivo
     roto o una imagen en blanco. Mejor no medirlo que inventarse un número */
  if (tinta < 20) return null;

  return Math.round((lejos / LADO) * 1000) / 1000;
}

async function leerJson(ruta, porDefecto) {
  try {
    return JSON.parse(await fs.readFile(ruta, "utf8"));
  } catch {
    return porDefecto;
  }
}

async function principal() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("Falta sharp. Se instala con las dependencias del proyecto: npm install");
    process.exit(1);
  }

  const escudos = (await leerJson(RUTA_ESCUDOS, { escudos: {} })).escudos ?? {};
  const previas = TODOS ? {} : ((await leerJson(RUTA_FORMAS, { formas: {} })).formas ?? {});

  /* Un mismo archivo sirve a varios clubes: se mide una vez por imagen */
  const urls = [...new Set(Object.values(escudos))];
  const formas = { ...previas };

  let medidos = 0;
  let fallos = 0;

  // El nuestro también, que es el que más sale y no viene de la federación
  const pendientes = [NUESTRO, ...urls].filter((u) => TODOS || formas[clave(u)] === undefined);
  console.log(`${urls.length + 1} escudos, ${pendientes.length} por medir`);

  for (const origen of pendientes) {
    try {
      const datos = origen.startsWith("http")
        ? Buffer.from(await (await fetch(origen)).arrayBuffer())
        : await fs.readFile(origen);

      const radio = await medir(sharp, datos);
      if (radio === null) {
        console.warn(`  sin dibujo que medir: ${origen}`);
        fallos++;
        continue;
      }

      formas[clave(origen)] = radio;
      medidos++;
    } catch (e) {
      console.warn(`  no se pudo medir ${origen}: ${e.message}`);
      fallos++;
    }
  }

  if (medidos === 0 && !TODOS) {
    console.log("Nada que medir: todos los escudos están al día.");
    return;
  }

  await fs.writeFile(
    RUTA_FORMAS,
    JSON.stringify(
      {
        generado: new Date().toISOString(),
        _nota:
          "Hasta dónde llega el dibujo de cada escudo, en anchos de caja: 0,5 toca el borde por el lado y 0,707 llega a las esquinas. Lo escribe scripts/rfaf/medirEscudos.mjs y lo usa EscudoImg para que cada escudo llene el disco.",
        formas: Object.fromEntries(Object.entries(formas).sort(([a], [b]) => a.localeCompare(b))),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`Medidos ${medidos}${fallos ? `, ${fallos} sin medir` : ""}.`);
}

/** La clave es la dirección con la que la web pide el escudo. */
function clave(origen) {
  return origen.startsWith("http") ? origen : "/img/escudo.png";
}

principal().catch((e) => {
  console.error("Falló la medición:", e.message);
  process.exit(1);
});
