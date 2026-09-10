// frontend/src/components/AdminView.jsx
// Dedicated Super Admin Control Center for Airvix with Collapsible Sidebar & Live Plan Preview
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
  ChevronLeft,
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
  ChevronDown,
  Receipt,
  UserX,
  UserCheck,
  Copy
} from 'lucide-react';
import { apiFetch } from '../api/client';
import '../styles/admin.css';

export default function AdminView({ user, onBackToApp }) {
  // Sidebar & Main Navigation Tabs: 'overview' | 'users' | 'plans' | 'landing' | 'templates' | 'safeguards'
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Overview State
  const [overview, setOverview] = useState(null);

  // Users State & Access Control
  const [usersList, setUsersList] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [deletingUser, setDeletingUser] = useState(null);
  
  // Detailed Inspect User Modal State
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  // Subscriptions & Plans CRUD State
  const [plansList, setPlansList] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [planFormData, setPlanFormData] = useState({
    id: '',
    slug: '',
    name: '',
    monthlyPrice: 29,
    annualPrice: 24,
    dmLimit: 25000,
    igLimit: 3,
    rulesLimit: 25,
    badge: '🔥 MOST POPULAR',
    popular: true,
    description: '',
    features: [
      '25,000 Automated DMs / Mo',
      '3 Connected Instagram Accounts',
      '25 Active Keyword Rules',
      'Follow-Gated Private Cards',
      'Instant 0.8s Response Engine',
      'Priority Email Support'
    ],
    active: true
  });
  const [planFeaturesText, setPlanFeaturesText] = useState('');

  // Payment System State
  const [paymentsList, setPaymentsList] = useState([]);
  const [paymentsSummary, setPaymentsSummary] = useState(null);

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

  // Fetch Single User Details (Inspect Modal)
  const loadUserDetail = async (userId) => {
    try {
      setLoadingUserDetail(true);
      const res = await apiFetch(`/admin/users/${userId}/details`);
      if (res.ok) {
        const data = await res.json();
        setSelectedUserDetail(data.user);
      } else {
        alert('Could not fetch user details');
      }
    } catch (err) {
      alert(`Error loading user details: ${err.message}`);
    } finally {
      setLoadingUserDetail(false);
    }
  };

  // 3. Fetch Plans Data
  const loadPlans = useCallback(async () => {
    try {
      setLoadingPlans(true);
      const res = await apiFetch('/admin/plans');
      if (res.ok) {
        const data = await res.json();
        setPlansList(data.plans || []);
      }
    } catch (err) {
      console.error('Failed to load pricing plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  // 4. Fetch Payments Data
  const loadPayments = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/payments');
      if (res.ok) {
        const data = await res.json();
        setPaymentsList(data.transactions || []);
        setPaymentsSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  }, []);

  // 5. Fetch Settings Data
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

  // 6. Fetch Templates Data
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
    loadPlans();
    loadPayments();
    loadSettings();
    loadTemplates();
  }, [loadOverview, loadUsers, loadPlans, loadPayments, loadSettings, loadTemplates]);

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
        if (selectedUserDetail && selectedUserDetail.id === userId) {
          loadUserDetail(userId);
        }
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
        if (selectedUserDetail && selectedUserDetail.id === deletingUser.id) {
          setSelectedUserDetail(null);
        }
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

  // Save / Create Pricing Plan Handler
  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      const isEdit = Boolean(editingPlan);
      const url = isEdit ? `/admin/plans/${editingPlan.id}` : '/admin/plans';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...planFormData,
        features: planFeaturesText ? planFeaturesText.split('\n').map(s => s.trim()).filter(Boolean) : planFormData.features
      };

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isEdit ? '✅ Pricing plan updated live' : '✅ New pricing plan created');
        setEditingPlan(null);
        setIsCreatingPlan(false);
        loadPlans();
      } else {
        const err = await res.json();
        alert(`Plan save failed: ${err.error || 'Invalid plan data'}`);
      }
    } catch (err) {
      alert(`Error saving plan: ${err.message}`);
    }
  };

  // Delete Pricing Plan Handler
  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Delete this pricing plan permanently?')) return;
    try {
      const res = await apiFetch(`/admin/plans/${planId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('✅ Plan deleted');
        loadPlans();
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Could not delete plan'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Reset Pricing Plans Handler
  const handleResetPlans = async () => {
    if (!window.confirm('Reset all pricing plans back to factory defaults?')) return;
    try {
      const res = await apiFetch('/admin/plans/reset', { method: 'POST' });
      if (res.ok) {
        showToast('✅ Pricing plans reset to default');
        loadPlans();
      }
    } catch (err) {
      alert(`Reset error: ${err.message}`);
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
    <div className="admin-layout-wrapper">
      {/* Toast Notification */}
      {successToast && (
        <div className="admin-toast-banner">
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* =========================================================================
          LEFT COLLAPSIBLE ADMIN SIDEBAR
      ========================================================================= */}
      <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-logo-icon">
            <Shield size={20} />
          </div>
          {!isSidebarCollapsed && (
            <div className="admin-sidebar-brand-text">
              <h2>Airvix Admin <span className="admin-staff-badge">GOVERNANCE</span></h2>
              <p>Control Center v2.4</p>
            </div>
          )}
        </div>

        <div className="admin-sidebar-nav">
          <div className="admin-sidebar-menu-group">
            <div className="admin-sidebar-section-title">CORE GOVERNANCE</div>
            <button
              type="button"
              className={`admin-sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
              title="Overview & System Pulse"
            >
              <TrendingUp size={18} />
              <span>Overview &amp; Pulse</span>
            </button>

            <button
              type="button"
              className={`admin-sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
              title="Users Directory & Access Control"
            >
              <Users size={18} />
              <span>Users &amp; Access</span>
              <span className="admin-sidebar-item-badge">{totalUsers}</span>
            </button>
          </div>

          <div className="admin-sidebar-menu-group">
            <div className="admin-sidebar-section-title">MONETIZATION</div>
            <button
              type="button"
              className={`admin-sidebar-item ${activeTab === 'plans' ? 'active' : ''}`}
              onClick={() => setActiveTab('plans')}
              title="Subscriptions, Pricing Plans CRUD & Payments"
            >
              <CreditCard size={18} />
              <span>Plans &amp; Payments</span>
            </button>
          </div>

          <div className="admin-sidebar-menu-group">
            <div className="admin-sidebar-section-title">PLATFORM MANAGEMENT</div>
            <button
              type="button"
              className={`admin-sidebar-item ${activeTab === 'landing' ? 'active' : ''}`}
              onClick={() => setActiveTab('landing')}
              title="Landing Page Visual CMS"
            >
              <Globe size={18} />
              <span>Landing Page CMS</span>
            </button>

            <button
              type="button"
              className={`admin-sidebar-item ${activeTab === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveTab('templates')}
              title="DM Interactive Card Templates"
            >
              <Layers size={18} />
              <span>DM Card Templates</span>
              <span className="admin-sidebar-item-badge">{templates.length}</span>
            </button>

            <button
              type="button"
              className={`admin-sidebar-item ${activeTab === 'safeguards' ? 'active' : ''}`}
              onClick={() => setActiveTab('safeguards')}
              title="Global System Safeguards & Limits"
            >
              <SlidersHorizontal size={18} />
              <span>Global Safeguards</span>
            </button>
          </div>
        </div>

        <div className="admin-sidebar-footer">
          {!isSidebarCollapsed && (
            <div className="admin-sidebar-user-pill">
              <div className="admin-sidebar-avatar">
                {user?.email ? user.email.slice(0, 2).toUpperCase() : 'AD'}
              </div>
              <div className="admin-sidebar-user-info">
                <div>{user?.email || 'Super Admin'}</div>
                <span>Super Admin</span>
              </div>
            </div>
          )}

          <button
            type="button"
            className="admin-btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onBackToApp || (() => { window.location.hash = '#app'; })}
          >
            <ArrowRight size={14} />
            {!isSidebarCollapsed && <span>Creator App</span>}
          </button>

          <button
            type="button"
            className="admin-sidebar-toggle-btn"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!isSidebarCollapsed && <span>Collapse Sidebar</span>}
          </button>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT MAIN CONTAINER
      ========================================================================= */}
      <div className="admin-main-container">
        {/* Top Header */}
        <header className="admin-layout-header">
          <div className="admin-layout-title">
            <h1>Airvix Governance Control Center</h1>
            <div className="admin-subtitle-status" style={{ margin: 0 }}>
              <span className="admin-pulse-dot" />
              <span>Live Operational System</span>
            </div>
          </div>
          <div className="admin-top-actions">
            <a href="#landing" target="_blank" rel="noreferrer" className="admin-btn-secondary" title="Preview Public Landing Page">
              <ExternalLink size={14} />
              <span>View Live Site</span>
            </a>
          </div>
        </header>

        {/* Main Content Pane */}
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
                              loadUserDetail(u.id);
                            }}
                          >
                            <Info size={13} />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!overview?.recentUsers || overview.recentUsers.length === 0) && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                          No users currently registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: USERS DIRECTORY & ACCESS CONTROL
          ========================================================================= */}
          {activeTab === 'users' && (
            <div className="admin-table-container">
              <div className="admin-table-header-bar">
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                    👥 Creator Accounts Directory ({totalUsers})
                  </h2>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    View connected Instagram IDs, DM tokens used/left, control access permissions, or block users.
                  </p>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div className="admin-search-input-wrap">
                    <Search size={14} style={{ position: 'absolute', left: '10px', color: '#64748b' }} />
                    <input
                      type="text"
                      placeholder="Search by name, email, or User ID..."
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
                    <th>User &amp; Details</th>
                    <th>Subscription Plan</th>
                    <th>Role</th>
                    <th>Access Status</th>
                    <th>DMs / Tokens Used</th>
                    <th>Connected Accounts</th>
                    <th style={{ textAlign: 'right' }}>Access Control</th>
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
                          {u.status === 'suspended' ? '● Suspended (Blocked)' : '● Active'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{u.dm_usage_this_period || 0} DMs</div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>Used this period</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>{u.connected_accounts_count || 0}</span> accounts
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="admin-btn-secondary"
                            style={{ padding: '5px 9px', fontSize: '11.5px', color: '#818cf8', borderColor: 'rgba(99,102,241,0.3)' }}
                            title="Inspect User Details & Access Control"
                            onClick={() => loadUserDetail(u.id)}
                          >
                            <Info size={13} />
                            <span>Details</span>
                          </button>

                          <button
                            type="button"
                            className="admin-btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '11.5px' }}
                            title="Edit Plan & Role"
                            onClick={() => setEditingUser(u)}
                          >
                            <Edit3 size={13} />
                          </button>

                          <button
                            type="button"
                            className="admin-btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '11.5px' }}
                            title="Set Password"
                            onClick={() => { setResetPasswordUser(u); setNewAdminPassword(''); }}
                          >
                            <KeyRound size={13} />
                          </button>

                          {u.id !== user?.id && (
                            <button
                              type="button"
                              className="admin-btn-secondary"
                              style={{ padding: '5px 8px', fontSize: '11.5px', color: '#f87171', borderColor: 'rgba(239,68,68,0.25)' }}
                              title="Delete User Permanently"
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
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        No users found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* =========================================================================
              TAB 3: SUBSCRIPTIONS, PRICING PLANS CRUD & PAYMENTS OVERVIEW
          ========================================================================= */}
          {activeTab === 'plans' && (
            <div className="admin-plans-container">
              {/* Header Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                    💳 Subscriptions, Pricing Plans CRUD &amp; Live Preview
                  </h2>
                  <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Manage tier pricing, DM token limits, features, live plan visual preview, and payment transaction logs.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={handleResetPlans}
                  >
                    <RefreshCw size={14} />
                    <span>Reset Defaults</span>
                  </button>

                  <button
                    type="button"
                    className="admin-btn-primary"
                    onClick={() => {
                      setEditingPlan(null);
                      setPlanFormData({
                        id: `plan-${Date.now()}`,
                        slug: 'custom-plan',
                        name: 'Custom Creator VIP',
                        monthlyPrice: 49,
                        annualPrice: 39,
                        dmLimit: 50000,
                        igLimit: 5,
                        rulesLimit: 50,
                        badge: '⚡ SPECIAL TIER',
                        popular: false,
                        description: 'Custom tailored features for high volume creators.',
                        features: [
                          '50,000 Automated DMs / Mo',
                          '5 Connected IG Accounts',
                          '50 Active Rules',
                          'Live Brand Visual Cards',
                          'VIP Support'
                        ],
                        active: true
                      });
                      setPlanFeaturesText("50,000 Automated DMs / Mo\n5 Connected IG Accounts\n50 Active Rules\nLive Brand Visual Cards\nVIP Support");
                      setIsCreatingPlan(true);
                    }}
                  >
                    <Plus size={14} />
                    <span>Create New Plan</span>
                  </button>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="admin-plans-grid">
                {plansList.map(plan => (
                  <div key={plan.id} className={`admin-plan-card ${plan.popular ? 'popular' : ''}`}>
                    {plan.badge && (
                      <div className="admin-plan-badge-top">
                        {plan.badge}
                      </div>
                    )}

                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                      {plan.name}
                    </h3>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', minHeight: '34px' }}>
                      {plan.description}
                    </p>

                    <div className="admin-plan-price-tag">
                      <span className="admin-plan-amount">${plan.monthlyPrice}</span>
                      <span className="admin-plan-period">/ month</span>
                      {plan.annualPrice > 0 && (
                        <span style={{ fontSize: '11px', color: '#10b981', marginLeft: 'auto', fontWeight: 700 }}>
                          (${plan.annualPrice}/mo annual)
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', margin: '8px 0', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        {plan.dmLimit.toLocaleString()} DMs/mo
                      </span>
                      <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        {plan.igLimit} IG Account{plan.igLimit > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="admin-plan-feature-list">
                      {(plan.features || []).map((feat, idx) => (
                        <div key={idx} className="admin-plan-feature-item">
                          <CheckCircle2 size={14} color="#10b981" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => {
                          setEditingPlan(plan);
                          setPlanFormData(plan);
                          setPlanFeaturesText(Array.isArray(plan.features) ? plan.features.join('\n') : '');
                          setIsCreatingPlan(true);
                        }}
                      >
                        <Edit3 size={13} />
                        <span>Edit Plan</span>
                      </button>

                      <button
                        type="button"
                        className="admin-btn-secondary"
                        style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
                        onClick={() => handleDeletePlan(plan.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payments & Transactions Log */}
              <div className="admin-table-container" style={{ marginTop: '20px' }}>
                <div className="admin-table-header-bar">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                      🧾 Platform Payments &amp; Transactions History
                    </h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                      Recorded subscriber billing charges, plan upgrades, and revenue ledger.
                    </p>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>
                    Gateway Status: {paymentsSummary?.gateway_status || 'Live Online'}
                  </div>
                </div>

                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Subscriber</th>
                      <th>Subscription Plan</th>
                      <th>Amount Charged</th>
                      <th>Gateway</th>
                      <th>Status</th>
                      <th>Transaction Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsList.map(tx => (
                      <tr key={tx.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#f8fafc' }}>{tx.user_name}</div>
                          <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{tx.user_email}</div>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: 'rgba(99,102,241,0.15)',
                            color: '#818cf8'
                          }}>
                            {tx.plan}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, color: '#10b981', fontSize: '14px' }}>
                            ${tx.amount} {tx.currency}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: '#cbd5e1' }}>
                          {tx.gateway}
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                            ● {tx.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(tx.payment_date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {paymentsList.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                          No payment transactions logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 4: FULL LANDING PAGE VISUAL CMS
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
                    className={`admin-nav-tab ${cmsTab === st.id ? 'active' : ''}`}
                    onClick={() => setCmsTab(st.id)}
                    style={{ padding: '8px 14px', fontSize: '12.5px' }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab 1: Hero */}
              {cmsTab === 'hero' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 600, color: '#f8fafc', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={siteSettings.announcement_enabled}
                      onChange={(e) => setSiteSettings({ ...siteSettings, announcement_enabled: e.target.checked })}
                    />
                    <span>Show Announcement Banner on Landing Header</span>
                  </label>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Announcement Text</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={siteSettings.announcement_text}
                      onChange={(e) => setSiteSettings({ ...siteSettings, announcement_text: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Hero Badge Tagline</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={siteSettings.hero_badge}
                      onChange={(e) => setSiteSettings({ ...siteSettings, hero_badge: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Main Headline</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={siteSettings.hero_headline}
                      onChange={(e) => setSiteSettings({ ...siteSettings, hero_headline: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Hero Subtitle Copy</label>
                    <textarea
                      rows={3}
                      className="admin-input"
                      style={{ height: 'auto', padding: '12px' }}
                      value={siteSettings.hero_subtitle}
                      onChange={(e) => setSiteSettings({ ...siteSettings, hero_subtitle: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Metrics */}
              {cmsTab === 'metrics' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '720px' }}>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Active Creators Count</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={siteSettings.social_creators}
                      onChange={(e) => setSiteSettings({ ...siteSettings, social_creators: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Total DMs Delivered</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={siteSettings.social_dms}
                      onChange={(e) => setSiteSettings({ ...siteSettings, social_dms: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Pricing */}
              {cmsTab === 'pricing' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxWidth: '800px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#818cf8' }}>Pro Plan Price ($)</h4>
                    <input
                      type="number"
                      className="admin-input"
                      value={siteSettings.pro_price_monthly}
                      onChange={(e) => setSiteSettings({ ...siteSettings, pro_price_monthly: Number(e.target.value) })}
                    />
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#c084fc' }}>Agency Plan Price ($)</h4>
                    <input
                      type="number"
                      className="admin-input"
                      value={siteSettings.agency_price_monthly}
                      onChange={(e) => setSiteSettings({ ...siteSettings, agency_price_monthly: Number(e.target.value) })}
                    />
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#f472b6' }}>Enterprise Price ($)</h4>
                    <input
                      type="number"
                      className="admin-input"
                      value={siteSettings.enterprise_price_monthly}
                      onChange={(e) => setSiteSettings({ ...siteSettings, enterprise_price_monthly: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              {/* Sub-tab 4: FAQs */}
              {cmsTab === 'faqs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px' }}>
                  {(siteSettings.faqs || []).map((faq, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#818cf8' }}>FAQ #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = siteSettings.faqs.filter((_, i) => i !== idx);
                            setSiteSettings({ ...siteSettings, faqs: updated });
                          }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Question"
                        className="admin-input"
                        style={{ marginBottom: '8px' }}
                        value={faq.q}
                        onChange={(e) => {
                          const updated = [...siteSettings.faqs];
                          updated[idx].q = e.target.value;
                          setSiteSettings({ ...siteSettings, faqs: updated });
                        }}
                      />
                      <textarea
                        rows={2}
                        placeholder="Answer"
                        className="admin-input"
                        style={{ height: 'auto', padding: '10px' }}
                        value={faq.a}
                        onChange={(e) => {
                          const updated = [...siteSettings.faqs];
                          updated[idx].a = e.target.value;
                          setSiteSettings({ ...siteSettings, faqs: updated });
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      setSiteSettings({
                        ...siteSettings,
                        faqs: [...(siteSettings.faqs || []), { q: 'New Question?', a: 'Detailed answer here...' }]
                      });
                    }}
                  >
                    <Plus size={14} />
                    <span>Add New FAQ Item</span>
                  </button>
                </div>
              )}

              {/* Sub-tab 5: Brand */}
              {cmsTab === 'brand' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px' }}>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Platform Name</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={siteSettings.platform_name}
                      onChange={(e) => setSiteSettings({ ...siteSettings, platform_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Support Email</label>
                    <input
                      type="email"
                      className="admin-input"
                      value={siteSettings.support_email}
                      onChange={(e) => setSiteSettings({ ...siteSettings, support_email: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 5: DM CARD INTERACTIVE TEMPLATES
          ========================================================================= */}
          {activeTab === 'templates' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                    📑 DM Card Preset Templates ({templates.length})
                  </h2>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Manage out-of-the-box Instagram DM templates available to all registered creators.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="admin-btn-secondary" onClick={handleResetTemplates}>
                    <RefreshCw size={14} />
                    <span>Reset Defaults</span>
                  </button>

                  <button
                    type="button"
                    className="admin-btn-primary"
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateFormData({
                        id: `tpl-${Date.now()}`,
                        name: 'New Custom Card Template',
                        category: 'ecommerce',
                        categoryLabel: '🛍️ E-Commerce',
                        badge: '🔥 HIGH CONVERTING',
                        trigger_keyword: 'SPECIAL',
                        match_mode: 'contains',
                        require_follow: false,
                        comment_reply_message: 'Sent the details to your DM! 🚀',
                        dm_reply_message: 'Hey {username}! Here is the direct link you requested.',
                        card_enabled: 1,
                        card_title: '🎁 Special Offer Details',
                        card_subtitle: 'Tap the button below to view full details.',
                        card_image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
                        card_button_text: 'Claim Offer 🚀',
                        card_button_url: 'https://airvix.com',
                        description: 'Custom preset card designed to boost conversions.'
                      });
                      setIsCreatingTemplate(true);
                    }}
                  >
                    <Plus size={14} />
                    <span>Create Template</span>
                  </button>
                </div>
              </div>

              {/* Template Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
                {filteredTemplates.map(tpl => (
                  <div key={tpl.id} style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '3px 8px', borderRadius: '6px' }}>
                        {tpl.categoryLabel || tpl.category}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>
                        {tpl.badge}
                      </span>
                    </div>

                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                      {tpl.name}
                    </h3>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 14px 0' }}>
                      {tpl.description}
                    </p>

                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, uppercase: 'true' }}>KEYWORD TRIGGER</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#10b981', fontFamily: 'monospace', margin: '2px 0 6px 0' }}>
                        {tpl.trigger_keyword}
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                        {tpl.card_title}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setPreviewTemplate(tpl)}
                      >
                        <Eye size={13} />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        className="admin-btn-secondary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => {
                          setEditingTemplate(tpl);
                          setTemplateFormData(tpl);
                          setIsCreatingTemplate(true);
                        }}
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        className="admin-btn-secondary"
                        style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
                        onClick={() => handleDeleteTemplate(tpl.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 6: GLOBAL SYSTEM SAFEGUARDS
          ========================================================================= */}
          {activeTab === 'safeguards' && (
            <div style={{ background: 'var(--bg-card, #111827)', border: '1px solid var(--border-light, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '28px', maxWidth: '760px' }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                🛡️ Global Platform Safeguards &amp; Meta Limits
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
                Configure rate limits, Meta Graph API safety thresholds, and maintenance window toggles.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={siteSettings.maintenance_mode}
                      onChange={(e) => setSiteSettings({ ...siteSettings, maintenance_mode: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#ef4444' }}>Emergency Maintenance Mode</div>
                      <div style={{ fontSize: '12px', color: '#fca5a5' }}>Temporarily pauses incoming webhooks and new user signups across the system.</div>
                    </div>
                  </label>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={siteSettings.allow_registrations}
                      onChange={(e) => setSiteSettings({ ...siteSettings, allow_registrations: e.target.checked })}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>Allow New Creator Registrations</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Permit public signups on the landing page.</div>
                    </div>
                  </label>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '6px' }}>Free Tier Monthly DM Limit</label>
                  <input
                    type="number"
                    className="admin-input"
                    value={siteSettings.free_dm_limit}
                    onChange={(e) => setSiteSettings({ ...siteSettings, free_dm_limit: Number(e.target.value) })}
                  />
                </div>

                <button
                  type="button"
                  className="admin-btn-primary"
                  style={{ alignSelf: 'flex-start', marginTop: '10px' }}
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                >
                  <Save size={14} />
                  <span>Save Safeguards Live</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          MODAL: USER ACCESS CONTROL & INSPECTION DRAWER
      ========================================================================= */}
      {selectedUserDetail && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedUserDetail(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="#818cf8" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#f8fafc' }}>
                    User Inspection &amp; Access Control
                  </h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>ID: {selectedUserDetail.id}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedUserDetail(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* User Stats Card */}
            <div className="admin-user-details-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>{selectedUserDetail.name}</div>
                  <div style={{ fontSize: '13px', color: '#818cf8', fontWeight: 600 }}>{selectedUserDetail.email}</div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', background: selectedUserDetail.status === 'suspended' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: selectedUserDetail.status === 'suspended' ? '#f87171' : '#10b981', border: '1px solid currentColor' }}>
                    {selectedUserDetail.status === 'suspended' ? '● Suspended' : '● Active Account'}
                  </span>
                </div>
              </div>

              <div className="admin-detail-grid">
                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Subscription Tier</div>
                  <div className="admin-stat-pill-value" style={{ color: '#818cf8', textTransform: 'uppercase' }}>
                    {selectedUserDetail.plan}
                  </div>
                </div>

                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Tokens Left / Used</div>
                  <div className="admin-stat-pill-value">
                    {selectedUserDetail.dmLeft?.toLocaleString()} / {selectedUserDetail.dmUsed?.toLocaleString()}
                  </div>
                </div>

                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Monthly Limit</div>
                  <div className="admin-stat-pill-value" style={{ color: '#10b981' }}>
                    {selectedUserDetail.dmLimit?.toLocaleString()} DMs
                  </div>
                </div>

                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Account Role</div>
                  <div className="admin-stat-pill-value">
                    {selectedUserDetail.role === 'admin' ? '🛡️ Super Admin' : '👤 Creator'}
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Instagram Accounts */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Film size={16} color="#f472b6" />
                <span>Connected Instagram Business Accounts ({selectedUserDetail.connected_accounts?.length || 0})</span>
              </h4>

              {(selectedUserDetail.connected_accounts || []).map(ig => (
                <div key={ig.id} className="admin-ig-account-row">
                  <div>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '13.5px' }}>@{ig.username}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Insta ID: <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{ig.ig_user_id}</span> • {ig.fb_page_name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{ig.followers_count?.toLocaleString()} Followers</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Connected {new Date(ig.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}

              {(!selectedUserDetail.connected_accounts || selectedUserDetail.connected_accounts.length === 0) && (
                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', color: '#64748b', fontSize: '12.5px', textAlign: 'center' }}>
                  No Instagram business accounts linked yet.
                </div>
              )}
            </div>

            {/* Access Control Action Buttons */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '18px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '13.5px', fontWeight: 800, color: '#ef4444' }}>
                ⚙️ Direct Access Control Actions
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  style={{
                    justifyContent: 'center',
                    color: selectedUserDetail.status === 'suspended' ? '#10b981' : '#f87171',
                    borderColor: selectedUserDetail.status === 'suspended' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'
                  }}
                  onClick={() => {
                    const nextStatus = selectedUserDetail.status === 'suspended' ? 'active' : 'suspended';
                    handleUpdateUser(selectedUserDetail.id, { status: nextStatus });
                  }}
                >
                  {selectedUserDetail.status === 'suspended' ? <UserCheck size={14} /> : <UserX size={14} />}
                  <span>{selectedUserDetail.status === 'suspended' ? 'Activate Account' : 'Suspend / Block Access'}</span>
                </button>

                <button
                  type="button"
                  className="admin-btn-secondary"
                  style={{ justifyContent: 'center' }}
                  onClick={() => {
                    handleUpdateUser(selectedUserDetail.id, { reset_dm_usage: true });
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Reset DM Usage to 0</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="admin-btn-secondary" onClick={() => setSelectedUserDetail(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={() => {
                    setEditingUser(selectedUserDetail);
                    setSelectedUserDetail(null);
                  }}
                >
                  Edit Plan &amp; Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT / CREATE PRICING PLAN WITH LIVE VISUAL PREVIEW
      ========================================================================= */}
      {isCreatingPlan && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsCreatingPlan(false); }}>
          <div className="admin-modal-box" style={{ maxWidth: '900px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={20} color="#818cf8" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                  {editingPlan ? `Edit ${editingPlan.name} Plan` : 'Create New Subscription Plan'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsCreatingPlan(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
              {/* Left Column: Form Fields */}
              <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Plan Name</label>
                  <input
                    type="text"
                    required
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. Pro Creator"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Monthly Price ($)</label>
                    <input
                      type="number"
                      required
                      value={planFormData.monthlyPrice}
                      onChange={(e) => setPlanFormData({ ...planFormData, monthlyPrice: Number(e.target.value) })}
                      className="admin-input"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Annual Monthly Price ($)</label>
                    <input
                      type="number"
                      value={planFormData.annualPrice}
                      onChange={(e) => setPlanFormData({ ...planFormData, annualPrice: Number(e.target.value) })}
                      className="admin-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Monthly DM Limit</label>
                    <input
                      type="number"
                      value={planFormData.dmLimit}
                      onChange={(e) => setPlanFormData({ ...planFormData, dmLimit: Number(e.target.value) })}
                      className="admin-input"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Connected IG Accounts</label>
                    <input
                      type="number"
                      value={planFormData.igLimit}
                      onChange={(e) => setPlanFormData({ ...planFormData, igLimit: Number(e.target.value) })}
                      className="admin-input"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Badge Label (e.g. 🔥 MOST POPULAR)</label>
                  <input
                    type="text"
                    value={planFormData.badge}
                    onChange={(e) => setPlanFormData({ ...planFormData, badge: e.target.value })}
                    className="admin-input"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Plan Description</label>
                  <input
                    type="text"
                    value={planFormData.description}
                    onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                    className="admin-input"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Feature Items (one per line)</label>
                  <textarea
                    rows={4}
                    value={planFeaturesText}
                    onChange={(e) => setPlanFeaturesText(e.target.value)}
                    className="admin-input"
                    style={{ height: 'auto', padding: '10px' }}
                    placeholder="25,000 Automated DMs / Mo&#10;3 Connected IG Accounts&#10;Follow-Gated Private Cards"
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#f8fafc' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(planFormData.popular)}
                    onChange={(e) => setPlanFormData({ ...planFormData, popular: e.target.checked })}
                  />
                  <span>Highlight as Featured / Most Popular plan</span>
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                  <button type="button" className="admin-btn-secondary" onClick={() => setIsCreatingPlan(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn-primary">
                    {editingPlan ? 'Save Live Plan' : 'Publish Plan'}
                  </button>
                </div>
              </form>

              {/* Right Column: Live Plan Visual Preview */}
              <div className="admin-plan-preview-box">
                <div className="admin-plan-preview-title-bar">
                  <Sparkles size={14} />
                  <span>Real-Time Creator Preview Card</span>
                </div>

                <div className={`admin-live-card-preview ${planFormData.popular ? 'popular' : ''}`}>
                  {planFormData.badge && (
                    <div className="admin-live-card-badge">
                      {planFormData.badge}
                    </div>
                  )}

                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                    {planFormData.name || 'Plan Name'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '4px 0 14px 0' }}>
                    {planFormData.description || 'Plan description copy...'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '36px', fontWeight: 900, color: '#ffffff' }}>${planFormData.monthlyPrice}</span>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>/ month</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {(planFeaturesText ? planFeaturesText.split('\n').filter(Boolean) : (planFormData.features || [])).map((feat, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#e2e8f0' }}>
                        <CheckCircle2 size={14} color="#10b981" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="admin-live-card-cta">
                    Get Started with {planFormData.name || 'Plan'} 🚀
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT USER PLAN & ROLE
      ========================================================================= */}
      {editingUser && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#f8fafc' }}>
                Modify Privileges: {editingUser.email}
              </h3>
              <button type="button" onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target;
              handleUpdateUser(editingUser.id, {
                plan: form.plan.value,
                role: form.role.value,
                status: form.status.value,
              });
            }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Subscription Plan</label>
                <select name="plan" defaultValue={editingUser.plan} className="admin-input">
                  <option value="free" style={{ background: '#0f172a' }}>Free Tier (1,000 DMs/mo)</option>
                  <option value="pro" style={{ background: '#0f172a' }}>Pro Creator ($29/mo - 25,000 DMs)</option>
                  <option value="agency" style={{ background: '#0f172a' }}>Agency &amp; Brand ($79/mo - 100,000 DMs)</option>
                  <option value="enterprise" style={{ background: '#0f172a' }}>Enterprise VIP ($199/mo - 500,000 DMs)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Account Role</label>
                <select name="role" defaultValue={editingUser.role} className="admin-input">
                  <option value="user" style={{ background: '#0f172a' }}>👤 Creator / User</option>
                  <option value="admin" style={{ background: '#0f172a' }}>🛡️ Super Admin</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Access Status</label>
                <select name="status" defaultValue={editingUser.status} className="admin-input">
                  <option value="active" style={{ background: '#0f172a' }}>● Active (Normal Access)</option>
                  <option value="suspended" style={{ background: '#0f172a' }}>● Suspended (Blocked)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="admin-btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Save Privilege Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RESET USER PASSWORD
      ========================================================================= */}
      {resetPasswordUser && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setResetPasswordUser(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                Set Password for {resetPasswordUser.email}
              </h3>
              <button type="button" onClick={() => setResetPasswordUser(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

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
                  placeholder="Enter new strong password"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="admin-btn-secondary" onClick={() => setResetPasswordUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CONFIRM USER DELETION
      ========================================================================= */}
      {deletingUser && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeletingUser(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '440px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 800, color: '#ef4444' }}>
              Confirm Permanent Deletion
            </h3>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to permanently delete creator <strong style={{ color: '#ffffff' }}>{deletingUser.email}</strong>? All connected Instagram accounts, automation rules, and message logs will be unrecoverable.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="admin-btn-secondary" onClick={() => setDeletingUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                style={{ background: '#ef4444', borderColor: '#dc2626' }}
                onClick={handleDeleteUser}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT / CREATE TEMPLATE
      ========================================================================= */}
      {isCreatingTemplate && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsCreatingTemplate(false); }}>
          <div className="admin-modal-box" style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                {editingTemplate ? `Edit ${editingTemplate.name}` : 'Create New DM Card Template'}
              </h3>
              <button type="button" onClick={() => setIsCreatingTemplate(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Template Name</label>
                  <input
                    type="text"
                    required
                    value={templateFormData.name}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. E-Commerce Discount Code"
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
                        lead_magnet: '🔒 Follower Check / Lead Magnet',
                        services: '💼 Services & Agencies',
                        general: '⚡ General Purpose'
                      };
                      setTemplateFormData({
                        ...templateFormData,
                        category: cat,
                        categoryLabel: labels[cat] || '⚡ Custom'
                      });
                    }}
                    className="admin-input"
                  >
                    <option value="ecommerce" style={{ background: '#0f172a' }}>🛍️ E-Commerce &amp; Flash Sales</option>
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
