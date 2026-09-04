/**
 * El identificador de la retransmisión de un partido.
 *
 * Un equipo juega un partido al día, así que `<equipo>-<fecha>` lo identifica
 * sin más. Vive aquí, y no repetido en cada sitio que lo compone, porque de él
 * depende que la tarjeta de un partido enseñe **su** marcador y no el de otro:
 * un amistoso o la jornada anterior sin cerrar pintarían su resultado debajo de
 * los escudos equivocados si esto se calculara de dos maneras distintas.
 *
 * Sin fecha no hay identificador: un partido sin fijar no puede tener
 * retransmisión.
 */
export function idPartido(equipo: string, fecha: string | null | undefined): string | null {
  return fecha ? `${equipo}-${fecha}` : null;
}
