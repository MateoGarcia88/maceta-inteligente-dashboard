// Tipos de las variables de entorno que Vite expone en `import.meta.env`.
// Solo llegan al navegador las que empiezan por VITE_.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
