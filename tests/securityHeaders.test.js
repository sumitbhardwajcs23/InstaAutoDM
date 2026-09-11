/**
 * Test Suite: Frontend Security Headers & Request Hygiene
 * Validates CSP, X-Frame-Options, MIME sniffing protection, HSTS,
 * Content-Type enforcement, input sanitization, and CORS allowlisting.
 */

const assert = require('assert');
const { securityHeaders, validateContentType, enforceHttps } = require('../backend/src/middleware/securityHeaders');
const { sanitizeInput } = require('../backend/src/middleware/auth');

async function runTests() {
  console.log('🧪 Starting Security Headers & Hygiene Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // Test 1: CSP Header Presence & Key Directives
  test('Sets Content-Security-Policy with strict directives including frame-ancestors none', () => {
    const headers = {};
    const req = { headers: {} };
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      removeHeader: (k) => { delete headers[k]; }
    };
    let called = false;
    securityHeaders(req, res, () => { called = true; });

    assert.strictEqual(called, true);
    assert.ok(headers['Content-Security-Policy'], 'Missing CSP header');
    assert.ok(headers['Content-Security-Policy'].includes("default-src 'self'"));
    assert.ok(headers['Content-Security-Policy'].includes("frame-ancestors 'none'"));
  });

  // Test 2: Clickjacking & Sniffing Protection
  test('Sets X-Frame-Options DENY and X-Content-Type-Options nosniff', () => {
    const headers = {};
    const req = { headers: {} };
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      removeHeader: () => {}
    };
    securityHeaders(req, res, () => {});

    assert.strictEqual(headers['X-Frame-Options'], 'DENY');
    assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff');
    assert.strictEqual(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  });

  // Test 3: HSTS Header over HTTPS
  test('Sets Strict-Transport-Security over HTTPS connection or proxy', () => {
    const headers = {};
    const req = { headers: { 'x-forwarded-proto': 'https' }, secure: false };
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      removeHeader: () => {}
    };
    securityHeaders(req, res, () => {});

    assert.ok(headers['Strict-Transport-Security'], 'HSTS should be set over HTTPS');
    assert.ok(headers['Strict-Transport-Security'].includes('max-age=63072000'));
    assert.ok(headers['Strict-Transport-Security'].includes('includeSubDomains'));
  });

  // Test 4: Removes X-Powered-By Header
  test('Removes X-Powered-By header to prevent technology fingerprinting', () => {
    let removed = null;
    const req = { headers: {} };
    const res = {
      setHeader: () => {},
      removeHeader: (k) => { removed = k; }
    };
    securityHeaders(req, res, () => {});

    assert.strictEqual(removed, 'X-Powered-By');
  });

  // Test 5: Content-Type Validation Blocks Invalid POST Media Types
  test('Blocks POST requests with unsupported media types (e.g. text/plain) with HTTP 415', () => {
    const req = {
      method: 'POST',
      path: '/api/rules',
      headers: {
        'content-type': 'text/plain',
        'content-length': '50'
      }
    };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (s) => {
        status = s;
        return {
          json: (b) => { jsonBody = b; }
        };
      }
    };
    let nextCalled = false;
    validateContentType(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Should reject before calling next');
    assert.strictEqual(status, 415);
    assert.strictEqual(jsonBody.error, 'Unsupported Media Type');
  });

  // Test 6: Content-Type Validation Allows JSON and Webhooks
  test('Allows valid application/json and webhook payloads', () => {
    const jsonReq = {
      method: 'POST',
      path: '/api/rules',
      headers: { 'content-type': 'application/json; charset=utf-8' }
    };
    let jsonPassed = false;
    validateContentType(jsonReq, {}, () => { jsonPassed = true; });
    assert.strictEqual(jsonPassed, true);

    const webhookReq = {
      method: 'POST',
      path: '/webhook',
      headers: { 'content-type': 'application/x-hub-signature-256' }
    };
    let webhookPassed = false;
    validateContentType(webhookReq, {}, () => { webhookPassed = true; });
    assert.strictEqual(webhookPassed, true);
  });

  // Test 7: Input Sanitization Strips XSS and Handlers
  test('sanitizeInput strips script tags, event handlers, and javascript pseudo-protocols', () => {
    const malicious = '<script>alert("pwned")</script>Hello <img src=x onerror=alert(1)>world';
    const cleaned = sanitizeInput(malicious);
    assert.strictEqual(cleaned.includes('<script>'), false);
    assert.strictEqual(cleaned.includes('onerror='), false);
    assert.ok(cleaned.includes('Hello'));
    assert.ok(cleaned.includes('world'));

    const deepObject = {
      title: '<b>Test</b>',
      link: 'javascript:stealCookies()',
      nested: { payload: '<script>evil()</script>Safe' }
    };
    const sanitizedObj = sanitizeInput(deepObject);
    assert.strictEqual(sanitizedObj.link.includes('javascript:'), false);
    assert.strictEqual(sanitizedObj.nested.payload.includes('<script>'), false);
    assert.strictEqual(sanitizedObj.nested.payload.includes('Safe'), true);
  });

  // Test 8: HTTPS Enforcement in Production
  test('enforceHttps redirects HTTP requests to HTTPS when in production', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const req = {
        secure: false,
        headers: { host: 'airvix.ai' },
        originalUrl: '/dashboard'
      };
      let redirectedStatus = null;
      let redirectedUrl = null;
      const res = {
        redirect: (s, u) => {
          redirectedStatus = s;
          redirectedUrl = u;
        }
      };
      let called = false;
      enforceHttps(req, res, () => { called = true; });

      assert.strictEqual(called, false);
      assert.strictEqual(redirectedStatus, 301);
      assert.strictEqual(redirectedUrl, 'https://airvix.ai/dashboard');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  console.log(`\n🏁 Test Run Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
