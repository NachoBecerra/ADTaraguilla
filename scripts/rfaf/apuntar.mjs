/**
 * Apunta en el historial del club lo que ha hecho la sincronización.
 *
 *   node scripts/rfaf/apuntar.mjs "Datos publicados" "2 resultados nuevos"
 *   node scripts/rfaf/apuntar.mjs --fallo "La pasada ha fallado" "..."
 *
 * Lo manda a la web, que es quien tiene el almacén. Sin dependencias, como
 * todo lo que corre en GitHub.
 *
 * Que esto falle no puede hacer fallar la pasada: apuntar el historial es lo
 * último y lo menos importante de todo lo que hace el bot.
 */

const args = process.argv.slice(2);
const ok = !args.includes("--fallo");
const [accion, detalle] = args.filter((a) => a !== "--fallo");

if (!accion) {
  console.log("Nada que apuntar.");
  process.exit(0);
}

const secreto = process.env.AVISOS_SECRETO;
const sitio = process.env.SITIO_URL;

if (!secreto || !sitio) {
  console.log("Historial sin apuntar: falta AVISOS_SECRETO o SITIO_URL.");
  process.exit(0);
}

try {
  const r = await fetch(`${sitio}/api/bitacora`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-avisos-secreto": secreto },
    body: JSON.stringify({ accion, detalle, ok }),
  });
  console.log(r.ok ? `Historial: apuntado «${accion}».` : `Historial: la web respondió ${r.status}.`);
} catch (e) {
  console.log(`Historial sin apuntar (${e.message}).`);
}
