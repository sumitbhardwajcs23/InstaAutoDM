# Airvix Testing & Quality Assurance Strategy

> **Document Version**: 2.0  
> **Target System**: Airvix Multi-Tenant Instagram Automation Engine  
> **Quality Gate Policy**: 100% test pass rate required prior to production deployment

---

## 1. Quality Assurance Philosophy

Airvix operates in high-volume, real-time message automation where regressions can lead to Meta API suspensions, data leaks, or billing discrepancies. Quality assurance is organized into eight distinct testing pillars:

```
                      ┌────────────────────────┐
                      │    1. Unit Tests       │  (Pure functions & transforms)
                      ├────────────────────────┤
                      │  2. Integration Tests  │  (Route -> Service -> DB)
                      ├────────────────────────┤
                      │     3. E2E Tests       │  (Full workflow simulations)
                      ├────────────────────────┤
                      │   4. Security Tests    │  (RBAC, IDOR, CSP, Injection)
                      ├────────────────────────┤
                      │    5. Webhook Tests    │  (HMAC, Idempotency, DLQ)
                      ├────────────────────────┤
                      │ 6. Failure/Retry Tests │  (429 Backoff, Transient Jitter)
                      ├────────────────────────┤
                      │    7. Load Tests       │  (Concurrency, Throughput, k6)
                      ├────────────────────────┤
                      │  8. Regression Suite   │  (CI Gate before merge)
                      └────────────────────────┘
```

---

## 2. Test Category Specifications

### 2.1 Unit Tests
- **Objective**: Validate deterministic input/output transformations without external dependencies.
- **Coverage Areas**:
  - Cryptographic operations: AES-256-GCM encryption, decryption, authentication tag validation (`tests/crypto.test.js`).
  - Plan limit computations: Tier-based quotas, grace periods, usage overflows (`tests/planLimits.test.js`).
  - Pacing delay & backoff: Exponential growth formula, randomized jitter boundaries (`tests/queueBackoff.test.js`).
  - Input sanitization: Stripping `<script>`, event handlers, and javascript pseudo-protocols (`tests/securityHeaders.test.js`).

### 2.2 Integration Tests
- **Objective**: Test service-to-database contracts against real PostgreSQL instances (Neon Serverless).
- **Coverage Areas**:
  - Schema migrations & rollbacks: Forward `up()` and reversible `down()` execution with SHA-256 checksums (`tests/migrator.test.js`).
  - Encrypted database backup & restore: AES-256-GCM dump generation, header metadata, key derivation, and restoration (`tests/backupRecovery.test.js`).
  - Multi-tenant isolation: Tenant boundaries, foreign key integrity, cross-tenant leak prevention (`tests/multiTenantSecurity.test.js`).

### 2.3 End-to-End (E2E) Tests
- **Objective**: Simulate end-user interactions from UI or API endpoint to downstream dispatch.
- **Coverage Areas**:
  - Simulated comment and DM events via simulator routes (`backend/src/routes/simulator.js`).
  - Rule creation, keyword evaluation, and automated reply generation.
  - Interactive Follow-to-Unlock flow: Non-follower detection, prompt generation, quick-reply verification.

### 2.4 Security & Compliance Tests
- **Objective**: Identify vulnerabilities, authentication bypasses, privilege escalations, and compliance violations.
- **Coverage Areas**:
  - Admin RBAC & MFA: TOTP verification, backup code exhaustion, session revocation (`tests/adminSecurity.test.js`).
  - Frontend Security Headers: CSP directives, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, and 415 media type rejection (`tests/securityHeaders.test.js`).
  - Emergency Kill Switches & Abuse Prevention: Global, account, and rule kill switches, velocity thresholds (`tests/abuseDetection.test.js`).
  - GDPR Portability & Erasure: JSON export structure, token redaction, cascading account erasure (`tests/dataRetention.test.js`).

### 2.5 Webhook Reliability Tests
- **Objective**: Guarantee zero data loss and replay protection under webhook volume.
- **Coverage Areas**:
  - HMAC-SHA256 signature verification (`X-Hub-Signature-256`).
  - Duplicate event rejection via idempotency keys (`tests/webhookReliability.test.js`).
  - Dead-letter queue escalation after attempt limits are reached.

### 2.6 Failure & Resilience Tests
- **Objective**: Ensure self-healing capabilities when external dependencies fail.
- **Coverage Areas**:
  - Meta API 429 Rate Limit response handling with `Retry-After` header parsing.
  - Network disconnects and transient 5xx responses with exponential backoff.
  - Graceful worker shutdown without dropping in-flight jobs.

### 2.7 Load & Capacity Tests
- **Objective**: Measure throughput, queue depth, and latency percentiles under peak burst traffic.
- **Tool**: k6 / Autocannon.
- **Scenarios**:
  - Webhook ingestion flood: 300 requests/sec burst to test signature verification throughput.
  - Concurrency saturation: 50 concurrent accounts dispatching simultaneously to verify fair-share allocation.
  - Note: Run exclusively against dedicated staging environments to protect production quotas.

### 2.8 Regression Testing & CI Gates
- **Objective**: Ensure that new features or refactorings do not break established functionality.
- **Enforcement**:
  - Every pull request runs the full automated test suite via GitHub Actions (`.github/workflows/ci.yml`).
  - Build failure if any test fails, lint errors are detected, or secret leaks are found (Gitleaks).

---

## 3. Test Execution Matrix

| Test Suite File | Type | Target System Component | Run Command |
|---|---|---|---|
| `tests/securityHeaders.test.js` | Security / Unit | CSP, Headers, CORS, Sanitization | `node tests/securityHeaders.test.js` |
| `tests/abuseDetection.test.js` | Security / Integration | Kill Switches, Velocity, Cost Tracking | `node tests/abuseDetection.test.js` |
| `tests/dataRetention.test.js` | Compliance / Integration | TTL Pruning, GDPR Export & Erasure | `node tests/dataRetention.test.js` |
| `tests/migrator.test.js` | Integration | Versioned Database Migrations | `node tests/migrator.test.js` |
| `tests/backupRecovery.test.js` | Integration / Security | AES-256-GCM Encrypted Backup & Restore | `node tests/backupRecovery.test.js` |
| `tests/adminSecurity.test.js` | Security | 2FA, RBAC, Sessions, Audit Logs | `node tests/adminSecurity.test.js` |
| `tests/observability.test.js` | Observability | Health Probes, Metrics, Alerts | `node tests/observability.test.js` |
| `tests/billingAndSubscription.test.js` | SaaS Billing | Subscription Status, Invoicing | `node tests/billingAndSubscription.test.js` |
| `tests/webhookReliability.test.js` | Webhook / Reliability | Idempotency, DLQ, Deduplication | `node tests/webhookReliability.test.js` |
| `tests/multiTenantSecurity.test.js` | Security / Multi-Tenant | Tenant Boundary Isolation | `node tests/multiTenantSecurity.test.js` |
