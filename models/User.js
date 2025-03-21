const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: String,
  dob: Date,
  address: String,
  phone: String,
  state: String,
  zip: String,
  email: { type: String, required: true, unique: true },
  gender: String,
  userType: String
});

module.exports = mongoose.model('User', userSchema);