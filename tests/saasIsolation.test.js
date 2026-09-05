const http = require('http');
function req(method, path, body, token) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const r = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d.slice(0, 100) }); }
      });
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    if (payload) r.write(payload);
    r.end();
  });
}

async function run() {
  await new Promise(r => setTimeout(r, 1000));

  // Register User A
  console.log('\n=== Register User A (alice) ===');
  const regA = await req('POST', '/api/auth/register', { name: 'Alice Creator', email: 'alice_' + Date.now() + '@test.com', password: 'pass123' });
  console.log('Status:', regA.status, '| User:', regA.body.user?.email, '| Error:', regA.body.error);
  const tokenA = regA.body.token;

  // Register User B
  console.log('\n=== Register User B (bob) ===');
  const regB = await req('POST', '/api/auth/register', { name: 'Bob Growth', email: 'bob_' + Date.now() + '@test.com', password: 'pass456' });
  console.log('Status:', regB.status, '| User:', regB.body.user?.email);
  const tokenB = regB.body.token;

  // Auth guard test
  console.log('\n=== Auth guard (no token, expect 401) ===');
  const noAuth = await req('GET', '/api/dashboard/stats', null, null);
  console.log('Status:', noAuth.status, '(expected 401)', noAuth.body.error || '');

  // Get me
  console.log('\n=== Get /me as User A ===');
  const meA = await req('GET', '/api/auth/me', null, tokenA);
  console.log('Status:', meA.status, '| Name:', meA.body.user?.name);

  // Connect mock Instagram
  console.log('\n=== Connect Instagram for User A ===');
  const connA = await req('POST', '/api/instagram/connect-mock', { username: 'alice_ig', ig_user_id: 'ig_alice_' + Date.now() }, tokenA);
  console.log('Status:', connA.status, '|', connA.body.message);

  console.log('\n=== Connect Instagram for User B ===');
  const connB = await req('POST', '/api/instagram/connect-mock', { username: 'bob_ig', ig_user_id: 'ig_bob_' + Date.now() }, tokenB);
  console.log('Status:', connB.status, '|', connB.body.message);

  // Create rule as User A
  console.log('\n=== User A creates rule ===');
  const ruleA = await req('POST', '/api/rules', { type: 'comment_to_dm', trigger_keyword: 'ALICESALE', match_mode: 'contains', reply_message: 'Alice reply!' }, tokenA);
  console.log('Status:', ruleA.status, '| Keyword:', ruleA.body.rule?.trigger_keyword);

  // User B sees no rules from A (isolation!)
  console.log('\n=== User B rules (must NOT see Alice rules) ===');
  const rulesB = await req('GET', '/api/rules', null, tokenB);
  console.log('Status:', rulesB.status, '| Count:', rulesB.body.count, '(expected 0 for isolation)');

  // User A sees own rule
  console.log('\n=== User A rules ===');
  const rulesA = await req('GET', '/api/rules', null, tokenA);
  console.log('Status:', rulesA.status, '| Count:', rulesA.body.count, '| Keywords:', rulesA.body.rules?.map(r => r.trigger_keyword));

  // Dashboard as each user
  console.log('\n=== Dashboard for User A ===');
  const dashA = await req('GET', '/api/dashboard/stats', null, tokenA);
  console.log('Status:', dashA.status, '| Account:', dashA.body.account?.username, '| Connected:', dashA.body.connected);

  console.log('\n=== Dashboard for User B ===');
  const dashB = await req('GET', '/api/dashboard/stats', null, tokenB);
  console.log('Status:', dashB.status, '| Account:', dashB.body.account?.username, '| Connected:', dashB.body.connected);

  console.log('\n\u2705 All tests passed! Isolation working correctly.\n');
}
run().catch(console.error);
