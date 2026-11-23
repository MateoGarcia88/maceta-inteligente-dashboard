import { fetchLatest, fetchReadings } from './api.ts'
import { LatestCards } from './components/LatestCards.tsx'
import { ReadingsChart } from './components/ReadingsChart.tsx'
import { CONFIG_ERROR, REFRESH_MS } from './config.ts'
import { formatBogota } from './time.ts'
import type { Reading } from './types.ts'
import { usePolling } from './usePolling.ts'

export default function App() {
  // Sin URL de la API no se monta Dashboard, así que no se hace ningún fetch.
  if (CONFIG_ERROR) {
    return (
      <main className="page">
        <Header reading={undefined} />
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

  return (
    <main className="page">
      <Header reading={latest.data ?? undefined} />

      {/* Estados mínimos; la etapa 4 los reemplaza por los del mockup. */}
      {latest.data === undefined && !latest.error && <p>Cargando lecturas…</p>}
      {latest.error && <p role="alert">{latest.error.message}</p>}
      {latest.data === null && <p>Aún no hay lecturas.</p>}
      {latest.data && <LatestCards reading={latest.data} />}

      <section className="history" aria-labelledby="history-title">
        <h2 id="history-title" className="section-title">
          Histórico
        </h2>
        {history.data === undefined && !history.error && <p>Cargando lecturas…</p>}
        {history.error && <p role="alert">{history.error.message}</p>}
        {history.data && (
          <div className="charts">
            <ReadingsChart
              readings={history.data.readings}
              field="soilMoisture"
              title="Humedad del sustrato (%)"
              unit="%"
              color="#2f6fbf"
              decimals={1}
              yDomain={[0, 100]}
              yTicks={[0, 25, 50, 75, 100]}
            />
            {/* De 0 (la noche queda sobre el eje) al máximo redondeado a 5000. */}
            <ReadingsChart
              readings={history.data.readings}
              field="light"
              title="Luz (lx)"
              unit="lx"
              color="#b8860b"
              yStep={5000}
            />
          </div>
        )}
      </section>
    </main>
  )
}

function Header({ reading }: { reading: Reading | undefined }) {
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
      <span className="badge">Datos simulados</span>
    </header>
  )
}
