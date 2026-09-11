/**
 * Security Headers Middleware
 * Implements strict Content-Security-Policy (CSP), clickjacking protection (X-Frame-Options),
 * MIME sniffing protection (X-Content-Type-Options), HSTS, Referrer-Policy,
 * Permissions-Policy, and XSS filtering.
 */

function securityHeaders(req, res, next) {
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https://graph.facebook.com https://api.instagram.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Feature / Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Cross-Site Scripting filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict-Transport-Security (HSTS) in production or if behind SSL proxy
  const isProd = process.env.NODE_ENV === 'production';
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isProd || isSecure) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // Remove fingerprinting header
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Validates request Content-Type for state-mutating requests (POST, PUT, PATCH)
 */
function validateContentType(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';
    // Allow JSON, multipart/form-data, or urlencoded. Skip for webhook routes if needed.
    if (
      req.path.startsWith('/webhook') ||
      req.path.startsWith('/api/webhooks') ||
      contentType.includes('application/json') ||
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data') ||
      req.headers['content-length'] === '0' ||
      !req.headers['content-length']
    ) {
      return next();
    }
    return res.status(415).json({
      error: 'Unsupported Media Type',
      message: 'Expected application/json or application/x-www-form-urlencoded'
    });
  }
  next();
}

/**
 * HTTPS Redirection Middleware for production
 */
function enforceHttps(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isHttps) {
      const host = req.headers.host || 'localhost';
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }
  }
  next();
}

module.exports = {
  securityHeaders,
  validateContentType,
  enforceHttps
};
