import axios from 'axios'

// All requests go to /api on the same origin. In dev, Vite proxies /api and /uploads
// to the backend (see vite.config.js); on Vercel the backend is a service of the same
// deployment (see /vercel.json). Either way the httpOnly auth cookies are first-party.
// In production set VITE_API_URL if the API lives on another domain.
const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: API_URL, withCredentials: true })

// Auth endpoints that must never trigger a refresh-and-retry loop
const NO_REFRESH = ['/auth/google', '/auth/refresh', '/auth/logout']

let refreshing = null
const listeners = new Set()

// AuthContext subscribes so a failed refresh logs the user out everywhere
export const onSessionExpired = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// A startup without a profile tried an action (tool, apply, book, connect, register...).
// The backend answers 403 PROFILE_INCOMPLETE; the startup area subscribes and opens the profile popup.
const profileListeners = new Set()
export const onProfileRequired = (fn) => {
  profileListeners.add(fn)
  return () => profileListeners.delete(fn)
}
export const isProfileRequired = (err) => err?.response?.data?.code === 'PROFILE_INCOMPLETE'

// Direct uploads. When the backend stores files on Cloudinary (always the case on Vercel,
// where request bodies are capped at 4.5 MB), each file goes straight from the browser to
// Cloudinary and the form carries a signed reference to it in `directUploads` instead.
// With local disk storage the backend answers direct:false and files travel with the form.
let directUploads = true

const CHUNK_AT = 20 * 1024 * 1024 // larger files go up in 20 MB pieces (Cloudinary rejects big single requests)

const uploadError = (file, detail) => Object.assign(new Error('Upload failed'), {
  // Same shape as an API error so errorMessage() can show it
  response: { data: { message: `Couldn't upload ${file.name}${detail ? `: ${detail}` : '. Please check your connection and try again.'}` } },
})

// XHR (not fetch) because it reports upload progress. Resolves { status, json }; network errors reject.
const sendToCloud = (url, body, headers, onBytes) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest()
  xhr.open('POST', url)
  Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
  xhr.upload.onprogress = (e) => e.lengthComputable && onBytes(e.loaded)
  xhr.onerror = () => reject(new Error('network'))
  xhr.ontimeout = xhr.onerror
  xhr.onload = () => {
    let json = null
    try { json = JSON.parse(xhr.responseText) } catch { /* not JSON */ }
    resolve({ status: xhr.status, json })
  }
  xhr.send(body)
})

// Uploads one file to Cloudinary (in chunks when large). onBytes(totalBytesSentSoFar) drives the progress bar.
const sendFile = async (file, ticket, onBytes) => {
  const form = (blob) => {
    const body = new FormData()
    Object.entries(ticket.fields).forEach(([key, value]) => body.append(key, value))
    body.append('file', blob, file.name)
    return body
  }
  if (file.size <= CHUNK_AT) return sendToCloud(ticket.uploadUrl, form(file), {}, onBytes)

  const uploadId = `${Date.now()}${Math.random().toString(16).slice(2)}`
  let last = null
  for (let start = 0; start < file.size; start += CHUNK_AT) {
    const end = Math.min(start + CHUNK_AT, file.size)
    last = await sendToCloud(
      ticket.uploadUrl, form(file.slice(start, end)),
      { 'X-Unique-Upload-Id': uploadId, 'Content-Range': `bytes ${start}-${end - 1}/${file.size}` },
      (loaded) => onBytes(start + Math.min(loaded, end - start)),
    )
    if (last.status >= 400) break
  }
  return last
}

const uploadDirect = async (file, onBytes) => {
  if (!directUploads) return null
  const { data: { data: ticket } } = await api.post('/uploads/sign', { mimetype: file.type })
  if (!ticket.direct) {
    directUploads = false
    return null
  }
  let res = null
  try {
    res = await sendFile(file, ticket, onBytes)
  } catch {
    throw uploadError(file)
  }
  if (!res || res.status >= 400 || !res.json?.secure_url) throw uploadError(file, res?.json?.error?.message)
  return { url: res.json.secure_url, proof: ticket.proof, name: file.name, size: file.size }
}

api.interceptors.request.use(async (config) => {
  if (config._direct || !(config.data instanceof FormData)) return config
  const entries = [...config.data.entries()]
  const files = entries.filter(([, value]) => value instanceof File).map(([, value]) => value)
  const total = files.reduce((sum, f) => sum + f.size, 0) || 1
  let finished = 0
  const refs = []
  for (const [field, value] of entries) {
    if (!(value instanceof File)) continue
    // config._onProgress(0..1) is optional; pass it as the `options` argument of post() / patch()
    const ref = await uploadDirect(value, (sent) => config._onProgress?.(Math.min((finished + sent) / total, 1)))
    if (!ref) return config // backend keeps files itself: send the form untouched
    finished += value.size
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
    if (isProfileRequired(error)) profileListeners.forEach((fn) => fn())
    const skip =!config || config._retried || NO_REFRESH.some((p) => config.url?.startsWith(p))
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
  if (isProfileRequired(err)) return data?.message || 'Complete your profile to continue.'
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
// options: { _onProgress(fraction) } reports file upload progress (0..1) for forms that carry files
export const post = (url, body, options) => api.post(url, body, options).then((r) => r.data)
export const put = (url, body, options) => api.put(url, body, options).then((r) => r.data)
export const patch = (url, body, options) => api.patch(url, body, options).then((r) => r.data)
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
