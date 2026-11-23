import type { ReactNode } from 'react'
import { fetchLatest, fetchReadings } from './api.ts'
import { LatestCards } from './components/LatestCards.tsx'
import { PollSection } from './components/PollSection.tsx'
import { ReadingsChart } from './components/ReadingsChart.tsx'
import { ReadingsPanel } from './components/ReadingsPanel.tsx'
import { StatusMessage } from './components/StatusMessage.tsx'
import { CONFIG_ERROR, REFRESH_MS } from './config.ts'
import { formatBogota, formatBogotaTime } from './time.ts'
import type { Reading } from './types.ts'
import { usePolling } from './usePolling.ts'

export default function App() {
  // Sin URL de la API no se monta Dashboard, así que no se hace ningún fetch.
  if (CONFIG_ERROR) {
    return (
      <main className="page">
        <Header reading={undefined} connection="unknown" />
        <p className="config-error" role="alert">
          {CONFIG_ERROR}
        </p>
      </main>
    )
  }
  return <Dashboard />
}

/** Sin `from`/`to`: la API devuelve las 24 h que terminan en la última lectura. */
const fetchLast24h = (signal: AbortSignal) => fetchReadings({}, signal)

function Dashboard() {
  // Funciones de módulo: su referencia no cambia entre renders, el efecto no se reinicia.
  const latest = usePolling(fetchLatest, REFRESH_MS)
  const history = usePolling(fetchLast24h, REFRESH_MS)

  const error = latest.error ?? history.error
  const connection: Connection = error ? 'offline' : latest.lastUpdated ? 'connected' : 'unknown'
  const retryAll = () => {
    latest.retry()
    history.retry()
  }

  // Mientras no haya llegado nada, un único mensaje para toda la página (y no uno por sección).
  const nothingYet = latest.data === undefined && history.data === undefined
  let body: ReactNode
  if (nothingYet) {
    body = error ? (
      <StatusMessage kind="error" error={error} onRetry={retryAll} />
    ) : (
      <StatusMessage kind="loading" />
    )
  } else if (latest.data === null) {
    // La API respondió que no tiene ninguna lectura: tampoco habrá histórico.
    body = <StatusMessage kind="empty" />
  } else {
    body = (
      <>
        {/* Un refresco falló pero hay datos: se conservan y se avisa. */}
        {error && <StaleNotice lastUpdated={latest.lastUpdated} onRetry={retryAll} />}

        <PollSection poll={latest} isEmpty={(r) => r === null}>
          {(r) => r && <LatestCards reading={r} />}
        </PollSection>

        <section className="history" aria-labelledby="history-title">
          <h2 id="history-title" className="section-title">
            Histórico
          </h2>
          <PollSection poll={history} isEmpty={(h) => h.count === 0} onRetry={retryAll}>
            {(h) => (
              <div className="charts">
                <ReadingsChart
                  readings={h.readings}
                  field="soilMoisture"
                  title="Humedad del sustrato (%)"
                  seriesName="Humedad"
                  subtitle="Últimas 24 horas"
                  unit="%"
                  color="#2f6fbf"
                  decimals={1}
                  yDomain={[0, 100]}
                  yTicks={[0, 25, 50, 75, 100]}
                />
                {/* De 0 (la noche queda sobre el eje) al máximo redondeado a 5000. */}
                <ReadingsChart
                  readings={h.readings}
                  field="light"
                  title="Luz (lx)"
                  seriesName="Luz"
                  subtitle="Últimas 24 horas"
                  unit="lx"
                  color="#b8860b"
                  yStep={5000}
                />
              </div>
            )}
          </PollSection>
        </section>

        {/* El filtro Desde/Hasta afecta solo a la tabla; los gráficos siguen en las 24 h. */}
        <ReadingsPanel history={history} onRetryHistory={retryAll} />
      </>
    )
  }

  return (
    <main className="page">
      <Header reading={latest.data ?? undefined} connection={connection} />
      {body}
    </main>
  )
}

function StaleNotice({ lastUpdated, onRetry }: { lastUpdated: Date | null; onRetry: () => void }) {
  return (
    <div className="stale" role="status">
      <span>
        No se pudo actualizar.
        {lastUpdated && ` Mostrando datos recibidos a las ${formatBogotaTime(lastUpdated.getTime())}.`}
      </span>
      <button type="button" className="button button--link" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  )
}

type Connection = 'connected' | 'offline' | 'unknown'

function Header({ reading, connection }: { reading: Reading | undefined; connection: Connection }) {
  return (
    <header className="header">
      <div>
        {reading && <p className="header__device">{reading.deviceId}</p>}
        <h1 className="header__title">Maceta inteligente</h1>
        {reading && (
          <p className="header__subtitle">
            Última lectura: {formatBogota(reading.timestamp)} (hora de Bogotá)
          </p>
        )}
      </div>
      <div className="header__status">
        <span className="badge">Datos simulados</span>
        {connection !== 'unknown' && (
          <span className={`connection connection--${connection}`}>
            {connection === 'connected' ? 'API conectada' : 'Sin conexión'}
          </span>
        )}
      </div>
    </header>
  )
}
