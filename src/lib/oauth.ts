import type { NextRequest } from "next/server";

export const COOKIE_ESTADO = "decap_oauth_state";

/**
 * Origen público de la web. Detrás de un proxy (Vercel, Netlify) `req.nextUrl`
 * puede apuntar al host interno, así que damos prioridad a la variable de
 * entorno y luego a las cabeceras reenviadas.
 */
export function origenPublico(req: NextRequest): string {
  const configurado = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurado) return configurado.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  return req.nextUrl.origin;
}

/**
 * Página que devuelve el token a Decap CMS.
 * Decap escucha un `postMessage` en la ventana que abrió la emergente: primero
 * anunciamos `authorizing:github` y, cuando el panel responde, le mandamos el
 * token al origen exacto desde el que contestó.
 */
export function paginaPuente(
  resultado: "success" | "error",
  contenido: Record<string, unknown> | string,
): string {
  // En éxito Decap espera un JSON; en error, texto plano.
  const carga =
    typeof contenido === "string" ? contenido : JSON.stringify(contenido);

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Autenticando…</title></head>
<body style="font-family:system-ui;background:#0b0d10;color:#eef2f6;display:grid;place-items:center;height:100vh;margin:0">
<p>Conectando con GitHub…</p>
<script>
  (function () {
    var mensaje = 'authorization:github:${resultado}:' + ${JSON.stringify(carga)};
    function alRecibir(e) {
      if (!e.data || String(e.data).indexOf('authorizing:github') !== 0) return;
      window.removeEventListener('message', alRecibir, false);
      e.source.postMessage(mensaje, e.origin);
    }
    window.addEventListener('message', alRecibir, false);
    if (window.opener) {
      window.opener.postMessage('authorizing:github', '*');
    } else {
      document.body.innerHTML = '<p>Abre el panel desde /admin.</p>';
    }
  })();
</script>
</body></html>`;
}
