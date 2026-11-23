/**
 * Contrato de la API (copiado de mock-api/src/simulator.ts y server.ts).
 * Si la API cambia, este es el único archivo del frontend que hay que tocar.
 */

/** Una lectura del sensor. */
export interface Reading {
  deviceId: string
  /** ISO 8601 en UTC, p. ej. "2026-11-22T17:35:00.000Z". */
  timestamp: string
  /** Humedad del sustrato, 0–100 %, con 1 decimal. */
  soilMoisture: number
  /** Luz en lux, entero. */
  light: number
}

/** Respuesta de GET /api/readings. */
export interface ReadingsResponse {
  /** Inicio y fin del rango que usó la API (UTC). */
  from: string
  to: string
  count: number
  /** `true` si había más de 5000 lecturas: vienen las 5000 más recientes. */
  truncated: boolean
  /** En orden cronológico (la más antigua primero). */
  readings: Reading[]
}

/** Cuerpo de las respuestas con error: { "error": { "code": "...", "message": "..." } }. */
export interface ApiErrorBody {
  error: { code: string; message: string }
}
