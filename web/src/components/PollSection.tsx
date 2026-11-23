import type { ReactNode } from 'react'
import type { PollingResult } from '../usePolling.ts'
import { StatusMessage } from './StatusMessage.tsx'

/**
 * Estados de una sección alimentada por `usePolling`: cargando, error, vacío o contenido.
 * `children` es una función (render prop) que recibe los datos ya cargados.
 */
export function PollSection<T>({
  poll,
  isEmpty,
  onRetry = poll.retry,
  children,
}: {
  poll: PollingResult<T>
  isEmpty: (data: T) => boolean
  onRetry?: () => void
  children: (data: T) => ReactNode
}) {
  if (poll.data === undefined) {
    return poll.error ? (
      <StatusMessage kind="error" error={poll.error} onRetry={onRetry} />
    ) : (
      <StatusMessage kind="loading" />
    )
  }
  if (isEmpty(poll.data)) return <StatusMessage kind="empty" />
  return <>{children(poll.data)}</>
}
