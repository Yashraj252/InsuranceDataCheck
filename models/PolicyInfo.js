const mongoose = require('mongoose');
const policyInfoSchema = new mongoose.Schema({
  policy_number: String,
  policy_start_date: Date,
  policy_end_date: Date,
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAccount' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'PolicyCategory' },
  carrier: { type: mongoose.Schema.Types.ObjectId, ref: 'PolicyCarrier' },
  policy_mode: String,
  premium_amount_written: Number,
  premium_amount: Number,
  policy_type: String,
  csr: String,
  hasActive_ClientPolicy: Boolean
});
module.exports = mongoose.model('PolicyInfo', policyInfoSchema);