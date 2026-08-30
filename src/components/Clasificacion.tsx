import { haEmpezado, type Competicion, type Equipo } from "@/lib/competicion";
import EscudoClub from "@/components/EscudoClub";

const COLOR_RACHA = {
  G: "bg-club text-white",
  E: "bg-panel-2 text-mute",
  P: "bg-tinta/70 text-white",
} as const;

function Racha({ racha }: { racha: string[] }) {
  if (racha.length === 0) return null;
  return (
    <span className="flex gap-1">
      {racha.slice(0, 5).map((r, i) => (
        <span
          key={i}
          title={r === "G" ? "Ganado" : r === "E" ? "Empatado" : "Perdido"}
          className={`grid h-4 w-4 place-items-center rounded-sm text-[9px] font-bold ${
            COLOR_RACHA[r as keyof typeof COLOR_RACHA] ?? "bg-panel-2"
          }`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export default function Clasificacion({
  competicion,
  equipo,
}: {
  competicion: Competicion;
  equipo: Equipo;
}) {
  if (competicion.clasificacion.length === 0) {
    return (
      <p className="rounded-xl border border-linea bg-panel p-4 text-sm text-mute">
        La RFAF todavía no ha publicado la clasificación de esta competición.
      </p>
    );
  }

  return (
    <>
      {haEmpezado(competicion) ? null : (
        <p className="mb-3 rounded-lg bg-panel-2 px-4 py-2.5 text-sm text-mute">
          La competición aún no ha empezado: la RFAF publica la tabla en orden
          alfabético hasta que se dispute la primera jornada.
        </p>
      )}
    <div className="overflow-x-auto rounded-xl border border-linea bg-panel">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">
          Clasificación de {competicion.nombre}
        </caption>
        <thead>
          <tr className="border-b border-linea text-left text-[11px] uppercase tracking-wider text-mute">
            <th scope="col" className="py-2.5 pl-3 pr-2 font-bold">#</th>
            <th scope="col" className="py-2.5 pr-2 font-bold">Equipo</th>
            <th scope="col" className="py-2.5 px-2 text-center font-bold">Pts</th>
            <th scope="col" className="py-2.5 px-2 text-center font-bold">PJ</th>
            <th scope="col" className="py-2.5 px-2 text-center font-bold">G</th>
            <th scope="col" className="py-2.5 px-2 text-center font-bold">E</th>
            <th scope="col" className="py-2.5 px-2 text-center font-bold">P</th>
            <th scope="col" className="py-2.5 px-2 text-center font-bold">GF</th>
            <th scope="col" className="py-2.5 px-2 text-center font-bold">GC</th>
            <th scope="col" className="py-2.5 pl-2 pr-3 font-bold">Últimos</th>
          </tr>
        </thead>
        <tbody>
          {competicion.clasificacion.map((fila) => {
            const nuestro = fila.equipo === equipo.nombreRfaf;
            return (
              <tr
                key={fila.posicion}
                className={`border-b border-linea last:border-0 ${
                  nuestro ? "bg-club/8 font-semibold" : ""
                }`}
              >
                <td className="py-2.5 pl-3 pr-2 tabular-nums text-mute">{fila.posicion}</td>
                <td className={`py-2.5 pr-2 ${nuestro ? "text-club" : "text-tinta"}`}>
                  <span className="flex items-center gap-2">
                    <EscudoClub nombre={fila.equipo} esNuestro={nuestro} size={22} />
                    {fila.equipo}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-center font-bold tabular-nums text-tinta">
                  {fila.puntos}
                </td>
                <td className="py-2.5 px-2 text-center tabular-nums text-mute">{fila.jugados}</td>
                <td className="py-2.5 px-2 text-center tabular-nums text-mute">{fila.ganados}</td>
                <td className="py-2.5 px-2 text-center tabular-nums text-mute">{fila.empatados}</td>
                <td className="py-2.5 px-2 text-center tabular-nums text-mute">{fila.perdidos}</td>
                <td className="py-2.5 px-2 text-center tabular-nums text-mute">{fila.golesFavor}</td>
                <td className="py-2.5 px-2 text-center tabular-nums text-mute">{fila.golesContra}</td>
                <td className="py-2.5 pl-2 pr-3">
                  <Racha racha={fila.racha} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
