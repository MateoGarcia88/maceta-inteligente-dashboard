/**
 * Cliente de la API. Cada función devuelve datos ya tipados o lanza un `ApiError`,
 * así los componentes manejan un solo tipo de error.
 */

import { API_URL } from './config.ts'
import type { ApiErrorBody, Reading } from './types.ts'

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

/** GET a la API y parseo del JSON. Lanza ApiError si no hay respuesta o si no es 2xx. */
async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { signal })
  } catch (err) {
    // Si nosotros cancelamos la petición, se propaga tal cual (no es un fallo de la API).
    if (signal.aborted) throw err
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
