import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite runs under Node. Load env from .env files AND process.env.
// (loadEnv only returns VITE_*-prefixed vars, so merge in process.env too.)
const env = { ...loadEnv('', process.cwd(), ''), ...process.env }

// Backend (mediatunes-svc) serving the JSON API and media files.
const backendUrl = env.BACKEND_URL ?? 'http://127.0.0.1:5000'
// Path prefix the backend's JSON API is served under (e.g. "/api").
// Media files (/getfile/*) are served at the backend root, WITHOUT this prefix.
const apiPrefix = env.BACKEND_URL_PREFIX ?? '/api'

// Public base path the SPA is served under. Must match `base` below.
const base = '/mediatunes/'

// Proxy options shared by the API and getfile proxies.
const proxyOpts = {
  target: backendUrl,
  changeOrigin: true,
} as const

export default defineConfig({
  plugins: [vue()],
  base,
  server: {
    port: 5173,
    proxy: {
      // The client calls '<base>api/*' and '<base>getfile/*'. The dev server
      // strips the base prefix and forwards to the backend, which serves the
      // JSON API under apiPrefix (e.g. /api) and media at /getfile (no prefix).
      [`${base}api`]: {
        ...proxyOpts,
        // strip '<base>api' prefix, then re-root under the backend's apiPrefix.
        // base already ends in '/', so drop base.length + 'api'.length chars.
        rewrite: (p: string) => `${apiPrefix}${p.slice(base.length + 'api'.length)}`,
      },
      [`${base}getfile`]: {
        ...proxyOpts,
        // strip base -> '/getfile/...' (backend serves media at the root)
        rewrite: (p: string) => p.slice(base.length - 1),
      },
    },
  },
})
