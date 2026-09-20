/* Por el depósito y no por el almacén a secas: así en local, sin secretos,
   el historial se guarda en disco y la pantalla se comporta igual que en
   producción. Es la misma regla que sigue el resto del directo. */
import { leerJson, escribirJson, listarJson } from "@/lib/directo/deposito";
import { mesDe, recortar, type Apunte, type Area, type Quien } from "@/lib/bitacoraReglas";

/**
 * El historial de lo que se hace con los datos del club.
 *
 * Qué se publicó, qué se borró, quién abrió una retransmisión y cuándo, y
 * también **lo que salió mal**. Hasta ahora eso solo existía repartido: los
 * commits del bot en el repositorio, un mensaje verde o rojo que el panel
 * enseñaba un segundo y nada más, y los directos, en ningún sitio.
 *
 * Nace de un sábado en que se narró un partido entero sin que se guardara nada
 * y no había dónde mirarlo. Con esto, cuando algo no cuadre, se mira una
 * pantalla en vez de reconstruirlo a base de preguntar.
 *
 * Un mes por archivo en el almacén privado. Apuntar nunca puede tumbar lo que
 * se estaba haciendo: si falla, se queda en el log del servidor y ya está.
 */

export type { Area, Quien, Apunte } from "@/lib/bitacoraReglas";

const rutaDelMes = (mes: string) => `bitacora/${mes}.json`;

/** Apunta una línea. Nunca lanza: esto no puede romper lo que estaba pasando. */
export async function apuntar(entrada: Omit<Apunte, "ts">): Promise<void> {
  const apunte: Apunte = { ...entrada, ts: Date.now() };

  try {
    const ruta = rutaDelMes(mesDe(apunte.ts));
    const previos = await leerJson<Apunte[]>(ruta, []);
    await escribirJson(ruta, recortar([...previos, apunte]));
  } catch (e) {
    console.warn(`Bitácora sin apuntar (${(e as Error).message}):`, apunte.accion, apunte.detalle);
  }
}

/**
 * Apunta lo que ha pasado y devuelve el resultado tal cual.
 *
 * Se usa envolviendo el `return` de una acción del panel, para que apuntar sea
 * una línea y no un bloque, y para que nunca se apunte un éxito que en
 * realidad falló: el `ok` sale del propio resultado.
 */
export async function anotar<R extends { ok: boolean; mensaje?: string }>(
  info: { area: Area; accion: string; detalle?: string; quien?: Quien },
  resultado: R,
): Promise<R> {
  await apuntar({
    area: info.area,
    accion: info.accion,
    // Cuando algo falla, lo que hay que leer luego es el motivo
    detalle: resultado.ok ? info.detalle : [info.detalle, resultado.mensaje].filter(Boolean).join(" — "),
    ok: resultado.ok,
    quien: info.quien ?? "panel",
  });

  return resultado;
}

/** Lo apuntado en los últimos meses, de lo más reciente a lo más antiguo. */
export async function leerBitacora(meses = 3): Promise<Apunte[]> {
  const guardados = await listarJson("bitacora");
  const quiero = guardados
    .map((r) => r.replace(/^bitacora\//, "").replace(/\.json$/, ""))
    .sort()
    .slice(-meses);

  const todos: Apunte[] = [];
  for (const mes of quiero) {
    todos.push(...(await leerJson<Apunte[]>(rutaDelMes(mes), [])));
  }

  return todos.sort((a, b) => b.ts - a.ts);
}
