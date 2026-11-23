import { useCallback, useState, type ReactNode } from 'react'
import { fetchReadings, type ReadingsRange } from '../api.ts'
import { formatNumber } from '../format.ts'
import { bogotaInputToApi, toBogotaInputValue } from '../time.ts'
import type { ReadingsResponse } from '../types.ts'
import { usePolling, type PollingResult } from '../usePolling.ts'
import { PollSection } from './PollSection.tsx'
import { RangeFilter } from './RangeFilter.tsx'
import { ReadingsTable } from './ReadingsTable.tsx'

const MS_PER_DAY = 24 * 60 * 60 * 1000

interface Props {
  /** Las 24 h en vivo (la misma petición que alimenta los gráficos). */
  history: PollingResult<ReadingsResponse>
  onRetryHistory: () => void
}

/**
 * Tarjeta "Lecturas": filtro Desde/Hasta + tabla.
 * - Sin filtro aplicado, la tabla muestra las 24 h en vivo de `history`.
 * - Con filtro, monta `FilteredReadings`, que pide ese rango una sola vez.
 */
export function ReadingsPanel({ history, onRetryHistory }: Props) {
  // `null` = el usuario no ha tocado el campo: se muestra el valor por defecto (últimas 24 h).
  const [inputs, setInputs] = useState<{ from: string | null; to: string | null }>({
    from: null,
    to: null,
  })
  const [applied, setApplied] = useState<ReadingsRange | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Valores por defecto derivados de los datos: las 24 h que terminan en la última lectura.
  const lastMs = history.data ? Date.parse(history.data.to) : null
  const fromValue = inputs.from ?? (lastMs === null ? '' : toBogotaInputValue(lastMs - MS_PER_DAY))
  const toValue = inputs.to ?? (lastMs === null ? '' : toBogotaInputValue(lastMs))

  function apply() {
    if (!fromValue || !toValue) {
      setValidationError('Completa Desde y Hasta.')
      return
    }
    // Mismo formato "AAAA-MM-DDTHH:mm" en ambos: se pueden comparar como texto.
    if (fromValue > toValue) {
      setValidationError('"Desde" debe ser anterior o igual a "Hasta".')
      return
    }
    setValidationError(null)
    setApplied({ from: bogotaInputToApi(fromValue), to: bogotaInputToApi(toValue) })
  }

  function reset() {
    setInputs({ from: null, to: null })
    setApplied(null)
    setValidationError(null)
  }

  const filter = (
    <RangeFilter
      from={fromValue}
      to={toValue}
      onFromChange={(v) => setInputs((prev) => ({ ...prev, from: v }))}
      onToChange={(v) => setInputs((prev) => ({ ...prev, to: v }))}
      onApply={apply}
      onReset={reset}
      error={validationError}
    />
  )

  return (
    <section className="card readings" aria-labelledby="readings-title">
      {applied ? (
        // `key`: cada rango aplicado es un componente nuevo, con su propio estado (datos,
        // error, página de la tabla) desde cero. Sin key, se verían los datos del rango anterior.
        <FilteredReadings key={`${applied.from}|${applied.to}`} range={applied} filter={filter} />
      ) : (
        <ReadingsBody poll={history} filter={filter} onRetry={onRetryHistory} />
      )}
    </section>
  )
}

function FilteredReadings({ range, filter }: { range: ReadingsRange; filter: ReactNode }) {
  const fetcher = useCallback((signal: AbortSignal) => fetchReadings(range, signal), [range])
  // Rango fijo: no tiene sentido repetir la petición cada 30 s.
  const poll = usePolling(fetcher, null)
  return <ReadingsBody poll={poll} filter={filter} onRetry={poll.retry} />
}

function ReadingsBody({
  poll,
  filter,
  onRetry,
}: {
  poll: PollingResult<ReadingsResponse>
  filter: ReactNode
  onRetry: () => void
}) {
  return (
    <>
      <header className="readings__header">
        <h2 id="readings-title" className="section-title">
          Lecturas
        </h2>
        {poll.data && (
          <span className="readings__count">{formatNumber(poll.data.count)} lecturas en el rango</span>
        )}
      </header>
      {filter}
      {poll.data?.truncated && (
        <p className="readings__notice" role="status">
          El rango tiene demasiadas lecturas: se muestran las {formatNumber(poll.data.count)} más recientes.
        </p>
      )}
      <PollSection poll={poll} isEmpty={(h) => h.count === 0} onRetry={onRetry}>
        {(h) => <ReadingsTable readings={h.readings} />}
      </PollSection>
    </>
  )
}
