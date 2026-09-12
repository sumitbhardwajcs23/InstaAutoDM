// frontend/src/components/TemplateEditorModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  CheckCircle2, 
  Send, 
  MessageCircle, 
  Lock, 
  Eye, 
  Smile, 
  ArrowDown,
  Layers,
  AlertCircle,
  ExternalLink,
  Zap,
  Check
} from 'lucide-react';
import { apiFetch } from '../api/client';

const SAMPLE_IMAGES = [
  { label: '🛍️ Shopping Bag', url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80' },
  { label: '👗 Fashion Lookbook', url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80' },
  { label: '📚 Course Syllabus', url: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800&auto=format&fit=crop&q=80' },
  { label: '🎁 Giveaway Gift', url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80' },
  { label: '🏡 Real Estate', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80' },
  { label: '💪 Fitness Plan', url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80' },
];

export default function TemplateEditorModal({ 
  isOpen, 
  onClose, 
  templateToEdit = null, 
  onTemplateSaved,
  onOpenCreateRule,
  accountId 
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('ecommerce');
  const [badge, setBadge] = useState('🔥 High Conversion');
  const [triggerKeyword, setTriggerKeyword] = useState('DISCOUNT');
  const [matchMode, setMatchMode] = useState('contains');
  
  // Card Fields
  const [cardTitle, setCardTitle] = useState('🎁 Exclusive 20% Discount Code: VIP20');
  const [cardSubtitle, setCardSubtitle] = useState('Use code VIP20 at checkout for 20% off your entire order today only!');
  const [cardImageUrl, setCardImageUrl] = useState('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80');
  const [cardButtonText, setCardButtonText] = useState('Shop 20% Off 🛍️');
  const [cardButtonUrl, setCardButtonUrl] = useState('https://yourbrand.com/shop');

  // Text & Messages
  const [dmReplyMessage, setDmReplyMessage] = useState("Hey {username}! 🎁 Here is your exclusive 20% discount code: VIP20\n\nValid on our entire collection for the next 24 hours only!");
  const [commentReplyMessage, setCommentReplyMessage] = useState('Sent your 20% OFF code in DM! 🚀 | Check your inbox for the discount card! 📩');
  const [requireFollow, setRequireFollow] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (templateToEdit) {
      setName(templateToEdit.name || '');
      setCategory(templateToEdit.category || 'ecommerce');
      setBadge(templateToEdit.badge || '🔥 High Conversion');
      setTriggerKeyword(templateToEdit.trigger_keyword || 'DISCOUNT');
      setMatchMode(templateToEdit.match_mode || 'contains');
      setCardTitle(templateToEdit.card_title || templateToEdit.name || '🎁 Exclusive Discount');
      setCardSubtitle(templateToEdit.card_subtitle || '');
      setCardImageUrl(templateToEdit.card_image_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80');
      setCardButtonText(templateToEdit.card_button_text || 'Shop Now 🛍️');
      setCardButtonUrl(templateToEdit.card_button_url || 'https://yourbrand.com/shop');
      setDmReplyMessage(templateToEdit.dm_reply_message || '');
      setCommentReplyMessage(templateToEdit.comment_reply_message || 'Check your DM! 🚀');
      setRequireFollow(Boolean(templateToEdit.require_follow));
    } else {
      // Default clean slate for new template
      setName('20% Discount Promo Card');
      setCategory('ecommerce');
      setBadge('🔥 High Conversion');
      setTriggerKeyword('DISCOUNT');
      setMatchMode('contains');
      setCardTitle('🎁 Exclusive 20% Discount Code: VIP20');
      setCardSubtitle('Use code VIP20 at checkout for 20% off your entire order today only!');
      setCardImageUrl('https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80');
      setCardButtonText('Shop 20% Off 🛍️');
      setCardButtonUrl('https://yourbrand.com/shop');
      setDmReplyMessage("Hey {username}! 🎁 Here is your exclusive 20% discount code: VIP20\n\nValid on our entire collection for the next 24 hours only!");
      setCommentReplyMessage('Sent your 20% OFF code in DM! 🚀 | Check your inbox! 📩');
      setRequireFollow(false);
    }
    setError(null);
  }, [templateToEdit, isOpen]);

  if (!isOpen) return null;

  const isWildcard = triggerKeyword.trim() === '*';

  const handleSave = async (e, shouldActivateRule = false) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);

    if (!name.trim()) {
      setError('Template name is required.');
      setSaving(false);
      return;
    }
    if (!triggerKeyword.trim()) {
      setError('Trigger keyword is required.');
      setSaving(false);
      return;
    }

    const templateId = templateToEdit?.id || `custom_tpl_${Date.now()}`;
    const payload = {
      id: templateId,
      name: name.trim(),
      category,
      categoryLabel: category === 'ecommerce' ? '🛍️ E-Commerce' : (category === 'creator' ? '🎓 Creators & Coaches' : (category === 'lead_magnet' ? '🔒 Follower Check' : '💼 Services & Agencies')),
      badge: badge.trim() || '🔥 Custom Template',
      trigger_keyword: triggerKeyword.trim(),
      match_mode: matchMode,
      action_type: 'comment',
      comment_reply_mode: 'both',
      comment_reply_message: commentReplyMessage.trim(),
      dm_reply_message: dmReplyMessage.trim(),
      card_enabled: 1,
      card_title: cardTitle.trim() || name.trim(),
      card_subtitle: cardSubtitle.trim(),
      card_image_url: cardImageUrl.trim(),
      card_button_text: cardButtonText.trim() || 'Open Link',
      card_button_url: cardButtonUrl.trim() || 'https://',
      require_follow: requireFollow ? 1 : 0,
      description: `Custom Instagram DM Card template configured for trigger '${triggerKeyword.trim()}'.`,
    };

    try {
      const isEditingExisting = Boolean(templateToEdit && templateToEdit.id);
      const url = isEditingExisting ? `/site/templates/${templateToEdit.id}` : '/site/templates';
      const method = isEditingExisting ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save template');
      }

      const savedData = await res.json();
      const savedTpl = savedData.template || payload;

      if (onTemplateSaved) {
        onTemplateSaved(savedTpl);
      }

      if (shouldActivateRule && onOpenCreateRule) {
        onOpenCreateRule({
          name: savedTpl.name,
          trigger_keyword: savedTpl.trigger_keyword,
          match_mode: savedTpl.match_mode || 'contains',
          action_type: 'comment',
          comment_reply_mode: 'both',
          comment_reply_message: savedTpl.comment_reply_message,
          dm_reply_message: savedTpl.dm_reply_message,
          require_follow: savedTpl.require_follow,
          card_enabled: 1,
          card_title: savedTpl.card_title,
          card_subtitle: savedTpl.card_subtitle,
          card_image_url: savedTpl.card_image_url,
          card_button_text: savedTpl.card_button_text,
          card_button_url: savedTpl.card_button_url,
        });
      }

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2100,
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '1060px',
        maxHeight: '94vh',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(226, 232, 240, 0.9)',
      }}>
        {/* Header */}
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
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                {templateToEdit ? `Edit Template: ${templateToEdit.name}` : 'Create New Instagram DM Template'}
              </h2>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                Build interactive DM Card templates with image, text &amp; CTA link button
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
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body: 2 Columns */}
        <form onSubmit={(e) => handleSave(e, false)} style={{
          display: 'grid',
          gridTemplateColumns: '1.25fr 1fr',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}>
          {/* Left Column Controls */}
          <div style={{
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            overflowY: 'auto',
            borderRight: '1px solid #f1f5f9'
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

            {/* Template Name & Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                  Template Title / Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 20% Discount Promo Card"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    outline: 'none',
                    color: '#0f172a'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ecommerce">🛍️ E-Commerce</option>
                  <option value="creator">🎓 Creators &amp; Coaches</option>
                  <option value="lead_magnet">🔒 Follower Check</option>
                  <option value="services">💼 Services &amp; Agencies</option>
                </select>
              </div>
            </div>

            {/* Trigger Keyword & Match Mode */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                Trigger Keyword (Assign to Reel Comment)
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  required
                  value={triggerKeyword}
                  onChange={(e) => setTriggerKeyword(e.target.value)}
                  placeholder="e.g. DISCOUNT or * for Any Comment"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: isWildcard ? '2px solid #6366f1' : '1px solid #cbd5e1',
                    background: isWildcard ? '#faf5ff' : '#ffffff',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
                <select
                  value={matchMode}
                  onChange={(e) => setMatchMode(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="contains">Contains Keyword</option>
                  <option value="exact">Exact Match</option>
                  <option value="starts_with">Starts With</option>
                </select>
              </div>

              {/* Quick Chips */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>Quick presets:</span>
                <button
                  type="button"
                  onClick={() => setTriggerKeyword('*')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '16px',
                    background: isWildcard ? '#4f46e5' : '#e0e7ff',
                    color: isWildcard ? '#ffffff' : '#4338ca',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles size={12} />
                  <span>⭐ Any Comment (*)</span>
                </button>
                {['DISCOUNT', 'LINK', 'PROMO', 'CATALOG', 'VIP'].map(kw => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setTriggerKeyword(kw)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    +{kw}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta DM Card Media & Content */}
            <div style={{
              padding: '16px',
              borderRadius: '16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={18} color="#6366f1" />
                <span>Instagram DM Card Format (Meta API)</span>
              </div>

              {/* Cover Image URL */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Card Cover Image URL
                </label>
                <input
                  type="url"
                  required
                  value={cardImageUrl}
                  onChange={(e) => setCardImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
                {/* Sample Image Presets */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {SAMPLE_IMAGES.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCardImageUrl(img.url)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: cardImageUrl === img.url ? '#e0e7ff' : '#ffffff',
                        border: cardImageUrl === img.url ? '1px solid #6366f1' : '1px solid #e2e8f0',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: cardImageUrl === img.url ? '#4338ca' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {img.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Headline & Subtitle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Card Headline Title
                  </label>
                  <input
                    type="text"
                    required
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="🎁 Exclusive 20% Discount Code: VIP20"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Card Subtitle / Description
                  </label>
                  <textarea
                    rows={2}
                    value={cardSubtitle}
                    onChange={(e) => setCardSubtitle(e.target.value)}
                    placeholder="Use code VIP20 at checkout for 20% off your entire order today only!"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      color: '#0f172a',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              {/* CTA Button Text & Destination URL */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    CTA Button Label
                  </label>
                  <input
                    type="text"
                    required
                    value={cardButtonText}
                    onChange={(e) => setCardButtonText(e.target.value)}
                    placeholder="Shop 20% Off 🛍️"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Destination Link URL
                  </label>
                  <input
                    type="url"
                    required
                    value={cardButtonUrl}
                    onChange={(e) => setCardButtonUrl(e.target.value)}
                    placeholder="https://yourbrand.com/shop"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Promotional DM Message Text */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                Promotional Text Message (Sent with DM Card)
              </label>
              <textarea
                rows={3}
                required
                value={dmReplyMessage}
                onChange={(e) => setDmReplyMessage(e.target.value)}
                placeholder="Hey {username}! 🎁 Here is your exclusive 20% discount code: VIP20"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                💡 Use <code>{'{username}'}</code> to automatically mention the follower's name.
              </div>
            </div>

            {/* Public Comment Reply */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                Public Reply under Reel Comment
              </label>
              <input
                type="text"
                required
                value={commentReplyMessage}
                onChange={(e) => setCommentReplyMessage(e.target.value)}
                placeholder="Sent your 20% OFF code in DM! 🚀 | Check inbox! 📩"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Right Column: Real-Time Simulated Instagram DM Card Preview */}
          <div style={{
            background: '#f8fafc',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            overflowY: 'auto'
          }}>
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
                  Live Instagram DM Preview
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                  Official Meta Generic Card format preview
                </div>
              </div>
            </div>

            {/* Simulated DM Phone Canvas */}
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              {/* Context Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f09433, #dc2743)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}>
                  IG
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    Reel Comment Trigger
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    @user123 • Just now
                  </div>
                </div>
              </div>

              {/* User Trigger Comment */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '6px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>👤</div>
                <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '14px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  {isWildcard ? 'Great reel!! 🔥 (Any Comment)' : triggerKeyword}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', color: '#cbd5e1' }}><ArrowDown size={14} /></div>

              {/* Public Reply */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#ec4899', background: '#fce7f3', padding: '2px 8px', borderRadius: '10px', alignSelf: 'flex-start' }}>🧭 Public Reply</span>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '14px', fontSize: '12.5px', color: '#0f172a' }}>
                  {commentReplyMessage.split('|')[0] || 'Sent your code in DM! 🚀'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', color: '#cbd5e1' }}><ArrowDown size={14} /></div>

              {/* Rich Meta Generic Card Attachment DM */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#4f46e5', background: '#e0e7ff', padding: '2px 8px', borderRadius: '10px', alignSelf: 'flex-start' }}>✈️ Delivered to Inbox</span>
                
                {/* Text portion */}
                <div style={{ background: '#e0e7ff', padding: '10px 12px', borderRadius: '14px', fontSize: '12.5px', color: '#1e1b4b', whiteSpace: 'pre-line' }}>
                  {dmReplyMessage.replace(/\{username\}/gi, 'user123')}
                </div>

                {/* Generic Card Container */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #cbd5e1',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }}>
                  {/* Card Cover Image */}
                  {cardImageUrl && (
                    <img 
                      src={cardImageUrl} 
                      alt="Card cover" 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                    />
                  )}

                  {/* Card Body */}
                  <div style={{ padding: '14px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '4px', lineHeight: 1.3 }}>
                      {cardTitle || name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                      {cardSubtitle}
                    </div>
                  </div>

                  {/* Clickable CTA Button */}
                  <div style={{ padding: '0 14px 14px 14px' }}>
                    <a
                      href={cardButtonUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.preventDefault()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%',
                        padding: '10px',
                        borderRadius: '10px',
                        background: '#4f46e5',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 700,
                        textDecoration: 'none',
                        boxShadow: '0 2px 8px rgba(79,70,229,0.3)',
                        textAlign: 'center'
                      }}
                    >
                      <span>{cardButtonText || 'Open Link'}</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px' }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                }}
              >
                {saving ? 'Saving Template...' : 'Save Template'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(null, true)}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '12px',
                  border: '1px solid #6366f1',
                  background: '#e0e7ff',
                  color: '#4338ca',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Zap size={16} />
                <span>Save &amp; Activate as Automation Rule ⚡</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
