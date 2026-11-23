import type { ApiError } from '../api.ts'

/**
 * Los tres estados del mockup ("Estados de la pantalla"). Es una unión discriminada:
 * según `kind`, TypeScript exige (y deja usar) las props que ese estado necesita.
 */
type Props =
  | { kind: 'loading' }
  | { kind: 'error'; error: ApiError; onRetry: () => void }
  | { kind: 'empty' }

export function StatusMessage(props: Props) {
  switch (props.kind) {
    case 'loading':
      return (
        // aria-busy: los lectores de pantalla anuncian que la zona se está cargando.
        <div className="card status" aria-busy="true">
          <p className="status__text">Cargando lecturas…</p>
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--block" />
          <div className="skeleton skeleton--chart" />
        </div>
      )

    case 'error': {
      // status 0 = no hubo respuesta; si la API respondió, se muestra su propio mensaje.
      const offline = props.error.status === 0
      return (
        <div className="card status" role="alert">
          <AlertIcon />
          <h2 className="status__title">
            {offline ? 'No se pudo conectar con la API' : 'La API devolvió un error'}
          </h2>
          <p className="status__text">
            {offline
              ? 'Comprueba que la API esté encendida e inténtalo de nuevo.'
              : props.error.message}
          </p>
          <button type="button" className="button button--primary" onClick={props.onRetry}>
            Reintentar
          </button>
        </div>
      )
    }

    case 'empty':
      return (
        <div className="card status">
          <ChartIcon />
          <h2 className="status__title">Aún no hay lecturas</h2>
          <p className="status__text">No hay datos en este rango de tiempo. Prueba con otro rango.</p>
        </div>
      )
  }
}

// Iconos en SVG en línea: sin librería de iconos. aria-hidden porque el título ya lo dice.
function AlertIcon() {
  return (
    <svg className="status__icon status__icon--error" viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
      <path
        d="M12 3 2 20h20L12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className="status__icon" viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
      <path d="M3 3v18h18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M7 15l3-3 3 2 4-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="1 3"
        strokeLinecap="round"
      />
    </svg>
  )
}
