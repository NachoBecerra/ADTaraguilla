import type { Metadata } from "next";
import { haySesion } from "@/lib/panel/sesion";
import Acceso from "../Acceso";
import Historial from "./Historial";

/**
 * El historial de todo lo que se hace con los datos del club.
 *
 * Sin enlace desde ninguna parte —ni el panel, ni el pie, ni el menú—: se
 * llega escribiendo la dirección y con la contraseña del club. No es una
 * sección más, es una pantalla para revisar cuando algo no cuadra: «¿quién
 * borró esa foto?», «¿se llegó a abrir la retransmisión?».
 *
 * Los apuntes no se pintan aquí: los pide el navegador, y solo si no está
 * dentro de la aplicación instalada. Desde la app no se enseña nada.
 */

export const metadata: Metadata = {
  title: "Historial · Panel",
  robots: { index: false, follow: false },
};

export default async function PanelLogs() {
  if (!(await haySesion())) return <Acceso />;

  return (
    <section className="mx-auto max-w-3xl px-5 py-10">
      <p className="eyebrow">Panel del club</p>
      <h1 className="title mt-2 text-4xl text-tinta">Historial</h1>
      <p className="mt-3 text-sm leading-relaxed text-mute">
        Todo lo que se ha hecho con los datos de la web en los últimos meses, y lo que falló
        al intentarlo.
      </p>

      <Historial />
    </section>
  );
}
