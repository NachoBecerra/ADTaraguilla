"use client";

import { useEffect, useState } from "react";

/**
 * Cuánta gente ha seguido el partido.
 *
 * No es "cuántos hay ahora": es cuántas personas distintas lo han abierto. Se
 * eligió así porque un "3 viendo ahora" en un club de pueblo desanima, mientras
 * que "lo siguieron 120" es la cifra que se enseña. Y de paso cuesta una
 * escritura por dispositivo y partido en vez de una por minuto y persona.
 *
 * **El identificador es de este partido y de este navegador.** Se inventa aquí,
 * es aleatorio y no viaja de un encuentro al siguiente: sirve para no contar dos
 * veces a quien recarga y para nada más. Nada que permita seguir a una persona.
 */

/** Cada cuánto se vuelve a preguntar la cifra mientras la pantalla está abierta. */
const CADA_MS = 60_000;

const clave = (partido: string) => `directo-visita-${partido}`;

/** El identificador de esta visita, creándolo la primera vez. */
function idDeVisita(partido: string): string | null {
  try {
    const guardado = localStorage.getItem(clave(partido));
    if (guardado) return guardado;

    const nuevo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(clave(partido), nuevo);
    return nuevo;
  } catch {
    // Sin almacenamiento no se cuenta: mejor eso que contar a alguien en cada recarga
    return null;
  }
}

export default function ContadorSeguidores({
  partido,
  registrar = false,
}: {
  partido: string;
  /**
   * Si esta pantalla cuenta como visita.
   *
   * La del público sí; la de quien escribe desde el campo no, que si no el club
   * se contaría a sí mismo y con dos personas apuntando ya irían dos de más.
   */
  registrar?: boolean;
}) {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let vigente = true;

    const guardar = (n: unknown) => {
      if (vigente && typeof n === "number") setTotal(n);
    };

    const preguntar = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/directo/${partido}/seguidores`, { cache: "no-store" });
        if (r.ok) guardar((await r.json()).total);
      } catch {
        // Sin respuesta simplemente no se enseña la cifra
      }
    };

    const anotarme = async () => {
      const id = registrar ? idDeVisita(partido) : null;
      if (!id) return preguntar();

      try {
        const r = await fetch(`/api/directo/${partido}/seguidores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
          cache: "no-store",
        });
        if (r.ok) guardar((await r.json()).total);
        else await preguntar();
      } catch {
        await preguntar();
      }
    };

    void anotarme();
    const reloj = setInterval(() => void preguntar(), CADA_MS);
    return () => {
      vigente = false;
      clearInterval(reloj);
    };
  }, [partido, registrar]);

  // Hasta que no hay cifra no se reserva sitio: un "0" parpadeando queda peor
  if (total === null || total === 0) return null;

  return (
    <p className="mt-3 text-center text-xs text-mute">
      {total === 1
        ? "1 persona ha seguido este partido"
        : `${total} personas han seguido este partido`}
    </p>
  );
}
