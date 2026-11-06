import { Navigate, Route, Routes } from 'react-router-dom'
import AuthLayout from './layouts/AuthLayout.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import Login from './pages/auth/Login.jsx'
import Signup from './pages/auth/Signup.jsx'
import StartupOnboarding from './pages/onboarding/StartupOnboarding.jsx'
import IncubatorOnboarding from './pages/onboarding/IncubatorOnboarding.jsx'
import MentorOnboarding from './pages/onboarding/MentorOnboarding.jsx'
import StartupHome from './pages/startup/StartupHome.jsx'
import Profile from './pages/startup/Profile.jsx'
import Incubation from './pages/startup/Incubation.jsx'
import Tools from './pages/startup/Tools.jsx'
import Mentoring from './pages/startup/Mentoring.jsx'
import Videos, { VideoDetail } from './pages/startup/Videos.jsx'
import Investors from './pages/startup/Investors.jsx'
import Grants from './pages/startup/Grants.jsx'
import Events from './pages/startup/Events.jsx'
import IncubatorHome from './pages/incubator/IncubatorHome.jsx'
import Cohorts, { CohortDetail } from './pages/incubator/Cohorts.jsx'
import Startups, { StartupDetail } from './pages/incubator/Startups.jsx'
import Funding from './pages/incubator/Funding.jsx'
import Achievements from './pages/incubator/Achievements.jsx'
import Campaigns from './pages/incubator/Campaigns.jsx'
import IncubatorEvents from './pages/incubator/IncubatorEvents.jsx'
import Reports from './pages/incubator/Reports.jsx'
import Team from './pages/incubator/Team.jsx'
import MentorHome from './pages/mentor/MentorHome.jsx'
import MentorSessions from './pages/mentor/MentorSessions.jsx'
import MentorVideos from './pages/mentor/MentorVideos.jsx'
import MentorEvents from './pages/mentor/MentorEvents.jsx'
import MentorProfile from './pages/mentor/MentorProfile.jsx'
import { INCUBATOR_NAV, MENTOR_NAV, STARTUP_NAV } from './constants/nav.js'
import RequireAuth, { GuestOnly } from './components/RequireAuth.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<GuestOnly><AuthLayout /></GuestOnly>}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Route>
      <Route path="/onboarding/startup" element={<RequireAuth role="startup" onboarding><StartupOnboarding /></RequireAuth>} />
      <Route path="/onboarding/incubator" element={<RequireAuth role="incubator" onboarding><IncubatorOnboarding /></RequireAuth>} />
      <Route path="/onboarding/mentor" element={<RequireAuth role="mentor" onboarding><MentorOnboarding /></RequireAuth>} />

      <Route path="/startup" element={<RequireAuth role="startup"><DashboardLayout nav={STARTUP_NAV} roleLabel="Startup" orgUrl="/startups/me" /></RequireAuth>}>
        <Route index element={<StartupHome />} />
        <Route path="incubation" element={<Incubation />} />
        <Route path="tools" element={<Tools />} />
        <Route path="mentoring" element={<Mentoring />} />
        <Route path="videos" element={<Videos />} />
        <Route path="videos/:id" element={<VideoDetail />} />
        <Route path="investors" element={<Investors />} />
        <Route path="grants" element={<Grants />} />
        <Route path="events" element={<Events />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/startup" replace />} />
      </Route>

      <Route path="/incubator" element={<RequireAuth role="incubator"><DashboardLayout nav={INCUBATOR_NAV} roleLabel="Incubator" orgUrl="/incubators/me" /></RequireAuth>}>
        <Route index element={<IncubatorHome />} />
        <Route path="cohorts" element={<Cohorts />} />
        <Route path="cohorts/:id" element={<CohortDetail />} />
        <Route path="startups" element={<Startups />} />
        <Route path="startups/:id" element={<StartupDetail />} />
        <Route path="funding" element={<Funding />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="events" element={<IncubatorEvents />} />
        <Route path="reports" element={<Reports />} />
        <Route path="team" element={<Team />} />
        <Route path="*" element={<Navigate to="/incubator" replace />} />
      </Route>

      <Route path="/mentor" element={<RequireAuth role="mentor"><DashboardLayout nav={MENTOR_NAV} roleLabel="Mentor" /></RequireAuth>}>
        <Route index element={<MentorHome />} />
        <Route path="sessions" element={<MentorSessions />} />
        <Route path="videos" element={<MentorVideos />} />
        <Route path="events" element={<MentorEvents />} />
        <Route path="profile" element={<MentorProfile />} />
        <Route path="*" element={<Navigate to="/mentor" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
