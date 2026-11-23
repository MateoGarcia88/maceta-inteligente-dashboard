/**
 * Almacén en memoria de lecturas y riegos.
 *
 * - Al crearse genera HISTORY_DAYS de histórico que terminan en el último múltiplo
 *   de 5 min antes de "ahora".
 * - `start()` sigue generando una lectura cada READING_INTERVAL_MS / simSpeed de tiempo
 *   real. Con simSpeed > 1 el reloj simulado se adelanta al real (lecturas "futuras").
 * - Conserva RETENTION_DAYS de tiempo simulado; lo más viejo se descarta.
 *
 * Las lecturas se guardan ordenadas por tiempo, así que buscar un rango es una búsqueda
 * binaria (O(log n)) en vez de recorrer todo el arreglo.
 */

import { HISTORY_DAYS, READING_INTERVAL_MS, RETENTION_DAYS } from './sim-constants.ts';
import { createSimulator, type Reading, type WateringEvent } from './simulator.ts';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RangeResult {
  readings: Reading[];
  /** `true` si había más lecturas que `limit` en el rango y se recortaron. */
  truncated: boolean;
}

export interface ReadingStore {
  /** La lectura más reciente, o `undefined` si aún no hay ninguna. */
  latest(): Reading | undefined;
  /**
   * Lecturas con `fromMs <= timestamp <= toMs`, en orden cronológico.
   * Si hay más de `limit`, devuelve las `limit` más recientes del rango.
   */
  range(fromMs: number, toMs: number, limit: number): RangeResult;
  /** Riegos generados por el simulador. Interno: aún no se expone por la API. */
  waterings(): readonly WateringEvent[];
  /** Empieza a generar lecturas en vivo. Llamarlo dos veces no crea dos temporizadores. */
  start(): void;
  /** Detiene la generación en vivo. */
  stop(): void;
}

export interface StoreOptions {
  simSeed: number;
  simSpeed: number;
  /** "Ahora" en ms; se puede fijar para pruebas. Por defecto, `Date.now()`. */
  nowMs?: number;
}

export function createStore({ simSeed, simSpeed, nowMs = Date.now() }: StoreOptions): ReadingStore {
  // `times[i]` es el timestamp en ms de `readings[i]`: comparar números es más simple
  // y rápido que parsear el string ISO en cada búsqueda.
  const times: number[] = [];
  const readings: Reading[] = [];
  const wateringEvents: WateringEvent[] = [];

  const lastHistoryMs = Math.floor(nowMs / READING_INTERVAL_MS) * READING_INTERVAL_MS;
  const firstHistoryMs = lastHistoryMs - HISTORY_DAYS * MS_PER_DAY + READING_INTERVAL_MS;
  const simulator = createSimulator(simSeed, firstHistoryMs);

  function addNext(): void {
    const timeMs = simulator.nextTimestampMs;
    const { reading, watering } = simulator.step();
    times.push(timeMs);
    readings.push(reading);
    if (watering) wateringEvents.push(watering);
  }

  /** Borra lo anterior a RETENTION_DAYS antes de la última lectura. */
  function prune(): void {
    const cutoffMs = times[times.length - 1]! - RETENTION_DAYS * MS_PER_DAY;
    const firstKept = lowerBound(times, cutoffMs);
    if (firstKept > 0) {
      times.splice(0, firstKept);
      readings.splice(0, firstKept);
    }
    const firstWateringKept = wateringEvents.findIndex((w) => Date.parse(w.timestamp) >= cutoffMs);
    if (firstWateringKept > 0) wateringEvents.splice(0, firstWateringKept);
  }

  // Histórico: HISTORY_DAYS × 288 lecturas (2016 con los valores actuales).
  while (simulator.nextTimestampMs <= lastHistoryMs) addNext();

  let timer: NodeJS.Timeout | undefined;

  return {
    latest: () => readings[readings.length - 1],

    range(fromMs, toMs, limit) {
      const end = upperBound(times, toMs); // primer índice con timestamp > toMs
      let begin = lowerBound(times, fromMs); // primer índice con timestamp >= fromMs
      const truncated = end - begin > limit;
      if (truncated) begin = end - limit;
      return { readings: readings.slice(begin, end), truncated };
    },

    waterings: () => wateringEvents,

    start() {
      if (timer) return;
      timer = setInterval(() => {
        addNext();
        prune();
      }, READING_INTERVAL_MS / simSpeed);
    },

    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  };
}

/** Primer índice `i` con `sorted[i] >= value` (o `sorted.length` si no hay). */
function lowerBound(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Primer índice `i` con `sorted[i] > value` (o `sorted.length` si no hay). */
function upperBound(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
