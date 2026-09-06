// backend/src/routes/analytics.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/analytics/activity?days=30
router.get('/activity', (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90);
  const accountId = req.query.account_id;
  const account = accountId 
    ? (db.prepare("SELECT id FROM instagram_accounts WHERE (user_id = ? OR id = ?) LIMIT 1").get(req.user.id, accountId))
    : (db.prepare("SELECT id FROM instagram_accounts WHERE user_id = ? AND status = 'connected' ORDER BY updated_at DESC LIMIT 1").get(req.user.id)
       || db.prepare("SELECT id FROM instagram_accounts WHERE status = 'connected' ORDER BY updated_at DESC LIMIT 1").get()
       || db.prepare("SELECT id FROM instagram_accounts ORDER BY updated_at DESC LIMIT 1").get());
  if (!account) return res.json({ days, labels: [], dmsSent: [], commentsReplied: [], timeline: [], totals: { dms_sent: 0, comments_replied: 0 } });

  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }

  const activityMap = {};
  const rows = db.prepare(`
    SELECT event_date, dms_sent, comments_replied 
    FROM activity_log 
    WHERE instagram_account_id = ? AND event_date >= ?
    ORDER BY event_date ASC
  `).all(account.id, dates[0]);

  for (const row of rows) activityMap[row.event_date] = row;

  const labels = dates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const dmsSent = dates.map(d => activityMap[d]?.dms_sent || 0);
  const commentsReplied = dates.map(d => activityMap[d]?.comments_replied || 0);
  const timeline = dates.map((d, i) => ({ date: d, label: labels[i], dms_sent: dmsSent[i], comments_replied: commentsReplied[i] }));
  const totals = { dms_sent: dmsSent.reduce((a, b) => a + b, 0), comments_replied: commentsReplied.reduce((a, b) => a + b, 0) };

  res.json({ days, labels, dmsSent, commentsReplied, timeline, totals });
});

module.exports = router;
