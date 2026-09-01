/**
 * Prueba del reloj y del plegado de eventos del directo, sin red y sin
 * navegador.
 *
 * El marcador y el minuto de un partido en directo no se guardan: se calculan
 * a partir de lo que fue pasando. Esa cuenta es la pieza que más cara sale si
 * está mal —enseñaría un resultado falso en la web del club— y a la vez la
 * única que se puede comprobar sin montar nada. De ahí este archivo.
 *
 *   node scripts/directo/probar.mjs
 *
 * Mismo espíritu que scripts/rfaf/probar.mjs: comprobar la lógica difícil
 * contra casos conocidos, sin depender de nada de fuera.
 */

import { plegar, minutoEn } from "../../src/lib/directo/modelo.ts";
import { minutosPorParte } from "../../src/lib/directo/reglamento.ts";
import { diasDeLaVentana, idsDeLaVentana } from "../../src/lib/directo/ventana.ts";
import { seVeEnElPanel } from "../../src/lib/directo/panel.ts";

const T0 = Date.parse("2026-09-06T12:00:00Z");
const min = (m) => T0 + m * 60_000;

let n = 0;
const id = () => `e${++n}`;

let fallos = 0;
function comprobar(que, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  const detalle = ok ? "" : `  (dio ${JSON.stringify(real)}, se esperaba ${JSON.stringify(esperado)})`;
  console.log(`${ok ? "ok   " : "FALLA"} ${que}${detalle}`);
}

/* ------------------------------------- la duración sale de la categoría */

comprobar("prebenjamin juega partes de 25", minutosPorParte("2ª ANDALUZA PREBENJAMIN"), 25);
comprobar("benjamin, de 30", minutosPorParte("2ª ANDALUZA BENJAMIN"), 30);
comprobar("alevin, de 35", minutosPorParte("3ª ANDALUZA ALEVIN"), 35);
comprobar("infantil, de 40", minutosPorParte("1ª ANDALUZA INFANTIL"), 40);
comprobar("cadete, de 45", minutosPorParte("3ª ANDALUZA CADETE"), 45);
comprobar("juvenil, de 45", minutosPorParte("4ª ANDALUZA JUVENIL"), 45);
comprobar("senior, de 45", minutosPorParte("1ª ANDALUZA SENIOR"), 45);
// "PREBENJAMIN" contiene "BENJAMIN": si se comprobara al reves, 30 en vez de 25
comprobar("prebenjamin no se confunde con benjamin", minutosPorParte("PREBENJAMIN") !== minutosPorParte("BENJAMIN"), true);
comprobar("una competicion desconocida cae en 45", minutosPorParte("COPA DE ALGO"), 45);

/*
 * Ninguno de los dos textos es fiable por separado: hay competiciones que no
 * nombran la categoria ("Copa Andalucia Senior", "1a Andaluza Infantil
 * Fundacion Cajasol"), y por eso manda el campo categoria del equipo.
 */
comprobar("manda la categoria del equipo, no la copa que juegue", minutosPorParte("2ª ANDALUZA BENJAMIN", "Copa Federacion"), 30);
comprobar("si no hay categoria, se mira la competicion", minutosPorParte(null, "Copa Andalucia Senior"), 45);
comprobar("si no se reconoce nada, 45", minutosPorParte("", "Copa Federacion"), 45);

/* ------------------- que retransmisiones se buscan, y cuales no */

/*
 * El servidor va en UTC y España no. A las 00:30 del domingo en Madrid son
 * las 22:30 del sabado en el servidor: si se mirara un solo dia, el partido
 * del sabado por la noche desapareceria a mitad de la segunda parte.
 */
const nocheDelSabado = diasDeLaVentana(new Date("2026-09-06T22:30:00Z"));
comprobar("la ventana cubre ayer, hoy y mañana en hora española", nocheDelSabado, [
  "2026-09-06", "2026-09-07", "2026-09-08",
]);

const guardadas = [
  "directo/primer-equipo-2026-09-06.json",
  "directo/juvenil-2026-09-06.json",
  "directo/cadete-2026-03-01.json",   // de marzo: ni se lee
];
comprobar(
  "solo se leen las retransmisiones de estos dias",
  idsDeLaVentana(guardadas, nocheDelSabado),
  ["primer-equipo-2026-09-06", "juvenil-2026-09-06"],
);
comprobar("y ninguna si no hay nada de estos dias", idsDeLaVentana(guardadas, ["2026-12-25"]), []);

/* ---------------------------- que sale en el panel de directos */

comprobar("un partido sin abrir se ve", seVeEnElPanel("sin-abrir", "2026-09-06", "2026-09-01"), true);
comprobar("uno en directo, tambien", seVeEnElPanel("en-directo", "2026-09-01", "2026-09-01"), true);
comprobar("recien terminado, tambien: aun se puede rematar", seVeEnElPanel("terminada", "2026-09-01", "2026-09-01"), true);

/*
 * Y la trampa que costo encontrar: si una prueba deja cerrada la retransmision
 * de un partido que aun no se ha jugado, esconderlo del panel dejaria al club
 * sin forma de abrirlo el dia del partido.
 */
comprobar("cerrada, pero el partido es el sabado: se ve igual", seVeEnElPanel("caducada", "2026-09-06", "2026-09-01"), true);
comprobar("cerrada y es hoy: se ve, por si hay que rehacerla", seVeEnElPanel("caducada", "2026-09-01", "2026-09-01"), true);
comprobar("cerrada y el partido ya paso: fuera del panel", seVeEnElPanel("caducada", "2026-08-30", "2026-09-01"), false);
comprobar("sin fecha no se esconde nunca", seVeEnElPanel("caducada", null, "2026-09-01"), true);

/* ---------------------------- un senior con descuentos en las dos partes */

const senior = [
  { id: id(), ts: min(0), tipo: "inicio" },
  { id: id(), ts: min(6), tipo: "gol", equipo: "visitante" },
  { id: id(), ts: min(9), tipo: "tarjeta", equipo: "local", color: "amarilla" },
  { id: id(), ts: min(15), tipo: "parar" },        // lesion: 4 minutos
  { id: id(), ts: min(19), tipo: "reanudar" },
  { id: id(), ts: min(50), tipo: "gol", equipo: "local" },  // 46' jugados: descuento
  { id: id(), ts: min(52), tipo: "finParte" },
  { id: id(), ts: min(67), tipo: "empezarParte" }, // 15 minutos de descanso
  { id: id(), ts: min(80), tipo: "gol", equipo: "local" },  // 13' de la 2a: 58'
  { id: id(), ts: min(115), tipo: "final" },
];

const e = plegar(senior, 45);
comprobar("el marcador sale de sumar los goles", e.goles, { local: 2, visitante: 1 });
comprobar("termina en fase final", e.fase, "final");
comprobar("cuenta dos partes", e.parte, 2);
comprobar("el gol del minuto 6 es el 6", e.linea[1].minuto.etiqueta, "6'");
comprobar("los 4 minutos parados no cuentan", e.linea[5].minuto.valor, 46);
comprobar("y pasado el 45 se enseña con los minutos de mas", e.linea[5].minuto.etiqueta, "45+1");
comprobar("el fin de la 1a parte tambien es descuento", e.linea[6].minuto.etiqueta, "45+3");

/*
 * Lo que pidio el club: la 2a parte NO sigue donde quedo la 1a. Empieza en el
 * minuto que le toca por categoria, porque si no los descuentos de la primera
 * desplazarian toda la segunda.
 */
comprobar("la 2a parte del senior arranca en el 45", e.linea[7].minuto.etiqueta, "45'");
comprobar("y no donde acabo la primera", e.linea[7].minuto.valor !== e.linea[6].minuto.valor, true);
comprobar("los 15 minutos de descanso no cuentan", e.linea[8].minuto.etiqueta, "58'");
comprobar("el final, pasado el 90, es descuento", e.linea[9].minuto.etiqueta, "90+3");
comprobar("al final el reloj queda detenido", e.corriendoDesde, null);

/* ------------------------------ cada categoria arranca donde le toca */

const arranqueDeLaSegunda = (minutos) => {
  const partido = plegar(
    [
      { id: "a", ts: min(0), tipo: "inicio" },
      { id: "b", ts: min(50), tipo: "finParte" },
      { id: "c", ts: min(60), tipo: "empezarParte" },
    ],
    minutos,
  );
  return partido.linea[2].minuto.etiqueta;
};

comprobar("la 2a del prebenjamin empieza en el 25", arranqueDeLaSegunda(25), "25'");
comprobar("la 2a del benjamin, en el 30", arranqueDeLaSegunda(30), "30'");
comprobar("la 2a del alevin, en el 35", arranqueDeLaSegunda(35), "35'");
comprobar("la 2a del infantil, en el 40", arranqueDeLaSegunda(40), "40'");

/* Una categoria con tres tiempos sigue cuadrando: 25, 50, 75 */
const tresTiempos = plegar(
  [
    { id: "a", ts: min(0), tipo: "inicio" },
    { id: "b", ts: min(26), tipo: "finParte" },
    { id: "c", ts: min(31), tipo: "empezarParte" },
    { id: "d", ts: min(58), tipo: "finParte" },
    { id: "e", ts: min(63), tipo: "empezarParte" },
  ],
  25,
);
comprobar("con tres tiempos, el tercero empieza en el 50", tresTiempos.linea[4].minuto.etiqueta, "50'");

/* ------------------------------------------- el reloj sigue corriendo */

const enJuego = plegar([{ id: "x", ts: T0, tipo: "inicio" }], 45);
comprobar("el reloj avanza con el tiempo", minutoEn(enJuego, min(37)).etiqueta, "37'");
comprobar("y entra en descuento pasado el limite", minutoEn(enJuego, min(46)).etiqueta, "45+1");
comprobar("y va contando: en el minuto 50 son cinco de descuento", minutoEn(enJuego, min(50)).etiqueta, "45+5");
comprobar("justo en el limite todavia no es descuento", minutoEn(enJuego, min(45)).etiqueta, "45'");
/*
 * El instante de cada evento lo pone el movil de quien escribe, y el "ahora"
 * lo pone cada espectador. Con que un reloj vaya unos segundos por detras la
 * resta sale negativa, y sin tope se veria un -1' justo al pitar el inicio.
 */
comprobar("un reloj algo atrasado no da minutos negativos", minutoEn(enJuego, T0 - 800).etiqueta, "0'");

/* ---------------------------------- robustez de la cola sin cobertura */

comprobar(
  "reenviar un gol no lo cuenta dos veces",
  plegar([...senior, senior[1]], 45).goles,
  { local: 2, visitante: 1 },
);

comprobar(
  "el orden de llegada da igual",
  plegar([...senior].reverse(), 45).linea.map((l) => l.minuto.etiqueta),
  e.linea.map((l) => l.minuto.etiqueta),
);

/* --------------------------------- corregir es añadir, no borrar */

const anulado = plegar(
  [...senior, { id: id(), ts: min(81), tipo: "anula", anulado: senior[8].id }],
  45,
);
comprobar("anular un gol lo quita del marcador", anulado.goles, { local: 1, visitante: 1 });
comprobar("y tambien de la cronologia", anulado.linea.length, e.linea.length - 1);

/*
 * El error mas probable de todos: dar a "Iniciar partido" mientras el equipo
 * calienta. Como el minuto se deriva y no se guarda, corregir el arranque
 * recoloca solo todo lo que ya se habia apuntado.
 */
const corregido = plegar(
  [
    { id: "arranque-malo", ts: min(-10), tipo: "inicio" },
    { id: id(), ts: min(-9), tipo: "texto", mensaje: "Calentando" },
    { id: id(), ts: min(0), tipo: "anula", anulado: "arranque-malo" },
    { id: id(), ts: min(0), tipo: "inicio" },
    { id: id(), ts: min(6), tipo: "gol", equipo: "local" },
  ],
  45,
);
comprobar("corregir el arranque recoloca los minutos", corregido.linea.at(-1).minuto.etiqueta, "6'");
comprobar("y el reloj corre desde el saque bueno", minutoEn(corregido, min(20)).etiqueta, "20'");

console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobaciones fallan.`);
process.exit(fallos === 0 ? 0 : 1);
