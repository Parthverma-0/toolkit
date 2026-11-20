import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { Card, Empty } from '../../components/dashboard/Card.jsx'
import { Button, PageHeader, SearchInput, Tabs, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import MultiToggle from '../../components/dashboard/MultiToggle.jsx'
import { Field, Select, TextInput } from '../../components/ui/Field.jsx'
import StartupCard from '../../components/investor/StartupCard.jsx'
import StartupDrawer from '../../components/investor/StartupDrawer.jsx'
import useApi from '../../hooks/useApi.js'
import useDebounced from '../../hooks/useDebounced.js'
import { SECTORS, STAGES } from '../../constants/startup.js'
import { BUSINESS_MODELS, FUNDING_STATUSES, REVENUE_PREFERENCES } from '../../constants/investor.js'
import { del, errorMessage, get, put } from '../../api/client.js'

const EMPTY = {
  sector: [], stage: [], businessModel: [], revenueStatus: [], fundingStatus: [],
  location: '', incubated: '', fundingMin: '', fundingMax: '', age: '', sort: 'newest',
}
const AGES = [
  { id: '', label: 'Any age' }, { id: '0-1', label: 'Under 1 year' }, { id: '1-3', label: '1 to 3 years' },
  { id: '3-5', label: '3 to 5 years' }, { id: '5-', label: '5 years or more' },
]
const INCUBATED = [{ id: '', label: 'Any' }, { id: 'true', label: 'Incubated / accelerated' }, { id: 'false', label: 'Not incubated' }]

// Filters -> API query (arrays are sent comma-separated)
const toQuery = (f, q) => {
  const [ageMin, ageMax] = f.age ? f.age.split('-') : []
  return {
    q: q || undefined,
    sector: f.sector.join(',') || undefined,
    stage: f.stage.join(',') || undefined,
    businessModel: f.businessModel.join(',') || undefined,
    revenueStatus: f.revenueStatus.join(',') || undefined,
    fundingStatus: f.fundingStatus.join(',') || undefined,
    location: f.location.trim() || undefined,
    incubated: f.incubated || undefined,
    fundingMin: f.fundingMin === '' ? undefined : f.fundingMin,
    fundingMax: f.fundingMax === '' ? undefined : f.fundingMax,
    ageMin: ageMin || undefined,
    ageMax: ageMax || undefined,
    sort: f.sort === 'match' ? 'match' : undefined,
  }
}
const activeCount = (f) => Object.entries(f).filter(([k, v]) => k !== 'sort' && (Array.isArray(v) ? v.length : v !== '')).length

export default function Discover() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'recommended' ? 'recommended' : 'all'
  const [filters, setFilters] = useState(EMPTY)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const toast = useToast()
  const q = useDebounced(query.trim(), 300)
  const queryKey = JSON.stringify([tab, filters, q, page])

  const state = useApi(() => (tab === 'recommended'
    ? get('/investor-portal/startups/recommended', { limit: 12, page })
    : get('/investor-portal/startups', { ...toQuery(filters, q), limit: 12, page })), [queryKey])

  const update = (patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1) }
  const count = useMemo(() => activeCount(filters), [filters])

  const toggleShortlist = async (s) => {
    try {
      if (s.shortlisted) await del(`/investor-portal/shortlist/${s.id}`)
      else await put(`/investor-portal/shortlist/${s.id}`, {})
      toast(s.shortlisted ? 'Removed from shortlist' : `${s.name} added to shortlist`)
      state.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div>
      <PageHeader title="Discover startups" subtitle="Browse startups on Toolkit, filter by what matters to you, and connect with founders." />
      <Tabs
        tabs={[{ id: 'all', label: 'All startups' }, { id: 'recommended', label: 'Recommended for you' }]}
        value={tab} onChange={(t) => { setPage(1); setParams(t === 'all' ? {} : { tab: t }) }}
      />

      {tab === 'all' && (
        <div className="mb-6 grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1) }} placeholder="Search by name or description" />
            <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              <span className="inline-flex items-center gap-2"><SlidersHorizontal size={18} /> Filters{count > 0 && ` (${count})`}</span>
            </Button>
            <div className="w-44"><Select aria-label="Sort by" value={filters.sort} options={[{ id: 'newest', label: 'Newest first' }, { id: 'match', label: 'Best match' }]} onChange={(e) => update({ sort: e.target.value })} /></div>
            {count > 0 && <Button variant="ghost" onClick={() => { setFilters(EMPTY); setPage(1) }}>Clear filters</Button>}
          </div>

          {open && (
            <Card>
              <div className="grid gap-6">
                <Field label="Industry / sector"><MultiToggle label="Sector" options={SECTORS} value={filters.sector} onChange={(sector) => update({ sector })} /></Field>
                <Field label="Funding stage"><MultiToggle label="Stage" options={STAGES} value={filters.stage} onChange={(stage) => update({ stage })} /></Field>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Field label="Business model"><MultiToggle label="Business model" options={BUSINESS_MODELS} value={filters.businessModel} onChange={(businessModel) => update({ businessModel })} /></Field>
                  <Field label="Revenue status" hint="Only startups that share their revenue status can match."><MultiToggle label="Revenue status" options={REVENUE_PREFERENCES} value={filters.revenueStatus} onChange={(revenueStatus) => update({ revenueStatus })} /></Field>
                </div>
                <Field label="Funding status"><MultiToggle label="Funding status" options={FUNDING_STATUSES} value={filters.fundingStatus} onChange={(fundingStatus) => update({ fundingStatus })} /></Field>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Location" htmlFor="floc"><TextInput id="floc" placeholder="City or state" value={filters.location} onChange={(e) => update({ location: e.target.value })} /></Field>
                  <Field label="Needs at least (₹)" htmlFor="fmin"><TextInput id="fmin" type="number" min={0} value={filters.fundingMin} onChange={(e) => update({ fundingMin: e.target.value })} /></Field>
                  <Field label="Needs at most (₹)" htmlFor="fmax"><TextInput id="fmax" type="number" min={0} value={filters.fundingMax} onChange={(e) => update({ fundingMax: e.target.value })} /></Field>
                  <Field label="Startup age" htmlFor="fage"><Select id="fage" value={filters.age} options={AGES} onChange={(e) => update({ age: e.target.value })} /></Field>
                </div>
                <Field label="Incubator / accelerator" htmlFor="finc">
                  <div className="max-w-xs"><Select id="finc" value={filters.incubated} options={INCUBATED} onChange={(e) => update({ incubated: e.target.value })} /></div>
                </Field>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'recommended' && (
        <p className="mb-6 text-base text-ink-soft">Startups ranked by how closely they fit your sectors, stages, ticket size, locations and business models. Update these in your profile at any time.</p>
      )}

      <Async state={state}>{(list) => (list.length === 0 ? (
        <Card>
          <Empty title={tab === 'recommended' ? 'No recommendations yet' : 'No startups match'}>
            {tab === 'recommended' ? 'Widen your preferences in your profile to see more startups.' : 'Try removing a filter or searching for something else.'}
          </Empty>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((s) => (
              <StartupCard key={s.id} startup={s} onOpen={() => setSelected(s.id)} onConnect={() => setSelected(s.id)} onToggleShortlist={toggleShortlist} />
            ))}
          </div>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-ink-soft">Page {page}</span>
            <Button variant="secondary" size="sm" disabled={list.length < 12} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </>
      ))}</Async>

      {selected && <StartupDrawer id={selected} onClose={() => setSelected(null)} onChanged={state.reload} />}
    </div>
  )
}
