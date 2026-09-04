/**
 * Prueba de los cambios de fotos de un grupo de la galeria, sin red.
 *
 * Guardar de verdad necesita GitHub y el almacenamiento, asi que en local no se
 * puede comprobar el guardado entero. Pero la parte que se puede hacer mal en
 * silencio —duplicar una foto, dejar archivos sin borrar, o dejar una noticia
 * apuntando a un grupo que ya no existe— si se puede comprobar aqui.
 *
 *   node scripts/panel/probar.mjs
 */

import { aplicarFotos, conIdUnico } from "../../src/lib/panel/fotosDeEntrada.ts";
import galeriaReal from "../../src/data/galeria.json" with { type: "json" };

let fallos = 0;
function comprobar(que, real, esperado) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? "ok   " : "FALLA"} ${que}${ok ? "" : `\n      dio       ${JSON.stringify(real)}\n      se esperaba ${JSON.stringify(esperado)}`}`);
}

const foto = (n) => ({ url: `https://blob/${n}.jpg`, ancho: 1800, alto: 1200 });

const galeria = () => [
  { id: "otro", titulo: "Otro grupo", albumes: [], equipos: [], fecha: "2026-09-01", fotos: [foto("z")] },
  { id: "g1", titulo: "Amistoso", albumes: ["Cantera"], equipos: ["infantil-b"], fecha: "2026-09-03", fotos: [foto("a"), foto("b")] },
];

const urls = (items, id) => (items.find((e) => e.id === id)?.fotos ?? []).map((f) => f.url.split("/").pop());

/* ------------------------------------------------------------------ añadir */
console.log("--- Añadir fotos a un grupo ya publicado ---");
{
  const r = aplicarFotos(galeria(), "g1", { anadir: [foto("c")] });
  comprobar("la nueva se suma al final", urls(r.items, "g1"), ["a.jpg", "b.jpg", "c.jpg"]);
  comprobar("y cuenta como una", r.anadidas, 1);
  comprobar("sin tocar los demás grupos", urls(r.items, "otro"), ["z.jpg"]);
  comprobar("ni dejar archivos sueltos", r.huerfanas, []);
  comprobar("el grupo sigue siendo el mismo", r.id, "g1");
}
{
  /* Al recargar tras un guardado lento, o con la conexión del campo yendo y
     viniendo, la misma tanda puede llegar dos veces */
  const r = aplicarFotos(galeria(), "g1", { anadir: [foto("b"), foto("c")] });
  comprobar("una foto que ya estaba no se duplica", urls(r.items, "g1"), ["a.jpg", "b.jpg", "c.jpg"]);
  comprobar("y no se cuenta como añadida", r.anadidas, 1);
}
{
  const r = aplicarFotos(galeria(), "g1", { anadir: [] });
  comprobar("añadir nada no cambia nada", urls(r.items, "g1"), ["a.jpg", "b.jpg"]);
}

/* ------------------------------------------------------------------ quitar */
console.log("");
console.log("--- Quitar fotos ---");
{
  const r = aplicarFotos(galeria(), "g1", { quitar: ["https://blob/a.jpg"] });
  comprobar("la quitada desaparece", urls(r.items, "g1"), ["b.jpg"]);
  comprobar("y se dice qué archivo sobra, para poder borrarlo", r.huerfanas, ["https://blob/a.jpg"]);
  comprobar("el grupo sigue en pie", r.id, "g1");
}
{
  const r = aplicarFotos(galeria(), "g1", { quitar: ["https://blob/no-existe.jpg"] });
  comprobar("quitar una que no está no borra nada", r.huerfanas, []);
  comprobar("ni toca las que hay", urls(r.items, "g1"), ["a.jpg", "b.jpg"]);
}
{
  /* Lo importante: sin fotos, el grupo se va y quien lo apuntaba se entera */
  const r = aplicarFotos(galeria(), "g1", { quitar: ["https://blob/a.jpg", "https://blob/b.jpg"] });
  comprobar("quitadas todas, el grupo desaparece", r.items.map((e) => e.id), ["otro"]);
  comprobar("con sus dos archivos por borrar", r.huerfanas.length, 2);
  comprobar("y sin grupo al que apuntar", r.id, "");
}

/* --------------------------------------------------- sustituir: las dos cosas */
console.log("");
console.log("--- Sustituir una foto: quitar y añadir a la vez ---");
{
  const r = aplicarFotos(galeria(), "g1", {
    quitar: ["https://blob/a.jpg"],
    anadir: [foto("nueva")],
  });
  comprobar("la vieja se va y la nueva entra", urls(r.items, "g1"), ["b.jpg", "nueva.jpg"]);
  comprobar("con un archivo que borrar", r.huerfanas, ["https://blob/a.jpg"]);
  comprobar("el grupo se mantiene", r.id, "g1");
}
{
  /* Sustituir la única foto: se quita y se pone otra, así que el grupo NO
     puede desaparecer aunque en algún momento se quede a cero */
  const solo = [{ id: "g2", titulo: "Una sola", albumes: [], equipos: [], fecha: "", fotos: [foto("a")] }];
  const r = aplicarFotos(solo, "g2", { quitar: ["https://blob/a.jpg"], anadir: [foto("nueva")] });
  comprobar("sustituyendo la única foto, el grupo sobrevive", r.id, "g2");
  comprobar("con la nueva dentro", urls(r.items, "g2"), ["nueva.jpg"]);
}

/* ----------------------------------------------------------- casos raros */
console.log("");
console.log("--- Casos raros ---");
{
  /* El editor abierto mientras alguien elimina el grupo desde otro sitio */
  const r = aplicarFotos(galeria(), "no-existe", { anadir: [foto("c")] });
  comprobar("sobre un grupo que ya no existe no se inventa nada", r.items.map((e) => e.id), ["otro", "g1"]);
  comprobar("y se avisa devolviendo el grupo vacío", r.id, "");
}
{
  const antes = galeria();
  aplicarFotos(antes, "g1", { quitar: ["https://blob/a.jpg"], anadir: [foto("c")] });
  comprobar("no se toca la galería que se recibió", urls(antes, "g1"), ["a.jpg", "b.jpg"]);
}

/* ------------------------------------------------ identificadores unicos */
console.log("");
console.log("--- Que cada grupo tenga su identificador ---");
{
  const r = conIdUnico([
    { id: "a", titulo: "Uno" },
    { id: "a", titulo: "Dos" },
    { id: "a", titulo: "Tres" },
  ]);
  comprobar("el repetido deja de serlo", r.map((e) => e.id), ["a", "a-2", "a-3"]);
}
{
  const r = conIdUnico([{ titulo: "Amistoso Infantil B" }, { titulo: "Otro" }]);
  comprobar("al que no trae ninguno se le inventa uno", r[0].id, "amistoso-infantil-b-0");
}
{
  /* Un grupo nuevo se pone el primero: si el reparto fuera por posicion, a los
     de abajo les cambiaria el identificador y dejarian de poder editarse */
  const antes = conIdUnico([{ id: "x", titulo: "A" }, { id: "x", titulo: "B" }]);
  const luego = conIdUnico([{ id: "nuevo", titulo: "N" }, { id: "x", titulo: "A" }, { id: "x", titulo: "B" }]);
  comprobar("añadir uno delante no le cambia el identificador a los de abajo",
    luego.slice(1).map((e) => e.id), antes.map((e) => e.id));
}
{
  comprobar("no se toca el que ya era unico", conIdUnico([{ id: "solo", titulo: "S" }])[0].id, "solo");
}

/* Contra los datos de verdad del club, que es donde aparecio el problema */
{
  const ids = conIdUnico(galeriaReal.items).map((e) => e.id);
  comprobar("en la galería del club no queda ninguno repetido", ids.length - new Set(ids).size, 0);

  const cada = conIdUnico(galeriaReal.items);
  const encontrados = cada.filter((e) => cada.find((x) => x.id === e.id) === e).length;
  comprobar("y buscando cada uno se encuentra a sí mismo", encontrados, cada.length);
}

console.log("");
console.log(fallos === 0 ? "Todo correcto." : fallos + " comprobaciones fallan.");
process.exit(fallos === 0 ? 0 : 1);
