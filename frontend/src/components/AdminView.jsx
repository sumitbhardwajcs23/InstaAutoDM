// frontend/src/components/AdminView.jsx
// Dedicated Super Admin Control Center for Airvix
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
  Layers,
  Trash2,
  KeyRound,
  Plus,
  ArrowRight,
  ExternalLink,
  Smartphone,
  Info,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { apiFetch } from '../api/client';
import '../styles/admin.css';

export default function AdminView({ user, onBackToApp }) {
  // Navigation Tabs: 'overview' | 'users' | 'landing' | 'templates' | 'safeguards'
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Overview State
  const [overview, setOverview] = useState(null);

  // Users State
  const [usersList, setUsersList] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [deletingUser, setDeletingUser] = useState(null);

  // Landing Page CMS State
  const [cmsTab, setCmsTab] = useState('hero'); // 'hero' | 'metrics' | 'pricing' | 'faqs' | 'brand'
  const [siteSettings, setSiteSettings] = useState({
    announcement_enabled: true,
    announcement_text: '🚀 Special Launch: Get 30% OFF Pro Plans with code AIRVIX30',
    announcement_badge: 'LIMITED OFFER',
    announcement_link: '#pricing',
    hero_badge: '⚡ Powered by Official Meta Instagram Graph API',
    hero_headline: 'Turn conversations into customers.',
    hero_subtitle: 'Automate replies, engage your audience, and convert Instagram comments into sales automatically.',
    primary_cta_text: 'Get Started Free',
    primary_cta_url: '#signup',
    secondary_cta_text: 'See Live Interactive Demo',
    secondary_cta_url: '#demo',
    demo_keyword: 'GROWTH',
    social_creators: '12,000+',
    social_dms: '4.8M+',
    social_rating: '4.9/5',
    social_reply_speed: '0.8s',
    pro_price_monthly: 29,
    agency_price_monthly: 79,
    enterprise_price_monthly: 199,
    faqs: [
      {
        q: 'Will using Airvix put my Instagram account at risk?',
        a: 'Never. Airvix is built exclusively on official Meta Graph API Webhooks. We do not scrape or use unauthorized private APIs. 100% compliant with Meta Terms of Service.'
      },
      {
        q: 'How fast are the automatic replies sent?',
        a: 'Average response time is 0.8s to 1.8s. Airvix responds while the user is actively watching your reel, maximizing conversions.'
      },
      {
        q: 'Can I send interactive visual cards and buttons in DMs?',
        a: 'Yes! You can configure rich visual cards with cover images, headlines, subtext, and custom button links.'
      }
    ],
    platform_name: 'Airvix',
    support_email: 'support@airvix.com',
    footer_tagline: 'The premier Instagram comment-to-DM conversion engine for creators and brands.',
    maintenance_mode: false,
    allow_registrations: true,
    free_dm_limit: 1000,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Templates Management State
  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [templateFormData, setTemplateFormData] = useState({
    id: '',
    name: '',
    category: 'ecommerce',
    categoryLabel: '🛍️ E-Commerce',
    badge: '🔥 High Converting',
    trigger_keyword: '',
    match_mode: 'contains',
    require_follow: false,
    comment_reply_message: 'Sent details to your DM! 🚀',
    dm_reply_message: 'Hey {username}! Here is the link you requested.',
    card_enabled: 1,
    card_title: '',
    card_subtitle: '',
    card_image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
    card_button_text: 'Open Link 🚀',
    card_button_url: 'https://airvix.com',
    description: '',
  });

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // 1. Fetch Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/admin/overview');
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Users Data
  const loadUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (userSearch) params.set('search', userSearch);
      if (userPlanFilter) params.set('plan', userPlanFilter);
      if (userStatusFilter) params.set('status', userStatusFilter);
      params.set('limit', '50');

      const res = await apiFetch(`/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
        setTotalUsers(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [userSearch, userPlanFilter, userStatusFilter]);

  // 3. Fetch Settings Data
  const loadSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSiteSettings(prev => ({ ...prev, ...data.settings }));
        }
      }
    } catch (err) {
      console.error('Failed to load site settings:', err);
    }
  }, []);

  // 4. Fetch Templates Data
  const loadTemplates = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadOverview();
    loadUsers();
    loadSettings();
    loadTemplates();
  }, [loadOverview, loadUsers, loadSettings, loadTemplates]);

  // Save Settings Handler
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await apiFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(siteSettings),
      });
      if (res.ok) {
        showToast('✅ Landing page customizations saved live!');
      } else {
        const err = await res.json();
        alert(`Failed to save settings: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Network error saving settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  // Update User Handler
  const handleUpdateUser = async (userId, updates) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        showToast('✅ User record updated successfully');
        setEditingUser(null);
        loadUsers();
        loadOverview();
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Could not update user'}`);
      }
    } catch (err) {
      alert(`Error updating user: ${err.message}`);
    }
  };

  // Reset User Password Handler
  const handleResetUserPassword = async (e) => {
    e.preventDefault();
    if (!resetPasswordUser || !newAdminPassword) return;
    try {
      const res = await apiFetch(`/admin/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: newAdminPassword }),
      });
      if (res.ok) {
        showToast(`✅ Password for ${resetPasswordUser.email} has been updated`);
        setResetPasswordUser(null);
        setNewAdminPassword('');
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Could not reset password'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Delete User Handler
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      const res = await apiFetch(`/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(`✅ User ${deletingUser.email} deleted permanently`);
        setDeletingUser(null);
        loadUsers();
        loadOverview();
      } else {
        const err = await res.json();
        alert(`Delete failed: ${err.error || 'Cannot delete user'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Template Save / Create Handler
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      const isEdit = Boolean(editingTemplate);
      const url = isEdit ? `/admin/templates/${editingTemplate.id}` : '/admin/templates';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(templateFormData),
      });

      if (res.ok) {
        showToast(isEdit ? '✅ Template updated successfully' : '✅ New template created successfully');
        setEditingTemplate(null);
        setIsCreatingTemplate(false);
        loadTemplates();
      } else {
        const err = await res.json();
        alert(`Template save failed: ${err.error || 'Invalid template data'}`);
      }
    } catch (err) {
      alert(`Network error saving template: ${err.message}`);
    }
  };

  // Delete Template Handler
  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this automation template? Users will no longer see it.')) return;
    try {
      const res = await apiFetch(`/admin/templates/${templateId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('✅ Template deleted');
        loadTemplates();
      } else {
        const err = await res.json();
        alert(`Delete failed: ${err.error || 'Could not delete template'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Reset Templates to Factory Defaults
  const handleResetTemplates = async () => {
    if (!window.confirm('Reset all templates back to factory defaults? This will restore original preset cards.')) return;
    try {
      const res = await apiFetch('/admin/templates/reset', { method: 'POST' });
      if (res.ok) {
        showToast('✅ Templates restored to factory defaults');
        loadTemplates();
      }
    } catch (err) {
      alert(`Reset error: ${err.message}`);
    }
  };

  // Filter templates list
  const filteredTemplates = templates.filter(tpl => {
    if (templateCategoryFilter !== 'all' && tpl.category !== templateCategoryFilter) return false;
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase();
      const matchName = (tpl.name || '').toLowerCase().includes(q);
      const matchKw = (tpl.trigger_keyword || '').toLowerCase().includes(q);
      const matchCard = (tpl.card_title || '').toLowerCase().includes(q);
      return matchName || matchKw || matchCard;
    }
    return true;
  });

  return (
    <div className="admin-portal-wrapper">
      {/* Toast Notification */}
      {successToast && (
        <div className="admin-toast-banner">
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="admin-navbar">
        <div className="admin-brand-cluster">
          <div className="admin-shield-icon">
            <Shield size={20} />
          </div>
          <div className="admin-title-group">
            <h1>
              <span>Airvix Super Admin Control Center</span>
              <span className="admin-staff-badge">GOVERNANCE</span>
            </h1>
            <div className="admin-subtitle-status">
              <span className="admin-pulse-dot" />
              <span>Live System Operational</span>
              <span>•</span>
              <span>Admin: {user?.email}</span>
            </div>
          </div>
        </div>

        <div className="admin-top-actions">
          <a href="#landing" target="_blank" rel="noreferrer" className="admin-btn-secondary" title="Preview Public Landing Page">
            <ExternalLink size={14} />
            <span>View Live Site</span>
          </a>
          <button 
            type="button" 
            onClick={onBackToApp || (() => { window.location.hash = '#app'; })} 
            className="admin-btn-secondary"
          >
            <ArrowRight size={14} />
            <span>Creator App</span>
          </button>
        </div>
      </header>

      {/* Secondary Tab Navigation Bar */}
      <nav className="admin-tabbar">
        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <TrendingUp size={16} />
          <span>Overview &amp; Pulse</span>
        </button>

        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} />
          <span>Users &amp; Subscriptions ({totalUsers})</span>
        </button>

        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'landing' ? 'active' : ''}`}
          onClick={() => setActiveTab('landing')}
        >
          <Globe size={16} />
          <span>Landing Page CMS</span>
        </button>

        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <Layers size={16} />
          <span>DM Card Templates ({templates.length})</span>
        </button>

        <button
          type="button"
          className={`admin-nav-tab ${activeTab === 'safeguards' ? 'active' : ''}`}
          onClick={() => setActiveTab('safeguards')}
        >
          <SlidersHorizontal size={16} />
          <span>Global Safeguards</span>
        </button>
      </nav>

      {/* Main Admin Content Body */}
      <main className="admin-content-pane">
        {/* =========================================================================
            TAB 1: PLATFORM OVERVIEW & LIVE PULSE
        ========================================================================= */}
        {activeTab === 'overview' && (
          <div>
            {/* KPI Cards */}
            <div className="admin-kpi-grid">
              <div className="admin-kpi-card">
                <div className="admin-kpi-header">
                  <span className="admin-kpi-title">Monthly Run-Rate (MRR)</span>
                  <div className="admin-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <DollarSign size={18} />
                  </div>
                </div>
                <div className="admin-kpi-value" style={{ color: '#10b981' }}>
                  ${overview ? overview.estimatedMrr : '0'}
                </div>
                <div className="admin-kpi-sub">
                  Run-rate based on active paid subscribers
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-header">
                  <span className="admin-kpi-title">Total Registered Creators</span>
                  <div className="admin-kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                    <Users size={18} />
                  </div>
                </div>
                <div className="admin-kpi-value">
                  {overview ? overview.totalUsers : '0'}
                </div>
                <div className="admin-kpi-sub">
                  {overview ? `${overview.planBreakdown.pro + overview.planBreakdown.agency} paid • ${overview.planBreakdown.free} free tier` : 'Loading...'}
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-header">
                  <span className="admin-kpi-title">Connected Instagrams</span>
                  <div className="admin-kpi-icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' }}>
                    <Film size={18} />
                  </div>
                </div>
                <div className="admin-kpi-value">
                  {overview ? overview.totalIgAccounts : '0'}
                </div>
                <div className="admin-kpi-sub">
                  Active Instagram Business accounts
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-header">
                  <span className="admin-kpi-title">Active Automation Rules</span>
                  <div className="admin-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                    <Zap size={18} />
                  </div>
                </div>
                <div className="admin-kpi-value">
                  {overview ? overview.activeRules : '0'}
                </div>
                <div className="admin-kpi-sub">
                  {overview ? `${overview.totalRules} total created` : '0 created'}
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-header">
                  <span className="admin-kpi-title">DMs Delivered Platform-Wide</span>
                  <div className="admin-kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                    <Send size={18} />
                  </div>
                </div>
                <div className="admin-kpi-value">
                  {overview ? overview.totalDmsSent : '0'}
                </div>
                <div className="admin-kpi-sub">
                  Total automated Instagram private cards
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-header">
                  <span className="admin-kpi-title">Comments Auto-Replied</span>
                  <div className="admin-kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                    <MessageSquare size={18} />
                  </div>
                </div>
                <div className="admin-kpi-value">
                  {overview ? overview.totalCommentsReplied : '0'}
                </div>
                <div className="admin-kpi-sub">
                  Public Reel &amp; Post comments answered
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Users */}
            <div className="admin-table-container">
              <div className="admin-table-header-bar">
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                    ⚡ Recent Platform Signups
                  </h2>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Latest creator accounts registered on Airvix
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => { loadOverview(); loadUsers(); }}
                >
                  <RefreshCw size={14} className={loading ? 'spin' : ''} />
                  <span>Refresh Pulse</span>
                </button>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User &amp; Email</th>
                    <th>Plan</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.recentUsers || []).map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{u.name || 'Creator'}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{u.email}</div>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: u.plan === 'agency' ? 'rgba(168,85,247,0.15)' : (u.plan === 'pro' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)'),
                          color: u.plan === 'agency' ? '#c084fc' : (u.plan === 'pro' ? '#60a5fa' : '#94a3b8'),
                          border: '1px solid currentColor'
                        }}>
                          {u.plan}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: u.role === 'admin' ? '#ef4444' : '#94a3b8'
                        }}>
                          {u.role === 'admin' ? '🛡️ Super Admin' : '👤 Creator'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: u.status === 'suspended' ? '#ef4444' : '#10b981'
                        }}>
                          {u.status === 'suspended' ? '● Suspended' : '● Active'}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => {
                            setEditingUser(u);
                            setActiveTab('users');
                          }}
                        >
                          <Edit3 size={12} />
                          <span>Manage</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!overview?.recentUsers || overview.recentUsers.length === 0) && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                        No users currently registered. The database was wiped clean.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: USERS & SUBSCRIPTIONS CONTROLLER
        ========================================================================= */}
        {activeTab === 'users' && (
          <div className="admin-table-container">
            <div className="admin-table-header-bar">
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                  👥 Creator &amp; User Accounts Directory ({totalUsers})
                </h2>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  Manage subscriptions, modify privileges, reset DM usage, or change passwords.
                </p>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="admin-search-input-wrap">
                  <Search size={14} style={{ position: 'absolute', left: '10px', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="admin-search-input"
                  />
                </div>

                <select
                  value={userPlanFilter}
                  onChange={(e) => setUserPlanFilter(e.target.value)}
                  style={{
                    height: '38px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0 12px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="" style={{ background: '#0f172a' }}>All Plans</option>
                  <option value="free" style={{ background: '#0f172a' }}>Free Plan</option>
                  <option value="pro" style={{ background: '#0f172a' }}>Pro Plan</option>
                  <option value="agency" style={{ background: '#0f172a' }}>Agency Plan</option>
                  <option value="enterprise" style={{ background: '#0f172a' }}>Enterprise</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  style={{
                    height: '38px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '0 12px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="" style={{ background: '#0f172a' }}>All Statuses</option>
                  <option value="active" style={{ background: '#0f172a' }}>Active Only</option>
                  <option value="suspended" style={{ background: '#0f172a' }}>Suspended Only</option>
                </select>

                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={loadUsers}
                >
                  <RefreshCw size={14} />
                  <span>Filter</span>
                </button>
              </div>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>User &amp; Email</th>
                  <th>Subscription Plan</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>DMs Used</th>
                  <th>Connected IGs</th>
                  <th>Rules</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{u.name || 'Creator'}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{u.email}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>ID: {u.id}</div>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: u.plan === 'agency' ? 'rgba(168,85,247,0.15)' : (u.plan === 'pro' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)'),
                        color: u.plan === 'agency' ? '#c084fc' : (u.plan === 'pro' ? '#60a5fa' : '#94a3b8'),
                        border: '1px solid currentColor'
                      }}>
                        {u.plan}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: u.role === 'admin' ? '#ef4444' : '#94a3b8'
                      }}>
                        {u.role === 'admin' ? '🛡️ Super Admin' : '👤 Creator'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: u.status === 'suspended' ? '#ef4444' : '#10b981'
                      }}>
                        {u.status === 'suspended' ? '● Suspended' : '● Active'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{u.dm_usage_this_period || 0}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>since {u.usage_period_start || 'start'}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{u.connected_accounts_count || 0}</span> accounts
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{u.rules_count || 0}</span> rules
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          style={{ padding: '5px 8px', fontSize: '11.5px' }}
                          title="Edit User Plan, Role & Status"
                          onClick={() => setEditingUser(u)}
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          style={{ padding: '5px 8px', fontSize: '11.5px' }}
                          title="Set New Password for User"
                          onClick={() => { setResetPasswordUser(u); setNewAdminPassword(''); }}
                        >
                          <KeyRound size={13} />
                          <span>Pass</span>
                        </button>
                        {u.id !== user?.id && (
                          <button
                            type="button"
                            className="admin-btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '11.5px', color: '#f87171', borderColor: 'rgba(239,68,68,0.25)' }}
                            title="Permanently Delete User"
                            onClick={() => setDeletingUser(u)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {usersList.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      No users found matching current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================================
            TAB 3: FULL LANDING PAGE VISUAL CMS
        ========================================================================= */}
        {activeTab === 'landing' && (
          <div style={{ background: 'var(--bg-card, #111827)', border: '1px solid var(--border-light, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                  🎨 Landing Page Visual CMS
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  Live customization of headlines, announcement banner, social metrics, pricing, and FAQs.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <a href="#landing" target="_blank" rel="noreferrer" className="admin-btn-secondary">
                  <Eye size={14} />
                  <span>Preview Landing Page</span>
                </a>
                <button
                  type="button"
                  className="admin-btn-primary"
                  disabled={savingSettings}
                  onClick={handleSaveSettings}
                >
                  <Save size={14} />
                  <span>{savingSettings ? 'Saving to Database...' : 'Save All Changes Live'}</span>
                </button>
              </div>
            </div>

            {/* CMS Sub-tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', overflowX: 'auto' }}>
              {[
                { id: 'hero', label: '🚀 Hero & Announcement' },
                { id: 'metrics', label: '📈 Metrics & Proof' },
                { id: 'pricing', label: '💳 Pricing Tiers' },
                { id: 'faqs', label: '❓ FAQ Items' },
                { id: 'brand', label: '🏢 Brand & Support' }
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setCmsTab(st.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: cmsTab === st.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: cmsTab === st.id ? '#818cf8' : '#94a3b8',
                    border: cmsTab === st.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent'
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* CMS Content: HERO & ANNOUNCEMENT */}
            {cmsTab === 'hero' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {/* Announcement Bar Settings */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 14px 0', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} /> Announcement Top Pill
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#f8fafc' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(siteSettings.announcement_enabled)}
                        onChange={(e) => setSiteSettings(s => ({ ...s, announcement_enabled: e.target.checked }))}
                      />
                      <span>Enable Top Announcement Banner</span>
                    </label>

                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Badge Text</label>
                      <input
                        type="text"
                        value={siteSettings.announcement_badge || ''}
                        onChange={(e) => setSiteSettings(s => ({ ...s, announcement_badge: e.target.value }))}
                        className="admin-input"
                        placeholder="e.g. LIMITED OFFER"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Announcement Message</label>
                      <input
                        type="text"
                        value={siteSettings.announcement_text || ''}
                        onChange={(e) => setSiteSettings(s => ({ ...s, announcement_text: e.target.value }))}
                        className="admin-input"
                        placeholder="e.g. 🚀 Special Launch: 30% OFF with code AIRVIX30"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Target Link</label>
                      <input
                        type="text"
                        value={siteSettings.announcement_link || ''}
                        onChange={(e) => setSiteSettings(s => ({ ...s, announcement_link: e.target.value }))}
                        className="admin-input"
                        placeholder="e.g. #pricing"
                      />
                    </div>
                  </div>
                </div>

                {/* Hero Section Copy */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 14px 0', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={16} /> Hero Section Content
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Hero Badge</label>
                      <input
                        type="text"
                        value={siteSettings.hero_badge || ''}
                        onChange={(e) => setSiteSettings(s => ({ ...s, hero_badge: e.target.value }))}
                        className="admin-input"
                        placeholder="e.g. ⚡ Powered by Official Meta Instagram Graph API"
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Main Headline</label>
                      <textarea
                        rows={2}
                        value={siteSettings.hero_headline || ''}
                        onChange={(e) => setSiteSettings(s => ({ ...s, hero_headline: e.target.value }))}
                        className="admin-input"
                        style={{ height: 'auto', padding: '10px' }}
                        placeholder="e.g. Turn conversations into customers."
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Hero Subtitle</label>
                      <textarea
                        rows={3}
                        value={siteSettings.hero_subtitle || ''}
                        onChange={(e) => setSiteSettings(s => ({ ...s, hero_subtitle: e.target.value }))}
                        className="admin-input"
                        style={{ height: 'auto', padding: '10px' }}
                        placeholder="Detailed value proposition..."
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Primary CTA Text</label>
                        <input
                          type="text"
                          value={siteSettings.primary_cta_text || ''}
                          onChange={(e) => setSiteSettings(s => ({ ...s, primary_cta_text: e.target.value }))}
                          className="admin-input"
                          placeholder="e.g. Get Started Free"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>CTA Link</label>
                        <input
                          type="text"
                          value={siteSettings.primary_cta_url || ''}
                          onChange={(e) => setSiteSettings(s => ({ ...s, primary_cta_url: e.target.value }))}
                          className="admin-input"
                          placeholder="#signup"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CMS Content: METRICS & PROOF */}
            {cmsTab === 'metrics' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Creators Count Metric</label>
                  <input
                    type="text"
                    value={siteSettings.social_creators || ''}
                    onChange={(e) => setSiteSettings(s => ({ ...s, social_creators: e.target.value }))}
                    className="admin-input"
                    placeholder="e.g. 12,000+"
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Displayed on Hero social proof and trust bar.</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Total DMs Delivered Metric</label>
                  <input
                    type="text"
                    value={siteSettings.social_dms || ''}
                    onChange={(e) => setSiteSettings(s => ({ ...s, social_dms: e.target.value }))}
                    className="admin-input"
                    placeholder="e.g. 4.8M+"
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Proven volume indicator on landing page.</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Creator Rating Metric</label>
                  <input
                    type="text"
                    value={siteSettings.social_rating || ''}
                    onChange={(e) => setSiteSettings(s => ({ ...s, social_rating: e.target.value }))}
                    className="admin-input"
                    placeholder="e.g. 4.9/5"
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Stars &amp; review score badge.</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Median Response Speed</label>
                  <input
                    type="text"
                    value={siteSettings.social_reply_speed || ''}
                    onChange={(e) => setSiteSettings(s => ({ ...s, social_reply_speed: e.target.value }))}
                    className="admin-input"
                    placeholder="e.g. 0.8s"
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Speed benchmark for comment-to-DM triggers.</div>
                </div>
              </div>
            )}

            {/* CMS Content: PRICING TIERS */}
            {cmsTab === 'pricing' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#60a5fa' }}>Pro Creator Tier</h4>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Monthly Price ($ USD)</label>
                  <input
                    type="number"
                    value={siteSettings.pro_price_monthly || 29}
                    onChange={(e) => setSiteSettings(s => ({ ...s, pro_price_monthly: parseInt(e.target.value, 10) || 0 }))}
                    className="admin-input"
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>Includes 5,000 automated DMs/mo, card builder, custom keywords.</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#c084fc' }}>Agency &amp; Brand Tier</h4>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Monthly Price ($ USD)</label>
                  <input
                    type="number"
                    value={siteSettings.agency_price_monthly || 79}
                    onChange={(e) => setSiteSettings(s => ({ ...s, agency_price_monthly: parseInt(e.target.value, 10) || 0 }))}
                    className="admin-input"
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>Includes 25,000 automated DMs/mo, multi-account routing, VIP support.</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#10b981' }}>Enterprise Custom Tier</h4>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Monthly Starting Price ($ USD)</label>
                  <input
                    type="number"
                    value={siteSettings.enterprise_price_monthly || 199}
                    onChange={(e) => setSiteSettings(s => ({ ...s, enterprise_price_monthly: parseInt(e.target.value, 10) || 0 }))}
                    className="admin-input"
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>Includes unlimited scale, dedicated account manager, SLA guarantees.</div>
                </div>
              </div>
            )}

            {/* CMS Content: FAQS */}
            {cmsTab === 'faqs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>Manage FAQ questions and answers displayed on the landing page</span>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => {
                      setSiteSettings(s => ({
                        ...s,
                        faqs: [...(s.faqs || []), { q: 'New Question?', a: 'Answer to this question goes here.' }]
                      }));
                    }}
                  >
                    <Plus size={14} />
                    <span>Add FAQ Question</span>
                  </button>
                </div>

                {(siteSettings.faqs || []).map((faq, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8' }}>Question #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSiteSettings(s => ({
                            ...s,
                            faqs: s.faqs.filter((_, i) => i !== idx)
                          }));
                        }}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      value={faq.q}
                      onChange={(e) => {
                        const newQ = e.target.value;
                        setSiteSettings(s => ({
                          ...s,
                          faqs: s.faqs.map((item, i) => i === idx ? { ...item, q: newQ } : item)
                        }));
                      }}
                      className="admin-input"
                      placeholder="Question text..."
                      style={{ marginBottom: '10px' }}
                    />
                    <textarea
                      rows={2}
                      value={faq.a}
                      onChange={(e) => {
                        const newA = e.target.value;
                        setSiteSettings(s => ({
                          ...s,
                          faqs: s.faqs.map((item, i) => i === idx ? { ...item, a: newA } : item)
                        }));
                      }}
                      className="admin-input"
                      style={{ height: 'auto', padding: '10px' }}
                      placeholder="Answer text..."
                    />
                  </div>
                ))}
              </div>
            )}

            {/* CMS Content: BRAND & SUPPORT */}
            {cmsTab === 'brand' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Platform Brand Name</label>
                  <input
                    type="text"
                    value={siteSettings.platform_name || 'Airvix'}
                    onChange={(e) => setSiteSettings(s => ({ ...s, platform_name: e.target.value }))}
                    className="admin-input"
                  />
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Official Support Email</label>
                  <input
                    type="email"
                    value={siteSettings.support_email || 'support@airvix.com'}
                    onChange={(e) => setSiteSettings(s => ({ ...s, support_email: e.target.value }))}
                    className="admin-input"
                  />
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '18px', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Footer Tagline</label>
                  <input
                    type="text"
                    value={siteSettings.footer_tagline || ''}
                    onChange={(e) => setSiteSettings(s => ({ ...s, footer_tagline: e.target.value }))}
                    className="admin-input"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: MESSAGE & CARD TEMPLATES MANAGER
        ========================================================================= */}
        {activeTab === 'templates' && (
          <div>
            {/* Header with Search and Create Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                  🃏 Instagram DM &amp; Reply Card Templates Library
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  Create, edit, or remove pre-designed reply templates shown to creators in their Template Hub.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={handleResetTemplates}
                  title="Restore factory preset templates"
                >
                  <RefreshCw size={14} />
                  <span>Restore Presets</span>
                </button>

                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateFormData({
                      id: `tpl-${Date.now()}`,
                      name: '',
                      category: 'ecommerce',
                      categoryLabel: '🛍️ E-Commerce',
                      badge: '🔥 New Template',
                      trigger_keyword: 'PROMO',
                      match_mode: 'contains',
                      require_follow: false,
                      comment_reply_message: 'Check your DM for the exclusive link! 🚀 | Sent to your inbox! 📩',
                      dm_reply_message: 'Hey {username}! 🎁 Here is the exclusive link you requested:',
                      card_enabled: 1,
                      card_title: 'Special VIP Offer',
                      card_subtitle: 'Tap the button below to claim your discount.',
                      card_image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
                      card_button_text: 'Claim Offer 🚀',
                      card_button_url: 'https://airvix.com',
                      description: 'High-converting card template.',
                    });
                    setIsCreatingTemplate(true);
                  }}
                >
                  <Plus size={16} />
                  <span>Create New Template</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px', flexWrap: 'wrap' }}>
              <div className="admin-search-input-wrap" style={{ flex: 1, minWidth: '260px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search templates by title, keyword, card..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="admin-search-input"
                />
              </div>

              {['all', 'ecommerce', 'education', 'agency', 'services'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTemplateCategoryFilter(cat)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    background: templateCategoryFilter === cat ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    color: templateCategoryFilter === cat ? '#a5b4fc' : '#94a3b8',
                    border: templateCategoryFilter === cat ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  {cat === 'all' ? '🌟 All Categories' : cat}
                </button>
              ))}
            </div>

            {/* Templates Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '22px' }}>
              {filteredTemplates.map(tpl => (
                <div
                  key={tpl.id}
                  style={{
                    background: 'var(--bg-card, #111827)',
                    border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Card Visual Header with Image Preview */}
                  <div style={{ height: '140px', position: 'relative', background: '#0f172a' }}>
                    {tpl.card_image_url ? (
                      <img
                        src={tpl.card_image_url}
                        alt={tpl.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        No Card Cover Image
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px', zIndex: 2 }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 800,
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        backdropFilter: 'blur(4px)'
                      }}>
                        {tpl.categoryLabel || tpl.category}
                      </span>
                      {tpl.require_follow && (
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 800,
                          background: 'rgba(245, 158, 11, 0.9)',
                          color: '#000'
                        }}>
                          🔒 Follow Required
                        </span>
                      )}
                    </div>
                    <div style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 2 }}>
                      <span style={{
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#6366f1',
                        color: '#fff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                      }}>
                        KEYWORD: {tpl.trigger_keyword}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
                      {tpl.name}
                    </h3>
                    <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#94a3b8', lineHeight: 1.4, flex: 1 }}>
                      {tpl.description || tpl.card_subtitle || 'High converting DM card template.'}
                    </p>

                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px', marginBottom: '14px', fontSize: '11.5px', color: '#cbd5e1' }}>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: '#64748b' }}>Card Title: </span>
                        <span style={{ fontWeight: 700 }}>{tpl.card_title || tpl.name}</span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Button: </span>
                        <span style={{ color: '#818cf8', fontWeight: 600 }}>{tpl.card_button_text}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => setPreviewTemplate(tpl)}
                      >
                        <Eye size={13} />
                        <span>Preview</span>
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => {
                            setEditingTemplate(tpl);
                            setTemplateFormData({ ...tpl });
                            setIsCreatingTemplate(false);
                          }}
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          style={{ padding: '6px 8px', fontSize: '12px', color: '#f87171', borderColor: 'rgba(239,68,68,0.25)' }}
                          title="Delete Template"
                          onClick={() => handleDeleteTemplate(tpl.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredTemplates.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#64748b' }}>
                  No templates match current filters. Click "+ Create New Template" to add one.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: GLOBAL SAFEGUARDS & SYSTEM
        ========================================================================= */}
        {activeTab === 'safeguards' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '22px' }}>
            {/* System Switches */}
            <div style={{ background: 'var(--bg-card, #111827)', border: '1px solid var(--border-light, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={18} color="#818cf8" /> Platform Access Switches
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>Allow Public Signups</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>If disabled, new users cannot register.</div>
                  </div>
                  <input
                    type="checkbox"
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    checked={Boolean(siteSettings.allow_registrations)}
                    onChange={(e) => setSiteSettings(s => ({ ...s, allow_registrations: e.target.checked }))}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#fca5a5' }}>Maintenance Mode</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Locks down workspace access for updates.</div>
                  </div>
                  <input
                    type="checkbox"
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    checked={Boolean(siteSettings.maintenance_mode)}
                    onChange={(e) => setSiteSettings(s => ({ ...s, maintenance_mode: e.target.checked }))}
                  />
                </div>

                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <label style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc', display: 'block', marginBottom: '6px' }}>
                    Free Tier Monthly DM Limit
                  </label>
                  <input
                    type="number"
                    value={siteSettings.free_dm_limit || 1000}
                    onChange={(e) => setSiteSettings(s => ({ ...s, free_dm_limit: parseInt(e.target.value, 10) || 0 }))}
                    className="admin-input"
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Maximum free automated responses before requiring an upgrade.</div>
                </div>

                <button
                  type="button"
                  className="admin-btn-primary"
                  disabled={savingSettings}
                  onClick={handleSaveSettings}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Save size={15} />
                  <span>Save Safeguards</span>
                </button>
              </div>
            </div>

            {/* Diagnostics Card */}
            <div style={{ background: 'var(--bg-card, #111827)', border: '1px solid var(--border-light, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} color="#10b981" /> System &amp; Meta API Health
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Database Engine</span>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>Neon PostgreSQL (Pure PG Mode)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Meta Graph API</span>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>Online (v21.0 Webhooks)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Security Protocol</span>
                  <span style={{ fontWeight: 700, color: '#818cf8' }}>256-Bit SSL Encrypted</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '13px' }}>
                  <span style={{ color: '#94a3b8' }}>Platform Version</span>
                  <span style={{ fontWeight: 700, color: '#f8fafc' }}>v3.4.0 (Enterprise Admin)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODAL: EDIT USER (PLAN / ROLE / STATUS)
      ========================================================================= */}
      {editingUser && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}>
          <div className="admin-modal-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                ✏️ Manage Creator Account
              </h3>
              <button type="button" onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', marginBottom: '18px' }}>
              <div style={{ fontWeight: 700, color: '#f8fafc' }}>{editingUser.name}</div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{editingUser.email}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12.5px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Subscription Plan</label>
                <select
                  value={editingUser.plan}
                  onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value })}
                  className="admin-input"
                  style={{ padding: '0 12px' }}
                >
                  <option value="free" style={{ background: '#0f172a' }}>Free Plan (1,000 DMs/mo)</option>
                  <option value="pro" style={{ background: '#0f172a' }}>Pro Plan (5,000 DMs/mo)</option>
                  <option value="agency" style={{ background: '#0f172a' }}>Agency Plan (25,000 DMs/mo)</option>
                  <option value="enterprise" style={{ background: '#0f172a' }}>Enterprise (Unlimited)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>System Role</label>
                <select
                  value={editingUser.role || 'user'}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="admin-input"
                  style={{ padding: '0 12px' }}
                >
                  <option value="user" style={{ background: '#0f172a' }}>Regular Creator (User)</option>
                  <option value="admin" style={{ background: '#0f172a' }}>Super Administrator (Admin)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Account Status</label>
                <select
                  value={editingUser.status || 'active'}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                  className="admin-input"
                  style={{ padding: '0 12px' }}
                >
                  <option value="active" style={{ background: '#0f172a' }}>Active (Normal Access)</option>
                  <option value="suspended" style={{ background: '#0f172a' }}>Suspended (Login Blocked)</option>
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#f8fafc', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={Boolean(editingUser.reset_dm_usage)}
                  onChange={(e) => setEditingUser({ ...editingUser, reset_dm_usage: e.target.checked })}
                />
                <span>Reset DM usage counter to 0 for this period</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="admin-btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={() => handleUpdateUser(editingUser.id, {
                    plan: editingUser.plan,
                    role: editingUser.role,
                    status: editingUser.status,
                    reset_dm_usage: editingUser.reset_dm_usage
                  })}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADMIN RESET USER PASSWORD
      ========================================================================= */}
      {resetPasswordUser && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setResetPasswordUser(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#f8fafc' }}>
                🔑 Set User Password
              </h3>
              <button type="button" onClick={() => setResetPasswordUser(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
              Set a new password for <strong style={{ color: '#f8fafc' }}>{resetPasswordUser.email}</strong>.
            </p>

            <form onSubmit={handleResetUserPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>New Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="admin-input"
                  placeholder="Enter new password..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="admin-btn-secondary" onClick={() => setResetPasswordUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CONFIRM DELETE USER
      ========================================================================= */}
      {deletingUser && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeletingUser(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '14px' }}>
              <AlertCircle size={22} />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Confirm User Deletion</h3>
            </div>

            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 18px 0' }}>
              Are you sure you want to permanently delete user <strong style={{ color: '#ffffff' }}>{deletingUser.email}</strong>?
              All associated Instagram accounts, automation rules, comments, and conversation threads will be purged.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="admin-btn-secondary" onClick={() => setDeletingUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                style={{ background: '#dc2626', borderColor: '#ef4444' }}
                onClick={handleDeleteUser}
              >
                Permanently Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE / EDIT TEMPLATE
      ========================================================================= */}
      {(isCreatingTemplate || editingTemplate) && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setIsCreatingTemplate(false); setEditingTemplate(null); } }}>
          <div className="admin-modal-box" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                {editingTemplate ? '✏️ Edit Template Card' : '✨ Create New Instagram Template'}
              </h3>
              <button type="button" onClick={() => { setIsCreatingTemplate(false); setEditingTemplate(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Template Name</label>
                  <input
                    type="text"
                    required
                    value={templateFormData.name}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. VIP Promo Code Drop"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Category</label>
                  <select
                    value={templateFormData.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const labels = {
                        ecommerce: '🛍️ E-Commerce',
                        creator: '🎓 Creators & Coaches',
                        lead_magnet: '🔒 Follower Check',
                        services: '💼 Services & Agencies',
                        general: '⚡ Custom Automation'
                      };
                      setTemplateFormData({
                        ...templateFormData,
                        category: cat,
                        categoryLabel: labels[cat] || '⚡ Custom Automation'
                      });
                    }}
                    className="admin-input"
                    style={{ padding: '0 12px' }}
                  >
                    <option value="ecommerce" style={{ background: '#0f172a' }}>🛍️ E-Commerce &amp; Retail</option>
                    <option value="creator" style={{ background: '#0f172a' }}>🎓 Creators &amp; Coaches</option>
                    <option value="lead_magnet" style={{ background: '#0f172a' }}>🔒 Follower Check / Lead Magnet</option>
                    <option value="services" style={{ background: '#0f172a' }}>💼 Services &amp; Agencies</option>
                    <option value="general" style={{ background: '#0f172a' }}>⚡ General Purpose</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Trigger Keyword</label>
                  <input
                    type="text"
                    required
                    value={templateFormData.trigger_keyword}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, trigger_keyword: e.target.value.toUpperCase() })}
                    className="admin-input"
                    placeholder="e.g. DISCOUNT"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Card Badge Text</label>
                  <input
                    type="text"
                    value={templateFormData.badge}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, badge: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. 🔥 High Conversion"
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#f8fafc' }}>
                <input
                  type="checkbox"
                  checked={Boolean(templateFormData.require_follow)}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, require_follow: e.target.checked })}
                />
                <span>🔒 Follower Check (Require user to follow your page before sending DM link)</span>
              </label>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Public Comment Reply Text (use | for random variations)</label>
                <input
                  type="text"
                  value={templateFormData.comment_reply_message}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, comment_reply_message: e.target.value })}
                  className="admin-input"
                  placeholder="Check your DM! 🚀 | Sent to your inbox! 📩"
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Direct Message Text Copy</label>
                <textarea
                  rows={2}
                  value={templateFormData.dm_reply_message}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, dm_reply_message: e.target.value })}
                  className="admin-input"
                  style={{ height: 'auto', padding: '10px' }}
                  placeholder="Hey {username}! Here is your download link..."
                />
              </div>

              {/* Rich Visual Card Details */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#818cf8' }}>
                  🃏 Instagram Visual DM Card Settings
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Card Title</label>
                      <input
                        type="text"
                        value={templateFormData.card_title}
                        onChange={(e) => setTemplateFormData({ ...templateFormData, card_title: e.target.value })}
                        className="admin-input"
                        placeholder="e.g. 🎁 20% Discount Code"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Button Text</label>
                      <input
                        type="text"
                        value={templateFormData.card_button_text}
                        onChange={(e) => setTemplateFormData({ ...templateFormData, card_button_text: e.target.value })}
                        className="admin-input"
                        placeholder="e.g. Shop 20% Off 🛍️"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Card Subtitle</label>
                    <input
                      type="text"
                      value={templateFormData.card_subtitle}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, card_subtitle: e.target.value })}
                      className="admin-input"
                      placeholder="Use code VIP20 at checkout today only!"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Card Cover Image URL</label>
                    <input
                      type="url"
                      value={templateFormData.card_image_url}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, card_image_url: e.target.value })}
                      className="admin-input"
                      placeholder="https://images.unsplash.com/photo-..."
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Destination Button URL</label>
                    <input
                      type="url"
                      value={templateFormData.card_button_url}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, card_button_url: e.target.value })}
                      className="admin-input"
                      placeholder="https://yourbrand.com/offer"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="admin-btn-secondary" onClick={() => { setIsCreatingTemplate(false); setEditingTemplate(null); }}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  {editingTemplate ? 'Save Template Changes' : 'Publish New Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: LIVE PHONE DM PREVIEW
      ========================================================================= */}
      {previewTemplate && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPreviewTemplate(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '400px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Smartphone size={16} color="#818cf8" />
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>Live Instagram DM Preview</span>
              </div>
              <button type="button" onClick={() => setPreviewTemplate(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Simulated Phone Card */}
            <div style={{ background: '#ffffff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
              <div style={{ height: '160px', position: 'relative', background: '#0f172a' }}>
                <img
                  src={previewTemplate.card_image_url}
                  alt={previewTemplate.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                  INSTAGRAM CARD
                </div>
              </div>

              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                  {previewTemplate.card_title || previewTemplate.name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4, marginBottom: '16px' }}>
                  {previewTemplate.card_subtitle || previewTemplate.description}
                </div>

                <a
                  href={previewTemplate.card_button_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 0',
                    background: '#6366f1',
                    color: '#ffffff',
                    textAlign: 'center',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                  }}
                >
                  {previewTemplate.card_button_text}
                </a>
              </div>
            </div>

            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => setPreviewTemplate(null)}
              style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
