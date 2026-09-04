/**
 * Cambiar las fotos de un grupo de la galería.
 *
 * Se hace desde tres sitios —la galería al añadir, la galería al quitar y el
 * editor de noticias, que hace las dos cosas a la vez— y en los tres hay que
 * acertar en lo mismo: no duplicar una foto que ya estaba, decir qué archivos
 * quedan huérfanos para poder borrarlos, y quitar de en medio el grupo que se
 * queda sin ninguna.
 *
 * Vive aparte, sin depender de nada, para poder comprobarlo con
 * `node scripts/panel/probar.mjs`: guardar de verdad necesita GitHub y el
 * almacenamiento, pero equivocarse aquí sí se puede ver sin ellos.
 */

/** Una foto guardada: la URL en el almacenamiento y sus medidas reales. */
export type Foto = { url: string; ancho: number; alto: number };

export type Entrada = {
  id: string;
  titulo: string;
  albumes: string[];
  /** Equipos a los que pertenece, por identificador. */
  equipos: string[];
  fecha: string;
  fotos: Foto[];
};

export type Cambio = {
  /** Fotos ya subidas al almacenamiento que se suman al grupo. */
  anadir?: Foto[];
  /** URLs de fotos del grupo que dejan de estar. */
  quitar?: string[];
};

export type Resultado = {
  items: Entrada[];
  /** Fotos que ya no usa nadie: sus archivos se pueden borrar. */
  huerfanas: string[];
  /**
   * El grupo después del cambio, o cadena vacía si se ha quedado sin fotos y
   * ha desaparecido. Quien lo apuntaba —una noticia— tiene que dejar de
   * hacerlo: un identificador que ya no existe no lleva a ninguna parte.
   */
  id: string;
  /** Cuántas se han sumado de verdad, sin contar las que ya estaban. */
  anadidas: number;
  quitadas: number;
};

/**
 * Aplica el cambio al grupo indicado. No toca el original.
 *
 * Si el grupo no existe no hace nada: es lo que pasa cuando alguien tenía el
 * editor abierto y entretanto el grupo se ha eliminado desde otro sitio.
 */
export function aplicarFotos(items: Entrada[], id: string, cambio: Cambio): Resultado {
  const entrada = items.find((e) => e.id === id);
  if (!entrada) return { items, huerfanas: [], id: "", anadidas: 0, quitadas: 0 };

  const fuera = new Set(cambio.quitar ?? []);
  const quedan = entrada.fotos.filter((f) => !fuera.has(f.url));
  const huerfanas = entrada.fotos.filter((f) => fuera.has(f.url)).map((f) => f.url);

  /* Guardar dos veces la misma tanda —al recargar, o con la conexión del campo
     yendo y viniendo— duplicaría las fotos en la galería */
  const yaEstan = new Set(quedan.map((f) => f.url));
  const suman: Foto[] = [];
  for (const f of cambio.anadir ?? []) {
    if (yaEstan.has(f.url)) continue;
    yaEstan.add(f.url);
    suman.push(f);
  }

  const fotos = [...quedan, ...suman];
  const cuenta = { anadidas: suman.length, quitadas: huerfanas.length };

  // Un grupo sin fotos ya no pinta nada en la galería
  if (fotos.length === 0) {
    return { items: items.filter((e) => e.id !== id), huerfanas, id: "", ...cuenta };
  }

  return {
    items: items.map((e) => (e.id === id ? { ...e, fotos } : e)),
    huerfanas,
    id,
    ...cuenta,
  };
}

export function aSlug(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "foto"
  );
}

/**
 * Da a cada grupo un identificador propio.
 *
 * Es lo que permite editar y borrar sin depender de la posición, y hay dos
 * maneras de quedarse sin él. Los grupos antiguos podían no traerlo: para esos
 * se inventa uno con el título. Y los podía haber **repetidos**, que es peor y
 * pasaba de verdad: como se busca con `find`, todas las acciones caían siempre
 * en el primero y el segundo no había forma de tocarlo ni de quitarlo.
 *
 * El segundo con el mismo identificador pasa a ser `<id>-2`, el tercero `-3`.
 * Se cuenta por repetición y no por posición para que añadir un grupo nuevo
 * —que se pone el primero— no le cambie el identificador a los de abajo.
 *
 * Lo llaman los dos que leen el archivo. Tienen que coincidir: si el panel
 * enseñara un identificador y quien guarda calculara otro, editar contestaría
 * que el grupo ya no existe.
 */
export function conIdUnico<T extends { id?: string; titulo?: string }>(
  items: T[],
): (T & { id: string })[] {
  const vistos = new Map<string, number>();
  return items.map((e, i) => {
    const base = e.id || `${aSlug(e.titulo ?? "foto")}-${i}`;
    const veces = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, veces);
    return { ...e, id: veces === 1 ? base : `${base}-${veces}` };
  });
}
