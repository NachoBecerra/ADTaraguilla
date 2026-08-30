import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ESTADO, origenPublico } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paso 1 del login del panel /admin.
 * Decap CMS abre esta ruta en una ventana emergente; aquí redirigimos a GitHub.
 */
export function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new NextResponse(
      "Falta la variable de entorno GITHUB_CLIENT_ID. Revisa el README.",
      { status: 500 },
    );
  }

  const origen = origenPublico(req);
  const estado = randomBytes(16).toString("hex");

  const destino = new URL("https://github.com/login/oauth/authorize");
  destino.searchParams.set("client_id", clientId);
  destino.searchParams.set("redirect_uri", `${origen}/api/callback`);
  destino.searchParams.set("scope", req.nextUrl.searchParams.get("scope") || "repo,user");
  destino.searchParams.set("state", estado);

  const respuesta = NextResponse.redirect(destino);
  // El estado viaja en cookie para verificarlo al volver de GitHub (anti-CSRF).
  respuesta.cookies.set(COOKIE_ESTADO, estado, {
    httpOnly: true,
    sameSite: "lax",
    secure: origen.startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
  return respuesta;
}
