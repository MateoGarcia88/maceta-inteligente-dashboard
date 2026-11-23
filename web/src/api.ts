/**
 * Cliente de la API. Cada función devuelve datos ya tipados o lanza un `ApiError`,
 * así los componentes manejan un solo tipo de error.
 */

import { API_URL } from './config.ts'
import type { ApiErrorBody, Reading, ReadingsResponse } from './types.ts'

/** `status` 0 = no hubo respuesta (API apagada, red caída, CORS). */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/**
 * fetch no tiene timeout: una petición colgada no termina nunca y, como usePolling no lanza
 * otra mientras haya una en curso, el dashboard dejaría de actualizarse.
 */
const REQUEST_TIMEOUT_MS = 10_000

/** GET a la API y parseo del JSON. Lanza ApiError si no hay respuesta o si no es 2xx. */
async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  let res: Response
  try {
    // Se cancela si lo pide quien llama (signal) o si pasan 10 s, lo que ocurra primero.
    const combined = AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
    res = await fetch(`${API_URL}${path}`, { signal: combined })
  } catch (err) {
    // Si nosotros cancelamos la petición, se propaga tal cual (no es un fallo de la API).
    if (signal.aborted) throw err
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError('TIMEOUT', 0, 'La API tardó demasiado en responder.')
    }
    // fetch solo rechaza cuando no hay respuesta HTTP: servidor apagado, red o CORS.
    throw new ApiError('NETWORK', 0, 'No se pudo conectar con la API.')
  }

  if (!res.ok) {
    // Los errores de la API traen { error: { code, message } }; si no, mensaje genérico.
    const body = (await res.json().catch(() => null)) as Partial<ApiErrorBody> | null
    throw new ApiError(
      body?.error?.code ?? 'HTTP_ERROR',
      res.status,
      body?.error?.message ?? `La API respondió con el estado ${res.status}.`,
    )
  }
  return (await res.json()) as T
}

/** La lectura más reciente, o `null` si la API aún no tiene datos (503 NO_DATA). */
export async function fetchLatest(signal: AbortSignal): Promise<Reading | null> {
  try {
    return await getJson<Reading>('/api/readings/latest', signal)
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NO_DATA') return null
    throw err
  }
}

export interface ReadingsRange {
  /** ISO 8601 con zona. Sin `from`/`to`, la API usa las 24 h que terminan en la última lectura. */
  from?: string
  to?: string
}

/** Lecturas de un rango, en orden cronológico. */
export function fetchReadings(range: ReadingsRange, signal: AbortSignal): Promise<ReadingsResponse> {
  // URLSearchParams codifica los valores: el "+" de "+01:00" llegaría como espacio si no.
  const params = new URLSearchParams()
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  const query = params.toString()
  return getJson<ReadingsResponse>(`/api/readings${query ? `?${query}` : ''}`, signal)
}
