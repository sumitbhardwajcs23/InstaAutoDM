// tests/multiTenantSecurity.test.js
// Comprehensive Multi-Tenant Security & IDOR/BOLA Test Suite
// Verifies strict tenant isolation across:
// - Instagram Accounts & Tokens
// - Automation Rules
// - Conversations & Messages
// - Manual Inbox Replies
// - Loop Incidents & Resumption
// - Analytics & Dashboard
// - Connection & Hijack Prevention Flows

const http = require('http');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const app = require('../backend/src/server');
const db = require('../backend/src/db');
const { encrypt } = require('../backend/src/services/crypto');
const { JWT_SECRET } = require('../backend/src/config/secrets');

let server;
let baseUrl;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    let payload = null;
    if (body) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function runTest(name, fn) {
  return fn()
    .then(() => {
      console.log(`  ✅ PASS: ${name}`);
      return true;
    })
    .catch((err) => {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
      return false;
    });
}

async function startSuite() {
  console.log('\n========================================');
  console.log('🧪 Starting Multi-Tenant Security & IDOR/BOLA Test Suite');
  console.log('========================================\n');

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const runId = Date.now();
  const tenantAId = `usr_tenant_a_${runId}`;
  const tenantBId = `usr_tenant_b_${runId}`;

  const tokenA = jwt.sign({ id: tenantAId, email: `tenant_a_${runId}@airvix.com`, name: 'Client A' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenB = jwt.sign({ id: tenantBId, email: `tenant_b_${runId}@airvix.com`, name: 'Client B' }, JWT_SECRET, { expiresIn: '1h' });

  const authHeadersA = { Authorization: `Bearer ${tokenA}` };
  const authHeadersB = { Authorization: `Bearer ${tokenB}` };

  const accountAId = `ig_acc_a_${runId}`;
  const accountBId = `ig_acc_b_${runId}`;
  const igUserIdA = `178414001_${runId}`;
  const igUserIdB = `178414002_${runId}`;
  const handleA = `brand_alpha_${runId}`;
  const handleB = `brand_beta_${runId}`;

  const ruleAId = `rule_a_${runId}`;
  const convAId = `conv_a_${runId}`;
  const msgAId = `msg_a_${runId}`;
  const incidentAId = `inc_a_${runId}`;

  const now = new Date().toISOString();

  // Seed Users
  await db.prepare("INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at) VALUES (?, ?, 'Client A', 'pro', 25, ?, ?, ?)").run(
    tenantAId, `tenant_a_${runId}@airvix.com`, now.slice(0, 10), now, now
  );
  await db.prepare("INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at) VALUES (?, ?, 'Client B', 'pro', 5, ?, ?, ?)").run(
    tenantBId, `tenant_b_${runId}@airvix.com`, now.slice(0, 10), now, now
  );

  // Seed Instagram Accounts
  const tokenEncA = encrypt('meta_secret_token_client_a');
  const tokenEncB = encrypt('meta_secret_token_client_b');

  await db.prepare(`
    INSERT INTO instagram_accounts (
      id, user_id, ig_user_id, username, full_name, profile_picture_url, page_id, fb_page_name, fb_user_id,
      access_token_enc, page_access_token_enc, long_lived_token_enc, token_expires_at, status, followers_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'Brand Alpha Official', 'https://example.com/alpha.jpg', 'page_a_1', 'Alpha Page', 'fb_a_1', ?, ?, ?, ?, 'connected', 50000, ?, ?)
  `).run(accountAId, tenantAId, igUserIdA, handleA, tokenEncA, tokenEncA, tokenEncA, now, now, now);

  await db.prepare(`
    INSERT INTO instagram_accounts (
      id, user_id, ig_user_id, username, full_name, profile_picture_url, page_id, fb_page_name, fb_user_id,
      access_token_enc, page_access_token_enc, long_lived_token_enc, token_expires_at, status, followers_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'Brand Beta Official', 'https://example.com/beta.jpg', 'page_b_1', 'Beta Page', 'fb_b_1', ?, ?, ?, ?, 'connected', 12000, ?, ?)
  `).run(accountBId, tenantBId, igUserIdB, handleB, tokenEncB, tokenEncB, tokenEncB, now, now, now);

  // Seed Rule for Account A
  await db.prepare(`
    INSERT INTO automation_rules (
      id, instagram_account_id, type, trigger_keyword, match_mode, reply_message,
      comment_reply_mode, dm_reply_message, is_active, fire_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ruleAId, accountAId, 'comment_to_dm', 'VIPDEAL', 'exact', 'Exclusive offer for you!', 'both', 'Exclusive offer for you!', 1, 10, now, now);

  // Seed Conversation & Message for Account A
  await db.prepare(`
    INSERT INTO conversations (
      id, instagram_account_id, ig_scoped_user_id, username, name, last_message,
      last_message_direction, status, last_user_message_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(convAId, accountAId, 'cust_ig_999', 'happy_shopper', 'Happy Shopper', 'Where is my order?', 'inbound', 'open', now, now, now);

  await db.prepare(`
    INSERT INTO messages (
      id, conversation_id, direction, content, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(msgAId, convAId, 'inbound', 'Where is my order?', 'received', now);

  // Seed Loop Incident for Account A
  await db.prepare(`
    INSERT INTO automation_loop_incidents (
      id, instagram_account_id, conversation_id, target_user_id, trigger_rule_id, loop_reason, details, status, detected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(incidentAId, accountAId, convAId, 'cust_ig_999', ruleAId, 'rapid_cadence_ping_pong', '{"count": 4}', 'active', now);

  // Seed Activity Log for Account A
  await db.prepare(`
    INSERT INTO activity_log (id, instagram_account_id, event_date, dms_sent, comments_replied, created_at)
    VALUES (?, ?, ?, 42, 30, ?)
  `).run(`act_a_${runId}`, accountAId, now.slice(0, 10), now);

  let passed = 0;
  let failed = 0;

  // ─────────────────────────────────────────────────────────────
  // 1. Instagram Account Data & Token Access Isolation (IDOR/BOLA)
  // ─────────────────────────────────────────────────────────────
  const test1 = await runTest('Client B cannot view or access Client A Instagram account or tokens via account_id', async () => {
    const res = await makeRequest('GET', `/api/instagram/account?account_id=${accountAId}`, null, authHeadersB);
    if (res.status !== 200) throw new Error(`Expected 200 with null account, got ${res.status}`);
    if (res.body.account !== null || res.body.connected !== false) {
      throw new Error(`CRITICAL: Leaked Client A account to Client B: ${JSON.stringify(res.body)}`);
    }
  });
  test1 ? passed++ : failed++;

  const test2 = await runTest('Client B cannot delete or modify Client A Instagram account (IDOR delete)', async () => {
    // Attempt delete Client A's account as Client B
    const delRes = await makeRequest('DELETE', `/api/instagram/accounts/${accountAId}`, null, authHeadersB);
    if (delRes.status !== 404) throw new Error(`Expected 404, got ${delRes.status}`);

    // Verify Client A's account is still in the DB
    const check = await db.prepare("SELECT * FROM instagram_accounts WHERE id = ?").get(accountAId);
    if (!check || check.status !== 'connected') throw new Error('Client A account was altered or deleted!');

    // Attempt set-handle on Client A's account as Client B
    const modRes = await makeRequest('POST', '/api/instagram/account/set-handle', {
      account_id: accountAId,
      username: 'hacked_alpha'
    }, authHeadersB);
    if (modRes.status !== 404) throw new Error(`Expected 404 for set-handle on other tenant account, got ${modRes.status}`);

    const checkMod = await db.prepare("SELECT username FROM instagram_accounts WHERE id = ?").get(accountAId);
    if (checkMod.username !== handleA) throw new Error(`Username was altered across tenants: ${checkMod.username}`);
  });
  test2 ? passed++ : failed++;

  // ─────────────────────────────────────────────────────────────
  // 2. Account Hijack & Cross-Tenant Token Theft Prevention
  // ─────────────────────────────────────────────────────────────
  const test3 = await runTest('Client B cannot hijack Client A Instagram account via connect-username or connect-token', async () => {
    // Attempt connect-username with Client A's username
    const hijackRes1 = await makeRequest('POST', '/api/instagram/connect-username', {
      username: handleA
    }, authHeadersB);
    if (hijackRes1.status !== 409) throw new Error(`Expected 409 Conflict, got ${hijackRes1.status}: ${JSON.stringify(hijackRes1.body)}`);

    // Attempt connect-username with Client A's IG User ID
    const hijackRes2 = await makeRequest('POST', '/api/instagram/connect-username', {
      username: `fake_name_${runId}`,
      ig_user_id: igUserIdA
    }, authHeadersB);
    if (hijackRes2.status !== 409) throw new Error(`Expected 409 Conflict, got ${hijackRes2.status}`);

    // Attempt connect-token where Meta returns Client A's IG User ID
    const metaClient = require('../backend/src/services/metaClient');
    const origExchange = metaClient.exchangeUserToken;
    metaClient.exchangeUserToken = async () => ({
      access_token: 'mock_attacker_token',
      page_access_token: 'mock_attacker_token',
      long_lived_token: 'mock_attacker_token',
      page_id: 'page_attacker',
      page_name: 'Attacker Page',
      fb_user_id: 'fb_attacker',
      ig_user_id: igUserIdA,
      username: handleA,
      followers_count: 500,
      expires_in: 5184000
    });

    try {
      const hijackRes3 = await makeRequest('POST', '/api/instagram/connect-token', {
        access_token: 'EAAB_attacker_token'
      }, authHeadersB);
      if (hijackRes3.status !== 409) throw new Error(`Expected 409 Conflict on connect-token, got ${hijackRes3.status}`);
    } finally {
      metaClient.exchangeUserToken = origExchange;
    }

    // Verify Client A account ownership in DB remains strictly tenantAId
    const currentAcc = await db.prepare("SELECT user_id, ig_user_id FROM instagram_accounts WHERE id = ?").get(accountAId);
    if (currentAcc.user_id !== tenantAId) throw new Error(`Account was stolen! user_id = ${currentAcc.user_id}`);
  });
  test3 ? passed++ : failed++;

  // ─────────────────────────────────────────────────────────────
  // 3. Automation Rules Cross-Tenant Isolation (IDOR/BOLA)
  // ─────────────────────────────────────────────────────────────
  const test4 = await runTest('Client B cannot view, toggle, modify, or delete Client A automation rules', async () => {
    // List rules with Client A's account_id
    const listRes = await makeRequest('GET', `/api/rules?account_id=${accountAId}`, null, authHeadersB);
    if (listRes.body.rules && listRes.body.rules.length > 0) {
      throw new Error(`CRITICAL: Client B listed Client A rules: ${JSON.stringify(listRes.body)}`);
    }

    // Direct fetch of Rule A (BOLA GET)
    const getRes = await makeRequest('GET', `/api/rules/${ruleAId}`, null, authHeadersB);
    if (getRes.status !== 404) throw new Error(`Expected 404 for GET /rules/:id across tenants, got ${getRes.status}`);

    // Create rule attached to Client A's account
    const createRes = await makeRequest('POST', '/api/rules', {
      account_id: accountAId,
      trigger_keyword: 'ATTACK',
      reply_message: 'Unauthorized rule'
    }, authHeadersB);
    if (createRes.status !== 400) throw new Error(`Expected 400 when creating rule for other tenant account, got ${createRes.status}`);

    // Toggle Rule A
    const toggleRes = await makeRequest('PATCH', `/api/rules/${ruleAId}/toggle`, {}, authHeadersB);
    if (toggleRes.status !== 404) throw new Error(`Expected 404 for toggle, got ${toggleRes.status}`);

    // Modify Rule A
    const putRes = await makeRequest('PUT', `/api/rules/${ruleAId}`, {
      reply_message: 'HACKED BY CLIENT B'
    }, authHeadersB);
    if (putRes.status !== 404) throw new Error(`Expected 404 for PUT, got ${putRes.status}`);

    // Delete Rule A
    const delRuleRes = await makeRequest('DELETE', `/api/rules/${ruleAId}`, null, authHeadersB);
    if (delRuleRes.status !== 404) throw new Error(`Expected 404 for DELETE, got ${delRuleRes.status}`);

    // Verify Rule A content and status are unchanged
    const currentRule = await db.prepare("SELECT * FROM automation_rules WHERE id = ?").get(ruleAId);
    if (!currentRule || currentRule.reply_message !== 'Exclusive offer for you!' || currentRule.is_active !== 1) {
      throw new Error('Client A rule was compromised or deleted!');
    }
  });
  test4 ? passed++ : failed++;

  // ─────────────────────────────────────────────────────────────
  // 4. Conversations & Messages Cross-Tenant Isolation (IDOR/BOLA)
  // ─────────────────────────────────────────────────────────────
  const test5 = await runTest('Client B cannot view, reply to, or alter Client A conversations or messages', async () => {
    // List conversations with Client A's account_id
    const listRes = await makeRequest('GET', `/api/conversations?account_id=${accountAId}`, null, authHeadersB);
    if (listRes.body.conversations && listRes.body.conversations.length > 0) {
      throw new Error(`CRITICAL: Client B listed Client A conversations: ${JSON.stringify(listRes.body)}`);
    }

    // Fetch Conversation A details (BOLA GET)
    const convRes = await makeRequest('GET', `/api/conversations/${convAId}`, null, authHeadersB);
    if (convRes.status !== 404) throw new Error(`Expected 404 for GET /conversations/:id, got ${convRes.status}`);

    // Fetch Messages of Conversation A (BOLA GET)
    const msgsRes = await makeRequest('GET', `/api/conversations/${convAId}/messages`, null, authHeadersB);
    if (msgsRes.status !== 404) throw new Error(`Expected 404 for GET /conversations/:id/messages, got ${msgsRes.status}`);

    // Reply to Conversation A as Client B (IDOR POST)
    const replyRes = await makeRequest('POST', `/api/conversations/${convAId}/reply`, {
      text: 'Imposter message'
    }, authHeadersB);
    if (replyRes.status !== 404) throw new Error(`Expected 404 for replying to another client conversation, got ${replyRes.status}`);

    // Patch Conversation A status as Client B
    const patchRes = await makeRequest('PATCH', `/api/conversations/${convAId}`, {
      status: 'closed'
    }, authHeadersB);
    if (patchRes.status !== 404) throw new Error(`Expected 404 for PATCH conversation, got ${patchRes.status}`);

    // Verify Conversation A status is still 'open'
    const currentConv = await db.prepare("SELECT status FROM conversations WHERE id = ?").get(convAId);
    if (currentConv.status !== 'open') throw new Error(`Conversation A status was altered to ${currentConv.status}`);
  });
  test5 ? passed++ : failed++;

  // ─────────────────────────────────────────────────────────────
  // 5. Loop Incidents & Safety Resumption Isolation (IDOR/BOLA)
  // ─────────────────────────────────────────────────────────────
  const test6 = await runTest('Client B cannot view or resume Client A loop detection incidents', async () => {
    // List incidents using Client A account_id
    const incListRes = await makeRequest('GET', `/api/conversations/incidents?account_id=${accountAId}`, null, authHeadersB);
    if (incListRes.body.incidents && incListRes.body.incidents.length > 0) {
      throw new Error(`CRITICAL: Client B viewed Client A loop incidents: ${JSON.stringify(incListRes.body)}`);
    }

    // Resume Client A's paused loop incident as Client B
    const resumeRes = await makeRequest('POST', `/api/conversations/incidents/${incidentAId}/resume`, {}, authHeadersB);
    if (resumeRes.status !== 404) throw new Error(`Expected 404 when resuming another client incident, got ${resumeRes.status}`);

    // Verify Incident A is still active in DB
    const currentInc = await db.prepare("SELECT status FROM automation_loop_incidents WHERE id = ?").get(incidentAId);
    if (currentInc.status !== 'active') throw new Error(`Incident status was unauthorizedly changed to: ${currentInc.status}`);

    // Verify Client A can legitimately resume their own incident
    const legitResume = await makeRequest('POST', `/api/conversations/incidents/${incidentAId}/resume`, {}, authHeadersA);
    if (legitResume.status !== 200 || !legitResume.body.success) {
      throw new Error(`Client A failed to resume their own incident: ${JSON.stringify(legitResume.body)}`);
    }
    const resolvedInc = await db.prepare("SELECT status FROM automation_loop_incidents WHERE id = ?").get(incidentAId);
    if (resolvedInc.status !== 'resolved') throw new Error('Incident status did not change to resolved for legitimate owner');
  });
  test6 ? passed++ : failed++;

  // ─────────────────────────────────────────────────────────────
  // 6. Analytics & Dashboard Cross-Tenant Scoping
  // ─────────────────────────────────────────────────────────────
  const test7 = await runTest('Client B cannot view Client A dashboard stats or activity log analytics', async () => {
    // Dashboard stats with Client A's account_id
    const dashRes = await makeRequest('GET', `/api/dashboard/stats?account_id=${accountAId}`, null, authHeadersB);
    if (dashRes.status !== 200) throw new Error(`Expected 200 with empty stats, got ${dashRes.status}`);
    if (dashRes.body.connected !== false || dashRes.body.account !== null) {
      throw new Error(`CRITICAL: Client B received Client A dashboard account: ${JSON.stringify(dashRes.body)}`);
    }

    // Analytics with Client A's account_id
    const actRes = await makeRequest('GET', `/api/analytics/activity?account_id=${accountAId}&days=7`, null, authHeadersB);
    if (actRes.status !== 200) throw new Error(`Expected 200, got ${actRes.status}`);
    if (actRes.body.totals.dms_sent !== 0 || actRes.body.totals.comments_replied !== 0) {
      throw new Error(`CRITICAL: Client B accessed Client A activity metrics: ${JSON.stringify(actRes.body)}`);
    }
  });
  test7 ? passed++ : failed++;

  // ─────────────────────────────────────────────────────────────
  // 7. Diagnostics & Simulator Cross-Tenant Protection
  // ─────────────────────────────────────────────────────────────
  const test8 = await runTest('Client B cannot run diagnostics or execute simulator on Client A account', async () => {
    // Run diagnostics on Client A account as Client B
    const diagRunRes = await makeRequest('POST', '/api/instagram/diagnostics/run', {
      account_id: accountAId
    }, authHeadersB);
    if (diagRunRes.status !== 404) throw new Error(`Expected 404 for diagnostics run on other account, got ${diagRunRes.status}`);

    // Get diagnostics for Client A account as Client B
    const diagGetRes = await makeRequest('GET', `/api/instagram/diagnostics?account_id=${accountAId}`, null, authHeadersB);
    if (diagGetRes.status !== 404) throw new Error(`Expected 404 for GET diagnostics, got ${diagGetRes.status}`);

    // Run simulator on Client A account as Client B
    const simRes = await makeRequest('POST', '/api/simulator/comment', {
      account_id: accountAId,
      text: 'VIPDEAL'
    }, authHeadersB);
    // Should reject because account_id does not belong to Client B
    if (simRes.status !== 400) throw new Error(`Expected 400 for simulator with foreign account, got ${simRes.status}`);
  });
  test8 ? passed++ : failed++;

  // Teardown
  server.close();

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

startSuite().catch(err => {
  console.error('Test suite failed:', err);
  if (server) server.close();
  process.exit(1);
});
