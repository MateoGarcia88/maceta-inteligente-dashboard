/**
 * Números como en el mockup: coma decimal y espacio como separador de miles
 * ("75,7", "12 790"). `es-CO` usa punto para los miles y no agrupa números de 4 cifras,
 * así que se formatea con es-CO y se cambia la pieza "group".
 */

/** Espacio fino que no se parte en dos líneas (el que usa el SI para los miles). */
const THIN_NBSP = ' '

const formatters = new Map<number, Intl.NumberFormat>()

function formatterFor(decimals: number): Intl.NumberFormat {
  let f = formatters.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: 'always',
    })
    formatters.set(decimals, f)
  }
  return f
}

/** formatNumber(12790) → "12 790"; formatNumber(75.7, 1) → "75,7". */
export function formatNumber(value: number, decimals = 0): string {
  return formatterFor(decimals)
    .formatToParts(value)
    .map((p) => (p.type === 'group' ? THIN_NBSP : p.value))
    .join('')
}
