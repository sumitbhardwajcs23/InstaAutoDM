# Airvix Privacy, Data Retention & Processing Register

> **Document Version**: 2.0  
> **Effective Date**: September 2026  
> **Compliance Standards**: GDPR (Regulation EU 2016/679), CCPA/CPRA, Meta Platform Terms & Developer Policies

---

## 1. Executive Summary & Data Governance

Airvix operates an Instagram automation SaaS platform for creators, brands, and agencies. This document defines the lifecycle, legal grounds, retention periods, third-party sub-processors, and automated deletion mechanisms for all customer and end-user data.

Airvix strictly enforces the **Principle of Data Minimization** (GDPR Article 5(1)(c)): only the minimum necessary metadata required to automate interactions and maintain auditability is collected and retained.

---

## 2. Data Inventory & Retention Schedule

| Category | Specific Data Points | Purpose of Processing | Legal Basis | Retention Period | Deletion Mechanism |
|---|---|---|---|---|---|
| **Account Credentials** | Email, Name, BCrypt Password Hash, TOTP MFA Secret | User authentication, identity verification, account recovery | Contractual Necessity (Art. 6(1)(b)) | Account lifetime + 30 days post-deletion | Cascading hard delete on user erasure |
| **OAuth Credentials** | Meta Long-Lived Token, Page Access Token (AES-256-GCM encrypted) | Meta Graph API authorization to read comments and send DMs | Contractual Necessity (Art. 6(1)(b)) | Valid until token revocation, disconnect, or account deletion | Immediate token invalidation & cryptographic key shredding |
| **Automation Rules** | Rule name, triggers (keywords, comments, story mentions), response templates | Executing automated message replies according to tenant rules | Contractual Necessity (Art. 6(1)(b)) | Account lifetime | Cascading hard delete |
| **Conversation Metadata** | Instagram Scoped User ID (IGSID), conversation ID, timestamp, daily reply count | Loop detection, velocity tracking, 24-hour Meta messaging window compliance | Legitimate Interests (Art. 6(1)(f)) | 365 days rolling | Daily automated TTL pruning job |
| **Direct Messages & Comment Replies** | Inbound prompt text, outbound automated reply text, status, message ID | Delivery verification, dispute resolution, customer service | Legitimate Interests (Art. 6(1)(f)) | 365 days rolling | Daily automated TTL pruning job |
| **Webhook Audit Events** | Event ID, idempotency key, sender IGSID, recipient ID, timestamp | Deduplication, replay attack defense, audit trail | Legitimate Interests & Security (Art. 6(1)(f)) | 90 days rolling | Daily automated TTL pruning job |
| **Dead-Letter Queue (DLQ)** | Failed payload, error stack trace, retry attempts, resolution status | Resolving transient delivery failures and unblocking customers | Contractual Necessity (Art. 6(1)(b)) | 7 days post-resolution; 30 days for unresolved | Daily automated TTL pruning job |
| **Security Audit Logs** | Admin actor ID, IP address, user agent, target resource, action type | Tamper detection, forensic security auditing, compliance | Legal Obligation (Art. 6(1)(c)) & Security | 1,825 days (5 years) | Automated pruning after 5-year compliance window |
| **API Telemetry & Cost Accounting** | Tenant ID, API category (Meta Graph, AI), endpoint, cost units, status code | Usage metering, fair use monitoring, cost quota limits | Legitimate Interests (Art. 6(1)(f)) | 90 days rolling | Daily automated TTL pruning job |
| **Error Events** | Error fingerprint, route, sanitized stack trace, occurrence count | System reliability, bug triage, uptime monitoring | Legitimate Interests (Art. 6(1)(f)) | 30 days rolling | Daily automated TTL pruning job |

---

## 3. Automated Deletion & Data Minimization Pipeline

Data is purged systematically via the programmatic `DataRetentionService` (`backend/src/services/dataRetention.js`):

1. **Daily Scheduled Pruning**:
   - Executes every 24 hours at low-traffic intervals.
   - Operates in strict database transactions (`BEGIN` ... `COMMIT`) using timestamp criteria.
   - Deletes expired webhook records, resolved DLQ entries, telemetry logs, and stale error traces.

2. **Data Minimization in Transit and at Rest**:
   - **No Plaintext Tokens**: All Meta OAuth tokens are encrypted at rest with AES-256-GCM using keys derived via PBKDF2/SHA-256.
   - **No Unnecessary PII**: Only Instagram Scoped IDs (IGSIDs) are processed; Airvix never stores raw national identity, financial card details, or unneeded follower demographics.
   - **Log Sanitization**: Request bodies containing authorization tokens, passwords, or webhook secret signatures are stripped prior to structured JSON logging.

---

## 4. User Rights: Export & Erasure (GDPR Articles 17 & 20)

### 4.1 Right to Data Portability (Article 20)
Users may request an end-to-end export of their account data at any time:
- **API Endpoint**: `GET /api/user/data-export`
- **Output**: Standardized JSON containing:
  - Account profile metadata
  - Connected Instagram accounts (tokens redacted)
  - All automation rules and triggers
  - Subscription tier and invoice history
  - User-specific security audit trail

### 4.2 Right to Erasure / "Right to be Forgotten" (Article 17)
Users may permanently delete their account and associated data:
- **Self-Service**: Dashboard Settings → "Delete Account & All Data"
- **Meta Deauthorization Callback**: `POST /instagram/data-deletion` (signed webhook request from Meta)
- **Cascade Behavior**:
  - Drops all connected Instagram accounts, rules, conversation logs, and queued tasks.
  - Generates an immutable, cryptographic confirmation code (`DEL-XXXX-XXXX`) stored in `data_deletion_requests`.
  - Informs Meta and user of successful deletion within compliant SLAs (< 48 hours).

---

## 5. Third-Party Sub-Processors

| Sub-Processor | Role / Function | Data Shared | Location / Transfer Mechanism |
|---|---|---|---|
| **Meta Platforms, Inc.** | Instagram Graph API Provider | Webhook events, DM replies, comment interactions | USA (EU-US Data Privacy Framework) |
| **Neon Inc.** | Serverless PostgreSQL Database | Encrypted application data, user records, logs | AWS us-east-1 / EU (Standard Contractual Clauses) |
| **Render Services Inc.** | Backend API Hosting | Transmit runtime requests (stateless containers) | USA (Standard Contractual Clauses) |
| **Netlify, Inc.** | Frontend SPA Hosting & CDN | Static assets, cached frontend bundles | Global CDN (Standard Contractual Clauses) |
| **Razorpay / Stripe** | Payment Processing | Billing name, email, subscription status (no card data held by Airvix) | India / USA (PCI-DSS Level 1) |

---

## 6. Incident Response & Breach Notification

In accordance with GDPR Article 33:
- In the event of a confirmed personal data breach, Airvix's security team will notify relevant supervisory authorities without undue delay and, where feasible, not later than **72 hours** after becoming aware of it.
- Affected data subjects will be notified promptly if the breach is likely to result in a high risk to their rights and freedoms.
