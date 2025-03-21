require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const connectDB = require('./db');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const csv = require('fast-csv');
const os = require('os');
const schedule = require('node-schedule');
const pm2 = require('pm2');
const ScheduledMessage = require('./models/ScheduleMessage');
const User = require('./models/User');
const PolicyInfo = require('./models/PolicyInfo');
const app = express();
const upload = multer({ dest: process.env.UPLOAD_DIR });

connectDB();

// Upload API
app.post('/upload', upload.single('file'), (req, res) => {
  const chunks = [];
  let chunk = [];
  
  fs.createReadStream(req.file.path)
    .pipe(csv.parse({ headers: true }))
    .on('data', (row) => {
      chunk.push(row);
      if (chunk.length >= process.env.WORKER_CHUNK_SIZE) {
        chunks.push([...chunk]);
        chunk = [];
      }
    })
    .on('end', () => {
      if (chunk.length > 0) chunks.push(chunk);
      
      const workers = [];
      let completed = 0;
      let errors = [];

      chunks.forEach((data) => {
        const worker = new Worker(path.join(__dirname, 'csvWorker.js'), {
          workerData: {
            chunkData: data,
            mongoUri: process.env.MONGODB_URI 
          }
        });

        worker.on('message', (msg) => {
          if (msg.error) errors.push(msg.error);
          if (++completed === chunks.length) {
            fs.unlinkSync(req.file.path);
            errors.length ? res.status(500).json({ errors }) : res.sendStatus(200);
          }
        });
        
        worker.on('error', (err) => errors.push(err));
      });
    })
    .on('error', (err) => res.status(500).send(err));
});

// Search API (in app.js)
app.get('/search', async (req, res) => {
  try {
    const { username } = req.query;
    
    // Explicit model reference
    const users = await User.find({ firstname: username });
    
    const userIds = users.map(u => u._id);
    const policies = await PolicyInfo.find({ user: { $in: userIds } })
      .populate('user agent account category carrier');

    res.json(policies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aggregation API
app.get('/aggregate', async (req, res) => {
  const result = await mongoose.model('User').aggregate([
    {
      $lookup: {
        from: 'policyinfos',
        localField: '_id',
        foreignField: 'user',
        as: 'policies'
      }
    },
    { $project: { firstname: 1, email: 1, policyCount: { $size: '$policies' }, policies: 1 } }
  ]);
  res.json(result);
});

let isRestarting = false;
const PM2_APP_NAME = 'insurance-app';

function initializePm2Connection() {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) return reject(err);
      console.log('Connected to PM2 Daemon');
      resolve();
    });
  });
}
// CPU Monitoring Logic
async function startCPUMonitoring(threshold = 70) {
  await initializePm2Connection();
  
  setInterval(async () => {
    if (isRestarting) return;

    // Calculate CPU usage
    const cpus = os.cpus();
    const usage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      return acc + (total - cpu.times.idle) / total;
    }, 0) * (100 / cpus.length);

    console.log(`Current CPU: ${usage.toFixed(2)}%`);

    if (usage > threshold) {
      isRestarting = true;
      console.log(`CPU over ${threshold}% - Initiating restart...`);

      try {
        await pm2.restart(PM2_APP_NAME);
        console.log('Restart completed successfully');
      } catch (err) {
        console.error('Restart failed:', err.message);
      } finally {
        isRestarting = false;
      }
    }
  }, 10000);
}

// Start monitoring after DB connection
connectDB().then(() => {
  startCPUMonitoring();
});

// Schedule Pending Messages on Startup
async function schedulePendingMessages() {
  const pendingMessages = await ScheduledMessage.find({
    status: 'pending',
    scheduledAt: { $gt: new Date() }
  });

  pendingMessages.forEach(message => {
    schedule.scheduleJob(message.scheduledAt, async () => {
      console.log(`Inserting message: ${message.message}`);
      // Update status first to prevent duplicate processing
      message.status = 'sent';
      await message.save();
    });
  });
}

// POST Endpoint
app.post('/schedule', express.json(), async (req, res) => {
  try {
    const { message, date, time } = req.body;
    
    // Validate input
    if (!message || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create Date object from inputs
    const scheduledAt = new Date(`${date}T${time}:00`);
    if (isNaN(scheduledAt)) {
      return res.status(400).json({ error: 'Invalid date/time format' });
    }

    // Save to database
    const scheduledMessage = new ScheduledMessage({
      message,
      scheduledAt
    });
    
    await scheduledMessage.save();

    // Schedule the job
    schedule.scheduleJob(scheduledAt, async () => {
      scheduledMessage.status = 'sent';
      await scheduledMessage.save();
      console.log(`Message "${message}" inserted at ${new Date()}`);
    });

    res.status(201).json({
      id: scheduledMessage._id,
      message,
      scheduledAt,
      status: 'scheduled'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize after DB connection
connectDB().then(() => {
  schedulePendingMessages();
});// Schedule Pending Messages on Startup
async function schedulePendingMessages() {
  const pendingMessages = await ScheduledMessage.find({
    status: 'pending',
    scheduledAt: { $gt: new Date() }
  });

  pendingMessages.forEach(message => {
    schedule.scheduleJob(message.scheduledAt, async () => {
      console.log(`Inserting message: ${message.message}`);
      // Update status first to prevent duplicate processing
      message.status = 'sent';
      await message.save();
    });
  });
}

// POST Endpoint
app.post('/schedule', express.json(), async (req, res) => {
  try {
    const { message, date, time } = req.body;
    
    // Validate input
    if (!message || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create Date object from inputs
    const scheduledAt = new Date(`${date}T${time}:00`);
    if (isNaN(scheduledAt)) {
      return res.status(400).json({ error: 'Invalid date/time format' });
    }

    // Save to database
    const scheduledMessage = new ScheduledMessage({
      message,
      scheduledAt
    });
    
    await scheduledMessage.save();

    // Schedule the job
    schedule.scheduleJob(scheduledAt, async () => {
      scheduledMessage.status = 'sent';
      await scheduledMessage.save();
      console.log(`Message "${message}" inserted at ${new Date()}`);
    });

    res.json({
      id: scheduledMessage._id,
      message,
      scheduledAt,
      status: 'scheduled'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize after DB connection
connectDB().then(() => {
  schedulePendingMessages();
});

//Optional code just to make the CPU Stress and see whether it is working or not
app.get('/cpu-stress', (req, res) => {
  // Simulate CPU-intensive work
  const start = Date.now();
  while (Date.now() - start < 10000) { 
    // Block the CPU for 5 seconds
  }
  res.send('CPU stress test completed');
});

app.listen(3005, () => console.log('Server running on port 3000'));