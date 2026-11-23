import { formatNumber } from '../format.ts'
import type { Reading } from '../types.ts'

interface Props {
  reading: Reading
}

/** Las dos tarjetas de la última lectura: humedad del sustrato y luz. */
export function LatestCards({ reading }: Props) {
  return (
    <section className="metrics" aria-label="Última lectura">
      <article className="card metric metric--moisture">
        <h2 className="metric__label">Humedad del sustrato</h2>
        <p className="metric__value">
          {formatNumber(reading.soilMoisture, 1)}
          <span className="metric__unit">%</span>
        </p>
      </article>
      <article className="card metric metric--light">
        <h2 className="metric__label">Luz</h2>
        <p className="metric__value">
          {formatNumber(reading.light)}
          <span className="metric__unit">lx</span>
        </p>
      </article>
    </section>
  )
}
