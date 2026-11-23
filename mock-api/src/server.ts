/**
 * Servidor HTTP de la API simulada.
 *
 *   GET /api/readings/latest      → la lectura más reciente.
 *   GET /api/readings?from=&to=   → { from, to, count, truncated, readings } en ese rango.
 *
 * Todas las fechas de las respuestas van en UTC ("Z"). Los errores tienen la forma
 * { "error": { "code": "...", "message": "..." } }.
 */

import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { loadConfig, type Config } from './config.ts';
import { createStore } from './store.ts';

/** Máximo de lecturas por respuesta de /api/readings. */
const MAX_READINGS_PER_RESPONSE = 5000;
/** Rango por defecto de /api/readings cuando falta `from` y/o `to`. */
const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;

let config: Config;
try {
  config = loadConfig();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

const store = createStore({ simSeed: config.simSeed, simSpeed: config.simSpeed });
store.start();

const app = new Hono();

// Solo el frontend de desarrollo puede llamar a la API desde el navegador.
app.use('/api/*', cors({ origin: config.corsOrigin, allowMethods: ['GET'] }));

app.get('/api/readings/latest', (c) => {
  const latest = store.latest();
  if (!latest) return apiError(c, 503, 'NO_DATA', 'Todavía no hay lecturas.');
  return c.json(latest);
});

app.get('/api/readings', (c) => {
  // Un parámetro vacío (`?from=`) cuenta como ausente.
  const fromRaw = c.req.query('from')?.trim() || undefined;
  const toRaw = c.req.query('to')?.trim() || undefined;

  const fromParsed = fromRaw === undefined ? undefined : parseInstant(fromRaw);
  if (fromParsed === null) return apiError(c, 400, 'INVALID_DATE', invalidDateMessage('from', fromRaw!));
  const toParsed = toRaw === undefined ? undefined : parseInstant(toRaw);
  if (toParsed === null) return apiError(c, 400, 'INVALID_DATE', invalidDateMessage('to', toRaw!));

  // Por defecto: las 24 h que terminan en la última lectura (el reloj simulado, no el real).
  const latest = store.latest();
  const toMs = toParsed ?? (latest ? Date.parse(latest.timestamp) : Date.now());
  const fromMs = fromParsed ?? toMs - DEFAULT_RANGE_MS;

  if (fromMs > toMs) {
    return apiError(
      c,
      400,
      'INVALID_RANGE',
      `"from" (${toIso(fromMs)}) es posterior a "to" (${toIso(toMs)})` +
        (toParsed === undefined ? '; "to" por defecto es la última lectura.' : '.'),
    );
  }

  const { readings, truncated } = store.range(fromMs, toMs, MAX_READINGS_PER_RESPONSE);
  return c.json({ from: toIso(fromMs), to: toIso(toMs), count: readings.length, truncated, readings });
});

app.notFound((c) => apiError(c, 404, 'NOT_FOUND', `Ruta no encontrada: ${c.req.method} ${c.req.path}`));

app.onError((err, c) => {
  console.error(err);
  return apiError(c, 500, 'INTERNAL_ERROR', 'Error interno del servidor.');
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  const latest = store.latest();
  console.log(`Mock API escuchando en http://localhost:${info.port}`);
  console.log(`  CORS permitido para: ${config.corsOrigin}`);
  console.log(`  Semilla: ${config.simSeed} · Velocidad: x${config.simSpeed}`);
  console.log(`  Última lectura simulada: ${latest?.timestamp ?? '(ninguna)'}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`El puerto ${config.port} ya está en uso. Usa otro con la variable PORT.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

// Ctrl+C (o el reinicio de `node --watch`): detener la simulación y cerrar el servidor.
function shutdown(): void {
  store.stop();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─────────────────────────────── utilidades ───────────────────────────────

function apiError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function invalidDateMessage(param: string, raw: string): string {
  return (
    `"${param}" debe ser una fecha ISO 8601 con zona horaria, ` +
    `p. ej. 2026-11-22T10:00:00Z o 2026-11-22T05:00:00-05:00. Recibido: "${raw}".`
  );
}

/**
 * Convierte "AAAA-MM-DDTHH:mm[:ss[.fff]](Z|±HH:mm)" en ms desde 1970 (UTC), o `null` si no es válida.
 *
 * No se usa `Date.parse` a secas porque es permisivo: acepta fechas sin zona (las interpreta
 * en la hora local del PC) y "corrige" fechas imposibles (2026-02-30 → 2 de marzo).
 */
function parseInstant(raw: string): number | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(raw);
  if (!match) return null;

  const [, y, mo, d, h, mi, s = '0', frac = '0', zone, sign, offH = '0', offM = '0'] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  const offsetHours = Number(offH);
  const offsetMinutes = Number(offM);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  if (offsetHours > 23 || offsetMinutes > 59) return null;

  const millis = Number(frac.padEnd(3, '0').slice(0, 3));
  const offsetMs = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (offsetHours * 60 + offsetMinutes) * 60_000;
  return Date.UTC(year, month - 1, day, hour, minute, second, millis) - offsetMs;
}
