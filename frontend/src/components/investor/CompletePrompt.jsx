import { Card, Empty } from '../dashboard/Card.jsx'
import { Button, PageHeader } from '../dashboard/ui.jsx'

// Shown on pages that only make sense once the investor profile exists
export default function CompletePrompt({ title, onComplete }) {
  return (
    <div>
      <PageHeader title={title} subtitle="Your profile, visibility and verification live here once you have set up your investor profile." />
      <Card>
        <Empty title="Complete your investor profile first" action={<Button onClick={onComplete}>Complete profile</Button>}>
          It takes a few minutes: your details, what you invest in, and how much. You can browse startups in the meantime.
        </Empty>
      </Card>
    </div>
  )
}
