// Catalog for the dashboard "Tools" section. Tools are placeholders for now:
// flip `status` to 'available' as each one is implemented.
module.exports = [
  { type: 'pitch_deck_review', name: 'Pitch Deck Review', description: 'Get feedback on your pitch deck structure, story and numbers.' },
  { type: 'marketing_plan', name: 'Marketing Plan', description: 'Build a channel-wise marketing plan with budget and timelines.' },
  { type: 'competitor_analysis', name: 'Competitor Analysis', description: 'Map competitors, their positioning and your differentiation.' },
  { type: 'idea_validation', name: 'Idea Validation', description: 'Stress-test your idea against problem, market and willingness to pay.' },
  { type: 'market_research', name: 'Market Research', description: 'Size your market (TAM / SAM / SOM) and understand customer segments.' },
  { type: 'gtm_strategy', name: 'GTM Strategy', description: 'Plan your go-to-market: ICP, pricing, channels and launch.' },
  { type: 'swot_analysis', name: 'SWOT Analysis', description: 'Lay out strengths, weaknesses, opportunities and threats.' },
  { type: 'financial_projections', name: 'Financial Projections', description: 'Project revenue, costs, burn and runway for the next 3-5 years.' },
].map((tool) => ({ ...tool, status: 'coming_soon' }));
