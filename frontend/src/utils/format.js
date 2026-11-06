const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : '-')
export const formatDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '-')

export const formatDuration = (seconds) => {
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

// "in 3 days", "tomorrow", "today"
export const relativeDays = (d) => {
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 0) return `${-days} days ago`
  return `in ${days} days`
}

const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export const formatINR = (n) => (n == null ? '-' : inrFmt.format(n))

// 2500000 -> "₹25L", 12000000 -> "₹1.2Cr"
export const formatINRShort = (n) => {
  if (n == null) return '-'
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `₹${+(n / 1e5).toFixed(1)}L`
  if (n >= 1e3) return `₹${+(n / 1e3).toFixed(1)}K`
  return `₹${n}`
}

export const rangeINR = (r) => (r ? `${formatINRShort(r.min)} - ${formatINRShort(r.max)}` : '-')

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const sumValues = (obj = {}) => Object.values(obj).reduce((a, b) => a + b, 0)

export const humanize = (id = '') => id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
