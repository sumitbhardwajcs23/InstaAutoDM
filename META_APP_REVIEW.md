# Meta App Review & Production Deployment Package — Airvix

This document contains the complete Meta App Review package for **Airvix** (`instAutoReplyDm`), including required permissions justifications, reviewer testing instructions, screencast demo video script, and technical compliance architecture.

---

## 1. Required Permissions Justification & Minimization Mapping

Airvix requests only the minimal set of permissions strictly necessary for its creator automation features. In accordance with Meta App Review guidelines, every requested permission maps to an exact feature, specific API endpoint, and verified business justification:

| Requested Permission | Required Capability | API Endpoint | Exact Feature & Business Justification |
| :--- | :--- | :--- | :--- |
| **`instagram_basic`** | Read profile metadata | `GET /me?fields=id,username,profile_picture_url,account_type,followers_count` | **Account Connection & Profile Card**: Displays the creator's profile card in the Airvix workspace header and Settings view to confirm verified account connection. |
| **`instagram_manage_comments`** | Read & reply to post comments | `GET /{media-id}/comments`<br>`POST /{comment-id}/replies` | **Comment-to-DM Automation**: Evaluates keyword rules on inbound comments and dispatches creator-configured public comment replies to engage fans. |
| **`instagram_manage_messages`** | Ingest & reply to direct messages | `POST /webhooks/instagram`<br>`POST /{page-id}/messages` | **Direct Message Automation & Private Reply**: Sends private DMs in response to keyword comments (e.g. delivering requested resource links) and answers common DM inquiries within the 24h window. |
| **`pages_show_list`** | Discover connected business assets | `GET /me/accounts` | **Account Linking Modal**: Allows creators managing multiple Facebook Pages to select and bind the specific Instagram Business account they want to automate. |
| **`pages_read_engagement`** | Read engagement & media lists | `GET /{ig-user-id}/media?fields=id,caption,media_type,thumbnail_url` | **Media Picker**: Allows creators to target automations to a specific Reel or post rather than global account comments. |
| **`pages_manage_metadata`** | Subscribe to webhook topics | `POST /{page-id}/subscribed_apps` | **Webhook Handshake & Subscription**: Automatically establishes real-time webhook event routing from Meta Graph API to Airvix. |

---

## 2. Onboarding & Connection Diagnostics Checklist

Airvix eliminates connection failures and user configuration errors by running an automated **7-Point Connection Diagnostic** upon account connection. Meta reviewers can verify this directly in **Settings &rarr; Diagnostics**:

1. **Authentication & Token Validity**: Verifies decrypted OAuth token is active and not revoked/expired.
2. **Account Type Check**: Confirms account is an Instagram Professional account (`BUSINESS` or `CREATOR`). Rejects personal accounts with instructions to switch in the Instagram mobile app.
3. **Business Asset / Page Check**: Verifies valid Facebook Page linkage for Graph API routing.
4. **Permission Check**: Confirms all 6 required Meta permissions are approved.
5. **Messaging Access Check**: Confirms "Allow Access to Messages" is toggled ON in Instagram mobile app settings (*Settings > Privacy > Messages > Connected Tools*).
6. **Webhook Subscription Check**: Confirms active subscriptions for `comments` and `messages`.
7. **API Capability Check**: Performs an active round-trip handshake with Meta Graph API.

---

## 3. Automation Loop Prevention & Safety Safeguards

To protect creator accounts and comply with Meta platform policies against uncontrolled messaging traffic, Airvix implements four independent safety layers:

1. **Sender Origin Verification**: Airvix ignores events originating from the connected account itself (`sender.id === ig_user_id || page_id || fb_user_id`), events matching the creator username, and Meta echo events (`is_echo === true`).
2. **Internal Per-User Daily Limit (Internal Product Safeguard)**:
   - Limits automated direct messages to **3 automated DMs per user per 24-hour period**.
   - *Note for Reviewers:* This is an internal Airvix safeguard designed to prevent spam and accidental bot loops; it is not represented to users as an official Meta platform limit.
3. **Automated Loop & Ping-Pong Detection**:
   - **Rapid Cadence Detection**: Detects if 3 or more messages are exchanged between participants within 10 seconds.
   - **Repeated Identical Responses**: Detects if 3 identical automated replies are dispatched consecutively without recipient response.
   - **Action upon Loop**: Immediately pauses conversation automation (`status = 'loop_paused'`), halts outbound messaging, logs an incident in `automation_loop_incidents`, and alerts the creator in the dashboard.
4. **Natural Response Delay & Rate Limiting**:
   - Random response delay of 5–30 seconds to prevent burst traffic.
   - Per-account throttling: max 2 concurrent sends and 30 requests/minute per account.

---

## 2. Meta Reviewer Test Instructions

### Step-by-Step Reproduction Guide for App Reviewers

#### A. Login to Airvix
1. Navigate to the live Airvix web application: `https://your-domain.com/login` (or test environment).
2. Use the dedicated reviewer demo credentials:
   - **Email:** `reviewer@meta.com` (or create a new test account via `/register`)
   - **Password:** `MetaReview2026!`

#### B. Connect Instagram Account (Tests `pages_show_list`, `instagram_basic`)
1. From the dashboard, navigate to **Settings** &rarr; **Connected Accounts** (or click the **Connect Instagram** button on the home view).
2. Authorize via Meta OAuth. Grant permissions to the authorized test Page and Instagram Professional account.
3. Observe the connected account card displaying:
   - Instagram handle (`@username`)
   - Follower count & profile avatar
   - Token Health status: `Healthy (Valid for 60 days)`

#### C. Configure an Automation Rule (Tests `instagram_manage_comments`, `instagram_manage_messages`)
1. In the sidebar, click **Automations** &rarr; **+ New Rule**.
2. Select **Trigger Type**: `Comment on Any Post` (or `Specific Reel`).
3. Set **Trigger Keyword**: `GUIDE` (Match mode: `Contains`).
4. Set **Public Comment Reply**: `Check your DMs! 📩`
5. Set **Private Direct Message**: `Here is your free guide: https://example.com/guide`
6. Click **Save & Activate**.

#### D. Live Event Demonstration (Tests Webhook Handshake & Outbound Reply)
1. Using an authorized Instagram test user, leave a comment on any post of the connected creator account:
   - Comment text: *"Please send me the GUIDE!"*
2. Airvix Webhook receives the event at `POST /webhooks/instagram`, returns HTTP 200 immediately, and enqueues the job.
3. Within the configured natural processing delay (5–30 seconds), Airvix:
   - Posts the public comment reply (`Check your DMs! 📩`) via `POST /{comment-id}/replies`.
   - Sends the private direct message with the link via `POST /{page-id}/messages`.
4. The conversation and delivery confirmation immediately appear in the Airvix **Inbox** and **Activity Log**.

---

## 3. Screencast Demo Video Script (4 Steps)

Record a clean, high-resolution (1080p) video of 2–3 minutes following this exact structure:

### Step 1: Login & Account Connection (0:00 – 0:45)
- Start on the Airvix login screen. Log in to the creator dashboard.
- Click **Connect Instagram**.
- Show the Meta OAuth dialog clearly displaying the requested permissions (`instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_show_list`).
- Complete authorization and show the connected profile card with Instagram username and token validity.
- *Voiceover/Caption:* "Here the user logs in and securely connects their Instagram Professional account using official Meta OAuth."

### Step 2: Dashboard & Token Health (0:45 – 1:10)
- Show the main dashboard metrics (Total Replies, Active Rules, Quota Meter).
- Point to the Token Health indicator in Settings showing automated 60-day token lifecycle tracking.
- *Voiceover/Caption:* "The dashboard displays connected account metrics and confirms active token validity."

### Step 3: Create Automation Rule (1:10 – 1:50)
- Navigate to **Automations** and click **Create Rule**.
- Set trigger keyword `GUIDE`, configure public comment response, and enter private DM content.
- Toggle rule status to **Active** and save.
- *Voiceover/Caption:* "The creator creates a Comment-to-DM automation triggered by the keyword GUIDE to automatically fulfill resource requests."

### Step 4: Real Test & Verified Delivery (1:50 – 2:45)
- Switch to Instagram mobile app or web interface.
- From a test account, post a comment containing `GUIDE` on the creator's post.
- Show the webhook receipt and processing in Airvix.
- Show the public comment reply published on Instagram.
- Open the user's Instagram direct messages showing the private message delivered with the link.
- Show the completed message thread inside the Airvix Creator Inbox.
- *Voiceover/Caption:* "The user comments on the post. Airvix ingests the webhook, applies natural delivery pacing, posts the public reply, and delivers the requested resource directly to the user's inbox."

---

## 4. Compliance & Legal Checklist

All required compliance URLs are live and publicly accessible without authentication:

* **Privacy Policy URL:** `https://your-domain.com/privacy.html` (covers all 12 Meta data protection criteria)
* **Terms of Service URL:** `https://your-domain.com/terms.html` (covers all 11 acceptable use & platform criteria)
* **Data Deletion Callback URL:** `https://your-domain.com/api/instagram/data-deletion` (processes HMAC-SHA256 `signed_request`)
* **Data Deletion Status URL:** `https://your-domain.com/data-deletion-status` (public audit tracking via confirmation code)
* **Webhook Endpoint:** `https://your-domain.com/webhooks/instagram` (HTTPS enforced, HMAC-SHA256 signature verification)

---

## 5. Security & Technical Architecture Summary

1. **Token Security:** Access tokens are encrypted at rest using AES-256-GCM. Tokens are never transmitted to frontend clients.
2. **Automated Token Refresh:** Background service automatically queries and refreshes long-lived tokens via `https://graph.instagram.com/refresh_access_token` when tokens are within 15 days of expiration.
3. **Queue-Based Asynchronous Architecture:** Webhooks acknowledge incoming Meta traffic immediately with HTTP 200, decoupling ingestion from reply dispatch.
4. **Natural Response Delay:** Delays are configurable (5–30 seconds) to smooth traffic spikes.
5. **Per-Account Rate Limiting:** Outbound API requests are capped at 2 concurrent jobs and 30 requests/min per account.
6. **Strict Idempotency:** Deterministic keys (`comm_{commentId}`, `msg_{messageId}`) stored in database guarantee zero duplicate replies.
