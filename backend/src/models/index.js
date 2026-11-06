// Central export so controllers can do: const { Startup, Cohort } = require('../models');

module.exports = {
  // Auth
  User: require('./User'),
  Otp: require('./Otp'),

  // Mentor
  MentorProfile: require('./MentorProfile'),
  Video: require('./Video'),
  MentoringSession: require('./MentoringSession'),

  // Startup
  Startup: require('./Startup'),
  Founder: require('./Founder'),
  StartupMetric: require('./StartupMetric'),
  ToolSubmission: require('./ToolSubmission'),
  Achievement: require('./Achievement'),
  Investor: require('./Investor'),
  InvestorConnection: require('./InvestorConnection'),
  Grant: require('./Grant'),
  GrantApplication: require('./GrantApplication'),
  Event: require('./Event'),
  EventRegistration: require('./EventRegistration'),

  // Incubator
  Incubator: require('./Incubator'),
  Program: require('./Program'),
  Cohort: require('./Cohort'),
  CohortApplication: require('./CohortApplication'),
  Enrollment: require('./Enrollment'),
  EmailCampaign: require('./EmailCampaign'),
  FunnelEvent: require('./FunnelEvent'),
  FundingTransaction: require('./FundingTransaction'),
  Report: require('./Report'),
  FinancialRecord: require('./FinancialRecord'),
  ComplianceDocument: require('./ComplianceDocument'),
};
