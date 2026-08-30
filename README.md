# AD Taraguilla — web oficial

Web del club en Next.js 16 + Tailwind 4, pensada primero para el móvil.

La idea de fondo: **el club solo escribe noticias y sube fotos**. Todo lo de
competición —equipos, calendarios, horarios, resultados, clasificaciones y
rivales— se sincroniza solo desde la RFAF.

## Poner en marcha

```bash
npm install
npm run dev          # http://localhost:3000
```

| Comando | Qué hace |
| --- | --- |
| `npm run build` / `npm start` | Compilar y servir |
| `npx eslint .` | Revisar el código |
| `npm run rfaf` | Pasada de sincronización con la RFAF (incremental) |
| `npm run rfaf:forzar` | Revisa todos los equipos, aunque estén al día |
| `npm run rfaf:completo` | Recarga además todas las jornadas de la temporada |

## Sincronización con la RFAF

### Qué se trae

Todo parte de **un solo dato**: el código del club en `src/data/equipos.json`
(`3075`). El script encadena solo:

```
Ficha del club  →  equipos inscritos
   por equipo   →  competiciones de la temporada en curso
   por comp.    →  grupo  →  calendario, jornadas y clasificación
```

De ahí salen: rival, fecha, hora de saque, campo, superficie, resultado, enlace
al acta, tabla de clasificación con puntos, goles y racha, y el directorio de
clubes rivales.

Se escribe en `src/data/rfaf/`:

```
club.json              Índice: temporada y equipos con su posición
rivales.json           Directorio de clubes, para /clubes
equipos/<id>.json      Detalle de cada equipo: competiciones, jornadas, tabla
```

**Nunca se descargan datos personales.** Las plantillas, los árbitros y la junta
directiva están en la RFAF, pero no se copian aquí: la web solo enlaza a la ficha
oficial. Son en buena parte menores, y que la federación los publique con fines
federativos no autoriza al club a replicarlos en una web pública.

### Cómo se ejecuta

`.github/workflows/sincronizar-rfaf.yml` la lanza por cron: una pasada cada
mañana (recoge cambios de calendario y horarios), otra a media mañana, y tres el
sábado y el domingo por la tarde (recoge resultados). Cada pasada commitea lo que
haya cambiado y el hosting reconstruye.

### Lo que hay que saber del portal de la RFAF

Es un PNFG clásico y tiene sus manías. Están todas resueltas en
`scripts/rfaf/cliente.mjs`, pero conviene conocerlas:

- Exige cookie de sesión: sin `JSESSIONID` contesta "No se ha aceptado el cookie".
- Sirve las páginas en **ISO-8859-15**, no en UTF-8.
- Manda `Content-Length: 0` y a continuación el cuerpo igualmente. Por eso el
  cliente sigue las redirecciones a mano en vez de delegar en `fetch`.
- **Limita por volumen**: pasadas ~40 peticiones seguidas empieza a devolver
  `200` con el cuerpo vacío, y el bloqueo dura del orden de diez minutos.

Esa última es la que condiciona el diseño. Por eso la pasada es **reanudable**:
cada equipo se guarda en cuanto está listo, un equipo sincronizado hace menos de
20 h no se vuelve a pedir, y si nos cortan el grifo la pasada siguiente continúa
por donde se quedó en vez de empezar de cero. Una pasada incompleta no es un
fallo: es lo normal el primer día de temporada.

Además solo se piden las jornadas que pueden haber cambiado: las de las próximas
dos semanas (es cuando se asignan horarios y campos) y las recientes sin
resultado. Una jornada cerrada no se vuelve a consultar nunca. En régimen normal
son dos o tres peticiones por competición.

### Si la RFAF cambia el HTML

El scraping se apoya en la estructura de tablas, que es lo único estable entre
temporadas. Si algún día deja de funcionar:

```bash
npm run rfaf              # ver en qué punto falla
node scripts/rfaf/probar.mjs <carpeta-con-html>   # probar los extractores sin red
```

`scripts/rfaf/probar.mjs` prueba la extracción contra páginas guardadas, sin
tocar la red. La web mientras tanto sigue mostrando los últimos datos válidos:
una sincronización fallida nunca borra lo que ya había.

## Qué se edita a mano

| Qué | Dónde |
| --- | --- |
| Noticias | Panel `/admin`, o `content/noticias/*.md` |
| Fotos y vídeos | Panel `/admin`, o `src/data/galeria.json` |
| Nombre y orden de los equipos | `src/data/equipos.json` → `nombres` |
| Nombre, lema, contacto, redes | `src/data/site.ts` |
| Colores del club | `src/app/globals.css` → bloque `@theme` |
| Escudo | `public/img/escudo.png` |

Un equipo nuevo aparece solo en la web con el nombre deducido de su categoría
("Infantil", "Alevín"…); `equipos.json` solo sirve para ponerle un nombre bonito
y decidir en qué orden se muestra.

## Estructura

```
content/noticias/*.md        Una noticia por archivo
src/data/site.ts             Nombre, lema, redes, contacto, federación
src/data/equipos.json        Código del club y nombres de los equipos
src/data/galeria.json        Fotos y vídeos
src/data/rfaf/               Generado: no editar a mano
src/lib/contenido.ts         Lectura de noticias y galería
src/lib/competicion.ts       Lectura de los datos de la RFAF
scripts/rfaf/                Sincronizador
src/app/                     /, /equipos, /noticias, /galeria, /clubes
public/admin/                Panel de edición (Decap CMS)
```

## Panel `/admin`

### Probar en local, sin GitHub

```bash
npx decap-server     # en una terminal
npm run dev          # en otra
```

Y entra en <http://localhost:3000/admin>.

### En producción

1. Sube el proyecto a un repositorio de GitHub.
2. **Settings → Developer settings → OAuth Apps → New OAuth App**
   - *Homepage URL*: `https://tu-dominio`
   - *Authorization callback URL*: `https://tu-dominio/api/callback`
3. Define `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` y `NEXT_PUBLIC_SITE_URL`
   (ver `.env.example`).
4. En `public/admin/config.yml`, pon tu `repo` y tu `base_url`.

El intercambio de OAuth lo resuelve la propia web (`src/app/api/auth` y
`src/app/api/callback`): no hace falta ningún servicio externo.

## Paleta

Blanco y el verde del escudo (`#265612`). Todo sale de `src/app/globals.css`:

| Variable | Valor | Uso |
| --- | --- | --- |
| `--color-club` | `#265612` | Verde principal (8.7:1 sobre blanco) |
| `--color-club-dark` | `#17380a` | Pulsado, pie, visor de galería |
| `--color-club-soft` | `#3d7523` | Acentos sobre fondo claro (5.6:1) |
| `--color-club-claro` | `#a8d98c` | Acentos sobre fondo verde (5.3:1) |
| `--color-fondo` | `#f6f8f4` | Fondo de página |
| `--color-panel` | `#ffffff` | Tarjetas |
| `--color-tinta` | `#10180c` | Texto principal (18:1) |
| `--color-mute` | `#55614f` | Texto secundario (6:1) |

Todas las combinaciones de texto cumplen AA.

## Limitación conocida: las eliminatorias de copa

Las rondas de copa ("Cuartos", "Semifinales") no llevan número de jornada, y el
calendario de la RFAF tampoco expone su código. Sin ese código no se puede pedir
el detalle de la ronda, así que de esos partidos tenemos el emparejamiento y la
fecha pero **no el resultado**. En la web salen marcados con «s/r» y con enlace a
la ficha oficial, en vez de aparecer como pendientes.

Afecta solo a las eliminatorias; las ligas van completas. Para resolverlo hay que
localizar de dónde saca el portal el código de ronda (probablemente un `select`
en la propia página de jornada) y usarlo en `scripts/rfaf/sincronizar.mjs`, donde
ahora se manda `CodJornada` vacío.

## Pendiente de confirmar

- **Escudo**: `public/img/escudo.png` mide 88×86 px. Si tenéis el original en SVG
  o PNG grande, sustituidlo en la misma ruta y regenerad el favicon.
- **Redes sociales**: las URLs de `site.ts` están escritas por convención
  (`/adtaraguilla`); hay que comprobar que son las cuentas reales.
- **Contacto**: correo y dirección del campo.
- **Equipos sin competición**: la RFAF marca dos con `*` (Alevín B y
  Prebenjamín). Aparecerán solos en cuanto tengan calendario.
- Las tres noticias de `content/noticias/` son texto de ejemplo.
