// Mirrors backend utils/constants.js + validators/startup.validator.js so forms fail fast with the same rules
// CIN: L/U + 5-digit industry code + 2-letter state + 4-digit year + 3-letter company type + 6 digits
export const CIN_REGEX = /^[LU]\d{5}[A-Z]{2}(\d{4})[A-Z]{3}\d{6}$/
// Startup India recognition (DIPP) number: 6 digits
export const DIPP_REGEX = /^\d{6}$/
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Optional fields: '' is fine, anything else must be valid
export const cinError = (value) => {
  if (!value) return ''
  const m = CIN_REGEX.exec(value)
  if (!m) return 'CIN must be 21 characters, e.g. U72900KA2021PTC123456'
  const year = Number(m[1])
  if (year < 1850 || year > new Date().getFullYear()) return 'CIN has an invalid incorporation year (characters 9 to 12)'
  return ''
}
export const dippError = (value) => (!value || DIPP_REGEX.test(value) ? '' : 'DIPP number must be 6 digits, e.g. 123456')
// Typing helpers: CIN upper-case without spaces; DIPP digits only (drops a pasted "DIPP" prefix)
export const cleanCin = (v) => v.toUpperCase().replace(/\s/g, '').slice(0, 21)
export const cleanDipp = (v) => v.replace(/^\s*DIPP/i, '').replace(/\D/g, '').slice(0, 6)

export const startupNameError = (value) => {
  if (!value.trim()) return 'Enter your startup name'
  if (value.includes('@')) return 'Enter your startup name, not an email address'
  return ''
}

export const normalizePhone = (raw) => {
  const digits = String(raw).replace(/[\s\-()]/g, '')
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits
  return null
}

export const SECTORS = [
  { id: 'agritech', label: 'Agritech' },
  { id: 'ai_ml', label: 'AI / ML' },
  { id: 'cleantech', label: 'Cleantech' },
  { id: 'consumer', label: 'Consumer' },
  { id: 'deeptech', label: 'Deeptech' },
  { id: 'edtech', label: 'Edtech' },
  { id: 'fintech', label: 'Fintech' },
  { id: 'foodtech', label: 'Foodtech' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'healthtech', label: 'Healthtech' },
  { id: 'iot_hardware', label: 'IoT & Hardware' },
  { id: 'logistics', label: 'Logistics' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'media', label: 'Media' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'retail_ecommerce', label: 'Retail & E-commerce' },
  { id: 'saas', label: 'SaaS' },
  { id: 'social_impact', label: 'Social impact' },
  { id: 'other', label: 'Other' },
]

export const STAGES = [
  { id: 'ideation', label: 'Ideation' },
  { id: 'validation', label: 'Validation' },
  { id: 'mvp', label: 'MVP' },
  { id: 'early_traction', label: 'Early traction' },
  { id: 'scaling', label: 'Scaling' },
  { id: 'growth', label: 'Growth' },
]

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const LOGO_MAX_MB = 2
