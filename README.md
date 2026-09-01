# AD Taraguilla — web oficial

Web del club en Next.js 16 + Tailwind 4, pensada primero para el móvil.

La idea de fondo: **el club solo escribe noticias, sube fotos y, si quiere, va
contando el partido en directo**. Todo lo de competición —equipos, calendarios,
horarios, resultados, clasificaciones y rivales— se sincroniza solo desde la
RFAF, y el directo no lo toca: es orientativo mientras se juega y el acta manda
en cuanto llega.

## Poner en marcha

```bash
npm install
npm run dev          # http://localhost:3000
```

| Comando | Qué hace |
| --- | --- |
| `npm run build` / `npm start` | Compilar y servir |
| `npx eslint .` | Revisar el código |
| `npm run directo:probar` | Comprueba el reloj y el marcador del directo |
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
historico/<id>.json    Palmarés y clasificaciones de temporadas pasadas
rivales.json           Directorio de clubes, para /clubes
escudos.json           Escudo de cada club, por código de equipo
equipos/<id>.json      Detalle de cada equipo: competiciones, jornadas, tabla
```

Los escudos se guardan **como URL, no como imagen**. La página de una jornada
trae el escudo de todos los equipos del grupo, así que basta una petición por
competición para tenerlos todos, y se pide solo la primera vez. `next/image` los
descarga y los cachea en el servidor, de modo que el navegador de quien visita la
web no llega a tocar la CDN de la RFAF: se sirven optimizados desde el propio
dominio, sin engordar el repositorio con binarios ni tener que reconciliarlos
cuando un club cambie de escudo.

**Nunca se descargan datos personales.** Las plantillas, los árbitros y la junta
directiva están en la RFAF, pero no se copian aquí: la web solo enlaza a la ficha
oficial. Son en buena parte menores, y que la federación los publique con fines
federativos no autoriza al club a replicarlos en una web pública.

### Cómo se ejecuta

`.github/workflows/sincronizar-rfaf.yml` la lanza por cron. El horario sigue a
cómo funciona la competición, no a un reparto uniforme:

| Cuándo (hora española) | Para qué |
| --- | --- |
| Lunes a jueves, 10:00 · 15:00 · 20:00 | Los horarios de los partidos se asignan durante la semana, sobre todo de martes a jueves |
| Viernes 10:00, y cada media hora de 16:00 a medianoche | Empiezan a llegar resultados |
| Sábado 9:00, y cada media hora de 11:00 a medianoche | El día grande: el primer partido es a las 10:00 |
| Domingo 10:00 · 14:00 · 18:00 · 23:00 | Menos partidos, casi siempre el primer equipo |

Son unas 64 pasadas por semana, pero **la frecuencia no es el problema: lo es el
coste de cada pasada**. Una que no encuentra nada pendiente gasta cinco o seis
peticiones, porque solo se consultan los equipos cuyo partido **ya ha terminado**
y sigue sin resultado —se mira la hora de saque, no solo el día, para no
preguntar veinte veces por un partido que aún no se ha jugado—. La única pasada
cara es la primera de cada día, que revisa todo: unas 32 peticiones.

El resultado no aparece al pitar el final sino cuando el árbitro cierra el acta,
así que se da por terminado un partido dos horas después del saque.

Un aviso: GitHub no garantiza la puntualidad de estos disparos. Suelen llegar con
unos minutos de retraso y, si su cola va cargada, alguno puede saltarse. Por eso
los minutos están en :07 y :37, no en punto, que es cuando se programa medio
mundo.

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

### El histórico

El palmarés —posición y puntos de cada temporada anterior— **no cuesta ninguna
petición**: viene en la misma página que ya se pide para saber en qué compite
hoy cada equipo.

Las clasificaciones finales sí hay que ir a buscarlas, unas 140 peticiones en
total. Se rellenan a fuego lento: cada pasada dedica como mucho 12 peticiones a
la temporada pendiente más reciente, además de su trabajo normal. Así nunca se
roza el límite de la RFAF y en un día está completo. Una temporada terminada no
cambia, así que lo recogido no se vuelve a pedir jamás y, cuando no queda nada
pendiente, el relleno no gasta nada.

Las competiciones sin tabla —las copas por eliminatorias— se marcan con
`sinClasificacion` para no preguntar por ellas una y otra vez.

**Códigos anteriores**: la RFAF cambia el código del equipo al cambiar de
categoría, y su historial previo cuelga del código viejo. Se apuntan en
`src/data/equipos.json` → `codigosAnteriores` y el sincronizador los fusiona una
sola vez. Gracias a eso el primer equipo enseña los dos ascensos: campeón de 3ª
en 2022-23 con 91 puntos y de 2ª en 2023-24 con 65.

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

## Seguimiento en directo

**La RFAF no publica nada en vivo.** El resultado solo aparece cuando el árbitro
cierra el acta, que puede ser media hora después del pitido final. Así que el
directo no puede salir del scraping: lo escribe alguien del club desde la banda.

**Y nunca toca los datos de la web.** El marcador del directo es orientativo y
se dice en la propia pantalla. Resultados, clasificaciones y calendario salen
solo de la RFAF; cuando llega el acta, es la que manda. El directo vive en el
almacén privado y jamás escribe en `src/data/`.

### Se guardan eventos, no el marcador

Un archivo por partido, con la lista de lo que fue pasando. El resultado, el
reloj y la fase se **calculan** plegando esa lista (`src/lib/directo/modelo.ts`).
De ahí salen las propiedades que hacen esto viable en un campo de pueblo:

- La cronología y el marcador no pueden contradecirse: el marcador *es* la
  cronología sumada.
- Cada evento lo identifica el móvil que lo escribe, así que **reenviar es
  inofensivo**. Sin cobertura se encola en el teléfono y se reintenta a ciegas.
- **Corregir es añadir**, nunca borrar. Hasta el «Iniciar partido» pulsado
  mientras el equipo calentaba se arregla anulándolo: los minutos se recolocan
  solos porque se derivan del instante de cada evento.
- Quien escribe manda **todo lo que sabe** en cada envío y el servidor hace la
  unión. Así una lectura atrasada del almacén no puede borrar media cronología.

### El reloj

Cada parte arranca en su minuto nominal, no donde acabó la anterior: la segunda
del benjamín empieza en el 30 y la del juvenil en el 45. Acumulando, los
descuentos de la primera desplazarían todo el resto del partido. Lo jugado de
más se enseña como `45+2`.

La duración sale de la categoría (`src/lib/directo/reglamento.ts`) y se copia
dentro del partido al abrirlo: mientras se juega, el directo no depende de nada
externo. Prebenjamín 25, benjamín 30, alevín 35, infantil 40, y 45 de cadete
para arriba.

El minuto es una **resta contra la hora del saque**, no un contador. Da igual
que la pantalla se cierre, se bloquee o pase media parte en segundo plano: al
volver, el reloj ya está en su sitio.

### Quién escribe

Desde `/panel` → **Directo** se elige el partido y sale un enlace para mandar
por WhatsApp a quien vaya al campo. No necesita la contraseña del club ni
instalar nada.

El enlace va firmado con HMAC de `CLAVE_PANEL`: sin variables nuevas, sin tabla
de tokens. Vale para **un solo partido**, funciona desde que se genera y caduca
unas horas después. Uno caducado explica que pida otro; uno inventado da 404.

Se puede volver a pedir cuantas veces haga falta —si al del campo se le muere el
móvil, sigue otro desde otro teléfono— y **nunca reinicia un partido en curso**.

### Cuándo se enciende y cuándo se apaga

El aviso de "en directo" se enciende al pulsar **Iniciar partido**, y se apaga
por tres caminos: basta con que se cumpla uno.

1. **Cuando la RFAF publica el resultado.** Es la señal buena de que el partido
   acabó, y a partir de ahí manda lo oficial.
2. **Tres horas después del pitido final**, para quien entra justo después y
   quiere ver cómo quedó.
3. **Seis horas después del saque**, como red de seguridad. En las
   eliminatorias de copa la federación muchas veces no publica resultado, y sin
   esto un partido de copa que nadie cerrara se quedaría marcando
   "EN DIRECTO 240'" durante días.

El enlace de quien escribe caduca **tres horas después del pitido final**, no
del saque: un partido que se adelanta o se alarga no tiene por qué perder el
margen para rematar la cronología. Se decide en el servidor porque al firmar el
enlace todavía no se sabe cuándo acabará.

### Dónde se entra

El distintivo de las tarjetas de equipo **no puede ser un enlace**: la tarjeta
entera ya lo es, y uno dentro de otro no es HTML válido. Por eso la entrada al
directo va como sección propia arriba de la portada y de `/equipos`, donde
además se ve más que una pastilla. En la ficha del equipo hay una banda que
lleva al partido.

La cronología se guarda **toda la temporada**: es lo único que la RFAF no da
—el acta trae el resultado, pero no en qué minuto cayó cada gol—. En la ficha
del equipo aparece la lista de partidos narrados, y qué partidos la tienen se
pregunta al abrir, porque la página se generó al compilar y la retransmisión
ocurrió después. La lista sale del **nombre de los archivos**, sin abrir
ninguno.

### Por qué se pregunta en vez de recibir empujones

No hay WebSocket, y no es una elección: en Vercel las funciones se despliegan
como lambdas, que no mantienen una conexión abierta ni pueden enterarse de lo
que pasó en otra. Lo dice la propia guía de Next
(`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`), que
para datos que se consultan a menudo recomienda justo lo contrario: preguntar
desde el cliente.

Así que el navegador pregunta cada cinco segundos con `ETag`: en hora y media
pasan veinte o treinta cosas, así que casi todas las respuestas son «nada
nuevo», sin cuerpo. Y como el reloj lo cuenta el propio navegador, entre
pregunta y pregunta nadie ve un número congelado.

El resumen para encender el «en directo» de las tarjetas (`/api/directo`) va con
caché de CDN corta, de modo que **el coste depende de lo que dura el partido y
no de cuánta gente lo mire**. Se filtra por el nombre del archivo antes de leer
ninguno, así que se leen los partidos de estos días y no los de toda la
temporada.

### Un aviso sobre el almacén

`put` de Vercel Blob guarda con **un mes de caché por defecto**, y su mínimo es
un minuto. Leer a través de esa caché devuelve la versión anterior, así que
quien lea para modificar y volver a guardar **pierde** lo último. Costó un fallo
en producción descubrirlo: el directo se comía la cronología entera a cada gol.

Por eso `src/lib/privado.ts` lee **sin caché por defecto** y guarda con la
vigencia mínima. En ese almacén no hay nada que se beneficie de lo contrario:
todo son datos que se leen, se modifican y se vuelven a guardar —el recuento de
uso, las suscripciones a los avisos y el partido en directo—. Si algún día se
añade ahí algo que de verdad sea de solo lectura, se puede pedir la caché con
`{ sinCache: false }`, pero por defecto conviene que no la tenga.

Fuera de producción, si no hay `BLOB_PRIVADO_READ_WRITE_TOKEN`, el directo cae a
`.next/cache` para poder desarrollarlo sin secretos. En producción no: allí, si
falta el token, es un fallo que hay que ver.

## Qué se edita a mano

| Qué | Dónde |
| --- | --- |
| Noticias | Panel `/panel`, o `content/noticias/*.md` |
| Fotos | Panel `/panel`, o `src/data/galeria.json` |
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
src/data/galeria.json        Fotos: título, etiquetas, equipo y medidas
src/data/rfaf/               Generado: no editar a mano
src/lib/contenido.ts         Lectura de noticias y galería
src/lib/competicion.ts       Lectura de los datos de la RFAF
src/lib/privado.ts           Acceso al almacén privado
src/lib/avisos.ts            Suscripciones a las notificaciones
src/lib/directo/             Partidos en directo: modelo, reloj, almacén y enlace
scripts/directo/probar.mjs   Prueba del reloj y del marcador, sin red
scripts/rfaf/                Sincronizador
scripts/avisar-prueba.mjs    Aviso manual, para probar las notificaciones
public/sw.js                 Service worker
src/app/                     /, /equipos, /noticias, /galeria, /historico, /directo
src/app/api/                 subir, avisos, avisar, uso, version, directo
```

## Aplicación instalable

La web se puede instalar en el móvil (`src/app/manifest.ts`). Una vez instalada
se abre sin barra de direcciones.

`public/sw.js` existe por un motivo concreto: abrir la aplicación justo mientras
se estaba desplegando la dejaba clavada en la pantalla del escudo. La regla es
**la red primero, pero con reloj**: se pide a la red y, si no contesta en cinco
segundos, se abre con lo último que se vio. Nunca se espera indefinidamente. De
paso funciona sin cobertura. No se guarda nada de `/panel` ni de `/api`.

`AvisoDatosNuevos` pregunta cada minuto y medio por `/api/version`, que devuelve
la marca de generación de los datos. Si cambió: con la aplicación en segundo
plano se recarga sola; si hay alguien mirando, sale un aviso y decide.

## Dónde se guardan las fotos

**No en el repositorio.** Van a Vercel Blob, en el almacén público
`galeria-taraguilla`. El navegador las sube **directamente** al almacenamiento
(`/api/subir` solo emite el permiso): antes viajaban en base64 dentro de la
acción de servidor y chocaban con el límite de 1 MB por petición, así que cabían
dos y la tercera fallaba.

Como ya no son archivos locales, nadie puede medirlas al compilar: el navegador
apunta el ancho y el alto al reducirlas y se guardan en `galeria.json`.

Hay un segundo almacén, **privado**, `datos-privados`, para lo que no puede leer
cualquiera: el recuento de uso y las suscripciones a los avisos. Se accede con
`src/lib/privado.ts` y la variable `BLOB_PRIVADO_READ_WRITE_TOKEN`.

## Avisos al móvil

Quien quiera se suscribe desde la ficha de un equipo. **No hay registro**: la
suscripción que genera el navegador ya identifica al dispositivo, y junto a ella
se guarda de qué equipos quiere avisos. Se pueden seguir tantos como se quiera.

Se avisa de tres cosas y de ninguna más: el resultado cuando se publica, la hora
cuando se asigna y la hora cuando cambia. **Nunca** de que un partido sigue sin
hora, que sería el ruido que hace apagar los avisos.

Lo dispara la propia sincronización, que es quien sabe qué ha cambiado
(`novedadesDe` en `scripts/rfaf/sincronizar.mjs`), llamando a `/api/avisar` con
el secreto `AVISOS_SECRETO`. Para probar sin esperar a la RFAF: Actions → «Aviso
de prueba», que admite un texto para todos o una lista concreta en JSON.

En iPhone los avisos **solo funcionan con la web instalada** en la pantalla de
inicio. El botón lo explica en vez de fallar sin decir nada.

## Cuánta gente la usa

Dos piezas, porque ninguna cubre lo de la otra:

- **Vercel Analytics**: visitas, páginas, dispositivos, países y procedencia. Sin
  cookies, así que sin banner de consentimiento. El plan gratuito **no admite
  eventos propios** y guarda **solo 1 mes** de histórico.
- **Recuento propio** (`/api/uso`, visible en `/panel`): cuánta gente la usa
  instalada y el reparto entre iPhone y Android, que es justo el evento propio
  que el plan gratuito no permite. Un dispositivo cuenta una vez al día; el panel
  no cuenta.

## Panel `/panel`

Panel propio, dentro de la web. Se entra con **una contraseña del club**: quien
publica no necesita cuenta de GitHub. Desde aquí se suben noticias y fotos, y se
abre la retransmisión de un partido. El servidor hace el commit por dentro con
un único token, así que cualquier persona del club puede subir contenido desde
el móvil sin darse de alta en ningún sitio.

Al subir fotos se **reducen en el propio navegador** antes de enviarlas (lado
mayor 1800 px) y todas viajan en **un solo commit**, para no encadenar veinte
despliegues.

Variables necesarias (ver `.env.example`): `CLAVE_PANEL`, `GITHUB_TOKEN`,
`GITHUB_REPO`.


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

- **Contacto**: el correo de `src/data/site.ts` es `info@adtaraguilla.es`, y ese
  dominio **no existe**: quien escriba recibe un rebote. Falta el correo real del
  club.
- **Google Search Console**: dar de alta el dominio y enviar el sitemap.
- **iPhone**: los avisos y la instalación están probados en Android, no en iOS.
