import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import MultiToggle from '../dashboard/MultiToggle.jsx'
import ImagePick from './ImagePick.jsx'
import { Field, Pills, Select, Textarea, TextInput } from '../ui/Field.jsx'
import {
  BUSINESS_MODELS, EQUITY_RANGES, EXPERTISE_AREAS, GEOGRAPHIES, INVESTMENT_APPROACHES, INVESTMENT_FREQUENCIES,
  INVESTOR_CATEGORIES, INVESTOR_SECTORS, INVESTOR_STAGES, INVESTOR_TYPES, REVENUE_PREFERENCES, TICKET_SIZES,
} from '../../constants/investor.js'
import { EMAIL_REGEX, normalizePhone } from '../../constants/startup.js'

// The investor profile as a flat form, shared by onboarding (all sections at once) and the
// profile page (one section per editor). Backend: PUT /api/investor-portal/me/profile.

export const SECTIONS = {
  basic: ['fullName', 'phone', 'contactEmail', 'designation', 'linkedin', 'location', 'country', 'photo'],
  organisation: ['category', 'investorType', 'organisationName', 'organisationWebsite', 'organisationLinkedin', 'yearEstablished', 'headOffice', 'organisationLogo'],
  preferences: ['sectors', 'stages', 'ticketSizes', 'customTicket', 'locations', 'businessModels', 'revenuePreferences', 'approaches', 'frequency', 'equityRanges'],
  background: ['professionalBackground', 'yearsOfExperience', 'previousInvestments', 'portfolio', 'expertise', 'mentorshipAvailable', 'strategicSupport', 'networkingSupport', 'bio'],
}
export const ALL_SECTIONS = Object.keys(SECTIONS)

export const emptyForm = (user) => ({
  fullName: user?.name ?? '', phone: user?.phone ?? '', contactEmail: user?.email ?? '', designation: '', linkedin: '',
  location: '', country: 'India', photo: null, photoUrl: user?.avatar ?? '',
  category: '', investorType: '', organisationName: '', organisationWebsite: '', organisationLinkedin: '', yearEstablished: '', headOffice: '',
  organisationLogo: null, organisationLogoUrl: '',
  sectors: [], stages: [], ticketSizes: [], ticketMin: '', ticketMax: '', locations: [], businessModels: [], revenuePreferences: [],
  approaches: [], frequency: '', equityRanges: [],
  professionalBackground: '', yearsOfExperience: '', previousInvestments: '', portfolio: [], expertise: [],
  mentorshipAvailable: false, strategicSupport: false, networkingSupport: false, bio: '',
})

// Saved profile (GET /me/profile) -> form values
export const formFromProfile = (p, user) => ({
  ...emptyForm(user),
  fullName: p.fullName ?? user?.name ?? '',
  phone: p.phone ?? '',
  contactEmail: p.contactEmail ?? user?.email ?? '',
  designation: p.designation ?? '', linkedin: p.linkedin ?? '', location: p.location ?? '', country: p.country ?? 'India',
  photoUrl: p.photo ?? '',
  category: p.category ?? '', investorType: p.investorType ?? '', organisationName: p.organisationName ?? '',
  organisationWebsite: p.organisationWebsite ?? '', organisationLinkedin: p.organisationLinkedin ?? '',
  yearEstablished: p.yearEstablished ?? '', headOffice: p.headOffice ?? '', organisationLogoUrl: p.organisationLogo ?? '',
  sectors: p.sectors ?? [], stages: p.stages ?? [], ticketSizes: p.ticketSizes ?? [],
  ticketMin: p.customTicket?.min ?? '', ticketMax: p.customTicket?.max ?? '',
  locations: p.locations ?? [], businessModels: p.businessModels ?? [], revenuePreferences: p.revenuePreferences ?? [],
  approaches: p.approaches ?? [], frequency: p.frequency ?? '', equityRanges: p.equityRanges ?? [],
  professionalBackground: p.professionalBackground ?? '', yearsOfExperience: p.yearsOfExperience ?? '',
  previousInvestments: p.previousInvestments ?? '',
  portfolio: (p.portfolio ?? []).map(({ name, website, sector, year }) => ({ name, website: website ?? '', sector: sector ?? '', year: year ?? '' })),
  expertise: p.expertise ?? [],
  mentorshipAvailable: Boolean(p.mentorshipAvailable), strategicSupport: Boolean(p.strategicSupport), networkingSupport: Boolean(p.networkingSupport),
  bio: p.bio ?? '',
})

const ENUM_FIELDS = ['category', 'investorType', 'frequency'] // the API rejects '' for these

// Form values -> multipart FormData for the chosen sections. Empty text is sent (so a field can be cleared).
export const payloadFromForm = (form, sections = ALL_SECTIONS) => {
  const fd = new FormData()
  sections.flatMap((s) => SECTIONS[s]).forEach((key) => {
    let value = form[key]
    if (key === 'customTicket') {
      const min = form.ticketMin === '' ? undefined : Number(form.ticketMin)
      const max = form.ticketMax === '' ? undefined : Number(form.ticketMax)
      value = { min, max }
    }
    if (key === 'portfolio') {
      value = form.portfolio.filter((p) => p.name.trim()).map((p) => ({
        name: p.name.trim(), website: p.website?.trim() || undefined, sector: p.sector?.trim() || undefined, year: p.year === '' ? undefined : Number(p.year),
      }))
    }
    if (value === undefined || value === null) return
    if (value instanceof File) fd.append(key, value)
    else if (typeof value === 'object') fd.append(key, JSON.stringify(value))
    else if (value === '' && ENUM_FIELDS.includes(key)) return
    else fd.append(key, String(value))
  })
  return fd
}

const isUrl = (v) => !v || /^https?:\/\/\S+\.\S+/i.test(v)

// Mirrors the backend's mandatory fields. Returns { field: message }.
export const validateSection = (name, f) => {
  const e = {}
  if (name === 'basic') {
    if (f.fullName.trim().length < 2) e.fullName = 'Enter your full name'
    if (!normalizePhone(f.phone)) e.phone = 'Enter a valid mobile number'
    if (!EMAIL_REGEX.test(f.contactEmail)) e.contactEmail = 'Enter a valid email address'
    if (!f.designation.trim()) e.designation = 'Enter your designation'
    if (!f.location.trim()) e.location = 'Enter your city'
    if (!f.country.trim()) e.country = 'Enter your country'
    if (!isUrl(f.linkedin)) e.linkedin = 'Enter a full link starting with https://'
  }
  if (name === 'organisation') {
    if (!f.category) e.category = 'Choose how you invest'
    if (!f.investorType) e.investorType = 'Choose an investor type'
    if (f.category === 'organisation' && !f.organisationName.trim()) e.organisationName = 'Enter your organisation or firm name'
    if (!isUrl(f.organisationWebsite)) e.organisationWebsite = 'Enter a full link starting with https://'
    if (!isUrl(f.organisationLinkedin)) e.organisationLinkedin = 'Enter a full link starting with https://'
    if (f.yearEstablished !== '' && (+f.yearEstablished < 1800 || +f.yearEstablished > new Date().getFullYear())) e.yearEstablished = 'Enter a valid year'
  }
  if (name === 'preferences') {
    if (!f.sectors.length) e.sectors = 'Pick at least one sector'
    if (!f.stages.length) e.stages = 'Pick at least one stage'
    const customOk = f.ticketMin !== '' || f.ticketMax !== ''
    if (!f.ticketSizes.length && !customOk) e.ticketSizes = 'Choose a ticket size or enter a custom amount'
    if (f.ticketMin !== '' && f.ticketMax !== '' && +f.ticketMin > +f.ticketMax) e.ticketMax = 'Maximum must be more than the minimum'
    if (!f.locations.length) e.locations = 'Pick at least one location'
  }
  if (name === 'background') {
    if (f.bio.length > 2000) e.bio = 'Keep the bio under 2000 characters'
    if (!f.portfolio.every((p) => isUrl(p.website))) e.portfolio = 'Portfolio links must start with https://'
  }
  return e
}

// ---------- building blocks ----------

// Multi-select with an "add your own" box; custom entries show as removable chips
export function PickWithCustom({ options, value, onChange, label, placeholder }) {
  const [draft, setDraft] = useState('')
  const known = options.map((o) => o.id)
  const custom = value.filter((v) => !known.includes(v))
  const add = () => {
    const text = draft.trim().slice(0, 60)
    if (!text || value.includes(text)) return
    onChange([...value, text])
    setDraft('')
  }
  return (
    <div className="grid gap-3">
      <MultiToggle label={label} options={options} value={value} onChange={onChange} />
      <div className="flex gap-2">
        <TextInput
          value={draft} placeholder={placeholder} aria-label={`Add custom ${label.toLowerCase()}`} className="max-w-xs"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d5dae3] px-3.5 text-[15px] font-medium text-ink hover:border-glow hover:text-brand">
          <Plus size={16} /> Add
        </button>
      </div>
      {custom.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {custom.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand px-3.5 py-1.5 text-sm font-medium text-white">
              {c}
              <button type="button" aria-label={`Remove ${c}`} onClick={() => onChange(value.filter((v) => v !== c))}><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-brand" />
      <span>
        <span className="block text-base text-ink">{label}</span>
        {hint && <span className="block text-sm text-ink-soft">{hint}</span>}
      </span>
    </label>
  )
}

export function PortfolioEditor({ value, onChange, error }) {
  const update = (i, patch) => onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  return (
    <div className="grid gap-3">
      {value.map((p, i) => (
        <div key={i} className="relative grid gap-3 rounded-xl border border-line p-4 pr-12 sm:grid-cols-2">
          <TextInput aria-label="Company name" placeholder="Company name" value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
          <TextInput aria-label="Sector" placeholder="Sector" value={p.sector} onChange={(e) => update(i, { sector: e.target.value })} />
          <TextInput aria-label="Year invested" type="number" placeholder="Year" value={p.year} onChange={(e) => update(i, { year: e.target.value })} />
          <TextInput aria-label="Website" placeholder="https://" value={p.website} onChange={(e) => update(i, { website: e.target.value })} />
          <button type="button" aria-label="Remove company" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 rounded-lg p-2 text-ink-soft hover:bg-canvas"><X size={18} /></button>
        </div>
      ))}
      <button
        type="button" onClick={() => onChange([...value, { name: '', website: '', sector: '', year: '' }])}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[#d5dae3] px-4 py-2 text-[15px] font-medium text-ink hover:border-glow hover:text-brand"
      >
        <Plus size={16} /> Add a portfolio company
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

// ---------- sections ----------

export function BasicSection({ form, set, errors }) {
  return (
    <div className="grid gap-6">
      <Field label="Profile photograph" optional>
        <ImagePick label="Photo" round file={form.photo} url={form.photoUrl} onChange={(photo) => set({ photo })} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Full name" htmlFor="iname" required error={errors.fullName}>
          <TextInput id="iname" value={form.fullName} error={errors.fullName} onChange={(e) => set({ fullName: e.target.value })} />
        </Field>
        <Field label="Designation" htmlFor="ides" required error={errors.designation}>
          <TextInput id="ides" value={form.designation} error={errors.designation} placeholder="Managing Partner" onChange={(e) => set({ designation: e.target.value })} />
        </Field>
        <Field label="Email address" htmlFor="iemail" required error={errors.contactEmail} hint="Founders only see this after you connect.">
          <TextInput id="iemail" type="email" value={form.contactEmail} error={errors.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
        </Field>
        <Field label="Mobile number" htmlFor="iphone" required error={errors.phone} hint="Kept private, like your email.">
          <TextInput id="iphone" type="tel" value={form.phone} error={errors.phone} placeholder="+91 98765 43210" onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="City" htmlFor="icity" required error={errors.location}>
          <TextInput id="icity" value={form.location} error={errors.location} placeholder="Jaipur" onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label="Country" htmlFor="icountry" required error={errors.country}>
          <TextInput id="icountry" value={form.country} error={errors.country} onChange={(e) => set({ country: e.target.value })} />
        </Field>
      </div>
      <Field label="LinkedIn profile" htmlFor="ili" optional error={errors.linkedin} hint="Recommended: it helps founders and our team verify you.">
        <TextInput id="ili" value={form.linkedin} error={errors.linkedin} placeholder="https://linkedin.com/in/..." onChange={(e) => set({ linkedin: e.target.value })} />
      </Field>
    </div>
  )
}

export function OrganisationSection({ form, set, errors }) {
  const org = form.category === 'organisation'
  return (
    <div className="grid gap-6">
      <Field label="How do you invest?" required error={errors.category}>
        <Pills label="Investor category" options={INVESTOR_CATEGORIES} value={form.category} error={errors.category} onChange={(category) => set({ category })} />
        {form.category && <p className="mt-2 text-sm text-ink-soft">{INVESTOR_CATEGORIES.find((c) => c.id === form.category).hint}</p>}
      </Field>
      <Field label="Investor type" htmlFor="itype" required error={errors.investorType}>
        <Select id="itype" value={form.investorType} error={errors.investorType} placeholder="Select a type" options={INVESTOR_TYPES} onChange={(e) => set({ investorType: e.target.value })} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Organisation / firm name" htmlFor="iorg" required={org} optional={!org} error={errors.organisationName}>
          <TextInput id="iorg" value={form.organisationName} error={errors.organisationName} onChange={(e) => set({ organisationName: e.target.value })} />
        </Field>
        <Field label="Head office location" htmlFor="ihq" optional>
          <TextInput id="ihq" value={form.headOffice} onChange={(e) => set({ headOffice: e.target.value })} />
        </Field>
        <Field label="Organisation website" htmlFor="iweb" optional error={errors.organisationWebsite}>
          <TextInput id="iweb" value={form.organisationWebsite} error={errors.organisationWebsite} placeholder="https://" onChange={(e) => set({ organisationWebsite: e.target.value })} />
        </Field>
        <Field label="Organisation LinkedIn" htmlFor="iorgli" optional error={errors.organisationLinkedin}>
          <TextInput id="iorgli" value={form.organisationLinkedin} error={errors.organisationLinkedin} placeholder="https://linkedin.com/company/..." onChange={(e) => set({ organisationLinkedin: e.target.value })} />
        </Field>
        <Field label="Year of establishment" htmlFor="iyear" optional error={errors.yearEstablished}>
          <TextInput id="iyear" type="number" value={form.yearEstablished} error={errors.yearEstablished} onChange={(e) => set({ yearEstablished: e.target.value })} />
        </Field>
      </div>
      <Field label="Organisation logo" optional>
        <ImagePick label="Logo" file={form.organisationLogo} url={form.organisationLogoUrl} onChange={(organisationLogo) => set({ organisationLogo })} />
      </Field>
    </div>
  )
}

export function PreferencesSection({ form, set, errors }) {
  return (
    <div className="grid gap-8">
      <Field label="Preferred industries / sectors" required error={errors.sectors}>
        <PickWithCustom label="Sectors" options={INVESTOR_SECTORS} value={form.sectors} onChange={(sectors) => set({ sectors })} placeholder="Add another sector" />
      </Field>
      <Field label="Preferred investment stage" required error={errors.stages}>
        <MultiToggle label="Stages" options={INVESTOR_STAGES} value={form.stages} onChange={(stages) => set({ stages })} />
      </Field>
      <Field label="Typical ticket size per startup" required error={errors.ticketSizes}>
        <MultiToggle label="Ticket sizes" options={TICKET_SIZES} value={form.ticketSizes} onChange={(ticketSizes) => set({ ticketSizes })} />
        <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
          <Field label="Custom minimum (₹)" htmlFor="itmin" optional>
            <TextInput id="itmin" type="number" min={0} value={form.ticketMin} onChange={(e) => set({ ticketMin: e.target.value })} />
          </Field>
          <Field label="Custom maximum (₹)" htmlFor="itmax" optional error={errors.ticketMax}>
            <TextInput id="itmax" type="number" min={0} value={form.ticketMax} error={errors.ticketMax} onChange={(e) => set({ ticketMax: e.target.value })} />
          </Field>
        </div>
      </Field>
      <Field label="Geographical preferences" required error={errors.locations}>
        <PickWithCustom label="Locations" options={GEOGRAPHIES} value={form.locations} onChange={(locations) => set({ locations })} placeholder="Add another location" />
      </Field>
      <Field label="Preferred business model" optional>
        <MultiToggle label="Business models" options={BUSINESS_MODELS} value={form.businessModels} onChange={(businessModels) => set({ businessModels })} />
      </Field>
      <Field label="Revenue preference" optional>
        <MultiToggle label="Revenue preference" options={REVENUE_PREFERENCES} value={form.revenuePreferences} onChange={(revenuePreferences) => set({ revenuePreferences })} />
      </Field>
      <Field label="Investment approach" optional>
        <MultiToggle label="Approach" options={INVESTMENT_APPROACHES} value={form.approaches} onChange={(approaches) => set({ approaches })} />
      </Field>
      <Field label="Investment frequency" optional>
        <Pills label="Frequency" options={INVESTMENT_FREQUENCIES} value={form.frequency} onChange={(frequency) => set({ frequency })} />
      </Field>
      <Field label="Preferred ownership / equity range" optional>
        <MultiToggle label="Equity range" options={EQUITY_RANGES} value={form.equityRanges} onChange={(equityRanges) => set({ equityRanges })} />
      </Field>
    </div>
  )
}

export function BackgroundSection({ form, set, errors }) {
  return (
    <div className="grid gap-7">
      <Field label="Short bio" htmlFor="ibio" optional error={errors.bio} hint={`${form.bio.length} / 2000. Shown on your public profile.`}>
        <Textarea id="ibio" rows={4} maxLength={2000} value={form.bio} error={errors.bio} placeholder="A brief professional introduction" onChange={(e) => set({ bio: e.target.value })} />
      </Field>
      <Field label="Professional background" htmlFor="ibg" optional hint="Previous experience and career.">
        <Textarea id="ibg" rows={4} maxLength={3000} value={form.professionalBackground} onChange={(e) => set({ professionalBackground: e.target.value })} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Years of investment experience" htmlFor="iexp" optional>
          <TextInput id="iexp" type="number" min={0} value={form.yearsOfExperience} onChange={(e) => set({ yearsOfExperience: e.target.value })} />
        </Field>
        <Field label="Startups invested in so far" htmlFor="iprev" optional>
          <TextInput id="iprev" type="number" min={0} value={form.previousInvestments} onChange={(e) => set({ previousInvestments: e.target.value })} />
        </Field>
      </div>
      <Field label="Portfolio companies" optional error={errors.portfolio} hint="Add the startups you have backed, one by one.">
        <PortfolioEditor value={form.portfolio} onChange={(portfolio) => set({ portfolio })} error={errors.portfolio} />
      </Field>
      <Field label="Areas of expertise" optional>
        <PickWithCustom label="Expertise" options={EXPERTISE_AREAS} value={form.expertise} onChange={(expertise) => set({ expertise })} placeholder="Add another area" />
      </Field>
      <div className="grid gap-4">
        <Toggle checked={form.mentorshipAvailable} onChange={(mentorshipAvailable) => set({ mentorshipAvailable })} label="Available for mentorship" />
        <Toggle checked={form.strategicSupport} onChange={(strategicSupport) => set({ strategicSupport })} label="Provides strategic business guidance" />
        <Toggle checked={form.networkingSupport} onChange={(networkingSupport) => set({ networkingSupport })} label="Can offer industry connections" />
      </div>
    </div>
  )
}

export const SECTION_COMPONENTS = {
  basic: BasicSection, organisation: OrganisationSection, preferences: PreferencesSection, background: BackgroundSection,
}
