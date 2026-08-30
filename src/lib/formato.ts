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
