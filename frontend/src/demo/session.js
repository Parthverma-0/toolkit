// Demo mode: the chosen role is kept in localStorage; while it is set, every API call
// is answered from sample data in the browser (see demo/adapter.js).
const KEY = 'toolkit-demo-role'
export const DEMO_ROLES = ['startup', 'incubator', 'mentor']

// Turn the demo off for a deployment by building with VITE_DEMO=off
export const DEMO_ENABLED = import.meta.env.VITE_DEMO !== 'off'

let memory = null // fallback when storage is blocked
const read = () => {
  try { return localStorage.getItem(KEY) ?? memory } catch { return memory }
}

export const demoRole = () => (DEMO_ENABLED && DEMO_ROLES.includes(read()) ? read() : null)
export const isDemo = () => Boolean(demoRole())

export const startDemo = (role) => {
  memory = role
  try { localStorage.setItem(KEY, role) } catch { /* blocked storage: demo lasts until reload */ }
}
// Shareable links: any URL with ?demo=startup|incubator|mentor opens straight into that demo
if (DEMO_ENABLED && typeof window !== 'undefined') {
  const fromUrl = new URLSearchParams(window.location.search).get('demo')
  if (DEMO_ROLES.includes(fromUrl)) startDemo(fromUrl)
}

export const endDemo = () => {
  memory = null
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
