import { fetchLatest } from './api.ts'
import { LatestCards } from './components/LatestCards.tsx'
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

function Dashboard() {
  // `fetchLatest` es una función de módulo: su referencia no cambia entre renders.
  const latest = usePolling(fetchLatest, REFRESH_MS)

  return (
    <main className="page">
      <Header reading={latest.data ?? undefined} />

      {/* Estados mínimos; la etapa 4 los reemplaza por los del mockup. */}
      {latest.data === undefined && !latest.error && <p>Cargando lecturas…</p>}
      {latest.error && <p role="alert">{latest.error.message}</p>}
      {latest.data === null && <p>Aún no hay lecturas.</p>}
      {latest.data && <LatestCards reading={latest.data} />}
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
