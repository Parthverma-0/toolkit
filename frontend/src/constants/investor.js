// Mirrors backend/src/utils/investorOptions.js (ids) with display labels.

export const INVESTOR_TYPES = [
  { id: 'angel', label: 'Individual Angel Investor' },
  { id: 'angel_network', label: 'Angel Investment Network' },
  { id: 'vc', label: 'Venture Capital (VC) Firm' },
  { id: 'pe', label: 'Private Equity (PE) Firm' },
  { id: 'family_office', label: 'Family Office' },
  { id: 'corporate', label: 'Corporate Investor' },
  { id: 'institutional', label: 'Institutional Investor' },
  { id: 'strategic', label: 'Strategic Investor' },
  { id: 'other', label: 'Other' },
]

export const INVESTOR_CATEGORIES = [
  { id: 'individual', label: 'Individual', hint: 'I invest on my own behalf' },
  { id: 'organisation', label: 'Organisation', hint: 'I represent a firm, fund or network' },
]

export const INVESTOR_SECTORS = [
  { id: 'technology', label: 'Technology' },
  { id: 'saas', label: 'SaaS' },
  { id: 'fintech', label: 'FinTech' },
  { id: 'healthtech', label: 'HealthTech' },
  { id: 'edtech', label: 'EdTech' },
  { id: 'agritech', label: 'AgriTech' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'consumer_brands', label: 'Consumer Brands' },
  { id: 'foodtech', label: 'FoodTech' },
  { id: 'deeptech', label: 'DeepTech' },
  { id: 'ai', label: 'Artificial Intelligence' },
  { id: 'cybersecurity', label: 'Cybersecurity' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'cleantech', label: 'CleanTech' },
  { id: 'mobility_ev', label: 'Mobility & EV' },
  { id: 'real_estate', label: 'Real Estate' },
  { id: 'd2c', label: 'D2C Brands' },
  { id: 'social_impact', label: 'Social Impact' },
  { id: 'other', label: 'Other' },
]

export const INVESTOR_STAGES = [
  { id: 'idea', label: 'Idea Stage' },
  { id: 'pre_seed', label: 'Pre-Seed' },
  { id: 'seed', label: 'Seed' },
  { id: 'pre_series_a', label: 'Pre-Series A' },
  { id: 'series_a', label: 'Series A' },
  { id: 'series_b', label: 'Series B' },
  { id: 'series_c_plus', label: 'Series C and Above' },
  { id: 'growth', label: 'Growth Stage' },
  { id: 'revenue_generating', label: 'Revenue-Generating Businesses' },
]

export const TICKET_SIZES = [
  { id: 'below_5l', label: 'Below ₹5 Lakhs' },
  { id: '5_25l', label: '₹5–25 Lakhs' },
  { id: '25_50l', label: '₹25–50 Lakhs' },
  { id: '50l_1cr', label: '₹50 Lakhs–₹1 Crore' },
  { id: '1_5cr', label: '₹1–5 Crores' },
  { id: '5_10cr', label: '₹5–10 Crores' },
  { id: '10cr_plus', label: '₹10 Crores and Above' },
  { id: 'flexible', label: 'Flexible / Case Dependent' },
]

export const GEOGRAPHIES = [
  { id: 'jaipur', label: 'Jaipur' },
  { id: 'rajasthan', label: 'Rajasthan' },
  { id: 'delhi_ncr', label: 'Delhi NCR' },
  { id: 'mumbai', label: 'Mumbai' },
  { id: 'bengaluru', label: 'Bengaluru' },
  { id: 'hyderabad', label: 'Hyderabad' },
  { id: 'pune', label: 'Pune' },
  { id: 'chennai', label: 'Chennai' },
  { id: 'across_india', label: 'Across India' },
  { id: 'international', label: 'International' },
]

export const BUSINESS_MODELS = [
  { id: 'b2b', label: 'B2B' },
  { id: 'b2c', label: 'B2C' },
  { id: 'b2b2c', label: 'B2B2C' },
  { id: 'd2c', label: 'D2C' },
  { id: 'saas', label: 'SaaS' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'other', label: 'Other' },
]

export const REVENUE_PREFERENCES = [
  { id: 'pre_revenue', label: 'Pre-Revenue Startups' },
  { id: 'early_revenue', label: 'Early Revenue' },
  { id: 'revenue_generating', label: 'Revenue-Generating Startups' },
  { id: 'profitable', label: 'Profitable Businesses' },
]

export const INVESTMENT_APPROACHES = [
  { id: 'lead', label: 'Lead Investor' },
  { id: 'co_investor', label: 'Co-Investor' },
  { id: 'follow_on', label: 'Follow-on Investor' },
  { id: 'strategic', label: 'Strategic Investor' },
  { id: 'open', label: 'Open to All' },
]

export const INVESTMENT_FREQUENCIES = [
  { id: 'one_two', label: '1–2 Investments Per Year' },
  { id: 'three_five', label: '3–5 Investments Per Year' },
  { id: 'five_ten', label: '5–10 Investments Per Year' },
  { id: 'ten_plus', label: '10+ Investments Per Year' },
  { id: 'as_arise', label: 'As Opportunities Arise' },
]

export const EQUITY_RANGES = [
  { id: 'below_5', label: 'Below 5%' },
  { id: '5_10', label: '5–10%' },
  { id: '10_20', label: '10–20%' },
  { id: '20_plus', label: '20% and Above' },
  { id: 'flexible', label: 'Flexible' },
]

export const EXPERTISE_AREAS = [
  { id: 'marketing', label: 'Marketing' },
  { id: 'technology', label: 'Technology' },
  { id: 'finance', label: 'Finance' },
  { id: 'operations', label: 'Operations' },
  { id: 'sales', label: 'Sales' },
  { id: 'product', label: 'Product' },
  { id: 'legal', label: 'Legal' },
  { id: 'hr', label: 'HR & Talent' },
  { id: 'strategy', label: 'Strategy' },
]

export const DOCUMENT_TYPES = [
  { id: 'pan', label: 'PAN / Business PAN' },
  { id: 'registration_certificate', label: 'Organisation registration certificate' },
  { id: 'portfolio', label: 'Investor profile / portfolio' },
  { id: 'accreditation', label: 'Accreditation or investment credentials' },
  { id: 'other', label: 'Other' },
]

export const VERIFICATION_STATUSES = [
  { id: 'pending', label: 'Pending Verification', tone: 'warning' },
  { id: 'verified', label: 'Verified', tone: 'success' },
  { id: 'rejected', label: 'Rejected', tone: 'danger' },
  { id: 'info_required', label: 'Additional Information Required', tone: 'warning' },
]

export const VISIBILITIES = [
  { id: 'public', label: 'Public profile', hint: 'Visible to founders and relevant platform users.' },
  { id: 'limited', label: 'Limited profile', hint: 'Only your name, role, organisation and sectors are visible until you connect.' },
  { id: 'private', label: 'Private profile', hint: 'Not discoverable in the investor directory.' },
]

// Startup-side options used by investor filters
export const FUNDING_STATUSES = [
  { id: 'bootstrapped', label: 'Bootstrapped' },
  { id: 'raising', label: 'Raising' },
  { id: 'funded', label: 'Funded' },
]

export const CONNECTION_STATUS_LABEL = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
}

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or unsolicited promotion' },
  { id: 'fake_profile', label: 'Fake or misleading profile' },
  { id: 'inappropriate', label: 'Inappropriate behaviour' },
  { id: 'misleading', label: 'Misleading investment claims' },
  { id: 'other', label: 'Something else' },
]

export const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? id

// Rough years since a date ("2 yrs")
export const ageLabel = (date) => {
  if (!date) return ''
  const years = (Date.now() - new Date(date).getTime()) / (365.25 * 86400000)
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} mo`
  return `${Math.round(years * 10) / 10} yrs`
}

// Match score -> short label and badge tone
export const matchTier = (score) => {
  if (score >= 80) return { label: 'Strong match', tone: 'success' }
  if (score >= 60) return { label: 'Good match', tone: 'brand' }
  return { label: 'Partial match', tone: 'neutral' }
}
