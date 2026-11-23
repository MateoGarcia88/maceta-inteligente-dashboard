import { useMemo, useState } from 'react'
import { formatNumber } from '../format.ts'
import { formatBogota } from '../time.ts'
import type { Reading } from '../types.ts'

const PAGE_SIZE = 10

type SortKey = 'timestamp' | 'soilMoisture' | 'light'
type SortDir = 'asc' | 'desc'

interface Column {
  key: SortKey
  label: string
  numeric: boolean
  render: (r: Reading) => string
}

const COLUMNS: Column[] = [
  { key: 'timestamp', label: 'Fecha y hora', numeric: false, render: (r) => formatBogota(r.timestamp) },
  { key: 'soilMoisture', label: 'Humedad (%)', numeric: true, render: (r) => formatNumber(r.soilMoisture, 1) },
  { key: 'light', label: 'Luz (lx)', numeric: true, render: (r) => formatNumber(r.light) },
]

/** Compara dos lecturas por una columna. Los ISO en UTC con el mismo formato se ordenan como texto. */
function compare(a: Reading, b: Reading, key: SortKey): number {
  if (key === 'timestamp') return a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
  return a[key] - b[key]
}

interface Props {
  readings: Reading[]
}

/** Tabla de lecturas: orden por columna (clic en el encabezado) y paginación de 10 en 10. */
export function ReadingsTable({ readings }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'timestamp', dir: 'desc' })
  const [page, setPage] = useState(0)

  // Ordenar una copia: `sort()` modifica el arreglo, y `readings` viene de props (no es nuestro).
  const sorted = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...readings].sort((a, b) => factor * compare(a, b, sort.key))
  }, [readings, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  // Página "derivada": si llegan menos datos y `page` queda fuera de rango, se ajusta sin un
  // useEffect que sincronice estados.
  const current = Math.min(page, pageCount - 1)
  const start = current * PAGE_SIZE
  const rows = sorted.slice(start, start + PAGE_SIZE)

  // Forma funcional: parte del valor más reciente aunque haya varios clics antes del re-render
  // (con `setPage(current + 1)`, dos clics rápidos avanzarían solo una página).
  function goTo(delta: number) {
    setPage((p) => Math.max(0, Math.min(Math.min(p, pageCount - 1) + delta, pageCount - 1)))
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : // Columna nueva: fecha empieza por la más reciente; los números, de mayor a menor.
          { key, dir: 'desc' },
    )
    setPage(0)
  }

  return (
    <>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              {COLUMNS.map((col) => {
                const active = sort.key === col.key
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={col.numeric ? 'table__num' : undefined}
                    // aria-sort: los lectores de pantalla anuncian "ordenado descendente".
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className="table__sort" onClick={() => toggleSort(col.key)}>
                      {col.label}
                      <span className="table__arrow" aria-hidden="true">
                        {active ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.timestamp}>
                {COLUMNS.map((col) => (
                  <td key={col.key} className={col.numeric ? 'table__num' : undefined}>
                    {col.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span className="pager__summary">
          Mostrando {start + 1}–{start + rows.length} de {formatNumber(sorted.length)}
        </span>
        <div className="pager__controls">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => goTo(-1)}
            disabled={current === 0}
          >
            Anterior
          </button>
          <span className="pager__page">
            Página {current + 1} de {pageCount}
          </span>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => goTo(1)}
            disabled={current >= pageCount - 1}
          >
            Siguiente
          </button>
        </div>
      </div>
    </>
  )
}
