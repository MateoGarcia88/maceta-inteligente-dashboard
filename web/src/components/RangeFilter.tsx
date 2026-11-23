import type { FormEvent } from 'react'

interface Props {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onApply: () => void
  onReset: () => void
  /** Error de validación a mostrar bajo los campos. */
  error: string | null
}

/**
 * Campos Desde / Hasta. Es un componente "controlado": no guarda estado propio, los valores
 * viven en el padre. Así no se pierden aunque la tabla de abajo se vuelva a montar.
 */
export function RangeFilter({ from, to, onFromChange, onToChange, onApply, onReset, error }: Props) {
  // <form> + onSubmit: Enter dentro de un campo también aplica el filtro.
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onApply()
  }

  return (
    <form className="filter" onSubmit={handleSubmit} noValidate>
      <div className="filter__fields">
        <label className="filter__field">
          <span className="filter__label">Desde</span>
          <input
            type="datetime-local"
            className="filter__input"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </label>
        <label className="filter__field">
          <span className="filter__label">Hasta</span>
          <input
            type="datetime-local"
            className="filter__input"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
        </label>
        <div className="filter__actions">
          <button type="submit" className="button button--primary">
            Aplicar
          </button>
          <button type="button" className="button button--secondary" onClick={onReset}>
            Restablecer
          </button>
        </div>
      </div>
      {error ? (
        <p className="filter__error" role="alert">
          {error}
        </p>
      ) : (
        <p className="filter__hint">Las fechas se interpretan en hora de Bogotá.</p>
      )}
    </form>
  )
}
