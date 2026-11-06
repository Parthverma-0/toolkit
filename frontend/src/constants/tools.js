import { ChartColumnIncreasing, Database, LayoutGrid, Lightbulb, Megaphone, Presentation, Search, Goal } from 'lucide-react'

// Mirrors backend config/tools.js. Catalog only: tools are not built yet.
export const TOOLS = [
  { type: 'pitch_deck_review', icon: Presentation, name: 'Pitch Deck Review', description: 'Get feedback on your pitch deck structure, story and numbers.' },
  { type: 'marketing_plan', icon: Megaphone, name: 'Marketing Plan', description: 'Build a channel-wise marketing plan with budget and timelines.' },
  { type: 'competitor_analysis', icon: ChartColumnIncreasing, name: 'Competitor Analysis', description: 'Map competitors, their positioning and your differentiation.' },
  { type: 'idea_validation', icon: Lightbulb, name: 'Idea Validation', description: 'Stress-test your idea against problem, market and willingness to pay.' },
  { type: 'market_research', icon: Search, name: 'Market Research', description: 'Size your market (TAM / SAM / SOM) and understand customer segments.' },
  { type: 'gtm_strategy', icon: Goal, name: 'GTM Strategy', description: 'Plan your go-to-market (GTM) with pricing, channels and launch.' },
  { type: 'swot_analysis', icon: LayoutGrid, name: 'SWOT Analysis', description: 'Lay out strengths, weaknesses, opportunities and threats.' },
  { type: 'financial_projections', icon: Database, name: 'Financial Projections', description: 'Project revenue, costs, burn and runway for the next 3–5 years.' },
].map((t) => ({ ...t, status: 'coming_soon' }))

export const TOOL_ICONS = Object.fromEntries(TOOLS.map((t) => [t.type, t.icon]))
