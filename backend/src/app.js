const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const apsRoutes = require('./routes/aps');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/aps', apsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
