const express = require('express');
const cors = require('cors');
const { config } = require('./config/env');

const healthRouter = require('./routes/health');
const analyzeRouter = require('./routes/analyze');
const debugRouter = require('./routes/debug');
const feedRouter = require('./routes/feed');

const app = express();

app.set('trust proxy', 1);
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.get('/', (req, res) => {
  res.json({ ok: true, msg: 'Frost analyzer running' });
});

app.use('/', healthRouter);
app.use('/', analyzeRouter);
app.use('/', debugRouter);
app.use('/', feedRouter);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Not found',
    path: req.originalUrl,
  });
});

app.use((err, req, res, _next) => {
  console.error('[app] Unhandled error:', err);
  res.status(500).json({
    ok: false,
    error: 'Internal server error',
    detail: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

module.exports = app;
