/**
 * Simulador de la maceta: produce una lectura cada `READING_INTERVAL_MS` de tiempo simulado.
 *
 * Modelo (todos los números viven en sim-constants.ts):
 *  - Luz: curva seno entre la salida y la puesta del sol (hora de Bogotá), 0 de noche,
 *    multiplicada por una nubosidad que cambia suavemente (no salta al azar).
 *  - Humedad: baja de forma continua, más rápido con más luz. Bajo un umbral, y solo en
 *    horas en que alguien está despierto, hay una probabilidad de riego que la sube.
 *
 * El simulador no sabe nada de HTTP ni de almacenamiento: solo avanza el tiempo y
 * devuelve lo que pasó. Guardar lecturas y riegos es trabajo de store.ts.
 */

import { createRandom } from './random.ts';
import {
  BOGOTA_UTC_OFFSET_HOURS,
  CLOUD_MAX,
  CLOUD_MAX_STEP,
  CLOUD_MEAN,
  CLOUD_MIN,
  CLOUD_REVERSION,
  DEVICE_ID,
  DRYING_BASE_PER_HOUR,
  DRYING_LIGHT_PER_HOUR,
  LIGHT_NOISE_RATIO,
  MOISTURE_INITIAL_MAX,
  MOISTURE_INITIAL_MIN,
  MOISTURE_NOISE,
  PEAK_LIGHT_LUX,
  READING_INTERVAL_MS,
  SUNRISE_HOUR,
  SUNSET_HOUR,
  WATERING_CHANCE_PER_READING,
  WATERING_END_HOUR,
  WATERING_START_HOUR,
  WATERING_TARGET_MAX,
  WATERING_TARGET_MIN,
  WATERING_THRESHOLD,
} from './sim-constants.ts';

/** Una lectura, tal como la define el contrato (provisional) con el equipo del ESP32. */
export interface Reading {
  deviceId: string;
  /** ISO 8601 en UTC, p. ej. "2026-11-22T15:05:00.000Z". */
  timestamp: string;
  /** Humedad del sustrato, 0–100 %. */
  soilMoisture: number;
  /** Luz en lux. */
  light: number;
}

/** Un riego. Se guarda internamente; todavía no se expone por la API (/api/waterings, iteración 2). */
export interface WateringEvent {
  deviceId: string;
  timestamp: string;
  moistureBefore: number;
  moistureAfter: number;
}

export interface SimulationStep {
  reading: Reading;
  /** El riego ocurrido en esta lectura, o `null` si no hubo. */
  watering: WateringEvent | null;
}

export interface Simulator {
  /** Avanza una lectura en el tiempo simulado y devuelve lo que pasó. */
  step(): SimulationStep;
  /** Instante (ms desde 1970, UTC) de la próxima lectura que producirá `step()`. */
  readonly nextTimestampMs: number;
}

const MS_PER_HOUR = 60 * 60 * 1000;
const INTERVAL_HOURS = READING_INTERVAL_MS / MS_PER_HOUR;

export function createSimulator(seed: number, startMs: number): Simulator {
  const rng = createRandom(seed);
  let timeMs = startMs;
  let moisture = rng.between(MOISTURE_INITIAL_MIN, MOISTURE_INITIAL_MAX);
  let cloud = CLOUD_MEAN;

  function step(): SimulationStep {
    // Se sacan SIEMPRE los mismos 5 números aleatorios por lectura, aunque alguno no se
    // use (p. ej. si no hay riego). Así la secuencia no se "desalinea" según lo que pase,
    // y cambiar una regla no altera todos los valores aleatorios posteriores.
    const cloudDelta = rng.between(-CLOUD_MAX_STEP, CLOUD_MAX_STEP);
    const lightNoise = rng.between(-LIGHT_NOISE_RATIO, LIGHT_NOISE_RATIO);
    const wateringRoll = rng.next();
    const wateringTarget = rng.between(WATERING_TARGET_MIN, WATERING_TARGET_MAX);
    const moistureNoise = rng.between(-MOISTURE_NOISE, MOISTURE_NOISE);

    const hour = bogotaHour(timeMs);
    const timestamp = new Date(timeMs).toISOString();

    // Luz: la nubosidad tiende a su media (CLOUD_REVERSION) y se mueve un poco al azar.
    cloud = clamp(cloud + CLOUD_REVERSION * (CLOUD_MEAN - cloud) + cloudDelta, CLOUD_MIN, CLOUD_MAX);
    const lux = Math.max(0, PEAK_LIGHT_LUX * daylightFactor(hour) * cloud * (1 + lightNoise));

    // Humedad: se seca con una parte fija más una parte proporcional a la luz.
    const dryingPerHour = DRYING_BASE_PER_HOUR + DRYING_LIGHT_PER_HOUR * (lux / PEAK_LIGHT_LUX);
    moisture = clamp(moisture - dryingPerHour * INTERVAL_HOURS, 0, 100);

    // Riego: solo bajo el umbral, en horas de vigilia y con cierta probabilidad.
    let watering: WateringEvent | null = null;
    const someoneAwake = hour >= WATERING_START_HOUR && hour < WATERING_END_HOUR;
    if (moisture < WATERING_THRESHOLD && someoneAwake && wateringRoll < WATERING_CHANCE_PER_READING) {
      const before = moisture;
      moisture = wateringTarget;
      watering = {
        deviceId: DEVICE_ID,
        timestamp,
        moistureBefore: round1(before),
        moistureAfter: round1(moisture),
      };
    }

    // El ruido del sensor se aplica solo al valor reportado, no al estado: si se sumara al
    // estado, se acumularía lectura tras lectura como un paseo aleatorio.
    const reading: Reading = {
      deviceId: DEVICE_ID,
      timestamp,
      soilMoisture: round1(clamp(moisture + moistureNoise, 0, 100)),
      light: Math.round(lux),
    };

    timeMs += READING_INTERVAL_MS;
    return { reading, watering };
  }

  return {
    step,
    get nextTimestampMs() {
      return timeMs;
    },
  };
}

/** Hora local de Bogotá con decimales (p. ej. 13.5 = 13:30). */
function bogotaHour(utcMs: number): number {
  const local = new Date(utcMs + BOGOTA_UTC_OFFSET_HOURS * MS_PER_HOUR);
  // Se leen los campos "UTC" de una fecha ya desplazada: evita depender de la zona del PC.
  return local.getUTCHours() + local.getUTCMinutes() / 60;
}

/** 0 de noche; de día, un arco seno que vale 1 a mitad de camino entre amanecer y atardecer. */
function daylightFactor(hour: number): number {
  if (hour <= SUNRISE_HOUR || hour >= SUNSET_HOUR) return 0;
  return Math.sin((Math.PI * (hour - SUNRISE_HOUR)) / (SUNSET_HOUR - SUNRISE_HOUR));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
