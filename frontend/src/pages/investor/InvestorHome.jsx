import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Link2, MessagesSquare, Rocket, Send, Sparkles } from 'lucide-react'
import { Card, Empty, Stat } from '../../components/dashboard/Card.jsx'
import { PageHeader, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import StartupCard from '../../components/investor/StartupCard.jsx'
import StartupDrawer from '../../components/investor/StartupDrawer.jsx'
import VerificationBanner from '../../components/investor/VerificationBanner.jsx'
import NotificationList from '../../components/network/NotificationList.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useInvestor } from '../../components/investor/InvestorContext.jsx'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get, put } from '../../api/client.js'

export default function InvestorHome() {
  const state = useApi(() => get('/investor-portal/dashboard').then((r) => r.data))
  const { profile, complete, openProfileForm } = useInvestor()
  const { user } = useAuth()
  const toast = useToast()
  const [selected, setSelected] = useState(null)

  const toggleShortlist = async (s) => {
    try {
      if (s.shortlisted) await del(`/investor-portal/shortlist/${s.id}`)
      else await put(`/investor-portal/shortlist/${s.id}`, {})
      state.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div>
      <PageHeader title={`Welcome, ${(profile?.fullName || user.name).split(' ')[0]}`} subtitle="Your overview: new matches, requests, and where your conversations stand." />
      <VerificationBanner verification={profile?.verification} complete={complete} onComplete={() => openProfileForm('banner')} />
      <Async state={state}>{(d) => (
        <div className="grid gap-8">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <Card><Stat icon={Rocket} value={d.cards.totalStartups} label="Startups available" /></Card>
            <Card><Stat icon={Sparkles} value={d.cards.newMatching} label="New startups matching your preferences" /></Card>
            <Card><Stat icon={Bookmark} value={d.cards.shortlisted} label="Shortlisted startups" /></Card>
            <Card><Stat icon={Send} value={d.cards.requestsSent} label="Connection requests sent" /></Card>
            <Card><Stat icon={Link2} value={d.cards.requestsReceived} label="Connection requests received" /></Card>
            <Card><Stat icon={MessagesSquare} value={d.cards.activeConversations} label="Active conversations" /></Card>
          </div>

          <Card title="Recommended for you" to="/investor/discover?tab=recommended" linkLabel="See all">
            {d.recommended.length === 0 ? (
              <Empty title="No strong matches yet">
                We will recommend startups here as they join. You can <Link to="/investor/profile" className="font-semibold text-brand hover:underline">adjust your preferences</Link> to widen the search.
              </Empty>
            ) : (
              <div className="grid gap-5 lg:grid-cols-3">
                {d.recommended.map((s) => (
                  <StartupCard key={s.id} startup={s} onOpen={() => setSelected(s.id)} onConnect={() => setSelected(s.id)} onToggleShortlist={toggleShortlist} />
                ))}
              </div>
            )}
          </Card>

          <Card title="Recent notifications" to="/investor/notifications">
            <NotificationList items={d.notifications} />
          </Card>

          {d.cards.requestsReceived > 0 && (
            <p className="text-base text-ink">
              You have {d.cards.requestsReceived} connection {d.cards.requestsReceived === 1 ? 'request' : 'requests'} waiting.{' '}
              <Link to="/investor/connections" className="font-semibold text-brand hover:underline">Review them</Link>
            </p>
          )}
        </div>
      )}</Async>
      {selected && <StartupDrawer id={selected} onClose={() => setSelected(null)} onChanged={state.reload} />}
    </div>
  )
}
