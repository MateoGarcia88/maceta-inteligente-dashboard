/**
 * Configuración del servidor leída de variables de entorno.
 *
 * Se valida una sola vez al arrancar: si algún valor es inválido, se lanza un
 * error que lista todos los problemas, en vez de fallar más tarde de forma confusa.
 */

export interface Config {
  /** Puerto HTTP del servidor. */
  port: number;
  /** Único origen al que se permite CORS (el frontend en desarrollo). */
  corsOrigin: string;
  /** Semilla del generador aleatorio: misma semilla → mismos datos simulados. */
  simSeed: number;
  /** Multiplicador de velocidad: 1 = tiempo real (una lectura cada 5 min), 60 = una lectura cada 5 s. */
  simSpeed: number;
}

const DEFAULTS: Config = {
  port: 3000,
  corsOrigin: 'http://localhost:5173',
  simSeed: 42,
  simSpeed: 1,
};

/** Con 3600, una lectura llega cada ~83 ms: más rápido no aporta y satura el log/la memoria. */
const MAX_SIM_SPEED = 3600;
/** El generador con semilla trabaja con enteros sin signo de 32 bits. */
const MAX_SEED = 2 ** 32 - 1;

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  const errors: string[] = [];

  const port = parseOptional(env, 'PORT', DEFAULTS.port, errors, (raw) =>
    parseInteger(raw, 1, 65535),
  );
  const corsOrigin = parseOptional(env, 'CORS_ORIGIN', DEFAULTS.corsOrigin, errors, parseOrigin);
  const simSeed = parseOptional(env, 'SIM_SEED', DEFAULTS.simSeed, errors, (raw) =>
    parseInteger(raw, 0, MAX_SEED),
  );
  const simSpeed = parseOptional(env, 'SIM_SPEED', DEFAULTS.simSpeed, errors, (raw) =>
    parsePositiveNumber(raw, MAX_SIM_SPEED),
  );

  if (errors.length > 0) {
    throw new Error(`Configuración inválida:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
  return { port, corsOrigin, simSeed, simSpeed };
}

/**
 * Lee una variable; si no está definida (o está vacía) usa el valor por defecto.
 * Si el parser falla, guarda el mensaje en `errors` y devuelve el valor por defecto
 * para poder seguir validando las demás variables.
 */
function parseOptional<T>(
  env: Env,
  name: string,
  fallback: T,
  errors: string[],
  parse: (raw: string) => T,
): T {
  const raw = env[name]?.trim();
  if (raw === undefined || raw === '') return fallback;
  try {
    return parse(raw);
  } catch (err) {
    errors.push(`${name}="${raw}": ${(err as Error).message}`);
    return fallback;
  }
}

function parseInteger(raw: string, min: number, max: number): number {
  if (!/^\d+$/.test(raw)) throw new Error('debe ser un entero sin signo');
  const value = Number(raw);
  if (value < min || value > max) throw new Error(`debe estar entre ${min} y ${max}`);
  return value;
}

function parsePositiveNumber(raw: string, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > max) {
    throw new Error(`debe ser un número mayor que 0 y menor o igual a ${max}`);
  }
  return value;
}

/** Exige un origen exacto (protocolo + host + puerto), p. ej. "http://localhost:5173", sin ruta ni "/" final. */
function parseOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('no es una URL válida');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('debe usar http o https');
  }
  if (url.origin !== raw) {
    throw new Error(`debe ser solo el origen, sin ruta ni "/" final (¿quisiste decir "${url.origin}"?)`);
  }
  return raw;
}
