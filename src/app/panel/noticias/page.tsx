import type { Metadata } from "next";
import Link from "next/link";
import { haySesion } from "@/lib/panel/sesion";
import { noticiasDelRepositorio, CATEGORIAS } from "@/lib/panel/noticias";
import Acceso from "../Acceso";
import Listado from "./Listado";
import { IconoFlecha } from "@/components/Iconos";

export const metadata: Metadata = {
  title: "Noticias · Panel",
  robots: { index: false, follow: false },
};

export default async function PanelNoticias() {
  if (!(await haySesion())) return <Acceso />;

  // Del repositorio, no de la compilación: así un cambio recién guardado
  // se ve al momento.
  const { noticias, enVivo } = await noticiasDelRepositorio();

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/panel"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-mute transition-colors hover:text-club"
      >
        <IconoFlecha size={16} className="rotate-180" />
        Panel
      </Link>

      <p className="eyebrow mt-5">Noticias</p>
      <h1 className="title mt-2 text-4xl text-tinta">Actualidad del club</h1>
      <p className="mt-3 text-sm leading-relaxed text-mute">
        Pulsa en cualquier noticia para cambiarla o eliminarla. La web se
        actualiza sola un par de minutos después de guardar.
      </p>

      {enVivo ? (
        <Listado noticias={noticias} categorias={CATEGORIAS} />
      ) : (
        <>
          <p className="mt-6 rounded-xl border border-club bg-panel p-4 text-sm leading-relaxed text-tinta">
            No se ha podido leer el repositorio, así que la edición está
            desactivada: guardar desde aquí publicaría noticias sin texto.
            Revisa que <code>GITHUB_TOKEN</code> esté configurado y vuelve a
            intentarlo.
          </p>
          <ul className="mt-4 space-y-2">
            {noticias.map((n) => (
              <li key={n.slug} className="card p-3 text-sm text-mute">
                <span className="font-semibold text-tinta">{n.titulo}</span> ·{" "}
                {n.categoria}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
