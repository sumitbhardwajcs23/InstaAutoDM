// backend/src/routes/rules.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

async function getAccountForUser(userId, accountId) {
  if (!userId) return null;
  if (accountId) {
    return await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND id = ? LIMIT 1").get(userId, accountId);
  }
  return await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' ORDER BY updated_at DESC LIMIT 1").get(userId);
}

router.get('/', async (req, res) => {
  const account = await getAccountForUser(req.user.id, req.query.account_id);
  if (!account) return res.json({ rules: [], count: 0 });
  const rows = await db.prepare('SELECT * FROM automation_rules WHERE instagram_account_id = ? ORDER BY created_at DESC').all(account.id);
  const rules = rows.map(r => ({
    ...r,
    is_active: Boolean(r.is_active),
    action_type: r.type === 'comment_to_dm' ? 'comment' : 'dm',
    reply_text: r.dm_reply_message || r.reply_message,
    comment_reply_mode: r.comment_reply_mode || 'both',
    comment_reply_message: r.comment_reply_message || '',
    dm_reply_message: r.dm_reply_message || r.reply_message || '',
    name: r.trigger_keyword ? `${r.trigger_keyword} Auto Reply` : 'Auto Reply Rule'
  }));
  res.json({ rules, count: rules.length });
});

router.post('/', async (req, res) => {
  const type = req.body.type || (req.body.action_type === 'comment' ? 'comment_to_dm' : 'dm_keyword_reply');
  const trigger_keyword = req.body.trigger_keyword || req.body.keyword || req.body.trigger;
  const match_mode = req.body.match_mode || 'contains';
  const is_active = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : 1;

  const comment_reply_mode = req.body.comment_reply_mode || (type === 'comment_to_dm' ? 'both' : null);
  const comment_reply_message = req.body.comment_reply_message ? req.body.comment_reply_message.trim() : null;
  const dm_reply_message = (req.body.dm_reply_message || req.body.reply_message || req.body.reply_text || '').trim() || null;
  const reply_message = dm_reply_message || comment_reply_message || (req.body.reply_message || req.body.reply_text || '').trim();

  if (!trigger_keyword) {
    return res.status(400).json({ error: 'Missing required field: trigger keyword' });
  }

  if (type === 'comment_to_dm') {
    if (comment_reply_mode === 'comment_only' && !comment_reply_message) {
      return res.status(400).json({ error: 'Public comment reply message is required for Comment Only mode' });
    }
    if (comment_reply_mode === 'dm_only' && !dm_reply_message) {
      return res.status(400).json({ error: 'Direct message reply is required for DM Only mode' });
    }
    if (comment_reply_mode === 'both' && !comment_reply_message && !dm_reply_message) {
      return res.status(400).json({ error: 'Please provide at least a public comment reply or DM reply' });
    }
  } else {
    if (!reply_message) {
      return res.status(400).json({ error: 'Reply message is required' });
    }
  }

  if (!['comment_to_dm', 'dm_keyword_reply'].includes(type)) {
    return res.status(400).json({ error: 'Invalid trigger type. Must be comment_to_dm or dm_keyword_reply' });
  }
  const account = await getAccountForUser(req.user.id, req.body.account_id || req.query.account_id);
  if (!account) return res.status(400).json({ error: 'No Instagram account connected' });

  const id = uuidv4();
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO automation_rules (
      id, instagram_account_id, type, trigger_keyword, match_mode, 
      reply_message, comment_reply_mode, comment_reply_message, dm_reply_message,
      is_active, fire_count, created_at, updated_at
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id, 
    account.id, 
    type, 
    trigger_keyword.trim().toUpperCase(), 
    match_mode, 
    reply_message, 
    comment_reply_mode, 
    comment_reply_message, 
    dm_reply_message, 
    is_active, 
    now, 
    now
  );

  const rule = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id);
  const formatted = { 
    ...rule, 
    is_active: Boolean(rule?.is_active),
    action_type: rule?.type === 'comment_to_dm' ? 'comment' : 'dm',
    reply_text: rule?.dm_reply_message || rule?.reply_message,
    comment_reply_mode: rule?.comment_reply_mode || 'both',
    comment_reply_message: rule?.comment_reply_message || '',
    dm_reply_message: rule?.dm_reply_message || rule?.reply_message || '',
    name: rule?.trigger_keyword ? `${rule.trigger_keyword} Auto Reply` : 'Auto Reply Rule'
  };
  res.status(201).json({ success: true, rule: formatted, id: formatted.id, ...formatted });
});

// Security: verify rule belongs to any of user's connected accounts before mutating
async function requireRuleOwner(req, res, next) {
  try {
    const rule = await db.prepare(`
      SELECT r.*, a.id as instagram_account_id, a.user_id 
      FROM automation_rules r 
      JOIN instagram_accounts a ON r.instagram_account_id = a.id 
      WHERE r.id = ? AND a.user_id = ?
    `).get(req.params.id, req.user.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    req.rule = rule;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.patch('/:id/toggle', requireRuleOwner, async (req, res) => {
  const newStatus = req.rule.is_active ? 0 : 1;
  await db.prepare("UPDATE automation_rules SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, req.params.id);
  const updated = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(req.params.id);
  res.json({ success: true, rule: { ...updated, is_active: Boolean(updated?.is_active) } });
});

router.put('/:id', requireRuleOwner, async (req, res) => {
  const { 
    trigger_keyword, match_mode, reply_message, reply_text,
    comment_reply_mode, comment_reply_message, dm_reply_message, is_active 
  } = req.body;
  const finalDmReply = dm_reply_message !== undefined ? dm_reply_message : (reply_message !== undefined ? reply_message : (reply_text !== undefined ? reply_text : null));
  const finalCommentReply = comment_reply_message !== undefined ? comment_reply_message : null;
  const finalLegacyReply = finalDmReply || finalCommentReply || null;

  await db.prepare(`
    UPDATE automation_rules SET
      trigger_keyword = COALESCE(?, trigger_keyword),
      match_mode = COALESCE(?, match_mode),
      reply_message = COALESCE(?, reply_message),
      comment_reply_mode = COALESCE(?, comment_reply_mode),
      comment_reply_message = COALESCE(?, comment_reply_message),
      dm_reply_message = COALESCE(?, dm_reply_message),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    trigger_keyword ? trigger_keyword.trim().toUpperCase() : null,
    match_mode ?? null,
    finalLegacyReply ? finalLegacyReply.trim() : null,
    comment_reply_mode ?? null,
    finalCommentReply ? finalCommentReply.trim() : null,
    finalDmReply ? finalDmReply.trim() : null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    req.params.id
  );
  const updated = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(req.params.id);
  const formatted = {
    ...updated,
    is_active: Boolean(updated?.is_active),
    action_type: updated?.type === 'comment_to_dm' ? 'comment' : 'dm',
    reply_text: updated?.dm_reply_message || updated?.reply_message,
    comment_reply_mode: updated?.comment_reply_mode || 'both',
    comment_reply_message: updated?.comment_reply_message || '',
    dm_reply_message: updated?.dm_reply_message || updated?.reply_message || '',
    name: updated?.trigger_keyword ? `${updated.trigger_keyword} Auto Reply` : 'Auto Reply Rule'
  };
  res.json({ success: true, rule: formatted });
});

router.patch('/:id', requireRuleOwner, async (req, res) => {
  const { 
    trigger_keyword, match_mode, reply_message, reply_text,
    comment_reply_mode, comment_reply_message, dm_reply_message, is_active 
  } = req.body;
  const finalDmReply = dm_reply_message !== undefined ? dm_reply_message : (reply_message !== undefined ? reply_message : (reply_text !== undefined ? reply_text : null));
  const finalCommentReply = comment_reply_message !== undefined ? comment_reply_message : null;
  const finalLegacyReply = finalDmReply || finalCommentReply || null;

  await db.prepare(`
    UPDATE automation_rules SET
      trigger_keyword = COALESCE(?, trigger_keyword),
      match_mode = COALESCE(?, match_mode),
      reply_message = COALESCE(?, reply_message),
      comment_reply_mode = COALESCE(?, comment_reply_mode),
      comment_reply_message = COALESCE(?, comment_reply_message),
      dm_reply_message = COALESCE(?, dm_reply_message),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    trigger_keyword ? trigger_keyword.trim().toUpperCase() : null,
    match_mode ?? null,
    finalLegacyReply ? finalLegacyReply.trim() : null,
    comment_reply_mode ?? null,
    finalCommentReply ? finalCommentReply.trim() : null,
    finalDmReply ? finalDmReply.trim() : null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    req.params.id
  );
  const updated = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(req.params.id);
  const formatted = {
    ...updated,
    is_active: Boolean(updated?.is_active),
    action_type: updated?.type === 'comment_to_dm' ? 'comment' : 'dm',
    reply_text: updated?.dm_reply_message || updated?.reply_message,
    comment_reply_mode: updated?.comment_reply_mode || 'both',
    comment_reply_message: updated?.comment_reply_message || '',
    dm_reply_message: updated?.dm_reply_message || updated?.reply_message || '',
    name: updated?.trigger_keyword ? `${updated.trigger_keyword} Auto Reply` : 'Auto Reply Rule'
  };
  res.json({ success: true, rule: formatted });
});

router.delete('/:id', requireRuleOwner, async (req, res) => {
  await db.prepare('DELETE FROM automation_rules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
