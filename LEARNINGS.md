# LEARNINGS

Registro de lo aprendido en cada tarea: qué se hizo, por qué, conceptos nuevos y un ejemplo mínimo.

---

## 2026-11-22 · API simulada de la maceta (`mock-api/`)

### Qué se hizo
Un servidor Node + TypeScript que simula el ESP32 mientras no hay hardware:

- `GET /api/readings/latest` → la última lectura `{ deviceId, timestamp, soilMoisture, light }`.
- `GET /api/readings?from=&to=` → `{ from, to, count, truncated, readings }`.
- Datos simulados con sentido: luz con ciclo diurno (hora de Bogotá) y humedad que se seca
  con riegos ocasionales. 7 días de histórico y lecturas nuevas en vivo.

| Archivo | Responsabilidad |
|---|---|
| `src/config.ts` | Lee y valida variables de entorno (`PORT`, `CORS_ORIGIN`, `SIM_SEED`, `SIM_SPEED`). |
| `src/random.ts` | Generador aleatorio con semilla (mulberry32). |
| `src/sim-constants.ts` | Todas las constantes de la simulación; las inventadas, marcadas `PROVISIONAL`. |
| `src/simulator.ts` | Modelo de luz, humedad y riegos. No sabe de HTTP ni de almacenamiento. |
| `src/store.ts` | Histórico en memoria, búsqueda por rango, generación en vivo y retención de 30 días. |
| `src/server.ts` | Rutas Hono, validación de fechas, CORS y errores en JSON. |

### Por qué así
- **Hono** frente a Express/Fastify/`node:http`: usa `Request`/`Response` estándar (lo mismo que
  `fetch` en el navegador), trae CORS incluido y tiene buenos tipos de TypeScript.
- **Sin paso de compilación**: Node 22.18 ejecuta `.ts` borrando los tipos; `tsc --noEmit` solo revisa.
- **Capas separadas** (simulador → store → servidor): cada una se puede probar sola, y cuando llegue
  el ESP32 real solo hay que reemplazar el simulador.
- **Constantes provisionales en un solo archivo**: cuando el equipo confirme unidades y rangos,
  se cambian en un único lugar.

### Conceptos nuevos

**Type stripping (Node 22.18+).** Node borra las anotaciones de tipo y ejecuta el resultado. No
revisa tipos y no admite sintaxis que genere código (`enum`, `namespace`). Por eso en
`tsconfig.json` van `erasableSyntaxOnly`, `verbatimModuleSyntax` y `allowImportingTsExtensions`,
y los imports llevan la extensión `.ts`.

**PRNG con semilla.** `Math.random()` no se puede repetir; un generador con semilla produce siempre
la misma secuencia. Truco: consumir siempre la misma cantidad de números por paso, para que una
regla nueva no "desalinee" todo lo que viene después.

**Ruido en la medición, no en el estado.** Si el ruido del sensor se suma al estado interno, se
acumula y la humedad hace un paseo aleatorio. Se suma solo al valor reportado.

**Búsqueda binaria sobre datos ordenados.** Como las lecturas llegan en orden, encontrar un rango
toma O(log n) comparaciones con `lowerBound`/`upperBound`.

**`Date.parse` es permisivo.** Acepta `2026-02-30` (lo convierte en 2 de marzo), `24:00` y fechas
sin zona (las interpreta en la hora local del PC). Para validar una API hay que parsear a mano.

**CORS y preflight.** El navegador manda primero un `OPTIONS` preguntando si el origen y el método
están permitidos; el servidor responde con `Access-Control-Allow-*`. Con un origen exacto (no `*`),
solo el frontend configurado puede llamar a la API.

**Mock timers (`node:test`).** Reemplazan `setInterval`/`setTimeout` por versiones que avanzan con
`mock.timers.tick(ms)`, para probar días de simulación en milisegundos.

### Ejemplo mínimo
```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/api/*', cors({ origin: 'http://localhost:5173', allowMethods: ['GET'] }));
app.get('/api/hello', (c) => c.json({ ok: true, at: new Date().toISOString() }));
serve({ fetch: app.fetch, port: 3000 });
// node hello.ts   →   curl.exe http://localhost:3000/api/hello
```

### Cómo usarlo
```powershell
cd mock-api
bun install
bun run dev                                  # tiempo real
$env:SIM_SPEED = "60"; bun run dev           # una lectura cada 5 s
curl.exe http://localhost:3000/api/readings/latest
curl.exe "http://localhost:3000/api/readings?from=2026-11-20T00:00:00-05:00&to=2026-11-21T00:00:00-05:00"
```

### Pendiente (API)
- Confirmar con el equipo del ESP32 las unidades y rangos (todo lo `PROVISIONAL`).
- Iteración 2: exponer los riegos en `GET /api/waterings` (ya se guardan en memoria).
- Fórmula del "porcentaje de vida": la define el equipo; no se ha implementado.
- Opcional: `SIM_START` para datos idénticos entre arranques; `.env` con `--env-file-if-exists`.

---

## 2026-11-22 · Dashboard, etapa 0: esqueleto de `web/`

### Qué se hizo
- `bun create vite web --template react-ts`; se borró el demo (logos, `App.css`, `index.css`, README).
- `vite.config.ts`: `server.port: 5173` + `strictPort: true`.
- `.env.example` (versionado) y `.env.local` (ignorado por `*.local` en `.gitignore`) con `VITE_API_URL`.
- `src/env.d.ts`: tipo de `import.meta.env.VITE_API_URL`.
- `src/config.ts`: valida la URL una vez y expone `API_URL`, `CONFIG_ERROR` y `REFRESH_MS`.
- `App.tsx`: cabecera "Maceta inteligente" + badge "Datos simulados"; si falta la URL, aviso en pantalla.
- `.claude/launch.json`: cómo arrancar `mock-api` y `web` desde el panel de vista previa de Claude.

### Por qué así
- **strictPort**: la API solo acepta CORS desde `http://localhost:5173`. Sin strictPort, si el puerto
  está ocupado Vite salta a 5174 y todas las peticiones fallan por CORS, con un error poco obvio.
- **Error de configuración en pantalla, no `throw`**: un `throw` al importar deja la página en blanco
  y el error solo se ve en la consola.

### Conceptos nuevos
**Variables de entorno en Vite.** Se leen de `.env`, `.env.local`, `.env.[modo]` al arrancar
(`bun run dev`) y se **incrustan en el código** al compilar: no son secretas. Solo las que empiezan
por `VITE_` llegan al navegador. Cambiar `.env.local` exige reiniciar el servidor de desarrollo.

**`tsc -b && vite build`.** Vite no revisa tipos (solo los borra, como Node con type stripping);
por eso el `build` corre primero `tsc -b`.

**oxlint.** La plantilla actual de Vite trae oxlint (linter en Rust, muy rápido) en vez de ESLint.

### Ejemplo mínimo
```ts
// src/env.d.ts
interface ImportMetaEnv { readonly VITE_API_URL?: string }
// cualquier archivo
const url = import.meta.env.VITE_API_URL // string | undefined
```

---

## 2026-11-22 · Dashboard, etapa 1: tarjetas con la última lectura

### Qué se hizo
| Archivo | Responsabilidad |
|---|---|
| `src/types.ts` | Contrato de la API (`Reading`, `ApiErrorBody`). |
| `src/api.ts` | `fetchLatest(signal)` y la clase `ApiError(code, status, message)`. 503 `NO_DATA` → `null`. |
| `src/usePolling.ts` | Hook: pide al montar y cada `REFRESH_MS`; devuelve `{ data, error, lastUpdated }`. |
| `src/time.ts` | `formatBogota(iso)` → "22 nov 2026, 12:35". |
| `src/format.ts` | `formatNumber(12790)` → "12 790"; `formatNumber(75.7, 1)` → "75,7". |
| `src/components/LatestCards.tsx` | Tarjetas de humedad y luz. |
| `src/App.tsx` | Sin `VITE_API_URL` no monta `Dashboard`; la cabecera muestra `deviceId` y la hora de la lectura. |

### Por qué así
- **Un solo tipo de error (`ApiError`)**: los componentes no distinguen entre "fetch rechazó",
  "HTTP 500" o "JSON raro"; leen `code` y `message`. `status: 0` = no hubo respuesta.
- **`NO_DATA` como `null`, no como error**: "todavía no hay lecturas" es un estado normal.
- **`data: undefined` vs `null`**: `undefined` = aún no llegó nada (cargando); `null` = la API
  respondió que no hay datos. Dos estados distintos, dos valores distintos.
- **`formatToParts`**: `es-CO` da "22 de nov de 2026" y "12.790"; se toman las piezas y se
  arman como en el mockup, sin parsear strings.

### Conceptos nuevos
**Limpieza de efectos.** La función que devuelve `useEffect` se ejecuta al desmontar y antes de
volver a correr el efecto. Ahí se hace `clearInterval` y `controller.abort()`; si no, quedan
intervalos huérfanos que siguen haciendo `setState`.

**StrictMode monta dos veces en desarrollo.** React monta, desmonta y vuelve a montar cada
componente para destapar efectos sin limpieza. Por eso en la pestaña Network verás dos peticiones
al cargar: la primera aparece cancelada. En producción ocurre una sola vez.

**`AbortController`.** `fetch(url, { signal })` se cancela con `controller.abort()`; la promesa
rechaza con `AbortError`. Se comprueba `signal.aborted` para no mostrar eso como error.

**Dependencias del efecto y referencias estables.** `usePolling(fetcher, …)` reinicia el efecto si
cambia `fetcher`. Una función de módulo (`fetchLatest`) es siempre la misma referencia; una flecha
escrita dentro del componente sería nueva en cada render (habrá que usar `useCallback`).

**`setState(prev => …)`.** Dentro de un callback asíncrono, `state` puede estar desactualizado
(closure viejo). La forma funcional siempre recibe el estado más reciente.

### Ejemplo mínimo
```ts
useEffect(() => {
  const controller = new AbortController()
  const tick = () => fetch(url, { signal: controller.signal }).then((r) => r.json()).then(setData)
  tick()
  const id = setInterval(tick, 30_000)
  return () => { controller.abort(); clearInterval(id) }
}, [])
```

---

## 2026-11-22 · Dashboard, etapa 2: gráfico de humedad de 24 h

### Qué se hizo
- `bun add recharts` (3.11).
- `types.ts`: `ReadingsResponse`. `api.ts`: `fetchReadings({ from?, to? }, signal)` con `URLSearchParams`.
- `time.ts`: `formatBogotaTime(ms)` → "16:00" y `hourTicks(min, max, 4)` → ticks en 00:00, 04:00, 08:00… de Bogotá.
- `components/ReadingsChart.tsx`: un gráfico de línea genérico (`field`, `title`, `unit`, `color`, `yDomain`).
- `App.tsx`: segundo `usePolling` con `fetchLast24h` y la sección "Histórico".

### Por qué así
- **Un componente para los dos gráficos**: humedad y luz solo cambian el campo, la unidad, el
  color y el eje Y. La etapa 3 es solo usarlo otra vez.
- **Eje X numérico (`type="number"`, `scale="time"`)**: con strings, Recharts pondría los puntos
  equidistantes aunque faltaran lecturas; con ms, la distancia en el eje es tiempo real.
- **Ticks calculados**: con los automáticos, Recharts los pone donde le parece (13:37, 17:37…).
- **`isAnimationActive={false}`**: cada refresco entrega un arreglo nuevo y la línea se volvería
  a dibujar animada desde cero cada 30 s.
- **`useMemo`**: transformar 288 lecturas es barato, pero así `data` conserva la misma referencia
  entre renders que no cambian las lecturas, y Recharts no recalcula de más.

### Conceptos nuevos
**Recharts es declarativo.** No se "dibuja" nada: se describe el gráfico con componentes
(`<LineChart><XAxis/><YAxis/><Line/></LineChart>`) y Recharts genera el SVG.
`ResponsiveContainer` mide el ancho del padre; necesita una altura fija o un padre con altura.

**`URLSearchParams` codifica.** En `?from=2026-11-22T10:00:00+01:00`, el `+` llegaría al servidor
como espacio. `params.set('from', valor)` lo convierte en `%2B`. (Con `-05:00` no pasa, pero el
cliente no debería depender de eso.)

**Zona horaria fija vs. `Intl`.** Para mostrar fechas, `Intl.DateTimeFormat` con `timeZone`; para
aritmética (ticks), el desfase −5 h basta porque Colombia no cambia de hora.

**Tamaño del bundle.** `vite build` avisa que el JS pasa de 500 kB: es Recharts (+ su dependencia
d3). Para una app de una sola pantalla no importa; se podría dividir con `import()` dinámico.

### Ejemplo mínimo
```tsx
<ResponsiveContainer width="100%" height={260}>
  <LineChart data={[{ t: 1, v: 10 }, { t: 2, v: 30 }]}>
    <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} />
    <YAxis />
    <Line dataKey="v" dot={false} isAnimationActive={false} />
  </LineChart>
</ResponsiveContainer>
```

---

## 2026-11-22 · Dashboard, etapa 3: gráfico de luz

### Qué se hizo
- `App.tsx`: segundo `<ReadingsChart field="light" … yStep={5000} />` con los mismos datos de 24 h
  (una sola petición alimenta los dos gráficos).
- `ReadingsChart.tsx`: prop `yStep`. El eje Y va de 0 al máximo de los datos redondeado hacia
  arriba a un múltiplo del paso, con un tick por paso (`stepAxis`).

### Por qué así
- **Reutilizar el componente** que se hizo genérico en la etapa 2: la etapa costó un `<ReadingsChart>` más.
- **`yStep` en vez de `domain={[0, 'auto']}`**: lo probé primero; Recharts eligió ticks de 3 500 en
  3 500 (0, 3 500, 7 000…), correctos pero difíciles de leer. Con el paso fijo salen 0, 5 000, 10 000…
- **Mínimo 0 siempre**: de noche la luz es 0 y la línea debe quedar sobre el eje, no flotando.
- **Al menos un paso de alto**: si todas las lecturas valen 0 (24 h nubladas o un sensor tapado),
  `max` sería 0 y el eje quedaría sin altura.

### Conceptos nuevos
**"Nice numbers" en ejes.** Los algoritmos automáticos reparten el rango en N ticks y redondean,
pero no saben qué unidades son "naturales" para el lector. Si conoces la magnitud, fija el paso.

**Una petición, varias vistas.** Los dos gráficos derivan del mismo `history.data`; no hace falta
pedir dos veces lo mismo ni sincronizar dos estados.

### Ejemplo mínimo
```ts
// 12 790 con paso 5000 → dominio [0, 15000], ticks [0, 5000, 10000, 15000]
const max = Math.max(step, Math.ceil(Math.max(0, ...values) / step) * step)
```

---

## 2026-11-22 · Dashboard, etapa 4: estados de carga, error y sin datos

### Qué se hizo
- `components/StatusMessage.tsx`: los tres estados del mockup (`loading` con skeleton, `error`
  con Reintentar, `empty`). Iconos como SVG en línea.
- `usePolling.ts`: `retry()` borra el error y reinicia el efecto (contador `attempt` en las deps).
- `api.ts`: timeout de 10 s con `AbortSignal.any([signal, AbortSignal.timeout(10_000)])`.
- `App.tsx`:
  - Sin nada cargado: **un** mensaje para toda la página (no uno por sección).
  - `latest === null` (503 `NO_DATA`): estado vacío.
  - Ya con datos: `PollSection` maneja cada sección; si un refresco falla, se conservan los
    datos y aparece "No se pudo actualizar. Mostrando datos recibidos a las hh:mm. Reintentar".
  - Cabecera: punto verde "API conectada" / rojo "Sin conexión".

### Por qué así
- **Error de red vs. error de la API**: con `status 0` se muestra el texto del mockup ("Comprueba
  que la API esté encendida…"); si la API respondió 4xx/5xx, se muestra su `message`.
- **No borrar datos por un fallo puntual**: si un refresco falla, la última lectura válida sigue siendo útil.
- **Timeout**: lo destapó una prueba. Con un `fetch` colgado, la guarda `inFlight` de `usePolling`
  impedía lanzar más peticiones y el dashboard se congelaba sin avisar.

### Cómo se probó sin apagar la API
- **API caída**: una segunda copia del frontend con otra URL. Las variables del proceso ganan a
  `.env.local`: `$env:VITE_API_URL = 'http://localhost:3999'; bun run dev --port 5180`.
- **Carga, timeout y vacío**: reemplazando `window.fetch` desde la consola por una promesa que
  nunca resuelve, o por un `new Response(..., { status: 503 })` falso.
- **Fallo en un refresco**: `window.fetch = () => Promise.reject(new TypeError())` y esperar 30 s.

### Conceptos nuevos
**Unión discriminada.** `type Props = { kind: 'loading' } | { kind: 'error'; error; onRetry } | …`.
Dentro de `case 'error'`, TypeScript sabe que existe `props.onRetry`; en `case 'loading'`, no.

**Render props.** `<PollSection>{(data) => <Chart data={data} />}</PollSection>`: `children` es
una función, y el componente decide cuándo llamarla (solo cuando hay datos).

**Reiniciar un efecto a propósito.** Un estado que solo está en la lista de dependencias
(`attempt`) sirve de "botón de reinicio": cambiarlo ejecuta la limpieza y luego el efecto otra vez.

**`AbortSignal.any` / `AbortSignal.timeout`.** Combinan señales: la petición se cancela con la
primera que se active. El timeout rechaza con un `DOMException` de nombre `TimeoutError`.

### Ejemplo mínimo
```ts
const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)])
try { await fetch(url, { signal }) }
catch (e) { if (e instanceof DOMException && e.name === 'TimeoutError') console.log('tardó demasiado') }
```

---

## 2026-11-22 · Dashboard, etapa 5: estilos según el mockup

### Qué se hizo
- `index.html`: Inter (texto) y Space Grotesk (títulos y cifras) desde Google Fonts.
- `styles.css` reescrito con **tokens** en `:root` (`--color-*`, `--font-*`, `--radius-*`) y
  secciones: cabecera, tarjetas, histórico, estados, botones.
- Tarjetas: punto de color de la serie antes de la etiqueta, cifra grande con `tabular-nums`.
- `ReadingsChart`: encabezado con "Últimas 24 horas" a la derecha, solo líneas de cuadrícula
  horizontales, ejes en gris sin marcas, punto en la última lectura (`ReferenceDot`) y tooltip
  con nombre corto (`seriesName`: "Humedad · 76,5 %" en vez de repetir la unidad).
- Móvil (375 px): sin scroll horizontal; el eje X omite los ticks que se pisarían.

### Por qué así
- **Tokens en variables CSS**: un color se cambia en un solo lugar; los nombres dicen el
  propósito (`--color-moisture`), no el valor (`--blue`).
- **`clamp(min, preferido, max)`** en el título y las cifras: crecen con el ancho de la pantalla
  sin media queries.
- **`ReferenceDot` en vez de `dot={función}`**: marcar un punto concreto por sus coordenadas de
  datos es más simple que filtrar por índice dentro de una función de render.
- **Colores de ejes como constantes en TS**: Recharts los escribe como atributos del SVG; se dejan
  junto al componente en vez de depender de `var()` dentro de atributos.

### Conceptos nuevos
**`font-variant-numeric: tabular-nums`.** Todas las cifras ocupan el mismo ancho: al cambiar de
55,5 a 55,6 el número no se mueve horizontalmente.

**`display=swap` y `preconnect`.** `swap` muestra la fuente del sistema mientras carga la web (en
vez de texto invisible). `preconnect` abre la conexión TLS a Google Fonts antes de necesitarla.
Sin internet, la página sigue funcionando con la fuente de respaldo.

**`interval="preserveStartEnd"` + `minTickGap`.** Recharts mide los ticks y omite los que se
pisarían, conservando el primero y el último. Funciona también con `ticks` calculados a mano.

### Ejemplo mínimo
```css
:root { --color-moisture: #2f6fbf; }
.metric--moisture .metric__label::before { background: var(--color-moisture); }
.metric__value { font-size: clamp(2.75rem, 7vw, 3.5rem); font-variant-numeric: tabular-nums; }
```

---

## 2026-11-22 · Dashboard, etapa 6a: tabla de lecturas con orden y paginación

### Qué se hizo
- `components/ReadingsTable.tsx`: columnas Fecha y hora · Humedad (%) · Luz (lx), definidas en un
  arreglo `COLUMNS` (etiqueta, si es numérica y cómo se muestra). Orden por clic en el encabezado
  (`aria-sort`, flecha ↓/↑), por defecto fecha descendente. Paginación de 10 en 10 con
  "Mostrando 1–10 de 289", Anterior / "Página x de y" / Siguiente.
- `App.tsx`: tarjeta "Lecturas" con "N lecturas en el rango"; por ahora usa las mismas 24 h.
- `styles.css`: tabla con cifras alineadas a la derecha y scroll horizontal dentro de la tarjeta en móvil.

### Por qué así
- **Columnas como datos**: el encabezado y las filas se generan del mismo arreglo; añadir una
  columna es una línea.
- **Ordenar una copia** (`[...readings].sort()`): `sort` modifica el arreglo y `readings` viene de props.
- **Página derivada** (`current = Math.min(page, pageCount - 1)`) en vez de un `useEffect` que
  "corrija" `page` cuando cambian los datos: menos estado, sin render extra.
- **Botones dentro de `<th>`**: el orden se puede usar con teclado (Tab + Enter).

### Errores que aparecieron al probar
- **Clics rápidos perdidos.** `setPage(current + 1)` usa el `current` del último render; 40 clics
  seguidos avanzaban una sola página. Solución: `setPage((p) => p + 1)` (con límites).
- **Especificidad CSS.** `.table td { text-align: left }` (0,1,1) ganaba a `.table__num { text-align:
  right }` (0,1,0). Solución: `.table .table__num` (0,2,0).
- **Error viejo en la consola.** Tras editar `App.tsx` en dos pasos (uso y luego import), HMR cargó
  el estado intermedio y dejó un `ReferenceError` en el log; la página ya estaba bien. En una pestaña
  nueva, consola limpia. Lección: mirar la marca `?t=` del módulo antes de perseguir un error.

### Conceptos nuevos
**Especificidad.** Se cuenta (ids, clases/atributos/pseudoclases, elementos). Gana el número mayor
comparando de izquierda a derecha; si empatan, gana la regla que va después.

**`aria-sort`.** En el `<th>`: `ascending`, `descending` o `none`. Los lectores de pantalla lo
anuncian; la flecha visual es `aria-hidden` para no leerla dos veces.

### Ejemplo mínimo
```ts
const sorted = useMemo(() => [...rows].sort((a, b) => dir * (a[key] - b[key])), [rows, key, dir])
const pageCount = Math.max(1, Math.ceil(sorted.length / 10))
const current = Math.min(page, pageCount - 1)          // derivado, no sincronizado
const visible = sorted.slice(current * 10, current * 10 + 10)
```
