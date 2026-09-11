// backend/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

// Auth routes: brute force & credential stuffing protection (15 requests per 15 minutes per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

// Webhook ingestion: volumetric flood protection (120 requests per minute per IP)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many webhook events received. Please throttle requests.'
  }
});

// General protected API endpoints (300 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'API rate limit exceeded. Please try again later.'
  }
});

module.exports = {
  authLimiter,
  webhookLimiter,
  apiLimiter
};
