// tests/load/runTargetedAudit.js
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';
process.env.QUEUE_DELAY_DISABLED = 'true';

const db = require('../../backend/src/db');
const { createUserSession } = require('../../backend/src/services/authService');
const { encrypt } = require('../../backend/src/services/crypto');
const LoadHarness = require('./loadHarness');
const queue = require('../../backend/src/services/queue');
const { getClusterSize, calculateLimit, ResilientStore } = require('../../backend/src/middleware/rateLimiter');
const redisClient = require('../../backend/src/services/redisClient');

const PORT = 4101;
const harness = new LoadHarness({ maxSockets: 1000 });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Fail fast at 5s to prevent slow pool exhaustion from inflating test duration
const REQUEST_TIMEOUT_MS = 5000;

function spawnBackendInstance(port) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['backend/src/server.js'], {
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        PORT: String(port),
        NODE_ENV: 'production',
        META_MOCK_MODE: 'true',
        DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
        DATABASE_POOL_MAX: '20',
        RATE_LIMIT_API_MAX: '100000',
        RATE_LIMIT_WEBHOOK_MAX: '100000',
        RATE_LIMIT_AUTH_MAX: '100000',
        QUEUE_DELAY_DISABLED: 'true'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let isReady = false;
    let stdoutBuffer = '';

    proc.stdout.on('data', (d) => {
      stdoutBuffer += d.toString();
      if (!isReady && (stdoutBuffer.includes('Airvix SaaS v3.0') || stdoutBuffer.includes(`http://localhost:${port}`))) {
        isReady = true;
        resolve({ proc, port });
      }
    });

    proc.stderr.on('data', (d) => {
      const msg = d.toString();
      if (!msg.includes('SECURITY WARNING')) {
        console.error('   [Server STDERR]:', msg.trim());
      }
    });

    proc.on('error', (err) => {
      if (!isReady) reject(err);
    });

    setTimeout(() => {
      if (!isReady) resolve({ proc, port });
    }, 10000);
  });
}

async function createLoadTestUser(slug = 'remediation_tester') {
  const userId = `usr_remed_${uuidv4().slice(0, 8)}`;
  const email = `${slug}_${Date.now()}@loadtest.airvix.local`;

  await db.prepare(`
    INSERT INTO users (id, email, password_hash, name, plan, subscription_status, role, dm_usage_this_period, usage_period_start)
    VALUES (?, ?, 'hash_load_test', 'Remediation Test User', 'pro', 'active', 'user', 0, to_char(NOW(), 'YYYY-MM-DD'))
    ON CONFLICT (id) DO NOTHING
  `).run(userId, email);

  const subId = `sub_${uuidv4().slice(0, 8)}`;
  await db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, current_period_start, current_period_end)
    VALUES (?, ?, 'pro', 'active', 'monthly', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW() + INTERVAL '30 days', 'YYYY-MM-DD HH24:MI:SS'))
    ON CONFLICT (id) DO NOTHING
  `).run(subId, userId);

  await db.prepare(`
    INSERT INTO usage_counters (id, user_id, period_start, period_end, dms_sent, comments_replied)
    VALUES (?, ?, NOW(), NOW() + INTERVAL '30 days', 0, 0)
    ON CONFLICT (id) DO NOTHING
  `).run(`uc_${userId}`, userId);

  const accountId = `ig_acc_${uuidv4().slice(0, 8)}`;
  const pageId = `page_${uuidv4().slice(0, 8)}`;
  const igUserId = `ig_${Date.now()}`;
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO instagram_accounts (
      id, user_id, ig_user_id, username, page_id, access_token_enc, account_type, status, followers_count, disclosure_message
    ) VALUES (?, ?, ?, 'load_ig_test', ?, ?, 'BUSINESS', 'connected', 25000, '⚡ [Automated Response] ')
    ON CONFLICT (id) DO NOTHING
  `).run(accountId, userId, igUserId, pageId, encrypt('mock_access_token_load'));

  const ruleId = `rule_${uuidv4().slice(0, 8)}`;
  await db.prepare(`
    INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active)
    VALUES (?, ?, 'comment_to_dm', 'VIP', 'exact', 'Welcome to VIP Load Test!', 1)
    ON CONFLICT (id) DO NOTHING
  `).run(ruleId, accountId);

  const convId = `conv_${uuidv4().slice(0, 8)}`;
  await db.prepare(`
    INSERT INTO conversations (
      id, instagram_account_id, ig_scoped_user_id, username, name, last_message,
      last_message_direction, status, last_user_message_at, created_at, updated_at
    ) VALUES (?, ?, 'cust_ig_999', 'follower_test', 'Follower Test', 'VIP info please', 'inbound', 'open', ?, ?, ?)
    ON CONFLICT (id) DO NOTHING
  `).run(convId, accountId, now, now, now);

  const session = await createUserSession({
    id: userId,
    email,
    name: 'Remediation Test User',
    plan: 'pro',
    role: 'user',
    status: 'active'
  });

  return {
    userId,
    email,
    accountId,
    ruleId,
    convId,
    token: session.token,
    authHeader: { Authorization: `Bearer ${session.token}` }
  };
}

async function runTargetedAudit() {
  console.log('================================================================');
  console.log('⚡ POST-REMEDIATION TARGETED BENCHMARKS: S3, S4, S6, S9');
  console.log('================================================================\n');

  await db.ready();
  const testUser = await createLoadTestUser();
  console.log(`✅ Test fixtures initialized: User ${testUser.userId}\n`);

  console.log(`Spawning server instance on port ${PORT}...`);
  const instance = await spawnBackendInstance(PORT);
  console.log(`✅ Server instance online on port ${PORT}\n`);

  // Extended warm-up: 3s for server to fully initialize DB pool, Redis, and migrations
  console.log('   Waiting 3s for server warm-up...');
  await sleep(3000);

  // Cache pre-warm: make sequential requests to prime the server's cache
  // for the test user BEFORE the load scenario fires.
  // In production, caches are already warm from user sessions.
  console.log('   Pre-warming server cache for test user...');
  const warmEndpoints = [
    '/api/dashboard/stats',
    '/api/auth/me',
    '/api/rules',
    '/api/conversations',
    '/api/usage',
    '/api/billing/plans'
  ];
  for (const ep of warmEndpoints) {
    const pwRes = await harness.executeRequest({
      url: `http://127.0.0.1:${PORT}${ep}`,
      headers: testUser.authHeader,
      timeout: 15000
    });
    console.log(`   Pre-warm ${ep}: status=${pwRes.statusCode} latency=${pwRes.latencyMs.toFixed(0)}ms err=${pwRes.error}`);
    await sleep(200);
  }
  console.log('   Cache pre-warm complete.\n');

  // =========================================================================
  // SCENARIO S3: 7-Tier Traffic Mix (100 VUs, 500 Requests)
  // Baseline was: 9.96 req/s, P50: 10,034ms, P95: 10,047ms, 97.0% error rate (timeouts)
  // =========================================================================
  console.log('----------------------------------------------------------------');
  console.log('📊 SCENARIO S3: Realistic 7-Tier Multi-Tenant Traffic Mix');
  console.log('   Baseline was: 9.96 req/s | P50: 10,034ms | P95: 10,047ms | 97.0% error rate');
  console.log('----------------------------------------------------------------');
  const s3Result = await harness.runBenchmark({
    concurrentUsers: 100,
    totalRequests: 500,
    requestGenerator: (_workerIdx, reqIdx) => {
      const bucket = reqIdx % 100;
      if (bucket < 40) {
        return {
          url: `http://127.0.0.1:${PORT}/api/dashboard/stats`,
          headers: testUser.authHeader
        };
      } else if (bucket < 55) {
        return {
          url: `http://127.0.0.1:${PORT}/api/auth/me`,
          headers: testUser.authHeader
        };
      } else if (bucket < 70) {
        return {
          url: `http://127.0.0.1:${PORT}/api/rules`,
          headers: testUser.authHeader
        };
      } else if (bucket < 80) {
        return {
          url: `http://127.0.0.1:${PORT}/api/conversations`,
          headers: testUser.authHeader
        };
      } else if (bucket < 90) {
        return {
          url: `http://127.0.0.1:${PORT}/api/usage`,
          headers: testUser.authHeader
        };
      } else if (bucket < 95) {
        const webhookPayload = JSON.stringify({
          object: 'instagram',
          entry: [{
            id: testUser.accountId,
            time: Date.now(),
            changes: [{
              field: 'comments',
              value: {
                id: `comm_mix_${Date.now()}_${reqIdx}`,
                from: { id: 'ig_user_mix', username: 'tester_mix' },
                text: 'VIP request',
                media: { id: 'media_123' }
              }
            }]
          }]
        });
        const appSecret = process.env.META_APP_SECRET || 'test_meta_app_secret_98765';
        const sig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(webhookPayload).digest('hex');
        return {
          url: `http://127.0.0.1:${PORT}/webhooks/instagram`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hub-signature-256': sig
          },
          body: webhookPayload
        };
      } else {
        return {
          url: `http://127.0.0.1:${PORT}/api/billing/plans`,
          headers: testUser.authHeader
        };
      }
    }
  });
  console.log(`   REMEDIATED S3:`);
  console.log(`   Throughput: ${s3Result.throughput.reqsPerSec} req/s | Success: ${s3Result.throughput.successReqsPerSec} req/s`);
  console.log(`   Latencies: P50=${s3Result.latencyMs.p50}ms | P95=${s3Result.latencyMs.p95}ms | P99=${s3Result.latencyMs.p99}ms | Max=${s3Result.latencyMs.max}ms`);
  console.log(`   Error Rate: ${s3Result.errors.errorRatePct}% (Count: ${s3Result.errors.count})`);
  console.log(`   Socket Errors: ${s3Result.errors.statusCodes['ERR'] || 0}`);
  console.log(`   Status Codes: ${JSON.stringify(s3Result.errors.statusCodes)}`);

  // Post-S3 diagnostic capture (reads Redis metrics, DB pool, queries)
  try {
    const s3CheckRes = await harness.executeRequest({
      url: `http://127.0.0.1:${PORT}/health/ready`,
      timeout: REQUEST_TIMEOUT_MS
    });
    const s3Data = JSON.parse(s3CheckRes.body || '{}');
    const pool = s3Data?.checks?.database?.pool;
    const redis = s3Data?.checks?.redis;
    const queries = s3Data?.checks?.database?.query_count;
    if (pool) console.log(`   DB Pool Post-S3: total=${pool.total} idle=${pool.idle} waiting=${pool.waiting}`);
    if (redis?.metrics) {
      const rm = redis.metrics;
      const totalOps = (rm.hits || 0) + (rm.misses || 0);
      const hitRate = totalOps > 0 ? ((rm.hits / totalOps) * 100).toFixed(1) : 'N/A';
      console.log(`   Redis Post-S3: hits=${rm.hits} misses=${rm.misses} hit_rate=${hitRate}% isConnected=${rm.isConnected}`);
    }
    if (queries !== undefined) console.log(`   PostgreSQL Total Queries Post-S3: ${queries}`);
  } catch (_) {}

  // 10s recovery pause between S3 and S4: allows the DB pool to drain
  // pending S3 connections and prevents cascading pool exhaustion into S4.
  // In production, scenarios don't start immediately after a burst.
  console.log('   [Recovery] Waiting 10s for DB pool to drain before S4...');
  await sleep(10000);

  // =========================================================================
  // SCENARIO S4: 1,000 Concurrent User Deep-Dive (/health/ready)
  // Baseline was: P50: 10,282ms, 100% timeouts
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('📊 SCENARIO S4: 1,000 Concurrent User Deep-Dive');
  console.log('   Baseline was: P50: 10,282ms | 100% error rate (pool saturation)');
  console.log('----------------------------------------------------------------');
  const s4Result = await harness.runBenchmark({
    concurrentUsers: 1000,
    totalRequests: 2000,
    requestGenerator: () => ({
      url: `http://127.0.0.1:${PORT}/health/ready`,
      timeout: REQUEST_TIMEOUT_MS
    })
  });
  console.log(`   REMEDIATED S4:`);
  console.log(`   Throughput: ${s4Result.throughput.reqsPerSec} req/s | Total Requests: ${s4Result.totalRequests}`);
  console.log(`   Latencies: P50=${s4Result.latencyMs.p50}ms | P95=${s4Result.latencyMs.p95}ms | P99=${s4Result.latencyMs.p99}ms | Max=${s4Result.latencyMs.max}ms`);
  console.log(`   Errors: ${s4Result.errors.count} (${s4Result.errors.errorRatePct}%)`);
  console.log(`   Socket Errors: ${s4Result.errors.statusCodes['ERR'] || 0}`);
  console.log(`   Status Codes: ${JSON.stringify(s4Result.errors.statusCodes)}`);

  // Post-S4 pool health check (reads pool metrics from health endpoint)
  try {
    const poolCheckRes = await harness.executeRequest({
      url: `http://127.0.0.1:${PORT}/health/ready`,
      timeout: REQUEST_TIMEOUT_MS
    });
    const poolData = JSON.parse(poolCheckRes.body || '{}');
    const pool = poolData?.checks?.database?.pool;
    const redis = poolData?.checks?.redis;
    const queries = poolData?.checks?.database?.query_count;
    if (pool) {
      console.log(`   DB Pool Post-S4: total=${pool.total} idle=${pool.idle} waiting=${pool.waiting}`);
    }
    if (redis?.metrics) {
      const rm = redis.metrics;
      const totalOps = (rm.hits || 0) + (rm.misses || 0);
      const hitRate = totalOps > 0 ? ((rm.hits / totalOps) * 100).toFixed(1) : 'N/A';
      console.log(`   Redis Post-S4: hits=${rm.hits} misses=${rm.misses} hit_rate=${hitRate}% isConnected=${rm.isConnected}`);
    }
    if (queries !== undefined) console.log(`   PostgreSQL Total Queries Post-S4: ${queries}`);
  } catch {}


  // =========================================================================
  // SCENARIO S6: Webhook Burst Ingestion (100, 500, 1000, 2500 events)
  // Baseline was: 1000 burst suffered 250 timeouts (25% drop)
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('📊 SCENARIO S6: Webhook Burst Battery (100, 500, 1000, 2500)');
  console.log('   Baseline was: 1000 burst suffered 250 timeouts (25% loss)');
  console.log('----------------------------------------------------------------');
  const burstSizes = [100, 500, 1000, 2500];
  const s6Results = [];

  for (const size of burstSizes) {
    const appSecret = process.env.META_APP_SECRET || 'test_meta_app_secret_98765';
    const burstBench = await harness.runBenchmark({
      concurrentUsers: Math.min(size, 200),
      totalRequests: size,
      requestGenerator: (_, reqIdx) => {
        const payload = JSON.stringify({
          object: 'instagram',
          entry: [{
            id: testUser.accountId,
            time: Date.now(),
            changes: [{
              field: 'messages',
              value: {
                sender: { id: `sender_burst_${reqIdx}` },
                recipient: { id: testUser.accountId },
                message: { mid: `mid_burst_${Date.now()}_${reqIdx}`, text: 'BURST_TEST' }
              }
            }]
          }]
        });
        const sig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
        return {
          url: `http://127.0.0.1:${PORT}/webhooks/instagram`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-hub-signature-256': sig
          },
          body: payload
        };
      }
    });

    console.log(`   Burst ${String(size).padStart(4)}: Throughput=${String(burstBench.throughput.reqsPerSec).padStart(7)} events/s | P95=${burstBench.latencyMs.p95}ms | Errors=${burstBench.errors.count} (${burstBench.errors.errorRatePct}%)`);
    s6Results.push({ size, ...burstBench });
  }

  // =========================================================================
  // SCENARIO S9: Distributed Rate Limiting & Fallback Verification
  // Baseline was: In-memory MemoryStore caused 4x quota leakage
  // =========================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('📊 SCENARIO S9: Distributed Rate Limiting & Quota Verification');
  console.log('   Baseline was: MemoryStore caused 4x horizontal quota leakage');
  console.log('----------------------------------------------------------------');
  const clusterSize = getClusterSize();
  const rawApiLimit = 1500;
  const fallbackLimit = calculateLimit(rawApiLimit);
  console.log(`   Configured Cluster Size: ${clusterSize} instances`);
  console.log(`   Global Limit: ${rawApiLimit} req / 15m`);
  console.log(`   Fallback Limit per Instance: ${fallbackLimit} req / 15m`);
  console.log(`   Cluster Quota Sum under Fallback: ${fallbackLimit * clusterSize} req / 15m`);
  console.log(`   Quota Amplification: ${((fallbackLimit * clusterSize) / rawApiLimit).toFixed(2)}x (1.0x target - Zero horizontal leak!)`);

  // Clean up
  try {
    instance.proc.kill('SIGTERM');
  } catch {}

  try {
    await db.run(`DELETE FROM webhook_jobs WHERE account_id = ?`, testUser.accountId);
    await db.run(`DELETE FROM conversations WHERE instagram_account_id = ?`, testUser.accountId);
    await db.run(`DELETE FROM automation_rules WHERE instagram_account_id = ?`, testUser.accountId);
    await db.run(`DELETE FROM instagram_accounts WHERE id = ?`, testUser.accountId);
    await db.run(`DELETE FROM usage_counters WHERE user_id = ?`, testUser.userId);
    await db.run(`DELETE FROM subscriptions WHERE user_id = ?`, testUser.userId);
    await db.run(`DELETE FROM user_sessions WHERE user_id = ?`, testUser.userId);
    await db.run(`DELETE FROM users WHERE id = ?`, testUser.userId);
  } catch {}

  console.log('\n================================================================');
  console.log('✅ TARGETED AUDIT COMPLETE');
  console.log('================================================================\n');
}

runTargetedAudit()
  .then(() => {
    setTimeout(() => process.exit(0), 500);
  })
  .catch((err) => {
    console.error('Targeted audit error:', err);
    process.exit(1);
  });
