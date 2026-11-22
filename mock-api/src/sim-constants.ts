/**
 * Constantes de la simulación, en un único lugar.
 *
 * Hay dos grupos:
 *  - DECIDIDAS: acordadas en el plan; no deberían cambiar sin hablarlo.
 *  - PROVISIONALES: valores inventados para que los datos "se vean bien".
 *    NINGUNA está confirmada con el equipo del ESP32 (ni siquiera las unidades).
 *    Ajustarlas aquí cuando haya datos reales; nada más del código las hardcodea.
 */

// ─────────────────────────────── DECIDIDAS ───────────────────────────────

/** Identificador del único dispositivo simulado. */
export const DEVICE_ID = 'maceta-01';

/** Una lectura cada 5 minutos (tiempo simulado). */
export const READING_INTERVAL_MS = 5 * 60 * 1000;

/** Días de histórico generados al arrancar. */
export const HISTORY_DAYS = 7;

/**
 * Desfase de America/Bogota respecto a UTC, en horas. Colombia no tiene horario de
 * verano, así que un desfase fijo es correcto todo el año. Solo se usa para el ciclo
 * diurno; la API siempre responde en UTC ("Z").
 */
export const BOGOTA_UTC_OFFSET_HOURS = -5;

// ───────────────────────────── PROVISIONALES ─────────────────────────────

// --- Luz (lux) ---

/** PROVISIONAL. Hora local de salida del sol. Bogotá, cerca del ecuador, varía poco en el año. */
export const SUNRISE_HOUR = 6;
/** PROVISIONAL. Hora local de puesta del sol. */
export const SUNSET_HOUR = 18;
/** PROVISIONAL. Lux al mediodía con cielo despejado (maceta junto a una ventana). */
export const PEAK_LIGHT_LUX = 15_000;

/** PROVISIONAL. Nubosidad media como fracción de luz que pasa (1 = despejado). */
export const CLOUD_MEAN = 0.75;
/** PROVISIONAL. Fracción mínima de luz en el día más nublado. */
export const CLOUD_MIN = 0.25;
/** PROVISIONAL. Fracción máxima de luz (cielo despejado). */
export const CLOUD_MAX = 1;
/** PROVISIONAL. Qué tan rápido vuelve la nubosidad a su media en cada lectura (0–1). */
export const CLOUD_REVERSION = 0.05;
/** PROVISIONAL. Cambio aleatorio máximo de nubosidad entre dos lecturas. */
export const CLOUD_MAX_STEP = 0.04;
/** PROVISIONAL. Ruido del sensor de luz, como fracción del valor (±3 %). */
export const LIGHT_NOISE_RATIO = 0.03;

// --- Humedad del sustrato (%) ---

/** PROVISIONAL. Rango de humedad inicial al comenzar el histórico. */
export const MOISTURE_INITIAL_MIN = 60;
export const MOISTURE_INITIAL_MAX = 80;
/** PROVISIONAL. Puntos de humedad que se pierden por hora, sin luz. */
export const DRYING_BASE_PER_HOUR = 0.4;
/** PROVISIONAL. Puntos extra por hora a máxima luz (la luz acelera el secado). */
export const DRYING_LIGHT_PER_HOUR = 1.4;
/** PROVISIONAL. Ruido del sensor de humedad, en puntos (±0.3). */
export const MOISTURE_NOISE = 0.3;

// --- Riegos ---

/** PROVISIONAL. Por debajo de esta humedad alguien podría regar. */
export const WATERING_THRESHOLD = 35;
/** PROVISIONAL. Rango de humedad tras un riego. */
export const WATERING_TARGET_MIN = 78;
export const WATERING_TARGET_MAX = 90;
/** PROVISIONAL. Probabilidad de riego en cada lectura bajo el umbral (~1 riego cada 3 h de espera). */
export const WATERING_CHANCE_PER_READING = 0.03;
/** PROVISIONAL. Horas locales en que alguien riega (de 7:00 a 21:00). */
export const WATERING_START_HOUR = 7;
export const WATERING_END_HOUR = 21;

// --- Memoria ---

/** PROVISIONAL. Días simulados que se conservan en memoria; lo más viejo se descarta. */
export const RETENTION_DAYS = 30;
