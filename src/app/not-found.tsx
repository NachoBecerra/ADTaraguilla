import Link from "next/link";
import { IconoFlecha } from "@/components/Iconos";

export default function NoEncontrado() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <p className="title text-8xl text-club">404</p>
      <h1 className="title mt-4 text-4xl text-tinta">Se nos ha ido fuera</h1>
      <p className="mt-3 max-w-sm text-mute">
        La página que buscas no existe o ha cambiado de sitio.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Volver al inicio
        <IconoFlecha size={17} />
      </Link>
    </section>
  );
}
