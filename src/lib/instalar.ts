/**
 * Dónde está mirando la web quien la visita, para poder explicarle cómo
 * instalarla.
 *
 * El motivo de que esto exista: el club comparte los enlaces por Instagram y
 * Facebook, y esas apps abren la web en **su propio navegador**, que no tiene
 * «Añadir a pantalla de inicio». A quien llega por ahí no se le puede explicar
 * cómo instalarla, porque desde ahí no se puede: primero hay que decirle cómo
 * salir a Safari o a Chrome. Decirle «pulsa Compartir» y que no encuentre la
 * opción es lo que más quejas ha dado.
 *
 * En iPhone, además, solo Safari instala. Chrome, Firefox y Edge en iPhone son
 * Safari por dentro, pero la opción no está donde la gente la busca, así que a
 * todos se les manda a Safari, que es la única explicación que siempre vale.
 *
 * Sin dependencias y sin tocar `navigator`: recibe el texto del navegador y
 * devuelve datos. Así se prueba con `node scripts/panel/probar.mjs`.
 */

export type Sistema = "ios" | "android" | "escritorio";

/** Dónde se está viendo la web. */
export type Donde =
  /** Safari en iPhone o iPad: aquí se instala. */
  | "safari"
  /** Chrome, Firefox o Edge en iPhone: hay que pasar por Safari. */
  | "otro-navegador-ios"
  /** Chrome y compañía en Android: instala solo, con su propio diálogo. */
  | "navegador-android"
  /** Dentro de Instagram, Facebook… : desde aquí no se puede instalar. */
  | "dentro-de-una-app"
  /** Ordenador, o algo que no sabemos reconocer. */
  | "otro";

export type Entorno = {
  sistema: Sistema;
  donde: Donde;
  /** Nombre de la app que se ha tragado la web, para poder nombrarla. */
  app: string | null;
  /** ¿Se puede añadir a la pantalla de inicio desde aquí? */
  seInstalaAqui: boolean;
};

/**
 * Apps que abren los enlaces dentro de sí mismas. El orden importa poco, pero
 * Instagram y Facebook van primero por ser de donde viene casi todo el tráfico.
 */
const APPS: { nombre: string; marca: RegExp }[] = [
  { nombre: "Instagram", marca: /instagram/i },
  { nombre: "Facebook", marca: /\bFBAN\b|\bFBAV\b|FB_IAB|FB4A/ },
  { nombre: "Messenger", marca: /\bFBMD\b|Messenger/i },
  { nombre: "TikTok", marca: /musical_ly|BytedanceWebview|TikTok/i },
  { nombre: "WhatsApp", marca: /whatsapp/i },
  { nombre: "Telegram", marca: /telegram/i },
  { nombre: "X", marca: /twitter/i },
  { nombre: "LinkedIn", marca: /LinkedInApp/i },
  { nombre: "la app de Google", marca: /\bGSA\b/ },
];

/** Chrome, Firefox y Edge en iPhone se anuncian así. */
const OTROS_EN_IOS = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/;

/**
 * El entorno, a partir del texto que se identifica el navegador.
 *
 * `macConTactil` distingue un iPad de un Mac: iPadOS se presenta como un Mac de
 * escritorio, y solo se delata por tener pantalla táctil.
 */
export function entornoDe(userAgent: string, macConTactil = false): Entorno {
  const ua = userAgent ?? "";

  const app = APPS.find((a) => a.marca.test(ua))?.nombre ?? null;

  const esIOS = /iphone|ipad|ipod/i.test(ua) || (macConTactil && /macintosh/i.test(ua));
  const esAndroid = /android/i.test(ua);
  const sistema: Sistema = esIOS ? "ios" : esAndroid ? "android" : "escritorio";

  if (app) {
    return { sistema, donde: "dentro-de-una-app", app, seInstalaAqui: false };
  }

  if (esIOS) {
    const enSafari = !OTROS_EN_IOS.test(ua);
    return {
      sistema,
      donde: enSafari ? "safari" : "otro-navegador-ios",
      app: null,
      seInstalaAqui: enSafari,
    };
  }

  if (esAndroid) {
    return { sistema, donde: "navegador-android", app: null, seInstalaAqui: true };
  }

  return { sistema, donde: "otro", app: null, seInstalaAqui: false };
}

/** Cómo salir de la app a un navegador de verdad, contado en una frase. */
export function comoSalirDeLaApp(app: string | null, sistema: Sistema): string {
  const navegador = sistema === "ios" ? "Safari" : "Chrome";
  const donde = app ?? "esta app";

  /* El menú de los tres puntos está arriba a la derecha en Instagram y
     Facebook, que son los dos casos que de verdad se dan */
  return `Estás viendo la web dentro de ${donde}, y desde aquí no se puede instalar. Pulsa los tres puntos (⋯) de la esquina y elige «Abrir en ${navegador}».`;
}
