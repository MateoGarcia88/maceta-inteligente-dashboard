/**
 * Configuración del frontend, leída una sola vez al cargar la página.
 *
 * Si VITE_API_URL falta o no es válida no se lanza un error (dejaría la pantalla en blanco):
 * se expone `configError` para que App muestre un mensaje claro.
 */

/** Cada cuánto se vuelve a pedir datos a la API. */
export const REFRESH_MS = 30_000

function readApiUrl(): { apiUrl: string; configError: string | null } {
  const raw = import.meta.env.VITE_API_URL?.trim()
  if (!raw) {
    return { apiUrl: '', configError: 'Falta VITE_API_URL. Copia web/.env.example como web/.env.local.' }
  }
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error()
  } catch {
    return { apiUrl: '', configError: `VITE_API_URL no es una URL http(s) válida: "${raw}".` }
  }
  // Sin "/" final, para poder concatenar `${API_URL}/api/...`.
  return { apiUrl: raw.replace(/\/+$/, ''), configError: null }
}

const { apiUrl, configError } = readApiUrl()

export const API_URL = apiUrl
export const CONFIG_ERROR = configError
