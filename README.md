# InstaAutoDM ⚡

An automated Instagram DM and comment auto-reply SaaS built with Node.js, Express, React, Vite, and the Meta Instagram Graph API.

## Features

- ⚡ **DM Keyword Auto-Reply**: Responds to specific keywords in Instagram Direct Messages within Meta's 24-hour messaging window.
- 💬 **Comment-to-DM Automation**: Automatically triggers private DMs and public replies when users comment trigger words on posts and reels.
- 📬 **Live Conversations Inbox**: Real-time thread tracking with two-way messaging, manual reply capability, and message delivery status.
- 📊 **Analytics & Rules Dashboard**: Create, toggle, and monitor rules with usage caps and follower engagement metrics.
- 🔒 **Meta Compliant**: HMAC-SHA256 signature verification, AES-256 token encryption, rate-limiting, and error-handling.

## Architecture

- **Backend**: Node.js, Express, Better-SQLite3, Meta Graph API v21.0
- **Frontend**: React 18, Vite, Lucide Icons, Vanilla CSS design system
- **Deployment**:
  - Backend: [Render](https://render.com) (configured via `render.yaml`)
  - Frontend: [Netlify](https://netlify.com) (configured via `netlify.toml`)

## Local Development

### Prerequisites

- Node.js 18+
- Meta Developer App with Instagram Graph API permissions

### Installation

1. Clone repository:
   ```bash
   git clone https://github.com/sumitbhardwajcs23/InstaAutoDM.git
   cd InstaAutoDM
   ```

2. Install dependencies:
   ```bash
   # Backend
   cd backend && npm install

   # Frontend
   cd ../frontend && npm install
   ```

3. Configure Environment Variables in `.env`:
   ```env
   PORT=3000
   NODE_ENV=development
   ENCRYPTION_KEY=your_32_character_encryption_key
   JWT_SECRET=your_jwt_secret_key
   META_APP_ID=your_meta_app_id
   META_APP_SECRET=your_meta_app_secret
   META_VERIFY_TOKEN=your_verify_token
   META_REDIRECT_URI=http://localhost:3000/api/instagram/oauth/callback
   ```

4. Run locally:
   ```bash
   # Terminal 1 (Backend)
   cd backend && npm run dev

   # Terminal 2 (Frontend)
   cd frontend && npm run dev
   ```

## Production Deployment

### Backend on Render
- Use the provided `render.yaml` or create a Web Service pointing to `backend/`.
- Build Command: `cd backend && npm install`
- Start Command: `cd backend && node src/server.js`

### Frontend on Netlify
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `frontend/dist`
- Environment variable: `VITE_API_URL=https://<your-render-url>.onrender.com`
