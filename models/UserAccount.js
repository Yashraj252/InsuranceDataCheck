const mongoose = require('mongoose');
const userAccountSchema = new mongoose.Schema({
  account_name: { type: String, required: true, unique: true }
});
module.exports = mongoose.model('UserAccount', userAccountSchema);