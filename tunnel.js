#!/usr/bin/env node
// tunnel.js - Smart tunnel launcher that auto-updates .env and prints instructions
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '.env');

function updateEnv(newUrl) {
  let env = fs.readFileSync(ENV_PATH, 'utf8');
  const redirectUri = `${newUrl}/api/instagram/oauth/callback`;
  env = env.replace(/META_REDIRECT_URI=.*/,  `META_REDIRECT_URI=${redirectUri}`);
  fs.writeFileSync(ENV_PATH, env);
  console.log('\n✅ .env updated automatically!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 Your tunnel URL:', newUrl);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 Update these in Meta App dashboard:\n');
  console.log('  Basic Settings:');
  console.log(`    App Domains:      ${newUrl.replace('https://', '')}`);
  console.log(`    Site URL:         ${newUrl}`);
  console.log(`    Privacy Policy:   ${newUrl}/privacy.html`);
  console.log(`    Terms of Service: ${newUrl}/terms.html`);
  console.log('');
  console.log('  Facebook Login → Settings:');
  console.log(`    Redirect URI: ${newUrl}/api/instagram/oauth/callback`);
  console.log('');
  console.log('  API Setup → Step 3 Webhooks:');
  console.log(`    Callback URL: ${newUrl}/webhooks/instagram`);
  console.log('    Verify Token: instagram_autoreply_verify_token_2026');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⚠️  Restart your backend (npm run dev) to pick up the new .env!\n');
}

console.log('🚇 Starting Cloudflare tunnel...\n');

const cf = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let urlFound = false;

function parseLine(line) {
  if (urlFound) return;
  // Cloudflare prints the tunnel URL in stderr
  const match = line.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
  if (match) {
    urlFound = true;
    updateEnv(match[0]);
  }
}

cf.stdout.on('data', d => { process.stdout.write(d); parseLine(d.toString()); });
cf.stderr.on('data', d => { process.stderr.write(d); parseLine(d.toString()); });

cf.on('close', code => {
  console.log(`\nTunnel exited (code ${code})`);
  process.exit(code);
});

process.on('SIGINT', () => { cf.kill(); process.exit(0); });
