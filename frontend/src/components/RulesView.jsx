// frontend/src/components/RulesView.jsx
import React, { useState } from 'react';
import { Zap, Plus, Search, Filter, Trash2, Edit3, Send, MessageCircle, Check } from 'lucide-react';

export default function RulesView({ rules = [], onOpenCreateRule, onToggleRule, onDeleteRule }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const filteredRules = rules.filter((r) => {
    const reply = r.reply_text || r.reply_message || '';
    const isDm = r.action_type === 'dm' || r.type === 'dm_keyword_reply';
    const isComment = r.action_type === 'comment' || r.type === 'comment_to_dm';

    const matchesSearch =
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.trigger_keyword?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reply.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'dm' && isDm) ||
      (filterType === 'comment' && isComment);

    return matchesSearch && matchesFilter;
  });

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Automation Rules
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
            Configure automatic replies triggered by Instagram comments and direct messages.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateRule}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            background: 'var(--primary-gradient)',
            color: '#fff',
            border: 'none',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          }}
        >
          <Plus size={16} />
          <span>Create New Rule</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
        padding: '14px 18px',
        borderRadius: '14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '320px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-light)',
            }}
          />
          <input
            type="text"
            placeholder="Search rules or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-subtle)',
              fontSize: '13px',
              color: 'var(--text-main)',
              outline: 'none',
            }}
          />
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'all', label: 'All Rules' },
            { id: 'dm', label: 'Direct Messages' },
            { id: 'comment', label: 'Comments' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: filterType === tab.id ? 'var(--primary)' : 'var(--border-subtle)',
                background: filterType === tab.id ? 'var(--primary-light)' : 'transparent',
                color: filterType === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredRules.length === 0 ? (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px dashed var(--border-subtle)',
          }}>
            <Zap size={36} color="var(--text-light)" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>No rules found</div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Create your first automation rule to begin replying to your audience instantly.
            </p>
            <button
              type="button"
              onClick={onOpenCreateRule}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Create Rule
            </button>
          </div>
        ) : (
          filteredRules.map((rule) => {
            const isDm = rule.action_type === 'dm' || rule.type === 'dm_keyword_reply';
            const reply = rule.reply_text || rule.reply_message || '';
            const actionLabel = isDm ? 'DM' : 'Comment';

            return (
              <div
                key={rule.id}
                style={{
                  padding: '18px 20px',
                  borderRadius: '14px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: isDm ? '#eff6ff' : '#fdf2f8',
                    color: isDm ? '#3b82f6' : '#ec4899',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isDm ? <Send size={18} /> : <MessageCircle size={18} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {rule.name || `${rule.trigger_keyword} Auto Reply`}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'var(--bg-subtle)',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}>
                        {actionLabel}
                      </span>
                    </div>

                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <strong>Keywords:</strong>{' '}
                      <span style={{
                        background: 'var(--bg-subtle)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      }}>
                        {rule.trigger_keyword || '(Any message)'}
                      </span>
                    </div>

                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-light)',
                      marginTop: '4px',
                      fontStyle: 'italic',
                      maxWidth: '540px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      "{reply}"
                    </div>
                  </div>
                </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Active Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: rule.is_active ? '#059669' : 'var(--text-light)', fontWeight: 600 }}>
                    {rule.is_active ? 'Active' : 'Paused'}
                  </span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!rule.is_active}
                      onChange={() => onToggleRule(rule.id, !rule.is_active)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: rule.is_active ? 'var(--primary)' : '#cbd5e1',
                      borderRadius: '20px',
                      transition: '0.2s',
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '14px',
                        width: '14px',
                        left: rule.is_active ? '20px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: '0.2s',
                      }} />
                    </span>
                  </label>
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => onDeleteRule(rule.id)}
                  style={{
                    border: 'none',
                    background: 'var(--bg-subtle)',
                    color: '#ef4444',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title="Delete Rule"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
