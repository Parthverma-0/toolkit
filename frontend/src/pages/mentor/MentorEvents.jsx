import { useState } from 'react'
import { Tabs } from '../../components/dashboard/ui.jsx'
import { EventManager } from '../incubator/IncubatorEvents.jsx'
import Events from '../startup/Events.jsx'

// Mentors can host public events and register for others' events
export default function MentorEvents() {
  const [tab, setTab] = useState('hosting')
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <div className="w-full max-w-sm">
          <Tabs tabs={[{ id: 'hosting', label: 'Hosting' }, { id: 'attending', label: 'Attending' }]} value={tab} onChange={setTab} />
        </div>
      </div>
      {tab === 'hosting'
        ? <EventManager role="mentor" subtitle="Webinars and workshops you run for founders." />
        : <Events subtitle="Events from incubators and other mentors you can join." />}
    </div>
  )
}
