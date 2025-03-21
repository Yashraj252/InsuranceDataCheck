const mongoose = require('mongoose');
const policyCarrierSchema = new mongoose.Schema({
  company_name: { type: String, required: true, unique: true }
});
module.exports = mongoose.model('PolicyCarrier', policyCarrierSchema);