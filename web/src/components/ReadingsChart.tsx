import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '../format.ts'
import { formatBogota, formatBogotaTime, hourTicks } from '../time.ts'
import type { Reading } from '../types.ts'

interface Props {
  readings: Reading[]
  /** Qué campo de la lectura se dibuja. */
  field: 'soilMoisture' | 'light'
  title: string
  unit: string
  color: string
  /** Decimales en el tooltip. */
  decimals?: number
  /** Rango fijo del eje Y (p. ej. [0, 100] para %). Tiene prioridad sobre `yStep`. */
  yDomain?: [number, number]
  yTicks?: number[]
  /**
   * Sin rango fijo: el eje va de 0 al máximo de los datos redondeado hacia arriba a un
   * múltiplo de `yStep`, con un tick por paso (con 5000: 0, 5000, 10 000…).
   */
  yStep?: number
}

/** Dominio y ticks del eje Y a partir del máximo de los datos y un paso. */
function stepAxis(values: number[], step: number): { domain: [number, number]; ticks: number[] } {
  // Con todo en 0 (de noche) el máximo sería 0: se deja al menos un paso de alto.
  const max = Math.max(step, Math.ceil(Math.max(0, ...values) / step) * step)
  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return { domain: [0, max], ticks }
}

/** Serie de tiempo de un campo de las lecturas. Se usa igual para humedad y para luz. */
export function ReadingsChart({
  readings,
  field,
  title,
  unit,
  color,
  decimals = 0,
  yDomain,
  yTicks,
  yStep,
}: Props) {
  // Recharts necesita un eje X numérico para espaciar los puntos según el tiempo real
  // (con strings, los pondría equidistantes aunque faltaran lecturas).
  const data = useMemo(
    () => readings.map((r) => ({ t: Date.parse(r.timestamp), value: r[field] })),
    [readings, field],
  )
  const xTicks = useMemo(
    () => (data.length > 0 ? hourTicks(data[0]!.t, data[data.length - 1]!.t, 4) : []),
    [data],
  )
  const yAxis = useMemo(() => {
    if (yDomain) return { domain: yDomain, ticks: yTicks }
    if (yStep) return stepAxis(data.map((d) => d.value), yStep)
    return { domain: undefined, ticks: yTicks }
  }, [data, yDomain, yTicks, yStep])

  return (
    <article className="card chart">
      <h3 className="chart__title">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e4e4de" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={formatBogotaTime}
          />
          <YAxis
            domain={yAxis.domain ?? ['auto', 'auto']}
            ticks={yAxis.ticks}
            tickFormatter={(v: number) => formatNumber(v)}
            width={56}
          />
          <Tooltip
            labelFormatter={(t) => formatBogota(Number(t))}
            formatter={(v) => [`${formatNumber(Number(v), decimals)} ${unit}`, title]}
          />
          {/* Sin animación: si no, la línea se redibuja desde cero en cada refresco. */}
          <Line
            dataKey="value"
            type="linear"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </article>
  )
}
