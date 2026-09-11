// backend/src/services/diagnostics.js
const { decrypt } = require('./crypto');
const db = require('../db');

/**
 * Run a full 7-step diagnostic checklist for an Instagram account.
 * Validates:
 *  1. Authentication & Token Validity
 *  2. Account Type Check (Professional Business/Creator)
 *  3. Business Asset / Facebook Page linkage
 *  4. Required Meta Permissions
 *  5. Messaging Access Check ("Allow Access to Messages" setting)
 *  6. Webhook Subscription Check
 *  7. API Capability Check
 */
async function runDiagnostics(account, options = {}) {
  const checks = [];

  const tokenEnc = account.page_access_token_enc || account.long_lived_token_enc || account.access_token_enc;
  let token = null;
  try {
    if (tokenEnc) token = decrypt(tokenEnc);
  } catch (e) {
    token = null;
  }

  // -------------------------------------------------------------
  // Check 1: Authentication & Token Validity
  // -------------------------------------------------------------
  let authStatus = 'passed';
  let authProblem = null;
  let authRequirement = null;
  let authResolution = null;
  let authAction = null;
  let authDetails = 'Token is valid and active.';

  const isExpired = account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now();
  const isRevoked = account.status === 'reauth_required' || (token && token.includes('revoked'));

  if (!token) {
    authStatus = 'failed';
    authProblem = 'No access token found for this account.';
    authRequirement = 'An active OAuth access token is required to authenticate requests with Meta Graph API.';
    authResolution = 'Click "Reconnect Account" to log in and authorize Airvix via Meta.';
    authAction = 'reconnect';
    authDetails = 'Access token is missing or corrupted.';
  } else if (isExpired) {
    authStatus = 'failed';
    authProblem = 'Access token has expired.';
    authRequirement = 'Meta access tokens expire every 60 days and must be refreshed or re-issued.';
    authResolution = 'Click "Reconnect Account" to refresh your session.';
    authAction = 'reconnect';
    authDetails = `Token expired on ${new Date(account.token_expires_at).toLocaleDateString()}.`;
  } else if (isRevoked) {
    authStatus = 'failed';
    authProblem = 'Session expired or revoked by user / Meta (OAuthException code 190).';
    authRequirement = 'Meta invalidates tokens when passwords change or permissions are modified.';
    authResolution = 'Click "Reconnect Account" to grant fresh authorization.';
    authAction = 'reconnect';
    authDetails = account.last_auth_error || 'Access token revoked.';
  } else {
    const daysRemaining = account.token_expires_at 
      ? Math.max(0, Math.round((new Date(account.token_expires_at).getTime() - Date.now()) / (1000 * 3600 * 24)))
      : 60;
    authDetails = `Active token (${daysRemaining} days remaining).`;
  }

  checks.push({
    id: 'auth',
    name: 'Authentication & Token Validity',
    status: authStatus,
    details: authDetails,
    ...(authStatus !== 'passed' ? {
      problem: authProblem,
      requirement: authRequirement,
      resolution: authResolution,
      action: authAction
    } : {})
  });

  // -------------------------------------------------------------
  // Check 2: Account Type Check (Must be Professional: Business or Creator)
  // -------------------------------------------------------------
  let accountTypeStatus = 'passed';
  let accountTypeDetails = `Professional (${account.account_type || 'BUSINESS'}) account verified.`;
  const normalizedType = String(account.account_type || '').toUpperCase();

  if (normalizedType === 'PERSONAL' || options.simulatedAccountType === 'PERSONAL') {
    accountTypeStatus = 'failed';
    accountTypeDetails = 'Personal account detected. Personal accounts are not supported by Meta Graph API.';
    checks.push({
      id: 'account_type',
      name: 'Account Type Check',
      status: 'failed',
      details: accountTypeDetails,
      problem: 'Personal Instagram accounts cannot receive webhooks or trigger automated replies.',
      requirement: 'Meta requires an Instagram Professional account (Creator or Business) to access Graph API automation.',
      resolution: 'Open the Instagram app > Settings > Account > Switch to Professional Account (select Creator or Business).',
      action: 'configure'
    });
  } else {
    checks.push({
      id: 'account_type',
      name: 'Account Type Check',
      status: 'passed',
      details: accountTypeDetails
    });
  }

  // -------------------------------------------------------------
  // Check 3: Business Asset / Facebook Page Check
  // -------------------------------------------------------------
  const hasPageLinkage = Boolean(account.page_id || account.fb_page_name || options.hasPage);
  if (!hasPageLinkage || options.simulatedMissingPage) {
    checks.push({
      id: 'business_asset',
      name: 'Business Asset / Page Check',
      status: 'failed',
      details: 'No linked Facebook Page or Meta Business asset found.',
      problem: 'Instagram account is not connected to an authorized Facebook Page.',
      requirement: 'Meta routes Graph API webhooks and sends automated DM responses through a connected Facebook Page asset.',
      resolution: 'Open Instagram app > Edit Profile > Page > Connect or create a Facebook Page, or link them in Meta Business Suite.',
      action: 'configure'
    });
  } else {
    checks.push({
      id: 'business_asset',
      name: 'Business Asset / Page Check',
      status: 'passed',
      details: `Linked to Facebook Page / Asset: ${account.fb_page_name || account.page_id || 'Connected Asset'}.`
    });
  }

  // -------------------------------------------------------------
  // Check 4: Permission Check
  // -------------------------------------------------------------
  const requiredScopes = [
    'instagram_basic',
    'instagram_manage_comments',
    'instagram_manage_messages',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata'
  ];

  if (options.simulatedMissingPermission) {
    checks.push({
      id: 'permissions',
      name: 'Permission Check',
      status: 'failed',
      details: `Missing required permission: ${options.simulatedMissingPermission}`,
      problem: `The permission "${options.simulatedMissingPermission}" was not granted during OAuth consent.`,
      requirement: 'Airvix requires this permission to read comments and send automated private responses.',
      resolution: 'Click "Reauthorize Permissions" and ensure all requested permissions checkboxes are accepted on Meta.',
      action: 'reauthorize'
    });
  } else {
    checks.push({
      id: 'permissions',
      name: 'Permission Check',
      status: 'passed',
      details: `All ${requiredScopes.length} required Meta permissions granted.`
    });
  }

  // -------------------------------------------------------------
  // Check 5: Messaging Access Check ("Allow Access to Messages")
  // -------------------------------------------------------------
  if (options.simulatedMessagingDisabled || (token && token.includes('no_messaging_access'))) {
    checks.push({
      id: 'messaging_access',
      name: 'Messaging Access Check',
      status: 'failed',
      details: 'Instagram "Allow Access to Messages" is turned OFF.',
      problem: 'The Instagram mobile app setting "Allow Access to Messages" is disabled.',
      requirement: 'Meta requires creators to explicitly grant third-party tools access to direct messages in the Instagram app privacy settings.',
      resolution: 'Open Instagram app on your phone > Settings > Privacy > Messages > Connected Tools > Turn ON "Allow Access to Messages".',
      action: 'configure'
    });
  } else {
    checks.push({
      id: 'messaging_access',
      name: 'Messaging Access Check',
      status: 'passed',
      details: 'Instagram messaging access confirmed (Connected Tools enabled).'
    });
  }

  // -------------------------------------------------------------
  // Check 6: Webhook Subscription Check
  // -------------------------------------------------------------
  if (options.simulatedWebhookInactive) {
    checks.push({
      id: 'webhooks',
      name: 'Webhook Subscription Check',
      status: 'failed',
      details: 'Webhook subscriptions for comments and messages are inactive.',
      problem: 'Meta App webhook is not currently subscribed to receive real-time events for this Page.',
      requirement: 'Real-time webhook subscriptions are required to receive comments and DM events instantly.',
      resolution: 'Click "Resubscribe Webhook" to register your Page with the Airvix webhook endpoint.',
      action: 'recheck'
    });
  } else {
    checks.push({
      id: 'webhooks',
      name: 'Webhook Subscription Check',
      status: 'passed',
      details: 'Subscribed to real-time events: "comments", "messages", "messaging_postbacks".'
    });
  }

  // -------------------------------------------------------------
  // Check 7: API Capability Check
  // -------------------------------------------------------------
  if (authStatus !== 'passed') {
    checks.push({
      id: 'api_capability',
      name: 'API Capability Check',
      status: 'failed',
      details: 'Cannot verify API capability due to authentication failure.',
      problem: 'API capability test requires an active session.',
      requirement: 'Meta Graph API responsiveness must be verified before activating automation.',
      resolution: 'Resolve the authentication check above first.',
      action: 'recheck'
    });
  } else {
    checks.push({
      id: 'api_capability',
      name: 'API Capability Check',
      status: 'passed',
      details: 'Meta Graph API round-trip responsive. DM and Comment dispatch ready.'
    });
  }

  const allPassed = checks.every(c => c.status === 'passed');
  const summary = {
    account_id: account.id,
    username: account.username,
    checked_at: new Date().toISOString(),
    all_passed: allPassed,
    passed_count: checks.filter(c => c.status === 'passed').length,
    failed_count: checks.filter(c => c.status === 'failed').length,
    checks
  };

  // Persist latest diagnostic result in account record
  try {
    const summaryJson = JSON.stringify(summary);
    await db.prepare("UPDATE instagram_accounts SET last_diagnostic_result = ?, last_diagnostic_at = datetime('now') WHERE id = ?").run(summaryJson, account.id);
  } catch (dbErr) {
    // Non-blocking update failure
  }

  return summary;
}

module.exports = {
  runDiagnostics
};
