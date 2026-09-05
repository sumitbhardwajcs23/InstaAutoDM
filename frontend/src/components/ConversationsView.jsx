// frontend/src/components/ConversationsView.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Send, Bot, RefreshCw, Sparkles, Check, CheckCheck, Clock, MessageSquare, AlertCircle, X } from 'lucide-react';
import { apiFetch } from '../api/client';

const AVATAR_COLORS = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#6366f1'];

export default function ConversationsView({ conversations: initialConversations = [], onRefresh, selectedAccountId }) {
  const [conversationsList, setConversationsList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [replyInput, setReplyInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef(null);

  // Normalize conversation object so it matches both backend and seed data
  const normalizeConvo = useCallback((c, idx = 0) => {
    const rawUsername = c.username || c.sender || 'user';
    const cleanUsername = String(rawUsername).replace(/^@/, '');
    const sender = `@${cleanUsername}`;
    const initial = (cleanUsername[0] || 'U').toUpperCase();
    const colorIndex = Math.abs((c.id ? String(c.id) : String(idx)).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % AVATAR_COLORS.length;
    const avatarBg = c.avatarBg || AVATAR_COLORS[colorIndex];
    const time = c.time || c.timeAgo || 'Just now';
    const isReplied = String(c.status).toLowerCase() === 'replied';

    const normalizedMessages = (c.messages || []).map((m, mIdx) => {
      const isInbound = m.direction === 'inbound' || m.sender === 'user';
      const msgDate = m.created_at ? new Date(m.created_at) : null;
      const timeStr = m.time || (msgDate && !isNaN(msgDate.getTime()) ? msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now');
      return {
        id: m.id || `m_${mIdx}`,
        sender: isInbound ? 'user' : 'bot',
        text: m.text || m.content || '',
        time: timeStr,
        rule: m.rule || (m.direction === 'outbound' ? 'Automated DM' : null),
        status: m.status || 'sent',
        errorMessage: m.error_message || null,
      };
    });

    const lastMsg = c.lastMessage || c.last_message || (normalizedMessages[normalizedMessages.length - 1]?.text) || 'No messages yet';

    return {
      ...c,
      id: c.id,
      sender,
      username: sender,
      initial,
      avatarBg,
      time,
      lastMessage: lastMsg,
      status: isReplied ? 'Replied' : 'Open',
      messages: normalizedMessages,
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
    return c.sender.toLowerCase().includes(q) || (c.lastMessage && c.lastMessage.toLowerCase().includes(q));
  });

  const handleSendReply = async () => {
    if (!replyInput.trim() || !activeConvo || isSending) return;
    const textToSend = replyInput.trim();
    setReplyInput('');
    setIsSending(true);

    const tempId = `temp_${Date.now()}`;
    const newMsg = {
      id: tempId,
      sender: 'bot',
      text: textToSend,
      time: 'Just now',
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
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: convo.avatarBg,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '14.5px',
                      flexShrink: 0,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    }}>
                      {convo.initial}
                    </div>

                    {/* Convo Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{
                          fontSize: '13.5px',
                          fontWeight: 700,
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {convo.sender}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-light)', flexShrink: 0, marginLeft: '6px' }}>
                          {convo.time}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '12.5px',
                        color: 'var(--text-muted)',
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
                padding: '16px 22px',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-card)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: activeConvo.avatarBg,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0,
                  }}>
                    {activeConvo.initial}
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
                      {activeConvo.sender}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      Automated reply triggered &amp; active
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
