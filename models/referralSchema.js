const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referred: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  refCodeUsed: { type: String },
  creditReferrer: { type: Number, default: 0 },
  creditReferred: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['completed','revoked'], default: 'completed' }
});

module.exports = mongoose.model('Referral', referralSchema);
