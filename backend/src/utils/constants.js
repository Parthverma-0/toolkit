// Shared enums used across models (and later validators / frontend dropdowns)

const ROLES = ['mentor', 'startup', 'incubator', 'admin'];

// Roles a person can pick on the signup screen (admins are created with scripts/createAdmin.js)
const SELF_SIGNUP_ROLES = ['mentor', 'startup', 'incubator'];

const INCUBATOR_MEMBER_ROLES = ['head', 'member'];

// One registration = 1 unit = 5 seats (onboarding / email / login passcode)
const SEATS_PER_UNIT = 5;

const SECTORS = [
  'agritech', 'ai_ml', 'cleantech', 'consumer', 'deeptech', 'edtech', 'fintech',
  'foodtech', 'gaming', 'healthtech', 'iot_hardware', 'logistics', 'manufacturing',
  'media', 'mobility', 'retail_ecommerce', 'saas', 'social_impact', 'other',
];

const STARTUP_STAGES = ['ideation', 'validation', 'mvp', 'early_traction', 'scaling', 'growth'];

const TOOL_TYPES = [
  'pitch_deck_review', 'marketing_plan', 'competitor_analysis', 'idea_validation',
  'market_research', 'gtm_strategy', 'swot_analysis', 'financial_projections',
];

const VIDEO_CATEGORIES = [
  'fundraising', 'gtm', 'marketing', 'product', 'finance', 'legal_compliance',
  'team_building', 'sales', 'pitching', 'operations', 'other',
];

const FUNDING_TYPES = ['ic_fund_raised', 'ic_fund_distributed', 'external_funding'];

const FUNDING_INSTRUMENTS = ['grant', 'equity', 'debt', 'convertible_note', 'safe', 'seed_fund', 'csr', 'other'];

const REPORT_TYPES = [
  'project_completion', 'project_application', 'year_end', 'cohort_end',
  'activity_report', 'internal_compliance',
];

const COMPLIANCE_DOC_TYPES = [
  'financial_record', 'internal_financial', 'utilization_certificate', 'expenditure_report',
];

// FinancialRecord heads (income + expense share one list)
const FINANCIAL_CATEGORIES = [
  'grant_received', 'seed_fund', 'csr', 'service_fee', 'rent', 'salaries', 'equipment',
  'events', 'travel', 'startup_support', 'admin', 'other',
];

const ACCESSIBILITY_TYPES = [
  'lab', 'ip_support', 'coworking', 'prototyping', 'testing', 'legal', 'cloud_credits', 'library', 'other',
];

const FORM_FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'phone', 'date', 'select', 'multiselect', 'checkbox', 'file', 'url'];

// IC marketing funnel: Founder -> Startup -> IC
const FUNNEL_STAGES = [
  'ic_profile_viewed', 'founder_signed_up', 'startup_profile_completed',
  'cohort_applied', 'shortlisted', 'enrolled',
];

// Where a founder came from when reaching the IC
const ACQUISITION_SOURCES = [
  'email_campaign', 'event', 'referral', 'ic_website', 'social_media', 'platform_search', 'direct', 'other',
];

// Company Identification Number, e.g. U72900KA2021PTC123456
const CIN_REGEX = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
// DPIIT recognition number, e.g. DIPP123456
const DPIIT_REGEX = /^DIPP\d{3,}$/;

module.exports = {
  CIN_REGEX,
  DPIIT_REGEX,
  FUNNEL_STAGES,
  ACQUISITION_SOURCES,
  ROLES,
  SELF_SIGNUP_ROLES,
  INCUBATOR_MEMBER_ROLES,
  SEATS_PER_UNIT,
  SECTORS,
  STARTUP_STAGES,
  TOOL_TYPES,
  VIDEO_CATEGORIES,
  FUNDING_TYPES,
  FUNDING_INSTRUMENTS,
  REPORT_TYPES,
  COMPLIANCE_DOC_TYPES,
  FINANCIAL_CATEGORIES,
  ACCESSIBILITY_TYPES,
  FORM_FIELD_TYPES,
};
