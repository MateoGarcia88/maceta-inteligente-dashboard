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
