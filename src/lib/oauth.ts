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
  // Decap hace JSON.parse tanto del payload de éxito como del de error,
  // así que ambos van serializados.
  const carga = JSON.stringify(contenido);

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Autenticando…</title></head>
<body style="font-family:system-ui;background:#f6f8f4;color:#10180c;display:grid;place-items:center;height:100vh;margin:0">
<p>Conectando con GitHub…</p>
<script>
  (function () {
    var mensaje = 'authorization:github:${resultado}:' + ${JSON.stringify(carga)};

    function alRecibir(e) {
      // El token solo se entrega a la propia web, nunca a una página ajena
      // que haya abierto esta ventana para quedárselo.
      if (e.origin !== window.location.origin) return;
      if (String(e.data) !== 'authorizing:github') return;

      window.removeEventListener('message', alRecibir, false);
      e.source.postMessage(mensaje, e.origin);
    }

    window.addEventListener('message', alRecibir, false);

    if (window.opener) {
      // Decap responde con el mismo texto y entonces se le manda el token
      window.opener.postMessage('authorizing:github', window.location.origin);
    } else {
      document.body.innerHTML = '<p>Abre el panel desde /admin.</p>';
    }
  })();
</script>
</body></html>`;
}
