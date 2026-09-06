// frontend/src/components/DashboardView.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
} from 'lucide-react';
import { apiFetch } from '../api/client';

export default function DashboardView({
  stats,
  rules = [],
  conversations = [],
  account,
  accounts = [],
  user,
  onNavigate,
  onOpenCreateRule,
  onOpenUpgrade,
  onOpenConnect,
  onToggleRule,
  onSelectAccount,
  onRefresh,
}) {
  const [selectedPeriod, setSelectedPeriod] = useState('Last 30 days');
  const [activity, setActivity] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);


  // Real stats & account binding
  const isDummy = !account?.username || account?.username === 'instagram_creator' || account?.username === 'test_creator_account' || account?.username === 'connected' || account?.username === 'instagram_user';
  const isConnected = !!(account && (account.status === 'connected' || stats?.connected));
  const hasRealHandle = account?.username && !isDummy;
  const accountHandle = hasRealHandle ? `@${account.username}` : (isConnected ? (account?.full_name || 'Account Connected') : 'Not Connected');
  const accountFullName = (account?.full_name && !isDummy && account.full_name !== 'Instagram Account')
    ? account.full_name
    : (hasRealHandle ? `@${account.username}` : (isConnected ? 'Instagram Creator' : 'No Account'));
  const accountType = account?.accountType || account?.account_type || (isConnected ? 'Creator Account' : 'None');
  const dmsSent = stats?.dmsSent ?? 0;
  const dmsLimit = stats?.dmsLimit ?? 1000;
  const dmPercent = dmsLimit > 0 ? Math.min(100, Math.round((dmsSent / dmsLimit) * 100)) : 0;
  const commentsReplied = stats?.commentsReplied ?? 0;
  const activeRulesCount = stats?.activeRules ?? rules.filter(r => r.is_active).length;
  const totalRulesCount = stats?.totalRules ?? rules.length;
  const changePercent = stats?.commentsRepliedChange ?? 0;
  // Use real recent conversations from stats or props
  const recentConvos = stats?.recentConversations?.length > 0 ? stats.recentConversations : conversations.slice(0, 4);

  // Fetch real activity analytics dynamically
  useEffect(() => {
    let isMounted = true;
    const fetchActivity = async () => {
      setLoadingActivity(true);
      try {
        const query = account?.id ? `?account_id=${encodeURIComponent(account.id)}&days=7` : '?days=7';
        const res = await apiFetch(`/analytics/activity${query}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setActivity(data);
        }
      } catch (err) {
        console.error('Failed to fetch activity analytics:', err);
      } finally {
        if (isMounted) setLoadingActivity(false);
      }
    };
    fetchActivity();
    return () => { isMounted = false; };
  }, [account?.id]);

  // Dynamic billing and reset dates
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysUntilReset = Math.max(1, Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const resetDateStr = nextMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateRangeLabel = `${startOfMonth} – ${endOfMonth}`;

  // Dynamic token validity text
  let tokenValidityText = 'Active (60d)';
  if (account?.token_expires_at) {
    const msLeft = new Date(account.token_expires_at).getTime() - Date.now();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    tokenValidityText = daysLeft > 0 ? `${daysLeft} days left` : 'Expired';
  }

  // Dynamic last sync text
  const lastSyncText = (() => {
    const ts = account?.updated_at || account?.connected_at;
    if (!ts) return 'Just now';
    const diffMs = Date.now() - new Date(ts).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffHrs / 24)} days ago`;
  })();

  // Real SVG chart calculations
  const totalActivityCount = (activity?.totals?.dms_sent || 0) + (activity?.totals?.comments_replied || 0);
  const chartPoints = useMemo(() => {
    if (!activity || !activity.timeline || activity.timeline.length === 0 || totalActivityCount === 0) return null;
    const maxVal = Math.max(...activity.dmsSent, ...activity.commentsReplied, 4);
    const width = 540;
    const height = 180;
    const paddingX = 20;
    const n = activity.timeline.length;
    const step = (width - paddingX * 2) / Math.max(n - 1, 1);

    const dmsCoords = activity.dmsSent.map((val, i) => ({
      x: paddingX + i * step,
      y: height - (val / maxVal) * (height - 30),
      val
    }));

    const repliesCoords = activity.commentsReplied.map((val, i) => ({
      x: paddingX + i * step,
      y: height - (val / maxVal) * (height - 30),
      val
    }));

    const buildPath = (coords) => coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
    const buildAreaPath = (coords) => {
      if (!coords.length) return '';
      const line = buildPath(coords);
      return `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;
    };

    return {
      dmsCoords,
      repliesCoords,
      dmsLine: buildPath(dmsCoords),
      dmsArea: buildAreaPath(dmsCoords),
      repliesLine: buildPath(repliesCoords),
      repliesArea: buildAreaPath(repliesCoords),
      labels: activity.labels,
    };
  }, [activity, totalActivityCount]);

  // SVG Donut calculation
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (dmPercent / 100) * circumference;

  const userName = user?.name || user?.email?.split('@')[0] || 'there';

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
            Welcome back, {userName}! Here's what's happening with your Instagram automation.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Date Range Button */}
          <div
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
            }}
          >
            <Calendar size={15} color="var(--text-muted)" />
            <span>{dateRangeLabel}</span>
          </div>

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
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: isConnected ? 'linear-gradient(135deg, #f09433, #dc2743)' : 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isConnected ? '#fff' : 'var(--text-muted)',
                overflow: 'hidden',
              }}>
                {account?.profile_picture_url ? (
                  <img src={account.profile_picture_url} alt={account.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Instagram size={18} />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
                {isConnected ? accountFullName : 'No Account'}
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {isConnected ? `${accountHandle} • ${accountType}` : 'Connect your Instagram account'}
            </div>
            {isConnected && account?.followers_count !== undefined && account.followers_count > 0 && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-light)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>👥</span>
                <span>{account.followers_count.toLocaleString()} followers</span>
              </div>
            )}
            {accounts && accounts.length > 1 && (
              <div style={{ fontSize: '11.5px', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                {accounts.length} connected accounts
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-light)',
          }}>
            {isConnected ? (
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
            ) : (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '99px',
                background: '#fef2f2',
                color: '#ef4444',
                fontSize: '11.5px',
                fontWeight: 600,
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                Disconnected
              </span>
            )}

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
              {isConnected ? (
                <>View Account <ExternalLink size={12} /></>
              ) : (
                <>Connect Account ↗</>
              )}
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
              Resets in {daysUntilReset} days
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
              {changePercent >= 0 ? `+${changePercent}%` : `${changePercent}%`}
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

          {/* Dynamic Real-Data SVG Chart or Empty State */}
          <div style={{ width: '100%', height: '220px', position: 'relative' }}>
            {loadingActivity ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}>
                Loading activity data...
              </div>
            ) : chartPoints ? (
              <>
                <svg
                  width="100%"
                  height="180"
                  viewBox="0 0 540 180"
                  preserveAspectRatio="none"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                    </linearGradient>
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
                  <path d={chartPoints.dmsArea} fill="url(#purpleGrad)" />
                  <path d={chartPoints.dmsLine} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Area 2: Auto Replies (Pink) */}
                  <path d={chartPoints.repliesArea} fill="url(#pinkGrad)" />
                  <path d={chartPoints.repliesLine} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Data points */}
                  {chartPoints.dmsCoords.map((pt, i) => (
                    <circle key={`dm-${i}`} cx={pt.x} cy={pt.y} r="3.5" fill="#6366f1" stroke="#fff" strokeWidth="2" />
                  ))}
                  {chartPoints.repliesCoords.map((pt, i) => (
                    <circle key={`rep-${i}`} cx={pt.x} cy={pt.y} r="3.5" fill="#ec4899" stroke="#fff" strokeWidth="2" />
                  ))}
                </svg>

                {/* X-Axis Dynamic Date Labels */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '10px',
                  fontSize: '11px',
                  color: 'var(--text-light)',
                }}>
                  {chartPoints.labels.map((lbl, idx) => (
                    <span key={idx}>{lbl}</span>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-subtle)',
                borderRadius: '12px',
                border: '1px dashed var(--border-subtle)',
                padding: '20px',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}>
                <Activity size={28} color="var(--text-light)" style={{ marginBottom: '8px', opacity: 0.5 }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  No Message Activity Recorded Yet
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '4px 0 10px 0', maxWidth: '340px' }}>
                  Live incoming messages and automated replies for {accountHandle} will plot here in real time.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('simulator')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={12} />
                  Test with Live Simulator
                </button>
              </div>
            )}
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
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{tokenValidityText}</span>
              </div>

              {/* Item 3 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={15} color="#10b981" />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>Instagram API</span>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: isConnected ? '#059669' : 'var(--text-muted)' }}>
                  {isConnected ? 'Normal' : 'Disconnected'}
                </span>
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
                  {dmPercent}% used
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
            <span>Last sync: {lastSyncText}</span>
            <span 
              style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => onRefresh && onRefresh()}
            >
              Refresh
            </span>
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
            {recentConvos.length === 0 ? (
              <div style={{
                padding: '28px 16px',
                textAlign: 'center',
                borderRadius: '12px',
                background: 'var(--bg-subtle)',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No conversations yet</p>
                <span style={{ fontSize: '11.5px', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                  When followers send a DM, they will appear here live.
                </span>
              </div>
            ) : (
              recentConvos.slice(0, 4).map((convo, i) => {
                const name = convo.username || convo.sender || convo.contact_name || 'Lead';
                const initial = name.replace('@', '').charAt(0).toUpperCase() || 'L';
                const colors = ['#a855f7', '#3b82f6', '#ec4899', '#10b981'];
                const bg = convo.avatarBg || colors[i % colors.length];
                const snippet = convo.lastMessage || convo.last_message || convo.message || 'New message';
                const time = convo.time || (convo.updated_at ? new Date(convo.updated_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Recently');
                const status = convo.status || 'Open';
                return (
                  <div key={convo.id || i} onClick={() => onNavigate && onNavigate('conversations')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '10px', background: 'var(--bg-subtle)', cursor: 'pointer' }}>
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
              })
            )}
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
            {rules.length === 0 ? (
              <div style={{
                padding: '28px 16px',
                textAlign: 'center',
                borderRadius: '12px',
                border: '1px dashed var(--border-light)',
                background: 'var(--bg-subtle)',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 500 }}>No rules configured yet</p>
                <button
                  type="button"
                  onClick={onOpenCreateRule}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + Add Your First Rule
                </button>
              </div>
            ) : (
              rules.slice(0, 4).map((rule) => {
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
              })
            )}
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
              Resets on {resetDateStr}
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
