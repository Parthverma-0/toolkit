// Enums mirrored from backend/src/utils/constants.js and validators
export const INCUBATOR_TYPES = ['academic', 'government', 'corporate', 'private', 'ngo', 'other']
export const ACCESSIBILITY_TYPES = ['lab', 'ip_support', 'coworking', 'prototyping', 'testing', 'legal', 'cloud_credits', 'library', 'other']
export const FUNDING_TYPES = ['ic_fund_raised', 'ic_fund_distributed', 'external_funding']
export const FUNDING_INSTRUMENTS = ['grant', 'equity', 'debt', 'convertible_note', 'safe', 'seed_fund', 'csr', 'other']
export const ROUNDS = ['pre_seed', 'seed', 'series_a', 'series_b', 'series_c_plus', 'bridge', 'na']
export const REPORT_TYPES = ['project_completion', 'project_application', 'year_end', 'cohort_end', 'activity_report', 'internal_compliance']
export const COMPLIANCE_DOC_TYPES = ['financial_record', 'internal_financial', 'utilization_certificate', 'expenditure_report']
export const COHORT_STATUSES = ['draft', 'registration_open', 'ongoing', 'completed', 'cancelled']
export const EVENT_TYPES = ['workshop', 'webinar', 'demo_day', 'hackathon', 'networking', 'bootcamp', 'pitch_event', 'other']
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const VIDEO_CATEGORIES = [
  'fundraising', 'gtm', 'marketing', 'product', 'finance', 'legal_compliance',
  'team_building', 'sales', 'pitching', 'operations', 'other',
]
export const INVESTOR_TYPES = ['angel', 'angel_network', 'vc', 'micro_vc', 'corporate_vc', 'family_office', 'government', 'other']

export const ACHIEVEMENT_TYPES = ['award', 'patent', 'trademark', 'funding', 'product_launch', 'revenue_milestone', 'media', 'partnership', 'other']
