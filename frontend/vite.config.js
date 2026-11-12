import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// The Google client ID is public. If VITE_GOOGLE_CLIENT_ID isn't set, reuse GOOGLE_CLIENT_ID
// (build environment on Vercel, backend/.env locally) so it only has to be filled in once.
const backendGoogleClientId = () => {
  try {
    const line = fs.readFileSync(new URL('../backend/.env', import.meta.url), 'utf8')
      .split(/\r?\n/).find((l) => l.startsWith('GOOGLE_CLIENT_ID='))
    const value = line?.slice('GOOGLE_CLIENT_ID='.length).trim().replace(/^["']|["']$/g, '')
    return value && !value.startsWith('<') ? value : ''
  } catch {
    return ''
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The backend runs on :5000. Proxying /api and /uploads keeps the auth cookies
  // same-origin in dev. Port 5173 must match CLIENT_URL in backend/.env.
  const backend = env.BACKEND_URL || 'http://localhost:5000'

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __GOOGLE_CLIENT_ID__: JSON.stringify(env.VITE_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || backendGoogleClientId()),
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/uploads': { target: backend, changeOrigin: true },
      },
    },
  }
})
