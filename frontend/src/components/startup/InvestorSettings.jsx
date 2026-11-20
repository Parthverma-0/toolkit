import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Card } from '../dashboard/Card.jsx'
import { Button, Detail, Drawer, useToast } from '../dashboard/ui.jsx'
import { ErrorText, Field, Select, TextInput } from '../ui/Field.jsx'
import { BUSINESS_MODELS, FUNDING_STATUSES, REVENUE_PREFERENCES, labelOf } from '../../constants/investor.js'
import { errorMessage, fieldErrors, patch, toFormData } from '../../api/client.js'
import { formatINR } from '../../utils/format.js'

const NONE = { id: '', label: 'Not shared' }

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-brand" />
      <span><span className="block text-base text-ink">{label}</span><span className="block text-sm text-ink-soft">{hint}</span></span>
    </label>
  )
}

// What registered investors can see about this startup, and which details the founder shares.
// Name, sector, stage, location and the description are always part of the investor-facing
// profile (unless the startup is hidden); funding and revenue details are the founder's choice.
export default function InvestorSettings({ startup, reload }) {
  const toast = useToast()
  const vis = startup.investorVisibility ?? {}
  const [draft, setDraft] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const listed = vis.listed !== false
  const showFunding = vis.showFundingAsk !== false
  const showRevenue = vis.showRevenue === true

  const open = () => {
    setError('')
    setErrors({})
    setDraft({
      businessModel: startup.businessModel ?? '', revenueStatus: startup.revenueStatus ?? '', fundingStatus: startup.fundingStatus ?? '',
      fundingAsk: startup.fundingAsk ?? '', listed, showFundingAsk: showFunding, showRevenue,
    })
  }
  const set = (patch2) => setDraft((d) => ({ ...d, ...patch2 }))

  const save = async () => {
    if (draft.fundingAsk !== '' && Number(draft.fundingAsk) < 0) return setErrors({ fundingAsk: 'Enter a positive amount' })
    setSaving(true)
    setError('')
    try {
      await patch('/startups/me', toFormData({
        businessModel: draft.businessModel || undefined,
        revenueStatus: draft.revenueStatus || undefined,
        fundingStatus: draft.fundingStatus || undefined,
        fundingAsk: draft.fundingAsk === '' ? undefined : Number(draft.fundingAsk),
        investorVisibility: { listed: draft.listed, showFundingAsk: draft.showFundingAsk, showRevenue: draft.showRevenue },
      }))
      toast('Investor settings saved')
      setDraft(null)
      reload()
    } catch (err) {
      setError(errorMessage(err))
      setErrors(fieldErrors(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card
        title="Investor visibility" className="mt-6"
        action={<Button size="sm" variant="secondary" onClick={open}><span className="inline-flex items-center gap-1.5"><Pencil size={14} /> Edit</span></Button>}
      >
        <p className="mb-5 max-w-3xl text-base text-ink-soft">
          Registered investors can browse startups on Toolkit. They see your name, sector, stage, location and description.
          Funding and revenue details are only shown if you allow it, and your contact details are only shared after you accept a connection.
        </p>
        <dl className="grid gap-3">
          <Detail label="Listed to investors">{listed ? 'Yes, investors can find this startup' : 'No, hidden from investors'}</Detail>
          <Detail label="Business model">{startup.businessModel && labelOf(BUSINESS_MODELS, startup.businessModel)}</Detail>
          <Detail label="Funding required">{startup.fundingAsk != null && `${formatINR(startup.fundingAsk)} (${showFunding ? 'visible to investors' : 'hidden'})`}</Detail>
          <Detail label="Funding status">{startup.fundingStatus && `${labelOf(FUNDING_STATUSES, startup.fundingStatus)} (${showFunding ? 'visible' : 'hidden'})`}</Detail>
          <Detail label="Revenue status">{startup.revenueStatus && `${labelOf(REVENUE_PREFERENCES, startup.revenueStatus)} (${showRevenue ? 'visible' : 'hidden'})`}</Detail>
        </dl>
      </Card>

      <Drawer
        open={Boolean(draft)} title="Investor visibility" subtitle="Choose what registered investors can see." onClose={() => setDraft(null)}
        footer={(
          <>
            {error && <ErrorText>{error}</ErrorText>}
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</Button>
          </>
        )}
      >
        {draft && (
          <div className="grid gap-6">
            <Field label="Business model" htmlFor="sbm" optional>
              <Select id="sbm" value={draft.businessModel} options={[NONE, ...BUSINESS_MODELS]} onChange={(e) => set({ businessModel: e.target.value })} />
            </Field>
            <Field label="Funding required (₹)" htmlFor="sask" optional error={errors.fundingAsk} hint="How much you are looking to raise.">
              <TextInput id="sask" type="number" min={0} value={draft.fundingAsk} error={errors.fundingAsk} onChange={(e) => set({ fundingAsk: e.target.value })} />
            </Field>
            <Field label="Funding status" htmlFor="sfs" optional>
              <Select id="sfs" value={draft.fundingStatus} options={[NONE, ...FUNDING_STATUSES]} onChange={(e) => set({ fundingStatus: e.target.value })} />
            </Field>
            <Field label="Revenue status" htmlFor="srev" optional>
              <Select id="srev" value={draft.revenueStatus} options={[NONE, ...REVENUE_PREFERENCES]} onChange={(e) => set({ revenueStatus: e.target.value })} />
            </Field>
            <div className="grid gap-4 border-t border-line pt-5">
              <Switch checked={draft.listed} onChange={(listed2) => set({ listed: listed2 })} label="List my startup for investors" hint="Turn off to hide your startup from investor discovery completely." />
              <Switch checked={draft.showFundingAsk} onChange={(showFundingAsk) => set({ showFundingAsk })} label="Show funding required and funding status" hint="Investors can filter and match on this when shown." />
              <Switch checked={draft.showRevenue} onChange={(showRevenue2) => set({ showRevenue: showRevenue2 })} label="Show revenue status" hint="Hidden by default." />
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}
