import type { Metadata } from "next";
import Image from "next/image";
import { site } from "@/data/site";
import DondeEstas from "@/components/DondeEstas";
import { IconoCompartir, IconoMenuPuntos, IconoMas, IconoCampana } from "@/components/Iconos";

/**
 * Cómo instalar la web como aplicación, contado paso a paso.
 *
 * Existe porque el aviso que sale solo no basta: se cierra, no vuelve en un
 * mes, y no hay dónde mandar a quien pregunta. Esta página es un enlace que se
 * puede pegar en un grupo de WhatsApp.
 *
 * Los pasos de los dos sistemas están escritos siempre, aunque arriba se
 * señale el que toca: mucha gente lee esto en el ordenador para explicárselo
 * después a otra persona con otro móvil.
 */

export const metadata: Metadata = {
  title: "Instalar la aplicación",
  description: `Cómo tener la web de la ${site.nombre} en la pantalla de inicio del móvil, paso a paso, en iPhone y en Android.`,
  alternates: { canonical: "/instalar" },
};

function Paso({
  numero,
  children,
}: {
  numero: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span className="title grid size-8 shrink-0 place-items-center rounded-full bg-club text-base text-white">
        {numero}
      </span>
      <div className="min-w-0 flex-1 pt-1 text-sm leading-relaxed text-tinta">{children}</div>
    </li>
  );
}

export default function PaginaInstalar() {
  const dominio = site.url.replace("https://", "");

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 pb-20">
      <p className="eyebrow">La app del club</p>
      <h1 className="title mt-2 text-5xl text-tinta sm:text-6xl">Instalar la aplicación</h1>
      <p className="mt-4 text-base leading-relaxed text-mute">
        No hay que bajar nada de ninguna tienda: la web se añade a la pantalla de inicio y se
        abre como una aplicación, a pantalla completa y de un toque.
      </p>

      <div className="mt-6">
        <DondeEstas />
      </div>

      {/* ------------------------------------------------------- iPhone y iPad */}
      <section className="card mt-8 p-5">
        <h2 className="title text-2xl text-tinta">En iPhone y iPad</h2>
        <p className="mt-1 text-sm text-mute">Tiene que ser con Safari. Con Chrome no sale.</p>

        <ol className="mt-5 space-y-4">
          <Paso numero={1}>
            Abre <strong>{dominio}</strong> en <strong>Safari</strong>.
          </Paso>
          <Paso numero={2}>
            Pulsa el botón <strong>Compartir</strong>{" "}
            <IconoCompartir size={15} className="inline align-text-bottom text-club" />, el del
            cuadrado con la flecha hacia arriba. En el iPhone está{" "}
            <strong>abajo, en el centro</strong>; en el iPad, arriba a la derecha.
          </Paso>
          <Paso numero={3}>
            Sube por la lista que aparece hasta{" "}
            <strong>«Añadir a pantalla de inicio»</strong>{" "}
            <IconoMas size={15} className="inline align-text-bottom text-club" />. Está bastante
            abajo, entre «Marcadores» y «Copiar».
          </Paso>
          <Paso numero={4}>
            Pulsa <strong>«Añadir»</strong>, arriba a la derecha. El escudo se queda en la
            pantalla de inicio.
          </Paso>
        </ol>
      </section>

      {/* ------------------------------------------------------------ Android */}
      <section className="card mt-6 p-5">
        <h2 className="title text-2xl text-tinta">En Android</h2>
        <p className="mt-1 text-sm text-mute">Con Chrome. A veces lo ofrece él solo.</p>

        <ol className="mt-5 space-y-4">
          <Paso numero={1}>
            Abre <strong>{dominio}</strong> en <strong>Chrome</strong>.
          </Paso>
          <Paso numero={2}>
            Si sale abajo un aviso con el botón <strong>Instalar</strong>, púlsalo y ya está.
          </Paso>
          <Paso numero={3}>
            Si no sale, abre el menú{" "}
            <IconoMenuPuntos size={15} className="inline align-text-bottom text-club" /> de los
            tres puntos, arriba a la derecha.
          </Paso>
          <Paso numero={4}>
            Elige <strong>«Instalar aplicación»</strong> o{" "}
            <strong>«Añadir a pantalla de inicio»</strong> y confirma.
          </Paso>
        </ol>
      </section>

      {/* --------------------------------------------------------- para qué */}
      <section className="mt-8 rounded-2xl border border-linea bg-panel p-5">
        <h2 className="title text-xl text-tinta">Para qué sirve tenerla instalada</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-mute">
          <li>Se abre de un toque, sin escribir la dirección ni buscarla.</li>
          <li>Ocupa toda la pantalla, sin la barra del navegador.</li>
          <li className="flex items-start gap-2">
            <IconoCampana size={15} className="mt-0.5 shrink-0 text-club" />
            <span>
              Puedes activar los avisos de tu equipo y enterarte de los resultados y los
              horarios en cuanto se publican.
            </span>
          </li>
        </ul>
      </section>

      <div className="mt-8 flex items-center gap-4 rounded-2xl bg-panel-2 p-5">
        <Image src={site.escudo} alt="" width={843} height={836} sizes="56px" className="h-14 w-auto" />
        <p className="text-sm leading-relaxed text-mute">
          ¿Se te resiste? Enséñale esta misma página a quien te ayude:{" "}
          <strong className="text-tinta">{dominio}/instalar</strong>
        </p>
      </div>
    </div>
  );
}
