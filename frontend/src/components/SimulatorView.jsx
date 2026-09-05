// frontend/src/components/SimulatorView.jsx
import React, { useState } from 'react';
import { PlayCircle, Send, MessageCircle, CheckCircle2, AlertCircle, Bot, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api/client';

export default function SimulatorView({ rules = [], onRefreshStats }) {
  const [eventType, setEventType] = useState('dm');
  const [senderUsername, setSenderUsername] = useState('alex_test');
  const [incomingText, setIncomingText] = useState('Hey how much does this price cost?');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSimulate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const endpoint = eventType === 'dm' ? '/simulator/dm' : '/simulator/comment';
      const payload = eventType === 'dm'
        ? { text: incomingText, message_text: incomingText, sender_username: senderUsername }
        : { text: incomingText, comment_text: incomingText, commenter_username: senderUsername, media_id: 'test_media_123' };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setResult({
        success: res.ok && data.success,
        data,
      });

      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      setResult({
        success: false,
        error: err.message || 'Failed to simulate trigger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Live Webhook Simulator
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
          Test your Instagram keyword triggers and automated replies instantly without waiting for actual followers.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        {/* Left Form (7 cols) */}
        <div className="card" style={{
          gridColumn: 'span 7',
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px 0' }}>
            Trigger Parameters
          </h2>

          <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Event Type Select */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                Simulation Event Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEventType('dm')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid',
                    borderColor: eventType === 'dm' ? 'var(--primary)' : 'var(--border-subtle)',
                    background: eventType === 'dm' ? 'var(--primary-light)' : 'transparent',
                    color: eventType === 'dm' ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <Send size={16} /> Direct Message (DM)
                </button>

                <button
                  type="button"
                  onClick={() => setEventType('comment')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid',
                    borderColor: eventType === 'comment' ? 'var(--primary)' : 'var(--border-subtle)',
                    background: eventType === 'comment' ? 'var(--primary-light)' : 'transparent',
                    color: eventType === 'comment' ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <MessageCircle size={16} /> Post Comment
                </button>
              </div>
            </div>

            {/* Simulated Sender */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                Simulated Sender Username
              </label>
              <input
                type="text"
                value={senderUsername}
                onChange={(e) => setSenderUsername(e.target.value)}
                placeholder="e.g. alex_runner"
                required
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

            {/* Incoming Text */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                Incoming Message / Comment Text
              </label>
              <textarea
                rows={4}
                value={incomingText}
                onChange={(e) => setIncomingText(e.target.value)}
                placeholder="Type sample message here..."
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle)',
                  fontSize: '13.5px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Quick Keyword Chips */}
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>
                Quick suggestions:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['price', 'cost', 'link', 'send', 'discount', 'deal', 'info'].map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setIncomingText(`Hey! Can you tell me the ${kw}?`)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-subtle)',
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    "{kw}"
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--primary-gradient)',
                color: '#fff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              }}
            >
              {loading ? <RefreshCw size={16} className="spin" /> : <PlayCircle size={18} />}
              <span>{loading ? 'Simulating...' : 'Simulate Trigger Now'}</span>
            </button>
          </form>
        </div>

        {/* Right Result Panel (5 cols) */}
        <div className="card" style={{
          gridColumn: 'span 5',
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px 0' }}>
            Live Execution Output
          </h2>

          {!result ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'var(--text-light)',
              padding: '24px',
            }}>
              <Bot size={48} strokeWidth={1.5} style={{ marginBottom: '12px', opacity: 0.6 }} />
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)' }}>
                Awaiting Simulation Run
              </div>
              <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
                Fill in the incoming text on the left and click Simulate to see trigger matching and auto-reply dispatch in real time.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {result.success ? (
                <>
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <CheckCircle2 size={20} color="#059669" />
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#065f46' }}>
                        Match Found & Reply Sent!
                      </div>
                      <div style={{ fontSize: '12px', color: '#047857' }}>
                        Rule: <strong>{result.data.matched_rule || 'Price Inquiry Auto DM'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Reply preview */}
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>
                      SENT AUTOMATED REPLY:
                    </span>
                    <div style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'var(--primary-gradient)',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      lineHeight: 1.45,
                    }}>
                      {result.data.reply_sent || result.data.message || 'Auto-reply dispatched!'}
                    </div>
                  </div>

                  {/* Raw JSON details */}
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: '6px' }}>
                      WEBHOOK PAYLOAD:
                    </span>
                    <pre style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'var(--bg-subtle)',
                      fontSize: '11px',
                      overflowX: 'auto',
                      color: 'var(--text-main)',
                      fontFamily: 'monospace',
                    }}>
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                </>
              ) : (
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <AlertCircle size={20} color="#dc2626" />
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#991b1b' }}>
                      No Matching Rule or Limit Exceeded
                    </div>
                    <div style={{ fontSize: '12px', color: '#b91c1c' }}>
                      {result.error || result.data?.message || 'The incoming text did not match any active trigger keywords.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
