/**
 * Comprobación de la web ya publicada.
 *
 *   node scripts/despliegue/comprobar.mjs [--url https://ad-taraguilla.es] [--sha <commit>]
 *
 * Nace del 20 de septiembre de 2026. El día antes se añadió una redirección de
 * `www` al dominio pelado por los buscadores; compilaba, las pruebas pasaban y
 * la web se veía perfecta. Al día siguiente el senior se narró entero y no se
 * guardó ni un evento: la botonera de quien estaba en el campo la tenía abierta
 * en `www`, sus envíos salían a `www/api`, la redirección los llevaba al otro
 * dominio y el navegador los bloqueaba.
 *
 * Lo que ninguna prueba de las que había podía ver: **todas corren en el
 * ordenador de quien programa, contra funciones sueltas**. Esta corre contra la
 * web de verdad y mira lo único que de verdad importa: que lo que se apunta en
 * el campo **llegue**.
 *
 * Sin dependencias, como el resto de scripts: el workflow no instala nada.
 */

const args = process.argv.slice(2);
const opcion = (nombre, porDefecto = null) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto;
};

const BASE = (opcion("url", process.env.SITIO_URL || "https://ad-taraguilla.es")).replace(/\/$/, "");
const SHA = opcion("sha", process.env.COMMIT_ESPERADO);
/** El mismo dominio con www: la mitad olvidada del fallo. */
const CON_WWW = BASE.replace("https://", "https://www.");

let fallos = 0;
const lineas = [];

function anotar(ok, que, detalle = "") {
  if (!ok) fallos++;
  const linea = `${ok ? "ok   " : "FALLA"} ${que}${detalle ? ` — ${detalle}` : ""}`;
  lineas.push(linea);
  console.log(linea);
}

/** Petición sin seguir redirecciones: una redirección aquí es justo el fallo. */
async function pedir(url, opciones = {}) {
  try {
    const r = await fetch(url, { redirect: "manual", cache: "no-store", ...opciones });
    return { estado: r.status, destino: r.headers.get("location"), tipo: r.headers.get("content-type") ?? "", r };
  } catch (e) {
    return { estado: 0, destino: null, tipo: "", error: e.message };
  }
}

/* ------------------------------------------------------ ¿qué hay publicado? */

async function versionPublicada() {
  const { r, estado } = await pedir(`${BASE}/api/version`);
  if (estado !== 200 || !r) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Espera a que esté publicado el commit que se quiere comprobar.
 *
 * Desplegar tarda un par de minutos. Sin esta espera, la comprobación mediría
 * la versión anterior y diría que todo está bien.
 */
async function esperarAlDespliegue(sha, minutos = 10) {
  const hasta = Date.now() + minutos * 60_000;
  let ultima = null;

  while (Date.now() < hasta) {
    const v = await versionPublicada();
    ultima = v?.commit ?? null;
    if (ultima && sha && ultima.startsWith(sha.slice(0, 7))) return true;
    if (!sha) return true;
    await new Promise((r) => setTimeout(r, 15_000));
  }

  anotar(false, "el despliegue llega a tiempo", `se esperaba ${sha?.slice(0, 7)} y hay ${ultima?.slice(0, 7) ?? "nada"}`);
  return false;
}

/* --------------------------------------------------------- comprobaciones */

/**
 * Lo más importante de todo: que una escritura del directo **llegue a la API**
 * desde los dos dominios.
 *
 * Se manda un token falso a propósito: no hace falta ningún secreto para saber
 * si la petición llega. Si llega, la API contesta 401 en JSON, que es la prueba
 * de que el camino está abierto. Si en vez de eso hay una redirección, el
 * navegador de quien narra la bloquearía por CORS y el partido se perdería, que
 * es exactamente lo que pasó.
 */
async function laEscrituraLlega(origen, nombre) {
  const url = `${origen}/api/directo/prueba-de-escritura-2000-01-01`;
  const { estado, destino, tipo, error } = await pedir(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "0.0.falso", eventos: [] }),
  });

  if (error) return anotar(false, `se puede escribir desde ${nombre}`, error);

  if (estado >= 300 && estado < 400) {
    return anotar(
      false,
      `se puede escribir desde ${nombre}`,
      `redirige a ${destino}: el navegador bloquearía la escritura (esto tumbó el partido del 20-9-2026)`,
    );
  }

  anotar(
    estado === 401 && tipo.includes("json"),
    `se puede escribir desde ${nombre}`,
    `contestó ${estado} (${tipo || "sin tipo"})`,
  );
}

/** Una página o un archivo que tiene que estar, sin redirecciones por medio. */
async function responde(ruta, esperado = 200) {
  const { estado, destino, error } = await pedir(`${BASE}${ruta}`);
  anotar(
    estado === esperado,
    `responde ${ruta}`,
    error ?? (estado === esperado ? "" : `${estado}${destino ? ` -> ${destino}` : ""}`),
  );
}

async function contesta(ruta, comoDebe) {
  const { r, estado, error } = await pedir(`${BASE}${ruta}`);
  if (error || estado !== 200 || !r) return anotar(false, `contesta ${ruta}`, error ?? `estado ${estado}`);
  try {
    const datos = await r.json();
    const queja = comoDebe(datos);
    anotar(!queja, `contesta ${ruta}`, queja ?? "");
  } catch (e) {
    anotar(false, `contesta ${ruta}`, `no es JSON: ${e.message}`);
  }
}

async function principal() {
  console.log(`Comprobando ${BASE}${SHA ? ` (commit ${SHA.slice(0, 7)})` : ""}`);
  console.log("");

  if (SHA) await esperarAlDespliegue(SHA);

  /* Lo que se rompió, primero */
  await laEscrituraLlega(BASE, "el dominio de siempre");
  await laEscrituraLlega(CON_WWW, "el dominio con www");

  /* El directo, de punta a punta */
  await contesta("/api/directo", (d) => (Array.isArray(d.directos) ? null : "no trae la lista de directos"));
  await contesta("/api/directo/archivo?equipos=primer-equipo", (d) =>
    d.porEquipo && Array.isArray(d.porEquipo["primer-equipo"]) ? null : "no trae las fechas del equipo",
  );

  /* Lo que usa la gente */
  await responde("/");
  await responde("/equipos");
  await responde("/equipos/primer-equipo");
  await responde("/noticias");
  await responde("/instalar");
  await responde("/panel");

  /* La aplicación instalada y los buscadores */
  await responde("/manifest.webmanifest");
  await responde("/sw.js");
  await responde("/sitemap.xml");
  await responde("/robots.txt");

  console.log("");
  console.log(fallos === 0 ? "La web publicada responde a todo." : `${fallos} comprobaciones fallan en la web publicada.`);

  if (fallos > 0 && process.env.RESEND_API_KEY && process.env.AVISO_CORREO_A) {
    await avisarPorCorreo(
      `La web falla ${fallos} comprobaciones tras desplegar`,
      `Comprobado ${BASE}${SHA ? ` con el commit ${SHA}` : ""}.\n\n${lineas.join("\n")}\n`,
    );
  }

  process.exit(fallos === 0 ? 0 : 1);
}

/** Mismo correo que usa el panel, aquí sin poder importar TypeScript. */
async function avisarPorCorreo(asunto, texto) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AVISO_CORREO_DE || "AD Taraguilla <onboarding@resend.dev>",
        to: process.env.AVISO_CORREO_A.split(",").map((d) => d.trim()).filter(Boolean),
        subject: asunto,
        text: texto,
      }),
    });
    console.log(r.ok ? "Aviso por correo mandado." : `El aviso por correo no salió (${r.status}).`);
  } catch (e) {
    console.log(`El aviso por correo no salió (${e.message}).`);
  }
}

await principal();
