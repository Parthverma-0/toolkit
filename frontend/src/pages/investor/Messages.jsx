import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/dashboard/ui.jsx'
import Messenger from '../../components/network/Messenger.jsx'

export default function Messages() {
  const [params] = useSearchParams()
  return (
    <div>
      <PageHeader title="Messages" subtitle="Conversations with founders you are connected with." />
      <Messenger initialId={params.get('c')} />
    </div>
  )
}
