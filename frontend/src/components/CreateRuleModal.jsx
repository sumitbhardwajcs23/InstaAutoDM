// frontend/src/components/CreateRuleModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Zap, 
  Send, 
  MessageCircle, 
  Clock, 
  Sparkles, 
  Check, 
  AlertCircle,
  Lock,
  Smile,
  ArrowDown,
  Eye,
  CheckCircle2,
  Film
} from 'lucide-react';
import { apiFetch } from '../api/client';

const QUICK_EMOJIS = ['🚀', '📩', '✨', '🔥', '💎', '🎁', '✅', '👇', '❤️', '⚡', '🎉', '👉'];

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

  // Checkbox states for Step 3 (when actionType === 'comment')
  const [enablePublicReply, setEnablePublicReply] = useState(true);
  const [enablePrivateDm, setEnablePrivateDm] = useState(true);

  const [commentReplyMessage, setCommentReplyMessage] = useState('Check your DM! 🚀');
  const [dmReplyMessage, setDmReplyMessage] = useState('Hey {username}! Thanks for your comment. Here is what you requested: https://yourlink.com');
  const [dmText, setDmText] = useState('Hey {username}! Thanks for reaching out. How can I help you today?');
  
  const [requireFollow, setRequireFollow] = useState(false);
  const [followPromptMessage, setFollowPromptMessage] = useState("Hey {username}! Please follow @ourpage first to get your access link! Tap \"✅ I've Followed\" below once done 🚀");
  const [followCommentReply, setFollowCommentReply] = useState("Almost there! Follow @ourpage and check your DMs to unlock 🚀");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeEmojiTarget, setActiveEmojiTarget] = useState(null);

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

      const mode = ruleToEdit.comment_reply_mode || 'both';
      setEnablePublicReply(mode === 'both' || mode === 'comment_only');
      setEnablePrivateDm(mode === 'both' || mode === 'dm_only');

      setCommentReplyMessage(ruleToEdit.comment_reply_message || 'Check your DM! 🚀');
      
      const existingDm = ruleToEdit.dm_reply_message || ruleToEdit.reply_text || ruleToEdit.reply_message || '';
      if (isComment || isStory) {
        setDmReplyMessage(existingDm || 'Hey {username}! Thanks for your comment. Here is what you requested: https://yourlink.com');
      } else {
        setDmText(existingDm || 'Hey {username}! Thanks for reaching out. How can I help you today?');
      }

      setRequireFollow(Boolean(ruleToEdit.require_follow));
      setFollowPromptMessage(ruleToEdit.follow_prompt_message || "Hey {username}! Please follow @ourpage first to get your access link! Tap \"✅ I've Followed\" below once done 🚀");
      setFollowCommentReply(ruleToEdit.follow_comment_reply || "Almost there! Follow @ourpage and check your DMs to unlock 🚀");

      const hasTarget = Boolean(ruleToEdit.target_media_id || ruleToEdit.target_media_type === 'next_upload' || (ruleToEdit.target_media_type && ruleToEdit.target_media_type !== 'all'));
      if (hasTarget) {
        setTargetMedia({
          id: ruleToEdit.target_media_id || null,
          type: ruleToEdit.target_media_type || 'reel',
          thumbnail: ruleToEdit.target_media_thumbnail || null,
          caption: ruleToEdit.target_media_caption || (ruleToEdit.target_media_type === 'next_upload' ? '🚀 Next Uploaded Reel/Post' : null),
        });
        if (!isStory) setActionType('comment');
      } else {
        setTargetMedia(null);
      }

      setIsActive(ruleToEdit.is_active !== undefined ? Boolean(ruleToEdit.is_active) : true);
    } else if (preselectedMedia) {
      const isReel = preselectedMedia.media_product_type === 'REELS' || preselectedMedia.media_type === 'VIDEO';
      const isStory = preselectedMedia.media_product_type === 'STORY';
      
      if (isStory) {
        setActionType('story');
        setTriggerKeyword('HI');
        setDmReplyMessage('Hey {username}! Thanks for replying to my story! Here is your link: https://yourlink.com');
      } else {
        setActionType('comment');
        setEnablePublicReply(true);
        setEnablePrivateDm(true);
        setCommentReplyMessage('Check your DM! 🚀');
        setDmReplyMessage('Hey {username}! Thanks for your comment on my Reel. Here is what you requested: https://yourlink.com');

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

      const mediaIdSuffix = preselectedMedia.id ? preselectedMedia.id.slice(-4) : 'Next';
      setName(isReel ? `Reel Auto Reply (#${mediaIdSuffix})` : (preselectedMedia.target_media_type === 'next_upload' ? 'Next Upload Auto Reply' : 'Content Auto Reply'));
      setMatchMode('contains');
      setIsActive(true);
    } else {
      // Clean default matching mockup
      setName('Hi Auto Reply');
      setTriggerKeyword('Hi');
      setMatchMode('contains');
      setActionType('comment');
      setTargetMedia(null);
      setEnablePublicReply(true);
      setEnablePrivateDm(true);
      setCommentReplyMessage('Check your DM! 🚀');
      setDmReplyMessage('Hey {username}! Thanks for your comment. Here is what you requested: https://yourlink.com');
      setDmText('Hey {username}! Thanks for reaching out. How can I help you today?');
      setRequireFollow(false);
      setFollowPromptMessage("Hey {username}! Please follow @ourpage first to get your access link! Tap \"✅ I've Followed\" below once done 🚀");
      setFollowCommentReply("Almost there! Follow @ourpage and check your DMs to unlock 🚀");
      setIsActive(true);
    }
    setError(null);
  }, [ruleToEdit, preselectedMedia, isOpen]);

  useEffect(() => {
    if (targetMedia && actionType === 'dm') {
      setActionType(targetMedia.type === 'story' ? 'story' : 'comment');
    }
  }, [targetMedia, actionType]);

  if (!isOpen) return null;

  // Determine commentReplyMode from checkboxes
  const calculatedMode = enablePublicReply && enablePrivateDm ? 'both' 
    : (enablePublicReply ? 'comment_only' 
    : (enablePrivateDm ? 'dm_only' : 'none'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isComment = actionType === 'comment';
    const isStory = actionType === 'story';
    const finalDmReply = isComment || isStory ? dmReplyMessage.trim() : dmText.trim();
    const finalCommentReply = isComment ? commentReplyMessage.trim() : '';

    if (!triggerKeyword.trim()) {
      setError('Trigger keyword is required. (Use "*" for any message or comment)');
      setLoading(false);
      return;
    }

    if (isComment) {
      if (!enablePublicReply && !enablePrivateDm) {
        setError('Please select at least one action: Public Reply or Private DM.');
        setLoading(false);
        return;
      }
      if (enablePublicReply && !finalCommentReply) {
        setError('Please enter a public comment reply message.');
        setLoading(false);
        return;
      }
      if (enablePrivateDm && !finalDmReply) {
        setError('Please enter a private DM message.');
        setLoading(false);
        return;
      }
    } else {
      if (!finalDmReply) {
        setError('Please enter an automated DM reply message.');
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
      comment_reply_mode: isComment ? calculatedMode : null,
      comment_reply_message: isComment && enablePublicReply ? finalCommentReply : null,
      dm_reply_message: (!isComment || enablePrivateDm) ? finalDmReply : null,
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

  const insertEmoji = (emoji) => {
    if (activeEmojiTarget === 'commentReply') {
      setCommentReplyMessage(prev => prev + emoji);
    } else if (activeEmojiTarget === 'dmReply') {
      if (actionType === 'comment' || actionType === 'story') {
        setDmReplyMessage(prev => prev + emoji);
      } else {
        setDmText(prev => prev + emoji);
      }
    }
    setActiveEmojiTarget(null);
  };

  // Helper text for summary banner
  const getSummaryText = () => {
    const kw = triggerKeyword ? `"${triggerKeyword}"` : '"keyword"';
    if (actionType === 'comment') {
      if (enablePublicReply && enablePrivateDm) {
        return `This rule will reply to comments containing ${kw} with a public reply and a private DM.`;
      } else if (enablePublicReply) {
        return `This rule will reply to comments containing ${kw} with a public reply only.`;
      } else if (enablePrivateDm) {
        return `This rule will reply to comments containing ${kw} with a private DM only.`;
      }
      return `Select an action for comments containing ${kw}.`;
    } else if (actionType === 'story') {
      return `This rule will reply to story responses containing ${kw} with a private DM.`;
    } else {
      return `This rule will reply to direct messages containing ${kw} with a private DM.`;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '1020px',
        maxHeight: '92vh',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(226, 232, 240, 0.8)',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.12)'
            }}>
              <Zap size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                {ruleToEdit && !ruleToEdit.isTemplate ? 'Edit Automation Rule' : (ruleToEdit?.isTemplate ? 'Create Rule from Template' : (targetMedia ? 'Automate Specific Content' : 'Create Automation Rule'))}
              </h2>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                Automate comments, story replies & DMs
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f8fafc',
              color: '#64748b',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Main Grid: 2 Columns */}
        <form onSubmit={handleSubmit} style={{ 
          display: 'grid',
          gridTemplateColumns: '1.25fr 1fr',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Left Column: Input Form */}
          <div style={{
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
            overflowY: 'auto',
            borderRight: '1px solid #f1f5f9',
          }}>
            {error && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: '13.5px',
                fontWeight: 600,
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Target Media Banner (if attached to specific media or next upload) */}
            {targetMedia && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06), rgba(236, 72, 153, 0.06))',
                border: '1px solid rgba(79, 70, 229, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                {targetMedia.thumbnail ? (
                  <img 
                    src={targetMedia.thumbnail} 
                    alt="Target preview" 
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#4f46e5',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Film size={20} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#4f46e5' }}>
                    {targetMedia.type === 'next_upload' ? '🚀 Target: Next Reel / Post Upload' : `🎬 Target: Specific ${targetMedia.type.toUpperCase()}`}
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {targetMedia.caption || 'Attached Content'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTargetMedia(null)}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Clear
                </button>
              </div>
            )}

            {/* Rule Name Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  Rule Name
                </label>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                  {name.length}/50
                </span>
              </div>
              <input
                type="text"
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hi Auto Reply"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>

            {/* Step 1: When should this rule run? */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  1
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  When should this rule run?
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {/* Option 1: Comment */}
                <button
                  type="button"
                  onClick={() => setActionType('comment')}
                  style={{
                    padding: '14px 12px',
                    borderRadius: '14px',
                    border: actionType === 'comment' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                    background: actionType === 'comment' ? '#faf5ff' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '8px',
                    position: 'relative',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: actionType === 'comment' ? '0 4px 12px rgba(79,70,229,0.08)' : 'none',
                  }}
                >
                  {actionType === 'comment' && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#4f46e5',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: actionType === 'comment' ? '#e0e7ff' : '#f8fafc',
                    color: actionType === 'comment' ? '#4f46e5' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Comment</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                      When someone comments on your posts
                    </div>
                  </div>
                </button>

                {/* Option 2: Story Reply */}
                <button
                  type="button"
                  onClick={() => setActionType('story')}
                  style={{
                    padding: '14px 12px',
                    borderRadius: '14px',
                    border: actionType === 'story' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                    background: actionType === 'story' ? '#faf5ff' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '8px',
                    position: 'relative',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: actionType === 'story' ? '0 4px 12px rgba(79,70,229,0.08)' : 'none',
                  }}
                >
                  {actionType === 'story' && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#4f46e5',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: actionType === 'story' ? '#e0e7ff' : '#f8fafc',
                    color: actionType === 'story' ? '#4f46e5' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Story Reply</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                      When someone replies to your story
                    </div>
                  </div>
                </button>

                {/* Option 3: Direct Message */}
                <button
                  type="button"
                  disabled={Boolean(targetMedia)}
                  onClick={() => setActionType('dm')}
                  style={{
                    padding: '14px 12px',
                    borderRadius: '14px',
                    border: actionType === 'dm' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                    background: actionType === 'dm' ? '#faf5ff' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '8px',
                    position: 'relative',
                    cursor: targetMedia ? 'not-allowed' : 'pointer',
                    opacity: targetMedia ? 0.5 : 1,
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: actionType === 'dm' ? '0 4px 12px rgba(79,70,229,0.08)' : 'none',
                  }}
                >
                  {actionType === 'dm' && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#4f46e5',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: actionType === 'dm' ? '#e0e7ff' : '#f8fafc',
                    color: actionType === 'dm' ? '#4f46e5' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Send size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>Direct Message</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                      When someone sends you a DM
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: What should the person say? */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  2
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  What should the person say?
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  required
                  value={triggerKeyword}
                  onChange={(e) => setTriggerKeyword(e.target.value)}
                  placeholder="e.g. Hi"
                  style={{
                    flex: 1,
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  }}
                />

                <select
                  value={matchMode}
                  onChange={(e) => setMatchMode(e.target.value)}
                  style={{
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="contains">Contains keyword</option>
                  <option value="exact">Exact match</option>
                  <option value="starts_with">Starts with</option>
                </select>
              </div>

              {/* Quick Add Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Quick add:</span>
                {['Hi', 'Hello', 'Link', 'Price'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setTriggerKeyword(chip)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '8px',
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: What should happen? */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  3
                </div>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  What should happen?
                </span>
              </div>

              {/* Checkboxes & Fields based on Action Type */}
              {actionType === 'comment' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Action Option 1: Reply to the comment (Public) */}
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: enablePublicReply ? '10px' : 0 }}>
                      <input
                        type="checkbox"
                        checked={enablePublicReply}
                        onChange={(e) => setEnablePublicReply(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }}
                      />
                      <MessageCircle size={18} color="#ec4899" />
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                        Reply to the comment (Public)
                      </span>
                    </label>

                    {enablePublicReply && (
                      <div style={{ position: 'relative', marginTop: '8px' }}>
                        <input
                          type="text"
                          required={enablePublicReply}
                          value={commentReplyMessage}
                          onChange={(e) => setCommentReplyMessage(e.target.value)}
                          placeholder="Check your DM! 🚀"
                          style={{
                            width: '100%',
                            padding: '10px 40px 10px 14px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13.5px',
                            fontWeight: 500,
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setActiveEmojiTarget(activeEmojiTarget === 'commentReply' ? null : 'commentReply')}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Smile size={18} />
                        </button>

                        {/* Emoji Quick Bar */}
                        {activeEmojiTarget === 'commentReply' && (
                          <div style={{
                            position: 'absolute',
                            right: 0,
                            bottom: '100%',
                            marginBottom: '6px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '12px',
                            padding: '8px',
                            display: 'flex',
                            gap: '6px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                            zIndex: 10,
                          }}>
                            {QUICK_EMOJIS.map(em => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => insertEmoji(em)}
                                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Option 2: Send a private DM */}
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: enablePrivateDm ? '10px' : 0 }}>
                      <input
                        type="checkbox"
                        checked={enablePrivateDm}
                        onChange={(e) => setEnablePrivateDm(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }}
                      />
                      <Send size={18} color="#4f46e5" />
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                        Send a private DM
                      </span>
                    </label>

                    {enablePrivateDm && (
                      <div style={{ position: 'relative', marginTop: '8px' }}>
                        <textarea
                          rows={3}
                          required={enablePrivateDm}
                          value={dmReplyMessage}
                          onChange={(e) => setDmReplyMessage(e.target.value)}
                          placeholder="Hey {username}! Thanks for your comment. Here is what you requested: https://yourlink.com"
                          style={{
                            width: '100%',
                            padding: '10px 40px 10px 14px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13.5px',
                            fontWeight: 500,
                            color: '#0f172a',
                            outline: 'none',
                            resize: 'vertical',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setActiveEmojiTarget(activeEmojiTarget === 'dmReply' ? null : 'dmReply')}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '12px',
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Smile size={18} />
                        </button>

                        {/* Emoji Quick Bar */}
                        {activeEmojiTarget === 'dmReply' && (
                          <div style={{
                            position: 'absolute',
                            right: 0,
                            bottom: '100%',
                            marginBottom: '6px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '12px',
                            padding: '8px',
                            display: 'flex',
                            gap: '6px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                            zIndex: 10,
                          }}>
                            {QUICK_EMOJIS.map(em => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => insertEmoji(em)}
                                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        )}

                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>💡 Use <code>{'{username}'}</code> to mention the follower's name.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* For Story Reply or DM */
                <div style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Send size={18} color="#4f46e5" />
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                      {actionType === 'story' ? 'Automated DM for Story Reply' : 'Automated DM Response'}
                    </span>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <textarea
                      rows={3}
                      required
                      value={actionType === 'story' ? dmReplyMessage : dmText}
                      onChange={(e) => {
                        if (actionType === 'story') setDmReplyMessage(e.target.value);
                        else setDmText(e.target.value);
                      }}
                      placeholder="Hey {username}! Thanks for reaching out..."
                      style={{
                        width: '100%',
                        padding: '10px 40px 10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        color: '#0f172a',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setActiveEmojiTarget(activeEmojiTarget === 'dmReply' ? null : 'dmReply')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '12px',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <Smile size={18} />
                    </button>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                      💡 Use <code>{'{username}'}</code> to mention the follower's name.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Follow-to-Unlock (Optional) */}
            {actionType === 'comment' && (
              <div style={{
                padding: '14px 16px',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#4f46e5',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      4
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                        Follow-to-Unlock <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>(Optional)</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        Only send the link if they follow your Instagram.
                      </div>
                    </div>
                  </div>

                  <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
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
                      backgroundColor: requireFollow ? '#4f46e5' : '#cbd5e1',
                      transition: '0.2s',
                      borderRadius: '24px',
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '18px',
                        width: '18px',
                        left: requireFollow ? '23px' : '3px',
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
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                        Follow Prompt Message (Sent to Non-Followers)
                      </label>
                      <textarea
                        rows={2}
                        value={followPromptMessage}
                        onChange={(e) => setFollowPromptMessage(e.target.value)}
                        placeholder="Hey {username}! Please follow @ourpage first..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12.5px',
                          color: '#0f172a',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', background: '#e0e7ff', color: '#4338ca', fontWeight: 600 }}>👉 Follow Profile</span>
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>✅ I've Followed</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Live Interactive Instagram Preview Panel */}
          <div style={{
            background: '#f8fafc',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            overflowY: 'auto',
          }}>
            {/* Preview Panel Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: '#e0e7ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Eye size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Preview
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                  See how it will look to your audience
                </div>
              </div>
            </div>

            {/* Instagram Live Simulated Canvas Container */}
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              {/* Context Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '15px',
                  boxShadow: '0 2px 8px rgba(220, 39, 67, 0.25)'
                }}>
                  <InstagramIcon />
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                    {actionType === 'comment' ? 'Someone comments on your post' : (actionType === 'story' ? 'Someone replies to your story' : 'Someone sends you a DM')}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 500 }}>
                    @user123 • 2m ago
                  </div>
                </div>
              </div>

              {/* User Trigger Message Bubble */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#cbd5e1',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  👤
                </div>
                <div style={{
                  background: '#f1f5f9',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  borderTopLeftRadius: '4px',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  fontWeight: 600,
                  maxWidth: '85%',
                  wordBreak: 'break-word'
                }}>
                  {triggerKeyword || 'Hi'}
                </div>
              </div>

              {/* Down Arrow separator */}
              <div style={{ display: 'flex', justifyContent: 'center', color: '#cbd5e1' }}>
                <ArrowDown size={16} />
              </div>

              {/* Action 1: Public Reply Bubble (If enabled & actionType === 'comment') */}
              {actionType === 'comment' && enablePublicReply && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{
                    alignSelf: 'flex-start',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#ec4899',
                    background: '#fce7f3',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>🧭 Your public reply</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 800,
                      flexShrink: 0
                    }}>
                      A
                    </div>
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      padding: '10px 14px',
                      borderRadius: '16px',
                      borderTopLeftRadius: '4px',
                      fontSize: '13px',
                      color: '#0f172a',
                      fontWeight: 500,
                      maxWidth: '85%',
                      wordBreak: 'break-word'
                    }}>
                      {commentReplyMessage || 'Check your DM! 🚀'}
                    </div>
                  </div>
                </div>
              )}

              {/* Down Arrow separator if both public and private DM are active */}
              {actionType === 'comment' && enablePublicReply && enablePrivateDm && (
                <div style={{ display: 'flex', justifyContent: 'center', color: '#cbd5e1' }}>
                  <ArrowDown size={16} />
                </div>
              )}

              {/* Action 2: Private DM Bubble (If enabled or story/dm type) */}
              {((actionType === 'comment' && enablePrivateDm) || actionType === 'story' || actionType === 'dm') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{
                    alignSelf: 'flex-start',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#4f46e5',
                    background: '#e0e7ff',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>✈️ Your private DM</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', paddingLeft: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 800,
                      flexShrink: 0
                    }}>
                      A
                    </div>
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '12px 14px',
                      borderRadius: '16px',
                      borderTopLeftRadius: '4px',
                      fontSize: '13px',
                      color: '#0f172a',
                      lineHeight: 1.45,
                      maxWidth: '88%',
                      wordBreak: 'break-word'
                    }}>
                      {(actionType === 'comment' || actionType === 'story' ? dmReplyMessage : dmText)
                        .replace(/\{username\}/gi, 'user123') || 'Hey user123! Thanks for reaching out.'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Green Banner Summary Box */}
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '16px',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: '#10b981',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px'
              }}>
                <CheckCircle2 size={16} />
              </div>
              <div>
                <h4 style={{ fontSize: '14.5px', fontWeight: 800, color: '#065f46', margin: 0 }}>
                  Looks good!
                </h4>
                <div style={{ fontSize: '12.5px', color: '#047857', marginTop: '4px', lineHeight: 1.4, fontWeight: 500 }}>
                  {getSummaryText()}
                </div>
              </div>
            </div>

            {/* Bottom Actions inside form */}
            <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <input 
                  type="checkbox"
                  id="ruleIsActiveFooter"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }}
                />
                <label htmlFor="ruleIsActiveFooter" style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Activate this rule immediately
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                >
                  {loading ? 'Saving...' : (ruleToEdit && !ruleToEdit.isTemplate ? 'Save Changes' : 'Save Changes')}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  );
}
