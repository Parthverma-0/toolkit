// Option lists for the investor role (registration, preferences, matching, admin filters).
// The frontend mirrors these ids in src/constants/investor.js.

const INVESTOR_TYPES = ['angel', 'angel_network', 'vc', 'pe', 'family_office', 'corporate', 'institutional', 'strategic', 'other'];

// Whether the investor invests individually or represents an organisation
const INVESTOR_CATEGORIES = ['individual', 'organisation'];

// Sectors (investors may also add custom ones, stored as plain text)
const INVESTOR_SECTORS = [
  'technology', 'saas', 'fintech', 'healthtech', 'edtech', 'agritech', 'ecommerce', 'consumer_brands', 'foodtech',
  'deeptech', 'ai', 'cybersecurity', 'manufacturing', 'cleantech', 'mobility_ev', 'real_estate', 'd2c', 'social_impact', 'other',
];

// Which startup sectors (utils/constants SECTORS) each investor sector covers
const SECTOR_TO_STARTUP = {
  technology: ['saas', 'ai_ml', 'deeptech', 'iot_hardware', 'gaming', 'media'],
  saas: ['saas'],
  fintech: ['fintech'],
  healthtech: ['healthtech'],
  edtech: ['edtech'],
  agritech: ['agritech'],
  ecommerce: ['retail_ecommerce', 'logistics'],
  consumer_brands: ['consumer', 'retail_ecommerce', 'foodtech'],
  foodtech: ['foodtech'],
  deeptech: ['deeptech', 'iot_hardware'],
  ai: ['ai_ml'],
  cybersecurity: ['saas', 'deeptech'],
  manufacturing: ['manufacturing', 'iot_hardware'],
  cleantech: ['cleantech'],
  mobility_ev: ['mobility', 'logistics'],
  real_estate: ['other'],
  d2c: ['consumer', 'retail_ecommerce'],
  social_impact: ['social_impact'],
  other: ['other'],
};

const INVESTOR_STAGES = [
  'idea', 'pre_seed', 'seed', 'pre_series_a', 'series_a', 'series_b', 'series_c_plus', 'growth', 'revenue_generating',
];

// Which startup stages (STARTUP_STAGES) each investor stage covers
const STAGE_TO_STARTUP = {
  idea: ['ideation', 'validation'],
  pre_seed: ['validation', 'mvp'],
  seed: ['mvp', 'early_traction'],
  pre_series_a: ['early_traction'],
  series_a: ['early_traction', 'scaling'],
  series_b: ['scaling'],
  series_c_plus: ['scaling', 'growth'],
  growth: ['growth'],
  revenue_generating: ['early_traction', 'scaling', 'growth'],
};

// Ticket size options in INR (null max = no upper limit). `flexible` has no range.
const LAKH = 1e5;
const CRORE = 1e7;
const TICKET_SIZES = {
  below_5l: { min: 0, max: 5 * LAKH },
  '5_25l': { min: 5 * LAKH, max: 25 * LAKH },
  '25_50l': { min: 25 * LAKH, max: 50 * LAKH },
  '50l_1cr': { min: 50 * LAKH, max: CRORE },
  '1_5cr': { min: CRORE, max: 5 * CRORE },
  '5_10cr': { min: 5 * CRORE, max: 10 * CRORE },
  '10cr_plus': { min: 10 * CRORE, max: null },
  flexible: null,
};

const GEOGRAPHIES = [
  'jaipur', 'rajasthan', 'delhi_ncr', 'mumbai', 'bengaluru', 'hyderabad', 'pune', 'chennai', 'across_india', 'international',
];

// Words in a startup's city / state that count as each geography
const GEOGRAPHY_KEYWORDS = {
  jaipur: ['jaipur'],
  rajasthan: ['rajasthan'],
  delhi_ncr: ['delhi', 'noida', 'gurgaon', 'gurugram', 'ghaziabad', 'faridabad'],
  mumbai: ['mumbai', 'navi mumbai', 'thane'],
  bengaluru: ['bengaluru', 'bangalore'],
  hyderabad: ['hyderabad', 'secunderabad'],
  pune: ['pune'],
  chennai: ['chennai'],
};

const BUSINESS_MODELS = ['b2b', 'b2c', 'b2b2c', 'd2c', 'saas', 'marketplace', 'other'];
const REVENUE_PREFERENCES = ['pre_revenue', 'early_revenue', 'revenue_generating', 'profitable'];
const INVESTMENT_APPROACHES = ['lead', 'co_investor', 'follow_on', 'strategic', 'open'];
const INVESTMENT_FREQUENCIES = ['one_two', 'three_five', 'five_ten', 'ten_plus', 'as_arise'];
const EQUITY_RANGES = ['below_5', '5_10', '10_20', '20_plus', 'flexible'];
const EXPERTISE_AREAS = ['marketing', 'technology', 'finance', 'operations', 'sales', 'product', 'legal', 'hr', 'strategy', 'other'];

const FUNDING_STATUSES = ['bootstrapped', 'raising', 'funded'];

const DOCUMENT_TYPES = ['pan', 'registration_certificate', 'portfolio', 'accreditation', 'other'];

const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'info_required'];
const VISIBILITIES = ['public', 'limited', 'private'];

const CONNECTION_STATUSES = ['pending', 'accepted', 'declined', 'withdrawn'];

const NOTIFICATION_TYPES = ['connection_request', 'connection_accepted', 'connection_declined', 'message', 'verification', 'match', 'announcement'];
// Notification preference switches an investor can turn off
const NOTIFICATION_PREFS = { connection_request: 'connections', connection_accepted: 'connections', connection_declined: 'connections', message: 'messages', match: 'matches', announcement: 'announcements' };

const REPORT_REASONS = ['spam', 'fake_profile', 'inappropriate', 'misleading', 'other'];

module.exports = {
  INVESTOR_TYPES,
  INVESTOR_CATEGORIES,
  INVESTOR_SECTORS,
  SECTOR_TO_STARTUP,
  INVESTOR_STAGES,
  STAGE_TO_STARTUP,
  TICKET_SIZES,
  GEOGRAPHIES,
  GEOGRAPHY_KEYWORDS,
  BUSINESS_MODELS,
  REVENUE_PREFERENCES,
  INVESTMENT_APPROACHES,
  INVESTMENT_FREQUENCIES,
  EQUITY_RANGES,
  EXPERTISE_AREAS,
  FUNDING_STATUSES,
  DOCUMENT_TYPES,
  VERIFICATION_STATUSES,
  VISIBILITIES,
  CONNECTION_STATUSES,
  NOTIFICATION_TYPES,
  NOTIFICATION_PREFS,
  REPORT_REASONS,
};
