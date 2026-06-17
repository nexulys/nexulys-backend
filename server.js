require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/comptabilite', require('./routes/comptabilite'));
app.use('/api/rh', require('./routes/rh'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/taches', require('./routes/taches'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/abonnement', require('./routes/abonnement'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Novexa API is running',
    version: process.env.APP_VERSION || '1.0.0',
    platform: 'Novexa by Nexulys'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Novexa backend running on port ${PORT}`);
});

module.exports = app;
