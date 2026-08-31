const ZONA = "Europe/Madrid";

export function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONA,
  }).format(new Date(iso));
}

export function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    timeZone: ZONA,
  }).format(new Date(iso));
}

/**
 * Fecha de partido: "dom 6 sept".
 *
 * El día de la semana es lo primero que se mira en un calendario de fútbol,
 * y el año sobra porque siempre es el de la temporada en curso. Se quitan la
 * coma y los puntos que mete el formato del sistema, que aquí solo estorban.
 */
export function fechaPartido(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: ZONA,
  })
    .format(new Date(iso))
    .replace(/[.,]/g, "");
}

export function diaYHora(iso: string): { dia: string; hora: string } {
  const d = new Date(iso);
  return {
    dia: new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: ZONA,
    }).format(d),
    hora: new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: ZONA,
    }).format(d),
  };
}
