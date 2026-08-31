"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { site, redesActivas } from "@/data/site";
import { IconoMenu, IconoCerrar, IconoFlecha, iconosRed } from "@/components/Iconos";

const NAV = [
  { href: "/", texto: "Inicio" },
  { href: "/equipos", texto: "Equipos" },
  { href: "/noticias", texto: "Noticias" },
  { href: "/galeria", texto: "Galería" },
  { href: "/historico", texto: "Histórico" },
];

export default function Cabecera() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  // Bloquea el scroll del fondo mientras el menú está abierto
  useEffect(() => {
    document.body.dataset.menuOpen = String(abierto);
    return () => {
      delete document.body.dataset.menuOpen;
    };
  }, [abierto]);

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  const activo = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-linea bg-fondo/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.nombre} — inicio`}>
            <Image
              src={site.escudo}
              alt=""
              width={843}
              height={836}
              sizes="36px"
              priority
              className="h-9 w-auto"
            />
            <span className="title text-lg leading-none sm:text-xl">
              {site.nombre.split(" ")[0]}{" "}
              <span className="text-club">{site.nombre.split(" ").slice(1).join(" ")}</span>
            </span>
          </Link>

          {/* Navegación de escritorio */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activo(i.href) ? "bg-club text-white" : "text-mute hover:text-club"
                }`}
              >
                {i.texto}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <div className="hidden items-center gap-1 sm:flex">
              {redesActivas.slice(0, 3).map((r) => {
                const Icono = iconosRed[r.id];
                return (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={r.nombre}
                    className="grid grid-cols-1 h-9 w-9 place-items-center rounded-full text-mute transition-colors hover:bg-panel-2 hover:text-club"
                  >
                    {Icono ? <Icono size={19} /> : r.nombre[0]}
                  </a>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setAbierto(true)}
              aria-label="Abrir menú"
              aria-expanded={abierto}
              className="grid grid-cols-1 h-11 w-11 place-items-center rounded-full border border-linea bg-panel text-tinta md:hidden"
            >
              <IconoMenu />
            </button>
          </div>
        </div>
      </header>

      {/* Menú móvil a pantalla completa */}
      <div
        className={`fixed inset-0 z-60 bg-fondo transition-opacity duration-200 md:hidden ${
          abierto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú principal"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <span className="eyebrow">Menú</span>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
            className="grid grid-cols-1 h-11 w-11 place-items-center rounded-full border border-linea bg-panel text-tinta"
          >
            <IconoCerrar />
          </button>
        </div>

        <nav className="px-5 pt-4">
          {NAV.map((i, idx) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setAbierto(false)}
              className="flex items-center justify-between border-b border-linea py-5"
            >
              <span className="title text-4xl">
                <span className="mr-3 align-super text-xs font-bold text-club">
                  0{idx + 1}
                </span>
                {i.texto}
              </span>
              <IconoFlecha size={22} className="text-mute" />
            </Link>
          ))}
        </nav>

        <div className="px-5 pt-8">
          <p className="eyebrow mb-3">Síguenos</p>
          <div className="flex flex-wrap gap-2">
            {redesActivas.map((r) => {
              const Icono = iconosRed[r.id];
              return (
                <a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost px-4 py-2.5 text-sm"
                >
                  {Icono ? <Icono size={18} /> : null}
                  {r.nombre}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
