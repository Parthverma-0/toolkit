import axios from 'axios'
import { isDemo } from '../demo/session.js'

// All requests go to /api on the same origin. In dev, Vite proxies /api and /uploads
// to the backend (see vite.config.js); on Vercel the backend is the /api function of the same
// deployment (see /vercel.json). Either way the httpOnly auth cookies are first-party.
// In production set VITE_API_URL if the API lives on another domain.
const API_URL = import.meta.env.VITE_API_URL || '/api'

// Demo sessions are answered in the browser; the demo code is only downloaded when used
const networkAdapter = axios.getAdapter(axios.defaults.adapter)
const adapter = (config) => (isDemo()
  ? import('../demo/adapter.js').then((m) => m.default(config))
  : networkAdapter(config))

const api = axios.create({ baseURL: API_URL, withCredentials: true, adapter })

// Auth endpoints that must never trigger a refresh-and-retry loop
const NO_REFRESH = ['/auth/google', '/auth/refresh', '/auth/logout']

let refreshing = null
const listeners = new Set()

// AuthContext subscribes so a failed refresh logs the user out everywhere
export const onSessionExpired = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Direct uploads. When the backend stores files on Cloudinary (always the case on Vercel,
// where request bodies are capped at 4.5 MB), each file goes straight from the browser to
// Cloudinary and the form carries a signed reference to it in `directUploads` instead.
// With local disk storage the backend answers direct:false and files travel with the form.
let directUploads = true

const uploadDirect = async (file) => {
  if (!directUploads) return null
  const { data: { data: ticket } } = await api.post('/uploads/sign', { mimetype: file.type })
  if (!ticket.direct) {
    directUploads = false
    return null
  }
  const body = new FormData()
  Object.entries(ticket.fields).forEach(([key, value]) => body.append(key, value))
  body.append('file', file)
  const res = await fetch(ticket.uploadUrl, { method: 'POST', body }).catch(() => null)
  const json = await res?.json().catch(() => null)
  if (!res?.ok || !json?.secure_url) {
    // Same shape as an API error so errorMessage() can show it
    throw Object.assign(new Error('Upload failed'), {
      response: { data: { message: `Couldn't upload ${file.name}${json?.error?.message ? `: ${json.error.message}` : '. Please try again.'}` } },
    })
  }
  return { url: json.secure_url, proof: ticket.proof, name: file.name, size: file.size }
}

api.interceptors.request.use(async (config) => {
  if (isDemo() || config._direct || !(config.data instanceof FormData)) return config
  const entries = [...config.data.entries()]
  const refs = []
  for (const [field, value] of entries) {
    if (!(value instanceof File)) continue
    const ref = await uploadDirect(value)
    if (!ref) return config // backend keeps files itself: send the form untouched
    refs.push({ field, ...ref })
  }
  if (!refs.length) return config

  const body = new FormData()
  entries.forEach(([key, value]) => { if (!(value instanceof File)) body.append(key, value) })
  body.append('directUploads', JSON.stringify(refs))
  config.data = body
  config._direct = true // a 401 retry must not upload the files again
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error
    const skip = !config || config._retried || NO_REFRESH.some((p) => config.url?.startsWith(p))
    if (response?.status !== 401 || skip) throw error

    // One refresh call shared by every request that hit 401 at the same time
    refreshing ??= api.post('/auth/refresh').finally(() => { refreshing = null })
    try {
      await refreshing
    } catch {
      listeners.forEach((fn) => fn())
      throw error
    }
    config._retried = true
    return api(config)
  },
)

// Human-readable message from an API error ({ success:false, message, details? })
export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  const data = err?.response?.data
  if (data?.details?.length) return data.details.map((d) => d.message).join('. ')
  if (data?.message) return data.message
  if (err?.code === 'ERR_NETWORK') return "Can't reach the server. Is the backend running?"
  return fallback
}

// Field errors from express-validator details -> { field: message }
export const fieldErrors = (err) => Object.fromEntries(
  (err?.response?.data?.details ?? []).filter((d) => d.field).map((d) => [d.field, d.message]),
)

// Builds multipart FormData. Objects/arrays are sent as JSON strings (backend toJson parses them).
// Skips undefined / null / '' so optional fields stay unset.
export const toFormData = (values) => {
  const fd = new FormData()
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (value instanceof File || value instanceof Blob) fd.append(key, value)
    else if (Array.isArray(value) && value[0] instanceof File) value.forEach((f) => fd.append(key, f))
    else if (typeof value === 'object' && !(value instanceof Date)) fd.append(key, JSON.stringify(value))
    else fd.append(key, value instanceof Date ? value.toISOString() : String(value))
  })
  return fd
}

// Unwraps { success, data } responses
export const get = (url, params) => api.get(url, { params }).then((r) => r.data)
export const post = (url, body) => api.post(url, body).then((r) => r.data)
export const put = (url, body) => api.put(url, body).then((r) => r.data)
export const patch = (url, body) => api.patch(url, body).then((r) => r.data)
export const del = (url) => api.delete(url).then((r) => r.data)

// Absolute URL for files the backend returns as /uploads/... (cloud URLs pass through)
export const fileUrl = (path) => {
  if (!path || /^(https?:|blob:|data:)/.test(path)) return path
  const origin = API_URL.startsWith('http') ? new URL(API_URL).origin : ''
  return `${origin}${path}`
}

// Download a binary response (reports, compliance PDFs) as a file
export const download = async (url, filename, params) => {
  const res = await api.get(url, { params, responseType: 'blob' })
  const name = /filename="?([^";]+)"?/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? filename
  const href = URL.createObjectURL(res.data)
  const a = Object.assign(document.createElement('a'), { href, download: name })
  a.click()
  URL.revokeObjectURL(href)
}

export default api
