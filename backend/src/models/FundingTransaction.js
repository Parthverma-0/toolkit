const mongoose = require('mongoose');
const { FUNDING_TYPES, FUNDING_INSTRUMENTS } = require('../utils/constants');

// Powers the incubator dashboard funding cards:
//  - ic_fund_raised       : money the IC received (govt scheme, CSR, sponsor)
//  - ic_fund_distributed  : money the IC gave to a startup
//  - external_funding     : money a startup raised from outside the IC
const fundingTransactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: FUNDING_TYPES, required: true },
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator', required: true },
    startup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Startup',
      required: [function needsStartup() { return this.type !== 'ic_fund_raised'; }, 'startup is required for distributed / external funding'],
    },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
    grant: { type: mongoose.Schema.Types.ObjectId, ref: 'Grant' },
    investor: { type: mongoose.Schema.Types.ObjectId, ref: 'Investor' },

    source: { type: String, trim: true }, // funder name when not an Investor/Grant doc
    instrument: { type: String, enum: FUNDING_INSTRUMENTS, required: true },
    round: { type: String, enum: ['pre_seed', 'seed', 'series_a', 'series_b', 'series_c_plus', 'bridge', 'na'], default: 'na' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    date: { type: Date, required: true },
    referenceNo: String,
    documents: [{ name: String, url: String }],
    notes: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

fundingTransactionSchema.index({ incubator: 1, type: 1, date: -1 });
fundingTransactionSchema.index({ startup: 1, type: 1 });

module.exports = mongoose.model('FundingTransaction', fundingTransactionSchema);
