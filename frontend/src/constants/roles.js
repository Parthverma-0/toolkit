// Mirrors the backend ROLES. `signupHint` / `loginHint` are shown under the role picker.
export const ROLES = [
  {
    id: 'startup',
    label: 'Startup',
    description: 'Build, validate and grow with tools, mentors and funding.',
  },
  {
    id: 'incubator',
    label: 'Incubator',
    description: 'Run cohorts, track startups and generate reports.',
    signupHint: 'You will register as the incubator head. Your team members are invited from the dashboard.',
    loginHint: 'Team member? Sign in with the email your incubator head invited.',
  },
  {
    id: 'mentor',
    label: 'Mentor',
    description: 'Share your expertise through videos and 1:1 sessions.',
  },
  {
    id: 'investor',
    label: 'Investor',
    description: 'Discover startups that match your thesis and connect with founders.',
    signupHint: 'You go straight to your dashboard. Your investor profile is asked for when you first connect with a founder, and our team verifies it.',
  },
]

export const DEFAULT_ROLE = 'startup'

export const isRole = (value) => ROLES.some((r) => r.id === value)
