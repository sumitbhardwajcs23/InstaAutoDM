// frontend/src/components/AdminView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  CreditCard,
  Sliders,
  TrendingUp,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit3,
  Lock,
  Unlock,
  Sparkles,
  Zap,
  Globe,
  Film,
  MessageSquare,
  Send,
  Eye,
  Save,
  Check,
  X,
  ChevronRight,
  ShieldCheck,
  Server,
  DollarSign,
  Activity,
  Layers
} from 'lucide-react';
import { apiFetch } from '../api/client';

export default function AdminView({ user }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'customization' | 'system'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Overview Stats State
  const [overview, setOverview] = useState(null);

  // Users Management State
  const [usersList, setUsersList] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [userEditLoading, setUserEditLoading] = useState(false);

  // Website Customization State
  const [settings, setSettings] = useState({
    announcement_enabled: true,
    announcement_text: '🚀 Special Launch: Get 30% OFF Pro Plans with code AIRVIX30',
    announcement_badge: 'LIMITED OFFER',
    announcement_link: '#pricing',
    hero_headline: 'Turn conversations into customers.',
    hero_subtitle: 'Automate replies, engage your audience, and convert Instagram comments into sales automatically.',
    primary_cta_text: 'Get Started Free',
    primary_cta_url: '#signup',
    demo_keyword: 'GROWTH',
    support_email: 'support@airvix.com',
    maintenance_mode: false,
    allow_registrations: true,
    free_dm_limit: 1000,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // 1. Fetch Overview
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/admin/overview');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch admin overview');
      setOverview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (userSearch.trim()) params.append('search', userSearch.trim());
      if (userPlanFilter) params.append('plan', userPlanFilter);
      if (userStatusFilter) params.append('status', userStatusFilter);
      params.append('limit', '50');

      const res = await apiFetch(`/admin/users?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      setUsersList(data.users || []);
      setTotalUsers(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userSearch, userPlanFilter, userStatusFilter]);

  // 3. Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/settings');
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (err) {
      console.warn('Could not load site settings:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchOverview();
    fetchSettings();
  }, [fetchOverview, fetchSettings]);

  // Refetch users when tab is opened
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  // Handle Save Settings
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSettingsSaving(true);
    try {
      const res = await apiFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      showToast('🎉 Website & Landing Page customization updated live!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  // Handle User Edit Submit
  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setUserEditLoading(true);
    try {
      const res = await apiFetch(`/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editingUser.name,
          plan: editingUser.plan,
          role: editingUser.role,
          status: editingUser.status,
          reset_dm_usage: editingUser.reset_dm_usage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      showToast(`User @${editingUser.email} updated successfully!`);
      setEditingUser(null);
      fetchUsers();
      fetchOverview();
    } catch (err) {
      alert(err.message);
    } finally {
      setUserEditLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {successToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#059669',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(5, 150, 105, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 9999,
          fontWeight: 600,
          fontSize: '14px'
        }}>
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}>
              <Shield size={20} />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              Super Admin Control Center
            </h1>
            <span style={{
              background: 'rgba(99, 102, 241, 0.14)',
              color: '#6366f1',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '999px',
              border: '1px solid rgba(99, 102, 241, 0.25)'
            }}>
              ADMIN PRIVILEGES
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            Manage platform users, subscriptions, customize the public landing page & announcement banner, and configure global system safeguards.
          </p>
        </div>

        {/* Global Controls & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            padding: '8px 14px',
            borderRadius: '12px',
            fontSize: '13px'
          }}>
            <Server size={15} color="#10b981" />
            <span style={{ color: 'var(--text-muted)' }}>PostgreSQL:</span>
            <b style={{ color: '#10b981' }}>Live</b>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (activeTab === 'overview') fetchOverview();
              else if (activeTab === 'users') fetchUsers();
              else fetchSettings();
            }}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '9px 16px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          fontSize: '13.5px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid var(--border-light)',
        marginBottom: '28px',
        paddingBottom: '2px',
        overflowX: 'auto'
      }}>
        {[
          { id: 'overview', label: '📊 Platform Overview', icon: TrendingUp },
          { id: 'users', label: '👥 Users & Subscriptions', icon: Users, badge: totalUsers > 0 ? totalUsers : null },
          { id: 'customization', label: '🎨 Website & Landing Page', icon: Globe },
          { id: 'system', label: '⚙️ Safeguards & System', icon: Sliders },
        ].map(tab => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                border: 'none',
                borderBottom: isSelected ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                background: 'transparent',
                color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isSelected ? 800 : 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: isSelected ? 'var(--primary-light)' : 'var(--bg-subtle)',
                  color: isSelected ? 'var(--primary)' : 'var(--text-muted)'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: PLATFORM OVERVIEW & METRICS
          ========================================================================= */}
      {activeTab === 'overview' && overview && (
        <div>
          {/* Key Metric Stat Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            marginBottom: '28px'
          }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Users</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={16} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-main)', marginBottom: '4px' }}>
                {overview.totalUsers}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {overview.planBreakdown.pro + overview.planBreakdown.agency} paid subscribers
              </div>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Estimated MRR</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={16} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', marginBottom: '4px' }}>
                ${overview.estimatedMrr}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Monthly recurring revenue run-rate
              </div>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Connected Accounts</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(236,72,153,0.1)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Film size={16} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-main)', marginBottom: '4px' }}>
                {overview.totalIgAccounts}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Active Instagram Business profiles
              </div>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Active Automation Rules</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-main)', marginBottom: '4px' }}>
                {overview.activeRules} <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>/ {overview.totalRules}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Rules actively listening to comments
              </div>
            </div>
          </div>

          {/* Subscription Tiers Distribution & Recent Users */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {/* Plan Breakdown Card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '18px',
              padding: '24px',
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="var(--primary)" />
                Subscription Plan Distribution
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { name: 'Free Plan', key: 'free', price: '$0/mo', count: overview.planBreakdown.free, color: '#64748b' },
                  { name: 'Pro Plan', key: 'pro', price: '$29/mo', count: overview.planBreakdown.pro, color: '#3b82f6' },
                  { name: 'Agency Plan', key: 'agency', price: '$79/mo', count: overview.planBreakdown.agency, color: '#8b5cf6' },
                  { name: 'Enterprise', key: 'enterprise', price: '$199/mo', count: overview.planBreakdown.enterprise, color: '#10b981' },
                ].map(p => {
                  const pct = overview.totalUsers > 0 ? Math.round((p.count / overview.totalUsers) * 100) : 0;
                  return (
                    <div key={p.key} style={{ background: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div>
                          <b style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{p.name}</b>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>({p.price})</span>
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: p.color }}>
                          {p.count} users ({pct}%)
                        </div>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: p.color, borderRadius: '999px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Signups */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '18px',
              padding: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="var(--primary)" />
                  Recent User Registrations
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  View All →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {overview.recentUsers.map(u => (
                  <div key={u.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{u.name || 'User'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: u.plan === 'pro' || u.plan === 'agency' ? 'rgba(37,99,235,0.1)' : 'rgba(0,0,0,0.06)',
                        color: u.plan === 'pro' || u.plan === 'agency' ? '#2563eb' : 'var(--text-muted)'
                      }}>
                        {u.plan}
                      </span>
                      {u.role === 'admin' && (
                        <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#7c3aed', color: '#fff' }}>
                          ADMIN
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: USER & SUBSCRIPTION MANAGEMENT
          ========================================================================= */}
      {activeTab === 'users' && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '18px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          {/* Table Filters & Search Bar */}
          <div style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
              <div style={{
                position: 'relative',
                flex: 1,
                display: 'flex',
                alignItems: 'center'
              }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user by name, email, or ID..."
                  style={{
                    width: '100%',
                    padding: '9px 14px 9px 36px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={userPlanFilter}
                onChange={(e) => setUserPlanFilter(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <option value="">All Plans</option>
                <option value="free">Free Tier</option>
                <option value="pro">Pro Tier</option>
                <option value="agency">Agency Tier</option>
                <option value="enterprise">Enterprise</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended / Banned</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 700 }}>User / Email</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Plan / Tier</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Role</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Connected IG</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>DM Usage</th>
                  <th style={{ padding: '14px 16px', fontWeight: 700 }}>Created</th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No users found matching query.
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => {
                    const isBanned = u.status === 'suspended';
                    return (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          background: isBanned ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{u.name || 'Creator'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>ID: {u.id.slice(0, 8)}...</div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: u.plan === 'pro' || u.plan === 'agency' ? 'rgba(37,99,235,0.1)' : 'rgba(0,0,0,0.06)',
                            color: u.plan === 'pro' || u.plan === 'agency' ? '#2563eb' : 'var(--text-muted)'
                          }}>
                            {u.plan}
                          </span>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          {u.role === 'admin' ? (
                            <span style={{ fontSize: '11.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#7c3aed', color: '#ffffff' }}>
                              ADMIN
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>User</span>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: isBanned ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: isBanned ? '#ef4444' : '#10b981'
                          }}>
                            {isBanned ? 'SUSPENDED' : 'ACTIVE'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{u.connected_accounts_count || 0}</span>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: '4px' }}>({u.rules_count || 0} rules)</span>
                        </td>

                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {u.dm_usage_this_period || 0}
                        </td>

                        <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {u.created_at ? u.created_at.slice(0, 10) : '—'}
                        </td>

                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setEditingUser({ ...u, reset_dm_usage: false })}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700 }}
                          >
                            <Edit3 size={13} style={{ marginRight: '4px' }} />
                            Edit / Upgrade
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: WEBSITE & LANDING PAGE CUSTOMIZATION
          ========================================================================= */}
      {activeTab === 'customization' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 1. Top Announcement Banner Section */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '18px',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                  📢 Public Announcement Banner
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                  Controls the top promotional alert banner visible on the Landing Page and Web Application.
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.announcement_enabled}
                  onChange={(e) => setSettings({ ...settings, announcement_enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Banner Active
                </span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Badge Text
                </label>
                <input
                  type="text"
                  value={settings.announcement_badge}
                  onChange={(e) => setSettings({ ...settings, announcement_badge: e.target.value })}
                  placeholder="e.g. SPECIAL OFFER, NEW"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '13.5px',
                    fontWeight: 700
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Announcement Message
                </label>
                <input
                  type="text"
                  value={settings.announcement_text}
                  onChange={(e) => setSettings({ ...settings, announcement_text: e.target.value })}
                  placeholder="Banner headline or promo code announcement..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '13.5px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Action Link URL / Hash
                </label>
                <input
                  type="text"
                  value={settings.announcement_link}
                  onChange={(e) => setSettings({ ...settings, announcement_link: e.target.value })}
                  placeholder="#pricing or https://..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '13.5px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 2. Hero Headline & Subtitle */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '18px',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
              ⚡ Landing Page Hero Section
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 16px 0' }}>
              Customize the main value proposition, subtitle, and primary call-to-action button.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Hero Headline
                </label>
                <input
                  type="text"
                  value={settings.hero_headline}
                  onChange={(e) => setSettings({ ...settings, hero_headline: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '15px',
                    fontWeight: 700
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Hero Subtitle Description
                </label>
                <textarea
                  rows={2}
                  value={settings.hero_subtitle}
                  onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    lineHeight: 1.5
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Primary CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={settings.primary_cta_text}
                    onChange={(e) => setSettings({ ...settings, primary_cta_text: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      fontWeight: 700
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Primary CTA URL
                  </label>
                  <input
                    type="text"
                    value={settings.primary_cta_url}
                    onChange={(e) => setSettings({ ...settings, primary_cta_url: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Interactive Demo Trigger Keyword
                  </label>
                  <input
                    type="text"
                    value={settings.demo_keyword}
                    onChange={(e) => setSettings({ ...settings, demo_keyword: e.target.value.toUpperCase() })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={settingsSaving}
              className="btn btn-primary"
              style={{ padding: '12px 28px', fontSize: '14.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              <span>{settingsSaving ? 'Saving Changes...' : 'Save & Publish Changes Live'}</span>
            </button>
          </div>
        </form>
      )}

      {/* =========================================================================
          TAB 4: SAFEGUARDS & SYSTEM SETTINGS
          ========================================================================= */}
      {activeTab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '18px',
            padding: '24px',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#10b981" />
              Platform Safeguards & Controls
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Maintenance Mode Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '12px',
                background: settings.maintenance_mode ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-subtle)',
                border: settings.maintenance_mode ? '1.5px solid #ef4444' : '1px solid var(--border-light)'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Maintenance Mode
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    When enabled, only administrators can access the workspace. Visitors see a scheduled maintenance notification.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.maintenance_mode}
                    onChange={(e) => {
                      const updated = { ...settings, maintenance_mode: e.target.checked };
                      setSettings(updated);
                    }}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: settings.maintenance_mode ? '#ef4444' : 'var(--text-main)' }}>
                    {settings.maintenance_mode ? 'ACTIVE' : 'Disabled'}
                  </span>
                </label>
              </div>

              {/* Allow Registration Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-light)'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Allow Public New Registrations
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    When disabled, new signups will be temporarily paused while existing users can continue logging in.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.allow_registrations}
                    onChange={(e) => setSettings({ ...settings, allow_registrations: e.target.checked })}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {settings.allow_registrations ? 'Open' : 'Paused'}
                  </span>
                </label>
              </div>

              {/* Default Free Tier DM Limit */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-light)'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Standard Free Tier Monthly DM Quota
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Monthly automated DM sending allowance granted to free accounts upon registration.
                  </div>
                </div>
                <div style={{ width: '140px' }}>
                  <input
                    type="number"
                    value={settings.free_dm_limit || 1000}
                    onChange={(e) => setSettings({ ...settings, free_dm_limit: parseInt(e.target.value, 10) || 1000 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      fontWeight: 700
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="btn btn-primary"
                style={{ padding: '10px 22px', fontSize: '13.5px', fontWeight: 700 }}
              >
                {settingsSaving ? 'Saving...' : 'Save Safeguards'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT / UPGRADE USER
          ========================================================================= */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '520px',
            border: '1px solid var(--border-light)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Manage User Account
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {editingUser.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  User Name
                </label>
                <input
                  type="text"
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                />
              </div>

              {/* Subscription Plan Overrides */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Subscription Tier / Plan
                </label>
                <select
                  value={editingUser.plan || 'free'}
                  onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <option value="free">Free Tier (1,000 DMs/mo)</option>
                  <option value="pro">Pro Plan (10,000 DMs/mo - $29/mo)</option>
                  <option value="agency">Agency Plan (50,000 DMs/mo - $79/mo)</option>
                  <option value="enterprise">Enterprise Tier (Unlimited)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Role
                  </label>
                  <select
                    value={editingUser.role || 'user'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      fontWeight: 600
                    }}
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Account Status
                  </label>
                  <select
                    value={editingUser.status || 'active'}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-subtle)',
                      color: editingUser.status === 'suspended' ? '#ef4444' : '#10b981',
                      fontSize: '13.5px',
                      fontWeight: 700
                    }}
                  >
                    <option value="active">Active (Normal)</option>
                    <option value="suspended">Suspended / Banned</option>
                  </select>
                </div>
              </div>

              {/* Reset Usage Checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={editingUser.reset_dm_usage || false}
                  onChange={(e) => setEditingUser({ ...editingUser, reset_dm_usage: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                  Reset current monthly DM counter to 0
                </span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn btn-secondary"
                  style={{ padding: '10px 18px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userEditLoading}
                  className="btn btn-primary"
                  style={{ padding: '10px 22px', fontSize: '13px', fontWeight: 700 }}
                >
                  {userEditLoading ? 'Updating...' : 'Save User Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
