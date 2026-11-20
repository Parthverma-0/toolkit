import { Link } from 'react-router-dom'
import { Clock, ShieldAlert, ShieldCheck } from 'lucide-react'

const COPY = {
  pending: {
    icon: Clock, tone: 'border-amber-200 bg-amber-50 text-amber-900',
    title: 'Verification pending',
    text: 'Our team is reviewing your profile. You can browse and shortlist startups now; connecting with founders opens once you are verified.',
  },
  rejected: {
    icon: ShieldAlert, tone: 'border-red-200 bg-red-50 text-red-900',
    title: 'Verification was not approved',
    text: 'Please review the note from our team, update your profile or documents, and resubmit.',
  },
  info_required: {
    icon: ShieldAlert, tone: 'border-amber-200 bg-amber-50 text-amber-900',
    title: 'More information needed',
    text: 'Our team needs a little more to verify your profile.',
  },
}

// Shown on the investor home until the profile is verified
export default function VerificationBanner({ verification, complete = true, onComplete }) {
  if (!complete) {
    return (
      <div role="status" className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand/30 bg-brand-soft/60 px-5 py-4">
        <div className="text-base text-ink">
          <p className="font-semibold">Complete your investor profile</p>
          <p className="mt-0.5">Browse startups freely. To connect with founders, shortlist and get matched, add your profile and our team will verify it.</p>
        </div>
        <button type="button" onClick={onComplete} className="rounded-xl bg-brand px-5 py-2.5 text-base font-semibold text-white hover:bg-brand-dark">Complete profile</button>
      </div>
    )
  }
  if (!verification || verification.status === 'verified') return null
  const c = COPY[verification.status]
  const Icon = c.icon ?? ShieldCheck
  return (
    <div role="status" className={`mb-8 flex items-start gap-4 rounded-xl border px-5 py-4 ${c.tone}`}>
      <Icon size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="text-base">
        <p className="font-semibold">{c.title}</p>
        <p className="mt-0.5">{c.text}</p>
        {verification.note && <p className="mt-2 rounded-lg bg-white/70 px-3 py-2">&ldquo;{verification.note}&rdquo;</p>}
        <Link to="/investor/settings?tab=verification" className="mt-2 inline-block font-semibold underline underline-offset-2">
          {verification.status === 'pending' ? 'View status and documents' : 'Update and resubmit'}
        </Link>
      </div>
    </div>
  )
}
