# Airvix System Architecture & Security Perimeter

> **Document Version**: 3.0  
> **System Classification**: Multi-Tenant Instagram Automation & Direct Messaging SaaS  
> **Infrastructure Model**: Cloud-Native, Headless Architecture, Pure PostgreSQL Engine

---

## 1. Executive System Overview

Airvix provides compliant, automated comment-to-DM and direct messaging automation for Instagram creators, business accounts, and agencies.

The platform is designed around:
1. **Deterministic Multi-Tenancy**: Complete row-level isolation per tenant.
2. **Asynchronous Traffic Pacing**: Queue backpressure, jittered retries, and strict rate limiting to comply with Meta Graph API quotas.
3. **Defense-in-Depth Security Perimeter**: Comprehensive security headers, encrypted token storage (AES-256-GCM), TOTP MFA, audit trails, and multi-tier emergency kill switches.
4. **Resilient Data Lifecycle**: Automated TTL data retention, GDPR Article 20 data export, and GDPR Article 17 cascading erasure.

---

## 2. End-to-End System Request Flow

```mermaid
flowchart TD
    subgraph ClientLayer ["Client & Ingestion Layer"]
        User["End User / Admin"]
        Meta["Meta / Instagram Webhooks"]
    end

    subgraph SecurityPerimeter ["Security & Ingress Perimeter"]
        CDN["Netlify CDN (SPA)"]
        Ingress["Render Ingress / HTTPS"]
        SecHeaders["Security Headers (CSP, HSTS, X-Frame-Options)"]
        CorsAuth["CORS Allowlist & JWT Authentication"]
        SigVerify["HMAC-SHA256 Signature Verification"]
    end

    subgraph CoreEngine ["Airvix Core Engine"]
        API["Express API Gateway"]
        Idemp["Idempotency & Replay Guard"]
        Queue["Traffic Paced Queue (Backpressure & Fair-Share)"]
        KillSwitch{"Kill Switch Active? (Global / Account / Rule)"}
        Engine["Automation Engine (Keyword Match & Follow Gates)"]
        AI["AI Completion / Template Formatter"]
    end

    subgraph DeliveryLayer ["Outbound Delivery & Reliability"]
        RateLimiter["Per-Account Rate Limiter & Token Bucket"]
        MetaClient["Meta Graph API Client"]
        MetaAPI["Meta Graph API (Instagram DM & Comment Replies)"]
        RetryManager["Exponential Backoff & Jitter Handler"]
        DLQ["Dead-Letter Queue (DLQ)"]
    end

    subgraph PersistenceTelemetry ["Persistence, Metering & Telemetry"]
        PG[(Neon Serverless PostgreSQL)]
        CostTracker["Cost Protection & API Metering"]
        AuditTrail["Audit Logs & Observability"]
        Retention["Data Retention & TTL Pruner"]
    end

    %% Ingestion Flow
    User -->|Browser HTTPS| CDN
    CDN -->|API Calls| Ingress
    Meta -->|POST /webhooks| Ingress

    Ingress --> SecHeaders
    SecHeaders --> CorsAuth
    CorsAuth --> API

    Meta --> SigVerify
    SigVerify --> API

    %% Queue & Processing
    API --> Idemp
    Idemp --> Queue
    Queue --> KillSwitch
    KillSwitch -->|No (Permitted)| Engine
    KillSwitch -->|Yes (Paused)| DLQ
    Engine --> AI
    AI --> RateLimiter
    RateLimiter --> MetaClient
    MetaClient --> MetaAPI

    %% Retry & Error Paths
    MetaAPI -->|200 OK| CostTracker
    MetaAPI -->|429 / 5xx Transient| RetryManager
    RetryManager --> Queue
    RetryManager -->|Max Attempts Exhausted| DLQ

    %% Telemetry & Storage
    MetaClient --> CostTracker
    CostTracker --> PG
    API --> AuditTrail
    AuditTrail --> PG
    Retention -.->|Daily Pruning| PG
```

---

## 3. Detailed Component Map

### 3.1 Ingestion & Authentication
- **`backend/src/server.js`**: Express server root. Configures security headers, CORS allowlist, request latency monitoring, and routes.
- **`backend/src/middleware/securityHeaders.js`**: Enforces strict CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, and Content-Type validation.
- **`backend/src/middleware/auth.js`**: Verifies JWT Bearer tokens, extracts tenant context (`req.user`), enforces RBAC (`requireAdminRole`), and validates session active status.
- **`backend/src/routes/webhooks.js`**: Validates `X-Hub-Signature-256` HMAC signatures on incoming Instagram webhooks before queuing.

### 3.2 Queue, Traffic Control & Reliability
- **`backend/src/services/queue.js`**: Event worker managing concurrency, per-account pacing, backpressure, and job dispatch.
- **`backend/src/constants/queueConfig.js`**: Pacing delay parameters and exponential backoff configuration with randomized jitter.
- **`backend/src/services/abuseDetection.js`**:
  - Emergency Kill Switches: Global (`scope='global'`), Per-Account (`scope='account'`), Per-Rule (`scope='rule'`).
  - Velocity & Anomaly Detection: Tracks hourly message frequency and error rates; automatically flags and pauses abusive tenants.
- **`dead_letter_queue`**: Stores poisoned or permanently failed jobs with full payload and error stack traces for operator triage.

### 3.3 Outbound Integration & Cost Protection
- **`backend/src/services/metaClient.js`**: Handles Meta Graph API requests (DM send, comment reply, user profile lookup) with token renewal and mock mode for testing.
- **`backend/src/services/costProtection.js`**: Records every Graph API invocation in `tenant_api_usage`, enforces plan-based monthly quotas, and issues proactive 80% usage threshold warnings.

### 3.4 Data Lifecycle & Privacy Governance
- **`backend/src/services/dataRetention.js`**: Runs scheduled daily TTL cleanup jobs to purge expired webhooks, resolved DLQ entries, and error traces.
  - **GDPR Article 20**: Exports portable JSON representation of user data with token redaction.
  - **GDPR Article 17**: Executes cascading erasure of all tenant data with an immutable confirmation code.
- **`backend/src/scripts/backupDb.js` / `restoreDb.js`**: AES-256-GCM encrypted database dumps with PBKDF2 key derivation and tamper verification.

---

## 4. Multi-Tenant Data Isolation Model

All database tables enforce tenant scoping:
- `instagram_accounts.user_id` -> `users.id` (Foreign Key, `ON DELETE CASCADE`)
- `automation_rules.instagram_account_id` -> `instagram_accounts.id` (Foreign Key, `ON DELETE CASCADE`)
- `conversations.instagram_account_id` -> `instagram_accounts.id` (Foreign Key, `ON DELETE CASCADE`)
- `tenant_api_usage.user_id` -> `users.id` (Foreign Key, `ON DELETE CASCADE`)
- `abuse_flags.user_id` -> `users.id` (Foreign Key, `ON DELETE CASCADE`)

No API endpoint accepts arbitrary user or account IDs without validating ownership against `req.user.id`.

---

## 5. Security Perimeter Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL PERIMETER                            │
│  - Cloudflare / Netlify Edge DDoS Protection                           │
│  - HTTPS / TLS 1.3 Strict Transport Security                           │
│  - HSTS: max-age=63072000; includeSubDomains; preload                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                          INGRESS PERIMETER                             │
│  - Content Security Policy (frame-ancestors 'none')                    │
│  - CORS Strict Origin Allowlist (No wildcard '*')                     │
│  - Rate Limiting (IP & Tenant Token Bucket)                            │
│  - Input Sanitization & 415 Unsupported Media Type Blocking             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                        APPLICATION PERIMETER                           │
│  - JWT Bearer Authentication & Admin RBAC                              │
│  - TOTP Two-Factor Authentication (MFA) & Backup Codes                 │
│  - Single-Session Invalidation & Revocation Registry                   │
│  - Multi-Tier Emergency Kill Switches (Global, Account, Rule)          │
│  - Anomaly Velocity Detection & Auto-Pausing                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                           STORAGE PERIMETER                            │
│  - Database: Neon Serverless PostgreSQL with SSL (verify-full)         │
│  - Tokens Encrypted at Rest: AES-256-GCM + PBKDF2                      │
│  - Automated Encrypted Backups (AES-256-GCM + SHA-256 Checksums)       │
│  - Automated TTL Data Pruning & Cascading GDPR Erasure                 │
└────────────────────────────────────────────────────────────────────────┘
```
