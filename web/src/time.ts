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
export function formatBogota(iso: string): string {
  const parts: Record<string, string> = {}
  for (const { type, value } of dateTimeFormat.formatToParts(new Date(iso))) parts[type] = value
  // Algunas versiones de ICU abrevian el mes con punto ("nov."): se quita.
  const month = (parts.month ?? '').replace('.', '')
  return `${parts.day} ${month} ${parts.year}, ${parts.hour}:${parts.minute}`
}
