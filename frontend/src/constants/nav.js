import {
  Award, CalendarDays, FileText, GraduationCap, Sprout, House, Layers, LayoutGrid, Mail,
  MessagesSquare, Rocket, SquarePlay, User, Users, UsersRound, Wallet,
} from 'lucide-react'

// Sidebar navigation per role. Paths are relative to the role's dashboard root.
export const STARTUP_NAV = [
  { to: '/startup', label: 'Home', icon: House, end: true },
  { to: '/startup/incubation', label: 'Incubation', icon: Layers },
  { to: '/startup/tools', label: 'Tools', icon: LayoutGrid },
  { to: '/startup/mentoring', label: 'Mentoring', icon: GraduationCap },
  { to: '/startup/videos', label: 'Videos', icon: SquarePlay },
  { to: '/startup/investors', label: 'Investors', icon: Users },
  { to: '/startup/grants', label: 'Grants', icon: Sprout },
  { to: '/startup/events', label: 'Events', icon: CalendarDays },
  { to: '/startup/profile', label: 'Profile', icon: User },
]

export const INCUBATOR_NAV = [
  { to: '/incubator', label: 'Home', icon: House, end: true },
  { to: '/incubator/cohorts', label: 'Cohorts', icon: Layers },
  { to: '/incubator/startups', label: 'Startups', icon: Rocket },
  { to: '/incubator/funding', label: 'Funding', icon: Wallet },
  { to: '/incubator/achievements', label: 'Achievements', icon: Award },
  { to: '/incubator/campaigns', label: 'Campaigns', icon: Mail },
  { to: '/incubator/events', label: 'Events', icon: CalendarDays },
  { to: '/incubator/reports', label: 'Reports', icon: FileText },
  { to: '/incubator/team', label: 'Team', icon: UsersRound },
]

export const MENTOR_NAV = [
  { to: '/mentor', label: 'Home', icon: House, end: true },
  { to: '/mentor/sessions', label: 'Sessions', icon: MessagesSquare },
  { to: '/mentor/videos', label: 'Videos', icon: SquarePlay },
  { to: '/mentor/events', label: 'Events', icon: CalendarDays },
  { to: '/mentor/profile', label: 'Profile', icon: User },
]
