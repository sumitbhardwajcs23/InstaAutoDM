// frontend/src/components/DashboardView.jsx
import React, { useState } from 'react';
import {
  Instagram,
  Send,
  MessageCircle,
  Zap,
  Calendar,
  ChevronDown,
  TrendingUp,
  Plus,
  Play,
  BarChart3,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Activity,
  Sparkles,
} from 'lucide-react';

export default function DashboardView({
  stats,
  rules = [],
  conversations = [],
  account,
  onNavigate,
  onOpenCreateRule,
  onOpenUpgrade,
  onOpenConnect,
  onToggleRule,
}) {
  const [selectedPeriod, setSelectedPeriod] = useState('Last 30 days');

  // Stats fallbacks matching the exact reference mockup
  const accountHandle = account?.username ? `@${account.username}` : '@luna.creates';
  const accountType = account?.accountType || account?.account_type || 'Business Account';
  const dmsSent = stats?.dmsSent ?? 620;
  const dmsLimit = stats?.dmsLimit ?? 1000;
  const dmPercent = stats?.usagePercent ?? Math.min(100, Math.round((dmsSent / dmsLimit) * 100));
  const commentsReplied = stats?.commentsReplied ?? 48;
  const activeRulesCount = stats?.activeRules ?? rules.filter(r => r.is_active).length;
  const totalRulesCount = stats?.totalRules ?? rules.length;
  const changePercent = stats?.commentsRepliedChange ?? 12;
  // Use real recent conversations from stats or props
  const recentConvos = stats?.recentConversations?.length > 0 ? stats.recentConversations : conversations.slice(0, 4);

  // SVG Donut calculation
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (dmPercent / 100) * circumference;

  return (
    <div className="dashboard-content" style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* 1. Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}>
            Dashboard
          </h1>
          <p style={{
            fontSize: '13.5px',
            color: 'var(--text-muted)',
            marginTop: '4px',
            margin: 0,
          }}>
            Welcome back, Devid! Here's what's happening with your Instagram automation.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Date Range Button */}
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Calendar size={15} color="var(--text-muted)" />
            <span>Aug 1, 2026 – Aug 31, 2026</span>
            <ChevronDown size={14} color="var(--text-light)" />
          </button>

          {/* Period Selector Dropdown */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="Last 7 days">Last 7 days</option>
            <option value="Last 30 days">Last 30 days</option>
            <option value="This Month">This Month</option>
            <option value="All Time">All Time</option>
          </select>
        </div>
      </div>

      {/* 2. Top 4 KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '24px',
      }}>
        {/* Card 1: Connected Account */}
        <div className="card" style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.06em' }}>
                CONNECTED ACCOUNT
              </span>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f09433, #dc2743)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}>
                <Instagram size={17} />
              </div>
            </div>

            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '2px' }}>
              {accountHandle}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {accountType}
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-light)',
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '99px',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '11.5px',
              fontWeight: 600,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              Connected
            </span>

            <button
              type="button"
              onClick={onOpenConnect}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              View Account <ExternalLink size={12} />
            </button>
          </div>
        </div>

        {/* Card 2: Total DMs Sent */}
        <div className="card" style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.06em', marginBottom: '10px' }}>
              TOTAL DMS SENT
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {dmsSent}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 500 }}>
                / {dmsLimit}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Monthly quota limit
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '8px' }}>
              Resets in 12 days
            </div>
          </div>

          {/* Donut Chart */}
          <div style={{ position: 'relative', width: '70px', height: '70px', flexShrink: 0 }}>
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle
                cx="35"
                cy="35"
                r={radius}
                fill="none"
                stroke="var(--primary-light)"
                strokeWidth="6"
              />
              <circle
                cx="35"
                cy="35"
                r={radius}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 35 35)"
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-main)',
            }}>
              {dmPercent}%
            </div>
          </div>
        </div>

        {/* Card 3: Comments Replied */}
        <div className="card" style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.06em' }}>
                COMMENTS REPLIED
              </span>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <MessageCircle size={17} />
              </div>
            </div>

            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {commentsReplied}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              replies this month
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '99px',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '11.5px',
              fontWeight: 700,
            }}>
              <TrendingUp size={12} />
              +12%
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              from last month
            </span>
          </div>
        </div>

        {/* Card 4: Active Rules */}
        <div className="card" style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.06em' }}>
                ACTIVE RULES
              </span>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Zap size={17} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {activeRulesCount}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--text-light)', fontWeight: 500 }}>
                / {totalRulesCount}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              automation triggers active
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <button
              type="button"
              onClick={onOpenCreateRule}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--primary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
              }}
            >
              + Create New Rule
            </button>
          </div>
        </div>
      </div>

      {/* 3. Middle Row (Message Activity 50%, Quick Actions 25%, Account Status 25%) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '20px',
        marginBottom: '24px',
      }}>
        {/* Col 1: Message Activity (6/12 cols = 50%) */}
        <div className="card" style={{
          gridColumn: 'span 6',
          padding: '22px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Message Activity
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                Daily incoming messages & automated replies
              </p>
            </div>

            {/* Chart Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
                <span>Incoming DMs</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ec4899' }} />
                <span>Auto Replies</span>
              </div>
            </div>
          </div>

          {/* Interactive Dual-line SVG Chart */}
          <div style={{ width: '100%', height: '220px', position: 'relative' }}>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 540 200"
              preserveAspectRatio="none"
              style={{ overflow: 'visible' }}
            >
              <defs>
                {/* Purple gradient */}
                <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
                {/* Pink gradient */}
                <linearGradient id="pinkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines */}
              <line x1="0" y1="30" x2="540" y2="30" stroke="var(--border-light)" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="540" y2="80" stroke="var(--border-light)" strokeDasharray="3 3" />
              <line x1="0" y1="130" x2="540" y2="130" stroke="var(--border-light)" strokeDasharray="3 3" />
              <line x1="0" y1="180" x2="540" y2="180" stroke="var(--border-light)" />

              {/* Area 1: Incoming DMs (Purple) */}
              <path
                d="M 10 160 Q 95 120, 180 70 T 360 40 T 530 65 L 530 180 L 10 180 Z"
                fill="url(#purpleGrad)"
              />
              {/* Line 1 */}
              <path
                d="M 10 160 Q 95 120, 180 70 T 360 40 T 530 65"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Area 2: Auto Replies (Pink) */}
              <path
                d="M 10 170 Q 95 140, 180 110 T 360 85 T 530 95 L 530 180 L 10 180 Z"
                fill="url(#pinkGrad)"
              />
              {/* Line 2 */}
              <path
                d="M 10 170 Q 95 140, 180 110 T 360 85 T 530 95"
                fill="none"
                stroke="#ec4899"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Data points */}
              <circle cx="10" cy="160" r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="2" />
              <circle cx="95" cy="120" r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="2" />
              <circle cx="180" cy="70" r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="2" />
              <circle cx="270" cy="55" r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="2" />
              <circle cx="360" cy="40" r="4.5" fill="#6366f1" stroke="#fff" strokeWidth="2" />
              <circle cx="450" cy="50" r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="2" />
              <circle cx="530" cy="65" r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="2" />

              <circle cx="180" cy="110" r="3.5" fill="#ec4899" stroke="#fff" strokeWidth="2" />
              <circle cx="360" cy="85" r="3.5" fill="#ec4899" stroke="#fff" strokeWidth="2" />
              <circle cx="530" cy="95" r="3.5" fill="#ec4899" stroke="#fff" strokeWidth="2" />
            </svg>

            {/* X-Axis Date Labels */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--text-light)',
            }}>
              <span>Aug 1</span>
              <span>Aug 5</span>
              <span>Aug 10</span>
              <span>Aug 15</span>
              <span>Aug 20</span>
              <span>Aug 25</span>
              <span>Aug 30</span>
            </div>
          </div>
        </div>

        {/* Col 2: Quick Actions (3/12 cols = 25%) */}
        <div className="card" style={{
          gridColumn: 'span 3',
          padding: '22px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Quick Actions
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '16px' }}>
            Common tasks
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            flex: 1,
          }}>
            {/* New Rule */}
            <button
              type="button"
              onClick={onOpenCreateRule}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px 8px',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-subtle)',
                cursor: 'pointer',
                transition: 'transform 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#eef2ff',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Plus size={18} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                New Rule
              </span>
            </button>

            {/* Live Test */}
            <button
              type="button"
              onClick={() => onNavigate('simulator')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px 8px',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-subtle)',
                cursor: 'pointer',
                transition: 'transform 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#fdf2f8',
                color: '#ec4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Play size={18} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                Live Test
              </span>
            </button>

            {/* View DMs */}
            <button
              type="button"
              onClick={() => onNavigate('conversations')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px 8px',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-subtle)',
                cursor: 'pointer',
                transition: 'transform 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Send size={18} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                View DMs
              </span>
            </button>

            {/* Analytics */}
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px 8px',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-subtle)',
                cursor: 'pointer',
                transition: 'transform 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#ecfdf5',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <BarChart3 size={18} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                Analytics
              </span>
            </button>
          </div>
        </div>

        {/* Col 3: Account Status (3/12 cols = 25%) */}
        <div className="card" style={{
          gridColumn: 'span 3',
          padding: '22px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '2px',
            }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Account Status
              </h2>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#059669',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                Healthy
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              System health & connections
            </p>

            {/* Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Item 1 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={15} color="#10b981" />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>Webhook Status</span>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#059669' }}>Active</span>
              </div>

              {/* Item 2 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={15} color="#10b981" />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>Token Validity</span>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>58 days</span>
              </div>

              {/* Item 3 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={15} color="#10b981" />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>Instagram API</span>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#059669' }}>Normal</span>
              </div>

              {/* Item 4 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={15} color="#6366f1" />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>Rate Limit</span>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-subtle)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}>
                  18% used
                </span>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-light)',
            fontSize: '11.5px',
            color: 'var(--text-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>Last sync: 2 mins ago</span>
            <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Refresh</span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row (Recent Conversations 35%, Automation Rules 40%, Plan Usage 25%) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '20px',
        marginBottom: '24px',
      }}>
        {/* Col 1: Recent Conversations (span 4/12 ~33%) */}
        <div className="card" style={{
          gridColumn: 'span 4',
          padding: '22px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Recent Conversations
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                Latest automated interactions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('conversations')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View All ↗
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(recentConvos.length > 0 ? recentConvos : [
              { username: '@sophia.designs', avatarBg: '#a855f7', lastMessage: 'Hey! Can I get the link for the...', time: '2m ago', status: 'Replied' },
              { username: '@alex_runner', avatarBg: '#3b82f6', lastMessage: 'How much does this cost?', time: '14m ago', status: 'Replied' },
              { username: '@emma_style', avatarBg: '#ec4899', lastMessage: 'Love this reel so much!', time: '1h ago', status: 'Replied' },
              { username: '@tech_guru', avatarBg: '#10b981', lastMessage: 'Check your DM bro', time: '3h ago', status: 'Skipped' },
            ]).slice(0, 4).map((convo, i) => {
              const name = convo.username || convo.sender || 'Unknown';
              const initial = name.replace('@', '').charAt(0).toUpperCase();
              const colors = ['#a855f7', '#3b82f6', '#ec4899', '#10b981'];
              const bg = convo.avatarBg || colors[i % colors.length];
              const snippet = convo.lastMessage || convo.last_message || 'New message';
              const time = convo.time || (convo.updated_at ? new Date(convo.updated_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Recently');
              const status = convo.status || 'Open';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '10px', background: 'var(--bg-subtle)', cursor: 'pointer' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>{initial}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{time}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{snippet}</div>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: status === 'Replied' || status === 'sent' ? '#ecfdf5' : '#f1f5f9', color: status === 'Replied' || status === 'sent' ? '#059669' : '#64748b' }}>{status === 'sent' ? 'Replied' : status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Col 2: Automation Rules (span 5/12 ~42%) */}
        <div className="card" style={{
          gridColumn: 'span 5',
          padding: '22px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Automation Rules
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                Currently running triggers
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreateRule}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Add Rule
            </button>
          </div>

          {/* Rules Table / Cards — real data from backend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(rules.length > 0 ? rules : [
              { id: '1', type: 'dm_keyword_reply', trigger_keyword: 'PRICE', reply_message: 'Thanks! DM us for pricing details.', is_active: true },
              { id: '2', type: 'comment_to_dm', trigger_keyword: 'LINK', reply_message: 'Check your DM! 🚀', is_active: true },
              { id: '3', type: 'dm_keyword_reply', trigger_keyword: 'GUIDE', reply_message: 'Here is your free blueprint!', is_active: false },
            ]).slice(0, 4).map((rule) => {
              const isDM = rule.type === 'dm_keyword_reply' || rule.action_type === 'dm';
              const label = isDM ? 'DM' : 'Comment';
              const trigger = rule.trigger_keyword || rule.trigger || '';
              const isActive = rule.is_active === true || rule.is_active === 1;
              return (
                <div key={rule.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isDM ? '#eff6ff' : '#fdf2f8', color: isDM ? '#3b82f6' : '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isDM ? <Send size={15} /> : <MessageCircle size={15} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{rule.name || `${trigger} Rule`}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Keyword: {trigger}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>{label}</span>
                    {/* Toggle Switch */}
                    <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isActive} onChange={() => onToggleRule && onToggleRule(rule.id, !isActive)} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isActive ? 'var(--primary)' : '#cbd5e1', borderRadius: '20px', transition: '0.2s' }}>
                        <span style={{ position: 'absolute', height: '14px', width: '14px', left: isActive ? '20px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '0.2s' }} />
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* Col 3: Plan Usage (span 3/12 ~25%) */}
        <div className="card" style={{
          gridColumn: 'span 3',
          padding: '22px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Plan Usage
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '16px' }}>
              Free Plan limits
            </p>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              borderRadius: '99px',
              background: 'var(--primary-light)',
              overflow: 'hidden',
              marginBottom: '10px',
            }}>
              <div style={{
                width: `${dmPercent}%`,
                height: '100%',
                borderRadius: '99px',
                background: 'linear-gradient(90deg, #6366f1, #a855f7)',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                {dmsSent} / {dmsLimit} DMs
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {dmsLimit - dmsSent} remaining
              </span>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '6px' }}>
              Resets on Sep 1, 2026
            </div>
          </div>

          {/* Mini Upgrade Promotion Box */}
          <div style={{
            marginTop: '20px',
            padding: '14px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(236, 72, 153, 0.08))',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
              <Sparkles size={14} color="var(--primary)" />
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                Need more volume?
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
              Upgrade to Pro for unlimited messages & smart AI replies.
            </p>
            <button
              type="button"
              onClick={onOpenUpgrade}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>

      {/* 5. Footer */}
      <footer style={{
        marginTop: '32px',
        paddingTop: '20px',
        borderTop: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '12.5px',
        color: 'var(--text-light)',
      }}>
        <div>© 2026 ReplyOS. All rights reserved.</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/data-deletion" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Data Deletion</a>
          <span style={{ cursor: 'pointer' }} onClick={() => alert('Support: support@replyos.com')}>Support</span>
        </div>
      </footer>
    </div>
  );
}
