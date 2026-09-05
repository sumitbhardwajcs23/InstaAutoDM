// backend/src/routes/analytics.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/analytics/activity?days=30
router.get('/activity', (req, res) => {
  const days = Math.min(90, parseInt(req.query.days || '30', 10));
  const account = db.prepare("SELECT id FROM instagram_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1").get(req.user.id);
  if (!account) return res.json({ labels: [], dmsSent: [], commentsReplied: [] });

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
