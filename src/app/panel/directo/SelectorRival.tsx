"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EscudoImg from "@/components/EscudoImg";
import { IconoBuscar, IconoCerrar, IconoImagen } from "@/components/Iconos";
import { reducirEscudo, subirEscudo } from "@/lib/panel/fotos";
import { catalogoDeEscudos, guardarEscudo, quitarEscudo, type Catalogo } from "./acciones";

/**
 * El rival de un amistoso: su nombre y su escudo.
 *
 * Un amistoso no está en la RFAF, así que hasta ahora el rival se escribía a
 * mano y se quedaba con el escudo gris de "no sabemos quién es". Aquí se busca
 * entre los clubes que ya conocemos —los de nuestros grupos, que es contra
 * quien se juega casi siempre— y, si no está, se sube el suyo y se queda en la
 * librería para la próxima vez.
 *
 * Escribir un nombre que no esté en la lista sigue valiendo: se escribe y ya.
 * El escudo es un extra, no un requisito.
 */

/** Para buscar "San García" escribiendo "san garcia". */
const llano = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Cuántos escudos se enseñan de una vez. Con más, la lista tapa el formulario. */
const A_LA_VISTA = 6;

type Opcion = { nombre: string; url: string; propio: boolean; id?: string };

export default function SelectorRival({
  claseEtiqueta,
}: {
  claseEtiqueta: string;
}) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [texto, setTexto] = useState("");
  const [elegido, setElegido] = useState<Opcion | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const archivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vigente = true;
    void catalogoDeEscudos().then((c) => {
      if (vigente) setCatalogo(c);
    });
    return () => {
      vigente = false;
    };
  }, []);

  /* Los del club primero: son pocos y es lo que se acaba de subir */
  const opciones: Opcion[] = useMemo(() => {
    if (!catalogo) return [];
    return [
      ...catalogo.propios.map((e) => ({ nombre: e.nombre, url: e.url, propio: true, id: e.id })),
      ...catalogo.rfaf.map((e) => ({ nombre: e.nombre, url: e.url, propio: false })),
    ];
  }, [catalogo]);

  const encontrados = useMemo(() => {
    const busca = llano(texto.trim());
    if (!busca) return opciones.slice(0, A_LA_VISTA);
    return opciones.filter((o) => llano(o.nombre).includes(busca)).slice(0, A_LA_VISTA);
  }, [opciones, texto]);

  const elegir = (o: Opcion) => {
    setElegido(o);
    setTexto(o.nombre);
    setAbierto(false);
    setAviso("");
  };

  /* Al cambiar el nombre a mano, el escudo elegido deja de corresponder */
  const escribir = (valor: string) => {
    setTexto(valor);
    setAbierto(true);
    if (elegido && valor !== elegido.nombre) setElegido(null);
  };

  async function subir(f: File | undefined) {
    if (!f) return;

    const nombre = texto.trim();
    if (!nombre) {
      setAviso("Escribe antes el nombre del rival: es con lo que se guarda el escudo.");
      if (archivo.current) archivo.current.value = "";
      return;
    }

    setSubiendo(true);
    setAviso("");
    try {
      const { archivo: png } = await reducirEscudo(f);
      const url = await subirEscudo(png, nombre);
      const r = await guardarEscudo(nombre, url);

      if (!r.ok) {
        setAviso(r.mensaje);
      } else {
        setCatalogo((c) => (c ? { ...c, propios: r.propios } : c));
        setElegido({ nombre, url, propio: true, id: url });
        setAbierto(false);
      }
    } catch {
      setAviso("No se ha podido subir ese escudo. ¿Seguro que es una imagen?");
    } finally {
      setSubiendo(false);
      if (archivo.current) archivo.current.value = "";
    }
  }

  async function quitar(o: Opcion) {
    if (!o.id) return;
    setAviso("");

    const r = await quitarEscudo(o.id);
    setCatalogo((c) => (c ? { ...c, propios: r.propios } : c));
    if (!r.ok) setAviso(r.mensaje);
    if (elegido?.id === o.id) setElegido(null);
  }

  return (
    <div>
      <label htmlFor="rival" className={claseEtiqueta}>
        Rival
      </label>

      {/* Lo que se manda: el nombre tal y como está escrito, y el escudo elegido */}
      <input type="hidden" name="escudoRival" value={elegido?.url ?? ""} />

      <div className="relative">
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-linea bg-panel px-3 focus-within:border-club">
          {elegido ? (
            <EscudoImg src={elegido.url} size={26} />
          ) : (
            <IconoBuscar size={18} className="shrink-0 text-mute" />
          )}

          <input
            id="rival"
            name="rival"
            required
            autoComplete="off"
            maxLength={60}
            value={texto}
            onChange={(e) => escribir(e.target.value)}
            onFocus={() => setAbierto(true)}
            /* Con retraso: sin él, el clic en un escudo se pierde al cerrarse la lista */
            onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
            placeholder="Busca el club o escribe su nombre"
            className="w-full bg-transparent py-2.5 text-base text-tinta focus:outline-none"
          />
        </div>

        {abierto && encontrados.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-linea bg-panel shadow-lg">
            {encontrados.map((o) => (
              <li key={o.url} className="flex items-center border-b border-linea last:border-0">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(o);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left hover:bg-panel-2"
                >
                  <EscudoImg src={o.url} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm text-tinta">{o.nombre}</span>
                  {o.propio ? (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-club-soft">
                      Del club
                    </span>
                  ) : null}
                </button>

                {/* Solo los nuestros: los de la RFAF se rehacen en cada sincronización */}
                {o.propio ? (
                  <button
                    type="button"
                    aria-label={`Quitar de la librería el escudo de ${o.nombre}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void quitar(o);
                    }}
                    className="shrink-0 px-3 py-2 text-mute transition-colors hover:text-club"
                  >
                    <IconoCerrar size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <input
          ref={archivo}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void subir(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={subiendo}
          onClick={() => archivo.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-linea bg-panel-2 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-mute transition-colors hover:border-club hover:text-club disabled:opacity-60"
        >
          <IconoImagen size={14} />
          {subiendo ? "Subiendo…" : "Subir un escudo"}
        </button>

        <p className="text-[11px] leading-tight text-mute">
          {elegido
            ? "Se queda en la librería para la próxima vez."
            : catalogo === null
              ? "Buscando escudos…"
              : "Sin escudo, el rival sale con el genérico."}
        </p>
      </div>

      {aviso ? (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-club">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
