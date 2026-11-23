/**
 * Hook que pide datos al montar y luego cada `intervalMs`.
 *
 * - `fetcher` debe ser estable (una función de módulo o envuelta en useCallback): si cambia
 *   en cada render, el efecto se reinicia en cada render.
 * - Al desmontar (o si cambia `fetcher`), se cancela la petición en curso y el intervalo.
 * - Si una petición tarda más que el intervalo, no se lanza otra encima.
 * - Si un refresco falla, se conservan los datos anteriores y se guarda el error.
 */

import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api.ts'

export interface PollingState<T> {
  /** `undefined` hasta la primera respuesta correcta. */
  data: T | undefined
  /** Error de la última petición; `null` si fue bien. */
  error: ApiError | null
  /** Cuándo llegó la última respuesta correcta. */
  lastUpdated: Date | null
}

export interface PollingResult<T> extends PollingState<T> {
  /** Borra el error y vuelve a pedir ya, sin esperar al siguiente intervalo. */
  retry: () => void
}

/** `intervalMs: null` = pedir una sola vez (al montar y con `retry`), sin repetir. */
export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number | null,
): PollingResult<T> {
  const [state, setState] = useState<PollingState<T>>({
    data: undefined,
    error: null,
    lastUpdated: null,
  })
  // Cambiar `attempt` reinicia el efecto: limpia el intervalo actual y pide de inmediato.
  const [attempt, setAttempt] = useState(0)

  // useCallback: `retry` mantiene la misma referencia entre renders.
  const retry = useCallback(() => {
    // Sin error y sin datos, la UI vuelve a "Cargando…" mientras llega la respuesta.
    setState((prev) => ({ ...prev, error: null }))
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    // Un AbortController por "vida" del efecto: abortarlo cancela el fetch en curso.
    const controller = new AbortController()
    let inFlight = false

    async function tick() {
      if (inFlight) return
      inFlight = true
      try {
        const data = await fetcher(controller.signal)
        setState({ data, error: null, lastUpdated: new Date() })
      } catch (err) {
        // Cancelado por nosotros (desmontaje): no es un error que mostrar.
        if (controller.signal.aborted) return
        const error =
          err instanceof ApiError ? err : new ApiError('UNKNOWN', 0, 'Error inesperado al leer la API.')
        // Forma funcional de setState: parte del estado más reciente y conserva `data`.
        setState((prev) => ({ ...prev, error }))
      } finally {
        inFlight = false
      }
    }

    void tick()
    // clearInterval(undefined) no hace nada, así que la limpieza sirve para ambos casos.
    const id = intervalMs === null ? undefined : setInterval(tick, intervalMs)

    // Limpieza: React la llama al desmontar y antes de volver a ejecutar el efecto.
    return () => {
      controller.abort()
      clearInterval(id)
    }
    // `attempt` no se lee dentro del efecto: está en la lista solo para poder reiniciarlo.
  }, [fetcher, intervalMs, attempt])

  return { ...state, retry }
}
