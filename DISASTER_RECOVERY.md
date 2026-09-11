# Airvix Enterprise Disaster Recovery (DR) & Business Continuity Runbook

## 1. Executive Summary & SLAs

| Metric | Target SLA | Strategy | Verification |
| :--- | :---: | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 15 minutes** | Neon WAL (Write-Ahead Logging) continuous streaming + hourly automated encrypted incremental snapshots. | Daily snapshot checksum audit & WAL stream validation. |
| **RTO (Recovery Time Objective)** | **< 15 minutes** | Single-command automated restore runner (`restoreDb.js`) + containerized deployment failover. | Monthly automated restore dry-runs in staging. |
| **Data Durability** | **99.999999999% (11 9s)** | Triple-region encrypted object storage replication (AWS S3 / Cloudflare R2). | Automated weekly integrity checks. |
| **Encryption at Rest** | **AES-256-GCM** | Authenticated encryption with separate per-snapshot IVs and SHA-256 integrity checksums. | Checked on every backup generation. |

---

## 2. Backup Retention Policy (Grandfather-Father-Son)

Airvix implements a hierarchical retention schedule to guarantee granular recovery options while preventing storage bloat:

1. **Hourly Snapshots**:
   - Generated every 60 minutes via cron.
   - Retained for **24 hours**.
   - Purpose: Rapid rollback against accidental data corruption or faulty programmatic batch updates.
2. **Daily Snapshots**:
   - Captured every day at 02:00 UTC.
   - Retained for **30 days**.
   - Purpose: Operational recovery against medium-term undetected issues.
3. **Weekly Snapshots**:
   - Captured every Sunday at 03:00 UTC.
   - Retained for **12 weeks (3 months)**.
   - Purpose: Business continuity and multi-week dispute resolution.
4. **Monthly Snapshots**:
   - Captured on the 1st of every calendar month.
   - Retained for **12 months (1 year)**.
   - Purpose: Fiscal compliance, tax audit records, and long-term historical records.

---

## 3. Automated Backup Architecture

```
                                  ┌───────────────────────────┐
                                  │ Neon PostgreSQL Database  │
                                  └─────────────┬─────────────┘
                                                │ (pg_dump / tables dump)
                                                ▼
                                  ┌───────────────────────────┐
                                  │   backupDb.js Runner      │
                                  └─────────────┬─────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
        [1. Gzip Compression]        [2. SHA-256 Checksum]       [3. AES-256-GCM Encryption]
                 │                              │                              │
                 └──────────────────────────────┼──────────────────────────────┘
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │  Encrypted Snapshot + Manifest  │
                               │  - backup-TIMESTAMP.enc.json    │
                               │  - backup-TIMESTAMP.manifest    │
                               └────────────────┬────────────────┘
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │ Secure Storage / S3 Bucket / R2 │
                               └─────────────────────────────────┘
```

### 3.1 Generating a Manual or Scheduled Backup
Run the automated backup runner:
```bash
node backend/src/scripts/backupDb.js
```
The output file is written to `backups/backup-<TIMESTAMP>.enc.json` with permissions restricted to `0600`.

---

## 4. Disaster Recovery & Restoration Procedures

### 4.1 Step 1: Verification & Dry-Run (Non-Destructive)
Before executing any live restore, verify the backup file's encryption and SHA-256 integrity:
```bash
node backend/src/scripts/restoreDb.js backups/backup-2026-09-11T19-45-00.enc.json --dry-run
```
Expected output:
```text
[Restore] 🔓 Decrypting backup file: backup-2026-09-11T19-45-00.enc.json...
[Restore] ✅ SHA-256 integrity checksum verified: a1b2c3d4e5f6...
[Restore] 📊 Found 15 tables to restore.
[Restore] 🔍 Dry run mode: verification succeeded without modifying database.
```

### 4.2 Step 2: Live Database Restoration
Execute the live restore:
```bash
node backend/src/scripts/restoreDb.js backups/backup-2026-09-11T19-45-00.enc.json
```
The script will:
1. Connect to PostgreSQL.
2. Start a transaction (`BEGIN`).
3. Truncate tables with `CASCADE` to clear corrupted state.
4. Populate table rows with original foreign keys preserved.
5. Commit the transaction (`COMMIT`). If any table insert fails, it immediately triggers `ROLLBACK`, leaving the existing database intact.

---

## 5. System Outage Blast Radius & Fault Tolerance Analysis

### 5.1 Scenario A: Database Outage (PostgreSQL / Neon Unreachable)
* **Immediate Symptoms**:
  - API responses for user logins return 500.
  - Deep readiness probe `/health/ready` immediately returns **HTTP 503 Service Unavailable** (`checks.database.status = 'unhealthy'`).
* **Protection Mechanism**:
  1. **Load Balancer Rerouting**: Upstream reverse proxies (Cloudflare, Render, AWS ALB) observe 503 from `/health/ready` and cease directing new traffic to unhealthy worker nodes.
  2. **Webhook Preservation**: Inbound Meta webhooks (`POST /webhooks/instagram`) detect database disconnect and immediately spool incoming payloads to local append-only JSON files in `data/webhook_spool/` while returning HTTP 200 `{ received: true, spooled: true }` to Meta. This prevents Meta from marking the app webhook degraded or disabling the subscription.
  3. **Self-Healing on Reconnection**: When PostgreSQL connectivity recovers, a background worker consumes the spool directory and writes the records to `webhook_events`.

### 5.2 Scenario B: Queue / Worker Outage
* **Immediate Symptoms**:
  - Webhook delivery succeeds, but DM replies are delayed.
* **Protection Mechanism**:
  1. **Decoupled Architecture**: Incoming webhooks are stored in `webhook_events` immediately upon receipt before queue dispatch.
  2. **Zero Message Loss**: Because messages are safely recorded in PostgreSQL, a crash in the worker process leaves uncompleted jobs with state `pending` or in the queue.
  3. **Automated Worker Recovery**: Process supervisors (PM2 / Docker / Kubernetes) reboot the worker within 3 seconds. The worker queries for uncompleted jobs and resumes processing seamlessly.
  4. **Poison-Pill Isolation (Dead-Letter Queue)**: If a specific message payload causes a worker crash (e.g. malformed UTF-8), it is pushed to `dead_letter_queue` after retries, preventing the entire queue from jamming.

### 5.3 Scenario C: Redis Outage (If Implemented / Cache Layer)
* **Immediate Symptoms**:
  - Cache misses for Instagram profile thumbnails and rate-limiting counters.
* **Protection Mechanism**:
  1. **Zero-Hard-Dependency Fallback**: Airvix uses in-memory sliding windows (`rateLimitWindows`) and PostgreSQL as primary stores.
  2. **Graceful Cache Degradation**: If an external Redis cluster is added for multi-instance syncing, the `cacheService` is wrapped with a circuit breaker that falls back to in-memory LRU caching and direct DB queries upon 3 consecutive Redis timeouts.
  3. **No Downtime**: Users and Meta webhooks experience zero interruptions; latency increases by at most 15–20ms for non-cached lookups.

---

## 6. Disaster Recovery Runbook Checklist

In the event of a catastrophic regional cloud outage:
- [ ] **T+0m**: Incident declared. Alert triggered in `#incident-war-room`.
- [ ] **T+2m**: Check status of primary database at cloud provider status page.
- [ ] **T+5m**: If primary database region is permanently destroyed, provision standby database in backup cloud region (e.g. Neon EU-Central or Render Oregon).
- [ ] **T+7m**: Download latest encrypted backup from S3/R2 storage bucket.
- [ ] **T+10m**: Run `node backend/src/scripts/restoreDb.js latest-backup.enc.json`.
- [ ] **T+12m**: Update `DATABASE_URL` secret on application deployment and deploy.
- [ ] **T+13m**: Validate `/health/ready` returns HTTP 200.
- [ ] **T+14m**: Update DNS routing / Cloudflare upstream to new deployment.
- [ ] **T+15m**: Incident resolved. Publish post-mortem within 24 hours.
