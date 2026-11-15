// Sample Marketing Plan report. Claude is used as an example startup; every number, target and
// competitor detail here is illustrative, not real data. This is the JSON shape the AI returns.
export const marketingClaude = {
  tool: 'Marketing Plan',
  title: 'Marketing Plan',
  subtitle: 'A twelve-month plan to grow active usage and paid adoption, led by developers and extended to business teams.',
  sample: true,
  generatedAt: '2026-11-14',
  startup: { name: 'Claude', sector: 'Artificial intelligence / SaaS', stage: 'Growth' },
  sections: [
    {
      title: 'Executive Summary',
      blocks: [
        { type: 'text', paragraphs: [
          'Claude is an AI assistant used for writing, analysis and software development, offered to individuals through a subscription and to businesses through team plans and an API. The product is well regarded for careful reasoning, handling of long documents and reliability in professional work. Awareness, however, remains concentrated among early adopters, and a large share of new users leave before completing a meaningful task.',
          'This plan proposes a developer-led growth strategy. Developers are the segment most likely to adopt Claude quickly, to use it daily, and to introduce it inside their organisations. The plan concentrates spending on community, educational content and product onboarding rather than broad paid advertising, and it treats the conversion of new sign-ups into active users as the most important problem to solve in the first quarter.',
          'Over twelve months the plan targets growth in weekly active users from 0.42 million to 1.0 million, an improvement in activation from 38 percent to 50 percent, and revenue of INR 310 crore in India from paid individual and team plans. The total marketing budget proposed is INR 14.4 crore.',
        ] },
        { type: 'keyvalue', title: 'Headline targets for the next twelve months', items: [
          { label: 'Weekly active users', value: '1.0 million by month 12 (from 0.42 million)' },
          { label: 'Activation rate', value: '50 percent of sign-ups complete a real task within 7 days (from 38 percent)' },
          { label: 'Paid conversion', value: '4 percent of monthly active users on a paid plan (from 2.6 percent)' },
          { label: 'Team accounts', value: '2,500 new team accounts' },
          { label: 'Marketing budget', value: 'INR 14.4 crore, of which about 90 percent is spent outside paid advertising' },
        ] },
      ],
    },
    {
      title: 'Situation Analysis',
      blocks: [
        { type: 'subheading', text: 'Current position' },
        { type: 'text', paragraphs: [
          'Claude competes in the general-purpose AI assistant market, which has grown rapidly and now includes several well-funded providers. Product quality is competitive with the market leaders, and Claude holds a strong reputation among software engineers and knowledge workers who value accuracy over novelty. Its brand is less familiar to mainstream consumers and to business buyers outside technology companies.',
          'Most new users arrive through word of mouth, developer communities and coverage of new model releases. Paid acquisition has so far played a minor role. Internal usage data shows that users who complete one substantial task in their first week, such as fixing a bug or summarising a long report, are roughly four times more likely to still be active after a month than users who do not.',
        ] },
        { type: 'subheading', text: 'Market dynamics' },
        { type: 'text', paragraphs: [
          'Three trends shape the market. First, businesses are moving from experimentation to standardising on one or two AI providers, which makes the next eighteen months decisive for enterprise share. Second, AI tools are increasingly embedded in existing workflows such as the code editor, the terminal and team chat, so distribution through integrations matters as much as the standalone product. Third, price competition is intensifying, particularly from open-weight models that customers can host themselves.',
        ] },
        { type: 'table', title: 'Summary of strengths, weaknesses, opportunities and threats', widths: [1, 3.2], columns: ['Category', 'Findings'], rows: [
          ['Strengths', 'Strong reasoning and long-document performance; high trust among developers; reputation for careful and honest answers; growing set of integrations.'],
          ['Weaknesses', 'Lower brand awareness among consumers and non-technical buyers; activation drop-off in the first week; limited case studies from large customers.'],
          ['Opportunities', 'Enterprises choosing a standard provider; demand for AI inside developer tools; university and early-career developer communities in India and South-East Asia.'],
          ['Threats', 'Price cuts from competitors; capable open-weight models; buyers treating AI models as interchangeable commodities.'],
        ] },
      ],
    },
    {
      title: 'Target Customers',
      blocks: [
        { type: 'text', paragraphs: [
          'The plan addresses three segments in a deliberate order. Developers are the entry point because they adopt tools independently and influence purchasing. Knowledge workers broaden daily usage once a team has access. Technology buyers convert that usage into team and enterprise contracts.',
        ] },
        { type: 'table', title: 'Customer segments', widths: [1.1, 1.6, 1.6, 1.4], columns: ['Segment', 'Profile', 'Main needs', 'Where to reach them'], rows: [
          ['Developers (primary)', 'Software engineers aged 22 to 40, at start-ups and technology companies', 'Correct code, fast iteration, works inside the editor and terminal', 'GitHub, developer forums, technical video, hackathons'],
          ['Knowledge workers', 'Analysts, product managers, consultants and writers', 'Reliable handling of long documents; consistent tone; accuracy', 'Professional networks, newsletters, colleague referrals'],
          ['Technology buyers', 'CTOs, engineering managers and IT leads', 'Security, data control, uptime, measurable productivity gains', 'Pilots led by their own engineers, industry events, case studies'],
        ] },
      ],
    },
    {
      title: 'Competitive Landscape',
      blocks: [
        { type: 'text', paragraphs: [
          'Claude competes with two large general-purpose assistants, a group of specialised coding assistants and open-weight models. Competitors are named generically in this sample. The comparison below focuses on how each is positioned and where Claude can differentiate, rather than on benchmark scores, which change with every release and rarely drive purchasing decisions on their own.',
        ] },
        { type: 'table', title: 'Competitor analysis', widths: [1.1, 1.5, 1.5, 1.5, 1.7], columns: ['Competitor', 'Positioning', 'Strengths', 'Weaknesses', 'Our response'], rows: [
          ['Competitor A', 'Mass-market assistant for everyone', 'Very high awareness; large consumer base; broad features', 'Less trusted for precise professional work', 'Lead with accuracy on real professional tasks'],
          ['Competitor B', 'Assistant bundled with an office suite', 'Distribution through existing enterprise contracts', 'Tied to one ecosystem; slower to adopt new capabilities', 'Emphasise openness and integration with any toolset'],
          ['Coding assistants', 'AI features inside a code editor', 'Deep editor integration; strong habit among developers', 'Narrow scope; quality depends on the underlying model', 'Partner where possible; offer Claude directly in the terminal and editor'],
          ['Open-weight models', 'Self-hosted, low cost', 'Price and data control', 'Operating cost and effort; lower quality on complex work', 'Compete on total cost of results, not price per token'],
        ] },
        { type: 'note', title: 'Implication', body: 'Claude should avoid competing on price or on feature count. Its defensible position is reliability on demanding professional work, demonstrated through real tasks and customer evidence.' },
      ],
    },
    {
      title: 'Positioning and Messaging',
      blocks: [
        { type: 'subheading', text: 'Positioning statement' },
        { type: 'text', paragraphs: [
          'For professionals and teams who need AI they can rely on for real work, Claude is the assistant that completes demanding tasks carefully and accurately. Unlike assistants built mainly to impress in demonstrations, Claude is designed to be dependable in daily professional use and to be honest when it is uncertain.',
        ] },
        { type: 'subheading', text: 'Messaging pillars' },
        { type: 'bullets', items: [
          { label: 'Does the real work', text: 'Communication leads with finished outcomes, such as a merged pull request or a summarised contract, rather than with model capabilities.' },
          { label: 'Careful by design', text: 'Claude states uncertainty and avoids invented answers. This is presented as a practical benefit, not as a safety message.' },
          { label: 'Fits existing workflows', text: 'Claude is available in the terminal, the code editor, the browser and team chat, so adoption does not require a change of habits.' },
        ] },
      ],
    },
    {
      title: 'Marketing Objectives',
      blocks: [
        { type: 'text', paragraphs: ['Each objective is specific, measurable and time-bound. Progress will be reviewed monthly.'] },
        { type: 'numbered', items: [
          'Increase weekly active users from 0.42 million to 1.0 million by the end of month 12.',
          'Raise the seven-day activation rate from 38 percent to 50 percent by the end of month 4.',
          'Grow paid conversion among monthly active users from 2.6 percent to 4 percent by the end of month 12.',
          'Acquire 2,500 new team accounts, with at least 300 in India, by the end of month 12.',
          'Publish 20 customer case studies with measurable outcomes by the end of month 9.',
        ] },
      ],
    },
    {
      title: 'Channel Strategy and Budget',
      blocks: [
        { type: 'text', paragraphs: [
          'Spending is weighted toward channels that build lasting usage. Developer community and educational content receive the largest share because they reach the primary segment at low cost and continue to generate sign-ups after the initial investment. Paid search is limited to high-intent queries and is reviewed monthly against cost per active user, not cost per sign-up.',
        ] },
        { type: 'table', title: 'Channel plan and annual budget', widths: [1.2, 2.4, 1, 1.4], columns: ['Channel', 'Activities', 'Budget (INR lakh)', 'Primary measure'], rows: [
          ['Developer community', 'Open-source starter projects, weekly live build sessions, community forum, featured builder programme', '430', 'Weekly active developers'],
          ['Educational content', 'Two in-depth tutorials per week, short task videos, documentation improvements', '360', 'Sign-ups from content'],
          ['Product onboarding', 'Task templates on first use, day-2 and day-7 guidance, team invitations', '290', 'Seven-day activation rate'],
          ['Events and hackathons', 'University hackathons in six Indian cities, developer conference presence', '220', 'Projects shipped, teams formed'],
          ['Paid search', 'High-intent keywords only, such as "AI code review"', '140', 'Cost per active user'],
          ['Total', '', '1,440', ''],
        ] },
        { type: 'bars', title: 'Budget allocation by channel (INR lakh)', items: [
          { label: 'Developer community', value: 430 },
          { label: 'Educational content', value: 360 },
          { label: 'Product onboarding', value: 290 },
          { label: 'Events and hackathons', value: 220 },
          { label: 'Paid search', value: 140 },
        ] },
      ],
    },
    {
      title: 'Sales Forecast',
      blocks: [
        { type: 'text', paragraphs: [
          'The forecast below estimates revenue from paid individual and team plans in India over the next four quarters, comparing the plan against a baseline in which current activities simply continue. The plan scenario assumes the activation and conversion targets in Section 6 are met on schedule. Enterprise contracts are excluded because their timing is too uncertain to forecast reliably at this stage.',
        ] },
        { type: 'columns', title: 'Quarterly revenue forecast, India (INR crore)', note: 'Illustrative figures. Excludes enterprise contracts.', labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [
          { name: 'With this plan', values: [42, 58, 82, 128] },
          { name: 'Baseline', values: [40, 46, 52, 58] },
        ] },
        { type: 'text', paragraphs: [
          'Under the plan, cumulative revenue for the year reaches INR 310 crore against INR 196 crore in the baseline, an increase of INR 114 crore on a marketing investment of INR 14.4 crore. Growth is weighted toward the second half of the year because community and content channels take two to three quarters to reach full effect.',
        ] },
      ],
    },
    {
      title: 'Implementation Roadmap',
      blocks: [
        { type: 'table', title: 'Twelve-month roadmap', widths: [1, 2.8, 1], columns: ['Period', 'Key activities', 'Lead team'], rows: [
          ['Months 1 to 3', 'Launch task-based onboarding; set baselines for all metrics; publish ten starter projects; begin weekly live sessions', 'Growth, Developer Relations'],
          ['Months 4 to 6', 'Run first three university hackathons; launch featured builder programme; publish first eight case studies', 'Developer Relations, Events'],
          ['Months 7 to 9', 'Release team invitation flow; begin outreach to technology buyers using case studies; expand content to regional languages', 'Product, Sales, Content'],
          ['Months 10 to 12', 'Scale the best-performing channels; reduce or stop channels below target; prepare next year\'s plan', 'Marketing leadership'],
        ] },
      ],
    },
    {
      title: 'Measurement and Key Performance Indicators',
      blocks: [
        { type: 'text', paragraphs: [
          'Weekly active users is the primary measure of success because it reflects both acquisition and retention. Supporting indicators show where in the customer journey problems occur. All indicators will be reported in a monthly dashboard reviewed by the marketing and product leads.',
        ] },
        { type: 'table', title: 'Key performance indicators', widths: [1.3, 2.2, 0.8, 0.8], columns: ['Indicator', 'Definition', 'Baseline', 'Target'], rows: [
          ['Weekly active users', 'Users who complete at least one task in a week', '0.42 M', '1.0 M'],
          ['Activation rate', 'Share of sign-ups completing a real task within seven days', '38%', '50%'],
          ['Four-week retention', 'Share of activated users still active after four weeks', '31%', '40%'],
          ['Paid conversion', 'Share of monthly active users on a paid plan', '2.6%', '4.0%'],
          ['Cost per active user', 'Paid spend divided by new active users from paid channels', 'INR 610', 'INR 450'],
        ] },
      ],
    },
    {
      title: 'Risks and Mitigation',
      blocks: [
        { type: 'table', title: 'Principal risks', widths: [1.6, 0.7, 2.4], columns: ['Risk', 'Likelihood', 'Mitigation'], rows: [
          ['A competitor reduces prices sharply', 'High', 'Do not match on price. Publish side-by-side results on real tasks and emphasise total cost of completed work.'],
          ['Community grows but paid conversion stays low', 'Medium', 'Review conversion monthly. If it remains below 3 percent by month 6, introduce a team trial that unlocks after three invitations.'],
          ['Hackathon projects are abandoned after the event', 'Medium', 'Offer winning teams three months of credits and featured placement on condition of continued development.'],
          ['Onboarding changes are delayed', 'Low', 'Begin with guidance emails, which need no product change, while templates are built.'],
        ] },
      ],
    },
    {
      title: 'Recommendations and Next Steps',
      blocks: [
        { type: 'text', paragraphs: ['The following actions should begin immediately, in the order listed.'] },
        { type: 'numbered', items: [
          { label: 'Fix activation first', text: 'Release task-based onboarding within four weeks. It is the lowest-cost lever in this plan and improves every later channel.' },
          { label: 'Publish ten starter projects', text: 'Each should complete a real job in under twenty minutes and be promoted through developer communities.' },
          { label: 'Start weekly live sessions', text: 'Hold build sessions on the community forum and video channels, and record each one for reuse as content.' },
          { label: 'Schedule the first hackathon', text: 'Hold it in Bengaluru in month 4, with API credits as prizes.' },
          { label: 'Set up the reporting dashboard', text: 'Agree definitions and baselines for every indicator in Section 10 before new spending begins.' },
        ] },
      ],
    },
    {
      title: 'Appendix: Assumptions',
      blocks: [
        { type: 'bullets', items: [
          'User and revenue figures are illustrative and do not reflect actual company data.',
          'Average revenue per paying user is assumed at INR 1,700 per month for individual plans and INR 2,400 per seat for team plans.',
          'Budget figures exclude salaries of existing marketing and developer relations staff.',
          'Competitors are described generically and do not refer to specific companies.',
        ] },
      ],
    },
  ],
}
