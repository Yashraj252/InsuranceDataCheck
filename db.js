const mongoose = require('mongoose');
require('./models/User');
require('./models/Agent');
require('./models/UserAccount');
require('./models/PolicyCategory');
require('./models/PolicyCarrier');
require('./models/PolicyInfo');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;