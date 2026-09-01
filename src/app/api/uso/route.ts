import { leerPrivado, escribirPrivado } from "@/lib/privado";

/**
 * Cuenta cuánta gente usa la web y cuánta la tiene instalada como aplicación.
 *
 * La analítica de Vercel ya cuenta visitas, páginas y dispositivos, pero en el
 * plan gratuito no admite eventos propios, y "abrió la aplicación instalada"
 * es justo un evento propio. Así que ese dato se lleva aquí.
 *
 * No se guarda nada de nadie: solo cuántas veces, qué día y de qué tipo. Ni
 * direcciones IP, ni identificadores, ni nada que permita seguir a una persona.
 */

type Recuento = Record<string, Record<string, number>>;

const rutaDelMes = (dia: string) => `uso/${dia.slice(0, 7)}.json`;

/** Solo se aceptan estas etiquetas: nada que venga de fuera se guarda tal cual. */
const MODOS = new Set(["app", "navegador"]);
const PLATAFORMAS = new Set(["ios", "android", "escritorio", "otro"]);

export const dynamic = "force-dynamic";

export async function POST(peticion: Request): Promise<Response> {
  let modo = "navegador";
  let plataforma = "otro";

  try {
    const cuerpo = (await peticion.json()) as { modo?: string; plataforma?: string };
    if (cuerpo.modo && MODOS.has(cuerpo.modo)) modo = cuerpo.modo;
    if (cuerpo.plataforma && PLATAFORMAS.has(cuerpo.plataforma)) plataforma = cuerpo.plataforma;
  } catch {
    // Cuerpo ilegible: se cuenta igual como visita de navegador
  }

  const dia = new Date().toISOString().slice(0, 10);
  const ruta = rutaDelMes(dia);

  /*
   * Leer, sumar y escribir. Con dos visitas exactamente a la vez podría
   * perderse un punto; para saber si la aplicación la usan cinco personas o
   * cincuenta, da igual. No merece una base de datos.
   */
  const recuento = await leerPrivado<Recuento>(ruta, {});
  const delDia = recuento[dia] ?? {};
  delDia[modo] = (delDia[modo] ?? 0) + 1;
  delDia[`${modo}-${plataforma}`] = (delDia[`${modo}-${plataforma}`] ?? 0) + 1;
  recuento[dia] = delDia;

  await escribirPrivado(ruta, recuento);

  // Respuesta vacía: a quien lo llama no le interesa nada de vuelta
  return new Response(null, { status: 204 });
}
