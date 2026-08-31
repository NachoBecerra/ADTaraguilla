/*
 * Service worker de la AD Taraguilla.
 *
 * Existe por un motivo concreto: al abrir la aplicación instalada justo
 * mientras se estaba desplegando, se quedaba clavada en la pantalla del
 * escudo sin llegar a entrar. Los fines de semana se despliega cada media
 * hora, así que tocaba a menudo.
 *
 * La regla es "la red primero, pero con reloj": se pide a la red y, si no
 * contesta en unos segundos, se abre con lo último que se vio. Nunca se
 * espera indefinidamente. Cuando la red va bien —que es casi siempre— se
 * enseña la versión recién desplegada, no la guardada.
 */

const CACHE = "taraguilla-v1";

/** Lo que se espera a la red antes de tirar de lo guardado. */
const ESPERA_MS = 5000;

/** Lo que nunca se guarda: sesión del panel y peticiones a la API. */
const PROHIBIDO = [/^\/api\//, /^\/panel(\/|$)/];

self.addEventListener("install", (evento) => {
  // La portada es la que abre la aplicación: conviene tenerla desde el principio
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add("/"))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Guarda una copia sin dejar que un fallo al guardar rompa la respuesta. */
async function guardar(peticion, respuesta) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(peticion, respuesta);
  } catch {
    // Cuota llena o respuesta no almacenable: da igual, es solo una copia
  }
}

/**
 * Pide a la red con reloj. Si tarda demasiado o falla, devuelve lo guardado.
 * La petición sigue su curso para dejar la copia al día de cara a la próxima.
 */
async function redConReloj(peticion) {
  const guardada = await caches.match(peticion);

  const red = fetch(peticion)
    .then((respuesta) => {
      if (respuesta && respuesta.ok) guardar(peticion, respuesta.clone());
      return respuesta;
    })
    .catch(() => null);

  const reloj = new Promise((res) => setTimeout(() => res(null), ESPERA_MS));
  const primera = await Promise.race([red, reloj]);

  if (primera && primera.ok) return primera;
  if (guardada) return guardada;

  // Sin copia previa: se espera a la red hasta donde llegue
  const tardia = await red;
  if (tardia) return tardia;

  return new Response(
    "<!doctype html><meta charset=utf-8><title>Sin conexión</title>" +
      "<body style='font-family:system-ui;padding:3rem 1.5rem;text-align:center'>" +
      "<h1>Sin conexión</h1><p>Vuelve a intentarlo cuando tengas cobertura.</p>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/** Para archivos con huella en el nombre: si está guardado, vale para siempre. */
async function primeroLoGuardado(peticion) {
  const guardada = await caches.match(peticion);
  if (guardada) return guardada;
  const respuesta = await fetch(peticion);
  if (respuesta && respuesta.ok) guardar(peticion, respuesta.clone());
  return respuesta;
}

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  const propio = url.origin === self.location.origin;

  if (propio && PROHIBIDO.some((p) => p.test(url.pathname))) return;

  // Páginas: es lo que deja la pantalla del escudo colgada si no contesta
  if (peticion.mode === "navigate") {
    evento.respondWith(redConReloj(peticion));
    return;
  }

  if (!propio) {
    // Las fotos del almacenamiento llevan un sufijo único: no cambian nunca
    if (/\.public\.blob\.vercel-storage\.com$/.test(url.hostname)) {
      evento.respondWith(primeroLoGuardado(peticion));
    }
    return;
  }

  // El código y las imágenes optimizadas llevan huella en la dirección
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image")) {
    evento.respondWith(primeroLoGuardado(peticion));
  }
});
