import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ESTADO, paginaPuente } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(cuerpo: string, status = 200) {
  return new NextResponse(cuerpo, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Paso 2 del login del panel /admin.
 * GitHub nos devuelve un `code`; lo canjeamos por un token y se lo entregamos
 * a Decap CMS mediante postMessage.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return html(paginaPuente("error", "Faltan las credenciales de GitHub"), 500);
  }

  const code = req.nextUrl.searchParams.get("code");
  const estado = req.nextUrl.searchParams.get("state");
  const estadoCookie = req.cookies.get(COOKIE_ESTADO)?.value;

  if (!code) {
    return html(paginaPuente("error", "GitHub no devolvió el código"), 400);
  }
  if (!estado || !estadoCookie || estado !== estadoCookie) {
    return html(paginaPuente("error", "Estado de autenticación no válido"), 400);
  }

  const respuesta = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  const datos = (await respuesta.json()) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };

  if (!datos.access_token) {
    return html(
      paginaPuente("error", datos.error_description || datos.error || "Sin token"),
      401,
    );
  }

  const salida = html(
    paginaPuente("success", { token: datos.access_token, provider: "github" }),
  );
  salida.cookies.delete(COOKIE_ESTADO);
  return salida;
}
