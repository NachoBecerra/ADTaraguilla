import { redesActivas } from "@/data/site";
import { iconosRed } from "@/components/Iconos";

export default function SeccionRedes() {
  if (redesActivas.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-5">
      <div className="card slash relative overflow-hidden p-6 sm:p-8">
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
            Redes sociales
          </p>
          <h2 className="title mt-2 text-3xl text-white sm:text-4xl">
            Todo lo que pasa en el club, antes que nadie
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/85">
            Convocatorias, resultados en directo, fotos del partido y avisos de la cantera.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            {redesActivas.map((r) => {
              const Icono = iconosRed[r.id];
              return (
                <a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-club transition-transform active:scale-95"
                >
                  {Icono ? <Icono size={18} /> : null}
                  {r.handle || r.nombre}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
