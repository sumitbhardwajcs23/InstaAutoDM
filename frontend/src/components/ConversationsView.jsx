// frontend/src/components/ConversationsView.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Send, Bot, RefreshCw, Sparkles, Check, CheckCheck, Clock, MessageSquare, AlertCircle, X, ExternalLink, Copy } from 'lucide-react';
import { apiFetch } from '../api/client';

const AVATAR_COLORS = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#6366f1'];

export default function ConversationsView({ conversations: initialConversations = [], onRefresh, selectedAccountId }) {
  const [conversationsList, setConversationsList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [replyInput, setReplyInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const messagesEndRef = useRef(null);

  // Normalize conversation object with real Instagram name, handle, ID, and profile pic
  const normalizeConvo = useCallback((c, idx = 0) => {
    const rawUsername = c.cleanUsername || c.username || c.sender || '';
    const cleanUsername = String(rawUsername).replace(/^@/, '').trim();
    const hasRealHandle = cleanUsername && cleanUsername.toLowerCase() !== 'user' && !cleanUsername.startsWith('user_');
    const realName = c.name && c.name.toLowerCase() !== 'user' ? c.name : null;
    const igScopedId = c.ig_scoped_user_id || c.ig_user_id || '';

    // Known Instagram follower profiles for instant resolution
    const KNOWN_USERS = {
      '1759458871653007': { name: 'sumit bhardwaj', username: 'join_sumit_', profilePic: 'https://instagram.fdel65-4.fna.fbcdn.net/v/t51.82787-19/671209546_18351709720242986_4694042261133486757_n.jpg?stp=dst-jpg_s206x206_tt6&_nc_cat=104&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=0kznyX7llrUQ7kNvwHSYMHU&_nc_oc=AdplFQw1gO469Ud_pFMYcSf_5rZzMvr4PS6kl7_G_YkQ4f7u-B5s97c3CLFs8Jd8K59Mo6iokWhZSIeZgtg_xMgJ&_nc_zt=24&_nc_ht=instagram.fdel65-4.fna&edm=ALmAK4EEAAAA&_nc_gid=29Tfo3w3z7qQ72CW0TVyBQ&oh=00_AQK6yoIl9tKjgebs3n20Syv3sd-lEutfLMNpl2AVcaQLUw&oe=6AA20743' },
      '28206324158977642': { name: 'Nitish Rajpoot', username: 'nitishrajpoot27' },
      '2694306197727421': { name: '𝙲𝚑𝚑𝚊𝚟𝚒✮', username: 'urluv.chhavi' },
      '2199839837542030': { name: 'Priyanshu Uttam | Boring Traders 📈', username: 'priyanshu__vision' },
      '2052261912093429': { name: 'Piyush Yadav', username: 'rao_piyushh_yadav' },
      '1730487928031569': { name: 'Maniesha', username: 'radhika_bhardwaj15' }
    };
    const known = KNOWN_USERS[igScopedId];
    const resolvedName = realName || (known ? known.name : null);
    const resolvedHandle = hasRealHandle ? cleanUsername : (known ? known.username : null);

    // Primary display name: Real Instagram name > @handle > 'Instagram User' (never shows raw ID)
    const displayName = resolvedName || (resolvedHandle ? `@${resolvedHandle}` : 'Instagram User');
    // Secondary handle: @username if available, else show IG ID in smaller text
    const displayHandle = resolvedHandle ? `@${resolvedHandle}` : (igScopedId ? `ID: ${igScopedId}` : '');
    const sender = resolvedHandle ? `@${resolvedHandle}` : displayName;
    const initial = (resolvedName || resolvedHandle || 'I').charAt(0).toUpperCase();

    const colorIndex = Math.abs((c.id ? String(c.id) : String(idx)).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % AVATAR_COLORS.length;
    const avatarBg = c.avatarBg || AVATAR_COLORS[colorIndex];
    const profilePic = c.profile_pic_url || c.profilePic || (known ? known.profilePic : null);
    const time = c.time || c.timeAgo || 'Just now';
    const isReplied = String(c.status).toLowerCase() === 'replied';

    const normalizedMessages = (c.messages || []).map((m, mIdx) => {
      const isInbound = m.direction === 'inbound' || m.sender === 'user';
      const msgDate = m.created_at ? new Date(m.created_at) : null;
      // Use IST (Asia/Kolkata) for all timestamps
      const timeStr = m.time && !m.time.includes(':') ? m.time : // already formatted non-time string
        (msgDate && !isNaN(msgDate.getTime())
          ? msgDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
          : (m.time || 'Just now'));
      return {
        id: m.id || `m_${mIdx}`,
        sender: isInbound ? 'user' : 'bot',
        text: m.text || m.content || '',
        time: timeStr,
        created_at: m.created_at || null,
        rule: m.rule || (m.direction === 'outbound' ? 'Automated DM' : null),
        status: m.status || 'sent',
        errorMessage: m.error_message || null,
      };
    });
    // Sort by created_at ascending so messages display in correct chronological order
    const sortedMessages = [...normalizedMessages].sort((a, b) => {
      if (!a.created_at && !b.created_at) return 0;
      if (!a.created_at) return 1;
      if (!b.created_at) return -1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const lastMsg = c.lastMessage || c.last_message || (sortedMessages[sortedMessages.length - 1]?.text) || 'No messages yet';

    return {
      ...c,
      id: c.id,
      name: resolvedName || realName,
      displayName,
      displayHandle,
      sender,
      username: resolvedHandle ? `@${resolvedHandle}` : (hasRealHandle ? `@${cleanUsername}` : sender),
      cleanUsername: resolvedHandle || (hasRealHandle ? cleanUsername : null),
      ig_scoped_user_id: igScopedId,
      profile_pic_url: profilePic,
      initial,
      avatarBg,
      time,
      lastMessage: lastMsg,
      status: isReplied ? 'Replied' : 'Open',
      messages: sortedMessages,
    };
  }, []);

  // Sync incoming props
  useEffect(() => {
    const normalized = (initialConversations || []).map((c, i) => normalizeConvo(c, i));
    setConversationsList(normalized);
    setSelectedId((prev) => {
      if (prev && normalized.some((item) => item.id === prev)) return prev;
      return normalized[0]?.id || null;
    });
  }, [initialConversations, normalizeConvo]);

  // Refresh conversations from API
  const refreshConversations = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const query = selectedAccountId ? `?account_id=${encodeURIComponent(selectedAccountId)}` : '';
      const res = await apiFetch(`/conversations${query}`);
      if (res.ok) {
        const data = await res.json();
        const rawList = data.conversations || [];
        const normalized = rawList.map((c, i) => normalizeConvo(c, i));
        setConversationsList(normalized);
        setSelectedId((prev) => {
          if (prev && normalized.some((item) => item.id === prev)) return prev;
          return normalized[0]?.id || null;
        });
      }
    } catch (e) {
      console.error('Error refreshing conversations:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [normalizeConvo, selectedAccountId]);

  // Auto-refresh poll every 5 seconds to show incoming DMs live
  useEffect(() => {
    const timer = setInterval(() => {
      refreshConversations();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshConversations]);

  const activeConvo = conversationsList.find((c) => c.id === selectedId) || conversationsList[0];

  // Auto-scroll messages container to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConvo?.messages?.length]);

  const filteredList = conversationsList.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.displayName && c.displayName.toLowerCase().includes(q)) ||
      (c.sender && c.sender.toLowerCase().includes(q)) ||
      (c.cleanUsername && c.cleanUsername.toLowerCase().includes(q)) ||
      (c.ig_scoped_user_id && c.ig_scoped_user_id.toLowerCase().includes(q)) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
    );
  });

  const handleSendReply = async () => {
    if (!replyInput.trim() || !activeConvo || isSending) return;
    const textToSend = replyInput.trim();
    setReplyInput('');
    setIsSending(true);

    const tempId = `temp_${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    const newMsg = {
      id: tempId,
      sender: 'bot',
      text: textToSend,
      time: nowTime,
      created_at: new Date().toISOString(),
      rule: 'Manual Reply',
      status: 'sending',
    };

    setConversationsList((prev) =>
      prev.map((c) => {
        if (c.id === activeConvo.id) {
          return {
            ...c,
            lastMessage: textToSend,
            time: 'Just now',
            status: 'Replied',
            messages: [...(c.messages || []), newMsg],
          };
        }
        return c;
      })
    );

    try {
      const res = await apiFetch(`/conversations/${activeConvo.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text: textToSend }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversationsList((prev) =>
          prev.map((c) => {
            if (c.id === activeConvo.id) {
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === tempId ? { ...m, status: data.status || 'sent', id: data.messageId || tempId } : m
                ),
              };
            }
            return c;
          })
        );
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to send manual reply:', err);
      setConversationsList((prev) =>
        prev.map((c) => {
          if (c.id === activeConvo.id) {
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === tempId ? { ...m, status: 'failed', errorMessage: err.message } : m
              ),
            };
          }
          return c;
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* View Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
            Conversations
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
            Real-time Instagram incoming messages and automated response threads.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshConversations}
          disabled={isRefreshing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Main 2-Column Split */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        gap: '20px',
        height: 'calc(100vh - 220px)',
        minHeight: '560px',
      }}>
        {/* Left Column: Conversations List */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
        }}>
          {/* Search Box */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                type="text"
                placeholder="Search messages or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 32px 9px 34px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--text-light)',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* List Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {filteredList.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}>
                <MessageSquare size={28} style={{ opacity: 0.35 }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>No conversations found</p>
                <span style={{ fontSize: '11.5px', color: 'var(--text-light)' }}>
                  Send a DM to your Instagram account to see it appear here live!
                </span>
              </div>
            ) : (
              filteredList.map((convo) => {
                const isSelected = convo.id === activeConvo?.id;
                return (
                  <div
                    key={convo.id}
                    onClick={() => setSelectedId(convo.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: isSelected ? 'var(--primary-light, rgba(99, 102, 241, 0.08))' : 'transparent',
                      border: isSelected ? '1px solid var(--primary-border, rgba(99, 102, 241, 0.25))' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      marginBottom: '4px',
                    }}
                  >
                    {/* User Avatar */}
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: convo.avatarBg,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '15px',
                      flexShrink: 0,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      {convo.profile_pic_url ? (
                        <img
                          src={convo.profile_pic_url}
                          alt={convo.name || convo.displayName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        convo.initial
                      )}
                    </div>

                    {/* Convo Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{
                          fontSize: '13.5px',
                          fontWeight: 700,
                          color: isSelected ? 'var(--primary, #6366f1)' : 'var(--text-main, #0f172a)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {convo.name || convo.displayName}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-light, #94a3b8)', flexShrink: 0, marginLeft: '6px' }}>
                          {convo.time}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'nowrap' }}>
                        {convo.cleanUsername && (
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: 'var(--primary, #6366f1)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            @{convo.cleanUsername}
                          </span>
                        )}
                        {convo.ig_scoped_user_id && (
                          <span style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'var(--bg-subtle, rgba(148, 163, 184, 0.14))',
                            color: 'var(--text-muted, #64748b)',
                            fontFamily: 'monospace',
                            flexShrink: 0,
                          }}>
                            ID: {convo.ig_scoped_user_id.slice(-6)}
                          </span>
                        )}
                      </div>

                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-muted, #64748b)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                      }}>
                        {convo.lastMessage}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Message Thread View */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
        }}>
          {!activeConvo ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              gap: '12px',
            }}>
              <MessageSquare size={42} style={{ opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Select a conversation to view the thread</p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div style={{
                padding: '14px 22px',
                borderBottom: '1px solid var(--border-light, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-card, #ffffff)',
                flexWrap: 'wrap',
                gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: activeConvo.avatarBg,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '15px',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {activeConvo.profile_pic_url ? (
                      <img
                        src={activeConvo.profile_pic_url}
                        alt={activeConvo.name || activeConvo.displayName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      activeConvo.initial
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-main, #0f172a)', lineHeight: 1.2 }}>
                        {activeConvo.name || activeConvo.displayName}
                      </span>
                      {activeConvo.cleanUsername && (
                        <a
                          href={`https://instagram.com/${activeConvo.cleanUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--primary, #6366f1)',
                            textDecoration: 'none',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'rgba(99, 102, 241, 0.08)',
                            border: '1px solid rgba(99, 102, 241, 0.18)',
                          }}
                          title={`Open @${activeConvo.cleanUsername} on Instagram`}
                        >
                          @{activeConvo.cleanUsername}
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {activeConvo.ig_scoped_user_id && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(activeConvo.ig_scoped_user_id);
                            setCopiedId(true);
                            setTimeout(() => setCopiedId(false), 2000);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: 'var(--text-muted, #64748b)',
                            background: 'var(--bg-subtle, #f1f5f9)',
                            border: '1px solid var(--border-subtle, #e2e8f0)',
                            borderRadius: '6px',
                            padding: '2px 7px',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                          }}
                          title="Click to copy Instagram Scoped User ID"
                        >
                          <span>IG ID: {activeConvo.ig_scoped_user_id}</span>
                          <Copy size={11} />
                          {copiedId && <span style={{ color: '#10b981', fontWeight: 600, fontSize: '10px' }}>Copied!</span>}
                        </button>
                      )}

                      <div style={{ fontSize: '11.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        <span>Direct DM</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '99px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: activeConvo.status === 'Replied' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                    color: activeConvo.status === 'Replied' ? '#059669' : '#64748b',
                  }}>
                    {activeConvo.status}
                  </span>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                background: 'var(--bg-body, #fafafa)',
              }}>
                {(!activeConvo.messages || activeConvo.messages.length === 0) ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', fontSize: '13px' }}>
                    No messages in this conversation yet.
                  </div>
                ) : (
                    activeConvo.messages.map((msg, idx) => {
                    const isUser = msg.sender === 'user';
                    const senderLabel = isUser ? (activeConvo.name || activeConvo.displayName) : (msg.rule ? 'ReplyOS Automation ⚡' : 'You (Manual Reply)');
                    return (
                      <div
                        key={msg.id || idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isUser ? 'flex-start' : 'flex-end',
                          maxWidth: '100%',
                        }}
                      >
                        {/* Sender Name Label */}
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: isUser ? 'var(--text-muted, #64748b)' : 'var(--primary, #6366f1)',
                          marginBottom: '4px',
                          paddingLeft: isUser ? '4px' : '0',
                          paddingRight: !isUser ? '4px' : '0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          {senderLabel}
                        </div>

                        {/* Bubble */}
                        <div style={{
                          maxWidth: '72%',
                          padding: '12px 16px',
                          borderRadius: isUser ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                          background: isUser ? 'var(--bg-card, #ffffff)' : 'var(--primary-gradient, linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%))',
                          color: isUser ? 'var(--text-main, #0f172a)' : '#ffffff',
                          border: isUser ? '1px solid var(--border-subtle, rgba(0,0,0,0.08))' : 'none',
                          fontSize: '13.5px',
                          lineHeight: 1.48,
                          boxShadow: isUser ? '0 1px 3px rgba(0,0,0,0.05)' : '0 2px 6px rgba(99, 102, 241, 0.25)',
                          wordBreak: 'break-word',
                        }}>
                          {msg.text}
                        </div>

                        {/* Metadata Footer */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '4px',
                          fontSize: '11px',
                          color: 'var(--text-light, #94a3b8)',
                          padding: isUser ? '0 4px' : '0 4px',
                        }}>
                          {msg.rule && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              color: 'var(--primary, #6366f1)',
                              fontWeight: 600,
                            }}>
                              <Bot size={11} /> {msg.rule}
                            </span>
                          )}

                          <span>{msg.time}</span>

                          {!isUser && (
                            <span>
                              {msg.status === 'sent' && <CheckCheck size={13} style={{ color: '#10b981', verticalAlign: 'middle' }} />}
                              {msg.status === 'sending' && <Clock size={12} style={{ color: '#f59e0b', verticalAlign: 'middle' }} />}
                              {msg.status === 'failed' && (
                                <span title={msg.errorMessage || 'Failed to send'} style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                  <AlertCircle size={12} /> Failed
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <div style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                background: 'var(--bg-card)',
              }}>
                <input
                  type="text"
                  placeholder="Send manual reply..."
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={!replyInput.trim() || isSending}
                  style={{
                    padding: '0 18px',
                    height: '42px',
                    borderRadius: '12px',
                    background: (!replyInput.trim() || isSending) ? 'var(--border-subtle, #cbd5e1)' : 'var(--primary, #6366f1)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: (!replyInput.trim() || isSending) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Send size={15} />
                  <span>Send</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
