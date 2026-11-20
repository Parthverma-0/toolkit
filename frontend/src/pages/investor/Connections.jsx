import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/dashboard/ui.jsx'
import ConnectionsPanel from '../../components/network/ConnectionsPanel.jsx'

export default function Connections() {
  const navigate = useNavigate()
  return (
    <div>
      <PageHeader title="Connections" subtitle="Requests you sent to founders, requests founders sent to you, and the conversations that followed." />
      <ConnectionsPanel
        onOpenMessages={(c) => navigate(`/investor/messages?c=${c.id}`)}
        emptyHint="Open a startup in Discover and choose Connect with Founder to send your first request."
      />
    </div>
  )
}
