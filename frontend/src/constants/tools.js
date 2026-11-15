import { ChartColumnIncreasing, Database, LayoutGrid, Lightbulb, Megaphone, Presentation, Search, Goal } from 'lucide-react'

// Icons and card copy for the Tools grid. The form fields for each tool come from GET /api/tools/:type
// (backend config/tools.js), so inputs are defined in one place.
export const TOOLS = [
  { type: 'marketing_plan', icon: Megaphone, name: 'Marketing Plan', description: 'Build a channel-wise marketing plan with budget, forecast and timelines.' },
  { type: 'competitor_analysis', icon: ChartColumnIncreasing, name: 'Competitor Analysis', description: 'Map competitors, their positioning and where you can win.' },
  { type: 'idea_validation', icon: Lightbulb, name: 'Idea Validation', description: 'Stress-test your idea against problem, market and willingness to pay.' },
  { type: 'market_research', icon: Search, name: 'Market Research', description: 'Size your market (TAM, SAM, SOM) and understand customer segments.' },
  { type: 'gtm_strategy', icon: Goal, name: 'GTM Strategy', description: 'Plan your go-to-market: ideal customer, pricing, channels and launch.' },
  { type: 'swot_analysis', icon: LayoutGrid, name: 'SWOT Analysis', description: 'Lay out strengths, weaknesses, opportunities and threats, and what to do about them.' },
  { type: 'financial_projections', icon: Database, name: 'Financial Projections', description: 'Project revenue, costs, burn and runway for the next 3 to 5 years.' },
  { type: 'pitch_deck_review', icon: Presentation, name: 'Pitch Deck Review', description: 'Get detailed feedback on your pitch deck structure, story and numbers.' },
]

export const TOOL_ICONS = Object.fromEntries(TOOLS.map((t) => [t.type, t.icon]))
export const toolMeta = (type) => TOOLS.find((t) => t.type === type)
