/**
 * Fechas: la API manda UTC y aquí se muestran en hora de Bogotá, sin importar
 * la zona horaria del PC que abra la página.
 */

const TIME_ZONE = 'America/Bogota'

const dateTimeFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * "2026-11-22T17:35:00.000Z" → "22 nov 2026, 12:35".
 *
 * `format()` daría "22 de nov de 2026, 12:35"; con `formatToParts` se toman solo las
 * piezas y se arman como en el mockup.
 */
export function formatBogota(instant: string | number): string {
  const parts: Record<string, string> = {}
  for (const { type, value } of dateTimeFormat.formatToParts(new Date(instant))) parts[type] = value
  // Algunas versiones de ICU abrevian el mes con punto ("nov."): se quita.
  const month = (parts.month ?? '').replace('.', '')
  return `${parts.day} ${month} ${parts.year}, ${parts.hour}:${parts.minute}`
}

const timeFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** ms desde 1970 → "16:00" en hora de Bogotá. Para los ticks de los gráficos. */
export function formatBogotaTime(ms: number): string {
  return timeFormat.format(ms)
}

const MS_PER_HOUR = 60 * 60 * 1000
/** Bogotá está en UTC−5 todo el año (sin horario de verano). */
const BOGOTA_OFFSET_MS = -5 * MS_PER_HOUR

/**
 * ms desde 1970 → "2026-11-22T12:35", el formato de `<input type="datetime-local">`, en hora
 * de Bogotá. Se desplaza −5 h y se leen los campos "UTC" del resultado: no depende de la
 * zona horaria del PC.
 */
export function toBogotaInputValue(ms: number): string {
  return new Date(ms + BOGOTA_OFFSET_MS).toISOString().slice(0, 16)
}

/**
 * Valor de `datetime-local` ("2026-11-22T12:35", sin zona) → "2026-11-22T12:35-05:00".
 * La API rechaza fechas sin zona; el usuario escribe en hora de Bogotá.
 */
export function bogotaInputToApi(value: string): string {
  return `${value}-05:00`
}

/**
 * Instantes entre `minMs` y `maxMs` que caen en horas "redondas" de Bogotá múltiplos de
 * `stepHours` (con 4: 00:00, 04:00, 08:00…). Así los ticks no quedan en 13:37, 17:37…
 */
export function hourTicks(minMs: number, maxMs: number, stepHours: number): number[] {
  const step = stepHours * MS_PER_HOUR
  // Se pasa a "hora local en ms", se redondea hacia arriba al múltiplo y se vuelve a UTC.
  const first = Math.ceil((minMs + BOGOTA_OFFSET_MS) / step) * step - BOGOTA_OFFSET_MS
  const ticks: number[] = []
  for (let t = first; t <= maxMs; t += step) ticks.push(t)
  return ticks
}
