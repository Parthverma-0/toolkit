# ToolKit frontend plan

We build one item at a time. For each item: you describe the feel and how it
should work, I build it, you review it, and we only move on after you approve.

Status: `Approved` (you signed off) · `Draft` (built, not reviewed or approved yet) · `Todo`

Rules that apply everywhere:
- Blue theme from the login screen (tokens in `src/index.css`).
- Text-led UI with no decorative icons. Icons only where they do something (Google logo, menu, close).
- All pages call the real API (mocks removed in phase 6).

---

## Phase 0 - Auth

| # | Page / component | Route | Status |
|---|---|---|---|
| 0.1 | Login screen (AuthCard, RoleSelector, GoogleButton, AuthLayout) | `/login` | Approved |
| 0.2 | Demo login button (skips Google, walks the full flow: onboarding with sample data -> dashboard) | `/login` | Draft |
| 0.3 | Signup screen | `/signup` | Draft |

## Phase 1 - Startup onboarding

| # | Page / component | Route | Status |
|---|---|---|---|
| 1.1 | Onboarding page frame (header, side step list) | `/onboarding/startup` | Approved |
| 1.2 | Step 1: startup details (logo upload, CIN, DPIIT, sector, stage) | | Approved |
| 1.3 | Step 2: founder and contact (email and phone OTP fields) | | Approved |
| 1.4 | Step 3: review and submit, success screen | | Approved |

## Phase 2 - Shared dashboard pieces

| # | Component | Status |
|---|---|---|
| 2.1 | Dashboard shell: sidebar, mobile menu, account box (`DashboardLayout`) | Draft |
| 2.2 | Section card, stat, badge, progress bar, empty state (`dashboard/Card`) | Draft |
| 2.3 | Page header (title, subtitle, primary action) | Draft |
| 2.4 | Table / list with filters and empty state | Draft |
| 2.5 | Tabs | Draft |
| 2.6 | Modal / side drawer for forms | Draft |
| 2.7 | Toast notifications | Draft |
| 2.8 | Status pill colours (application, session, grant, investor statuses) | Draft |

## Phase 3 - Startup dashboard

| # | Page | Route | Main components | Status |
|---|---|---|---|---|
| 3.1 | Home | `/startup` | header, incubation card, next session, grants / investors / events stats, tools strip, latest videos | Draft |
| 3.2 | Profile | `/startup/profile` | startup details form, founders list, add / edit co-founder | Draft |
| 3.3 | Incubation | `/startup/incubation` | browse cohorts, apply, my applications (withdraw), enrollment: milestones, marketing checklist, agreement | Draft |
| 3.4 | Metrics and achievements | `/startup/incubation` (tab) | monthly metrics form and chart, achievements list | Draft |
| 3.5 | Mentoring | `/startup/mentoring` | mentor directory, mentor profile, request session, my sessions, feedback | Draft |
| 3.6 | Videos | `/startup/videos` | video grid with category filter, video player page, like | Draft |
| 3.7 | Investors | `/startup/investors` | investor directory, connect, my connections pipeline | Draft |
| 3.8 | Grants | `/startup/grants` | grants list (empty for now), my applications | Draft |
| 3.9 | Events | `/startup/events` | events list, event page, register / cancel, my registrations | Draft |
| 3.10 | Tools | `/startup/tools` | tools catalog (all "coming soon"; no tool content yet) | Draft |

## Phase 4 - Incubator dashboard

| # | Page | Route | Main components | Status |
|---|---|---|---|---|
| 4.1 | Onboarding (head registers the incubator) | `/onboarding/incubator` | incubator details form | Draft |
| 4.2 | Home | `/incubator` | key stats, funnel chart, revenue chart, recent activity | Draft |
| 4.3 | Cohorts | `/incubator/cohorts` | cohort list, create / edit cohort, open / close status | Draft |
| 4.4 | Applications | `/incubator/cohorts/:id/applications` | application list, review drawer (accept / reject) | Draft |
| 4.5 | Enrolled startups | `/incubator/startups` | startup table, startup detail: milestones, checklist, agreement, metrics, exit | Draft |
| 4.6 | Funding | `/incubator/funding` | funding transactions table, add / edit | Draft |
| 4.7 | Achievements | `/incubator/achievements` | list, verify self-reported achievements | Draft |
| 4.8 | Campaigns | `/incubator/campaigns` | campaign list, compose, recipients, send | Draft |
| 4.9 | Events | `/incubator/events` | my events, create / edit, registrations | Draft |
| 4.10 | Team | `/incubator/team` | head + up to 4 members, invite / remove | Draft |
| 4.11 | Reports and compliance | `/incubator/reports` | reports + compliance docs (mock; downloads need backend step 9) | Draft |

## Phase 5 - Mentor dashboard

| # | Page | Route | Main components | Status |
|---|---|---|---|---|
| 5.1 | Onboarding / profile | `/onboarding/mentor` | expertise, bio, availability | Draft |
| 5.2 | Home | `/mentor` | upcoming sessions, pending requests, video stats | Draft |
| 5.3 | Sessions | `/mentor/sessions` | requests (confirm / reject), upcoming, complete, feedback | Draft |
| 5.4 | Videos | `/mentor/videos` | my videos, upload / edit, publish | Draft |
| 5.5 | Events | `/mentor/events` | events I host or attend | Draft |

## Phase 6 - Connect to the backend (only when you say so)

| # | Item | Status |
|---|---|---|
| 6.1 | API client (axios, token refresh) and auth context | Done (needs end-to-end test) |
| 6.2 | Real Google sign-in, plus the backend login-vs-signup change | Done (needs end-to-end test) |
| 6.3 | Route guards per role and onboarding completeness | Done (needs end-to-end test) |
| 6.4 | Swap mocks for API calls, page by page | Done (needs end-to-end test) |

---

## Notes per item

Add your direction for each item here before I build it (feel, layout, behaviour).

- 0.2 Demo login:
- 0.3 Signup:
