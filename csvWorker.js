const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const Agent = require('./models/Agent');
const User = require('./models/User');
const UserAccount = require('./models/UserAccount');
const PolicyCategory = require('./models/PolicyCategory');
const PolicyCarrier = require('./models/PolicyCarrier');
const PolicyInfo = require('./models/PolicyInfo');

// Date parser for MM-DD-YYYY format
const parseDate = (dateString) => {
  if (!dateString) return null;
  const [month, day, year] = dateString.split('-');
  return new Date(`${year}-${month}-${day}`);
};

async function processChunk() {
  try {
    // Destructure worker data
    const { chunkData, mongoUri } = workerData;
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
     });

    // Process Agents
    const agents = [...new Set(chunkData.map(row => row.agent))];
    await Agent.bulkWrite(
      agents.map(agent => ({
        updateOne: {
          filter: { agent_name: agent },
          update: { $setOnInsert: { agent_name: agent } },
          upsert: true
        }
      })),
      { ordered: false }
    );
    const agentDocs = await Agent.find({ agent_name: { $in: agents } });
    const agentMap = new Map(agentDocs.map(doc => [doc.agent_name, doc._id]));

    // Process Users
    const userEmails = [...new Set(chunkData.map(row => row.email))];
    await User.bulkWrite(
      chunkData.map(row => ({
        updateOne: {
          filter: { email: row.email },
          update: {
            $setOnInsert: {
              firstname: row.firstname,
              dob: parseDate(row.dob),
              address: row.address,
              phone: row.phone,
              state: row.state,
              zip: row.zip,
              email: row.email,
              gender: row.gender,
              userType: row.userType
            }
          },
          upsert: true
        }
      })),
      { ordered: false }
    );
    const userDocs = await User.find({ email: { $in: userEmails } });
    const userMap = new Map(userDocs.map(doc => [doc.email, doc._id]));

    // Process Accounts
    const accounts = [...new Set(chunkData.map(row => row.account_name))];
    await UserAccount.bulkWrite(
      accounts.map(account => ({
        updateOne: {
          filter: { account_name: account },
          update: { $setOnInsert: { account_name: account } },
          upsert: true
        }
      })),
      { ordered: false }
    );
    const accountDocs = await UserAccount.find({ account_name: { $in: accounts } });
    const accountMap = new Map(accountDocs.map(doc => [doc.account_name, doc._id]));

    // Process Policy Categories
    const categories = [...new Set(chunkData.map(row => row.category_name))];
    await PolicyCategory.bulkWrite(
      categories.map(category => ({
        updateOne: {
          filter: { category_name: category },
          update: { $setOnInsert: { category_name: category } },
          upsert: true
        }
      })),
      { ordered: false }
    );
    const categoryDocs = await PolicyCategory.find({ category_name: { $in: categories } });
    const categoryMap = new Map(categoryDocs.map(doc => [doc.category_name, doc._id]));

    // Process Policy Carriers
    const carriers = [...new Set(chunkData.map(row => row.company_name))];
    await PolicyCarrier.bulkWrite(
      carriers.map(carrier => ({
        updateOne: {
          filter: { company_name: carrier },
          update: { $setOnInsert: { company_name: carrier } },
          upsert: true
        }
      })),
      { ordered: false }
    );
    const carrierDocs = await PolicyCarrier.find({ company_name: { $in: carriers } });
    const carrierMap = new Map(carrierDocs.map(doc => [doc.company_name, doc._id]));

    // Process Policy Info
    const policies = chunkData.map(row => ({
      policy_number: row.policy_number,
      policy_start_date: parseDate(row.policy_start_date),
      policy_end_date: parseDate(row.policy_end_date),
      agent: agentMap.get(row.agent),
      user: userMap.get(row.email),
      account: accountMap.get(row.account_name),
      category: categoryMap.get(row.category_name),
      carrier: carrierMap.get(row.company_name),
      policy_mode: row.policy_mode,
      premium_amount_written: parseFloat(row.premium_amount_written) || 0,
      premium_amount: parseFloat(row.premium_amount) || 0,
      policy_type: row.policy_type,
      csr: row.csr,
      hasActive_ClientPolicy: row.hasActive_ClientPolicy === 'true'
    }));

    await PolicyInfo.insertMany(policies, { ordered: false });
    
    // Cleanup
    await mongoose.disconnect();
    parentPort.postMessage({ success: true });
  } catch (error) {
    // Error handling
    await mongoose.disconnect().catch(() => {});
    parentPort.postMessage({ 
      error: `Worker error: ${error.message}`,
      stack: error.stack
    });
  }
}

// Start processing
processChunk();