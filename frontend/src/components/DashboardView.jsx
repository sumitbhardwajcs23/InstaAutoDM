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
  X,
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
  onDisconnectAccount,
  onRefresh,
}) {
  const [selectedPeriod, setSelectedPeriod] = useState('Last 30 days');
  const [activity, setActivity] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showHandleModal, setShowHandleModal] = useState(false);
  const [customHandle, setCustomHandle] = useState('');
  const [savingHandle, setSavingHandle] = useState(false);
  const [handleError, setHandleError] = useState(null);

  // Account Health State
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [healthHistory, setHealthHistory] = useState([]);
  const [healthEvents, setHealthEvents] = useState([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [resumingHealth, setResumingHealth] = useState(false);
  const [healthResumeResult, setHealthResumeResult] = useState(null);

  const fetchFullHealthDetails = async (accId) => {
    const targetId = accId || account?.id;
    if (!targetId) return;
    setLoadingHealth(true);
    setHealthResumeResult(null);
    try {
      const [hRes, histRes, evRes] = await Promise.all([
        apiFetch(`/instagram/accounts/${targetId}/health`),
        apiFetch(`/instagram/accounts/${targetId}/health/history?limit=24`),
        apiFetch(`/instagram/accounts/${targetId}/health/events?limit=15`)
      ]);
      if (hRes.ok) {
        const d = await hRes.json();
        setHealthData(d.health);
      }
      if (histRes.ok) {
        const d = await histRes.json();
        setHealthHistory(d.history || []);
      }
      if (evRes.ok) {
        const d = await evRes.json();
        setHealthEvents(d.events || []);
      }
    } catch (_) {}
    finally {
      setLoadingHealth(false);
    }
  };

  const handleOpenHealthModal = () => {
    setShowHealthModal(true);
    fetchFullHealthDetails(account?.id);
  };

  const handleRequestResume = async (accId) => {
    const targetId = accId || account?.id;
    if (!targetId) return;
    setResumingHealth(true);
    setHealthResumeResult(null);
    try {
      const res = await apiFetch(`/instagram/accounts/${targetId}/health/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Creator requested manual resume from dashboard' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHealthResumeResult({ success: true, message: data.message });
        await fetchFullHealthDetails(targetId);
        if (onRefresh) onRefresh();
      } else {
        setHealthResumeResult({ success: false, message: data.error || 'Unable to resume at this time' });
      }
    } catch (err) {
      setHealthResumeResult({ success: false, message: err.message || 'Error requesting resume' });
    } finally {
      setResumingHealth(false);
    }
  };

  const isFallbackHandle = !!(account?.username && account.username.startsWith('user_'));

  const handleSaveRealHandle = async (e) => {
    if (e) e.preventDefault();
    const clean = customHandle.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return;
    setSavingHandle(true);
    setHandleError(null);
    try {
      const res = await apiFetch('/instagram/account/set-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: account?.id,
          username: clean,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowHandleModal(false);
        if (onRefresh) onRefresh();
      } else {
        setHandleError(data.error || 'Failed to update handle');
      }
    } catch (err) {
      setHandleError(err.message || 'Error updating handle');
    } finally {
      setSavingHandle(false);
    }
  };


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
  const commentsRepliedCount = stats?.commentsRepliedCount ?? 0;
  const totalRepliesUsed = stats?.totalRepliesUsed ?? (dmsSent + commentsRepliedCount);
  const monthlyLimit = stats?.monthlyLimit ?? stats?.dmsLimit ?? 1000;
  const dmsLimit = monthlyLimit;
  const dailyLimit = stats?.dailyLimit || user?.daily_limit || (monthlyLimit === -1 ? -1 : Math.ceil(monthlyLimit / 30));
  const dailyRepliesUsed = stats?.dailyRepliesUsed ?? stats?.usedToday ?? 0;
  const dailyRemaining = stats?.dailyRemaining ?? stats?.remainingToday ?? (dailyLimit === -1 ? 999999 : Math.max(0, dailyLimit - dailyRepliesUsed));
  const monthlyRemaining = stats?.remaining ?? stats?.dmRemaining ?? (monthlyLimit === -1 ? 999999 : Math.max(0, monthlyLimit - totalRepliesUsed));
  const usagePercent = stats?.usagePercent !== undefined ? stats.usagePercent : (monthlyLimit > 0 ? Math.min(100, Math.round((totalRepliesUsed / monthlyLimit) * 100)) : 0);
  const dmPercent = usagePercent;
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

  // Dynamic Meta OAuth token validity (Meta Graph API standard is 60-day token lifetime)
  let tokenValidityText = 'Active (60d)';
  let tokenDaysLeft = 60;
  if (account?.token_expires_at) {
    const msLeft = new Date(account.token_expires_at).getTime() - Date.now();
    tokenDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    tokenValidityText = tokenDaysLeft > 0 ? `${tokenDaysLeft} days left` : 'Expired';
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
            {isConnected && isFallbackHandle && (
              <div style={{
                marginTop: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(234, 88, 12, 0.08)',
                border: '1px solid rgba(234, 88, 12, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}>
                <span style={{ fontSize: '11px', color: '#c2410c', fontWeight: 600 }}>
                  ⚠️ Meta Dev Mode: Real @handle hidden
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomHandle('');
                    setHandleError(null);
                    setShowHandleModal(true);
                  }}
                  style={{
                    background: '#ea580c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Set Real Handle
                </button>
              </div>
            )}
            {isConnected && account?.followers_count !== undefined && account.followers_count > 0 && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-light)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>👥</span>
                <span>{(account?.followers_count || 0).toLocaleString()} followers</span>
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

            {isConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={`https://instagram.com/${account.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textDecoration: 'none',
                    color: 'var(--primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  View <ExternalLink size={11} />
                </a>
                <span style={{ color: 'var(--border-subtle)', fontSize: '11px' }}>•</span>
                <button
                  type="button"
                  onClick={() => onDisconnectAccount && onDisconnectAccount(account?.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#ef4444',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
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
                Connect Account ↗
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Total Reply Limit */}
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
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.06em', marginBottom: '8px' }}>
              TOTAL REPLY LIMIT
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {totalRepliesUsed}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 500 }}>
                / {monthlyLimit === -1 ? 'Unlimited' : monthlyLimit.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span>
                <strong>Monthly:</strong> {totalRepliesUsed} used • {monthlyRemaining === -1 || monthlyRemaining === 999999 ? 'Unlimited' : `${monthlyRemaining.toLocaleString()} remaining`}
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-light)' }}>
                <strong>Today:</strong> {dailyRepliesUsed} used • {dailyLimit === -1 || dailyRemaining === 999999 ? 'Unlimited' : `${dailyRemaining.toLocaleString()} left today`}
              </span>
              <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>
                Combined Quota: {dmsSent} DMs + {commentsRepliedCount || commentsReplied} Comments
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '6px' }}>
              1-Month Plan • Resets in {daysUntilReset} {daysUntilReset === 1 ? 'day' : 'days'} ({resetDateStr})
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
              {usagePercent}%
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

      {/* 2a. Instagram Account Health & Operational Risk Status Card */}
      {isConnected && (
        <div className="card" style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.06em' }}>
                  OPERATIONAL RISK &amp; TRAFFIC CONTROL
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  color: '#6366f1',
                  border: '1px solid rgba(99, 102, 241, 0.2)'
                }}>
                  Airvix Risk Model v1.0
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Instagram Account Health
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)'
                }}>
                  (@{account?.username || 'account'})
                </span>
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Health Status Badge */}
              {(() => {
                const status = stats?.accountHealth?.health_status || 'HEALTHY';
                const score = stats?.accountHealth?.health_score ?? 100;
                let bg = '#ecfdf5';
                let fg = '#059669';
                let label = 'Healthy';
                let icon = '🟢';
                if (status === 'CAUTION') {
                  bg = '#fefce8'; fg = '#b45309'; label = 'Caution'; icon = '🟡';
                } else if (status === 'ELEVATED_RISK') {
                  bg = '#fff7ed'; fg = '#c2410c'; label = 'Elevated Risk'; icon = '🟠';
                } else if (status === 'CRITICAL' || stats?.accountHealth?.automation_mode === 'PAUSED') {
                  bg = '#fef2f2'; fg = '#dc2626'; label = 'Critical / Paused'; icon = '🔴';
                }
                return (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: '99px',
                    background: bg,
                    color: fg,
                    fontSize: '12px',
                    fontWeight: 700,
                    border: `1px solid ${fg}20`
                  }}>
                    <span>{icon}</span> {label} ({score}/100)
                  </span>
                );
              })()}

              {/* Automation Mode Badge */}
              {(() => {
                const mode = stats?.accountHealth?.automation_mode || 'NORMAL';
                let bg = 'rgba(16, 185, 129, 0.1)';
                let fg = '#059669';
                let label = 'Normal Speed';
                if (mode === 'CAUTION') {
                  bg = 'rgba(217, 119, 6, 0.1)'; fg = '#b45309'; label = 'Caution (+4s pacing)';
                } else if (mode === 'PROTECTION') {
                  bg = 'rgba(234, 88, 12, 0.1)'; fg = '#c2410c'; label = 'Protection (+12s, 1-worker)';
                } else if (mode === 'PAUSED') {
                  bg = 'rgba(220, 38, 38, 0.1)'; fg = '#dc2626'; label = 'Automation Paused';
                }
                return (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '99px',
                    background: bg,
                    color: fg,
                    fontSize: '11.5px',
                    fontWeight: 700,
                  }}>
                    <Zap size={12} /> {label}
                  </span>
                );
              })()}

              <button
                type="button"
                onClick={handleOpenHealthModal}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle, #f8fafc)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Activity size={13} /> View Breakdown
              </button>
            </div>
          </div>

          {/* Critical / Paused Banner if applicable */}
          {(stats?.accountHealth?.automation_mode === 'PAUSED' || stats?.accountHealth?.health_status === 'CRITICAL') && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🛑</span> Automation is currently paused for this account
                </div>
                <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '2px' }}>
                  Triggered by observed upstream Meta rate-limits or repeated delivery errors. Outbound jobs are safely queued and held without dropping.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRequestResume(account?.id)}
                disabled={resumingHealth}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: resumingHealth ? 'wait' : 'pointer',
                  opacity: resumingHealth ? 0.7 : 1
                }}
              >
                {resumingHealth ? 'Evaluating...' : 'Resume Automation (Safety Evaluated)'}
              </button>
            </div>
          )}

          {/* 4 Observed Telemetry Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
          }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>
                24h Deliveries
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {stats?.accountHealth?.rolling_24h_successes?.toLocaleString() ?? 0}
              </div>
              <div style={{ fontSize: '10.5px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                Committed sends
              </div>
            </div>

            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>
                Observed Rate Limits (429)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: (stats?.accountHealth?.observed_rate_limit_count || 0) > 0 ? '#ea580c' : 'var(--text-main)', marginTop: '2px' }}>
                {stats?.accountHealth?.observed_rate_limit_count ?? 0}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-light)', marginTop: '2px' }}>
                Rolling 24-hr window
              </div>
            </div>

            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>
                Observed API Errors
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: (stats?.accountHealth?.rolling_24h_failures || 0) > 0 ? '#dc2626' : 'var(--text-main)', marginTop: '2px' }}>
                {stats?.accountHealth?.rolling_24h_failures ?? 0}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-light)', marginTop: '2px' }}>
                Consecutive: {stats?.accountHealth?.consecutive_failures ?? 0}
              </div>
            </div>

            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>
                Recent Error Rate
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: Number(stats?.accountHealth?.recent_error_rate || 0) > 10 ? '#dc2626' : 'var(--text-main)', marginTop: '2px' }}>
                {stats?.accountHealth?.recent_error_rate != null ? `${Number(stats.accountHealth.recent_error_rate).toFixed(1)}%` : '0.0%'}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-light)', marginTop: '2px' }}>
                Pacing delay: +{stats?.accountHealth?.pacing_delay_ms ? (stats.accountHealth.pacing_delay_ms / 1000).toFixed(0) : 0}s
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2b. Connected Instagram Accounts Shared Quota Breakdown (visible when multiple accounts exist) */}
      {((stats?.accountsBreakdown && stats.accountsBreakdown.length > 1) || (accounts && accounts.length > 1)) && (
        <div className="card" style={{
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.06em' }}>
                SHARED SUBSCRIPTION QUOTA ALLOCATION
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0 0' }}>
                Connected Instagram Accounts Breakdown
              </h3>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
              {(stats?.accountsBreakdown || accounts).length} Connected Accounts
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {(stats?.accountsBreakdown && stats.accountsBreakdown.length > 0 ? stats.accountsBreakdown : accounts).map((acc) => (
              <div
                key={acc.id}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f09433, #dc2743)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    {acc.profile_picture_url ? (
                      <img src={acc.profile_picture_url} alt={acc.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Instagram size={18} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                      @{acc.username || 'account'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {acc.full_name || 'Active Channel'}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginBottom: '4px' }}>
                    {(() => {
                      const hStatus = acc.health_status || 'HEALTHY';
                      if (hStatus === 'CAUTION') {
                        return <span style={{ background: '#fefce8', color: '#b45309', fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>🟡 Caution</span>;
                      } else if (hStatus === 'ELEVATED_RISK') {
                        return <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>🟠 Protection</span>;
                      } else if (hStatus === 'CRITICAL' || acc.automation_mode === 'PAUSED') {
                        return <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>🔴 Paused</span>;
                      }
                      return <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>🟢 Healthy</span>;
                    })()}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                    {acc.total !== undefined ? acc.total : '—'} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>replies</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {acc.dms_sent !== undefined ? `${acc.dms_sent} DMs • ${acc.comments_replied} Cmts` : 'Active'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

              {/* Item 2: Plan Validity (Monthly 30-day cycle) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={15} color="#6366f1" />
                  <div>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-main)', display: 'block', lineHeight: 1.2 }}>Plan Validity</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>1-Month cycle (30 days)</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {daysUntilReset} {daysUntilReset === 1 ? 'day' : 'days'} left
                  </span>
                  <span style={{ display: 'block', fontSize: '10px', color: '#6366f1' }}>Resets {resetDateStr}</span>
                </div>
              </div>

              {/* Item 3: Meta API Token Validity (60-day Meta OAuth Token) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={15} color="#10b981" />
                  <div>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-main)', display: 'block', lineHeight: 1.2 }}>Meta API Token</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Instagram OAuth (60d cycle)</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: tokenDaysLeft > 0 ? '#059669' : '#ef4444' }}>
                    {tokenValidityText}
                  </span>
                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>Auto-refreshed</span>
                </div>
              </div>

              {/* Item 4 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={15} color="#10b981" />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>Instagram API</span>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: isConnected ? '#059669' : 'var(--text-muted)' }}>
                  {isConnected ? 'Normal' : 'Disconnected'}
                </span>
              </div>

              {/* Item 5 */}
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
              {(user?.plan || stats?.plan || 'Starter').toUpperCase()} Plan limits (Combined Replies)
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
                {monthlyLimit === -1 ? `${totalRepliesUsed.toLocaleString()} Replies / Unlimited` : `${totalRepliesUsed.toLocaleString()} / ${monthlyLimit.toLocaleString()} Replies`}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {monthlyLimit === -1 ? 'Unlimited' : `${monthlyRemaining.toLocaleString()} remaining`}
              </span>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '6px' }}>
              1-Month Plan • Resets on {resetDateStr} ({daysUntilReset} {daysUntilReset === 1 ? 'day' : 'days'} left)
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
        <div>© 2026 Airvix. All rights reserved.</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/data-deletion" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Data Deletion</a>
          <span style={{ cursor: 'pointer' }} onClick={() => alert('Support: support@airvix.com')}>Support</span>
        </div>
      </footer>

      {/* Set Real Handle Modal */}
      {showHandleModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          animation: 'fadeIn 0.15s ease-out',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '18px',
            padding: '24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            position: 'relative',
          }}>
            <button
              type="button"
              onClick={() => setShowHandleModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'var(--bg-subtle)',
                border: 'none',
                color: 'var(--text-muted)',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>

            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              marginBottom: '14px',
            }}>
              <Instagram size={22} />
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
              Set Your Real Instagram Handle
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Because your Meta Developer App is in <strong>Development Mode</strong>, Meta suppressed your username during OAuth login. Enter your real Instagram handle below to automatically sync your authentic username, profile picture, and follower count.
            </p>

            {handleError && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '12px',
                marginBottom: '12px',
              }}>
                {handleError}
              </div>
            )}

            <form onSubmit={handleSaveRealHandle}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Instagram Username
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
                  <span style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '14px' }}>@</span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={customHandle}
                    onChange={(e) => setCustomHandle(e.target.value)}
                    placeholder="e.g. join_sumit_"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 0',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      outline: 'none',
                      fontWeight: 500,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowHandleModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '9px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHandle || !customHandle.trim()}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '9px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: savingHandle || !customHandle.trim() ? 'not-allowed' : 'pointer',
                    opacity: savingHandle || !customHandle.trim() ? 0.7 : 1,
                  }}
                >
                  {savingHandle ? 'Syncing...' : 'Save & Sync Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Health Breakdown & Safety Audit Modal */}
      {showHealthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-light)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={20} color="#6366f1" /> Account Health &amp; Risk Report
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Internal operational diagnostics and traffic-control pacing for @{account?.username || 'account'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHealthModal(false)}
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {loadingHealth && !healthData ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Loading health telemetry...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Score & Status Hero Banner */}
                <div style={{
                  padding: '18px 20px',
                  borderRadius: '14px',
                  background: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.06em' }}>
                      CURRENT OPERATIONAL STATUS
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '4px' }}>
                      <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-main)' }}>
                        {healthData?.health_score ?? stats?.accountHealth?.health_score ?? 100}
                      </span>
                      <span style={{ fontSize: '14px', color: 'var(--text-light)', fontWeight: 600 }}>/ 100</span>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '99px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: (healthData?.health_status === 'HEALTHY' || (!healthData && stats?.accountHealth?.health_status === 'HEALTHY')) ? '#ecfdf5' : '#fefce8',
                        color: (healthData?.health_status === 'HEALTHY' || (!healthData && stats?.accountHealth?.health_status === 'HEALTHY')) ? '#059669' : '#b45309'
                      }}>
                        {healthData?.health_status || stats?.accountHealth?.health_status || 'HEALTHY'}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.06em' }}>
                      AUTOMATION TRAFFIC MODE
                    </span>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#6366f1', marginTop: '4px' }}>
                      {healthData?.automation_mode || stats?.accountHealth?.automation_mode || 'NORMAL'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {healthData?.pacing_description || 'Standard delivery (no additional traffic pacing)'}
                    </div>
                  </div>
                </div>

                {/* Score Reasons List */}
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
                    Diagnostic Factors &amp; Score Reasons
                  </h4>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'var(--bg-subtle, #f8fafc)',
                    border: '1px solid var(--border-subtle, #e2e8f0)'
                  }}>
                    {(healthData?.score_reasons || stats?.accountHealth?.score_reasons || ['Operational health normal — all delivery signals nominal']).map((reason, idx) => (
                      <div key={idx} style={{ fontSize: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#6366f1' }}>•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Incident Audit Log */}
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
                    Recent Health &amp; Rate-Limit Events
                  </h4>
                  {healthEvents && healthEvents.length > 0 ? (
                    <div style={{
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      maxHeight: '160px',
                      overflowY: 'auto'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-subtle, #f8fafc)', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', textAlign: 'left' }}>
                            <th style={{ padding: '8px 10px', color: 'var(--text-light)' }}>Time</th>
                            <th style={{ padding: '8px 10px', color: 'var(--text-light)' }}>Event</th>
                            <th style={{ padding: '8px 10px', color: 'var(--text-light)' }}>Severity</th>
                            <th style={{ padding: '8px 10px', color: 'var(--text-light)' }}>Code</th>
                          </tr>
                        </thead>
                        <tbody>
                          {healthEvents.map((ev) => (
                            <tr key={ev.id} style={{ borderBottom: '1px solid var(--border-subtle, #f1f5f9)' }}>
                              <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>
                                {ev.occurred_at ? new Date(ev.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-main)' }}>
                                {ev.event_type}
                              </td>
                              <td style={{ padding: '6px 10px' }}>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  background: ev.severity === 'high' || ev.severity === 'critical' ? '#fee2e2' : '#f1f5f9',
                                  color: ev.severity === 'high' || ev.severity === 'critical' ? '#dc2626' : '#475569'
                                }}>
                                  {ev.severity}
                                </span>
                              </td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>
                                {ev.status_code || ev.error_code || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle, #f8fafc)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      textAlign: 'center'
                    }}>
                      No critical error or rate-limit incidents logged in recent activity.
                    </div>
                  )}
                </div>

                {/* Resume Status Feedback Alert */}
                {healthResumeResult && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    background: healthResumeResult.success ? '#ecfdf5' : '#fef2f2',
                    color: healthResumeResult.success ? '#059669' : '#dc2626',
                    border: `1px solid ${healthResumeResult.success ? '#10b981' : '#ef4444'}40`
                  }}>
                    {healthResumeResult.message}
                  </div>
                )}

                {/* Disclaimer Box */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.05)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  fontSize: '11.5px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5
                }}>
                  <strong>Operational Notice:</strong> Airvix Account Health is an internal application traffic-control layer designed to avoid burst concurrency and reduce upstream API errors based on observed HTTP responses. Pacing delays and mode adjustments are internal queue safeguards, not platform guarantees.
                </div>

                {/* Modal Footer Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setShowHealthModal(false)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '9px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>

                  {(healthData?.automation_mode === 'PAUSED' || stats?.accountHealth?.automation_mode === 'PAUSED' || healthData?.automation_mode === 'PROTECTION' || stats?.accountHealth?.automation_mode === 'PROTECTION') && (
                    <button
                      type="button"
                      onClick={() => handleRequestResume(account?.id)}
                      disabled={resumingHealth}
                      style={{
                        padding: '9px 20px',
                        borderRadius: '9px',
                        border: 'none',
                        background: 'var(--primary)',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: resumingHealth ? 'wait' : 'pointer',
                        opacity: resumingHealth ? 0.7 : 1,
                      }}
                    >
                      {resumingHealth ? 'Evaluating cool-down...' : 'Request Controlled Step-Up'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

