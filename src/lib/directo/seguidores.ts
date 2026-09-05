import { almacenEnDisco, borrarJson, crearJson, listarJson } from "@/lib/directo/deposito";
import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Cuánta gente ha seguido un partido.
 *
 * **Un archivo por visita, no una lista común.** Es el mismo motivo por el que
 * las suscripciones a los avisos se guardan una por archivo: con una lista, dos
 * personas entrando a la vez leen lo mismo, cada una añade lo suyo y la segunda
 * escritura borra a la primera. Y así es exactamente como llega la gente a un
 * directo —de golpe, después de mandar el enlace por WhatsApp—, así que no sería
 * perder una visita suelta: sería perder la mitad.
 *
 * Se guarda **aparte del partido** y no dentro de su registro. El registro es la
 * verdad del encuentro y lo escribe quien está en el campo: meter ahí las
 * visitas sería arriesgarse a que una visita y un gol llegaran a la vez y se
 * perdiera el gol. Además, cada visita cambiaría la versión del registro y
 * echaría por tierra el ETag, que es lo que hace barato preguntar cada cinco
 * segundos.
 *
 * **El identificador es de un partido, no de una persona.** Cada navegador se
 * inventa uno nuevo para cada encuentro, así que sirve para no contar dos veces
 * a quien recarga y no sirve para seguir a nadie de un partido al siguiente. Es
 * lo mínimo que hace falta para dar una cifra, sin guardar nada de nadie.
 */

const carpeta = (partido: string) => `directo/seguidores/${partido}`;

/**
 * Contar es listar, y listar es de las operaciones caras del almacén.
 *
 * La cuenta se guarda hasta que llega alguien nuevo, que es justo cuando
 * cambia: mientras solo entra gente que ya estaba, se sirve lo guardado y no se
 * toca el almacén. Sin esto, cada pantalla abierta preguntaba la cifra dos
 * veces por minuto y cada pregunta era un listado.
 */
const etiqueta = (partido: string) => `seguidores-${partido}`;

/** Red de seguridad, por si algún día se colara un cambio sin avisar. */
const VIGENCIA_S = 30 * 60;

/**
 * Tira la cuenta guardada de este partido.
 *
 * En disco no hay nada guardado que tirar, y pedirlo igualmente le da un repaso
 * de más al router de Next en desarrollo.
 */
function olvidarCuenta(partido: string): void {
  if (almacenEnDisco) return;
  try {
    revalidateTag(etiqueta(partido), { expire: 0 });
  } catch {
    // Fuera de una acción no se puede, y la cifra se pondrá al día sola
  }
}

/**
 * Si se cuentan las visitas.
 *
 * **Apagado a propósito, y esto se vuelve a encender.** Anotar una visita
 * cuesta una escritura en el almacén, y una escritura es de las operaciones que
 * Vercel cuenta como avanzadas: el plan gratuito trae 2.000 al mes. Un partido
 * con doscientas personas son doscientas escrituras, y el mes en curso llegó al
 * 6 de septiembre de 2026 con unas 280 libres. Pasarse no es pagar de más: es
 * quedarse **treinta días sin almacén**, o sea sin directo, sin panel y sin
 * fotos.
 *
 * Así que la cifra de seguidores se queda fuera del primer partido del senior
 * para que el partido salga. En cuanto el ciclo se reinicie se pone en `true`:
 * con el conteo puesto al día por vigencia y no por visita, un partido de
 * doscientas personas cuesta unas doscientas operaciones, un 10% del mes.
 */
const CONTAR_SEGUIDORES = false;

/**
 * Tope de visitas anotadas.
 *
 * Pasado eso el número se queda quieto. Un partido de este club no va a
 * acercarse ni de lejos, pero una carpeta sin límite es una carpeta que algún
 * día crece sin control.
 */
const MAXIMO = 5000;

const contar = (partido: string) => listarJson(carpeta(partido)).then((r) => r.length);

/** Cuánta gente ha abierto este partido. */
export async function cuantosSiguen(partido: string): Promise<number> {
  /* Contra el disco no hay nada que ahorrar, y la caché despistaría a las
     pruebas, que borran la carpeta entre una y otra */
  if (almacenEnDisco) return contar(partido);

  return unstable_cache(() => contar(partido), ["seguidores", partido], {
    tags: [etiqueta(partido)],
    revalidate: VIGENCIA_S,
  })();
}

/**
 * Anota una visita y devuelve el total.
 *
 * **Crear-si-no-existe hace de todo**: es lo que evita contar dos veces a quien
 * recarga, y de paso deja que dos visitas simultáneas no se pisen, porque cada
 * una escribe su propio archivo. Antes se listaba la carpeta para comprobar si
 * la visita ya estaba; era un listado por cada pantalla que se abría, y no hacía
 * falta ninguno: si el archivo existe, la creación devuelve `false` y ya está.
 */
export async function anotarSeguidor(partido: string, id: string): Promise<number> {
  const antes = await cuantosSiguen(partido);
  if (!CONTAR_SEGUIDORES || antes >= MAXIMO) return antes;

  const nueva = await crearJson(`${carpeta(partido)}/${id}.json`, {
    visto: new Date().toISOString(),
  });
  if (!nueva) return antes; // ya estaba: es alguien que recarga

  /*
   * La cuenta guardada **no** se tira aquí, y es a propósito.
   *
   * Tirarla por cada persona que llega significa volver a listar la carpeta por
   * cada persona que llega, y listar es de las operaciones caras. Se deja que
   * caduque sola: la cifra va con retraso, y para un «lo siguieron 180
   * personas» eso no le importa a nadie. Lo que sí importaría es quedarse sin
   * almacén a mitad de partido.
   */
  return antes + 1;
}

/**
 * Borra la cuenta entera de un partido.
 *
 * Al eliminar un amistoso no puede quedarse su rastro de visitas rondando por
 * el almacén.
 */
export async function borrarSeguidores(partido: string): Promise<void> {
  const rutas = await listarJson(carpeta(partido));
  await Promise.all(rutas.map(borrarJson));

  /* Y la cuenta guardada, que si no seguiría dando el número de un partido
     que ya no existe */
  olvidarCuenta(partido);
}
