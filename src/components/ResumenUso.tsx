import { leerPrivado, hayAlmacenPrivado } from "@/lib/privado";

/**
 * Cuánta gente usa la web este mes y cuánta la tiene instalada.
 *
 * Lo demás —visitas, páginas más vistas, de dónde llega la gente— está en la
 * analítica de Vercel. Aquí solo el dato que allí no cabe.
 */

type Recuento = Record<string, Record<string, number>>;

export default async function ResumenUso() {
  if (!hayAlmacenPrivado) {
    return (
      <p className="mt-10 rounded-xl border border-linea bg-panel p-4 text-xs leading-relaxed text-mute">
        El recuento de uso no está activo todavía: falta conectar el almacén
        privado en Vercel.
      </p>
    );
  }

  const mes = new Date().toISOString().slice(0, 7);
  const recuento = await leerPrivado<Recuento>(`uso/${mes}.json`, {});
  const dias = Object.entries(recuento).sort(([a], [b]) => b.localeCompare(a));

  if (dias.length === 0) {
    return (
      <p className="mt-10 rounded-xl border border-linea bg-panel p-4 text-xs leading-relaxed text-mute">
        Todavía no hay visitas registradas este mes.
      </p>
    );
  }

  const suma = (clave: string) =>
    dias.reduce((n, [, d]) => n + (d[clave] ?? 0), 0);

  const total = suma("app") + suma("navegador");
  const cifras = [
    { texto: "Visitas este mes", valor: total },
    { texto: "Desde la aplicación", valor: suma("app") },
    { texto: "En iPhone", valor: suma("app-ios") + suma("navegador-ios") },
    { texto: "En Android", valor: suma("app-android") + suma("navegador-android") },
  ];

  return (
    <section className="mt-12">
      <h2 className="title text-2xl text-tinta">Uso de la web</h2>
      <p className="mt-1 text-sm text-mute">
        {mes.split("-").reverse().join("/")} · cada dispositivo cuenta una vez al día.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cifras.map((c) => (
          <div key={c.texto} className="card p-4">
            <dd className="title text-3xl text-club tabular-nums">{c.valor}</dd>
            <dt className="mt-1 text-xs leading-snug text-mute">{c.texto}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs text-mute">
        Las visitas, las páginas más vistas y de dónde llega la gente están en la
        analítica de Vercel.
      </p>
    </section>
  );
}
