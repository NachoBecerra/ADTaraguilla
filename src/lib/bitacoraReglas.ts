/**
 * Las reglas del historial del club, sin tocar el almacén.
 *
 * Aparte del resto para poder probarlas con `node scripts/panel/probar.mjs`:
 * lo que lee y escribe vive en `bitacora.ts`, que sí necesita el almacén
 * privado y no se puede ejecutar fuera de la web.
 */

export type Area = "noticias" | "galeria" | "directo" | "panel" | "rfaf";
export type Quien = "panel" | "campo" | "bot";

export type Apunte = {
  /** Instante, en milisegundos. */
  ts: number;
  area: Area;
  /** Qué pasó, en tres palabras: «Noticia publicada», «Directo abierto». */
  accion: string;
  /** De qué, con nombre y apellidos: el título, el partido, el equipo. */
  detalle?: string;
  ok: boolean;
  quien: Quien;
};

/**
 * Tope por mes.
 *
 * Un mes movido del club son unos cientos de apuntes. El tope está para que un
 * bucle inesperado no engorde el archivo sin freno: al pasarse, se tiran los
 * más viejos, que son los que menos falta hacen.
 */
export const MAX_POR_MES = 3000;

/** El mes al que pertenece un instante, en hora española. */
export function mesDe(ts: number): string {
  const madrid = new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  return madrid.slice(0, 7);
}

/** Se quedan los últimos: si hay que tirar algo, que sea lo viejo. */
export function recortar(apuntes: Apunte[], max: number = MAX_POR_MES): Apunte[] {
  return apuntes.length <= max ? apuntes : apuntes.slice(apuntes.length - max);
}

/** Los apuntes agrupados por día, del más reciente al más antiguo. */
export function porDias(apuntes: Apunte[]): { dia: string; apuntes: Apunte[] }[] {
  const dias = new Map<string, Apunte[]>();

  for (const a of [...apuntes].sort((x, y) => y.ts - x.ts)) {
    const dia = new Date(a.ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const lista = dias.get(dia);
    if (lista) lista.push(a);
    else dias.set(dia, [a]);
  }

  return [...dias.entries()].map(([dia, suyos]) => ({ dia, apuntes: suyos }));
}
