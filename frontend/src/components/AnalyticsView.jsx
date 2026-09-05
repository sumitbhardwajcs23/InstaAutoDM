// frontend/src/components/AnalyticsView.jsx
import React from 'react';
import { BarChart3, TrendingUp, Users, MessageSquare, Clock, ArrowUpRight } from 'lucide-react';

export default function AnalyticsView({ stats }) {
  const dmsSent = stats?.dmsSent ?? 620;
  const commentsReplied = stats?.commentsReplied ?? 48;

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Analytics & Performance
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
          Deep-dive conversion metrics, response speeds, and keyword trigger performance.
        </p>
      </div>

      {/* Top 3 Metric Highlight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.05em' }}>
            AVG RESPONSE TIME
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
            1.2s
          </div>
          <div style={{ fontSize: '12.5px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontWeight: 600 }}>
            <TrendingUp size={14} /> 99.8% faster than manual replies
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.05em' }}>
            TOTAL LEADS CAPTURED
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
            {Math.round(dmsSent * 0.42)}
          </div>
          <div style={{ fontSize: '12.5px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontWeight: 600 }}>
            <TrendingUp size={14} /> +24% lead conversion rate
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.05em' }}>
            CLICK-THROUGH RATE (CTR)
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
            68.4%
          </div>
          <div style={{ fontSize: '12.5px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontWeight: 600 }}>
            <TrendingUp size={14} /> Links in automated DMs clicked
          </div>
        </div>
      </div>

      {/* Top Performing Keywords Breakdown */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px 0' }}>
          Top Trigger Keywords
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { keyword: 'price / cost', triggers: 342, pct: 55, color: '#6366f1' },
            { keyword: 'link / send', triggers: 178, pct: 28, color: '#ec4899' },
            { keyword: 'discount / deal', triggers: 68, pct: 11, color: '#3b82f6' },
            { keyword: 'info / details', triggers: 32, pct: 6, color: '#10b981' },
          ].map((item, idx) => (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>"{item.keyword}"</span>
                <span style={{ color: 'var(--text-muted)' }}>{item.triggers} replies ({item.pct}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', borderRadius: '99px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: '99px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
