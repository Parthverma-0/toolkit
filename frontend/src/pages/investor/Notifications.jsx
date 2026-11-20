import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/dashboard/Card.jsx'
import { Button, PageHeader, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import NotificationList from '../../components/network/NotificationList.jsx'
import useApi from '../../hooks/useApi.js'
import { errorMessage, get, post } from '../../api/client.js'

export default function Notifications() {
  const state = useApi(() => get('/network/notifications', { limit: 60 }))
  const navigate = useNavigate()
  const toast = useToast()

  const markAll = async () => {
    try {
      await post('/network/notifications/read', {})
      state.reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }
  const open = async (n) => {
    if (!n.readAt) await post('/network/notifications/read', { ids: [n._id] }).catch(() => {})
    if (n.link) navigate(n.link)
  }

  return (
    <div>
      <PageHeader
        title="Notifications" subtitle="Connection requests, new messages, verification updates and platform announcements."
        action={state.data?.unread > 0 && <Button variant="secondary" onClick={markAll}>Mark all as read</Button>}
      />
      <Async state={state}>{({ data }) => <Card><NotificationList items={data} onOpen={open} /></Card>}</Async>
    </div>
  )
}
