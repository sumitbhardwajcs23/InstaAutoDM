import React, { useState } from 'react';
import { Zap, Plus, Search, Trash2, Edit3, Send, MessageCircle, Layers, Check, Film, Clock, Lock } from 'lucide-react';

export default function RulesView({ 
  rules = [], 
  onOpenCreateRule, 
  onEditRule, 
  onToggleRule, 
  onDeleteRule 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const filteredRules = rules.filter((r) => {
    const isStory = r.action_type === 'story' || r.type === 'story_reply';
    const isDm = r.action_type === 'dm' || r.type === 'dm_keyword_reply';
    const isComment = r.action_type === 'comment' || r.type === 'comment_to_dm';
    const allText = `${r.name || ''} ${r.trigger_keyword || ''} ${r.reply_message || ''} ${r.reply_text || ''} ${r.comment_reply_message || ''} ${r.dm_reply_message || ''} ${r.target_media_caption || ''}`.toLowerCase();

    const matchesSearch = allText.includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'story' && isStory) ||
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
            Configure automatic public replies on Instagram comments and private direct messages.
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
            { id: 'comment', label: 'Comment Triggers' },
            { id: 'story', label: 'Story Replies' },
            { id: 'dm', label: 'Direct Messages' },
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
            const isStory = rule.type === 'story_reply' || rule.action_type === 'story';
            const isDm = !isStory && (rule.action_type === 'dm' || rule.type === 'dm_keyword_reply');
            const mode = rule.comment_reply_mode || 'both';

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
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: '280px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: isStory ? '#fdf2f8' : (isDm ? '#eff6ff' : '#fdf2f8'),
                    color: isStory ? '#ec4899' : (isDm ? '#3b82f6' : '#8b5cf6'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}>
                    {isStory ? <Clock size={19} /> : (isDm ? <Send size={19} /> : <MessageCircle size={19} />)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {rule.name || `${rule.trigger_keyword} Auto Reply`}
                      </span>

                      {/* Mode Badge */}
                      {isStory ? (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#fdf2f8',
                          color: '#db2777',
                          border: '1px solid #fbcfe8',
                        }}>
                          ⏳ Story Reply Trigger
                        </span>
                      ) : !isDm ? (
                        mode === 'both' ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: '#f5f3ff',
                            color: '#7c3aed',
                            border: '1px solid #ddd6fe',
                          }}>
                            🚀 Both (Comment + DM)
                          </span>
                        ) : mode === 'comment_only' ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: '#fdf2f8',
                            color: '#db2777',
                            border: '1px solid #fbcfe8',
                          }}>
                            💬 Public Comment Only
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                          }}>
                            ✉️ DM Only
                          </span>
                        )
                      ) : (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                        }}>
                          ✉️ Inbound DM Reply
                        </span>
                      )}

                      {/* Target Media Badge */}
                      {rule.target_media_id && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(99, 102, 241, 0.1)',
                          color: '#6366f1',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Film size={11} />
                          {rule.target_media_type === 'reel' ? '🎬 Specific Reel' : (rule.target_media_type === 'story' ? '⏳ Specific Story' : '📸 Specific Post')}
                        </span>
                      )}

                      {/* Follower Check Badge */}
                      {Boolean(rule.require_follow) && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: '#f0fdf4',
                          color: '#16a34a',
                          border: '1px solid #bbf7d0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Lock size={11} />
                          Follow-to-Unlock
                        </span>
                      )}

                      {rule.fire_count !== undefined && rule.fire_count > 0 && (
                        <span style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-subtle)',
                          padding: '2px 7px',
                          borderRadius: '5px',
                        }}>
                          Fired {rule.fire_count}x
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      <strong>Keyword:</strong>{' '}
                      <span style={{
                        background: 'var(--bg-subtle)',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {rule.trigger_keyword || '(Any message)'}
                      </span>
                      <span style={{ marginLeft: '8px', fontSize: '11.5px', color: 'var(--text-light)' }}>
                        ({rule.match_mode || 'contains'})
                      </span>
                    </div>

                    {/* Messages Details */}
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {/* Follow Prompt Preview */}
                      {Boolean(rule.require_follow) && (
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-main)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          background: '#f8fafc',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: 700, 
                              color: '#16a34a', 
                              background: '#f0fdf4', 
                              padding: '1px 5px', 
                              borderRadius: '4px',
                              border: '1px solid #bbf7d0'
                            }}>
                              🔒 Follow Gate:
                            </span>
                            <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                              "{rule.follow_prompt_message || 'Hey {username}! Please follow @ourpage first to get your access link! Tap "✅ I\'ve Followed" below once done 🚀'}"
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>Interactive Buttons:</span>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              padding: '1px 7px',
                              borderRadius: '10px',
                              color: '#334155'
                            }}>
                              👉 Follow Profile
                            </span>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              background: '#ecfdf5',
                              border: '1px solid #a7f3d0',
                              padding: '1px 7px',
                              borderRadius: '10px',
                              color: '#059669'
                            }}>
                              ✅ I've Followed
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Comment Reply Preview */}
                      {!isDm && (mode === 'both' || mode === 'comment_only') && rule.comment_reply_message && (
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '6px',
                        }}>
                          <span style={{ 
                            fontSize: '10.5px', 
                            fontWeight: 700, 
                            color: '#db2777', 
                            background: '#fdf2f8', 
                            padding: '1px 5px', 
                            borderRadius: '4px' 
                          }}>
                            💬 Public:
                          </span>
                          <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                            "{rule.comment_reply_message}"
                          </span>
                        </div>
                      )}

                      {/* DM Preview */}
                      {((!isDm && (mode === 'both' || mode === 'dm_only')) || isDm) && (rule.dm_reply_message || rule.reply_text || rule.reply_message) && (
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '6px',
                        }}>
                          <span style={{ 
                            fontSize: '10.5px', 
                            fontWeight: 700, 
                            color: '#2563eb', 
                            background: '#eff6ff', 
                            padding: '1px 5px', 
                            borderRadius: '4px' 
                          }}>
                            ✉️ DM:
                          </span>
                          <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                            "{rule.dm_reply_message || rule.reply_text || rule.reply_message}"
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', alignSelf: 'center' }}>
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

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => onEditRule && onEditRule(rule)}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-main)',
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Edit Rule"
                  >
                    <Edit3 size={15} />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => onDeleteRule(rule.id)}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-subtle)',
                      color: '#ef4444',
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
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
