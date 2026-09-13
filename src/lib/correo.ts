/**
 * Correo al club, para avisos que no pueden esperar a que alguien mire.
 *
 * Por la API de Resend, con un `fetch` y sin dependencias. Solo manda si están
 * configuradas `RESEND_API_KEY` y `AVISO_CORREO_A`; sin ellas no falla nada:
 * lo que tuviera que avisarse queda en el log del servidor. Así la protección
 * que dispara el correo funciona igual aunque el correo no esté puesto.
 *
 * El remitente sale de `AVISO_CORREO_DE`. Sin un dominio verificado en Resend
 * solo se puede mandar desde su dirección de pruebas y a la cuenta dueña de la
 * clave, que para un aviso interno basta.
 */

const REMITENTE_DE_PRUEBAS = "AD Taraguilla <onboarding@resend.dev>";

export async function avisarPorCorreo(asunto: string, texto: string): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  const para = process.env.AVISO_CORREO_A;

  if (!clave || !para) {
    console.warn(`Aviso por correo sin mandar (falta RESEND_API_KEY o AVISO_CORREO_A): ${asunto}`);
    return false;
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.AVISO_CORREO_DE || REMITENTE_DE_PRUEBAS,
        to: para.split(",").map((d) => d.trim()).filter(Boolean),
        subject: asunto,
        text: texto,
      }),
    });
    if (!r.ok) {
      console.warn(`Aviso por correo rechazado (${r.status}): ${asunto}`);
      return false;
    }
    return true;
  } catch (e) {
    // Que falle el correo no puede tumbar lo que lo disparó
    console.warn(`Aviso por correo sin mandar (${(e as Error).message}): ${asunto}`);
    return false;
  }
}
