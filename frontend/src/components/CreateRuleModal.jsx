// frontend/src/components/CreateRuleModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Zap, Send, MessageCircle, MessageSquare, Sparkles, Check, Layers } from 'lucide-react';
import { apiFetch } from '../api/client';

export default function CreateRuleModal({ 
  isOpen, 
  onClose, 
  onRuleCreated, 
  onRuleUpdated, 
  ruleToEdit = null, 
  accountId 
}) {
  const [name, setName] = useState('');
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [matchMode, setMatchMode] = useState('contains');
  const [actionType, setActionType] = useState('comment'); // 'comment' or 'dm'
  const [commentReplyMode, setCommentReplyMode] = useState('both'); // 'both', 'dm_only', 'comment_only'
  const [commentReplyMessage, setCommentReplyMessage] = useState('Check your DM! 🚀');
  const [dmReplyMessage, setDmReplyMessage] = useState('Hey {username}! Thanks for your comment. Here is what you requested: https://');
  const [dmText, setDmText] = useState('Hey {username}! Thanks for reaching out. How can I help you today?');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync state whenever modal opens or ruleToEdit changes
  useEffect(() => {
    if (ruleToEdit) {
      setName(ruleToEdit.name || (ruleToEdit.trigger_keyword ? `${ruleToEdit.trigger_keyword} Auto Reply` : ''));
      setTriggerKeyword(ruleToEdit.trigger_keyword || '');
      setMatchMode(ruleToEdit.match_mode || 'contains');
      
      const isComment = ruleToEdit.action_type === 'comment' || ruleToEdit.type === 'comment_to_dm';
      setActionType(isComment ? 'comment' : 'dm');
      setCommentReplyMode(ruleToEdit.comment_reply_mode || 'both');
      setCommentReplyMessage(ruleToEdit.comment_reply_message || 'Check your DM! 🚀');
      
      const existingDm = ruleToEdit.dm_reply_message || ruleToEdit.reply_text || ruleToEdit.reply_message || '';
      if (isComment) {
        setDmReplyMessage(existingDm || 'Hey {username}! Thanks for your comment. Here is what you requested: https://');
      } else {
        setDmText(existingDm || 'Hey {username}! Thanks for reaching out. How can I help you today?');
      }
      setIsActive(ruleToEdit.is_active !== undefined ? Boolean(ruleToEdit.is_active) : true);
    } else {
      setName('');
      setTriggerKeyword('');
      setMatchMode('contains');
      setActionType('comment');
      setCommentReplyMode('both');
      setCommentReplyMessage('Check your DM! 🚀');
      setDmReplyMessage('Hey {username}! Thanks for your comment. Here is what you requested: https://');
      setDmText('Hey {username}! Thanks for reaching out. How can I help you today?');
      setIsActive(true);
    }
    setError(null);
  }, [ruleToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isComment = actionType === 'comment';
    const finalDmReply = isComment ? dmReplyMessage.trim() : dmText.trim();
    const finalCommentReply = isComment ? commentReplyMessage.trim() : '';

    // Validation
    if (!triggerKeyword.trim()) {
      setError('Trigger keyword is required');
      setLoading(false);
      return;
    }

    if (isComment) {
      if (commentReplyMode === 'comment_only' && !finalCommentReply) {
        setError('Please enter a public comment reply message');
        setLoading(false);
        return;
      }
      if (commentReplyMode === 'dm_only' && !finalDmReply) {
        setError('Please enter a private DM message');
        setLoading(false);
        return;
      }
      if (commentReplyMode === 'both' && !finalCommentReply && !finalDmReply) {
        setError('Please provide at least a public comment reply or a private DM message');
        setLoading(false);
        return;
      }
    } else {
      if (!finalDmReply) {
        setError('Please enter an automated DM reply message');
        setLoading(false);
        return;
      }
    }

    const payload = {
      account_id: accountId,
      name: name.trim() || `${triggerKeyword.trim().toUpperCase()} Auto Reply`,
      trigger_keyword: triggerKeyword.trim(),
      match_mode: matchMode,
      type: isComment ? 'comment_to_dm' : 'dm_keyword_reply',
      action_type: actionType,
      comment_reply_mode: isComment ? commentReplyMode : null,
      comment_reply_message: isComment && (commentReplyMode === 'both' || commentReplyMode === 'comment_only') ? finalCommentReply : null,
      dm_reply_message: (!isComment || commentReplyMode === 'both' || commentReplyMode === 'dm_only') ? finalDmReply : null,
      reply_message: finalDmReply || finalCommentReply,
      reply_text: finalDmReply || finalCommentReply,
      is_active: isActive ? 1 : 0,
    };

    try {
      const url = ruleToEdit ? `/rules/${ruleToEdit.id}` : '/rules';
      const method = ruleToEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to save rule');
      }

      const savedRule = data.rule || data;
      if (ruleToEdit && onRuleUpdated) {
        onRuleUpdated(savedRule);
      } else if (onRuleCreated) {
        onRuleCreated(savedRule);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '92vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Zap size={19} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                {ruleToEdit ? 'Edit Automation Rule' : 'Create Automation Rule'}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Configure intelligent comment and DM replies
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'var(--bg-subtle)',
              color: 'var(--text-light)',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} style={{ 
          padding: '20px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          overflowY: 'auto'
        }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: 500,
              border: '1px solid #fecaca',
            }}>
              {error}
            </div>
          )}

          {/* Trigger Event Type (Comment vs DM) */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
              Where does the trigger happen?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setActionType('comment')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px',
                  borderRadius: '10px',
                  border: '1.5px solid',
                  borderColor: actionType === 'comment' ? 'var(--primary)' : 'var(--border-subtle)',
                  background: actionType === 'comment' ? 'var(--primary-light)' : 'transparent',
                  color: actionType === 'comment' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <MessageCircle size={16} /> Instagram Comment
              </button>

              <button
                type="button"
                onClick={() => setActionType('dm')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px',
                  borderRadius: '10px',
                  border: '1.5px solid',
                  borderColor: actionType === 'dm' ? 'var(--primary)' : 'var(--border-subtle)',
                  background: actionType === 'dm' ? 'var(--primary-light)' : 'transparent',
                  color: actionType === 'dm' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Send size={16} /> Direct Message (DM)
              </button>
            </div>
          </div>

          {/* Trigger Keyword and Match Mode */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                Trigger Keyword
              </label>
              <input
                type="text"
                required
                value={triggerKeyword}
                onChange={(e) => setTriggerKeyword(e.target.value)}
                placeholder="e.g. LINK, PRICE, GUIDE"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  outline: 'none',
                  textTransform: 'uppercase',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                Match Mode
              </label>
              <select
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle)',
                  fontSize: '13px',
                  color: 'var(--text-main)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="contains">Contains</option>
                <option value="exact">Exact Match</option>
              </select>
            </div>
          </div>

          {/* If Comment: Choose Comment Reply Mode */}
          {actionType === 'comment' && (
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-light)',
            }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontSize: '13px', 
                fontWeight: 700, 
                color: 'var(--text-main)', 
                marginBottom: '10px' 
              }}>
                <Layers size={15} color="var(--primary)" />
                What should happen when someone comments?
              </label>

              {/* 3 Action Mode Options */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'both', label: '🚀 Both (Comment + DM)', desc: 'Reply publicly & send link in DM' },
                  { id: 'comment_only', label: '💬 Comment Only', desc: 'Reply publicly on post only' },
                  { id: 'dm_only', label: '✉️ DM Only', desc: 'Send private DM only' },
                ].map((mode) => {
                  const isSelected = commentReplyMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setCommentReplyMode(mode.id)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: '1.5px solid',
                        borderColor: isSelected ? 'var(--primary)' : 'var(--border-subtle)',
                        background: isSelected ? 'var(--bg-card)' : 'transparent',
                        color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                        boxShadow: isSelected ? '0 2px 8px rgba(99,102,241,0.18)' : 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 700 }}>{mode.label}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{mode.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1. Public Comment Reply Field (Shown for comment rules with 'both' or 'comment_only') */}
          {actionType === 'comment' && (commentReplyMode === 'both' || commentReplyMode === 'comment_only') && (
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid #fbcfe8',
              background: '#fdf2f8',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#9d174d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageCircle size={15} />
                  Public Reply under Comment
                </label>
                <span style={{ fontSize: '11px', color: '#be185d' }}>Visible on Post</span>
              </div>
              <textarea
                required
                rows={2}
                value={commentReplyMessage}
                onChange={(e) => setCommentReplyMessage(e.target.value)}
                placeholder="Check your DM! 🚀"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #f472b6',
                  background: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                  color: '#1f2937',
                }}
              />
              {/* Quick Template Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {[
                  'Check your DM! 🚀',
                  'Sent you a DM! 📥',
                  'Check your inbox for details! ✨',
                  'Sent! Check your message request 📨',
                ].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setCommentReplyMessage(tpl)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #fbcfe8',
                      background: '#ffffff',
                      fontSize: '11px',
                      color: '#9d174d',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    "{tpl}"
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '11px', color: '#9d174d', marginTop: '6px', display: 'block' }}>
                Use <code>{'{username}'}</code> to mention their Instagram handle.
              </span>
            </div>
          )}

          {/* 2. Private DM Reply Field (Shown for comment rules with 'both' or 'dm_only') */}
          {actionType === 'comment' && (commentReplyMode === 'both' || commentReplyMode === 'dm_only') && (
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={15} />
                  Private Direct Message (DM)
                </label>
                <span style={{ fontSize: '11px', color: '#2563eb' }}>Sent to Inbox</span>
              </div>
              <textarea
                required
                rows={3}
                value={dmReplyMessage}
                onChange={(e) => setDmReplyMessage(e.target.value)}
                placeholder="Hey {username}! Here is the link you requested: https://..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #60a5fa',
                  background: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                  color: '#1f2937',
                }}
              />
              {/* Quick DM Template Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {[
                  'Hey {username}! Here is the download link 🚀',
                  'Thanks for commenting {username}! Here is your exclusive 20% discount code: SAVE20',
                  'Hey {username}! Here are the full details you asked for:',
                ].map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setDmReplyMessage(tpl)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      background: '#ffffff',
                      fontSize: '11px',
                      color: '#1e40af',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    "{tpl.slice(0, 32)}..."
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '11px', color: '#1e40af', marginTop: '6px', display: 'block' }}>
                Use <code>{'{username}'}</code> to personalize with the recipient's username.
              </span>
            </div>
          )}

          {/* DM-Only Trigger Form (when actionType === 'dm') */}
          {actionType === 'dm' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                Automated DM Reply Message
              </label>
              <textarea
                required
                rows={3}
                value={dmText}
                onChange={(e) => setDmText(e.target.value)}
                placeholder="Hey {username}! Thanks for reaching out..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle)',
                  fontSize: '13.5px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <span style={{ fontSize: '11.5px', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                Use <code>{'{username}'}</code> to dynamically greet the sender by handle.
              </span>
            </div>
          )}

          {/* Optional Rule Label */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Rule Label (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. ${triggerKeyword || 'PRICE'} Auto Campaign`}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-subtle)',
                fontSize: '12.5px',
                outline: 'none',
              }}
            />
          </div>

          {/* Active Switch */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Enable Rule Immediately</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Will respond to matching comments/DMs immediately</div>
            </div>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-main)',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--primary-gradient)',
                color: '#fff',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              }}
            >
              {loading ? 'Saving...' : (ruleToEdit ? 'Update Rule' : 'Save Rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
