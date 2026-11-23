import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNumber } from '../format.ts'
import { formatBogota, formatBogotaTime, hourTicks } from '../time.ts'
import type { Reading } from '../types.ts'

interface Props {
  readings: Reading[]
  /** Qué campo de la lectura se dibuja. */
  field: 'soilMoisture' | 'light'
  /** Encabezado de la tarjeta, p. ej. "Humedad del sustrato (%)". */
  title: string
  /** Nombre corto en el tooltip, p. ej. "Humedad". */
  seriesName: string
  /** Texto a la derecha del título, p. ej. "Últimas 24 horas". */
  subtitle?: string
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
  seriesName,
  subtitle,
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

  const last = data[data.length - 1]

  return (
    <article className="card chart">
      <header className="chart__header">
        <h3 className="chart__title">{title}</h3>
        {subtitle && <span className="chart__subtitle">{subtitle}</span>}
      </header>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          {/* Solo líneas horizontales, como en el mockup. */}
          <CartesianGrid vertical={false} stroke={GRID_COLOR} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            // En pantallas angostas, Recharts omite los ticks que se pisarían (deja 1 de cada 2).
            interval="preserveStartEnd"
            minTickGap={12}
            tickFormatter={formatBogotaTime}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: AXIS_LINE_COLOR }}
            tickMargin={8}
          />
          <YAxis
            domain={yAxis.domain ?? ['auto', 'auto']}
            ticks={yAxis.ticks}
            tickFormatter={(v: number) => formatNumber(v)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            labelFormatter={(t) => formatBogota(Number(t))}
            formatter={(v) => [`${formatNumber(Number(v), decimals)} ${unit}`, seriesName]}
            contentStyle={TOOLTIP_STYLE}
            cursor={{ stroke: AXIS_LINE_COLOR }}
          />
          {/* Sin animación: si no, la línea se redibuja desde cero en cada refresco. */}
          <Line
            dataKey="value"
            name={seriesName}
            type="linear"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          {/* Punto en la lectura más reciente. */}
          {last && <ReferenceDot x={last.t} y={last.value} r={4} fill={color} stroke="none" />}
        </LineChart>
      </ResponsiveContainer>
    </article>
  )
}

// Colores fijos de los ejes: Recharts los pone como atributos del SVG.
const GRID_COLOR = '#ecece6'
const AXIS_LINE_COLOR = '#d6d6cf'
const AXIS_TICK = { fill: '#6b6b66', fontSize: 12 }
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid #e6e6e0',
  fontSize: 13,
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.06)',
}
