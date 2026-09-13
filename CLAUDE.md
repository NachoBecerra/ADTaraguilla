@AGENTS.md

# AD Taraguilla — contexto del proyecto

Lee esto antes de cambiar nada. El `README.md` cuenta cómo funciona cada pieza;
este archivo cuenta **qué no se puede romper y dónde se rompe con facilidad**.
Casi todos los fallos serios del proyecto han venido de cambiar algo que otra
parte daba por hecho.

**Regla de mantenimiento:** si un cambio altera una de las reglas de aquí, este
archivo se actualiza en el mismo commit.

## El mapa en treinta segundos

Next.js 16 (App Router). Casi toda la web se genera al compilar a partir de
`src/data/` y `content/`. Lo que cambia mientras se juega va en un almacén y lo
pide el navegador.

Hay **tres escritores, y ninguno sabe de los otros**:

| Quién | Escribe | Cómo |
| --- | --- | --- |
| El bot de la RFAF (`scripts/rfaf/sincronizar.mjs`, GitHub Actions por cron) | `src/data/rfaf/` | commit y `git push` a `main` |
| El panel (`/panel`, contraseña compartida del club) | noticias y `src/data/galeria.json` | commits por la API de GitHub a `main` |
| El panel y quien narra desde el campo | directo, anuncios, escudos propios | almacén privado de Vercel Blob |

- **Cada commit a `main` redespliega la web entera.** El bot publica cada media
  hora los fines de semana: antes de subir nada, rebasa.
- Almacenes: el **repositorio** (competición, noticias, galería); **Blob público**
  (fotos, portadas, escudos subidos); **Blob privado** (`directo/`,
  `directo/narrados/`, `escudos/propios.json`, `avisos/`, `uso/`).

## Reglas que no se rompen

### Datos de la RFAF

1. **El marcador de la RFAF no se lee.** Está ofuscado a propósito: dígitos
   señuelo y valores distintos en cada petición. El resultado se deduce de la
   clasificación (`scripts/rfaf/reglas.mjs` → `resultadoPorClasificacion`) y se
   guarda con `origen: "clasificacion"`. Un resultado sin esa marca no vale.
2. **Lo ya jugado no se borra por una lectura a medias.** La RFAF sirve
   calendarios recortados (pasó el 9, el 10 y el 12 de septiembre de 2026:
   jornadas enteras y partidos sueltos). Las jornadas conocidas y los partidos
   que ya pudieron jugarse (una hora tras el saque) se conservan aunque el
   calendario deje de traerlos, salvo que reaparezcan en otra jornada, que eso
   es un aplazamiento. Regla: `partidosCongelados`, con pruebas.
3. **Un resultado solo se deduce con certeza**: exactamente un partido nuevo en
   la tabla y un único candidato. Ante la duda se deja el hueco; nunca se
   publica un resultado inventado.
4. **La sincronización corre sin `node_modules`**: el workflow no instala
   dependencias. Nada de librerías en `scripts/rfaf/sincronizar.mjs` ni en lo
   que importe. Lo que las necesite va en un script aparte que se lanza a mano
   (`scripts/rfaf/medirEscudos.mjs`).
5. Las competiciones que no se publican se apartan en `src/data/equipos.json` →
   `competicionesExcluidas`, por código de grupo. Borrarlas de los datos no
   sirve: la siguiente pasada las vuelve a traer.

6. **Un aviso al móvil solo sale con los datos ya publicados.** La
   sincronización los deja en un archivo (`AVISOS_A_ARCHIVO`) y el workflow los
   manda con `scripts/rfaf/avisar.mjs` después de un push que haya salido bien.
   Mandarlos antes avisaba de resultados que no estaban en la web, y cuando el
   push fallaba la pasada siguiente los repetía.

### Directo

7. **Se guardan eventos, no el marcador.** Marcador, reloj y fase se pliegan de
   la lista (`src/lib/directo/modelo.ts` → `plegar`). Corregir es añadir un
   evento `anula`. Para reparar un partido que nadie cerró está
   `scripts/directo/corregir.mjs`.
8. **Un registro abierto no es un directo narrado.** Narrado significa que tiene
   eventos, y se marca con `directo/narrados/<id>.json` al apuntarse el primero.
9. **`listarRegistros()` devuelve solo registros de partido** (`directo/<id>.json`).
   La carpeta tiene subcarpetas: quien recorra el almacén por su cuenta tiene que
   filtrar. El 12 de septiembre un marcador de subcarpeta tumbó la lista de
   directos de la portada.
10. **"Ya no se juega" es saque + 3 h**, definido una sola vez
   (`src/lib/directo/panel.ts` → `yaNoSeJuega`). Panel y portada tienen que usar
   la misma regla, o un partido desaparece de uno y sigue prometiéndose en el otro.
   Un partido **sin hora** tiene el saque al final de su día (`HORA_SIN_FIJAR`,
   en `scripts/rfaf/reglas.mjs` y `src/lib/directo/partidos.ts`: tienen que
   coincidir).
11. **El almacén privado se lee sin caché** (`src/lib/privado.ts`). Leer con caché
    para modificar y volver a guardar pierde lo último: pasó con el directo.

### Web

12. **Local tiene que comportarse como producción.** El respaldo en disco
    (`src/lib/directo/deposito.ts`) lista recursivamente, igual que el almacén.
    Cualquier diferencia entre los dos esconde fallos que solo aparecen en
    producción. Por lo mismo, **todo lo que compare con la hora de un partido va
    en hora española** (`saqueEnMs`): `new Date("2026-09-13T19:00:00")` se lee en
    la hora del servidor, y GitHub y Vercel van en UTC. Así estuvo el bot dos
    horas tarde en cada resultado de tarde.
13. Lo que depende de la hora o de datos vivos se decide en el navegador, y en el
    servidor se pinta vacío (`useSyncExternalStore` con valor de servidor fijo).
    Así no hay errores de hidratación.
14. **Escudos**: solo de los sitios permitidos. La lista está en
    `next.config.ts` y en `src/lib/panel/escudos.ts` → `esEscudoAceptable`, y
    tienen que coincidir. `src/data/rfaf/formas.json` dice cómo escalar cada
    escudo dentro de su disco; se rellena con `node scripts/rfaf/medirEscudos.mjs`
    cuando aparece un rival nuevo.

## Lo que no es de fiar

- **La RFAF**: calendarios y fichas recortados, marcadores trucados, resultados
  publicados antes del saque, extensiones de imagen que mienten (JPEG llamados
  `.png`) y un cupo de unas 40 peticiones seguidas.
- **El cron de GitHub**: llega tarde y a veces se salta una pasada.
- **Los commits a `main` concurren**: el bot y el panel escriben a la vez. El
  paso de publicar del workflow integra `main` y reintenta el push; quien toque
  ese paso tiene que conservarlo, que sin él se perdieron tres pasadas.

## Antes de cambiar algo

- **Busca quién consume lo que tocas** antes de cambiar su forma o su
  significado: una API, un JSON, el contenido de una carpeta del almacén.
- **Ante un fallo, escribe en una frase la regla que se ha roto** y busca las
  demás vías de romperla. Una prueba por cada vía. No arregles solo el caso que
  se ve.
- Las decisiones puras viven en módulos sin dependencias para poder probarlas
  sin red: `scripts/rfaf/reglas.mjs`, `src/lib/directo/{modelo,ventana,panel,estadisticas}.ts`.
- Verificación al cerrar un bloque de cambios:

  ```bash
  node scripts/rfaf/probar.mjs
  node scripts/directo/probar.mjs
  node scripts/panel/probar.mjs
  npx tsc --noEmit && npm run lint && npm run build
  ```

- Lo que las pruebas no cubren (almacén, rutas de API) se reproduce en local con
  `npx next dev` y registros de mentira en `.next/cache/directo/`. Bórralos al
  terminar.

## Operación

- **Desplegar** es hacer push a `main`. Antes: `git fetch` y rebase, que el bot
  habrá subido datos.
- **Secretos de producción**: los trae el usuario con
  `npx vercel env pull .env.produccion --environment=production`; se usan con
  `node --env-file=.env.produccion …` y se borra el archivo al acabar.
- **Variables**: `CLAVE_PANEL`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_RAMA`,
  `BLOB_READ_WRITE_TOKEN` (almacén público), `BLOB_PRIVADO_READ_WRITE_TOKEN`,
  `AVISOS_SECRETO`, `VAPID_CLAVE_PRIVADA`, `NEXT_PUBLIC_VAPID_CLAVE_PUBLICA`.
- Vercel Blob está en el plan Pro desde el 5 de septiembre de 2026.
