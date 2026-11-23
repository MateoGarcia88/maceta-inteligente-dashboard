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

### Pendiente
- Confirmar con el equipo del ESP32 las unidades y rangos (todo lo `PROVISIONAL`).
- Iteración 2: exponer los riegos en `GET /api/waterings` (ya se guardan en memoria).
- Fórmula del "porcentaje de vida": la define el equipo; no se ha implementado.
- Opcional: `SIM_START` para datos idénticos entre arranques; `.env` con `--env-file-if-exists`.
