// frontend/src/components/AnalyticsView.jsx
import React from 'react';
import { BarChart3, TrendingUp, Users, MessageSquare, Clock, ArrowUpRight } from 'lucide-react';

export default function AnalyticsView({ stats, rules = [], account }) {
  const dmsSent = stats?.dmsSent ?? 0;
  const commentsReplied = stats?.commentsReplied ?? 0;
  const isConnected = !!(account && (account.status === 'connected' || account.username));

  // Compute real keyword performance from actual rules
  const totalFires = rules.reduce((acc, r) => acc + (r.fire_count || 0), 0);
  const sortedRules = [...rules].sort((a, b) => (b.fire_count || 0) - (a.fire_count || 0));

  const palette = ['#6366f1', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Analytics & Performance
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
          Live response speeds, message volume, and keyword trigger performance for {isConnected ? `@${account.username}` : 'your account'}.
        </p>
      </div>

      {/* Top 3 Metric Highlight Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.05em' }}>
            TOTAL DMS SENT
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
            {dmsSent}
          </div>
          <div style={{ fontSize: '12.5px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontWeight: 600 }}>
            <TrendingUp size={14} /> Real-time Instagram delivery
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.05em' }}>
            COMMENTS REPLIED
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
            {commentsReplied}
          </div>
          <div style={{ fontSize: '12.5px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontWeight: 600 }}>
            <TrendingUp size={14} /> Private & public replies sent
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.05em' }}>
            AVG RESPONSE TIME
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
            &lt; 1.5s
          </div>
          <div style={{ fontSize: '12.5px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontWeight: 600 }}>
            <Clock size={14} /> Instant automated reply queue
          </div>
        </div>
      </div>

      {/* Top Performing Keywords Breakdown */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Top Trigger Keywords
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Execution frequency for your active automation rules
            </p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-light)', background: 'var(--bg-subtle)', padding: '4px 10px', borderRadius: '8px' }}>
            {totalFires} total executions
          </span>
        </div>

        {rules.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px dashed var(--border-subtle)' }}>
            <BarChart3 size={32} color="var(--text-light)" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>No keyword rules created yet</div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', margin: '4px 0 0 0' }}>
              Create rules in the Automation Rules tab to start tracking keyword metrics.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {sortedRules.map((rule, idx) => {
              const count = rule.fire_count || 0;
              const pct = totalFires > 0 ? Math.round((count / totalFires) * 100) : 0;
              const color = palette[idx % palette.length];
              const trigger = rule.trigger_keyword || rule.trigger || 'rule';
              return (
                <div key={rule.id || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      "{trigger}" <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 400 }}>({rule.type === 'dm_keyword_reply' ? 'DM' : 'Comment to DM'})</span>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      {count} replies ({pct}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', borderRadius: '99px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(count > 0 ? pct : 0, 0)}%`, height: '100%', background: color, borderRadius: '99px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
