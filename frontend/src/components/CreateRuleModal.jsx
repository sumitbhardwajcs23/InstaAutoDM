// frontend/src/components/CreateRuleModal.jsx
import React, { useState } from 'react';
import { X, Zap, Send, MessageCircle, Info } from 'lucide-react';
import { apiFetch } from '../api/client';

export default function CreateRuleModal({ isOpen, onClose, onRuleCreated }) {
  const [name, setName] = useState('');
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [actionType, setActionType] = useState('dm');
  const [replyText, setReplyText] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          trigger_keyword: triggerKeyword.trim(),
          type: actionType === 'comment' ? 'comment_to_dm' : 'dm_keyword_reply',
          action_type: actionType,
          reply_message: replyText.trim(),
          reply_text: replyText.trim(),
          is_active: isActive ? 1 : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to create rule');
      }

      onRuleCreated(data.rule || data);
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
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Zap size={18} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Create Automation Rule
            </h2>
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          {/* Rule Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              Rule Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Price Inquiry Auto DM"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-subtle)',
                fontSize: '13.5px',
                outline: 'none',
              }}
            />
          </div>

          {/* Action Type */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              Action Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setActionType('dm')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1.5px solid',
                  borderColor: actionType === 'dm' ? 'var(--primary)' : 'var(--border-subtle)',
                  background: actionType === 'dm' ? 'var(--primary-light)' : 'transparent',
                  color: actionType === 'dm' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <Send size={15} /> Send DM
              </button>

              <button
                type="button"
                onClick={() => setActionType('comment')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1.5px solid',
                  borderColor: actionType === 'comment' ? 'var(--primary)' : 'var(--border-subtle)',
                  background: actionType === 'comment' ? 'var(--primary-light)' : 'transparent',
                  color: actionType === 'comment' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <MessageCircle size={15} /> Reply to Comment
              </button>
            </div>
          </div>

          {/* Trigger Keyword */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              Trigger Keywords (comma separated)
            </label>
            <input
              type="text"
              value={triggerKeyword}
              onChange={(e) => setTriggerKeyword(e.target.value)}
              placeholder="e.g. price, cost, buy (leave blank for any message)"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-subtle)',
                fontSize: '13.5px',
                outline: 'none',
              }}
            />
          </div>

          {/* Reply Text */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              Automated Reply Message
            </label>
            <textarea
              required
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
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
              Use <code>{'{username}'}</code> to dynamically greet the person by their Instagram handle.
            </span>
          </div>

          {/* Active Switch */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Enable Immediately</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Start auto-replying as soon as created</div>
            </div>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
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
              {loading ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
