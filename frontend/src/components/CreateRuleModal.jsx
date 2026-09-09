// frontend/src/components/CreateRuleModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Zap, 
  Send, 
  MessageCircle, 
  MessageSquare, 
  Sparkles, 
  Check, 
  Layers, 
  Film, 
  Clock, 
  HelpCircle,
  AlertCircle,
  UserCheck,
  Lock
} from 'lucide-react';
import { apiFetch } from '../api/client';

export default function CreateRuleModal({ 
  isOpen, 
  onClose, 
  onRuleCreated, 
  onRuleUpdated, 
  ruleToEdit = null, 
  accountId,
  preselectedMedia = null,
}) {
  const [name, setName] = useState('');
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [matchMode, setMatchMode] = useState('contains');
  const [actionType, setActionType] = useState('comment'); // 'comment' | 'story' | 'dm'
  const [targetMedia, setTargetMedia] = useState(null);

  const [commentReplyMode, setCommentReplyMode] = useState('both'); // 'both', 'dm_only', 'comment_only'
  const [commentReplyMessage, setCommentReplyMessage] = useState('Check your DM! 🚀 | Sent you the link! 📩');
  const [dmReplyMessage, setDmReplyMessage] = useState('Hey {username}! Thanks for your comment. Here is what you requested: https://');
  const [dmText, setDmText] = useState('Hey {username}! Thanks for reaching out. How can I help you today?');
  const [requireFollow, setRequireFollow] = useState(false);
  const [followPromptMessage, setFollowPromptMessage] = useState("Hey {username}! Please follow @ourpage first to get your access link! Tap \"✅ I've Followed\" below once done 🚀");
  const [followCommentReply, setFollowCommentReply] = useState("Almost there! Follow @ourpage and check your DMs to unlock 🚀");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (ruleToEdit) {
      setName(ruleToEdit.name || (ruleToEdit.trigger_keyword ? `${ruleToEdit.trigger_keyword} Auto Reply` : ''));
      setTriggerKeyword(ruleToEdit.trigger_keyword || '');
      setMatchMode(ruleToEdit.match_mode || 'contains');
      
      const isStory = ruleToEdit.type === 'story_reply' || ruleToEdit.action_type === 'story';
      const isComment = ruleToEdit.action_type === 'comment' || ruleToEdit.type === 'comment_to_dm';
      
      if (isStory) setActionType('story');
      else if (isComment) setActionType('comment');
      else setActionType('dm');

      setCommentReplyMode(ruleToEdit.comment_reply_mode || 'both');
      setCommentReplyMessage(ruleToEdit.comment_reply_message || 'Check your DM! 🚀 | Sent you the link! 📩');
      
      const existingDm = ruleToEdit.dm_reply_message || ruleToEdit.reply_text || ruleToEdit.reply_message || '';
      if (isComment || isStory) {
        setDmReplyMessage(existingDm || 'Hey {username}! Thanks for reaching out. Here is what you requested: https://');
      } else {
        setDmText(existingDm || 'Hey {username}! Thanks for reaching out. How can I help you today?');
      }

      setRequireFollow(Boolean(ruleToEdit.require_follow));
      setFollowPromptMessage(ruleToEdit.follow_prompt_message || "Hey {username}! Please follow @ourpage first to get your access link! Tap \"✅ I've Followed\" below once done 🚀");
      setFollowCommentReply(ruleToEdit.follow_comment_reply || "Almost there! Follow @ourpage and check your DMs to unlock 🚀");

      if (ruleToEdit.target_media_id) {
        setTargetMedia({
          id: ruleToEdit.target_media_id,
          type: ruleToEdit.target_media_type || 'reel',
          thumbnail: ruleToEdit.target_media_thumbnail || null,
          caption: ruleToEdit.target_media_caption || null,
        });
      } else {
        setTargetMedia(null);
      }

      setIsActive(ruleToEdit.is_active !== undefined ? Boolean(ruleToEdit.is_active) : true);
    } else if (preselectedMedia) {
      // Triggered from clicking "Automate this Reel" in MediaView
      const isReel = preselectedMedia.media_product_type === 'REELS' || preselectedMedia.media_type === 'VIDEO';
      const isStory = preselectedMedia.media_product_type === 'STORY';
      
      if (isStory) {
        setActionType('story');
        setTriggerKeyword('HI');
        setDmReplyMessage('Hey {username}! Thanks for replying to my story! Here is your access link: https://');
      } else {
        setActionType('comment');
        setCommentReplyMode('both');
        setCommentReplyMessage('Check your DM! 🚀 | Sent you the link in inbox! 📩');
        setDmReplyMessage('Hey {username}! Thanks for your comment on my Reel. Here is the link you wanted: https://');

        // Extract potential keyword from caption (e.g. comment "LINK" or 'PRICE')
        const caption = preselectedMedia.caption || '';
        const match = caption.match(/comment\s+["']?([A-Z0-9_]+)["']?/i);
        if (match && match[1]) {
          setTriggerKeyword(match[1].toUpperCase());
        } else {
          setTriggerKeyword('LINK');
        }
      }

      setRequireFollow(false);
      setFollowPromptMessage("Hey {username}! Please follow @ourpage first to get your access link! Tap \"✅ I've Followed\" below once done 🚀");
      setFollowCommentReply("Almost there! Follow @ourpage and check your DMs to unlock 🚀");

      setTargetMedia({
        id: preselectedMedia.id,
        type: isReel ? 'reel' : (isStory ? 'story' : 'post'),
        thumbnail: preselectedMedia.thumbnail_url || preselectedMedia.media_url,
        caption: preselectedMedia.caption || null,
      });

      setName(isReel ? `Reel Auto Reply (#${preselectedMedia.id.slice(-4)})` : 'Content Auto Reply');
      setMatchMode('contains');
      setIsActive(true);
    } else {
      // Clean default
      setName('');
      setTriggerKeyword('');
      setMatchMode('contains');
      setActionType('comment');
      setTargetMedia(null);
      setCommentReplyMode('both');
      setCommentReplyMessage('Check your DM! 🚀 | Sent you the link! 📩');
      setDmReplyMessage('Hey {username}! Thanks for your comment. Here is what you requested: https://');
      setDmText('Hey {username}! Thanks for reaching out. How can I help you today?');
      setRequireFollow(false);
      setFollowPromptMessage("Hey {username}! Please follow @ourpage first to get your access link! Tap \"✅ I've Followed\" below once done 🚀");
      setFollowCommentReply("Almost there! Follow @ourpage and check your DMs to unlock 🚀");
      setIsActive(true);
    }
    setError(null);
  }, [ruleToEdit, preselectedMedia, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isComment = actionType === 'comment';
    const isStory = actionType === 'story';
    const finalDmReply = isComment || isStory ? dmReplyMessage.trim() : dmText.trim();
    const finalCommentReply = isComment ? commentReplyMessage.trim() : '';

    // Validation
    if (!triggerKeyword.trim()) {
      setError('Trigger keyword is required. (Use "*" for any message or comment)');
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

    const ruleType = isStory ? 'story_reply' : (isComment ? 'comment_to_dm' : 'dm_keyword_reply');

    const payload = {
      account_id: accountId,
      name: name.trim() || `${triggerKeyword.trim().toUpperCase()} Auto Reply`,
      trigger_keyword: triggerKeyword.trim(),
      match_mode: matchMode,
      type: ruleType,
      action_type: actionType,
      comment_reply_mode: isComment ? commentReplyMode : null,
      comment_reply_message: isComment && (commentReplyMode === 'both' || commentReplyMode === 'comment_only') ? finalCommentReply : null,
      dm_reply_message: (!isComment || commentReplyMode === 'both' || commentReplyMode === 'dm_only') ? finalDmReply : null,
      reply_message: finalDmReply || finalCommentReply,
      reply_text: finalDmReply || finalCommentReply,
      target_media_id: targetMedia ? targetMedia.id : null,
      target_media_type: targetMedia ? targetMedia.type : (isStory ? 'story' : 'all'),
      target_media_thumbnail: targetMedia ? targetMedia.thumbnail : null,
      target_media_caption: targetMedia ? targetMedia.caption : null,
      require_follow: isComment && requireFollow ? 1 : 0,
      follow_prompt_message: isComment && requireFollow ? followPromptMessage.trim() : null,
      follow_comment_reply: isComment && requireFollow ? followCommentReply.trim() : null,
      is_active: isActive ? 1 : 0,
    };
    const isEditingExisting = Boolean(ruleToEdit && ruleToEdit.id && !ruleToEdit.isTemplate);

    try {
      const url = isEditingExisting ? `/rules/${ruleToEdit.id}` : '/rules';
      const method = isEditingExisting ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to save rule');
      }

      const savedRule = data.rule || data;
      if (isEditingExisting && onRuleUpdated) {
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
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
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
        maxWidth: '580px',
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
                {ruleToEdit && !ruleToEdit.isTemplate ? 'Edit Automation Rule' : (ruleToEdit?.isTemplate ? 'Create Rule from Template' : (targetMedia ? 'Automate Specific Content' : 'Create Automation Rule'))}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {targetMedia ? `Targeting specific ${targetMedia.type === 'reel' ? 'Reel' : (targetMedia.type === 'story' ? 'Story' : 'Post')}` : 'Automate Reel comments, Story replies & DMs'}
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
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Target Media Banner (if attached to specific media) */}
          {targetMedia ? (
            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.08))',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              {targetMedia.thumbnail && (
                <img 
                  src={targetMedia.thumbnail} 
                  alt="Target preview" 
                  style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#6366f1',
                    color: '#fff'
                  }}>
                    {targetMedia.type === 'reel' ? '🎬 Specific Reel' : (targetMedia.type === 'story' ? '⏳ Specific Story' : '📸 Specific Post')}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ID: {targetMedia.id?.slice(-8)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {targetMedia.caption || 'No caption'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTargetMedia(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Apply to All Content
              </button>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-light)',
              fontSize: '12px',
              color: 'var(--text-muted)'
            }}>
              <span>🎯 <b>Scope:</b> Global (triggers on all Reels & Posts)</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Tip: Use Media Hub to target a specific Reel</span>
            </div>
          )}

          {/* Trigger Event Type Tabs */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
              Select Trigger Type:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setActionType('comment')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '10px 8px',
                  borderRadius: '10px',
                  border: '1.5px solid',
                  borderColor: actionType === 'comment' ? 'var(--primary)' : 'var(--border-subtle)',
                  background: actionType === 'comment' ? 'var(--primary-light)' : 'transparent',
                  color: actionType === 'comment' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <MessageCircle size={18} />
                <span>Reel / Post Comment</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType('story')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '10px 8px',
                  borderRadius: '10px',
                  border: '1.5px solid',
                  borderColor: actionType === 'story' ? '#ec4899' : 'var(--border-subtle)',
                  background: actionType === 'story' ? 'rgba(236, 72, 153, 0.12)' : 'transparent',
                  color: actionType === 'story' ? '#ec4899' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <Clock size={18} />
                <span>Story Reply / Mention</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType('dm')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '10px 8px',
                  borderRadius: '10px',
                  border: '1.5px solid',
                  borderColor: actionType === 'dm' ? '#06b6d4' : 'var(--border-subtle)',
                  background: actionType === 'dm' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                  color: actionType === 'dm' ? '#06b6d4' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                <Send size={18} />
                <span>Direct Message (DM)</span>
              </button>
            </div>
          </div>

          {/* Trigger Keyword and Match Mode */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Trigger Keyword(s)
                </label>
                <input
                  type="text"
                  required
                  value={triggerKeyword}
                  onChange={(e) => setTriggerKeyword(e.target.value)}
                  placeholder="e.g. LINK, PRICE, HI, HELLO, *"
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
                  <option value="contains">Contains Keyword</option>
                  <option value="exact">Exact Match</option>
                  <option value="starts_with">Starts With</option>
                </select>
              </div>
            </div>

            {/* Keyword Preset Helpers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Quick Keywords:</span>
              {['LINK', 'PRICE', 'HI', 'HELLO', '* (Any)'].map(kw => {
                const val = kw.startsWith('*') ? '*' : kw;
                return (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setTriggerKeyword(val)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-light)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    +{kw}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Configuration for Comments */}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'both', label: '🚀 Both (Comment + DM)', desc: 'Public reply + private link in DM' },
                  { id: 'comment_only', label: '💬 Comment Only', desc: 'Public reply on Reel only' },
                  { id: 'dm_only', label: '✉️ DM Only', desc: 'Direct message only' },
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

          {/* 1. Public Comment Reply Field (For Comments) */}
          {actionType === 'comment' && (commentReplyMode === 'both' || commentReplyMode === 'comment_only') && (
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid #fbcfe8',
              background: 'rgba(236, 72, 153, 0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageCircle size={15} />
                  Public Reply under Reel Comment
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Visible on Reel</span>
              </div>
              <textarea
                required
                rows={2}
                value={commentReplyMessage}
                onChange={(e) => setCommentReplyMessage(e.target.value)}
                placeholder="Check your DM! 🚀 | Sent you the link! 📩 | In your inbox! ✨"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #f472b6',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                  color: 'var(--text-main)',
                }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                💡 <b>Anti-Spam Shield:</b> Separate multiple reply options with <code>|</code> to rotate replies automatically.
              </div>
            </div>
          )}

          {/* 2. Direct Message (DM) Reply Field */}
          {(actionType === 'story' || actionType === 'dm' || (actionType === 'comment' && (commentReplyMode === 'both' || commentReplyMode === 'dm_only'))) && (
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid #c7d2fe',
              background: 'rgba(99, 102, 241, 0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={15} />
                  {actionType === 'story' ? 'Instant DM for Story Reply' : 'Automated Private DM Response'}
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Delivered to Inbox</span>
              </div>

              <textarea
                required
                rows={3}
                value={actionType === 'comment' || actionType === 'story' ? dmReplyMessage : dmText}
                onChange={(e) => {
                  if (actionType === 'comment' || actionType === 'story') setDmReplyMessage(e.target.value);
                  else setDmText(e.target.value);
                }}
                placeholder="Hey {username}! Thanks for reaching out. Here is your link: https://..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #818cf8',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                  color: 'var(--text-main)',
                }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                💡 Use <code>{'{username}'}</code> to automatically mention the follower's name.
              </div>
            </div>
          )}

          {/* Follower Check (Follow-to-Unlock) Section */}
          {actionType === 'comment' && (
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              border: requireFollow ? '1.5px solid #6366f1' : '1px solid var(--border-light)',
              background: requireFollow ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-subtle)',
              transition: 'all 0.2s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: requireFollow ? 'var(--primary)' : 'var(--border-subtle)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px'
                  }}>
                    <Lock size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Follower Check (Follow-to-Unlock)
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: 700, 
                        padding: '2px 6px', 
                        borderRadius: '999px', 
                        background: requireFollow ? '#dbeafe' : 'var(--bg-card)', 
                        color: requireFollow ? '#1d4ed8' : 'var(--text-dim)',
                        border: '1px solid var(--border-light)'
                      }}>
                        {requireFollow ? 'ACTIVATED' : 'OPTIONAL'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Only send the link/reward if the commenter follows your Instagram account!
                    </div>
                  </div>
                </div>

                <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={requireFollow}
                    onChange={(e) => setRequireFollow(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: requireFollow ? 'var(--primary)' : '#cbd5e1',
                    transition: '0.2s',
                    borderRadius: '22px',
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '16px',
                      width: '16px',
                      left: requireFollow ? '21px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      transition: '0.2s',
                      borderRadius: '50%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </span>
                </label>
              </div>

              {requireFollow && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Follow Prompt DM (Sent to Non-Followers)
                    </label>
                    <textarea
                      rows={2}
                      value={followPromptMessage}
                      onChange={(e) => setFollowPromptMessage(e.target.value)}
                      placeholder="Hey {username}! Please follow @ourpage first to get your access link! Tap &quot;✅ I've Followed&quot; below once done 🚀"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        fontSize: '12.5px',
                        outline: 'none',
                        resize: 'vertical',
                        color: 'var(--text-main)',
                      }}
                    />

                    {/* Interactive DM Button Preview */}
                    <div style={{
                      marginTop: '8px',
                      background: 'rgba(99, 102, 241, 0.04)',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px dashed #cbd5e1'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Sparkles size={13} color="var(--primary)" />
                        Interactive DM Quick Reply Buttons (Attached automatically):
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: '#ffffff',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-main)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                          👉 Follow Profile
                        </span>
                        <span style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#059669',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 1px 3px rgba(16, 185, 129, 0.15)'
                        }}>
                          ✅ I've Followed
                        </span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 }}>
                        💡 Airvix automatically sends interactive buttons. Non-followers simply tap <b>"✅ I've Followed"</b> inside Instagram to verify and unlock the link instantly without typing!
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Public Reel Comment for Non-Followers
                    </label>
                    <input
                      type="text"
                      value={followCommentReply}
                      onChange={(e) => setFollowCommentReply(e.target.value)}
                      placeholder="Almost there! Follow @ourpage and check your DMs to unlock 🚀"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        fontSize: '12.5px',
                        outline: 'none',
                        color: 'var(--text-main)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rule Name (Optional) */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Rule Label (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP Pricing Funnel"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-subtle)',
                fontSize: '12.5px',
                outline: 'none',
                color: 'var(--text-main)',
              }}
            />
          </div>

          {/* Active Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="checkbox"
              id="ruleIsActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <label htmlFor="ruleIsActive" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
              Enable this rule immediately
            </label>
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ flex: 1, padding: '10px', fontSize: '13.5px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 2, padding: '10px', fontSize: '13.5px', fontWeight: 700 }}
            >
              {loading ? 'Saving Automation...' : (ruleToEdit && !ruleToEdit.isTemplate ? 'Update Rule' : 'Activate Automation ⚡')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
