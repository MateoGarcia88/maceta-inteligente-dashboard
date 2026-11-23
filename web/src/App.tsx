import { CONFIG_ERROR } from './config.ts'

export default function App() {
  return (
    <main className="page">
      <header className="header">
        <div>
          <h1 className="header__title">Maceta inteligente</h1>
        </div>
        <span className="badge">Datos simulados</span>
      </header>

      {CONFIG_ERROR && (
        <p className="config-error" role="alert">
          {CONFIG_ERROR}
        </p>
      )}
    </main>
  )
}
