// Mirrors backend utils/constants.js + utils/phone.js so the form fails fast with the same rules
export const CIN_REGEX = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/
export const DPIIT_REGEX = /^DIPP\d{3,}$/
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
