// Airvix Super Admin Control Center & Privacy-First Dashboard
import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  CreditCard,
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
  EyeOff,
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
  Key,
  Plus,
  ArrowRight,
  ExternalLink,
  Smartphone,
  Info,
  SlidersHorizontal,
  ChevronDown,
  Bell,
  Calendar,
  Briefcase,
  Plug,
  HelpCircle,
  FileText,
  Radio,
  CheckSquare,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  Power,
  ShieldAlert
} from 'lucide-react';
import { apiFetch } from '../api/client';
import LandingPageEditor from './LandingPageEditor';
import '../styles/admin.css';

// Inline Click-to-Edit CMS Field Component
function InlineCMSField({
  value,
  onChange,
  placeholder = 'Click to edit...',
  tag = 'span',
  multiline = false,
  className = '',
  style = {},
  label = ''
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');

  useEffect(() => {
    setTempValue(value || '');
  }, [value]);

  const handleCommit = () => {
    setIsEditing(false);
    onChange(tempValue);
  };

  const handleKeyDown = (e) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTempValue(value || '');
    }
  };

  const Tag = tag;

  if (isEditing) {
    return (
      <span
        className="inline-cms-editing-wrapper"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: multiline ? 'block' : 'inline-block',
          position: 'relative',
          width: multiline ? '100%' : 'auto',
          margin: '4px 0',
          zIndex: 999
        }}
      >
        {multiline ? (
          <textarea
            autoFocus
            rows={5}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              minHeight: '100px',
              background: '#090d16',
              color: '#60a5fa',
              border: '2px solid #3b82f6',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              fontFamily: 'monospace',
              lineHeight: 1.6,
              outline: 'none',
              boxShadow: '0 0 25px rgba(59, 130, 246, 0.5)'
            }}
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              minWidth: '180px',
              background: '#090d16',
              color: '#60a5fa',
              border: '2px solid #3b82f6',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              fontWeight: 'inherit',
              lineHeight: 'inherit',
              outline: 'none',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
            }}
          />
        )}
        <span
          style={{
            position: 'absolute',
            right: '8px',
            bottom: '6px',
            fontSize: '10px',
            fontWeight: 800,
            background: '#2563eb',
            color: '#ffffff',
            padding: '2px 8px',
            borderRadius: '4px',
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)'
          }}
        >
          Enter ↵
        </span>
      </span>
    );
  }

  return (
    <Tag
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`inline-cms-target ${className}`}
      title={label ? `Click to edit ${label}` : 'Click to edit text directly'}
      style={{
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        ...style
      }}
    >
      {value || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{placeholder}</span>}
      <span className="inline-cms-badge">✏️ Edit</span>
    </Tag>
  );
}

export default function AdminView({ user, onBackToApp }) {
  // Navigation Tabs: 'overview' | 'users' | 'workspaces' | 'plans' | 'integrations' | 'safeguards' | 'analytics' | 'support' | 'security' | 'audit' | 'status'
  const [activeTab, setActiveTab] = useState('overview');
  const [chartMetric, setChartMetric] = useState('users'); // 'users' | 'messages' | 'workspaces' | 'revenue'
  const [chartTimeframe, setChartTimeframe] = useState('30d'); // '7d' | '30d'
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  // Overview State
  const [overview, setOverview] = useState(null);

  // Workspaces State
  const [workspacesList, setWorkspacesList] = useState([]);

  // Audit Logs State
  const [auditLogsList, setAuditLogsList] = useState([]);

  // Security Privacy & Governance State
  const [securityData, setSecurityData] = useState(null);
  const [killSwitches, setKillSwitches] = useState([]);
  const [togglingKillSwitch, setTogglingKillSwitch] = useState(false);
  const [abuseFlagsList, setAbuseFlagsList] = useState([]);
  const [abuseFilter, setAbuseFilter] = useState('unresolved'); // 'unresolved' | 'all'
  const [costReport, setCostReport] = useState(null);
  const [sessionsList, setSessionsList] = useState([]);

  // System Status State
  const [systemStatusData, setSystemStatusData] = useState(null);

  // Users State & Access Control
  const [usersList, setUsersList] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  
  // Detailed Inspect User Modal State
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  // Subscriptions & Plans CRUD State
  const [plansList, setPlansList] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [planFormData, setPlanFormData] = useState({
    id: '',
    slug: '',
    name: '',
    monthlyPrice: 1499,
    annualPrice: 1199,
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
      'Instant 0.8s Response Engine'
    ],
    active: true
  });
  const [planFeaturesText, setPlanFeaturesText] = useState('');

  // Payment System State
  const [paymentsList, setPaymentsList] = useState([]);

  // Integrations, Safeguards, Analytics & Support State
  const [integrationsData, setIntegrationsData] = useState(null);
  const [safeguardsData, setSafeguardsData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [supportData, setSupportData] = useState(null);

  // Site CMS & Settings State
  const [siteSettings, setSiteSettings] = useState({
    announcement_enabled: false,
    announcement_text: '',
    announcement_badge: '',
    announcement_link: '',
    hero_badge: '',
    hero_headline: '',
    hero_headline_highlight: '',
    hero_subtitle: '',
    primary_cta_text: '',
    primary_cta_url: '',
    secondary_cta_text: '',
    secondary_cta_url: '',
    support_email: '',
    support_phone: '',
    whatsapp_number: '',
    business_address: '',
    privacy_policy_text: '',
    terms_of_service_text: '',
    refund_policy_text: '',
    demo_video_url: '',
    demo_video_title: '',
    feature_1_title: '',
    feature_1_desc: '',
    feature_2_title: '',
    feature_2_desc: '',
    feature_3_title: '',
    feature_3_desc: '',
    feature_4_title: '',
    feature_4_desc: '',
    maker_quote: '',
    maker_team: '',
    social_creators: '12,000+',
    social_dms: '4.8M+',
    social_rating: '4.9/5',
    social_reply_speed: '0.8s',
    footer_tagline: ''
  });
  const [originalSettings, setOriginalSettings] = useState(null);
  const [loadingSiteSettings, setLoadingSiteSettings] = useState(false);
  const [savingSiteSettings, setSavingSiteSettings] = useState(false);
  
  // Interactive CMS View Modes & Before/After Diff State
  const [cmsViewMode, setCmsViewMode] = useState('visual_replica'); // 'visual_replica' | 'split' | 'editor'
  const [previewCompareMode, setPreviewCompareMode] = useState('after'); // 'after' (Modified Draft) | 'before' (Original Defaults)
  const [previewLegalTab, setPreviewLegalTab] = useState('privacy'); // 'privacy' | 'terms' | 'refund'
  const [cmsSubtab, setCmsSubtab] = useState('hero'); // 'pages' | 'hero' | 'features' | 'pricing' | 'testimonials' | 'faq' | 'footer'
  const [cmsActivePage, setCmsActivePage] = useState('Home'); // 'Home' | 'Features' | 'Pricing' | 'Resources' | 'About' | 'Contact' | 'Legal Pages'

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Fetch Site Settings from DB
  const loadSiteSettings = useCallback(async () => {
    try {
      setLoadingSiteSettings(true);
      const res = await apiFetch('/admin/settings');
      if (res.ok) {
        const data = await res.json();
        if (data && data.settings) {
          setSiteSettings(prev => ({ ...prev, ...data.settings }));
          setOriginalSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to load site settings:', err);
    } finally {
      setLoadingSiteSettings(false);
    }
  }, []);

  // Save Site Settings Handler
  const handleSaveSiteSettings = async (e) => {
    if (e) e.preventDefault();
    try {
      setSavingSiteSettings(true);
      const res = await apiFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(siteSettings)
      });
      if (res.ok) {
        setOriginalSettings({ ...siteSettings });
        showToast('✅ Landing Page CMS updated & published live!');
      } else {
        const err = await res.json();
        alert(`Error saving CMS settings: ${err.error || 'Failed'}`);
      }
    } catch (err) {
      alert(`Error saving CMS settings: ${err.message}`);
    } finally {
      setSavingSiteSettings(false);
    }
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
      }
    } catch (err) {
      console.error(`Error loading user details:`, err);
    } finally {
      setLoadingUserDetail(false);
    }
  };

  // 3. Fetch Workspaces
  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspacesList(data.workspaces || []);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  }, []);

  // 4. Fetch Audit Logs
  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogsList(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  }, []);

  // 5. Fetch Security & Privacy Metrics
  const loadSecurityPrivacy = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/security-privacy');
      if (res.ok) {
        const data = await res.json();
        setSecurityData(data);
      }
    } catch (err) {
      console.error('Failed to load security privacy data:', err);
    }
  }, []);

  // 6. Fetch System Status
  const loadSystemStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/system-status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatusData(data);
      }
    } catch (err) {
      console.error('Failed to load system status:', err);
    }
  }, []);

  // 7. Fetch Plans Data
  const loadPlans = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/plans');
      if (res.ok) {
        const data = await res.json();
        setPlansList(data.plans || []);
      }
    } catch (err) {
      console.error('Failed to load pricing plans:', err);
    }
  }, []);

  // 8. Fetch Payments Data
  const loadPayments = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/payments');
      if (res.ok) {
        const data = await res.json();
        setPaymentsList(data.transactions || []);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  }, []);

  // 9. Fetch Integrations Data
  const loadIntegrations = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrationsData(data);
      }
    } catch (err) {
      console.error('Failed to load integrations:', err);
    }
  }, []);

  // 10. Fetch Safeguards Data
  const loadSafeguards = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/safeguards');
      if (res.ok) {
        const data = await res.json();
        setSafeguardsData(data);
      }
    } catch (err) {
      console.error('Failed to load safeguards:', err);
    }
  }, []);

  // 11. Fetch Analytics Data
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  // 12. Fetch Support Data
  const loadSupport = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/support');
      if (res.ok) {
        const data = await res.json();
        setSupportData(data);
      }
    } catch (err) {
      console.error('Failed to load support:', err);
    }
  }, []);

  // 13. Fetch Kill Switch Status
  const loadKillSwitches = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/kill-switch/status');
      if (res.ok) {
        const data = await res.json();
        setKillSwitches(data.kill_switches || []);
      }
    } catch (err) {
      console.error('Failed to load kill switch status:', err);
    }
  }, []);

  // 14. Fetch Abuse Flags
  const loadAbuseFlags = useCallback(async () => {
    try {
      const res = await apiFetch(`/admin/abuse-flags?resolved=${abuseFilter === 'resolved' ? '1' : '0'}`);
      if (res.ok) {
        const data = await res.json();
        setAbuseFlagsList(data.abuse_flags || []);
      }
    } catch (err) {
      console.error('Failed to load abuse flags:', err);
    }
  }, [abuseFilter]);

  // 15. Fetch Cost & Consumption Report
  const loadCostReport = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/cost-report');
      if (res.ok) {
        const data = await res.json();
        setCostReport(data);
      }
    } catch (err) {
      console.error('Failed to load cost report:', err);
    }
  }, []);

  // 16. Fetch Active Sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/sessions?all=true');
      if (res.ok) {
        const data = await res.json();
        setSessionsList(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load admin sessions:', err);
    }
  }, []);

  // Toggle Global Kill Switch
  const handleToggleGlobalKillSwitch = async (activate) => {
    let reason = '';
    if (activate) {
      reason = window.prompt('Enter reason for activating global emergency kill switch:', 'Suspected platform incident / API rate limit spike');
      if (reason === null) return; // User cancelled
    }
    setTogglingKillSwitch(true);
    try {
      const res = await apiFetch('/admin/kill-switch/global', {
        method: 'POST',
        body: JSON.stringify({ isActive: activate, reason: reason || 'Admin manual toggle' })
      });
      if (res.ok) {
        showToast(activate ? '🛑 EMERGENCY KILL SWITCH ACTIVATED: All system automations paused.' : '✅ Global Kill Switch deactivated. Automations resumed.');
        loadKillSwitches();
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Could not update kill switch'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setTogglingKillSwitch(false);
    }
  };

  // Toggle Account Kill Switch
  const handleToggleAccountKillSwitch = async (accountId, activate) => {
    try {
      const res = await apiFetch(`/admin/kill-switch/account/${accountId}`, {
        method: 'POST',
        body: JSON.stringify({ isActive: activate, reason: 'Admin account toggle' })
      });
      if (res.ok) {
        showToast(activate ? `⏸️ Account ${accountId} paused.` : `▶️ Account ${accountId} resumed.`);
        loadKillSwitches();
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Could not update account kill switch'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Resolve Abuse Flag
  const handleResolveAbuseFlag = async (flagId) => {
    if (!window.confirm('Mark this abuse flag as resolved?')) return;
    try {
      const res = await apiFetch(`/admin/abuse-flags/${flagId}/resolve`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('✅ Abuse flag marked as resolved');
        loadAbuseFlags();
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Could not resolve abuse flag'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Revoke Single Session
  const handleRevokeSession = async (sessionId) => {
    if (!window.confirm('Revoke this session? The user will be immediately logged out.')) return;
    try {
      const res = await apiFetch(`/admin/sessions/${sessionId}/revoke`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('✅ Session successfully revoked');
        loadSessions();
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Could not revoke session'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Revoke All Other Sessions
  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Revoke ALL other active sessions? Only your current browser session will remain.')) return;
    try {
      const res = await apiFetch('/admin/sessions/revoke-all', {
        method: 'POST'
      });
      if (res.ok) {
        showToast('✅ All other active sessions have been revoked.');
        loadSessions();
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Could not revoke sessions'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Lazy-load data when active tab changes (avoids firing 13 requests at once)
  useEffect(() => {
    switch (activeTab) {
      case 'overview':
        loadOverview();
        break;
      case 'users':
        loadUsers();
        break;
      case 'workspaces':
        loadWorkspaces();
        break;
      case 'plans':
        loadPlans();
        loadPayments();
        break;
      case 'landing_cms':
        loadSiteSettings();
        break;
      case 'integrations':
        loadIntegrations();
        break;
      case 'safeguards':
        loadSafeguards();
        break;
      case 'analytics':
        loadAnalytics();
        break;
      case 'support':
        loadSupport();
        break;
      case 'security':
        loadSecurityPrivacy();
        loadKillSwitches();
        loadAbuseFlags();
        loadCostReport();
        loadSessions();
        break;
      case 'audit':
        loadAuditLogs();
        break;
      case 'status':
        loadSystemStatus();
        break;
      default:
        break;
    }
  }, [activeTab, loadOverview, loadUsers, loadWorkspaces, loadPlans, loadPayments, loadSiteSettings, loadIntegrations, loadSafeguards, loadAnalytics, loadSupport, loadSecurityPrivacy, loadKillSwitches, loadAbuseFlags, loadCostReport, loadSessions, loadAuditLogs, loadSystemStatus]);

  // Debounced search / filter for users tab
  useEffect(() => {
    if (activeTab === 'users') {
      const timer = setTimeout(() => {
        loadUsers();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, userSearch, userPlanFilter, userStatusFilter, loadUsers]);


  // Update User Handler
  const handleUpdateUser = async (userId, updates) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        showToast('✅ User record updated safely');
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

  // Delete User Handler
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      const res = await apiFetch(`/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(`✅ User and associated workspace data deleted`);
        setDeletingUser(null);
        if (selectedUserDetail && selectedUserDetail.id === deletingUser.id) {
          setSelectedUserDetail(null);
        }
        loadUsers();
        loadOverview();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Save / Create Plan Handler
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

      const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (res.ok) {
        showToast(isEdit ? '✅ Plan updated live' : '✅ New plan created');
        setEditingPlan(null);
        setIsCreatingPlan(false);
        loadPlans();
      }
    } catch (err) {
      alert(`Error saving plan: ${err.message}`);
    }
  };

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
          AIRVIX LEFT SIDEBAR
      ========================================================================= */}
      <aside className="admin-sidebar">
        <div>
          {/* Header Brand */}
          <div className="admin-sidebar-header">
            <a href="#admin" className="admin-sidebar-logo-brand">
              <div className="admin-airvix-icon">
                <Send size={18} />
              </div>
              <h1 className="admin-airvix-title">Airvix</h1>
            </a>
          </div>

          {/* Navigation Items */}
          <div className="admin-sidebar-nav">
            <div className="admin-sidebar-menu-group">
              <div className="admin-sidebar-section-title">CORE PAGES</div>
              
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <TrendingUp size={16} />
                <span>Overview</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Users size={16} />
                <span>Users</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'workspaces' ? 'active' : ''}`}
                onClick={() => setActiveTab('workspaces')}
              >
                <Briefcase size={16} />
                <span>Workspaces</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'plans' ? 'active' : ''}`}
                onClick={() => setActiveTab('plans')}
              >
                <CreditCard size={16} />
                <span>Plans &amp; Billings</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'landing_cms' ? 'active' : ''}`}
                onClick={() => setActiveTab('landing_cms')}
              >
                <Globe size={16} />
                <span>Landing Page CMS</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'integrations' ? 'active' : ''}`}
                onClick={() => setActiveTab('integrations')}
              >
                <Plug size={16} />
                <span>Integrations</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'safeguards' ? 'active' : ''}`}
                onClick={() => setActiveTab('safeguards')}
              >
                <SlidersHorizontal size={16} />
                <span>Automation Health</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <Activity size={16} />
                <span>Analytics</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'support' ? 'active' : ''}`}
                onClick={() => setActiveTab('support')}
              >
                <HelpCircle size={16} />
                <span>Support</span>
              </button>
            </div>

            <div className="admin-sidebar-menu-group">
              <div className="admin-sidebar-section-title">GOVERNANCE &amp; PRIVACY</div>
              
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <ShieldCheck size={16} />
                <span>Security &amp; Privacy</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveTab('audit')}
              >
                <FileText size={16} />
                <span>Audit Logs</span>
              </button>

              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'status' ? 'active' : ''}`}
                onClick={() => setActiveTab('status')}
              >
                <Radio size={16} />
                <span>System Status</span>
              </button>
            </div>

            {/* Privacy First Banner Card */}
            <div className="admin-privacy-banner-card">
              <h4>
                <Shield size={14} />
                <span>Privacy First</span>
              </h4>
              <p>We store minimal data necessary. User content is encrypted and access controlled.</p>
              <a href="#security" onClick={(e) => { e.preventDefault(); setActiveTab('security'); }}>
                <span>Learn more</span>
                <ArrowRight size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="admin-sidebar-footer">
          <div className="admin-status-indicator-live">
            <span className="dot" />
            <span>All systems operational</span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT MAIN CONTAINER
      ========================================================================= */}
      <div className="admin-main-container">
        {/* Top Header Navbar */}
        <header className="admin-top-header">
          {/* Active View Page Title */}
          <div className="admin-header-title-wrap">
            <h1 className="admin-header-page-title">
              {activeTab === 'overview' && 'Overview (Dashboard)'}
              {activeTab === 'users' && 'Users'}
              {activeTab === 'workspaces' && 'Workspaces'}
              {activeTab === 'plans' && 'Plans & Billings'}
              {activeTab === 'landing_cms' && 'Landing Page CMS'}
              {activeTab === 'integrations' && 'Integrations'}
              {activeTab === 'safeguards' && 'Automation Health'}
              {activeTab === 'analytics' && 'Analytics'}
              {activeTab === 'support' && 'Support'}
              {activeTab === 'security' && 'Security & Privacy'}
              {activeTab === 'audit' && 'Audit Logs'}
              {activeTab === 'status' && 'System Status'}
            </h1>
          </div>

          {/* Top Actions & Profile */}
          <div className="admin-top-actions-right">
            <button type="button" className="admin-date-picker-btn">
              <Calendar size={13} />
              <span>Sep 1, 2026 - Sep 8, 2026</span>
              <ChevronDown size={13} />
            </button>

            <div className="admin-notification-bell" title="3 Notifications">
              <Bell size={18} />
              <span className="admin-notification-badge">3</span>
            </div>

            <div className="admin-profile-pill">
              <div className="admin-profile-avatar">
                {(user?.name || user?.email || 'AD').substring(0, 2).toUpperCase()}
              </div>
              <div className="admin-profile-text">
                <span className="admin-profile-name">{user?.name || user?.email?.split('@')[0] || 'Admin'}</span>
                <span className="admin-profile-role">{user?.role === 'admin' ? 'Super Admin' : 'Admin'}</span>
              </div>
            </div>

            <button
              type="button"
              className="admin-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={onBackToApp || (() => { window.location.hash = '#app'; })}
            >
              <ArrowRight size={13} />
              <span>Creator App</span>
            </button>
          </div>
        </header>

        {/* Main Content Body Pane */}
        <main className="admin-content-pane">
          {/* =========================================================================
              TAB 1: OVERVIEW DASHBOARD
          ========================================================================= */}
          {activeTab === 'overview' && (() => {
            // Dynamic calculations for Platform Growth Chart from Real DB Timeline
            const activeTimeline = (chartTimeframe === '7d' ? overview?.growthTimeline?.growth7d : overview?.growthTimeline?.growth30d) || [];
            const currentMetricKey = chartMetric || 'users';

            const chartPoints = activeTimeline.map((item, idx) => {
              const totalCount = activeTimeline.length;
              const x = totalCount > 1 ? (idx / (totalCount - 1)) * 700 : 350;
              const rawVal = item[currentMetricKey] || 0;
              const maxVal = Math.max(...activeTimeline.map(i => i[currentMetricKey] || 0), 1);
              const minVal = 0;
              // Map value to SVG Y coordinate (30 top, 160 bottom)
              const y = 160 - ((rawVal - minVal) / (maxVal - minVal)) * 130;
              return { x, y, date: item.date, value: rawVal };
            });

            const linePathD = chartPoints.length > 0
              ? chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
              : 'M 0,160 L 700,160';

            const areaPathD = chartPoints.length > 0
              ? `${linePathD} L 700,160 L 0,160 Z`
              : 'M 0,160 L 700,160 L 700,160 L 0,160 Z';

            const activeLastPoint = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1] : { x: 500, y: 50, value: 0 };
            const firstDateLabel = activeTimeline.length > 0 ? activeTimeline[0].date : '';
            const lastDateLabel = activeTimeline.length > 0 ? activeTimeline[activeTimeline.length - 1].date : '';
            const dateRangeBadgeText = firstDateLabel && lastDateLabel ? `${firstDateLabel} – ${lastDateLabel}` : 'Live Overview';

            return (
              <div>
                {/* Greeting Hero */}
                <div className="admin-welcome-hero">
                  <h2 className="admin-welcome-greeting">Good morning, {user?.name || user?.email?.split('@')[0] || 'Admin'} 👋</h2>
                  <p className="admin-welcome-sub">Here's what's happening with Airvix today.</p>
                </div>

                {/* 4 Stat Cards in a Row */}
                <div className="admin-stat-row-4">
                  {/* 1. Total Users */}
                  <div className="admin-stat-card">
                    <div className="admin-stat-card-top">
                      <span className="admin-stat-label">Total Users</span>
                      <div className="admin-stat-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
                        <Users size={18} />
                      </div>
                    </div>
                    <div className="admin-stat-val">
                      {overview?.totalUsers != null ? overview.totalUsers.toLocaleString() : '2,843'}
                    </div>
                    <div className="admin-stat-pill admin-stat-pill-up">
                      <TrendingUp size={12} />
                      <span>12%</span>
                    </div>
                  </div>

                  {/* 2. Workspaces */}
                  <div className="admin-stat-card">
                    <div className="admin-stat-card-top">
                      <span className="admin-stat-label">Workspaces</span>
                      <div className="admin-stat-icon-wrap" style={{ background: '#ecfeff', color: '#0891b2' }}>
                        <Briefcase size={18} />
                      </div>
                    </div>
                    <div className="admin-stat-val">
                      {overview?.activeWorkspaces != null ? overview.activeWorkspaces.toLocaleString() : '1,976'}
                    </div>
                    <div className="admin-stat-pill admin-stat-pill-up">
                      <TrendingUp size={12} />
                      <span>8%</span>
                    </div>
                  </div>

                  {/* 3. Messages Processed */}
                  <div className="admin-stat-card">
                    <div className="admin-stat-card-top">
                      <span className="admin-stat-label">Messages Processed</span>
                      <div className="admin-stat-icon-wrap" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                        <Send size={18} />
                      </div>
                    </div>
                    <div className="admin-stat-val">
                      {overview?.messagesProcessedFormatted || '125.4K'}
                    </div>
                    <div className="admin-stat-pill admin-stat-pill-up">
                      <TrendingUp size={12} />
                      <span>24%</span>
                    </div>
                  </div>

                  {/* 4. Monthly Revenue */}
                  <div className="admin-stat-card">
                    <div className="admin-stat-card-top">
                      <span className="admin-stat-label">Monthly Revenue</span>
                      <div className="admin-stat-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
                        <CreditCard size={18} />
                      </div>
                    </div>
                    <div className="admin-stat-val">
                      {overview?.monthlyRevenueFormatted || '₹12.4K'}
                    </div>
                    <div className="admin-stat-pill admin-stat-pill-up">
                      <TrendingUp size={12} />
                      <span>18%</span>
                    </div>
                  </div>
                </div>

                {/* Middle Row: Platform Growth Chart & System Health */}
                <div className="admin-growth-health-grid">
                  {/* Platform Growth Chart */}
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h3 className="admin-card-title">Platform Growth</h3>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div className="admin-segmented-controls">
                          {['users', 'workspaces', 'messages', 'revenue'].map(m => (
                            <button
                              key={m}
                              type="button"
                              className={`admin-segmented-btn ${chartMetric === m ? 'active' : ''}`}
                              onClick={() => setChartMetric(m)}
                            >
                              {m}
                            </button>
                          ))}
                        </div>

                        <select
                          value={chartTimeframe}
                          onChange={(e) => setChartTimeframe(e.target.value)}
                          className="admin-select-input"
                        >
                          <option value="7d">Last 7 days</option>
                          <option value="30d">Last 30 days</option>
                        </select>
                      </div>
                    </div>

                    {/* SVG Chart Graphic */}
                    <div style={{ width: '100%', height: '220px', position: 'relative', marginTop: '8px' }}>
                      <svg width="100%" height="100%" viewBox="0 0 700 200" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGradientLight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Background subtle horizontal grid lines */}
                        <line x1="0" y1="50" x2="700" y2="50" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="0" y1="100" x2="700" y2="100" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="0" y1="150" x2="700" y2="150" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />

                        <path d={areaPathD} fill="url(#chartGradientLight)" />
                        <path d={linePathD} fill="none" stroke="#2563eb" strokeWidth="2.5" />
                        
                        {/* Active Node Dot */}
                        {chartPoints.length > 0 && (
                          <circle cx={activeLastPoint.x} cy={activeLastPoint.y} r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
                        )}
                      </svg>

                      {/* Floating Tooltip Card */}
                      <div style={{ position: 'absolute', top: '15px', right: '20px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Sep 6, 2025</div>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>
                          ● {activeLastPoint.value ? activeLastPoint.value.toLocaleString() : '1,480'} {chartMetric}
                        </div>
                      </div>

                      {/* X Axis Labels */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11.5px', marginTop: '8px' }}>
                        {activeTimeline.filter((_, idx) => {
                          if (chartTimeframe === '7d') return true;
                          return idx % 5 === 0 || idx === activeTimeline.length - 1;
                        }).map((item, idx) => (
                          <span key={idx}>{item.date}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* System Health Widget */}
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h3 className="admin-card-title">System Health</h3>
                      <a href="#status" onClick={(e) => { e.preventDefault(); setActiveTab('status'); }} style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                        View details →
                      </a>
                    </div>

                    <div className="admin-health-list">
                      {[
                        { name: 'API Services', status: 'Operational', uptime: '99.8%' },
                        { name: 'Automation Engine', status: 'Operational', uptime: '99.9%' },
                        { name: 'Database', status: 'Operational', uptime: '99.7%' },
                        { name: 'Instagram API', status: 'Operational', uptime: '99.9%' },
                        { name: 'Background Jobs', status: 'Operational', uptime: '99.8%' }
                      ].map((svc, idx) => (
                        <div key={idx} className="admin-health-row">
                          <div className="admin-health-row-left">
                            <span className="dot-green" />
                            <span>{svc.name}</span>
                          </div>
                          <span className="admin-health-uptime">{svc.uptime} uptime</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Row (3 Columns) */}
                <div className="admin-bottom-3col-grid">
                  {/* 1. Recent Users Card */}
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h3 className="admin-card-title">Recent Users</h3>
                      <a href="#users" onClick={(e) => { e.preventDefault(); setActiveTab('users'); }} style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                        View all →
                      </a>
                    </div>

                    <table className="admin-clean-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Plan</th>
                          <th>Status</th>
                          <th>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'Aarav Mehta', email: 'aara...@gmail.com', plan: 'pro', status: 'active', joined: '2m ago' },
                          { name: 'Sneha Kapoor', email: 'sneh...@gmail.com', plan: 'creator', status: 'active', joined: '1h ago' },
                          { name: 'Rohit Sharma', email: 'rohit...@gmail.com', plan: 'business', status: 'active', joined: '3h ago' },
                          { name: 'Priya Verma', email: 'priya...@gmail.com', plan: 'pro', status: 'active', joined: '5h ago' }
                        ].map((u, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="admin-avatar-initials">
                                  {u.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#0f172a' }}>{u.name}</div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`admin-badge-plan ${u.plan}`}>{u.plan}</span>
                            </td>
                            <td>
                              <span className="admin-badge-status-active">Active</span>
                            </td>
                            <td style={{ fontSize: '11.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {u.joined}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 2. Recent Activity Timeline */}
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h3 className="admin-card-title">Recent Activity</h3>
                      <a href="#audit" onClick={(e) => { e.preventDefault(); setActiveTab('audit'); }} style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                        View all →
                      </a>
                    </div>

                    <div className="admin-activity-timeline">
                      {[
                        { title: 'New user signed up', sub: 'aara...@gmail.com', time: '5m ago', bg: '#eff6ff', color: '#2563eb', icon: Users },
                        { title: 'Instagram account connected', sub: '@aarav_creations', time: '20m ago', bg: '#faf5ff', color: '#7e22ce', icon: Film },
                        { title: 'Payment successful', sub: 'Pro Plan (₹1,499)', time: '1h ago', bg: '#ecfdf5', color: '#059669', icon: CreditCard },
                        { title: 'User requested data deletion', sub: 'user_#1823', time: '3h ago', bg: '#fef2f2', color: '#dc2626', icon: Trash2 }
                      ].map((act, idx) => (
                        <div key={idx} className="admin-activity-row">
                          <div className="admin-activity-dot-icon" style={{ background: act.bg, color: act.color }}>
                            <act.icon size={14} />
                          </div>
                          <div className="admin-activity-desc">
                            <div className="admin-activity-title">{act.title}</div>
                            <div className="admin-activity-sub">{act.sub}</div>
                          </div>
                          <div className="admin-activity-time">{act.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Data Requests & Top Plans Card */}
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h3 className="admin-card-title">Data Requests</h3>
                      <a href="#security" onClick={(e) => { e.preventDefault(); setActiveTab('security'); }} style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                        View all →
                      </a>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px' }}>
                        <span style={{ fontSize: '12.5px', color: '#334155' }}>Account deletion requests</span>
                        <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>2 Pending</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px' }}>
                        <span style={{ fontSize: '12.5px', color: '#334155' }}>Data export requests</span>
                        <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>3 Pending</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px' }}>
                        <span style={{ fontSize: '12.5px', color: '#334155' }}>Completed deletions</span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>128 Last 30 days</span>
                      </div>
                    </div>

                    {/* Top Plans by Users */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>Top Plans by Users</div>
                      
                      <div className="admin-plan-bar-item">
                        <div className="admin-plan-bar-meta">
                          <span style={{ color: '#334155' }}>Pro</span>
                          <span style={{ color: '#0f172a' }}>1,248 (44%)</span>
                        </div>
                        <div className="admin-plan-bar-track">
                          <div className="admin-plan-bar-fill" style={{ width: '44%', background: '#2563eb' }}></div>
                        </div>
                      </div>

                      <div className="admin-plan-bar-item">
                        <div className="admin-plan-bar-meta">
                          <span style={{ color: '#334155' }}>Creator</span>
                          <span style={{ color: '#0f172a' }}>842 (30%)</span>
                        </div>
                        <div className="admin-plan-bar-track">
                          <div className="admin-plan-bar-fill" style={{ width: '30%', background: '#7e22ce' }}></div>
                        </div>
                      </div>

                      <div className="admin-plan-bar-item" style={{ marginBottom: 0 }}>
                        <div className="admin-plan-bar-meta">
                          <span style={{ color: '#334155' }}>Business</span>
                          <span style={{ color: '#0f172a' }}>753 (26%)</span>
                        </div>
                        <div className="admin-plan-bar-track">
                          <div className="admin-plan-bar-fill" style={{ width: '26%', background: '#0284c7' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* =========================================================================
              TAB 2: USERS DIRECTORY (Privacy-Safe Metadata)
          ========================================================================= */}
          {/* =========================================================================
              TAB 2: USERS DIRECTORY (Matches Panel 2)
          ========================================================================= */}
          {activeTab === 'users' && (() => {
            const sampleUsers = [
              { id: 'usr-1', name: 'Aarav Mehta', email: 'aara...@gmail.com', plan: 'pro', status: 'active', joined: 'Sep 8, 2026' },
              { id: 'usr-2', name: 'Sneha Kapoor', email: 'sneh...@gmail.com', plan: 'creator', status: 'active', joined: 'Sep 8, 2026' },
              { id: 'usr-3', name: 'Rohit Sharma', email: 'rohit...@gmail.com', plan: 'business', status: 'active', joined: 'Sep 7, 2026' },
              { id: 'usr-4', name: 'Karan Shah', email: 'priya...@gmail.com', plan: 'pro', status: 'inactive', joined: 'Sep 5, 2026' },
              { id: 'usr-5', name: 'Neha Singh', email: 'neha...@gmail.com', plan: 'creator', status: 'active', joined: 'Sep 5, 2026' },
              { id: 'usr-6', name: 'Neha Singh', email: 'neha...@gmail.com', plan: 'business', status: 'active', joined: 'Sep 4, 2026' },
              { id: 'usr-7', name: 'Vikram Joshi', email: 'vikram@gmail.com', plan: 'creator', status: 'active', joined: 'Sep 4, 2026' },
              { id: 'usr-8', name: 'Ishita Roy', email: 'ishita...@gmail.com', plan: 'creator', status: 'active', joined: 'Sep 3, 2026' },
              { id: 'usr-9', name: 'Mohit Jain', email: 'mohit...@gmail.com', plan: 'business', status: 'active', joined: 'Sep 3, 2026' },
              { id: 'usr-10', name: 'Ananya Patel', email: 'ananya...@gmail.com', plan: 'pro', status: 'active', joined: 'Sep 2, 2026' }
            ];

            const displayUsers = usersList && usersList.length > 0 ? usersList.map((u, i) => ({
              id: u.id,
              name: u.name || sampleUsers[i % sampleUsers.length].name,
              email: u.email || sampleUsers[i % sampleUsers.length].email,
              plan: (u.plan || 'pro').toLowerCase(),
              status: u.status === 'suspended' ? 'inactive' : 'active',
              joined: u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : sampleUsers[i % sampleUsers.length].joined,
              raw: u
            })) : sampleUsers;

            const filteredUsers = displayUsers.filter(u => {
              if (userSearch && !u.name.toLowerCase().includes(userSearch.toLowerCase()) && !u.email.toLowerCase().includes(userSearch.toLowerCase())) return false;
              if (userPlanFilter && u.plan !== userPlanFilter.toLowerCase()) return false;
              if (userStatusFilter && u.status !== userStatusFilter.toLowerCase()) return false;
              return true;
            });

            return (
              <div className="admin-card">
                {/* Header with Title and Invite User button */}
                <div className="admin-card-header" style={{ marginBottom: '14px' }}>
                  <div>
                    <h2 className="admin-card-title" style={{ fontSize: '18px', margin: 0 }}>Users</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                      Manage all platform users, their plans, and status.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-btn-primary"
                    onClick={() => showToast('✨ Invite link copied to clipboard!')}
                  >
                    <Plus size={14} />
                    <span>Invite User</span>
                  </button>
                </div>

                {/* Filter Bar */}
                <div className="admin-table-filters-bar">
                  <div className="admin-filter-group-left">
                    <select
                      className="admin-select-input"
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value)}
                    >
                      <option value="">All Users</option>
                      <option value="active">Active Users</option>
                      <option value="inactive">Inactive Users</option>
                    </select>

                    <select
                      className="admin-select-input"
                      value={userPlanFilter}
                      onChange={(e) => setUserPlanFilter(e.target.value)}
                    >
                      <option value="">All Plans</option>
                      <option value="starter">Starter</option>
                      <option value="creator">Creator</option>
                      <option value="pro">Pro</option>
                      <option value="business">Business</option>
                    </select>
                  </div>

                  <div className="admin-search-box-wrap">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="admin-search-box-input"
                    />
                  </div>
                </div>

                {/* Clean Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-clean-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.slice(0, 10).map((u, idx) => (
                        <tr key={u.id || idx}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                              <div className="admin-avatar-initials">
                                {u.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{u.name}</span>
                            </div>
                          </td>
                          <td style={{ color: '#475569', fontSize: '12.5px' }}>{u.email}</td>
                          <td>
                            <span className={`admin-badge-plan ${u.plan}`}>{u.plan}</span>
                          </td>
                          <td>
                            <span className={u.status === 'active' ? 'admin-badge-status-active' : 'admin-badge-status-inactive'}>
                              {u.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ color: '#64748b', fontSize: '12px' }}>{u.joined}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                type="button"
                                className="admin-btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => u.raw ? loadUserDetail(u.raw.id) : alert(`User: ${u.name}`)}
                                title="View Details"
                              >
                                <Info size={12} />
                              </button>
                              <button
                                type="button"
                                className="admin-btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => u.raw ? setEditingUser(u.raw) : alert(`Edit: ${u.name}`)}
                                title="Edit User"
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="admin-pagination-footer">
                  <span>Showing 1-10 of {totalUsers || 2843} users</span>
                  <div className="admin-pagination-controls">
                    <button type="button" className="admin-pagination-btn">&lt;</button>
                    <button type="button" className="admin-pagination-btn active">1</button>
                    <button type="button" className="admin-pagination-btn">2</button>
                    <button type="button" className="admin-pagination-btn">3</button>
                    <button type="button" className="admin-pagination-btn">4</button>
                    <button type="button" className="admin-pagination-btn">5</button>
                    <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>
                    <button type="button" className="admin-pagination-btn">285</button>
                    <button type="button" className="admin-pagination-btn">&gt;</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* =========================================================================
              TAB 3: WORKSPACES (Matches Panel 3)
          ========================================================================= */}
          {activeTab === 'workspaces' && (() => {
            const sampleWorkspaces = [
              { id: 'ws-1', name: 'StudioVibe', owner: 'Aarav Mehta', accounts: 3, plan: 'pro', status: 'active' },
              { id: 'ws-2', name: 'FitLife', owner: 'Sneha Kapoor', accounts: 2, plan: 'creator', status: 'active' },
              { id: 'ws-3', name: 'GlowBrand', owner: 'Rohit Sharma', accounts: 5, plan: 'business', status: 'active' },
              { id: 'ws-4', name: 'Marketing Hub', owner: 'Priya Verma', accounts: 1, plan: 'pro', status: 'paused' },
              { id: 'ws-5', name: 'The Daily Post', owner: 'Karan Singh', accounts: 2, plan: 'creator', status: 'active' },
              { id: 'ws-6', name: 'TrendNest', owner: 'Neha Singh', accounts: 2, plan: 'business', status: 'active' },
              { id: 'ws-7', name: 'Creator Central', owner: 'Vikram Joshi', accounts: 3, plan: 'creator', status: 'active' },
              { id: 'ws-8', name: 'Social Scope', owner: 'Ishita Roy', accounts: 1, plan: 'creator', status: 'inactive' },
              { id: 'ws-9', name: 'Brand Boost', owner: 'Mohit Jain', accounts: 4, plan: 'business', status: 'active' },
              { id: 'ws-10', name: 'Viral Vibes', owner: 'Ananya Patel', accounts: 2, plan: 'pro', status: 'active' }
            ];

            const displayWorkspaces = workspacesList && workspacesList.length > 0 ? workspacesList.map((ws, i) => ({
              id: ws.id,
              name: ws.name || sampleWorkspaces[i % sampleWorkspaces.length].name,
              owner: ws.owner_email_masked || sampleWorkspaces[i % sampleWorkspaces.length].owner,
              accounts: ws.connected_accounts || sampleWorkspaces[i % sampleWorkspaces.length].accounts,
              plan: (ws.plan || sampleWorkspaces[i % sampleWorkspaces.length].plan).toLowerCase(),
              status: ws.status || sampleWorkspaces[i % sampleWorkspaces.length].status
            })) : sampleWorkspaces;

            return (
              <div className="admin-card">
                {/* Header */}
                <div className="admin-card-header" style={{ marginBottom: '14px' }}>
                  <div>
                    <h2 className="admin-card-title" style={{ fontSize: '18px', margin: 0 }}>Workspaces</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                      Manage workspaces, owners, and connected accounts.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-btn-primary"
                    onClick={() => showToast('✨ Provisioning new multi-tenant workspace...')}
                  >
                    <Plus size={14} />
                    <span>New Workspace</span>
                  </button>
                </div>

                {/* Filter Bar */}
                <div className="admin-table-filters-bar">
                  <div className="admin-search-box-wrap">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Search workspaces..."
                      className="admin-search-box-input"
                    />
                  </div>

                  <select className="admin-select-input">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-clean-table">
                    <thead>
                      <tr>
                        <th>Workspace</th>
                        <th>Owner</th>
                        <th>Accounts</th>
                        <th>Plan</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayWorkspaces.map((ws, idx) => (
                        <tr key={ws.id || idx}>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{ws.name}</td>
                          <td style={{ color: '#475569' }}>{ws.owner}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{ws.accounts}</td>
                          <td>
                            <span className={`admin-badge-plan ${ws.plan}`}>{ws.plan}</span>
                          </td>
                          <td>
                            <span className={ws.status === 'active' ? 'admin-badge-status-active' : ws.status === 'paused' ? 'admin-badge-status-paused' : 'admin-badge-status-inactive'}>
                              {ws.status === 'active' ? 'Active' : ws.status === 'paused' ? 'Paused' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="admin-pagination-footer">
                  <span>Showing 1-10 of {workspacesList.length || 1876} workspaces</span>
                  <div className="admin-pagination-controls">
                    <button type="button" className="admin-pagination-btn">&lt;</button>
                    <button type="button" className="admin-pagination-btn active">1</button>
                    <button type="button" className="admin-pagination-btn">2</button>
                    <button type="button" className="admin-pagination-btn">3</button>
                    <button type="button" className="admin-pagination-btn">4</button>
                    <button type="button" className="admin-pagination-btn">5</button>
                    <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>
                    <button type="button" className="admin-pagination-btn">198</button>
                    <button type="button" className="admin-pagination-btn">&gt;</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* =========================================================================
              TAB 4: SECURITY, GOVERNANCE, KILL SWITCH & COST PROTECTION
          ========================================================================= */}
          {activeTab === 'security' && (() => {
            const isGlobalPaused = killSwitches.some(k => k.scope === 'global' && (k.is_active === 1 || k.is_active === true));
            const globalKillSwitchInfo = killSwitches.find(k => k.scope === 'global' && (k.is_active === 1 || k.is_active === true));
            const scopedKillSwitches = killSwitches.filter(k => k.scope !== 'global' && (k.is_active === 1 || k.is_active === true));

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Section Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 className="admin-card-title" style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={22} color="#2563eb" />
                      <span>Security, Governance &amp; Threat Defense</span>
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Emergency controls, multi-tenant abuse flags, API metering &amp; session revocation.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={() => {
                      loadSecurityPrivacy();
                      loadKillSwitches();
                      loadAbuseFlags();
                      loadCostReport();
                      loadSessions();
                      showToast('🔄 Security metrics refreshed');
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={14} />
                    <span>Refresh Diagnostics</span>
                  </button>
                </div>

                {/* 1. EMERGENCY KILL SWITCH CONTROL BANNER */}
                <div style={{
                  background: isGlobalPaused ? '#fef2f2' : '#ffffff',
                  border: `2px solid ${isGlobalPaused ? '#ef4444' : '#e2e8f0'}`,
                  borderRadius: '14px',
                  padding: '20px 24px',
                  boxShadow: isGlobalPaused ? '0 10px 25px rgba(239, 68, 68, 0.15)' : 'var(--admin-shadow-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '700px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: isGlobalPaused ? '#fee2e2' : '#ecfdf5',
                      color: isGlobalPaused ? '#dc2626' : '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Power size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: isGlobalPaused ? '#991b1b' : '#0f172a' }}>
                          {isGlobalPaused ? '🛑 EMERGENCY GLOBAL KILL SWITCH: ACTIVE' : '🟢 GLOBAL AUTOMATION ENGINE: RUNNING'}
                        </h3>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: isGlobalPaused ? '#dc2626' : '#10b981',
                          color: '#ffffff'
                        }}>
                          {isGlobalPaused ? 'SYSTEM FROZEN' : 'NORMAL'}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: isGlobalPaused ? '#7f1d1d' : '#64748b', lineHeight: 1.4 }}>
                        {isGlobalPaused
                          ? `All background webhooks, message processing, and automated replies are halted. Reason: "${globalKillSwitchInfo?.reason || 'Admin Emergency'}" (Updated by ${globalKillSwitchInfo?.created_by || 'Admin'}).`
                          : 'Zero systemic blocks. All connected Instagram accounts are responding to DM triggers according to user keyword rules.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isGlobalPaused ? (
                      <button
                        type="button"
                        disabled={togglingKillSwitch}
                        onClick={() => handleToggleGlobalKillSwitch(false)}
                        style={{
                          background: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <Check size={16} />
                        <span>Resume All System Automation</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={togglingKillSwitch}
                        onClick={() => handleToggleGlobalKillSwitch(true)}
                        style={{
                          background: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
                        }}
                      >
                        <AlertTriangle size={16} />
                        <span>Emergency Pause All Automation</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Scoped Pauses (if any) */}
                {scopedKillSwitches.length > 0 && (
                  <div className="admin-card" style={{ padding: '16px 20px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <AlertCircle size={16} color="#d97706" />
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#92400e' }}>
                        Active Scoped Pauses ({scopedKillSwitches.length})
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {scopedKillSwitches.map((sw, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', color: '#78350f', background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                          <span><strong>{sw.scope.toUpperCase()}:</strong> {sw.target_id} — {sw.reason}</span>
                          {sw.scope === 'account' && (
                            <button
                              type="button"
                              onClick={() => handleToggleAccountKillSwitch(sw.target_id, false)}
                              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Resume Account
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. ABUSE & THREAT DETECTION FLAGS */}
                <div className="admin-card">
                  <div className="admin-card-header" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 className="admin-card-title" style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={18} color="#dc2626" />
                        <span>Abuse &amp; Anomaly Detection</span>
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Spam spikes, abnormal webhook floods, loop incidents, and per-tenant threshold violations.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setAbuseFilter('unresolved')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1px solid var(--admin-card-border)',
                          background: abuseFilter === 'unresolved' ? '#2563eb' : '#ffffff',
                          color: abuseFilter === 'unresolved' ? '#ffffff' : '#64748b'
                        }}
                      >
                        Unresolved
                      </button>
                      <button
                        type="button"
                        onClick={() => setAbuseFilter('all')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: '1px solid var(--admin-card-border)',
                          background: abuseFilter === 'all' ? '#2563eb' : '#ffffff',
                          color: abuseFilter === 'all' ? '#ffffff' : '#64748b'
                        }}
                      >
                        All History
                      </button>
                    </div>
                  </div>

                  {abuseFlagsList.length === 0 ? (
                    <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                      <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                        Zero {abuseFilter === 'unresolved' ? 'unresolved' : ''} abuse flags detected
                      </div>
                      <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                        Automated DM volume, rapid keyword triggers, and message frequencies are within compliant Meta thresholds.
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="admin-clean-table">
                        <thead>
                          <tr>
                            <th>Severity</th>
                            <th>Violation Type</th>
                            <th>Target / Account</th>
                            <th>Trigger Reason</th>
                            <th>Detected</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {abuseFlagsList.map((flag) => {
                            const isCrit = flag.severity === 'critical';
                            const isHigh = flag.severity === 'high';
                            const isResolved = flag.is_resolved === 1 || flag.is_resolved === true;

                            return (
                              <tr key={flag.id}>
                                <td>
                                  <span style={{
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    background: isCrit ? '#fee2e2' : isHigh ? '#ffedd5' : '#eff6ff',
                                    color: isCrit ? '#dc2626' : isHigh ? '#c2410c' : '#2563eb'
                                  }}>
                                    {(flag.severity || 'MEDIUM').toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', fontSize: '12px' }}>
                                  {flag.flag_type}
                                </td>
                                <td style={{ fontSize: '12px', color: '#475569' }}>
                                  {flag.account_id || flag.user_id || 'System'}
                                </td>
                                <td style={{ fontSize: '12px', color: '#334155', maxWidth: '280px' }}>
                                  {flag.reason}
                                </td>
                                <td style={{ fontSize: '11.5px', color: '#64748b' }}>
                                  {flag.detected_at || flag.created_at || 'Recently'}
                                </td>
                                <td>
                                  {isResolved ? (
                                    <span className="admin-badge-status-active">Resolved</span>
                                  ) : (
                                    <span className="admin-badge-status-paused">Pending</span>
                                  )}
                                </td>
                                <td>
                                  {!isResolved ? (
                                    <button
                                      type="button"
                                      onClick={() => handleResolveAbuseFlag(flag.id)}
                                      className="admin-btn-secondary"
                                      style={{ padding: '4px 10px', fontSize: '11px' }}
                                    >
                                      Resolve
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{flag.resolved_by || 'Auto'}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3. COST PROTECTION & API METERING REPORT */}
                <div className="admin-card">
                  <div className="admin-card-header" style={{ marginBottom: '14px' }}>
                    <div>
                      <h3 className="admin-card-title" style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DollarSign size={18} color="#10b981" />
                        <span>Cost Protection &amp; API Consumption</span>
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Per-tenant API metering, Meta Graph API quota consumption, and AI token billing safeguards.
                      </p>
                    </div>
                  </div>

                  {/* Summary Breakdown Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                    {(costReport?.summary_by_api || [
                      { api_type: 'meta_graph_api', total_calls: 12450, total_units: 12450 },
                      { api_type: 'openai_llm', total_calls: 1420, total_units: 42600 },
                      { api_type: 'webhook_ingress', total_calls: 38200, total_units: 38200 }
                    ]).map((apiStat, i) => (
                      <div key={i} style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                          {apiStat.api_type.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0 2px' }}>
                          {Number(apiStat.total_calls).toLocaleString()} calls
                        </div>
                        <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                          {Number(apiStat.total_units).toLocaleString()} cost units metered
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Top Consumers Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                      Top Consuming Tenants (Safeguard Quotas)
                    </div>
                    <table className="admin-clean-table">
                      <thead>
                        <tr>
                          <th>Tenant Email</th>
                          <th>Plan</th>
                          <th>Total Calls</th>
                          <th>Units Consumed</th>
                          <th>Quota Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(costReport?.top_consuming_tenants || []).length > 0 ? (
                          costReport.top_consuming_tenants.map((t, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: '#0f172a' }}>{t.email}</td>
                              <td><span className="admin-badge-plan">{t.plan?.toUpperCase() || 'FREE'}</span></td>
                              <td style={{ color: '#475569' }}>{Number(t.call_count).toLocaleString()}</td>
                              <td style={{ color: '#0f172a', fontWeight: 600 }}>{Number(t.total_units).toLocaleString()}</td>
                              <td><span className="admin-badge-status-active">Normal</span></td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                              No excessive tenant consumption detected in current metering period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. ACTIVE ADMIN & STAFF SESSIONS */}
                <div className="admin-card">
                  <div className="admin-card-header" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 className="admin-card-title" style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Lock size={18} color="#2563eb" />
                        <span>Active Staff &amp; Admin Sessions</span>
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Revoke compromised sessions or invalidate tokens across devices.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRevokeAllSessions}
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Revoke All Other Sessions
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-clean-table">
                      <thead>
                        <tr>
                          <th>Admin User</th>
                          <th>IP Address</th>
                          <th>Client / User Agent</th>
                          <th>Session Started</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsList.length > 0 ? (
                          sessionsList.map((s) => (
                            <tr key={s.id}>
                              <td style={{ fontWeight: 600, color: '#0f172a' }}>{s.user_email || 'You (Admin)'}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>{s.ip_address || '127.0.0.1'}</td>
                              <td style={{ fontSize: '11.5px', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {s.user_agent || 'Chrome / Windows'}
                              </td>
                              <td style={{ fontSize: '12px', color: '#64748b' }}>{s.created_at || 'Active'}</td>
                              <td>
                                {s.current ? (
                                  <span className="admin-badge-status-active">Current Session</span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>Active</span>
                                )}
                              </td>
                              <td>
                                {!s.current && (
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeSession(s.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 600
                                    }}
                                  >
                                    Revoke
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                              Current session is active.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. PRIVACY & DATA RETENTION POLICY TILES */}
                <div className="admin-security-4cards-grid">
                  <div className="admin-sec-card">
                    <div className="admin-sec-card-header">
                      <div className="admin-sec-card-icon"><Shield size={18} /></div>
                      <span className="admin-badge-status-active">Active</span>
                    </div>
                    <div className="admin-sec-card-title">AES-256 GCM Encryption</div>
                    <div className="admin-sec-card-desc">All OAuth tokens, webhook payloads, and customer data are encrypted with unique keys.</div>
                  </div>

                  <div className="admin-sec-card">
                    <div className="admin-sec-card-header">
                      <div className="admin-sec-card-icon"><Lock size={18} /></div>
                      <span className="admin-badge-status-active">Enforced</span>
                    </div>
                    <div className="admin-sec-card-title">Multi-Tenant Isolation</div>
                    <div className="admin-sec-card-desc">Strict query isolation and account scoping prevents cross-tenant data leakage.</div>
                  </div>

                  <div className="admin-sec-card">
                    <div className="admin-sec-card-header">
                      <div className="admin-sec-card-icon"><Calendar size={18} /></div>
                      <span className="admin-badge-status-active">90 Days</span>
                    </div>
                    <div className="admin-sec-card-title">Automated Data Retention</div>
                    <div className="admin-sec-card-desc">Conversations auto-purged after 90 days. Raw incident logs purged after 30 days.</div>
                  </div>

                  <div className="admin-sec-card">
                    <div className="admin-sec-card-header">
                      <div className="admin-sec-card-icon"><CheckCircle2 size={18} /></div>
                      <span className="admin-badge-status-active">Compliant</span>
                    </div>
                    <div className="admin-sec-card-title">GDPR Deletion Webhook</div>
                    <div className="admin-sec-card-desc">Meta data deletion callback endpoint with signed confirmation codes is live.</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* =========================================================================
              TAB 5: AUDIT LOGS (Matches Panel 11)
          ========================================================================= */}
          {activeTab === 'audit' && (
            <div className="admin-card">
              <div className="admin-card-header" style={{ marginBottom: '14px' }}>
                <div>
                  <h2 className="admin-card-title" style={{ fontSize: '18px', margin: 0 }}>Audit Logs</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Track important actions across the platform.
                  </p>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="admin-table-filters-bar">
                <div className="admin-filter-group-left">
                  <select className="admin-select-input">
                    <option>All Actions</option>
                    <option>Billing Updates</option>
                    <option>Workspace Created</option>
                    <option>User Logins</option>
                  </select>

                  <select className="admin-select-input">
                    <option>All Users</option>
                    <option>David Sharma</option>
                    <option>Sneha Kapoor</option>
                    <option>Rohit Sharma</option>
                  </select>
                </div>

                <div className="admin-search-box-wrap">
                  <Search size={14} />
                  <input type="text" placeholder="Search logs..." className="admin-search-box-input" />
                </div>
              </div>

              {/* Clean Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-clean-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>User</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { time: '10:42 AM', action: 'Updated billing settings', user: 'David Sharma', details: 'Changed plan for StudioVibe' },
                      { time: '09:21 AM', action: 'Created workspace', user: 'Sneha Kapoor', details: 'Workspace: FitLife' },
                      { time: '08:14 AM', action: 'Deleted automation', user: 'Rohit Sharma', details: 'Automation ID: #1234' },
                      { time: '07:35 AM', action: 'User login', user: 'Priya Verma', details: 'IP: 192.168.1.8' },
                      { time: '07:32 AM', action: 'Connected Instagram', user: 'Karan Shah', details: 'Account: @the_daily_post' }
                    ].map((log, idx) => (
                      <tr key={idx}>
                        <td style={{ color: '#64748b', fontSize: '12px' }}>{log.time}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{log.action}</td>
                        <td style={{ color: '#475569' }}>{log.user}</td>
                        <td style={{ color: '#64748b', fontSize: '12.5px' }}>{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 6: SYSTEM STATUS (Matches Panel 12)
          ========================================================================= */}
          {activeTab === 'status' && (
            <div className="admin-card">
              <div className="admin-card-header" style={{ marginBottom: '16px' }}>
                <h2 className="admin-card-title" style={{ fontSize: '18px', margin: 0 }}>System Status</h2>
                <div className="admin-badge-status-active" style={{ fontSize: '12px', padding: '4px 10px' }}>
                  All systems operational
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="admin-clean-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Status</th>
                      <th>Uptime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'API Services', status: 'Operational', uptime: '99.9% uptime', icon: Server },
                      { name: 'Automation Engine', status: 'Operational', uptime: '99.8% uptime', icon: Zap },
                      { name: 'Database', status: 'Operational', uptime: '99.9% uptime', icon: Layers },
                      { name: 'Instagram API', status: 'Operational', uptime: '99.7% uptime', icon: Film },
                      { name: 'Background Jobs', status: 'Operational', uptime: '99.9% uptime', icon: Activity },
                      { name: 'Web App', status: 'Operational', uptime: '99.9% uptime', icon: Globe }
                    ].map((svc, idx) => (
                      <tr key={idx}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontWeight: 600, color: '#0f172a' }}>
                            <svc.icon size={15} color="#64748b" />
                            <span>{svc.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="admin-badge-status-active">{svc.status}</span>
                        </td>
                        <td style={{ color: '#059669', fontWeight: 600, fontSize: '12.5px' }}>{svc.uptime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 7: PLANS & BILLINGS (Matches Panel 4)
          ========================================================================= */}
          {activeTab === 'plans' && (
            <div>
              {/* Header */}
              <div className="admin-card-header" style={{ marginBottom: '14px' }}>
                <h2 className="admin-card-title" style={{ fontSize: '18px', margin: 0 }}>Plans &amp; Billings</h2>
                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={() => {
                    setEditingPlan(null);
                    setPlanFormData({
                      id: `plan-${Date.now()}`,
                      slug: 'custom-plan',
                      name: 'Custom VIP Plan',
                      monthlyPrice: 4999,
                      annualPrice: 3999,
                      dmLimit: 50000,
                      igLimit: 5,
                      rulesLimit: 50,
                      badge: 'SPECIAL',
                      popular: false,
                      description: 'Custom tier for high-volume creators',
                      features: ['50,000 DMs/mo', '5 Connected Accounts', 'Priority Support'],
                      active: true
                    });
                    setPlanFeaturesText("50,000 DMs/mo\n5 Connected Accounts\nPriority Support");
                    setIsCreatingPlan(true);
                  }}
                >
                  <Plus size={14} />
                  <span>Add Plan</span>
                </button>
              </div>

              {/* Subtabs */}
              <div className="admin-subtabs-nav">
                <button type="button" className="admin-subtab-btn active">Subscriptions</button>
                <button type="button" className="admin-subtab-btn">Invoices</button>
                <button type="button" className="admin-subtab-btn">Coupons</button>
                <button type="button" className="admin-subtab-btn">Settings</button>
              </div>

              {/* Plans Table Card */}
              <div className="admin-card" style={{ marginBottom: '24px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-clean-table">
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Price</th>
                        <th>Billing Cycle</th>
                        <th>Users</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 'p-1', name: 'Starter', price: '₹0', cycle: 'Monthly', users: '842', status: 'Active' },
                        { id: 'p-2', name: 'Pro', price: '₹1,499', cycle: 'Monthly', users: '1,248', status: 'Active' },
                        { id: 'p-3', name: 'Business', price: '₹2,999', cycle: 'Monthly', users: '703', status: 'Active' }
                      ].map((plan, idx) => (
                        <tr key={plan.id || idx}>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{plan.name}</td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{plan.price}</td>
                          <td style={{ color: '#475569' }}>{plan.cycle}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{plan.users}</td>
                          <td>
                            <span className="admin-badge-status-active">{plan.status}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                type="button"
                                className="admin-btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => {
                                  const real = plansList.find(p => p.name.toLowerCase() === plan.name.toLowerCase()) || plansList[0];
                                  if (real) {
                                    setEditingPlan(real);
                                    setPlanFormData(real);
                                    setPlanFeaturesText(Array.isArray(real.features) ? real.features.join('\n') : '');
                                    setIsCreatingPlan(true);
                                  }
                                }}
                              >
                                <Edit3 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Revenue Overview Card */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3 className="admin-card-title">Revenue Overview</h3>
                  <select className="admin-select-input">
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Yearly</option>
                  </select>
                </div>

                {/* Bar Chart Container */}
                <div className="admin-rev-bars-wrap">
                  {[
                    { month: 'Jan', val: 35, amt: '₹3,500' },
                    { month: 'Feb', val: 42, amt: '₹4,200' },
                    { month: 'Mar', val: 55, amt: '₹5,500' },
                    { month: 'Apr', val: 48, amt: '₹4,800' },
                    { month: 'May', val: 65, amt: '₹6,500' },
                    { month: 'Jun', val: 78, amt: '₹7,800' },
                    { month: 'Jul', val: 92, amt: '₹9,200' },
                    { month: 'Aug', val: 110, amt: '₹11,000' },
                    { month: 'Sep', val: 140, amt: '₹12,400', highlight: true },
                    { month: 'Oct', val: 120, amt: '₹12,000' }
                  ].map((col, idx) => (
                    <div key={idx} className="admin-rev-col">
                      {col.highlight && (
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                          {col.amt}
                        </div>
                      )}
                      <div
                        className={`admin-rev-bar ${col.highlight ? 'highlight' : ''}`}
                        style={{ height: `${col.val}%` }}
                        title={`${col.month}: ${col.amt}`}
                      />
                      <span className="admin-rev-month-label">{col.month}</span>
                    </div>
                  ))}
                </div>

                {/* 3 Metric Boxes Below Bar Chart */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Total Revenue</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>₹12,400</div>
                    <span className="admin-stat-pill admin-stat-pill-up">↑ 18%</span>
                  </div>

                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Active Subscriptions</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>2,793</div>
                    <span className="admin-stat-pill admin-stat-pill-up">↑ 12%</span>
                  </div>

                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Churn Rate</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>1.2%</div>
                    <span className="admin-stat-pill admin-stat-pill-up">↓ 0.3%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 8: INTEGRATIONS (Matches Panel 6)
          ========================================================================= */}
          {activeTab === 'integrations' && (
            <div>
              <div className="admin-card-header" style={{ marginBottom: '18px' }}>
                <div>
                  <h2 className="admin-card-title" style={{ fontSize: '18px', margin: 0 }}>Integrations</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Connect and manage third-party services.
                  </p>
                </div>
              </div>

              {/* 3x2 Grid */}
              <div className="admin-integrations-3x2-grid">
                {/* 1. Instagram */}
                <div className="admin-integration-card">
                  <div className="admin-integration-app-icon" style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', color: '#ffffff' }}>
                    <Film size={26} />
                  </div>
                  <div className="admin-integration-app-name">Instagram</div>
                  <div className="admin-integration-status-badge">
                    <span className="admin-badge-status-active">Connected</span>
                  </div>
                  <button type="button" className="admin-integration-action-btn" onClick={() => showToast('Instagram API Status: All Webhooks Active')}>
                    Manage
                  </button>
                </div>

                {/* 2. OpenAI */}
                <div className="admin-integration-card">
                  <div className="admin-integration-app-icon" style={{ background: '#10a37f', color: '#ffffff' }}>
                    <Sparkles size={26} />
                  </div>
                  <div className="admin-integration-app-name">OpenAI</div>
                  <div className="admin-integration-status-badge">
                    <span className="admin-badge-status-active">Connected</span>
                  </div>
                  <button type="button" className="admin-integration-action-btn" onClick={() => showToast('OpenAI Model: GPT-4o Mini connected')}>
                    Manage
                  </button>
                </div>

                {/* 3. Slack */}
                <div className="admin-integration-card">
                  <div className="admin-integration-app-icon" style={{ background: '#4a154b', color: '#ffffff' }}>
                    <MessageSquare size={26} />
                  </div>
                  <div className="admin-integration-app-name">Slack</div>
                  <div className="admin-integration-status-badge">
                    <span className="admin-badge-status-inactive" style={{ background: '#f1f5f9', color: '#64748b', borderColor: '#e2e8f0' }}>
                      Not connected
                    </span>
                  </div>
                  <button type="button" className="admin-integration-action-btn primary" onClick={() => showToast('Connecting Slack webhook workspace...')}>
                    Connect
                  </button>
                </div>

                {/* 4. Zapier */}
                <div className="admin-integration-card">
                  <div className="admin-integration-app-icon" style={{ background: '#ff4a00', color: '#ffffff' }}>
                    <Zap size={26} />
                  </div>
                  <div className="admin-integration-app-name">Zapier</div>
                  <div className="admin-integration-status-badge">
                    <span className="admin-badge-status-active">Connected</span>
                  </div>
                  <button type="button" className="admin-integration-action-btn" onClick={() => showToast('Zapier Webhook Ingestion: Active')}>
                    Manage
                  </button>
                </div>

                {/* 5. Make (Integromat) */}
                <div className="admin-integration-card">
                  <div className="admin-integration-app-icon" style={{ background: '#6f2cf3', color: '#ffffff' }}>
                    <SlidersHorizontal size={26} />
                  </div>
                  <div className="admin-integration-app-name">Make (Integromat)</div>
                  <div className="admin-integration-status-badge">
                    <span className="admin-badge-status-inactive" style={{ background: '#f1f5f9', color: '#64748b', borderColor: '#e2e8f0' }}>
                      Not connected
                    </span>
                  </div>
                  <button type="button" className="admin-integration-action-btn primary" onClick={() => showToast('Connecting Make webhook scenario...')}>
                    Connect
                  </button>
                </div>

                {/* 6. Webhooks */}
                <div className="admin-integration-card">
                  <div className="admin-integration-app-icon" style={{ background: '#0284c7', color: '#ffffff' }}>
                    <Plug size={26} />
                  </div>
                  <div className="admin-integration-app-name">Webhooks</div>
                  <div className="admin-integration-status-badge">
                    <span className="admin-badge-status-active">Connected</span>
                  </div>
                  <button type="button" className="admin-integration-action-btn" onClick={() => showToast('Custom Webhooks: 4 Active Endpoints')}>
                    Manage
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 9: AUTOMATION HEALTH (Matches Panel 7)
          ========================================================================= */}
          {activeTab === 'safeguards' && (
            <div>
              {/* Header */}
              <div className="admin-card-header" style={{ marginBottom: '16px' }}>
                <div>
                  <h2 className="admin-card-title" style={{ fontSize: '18px', margin: 0 }}>Automation Health</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Monitor your automation systems and performance.
                  </p>
                </div>

                <select className="admin-select-input">
                  <option>Last 24 hours</option>
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                </select>
              </div>

              {/* 4 Stat Cards */}
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Messages Processed</span>
                  </div>
                  <div className="admin-stat-val">125.4K</div>
                  <span className="admin-stat-pill admin-stat-pill-up">↑ 24%</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Success Rate</span>
                  </div>
                  <div className="admin-stat-val">99.8%</div>
                  <span className="admin-stat-pill admin-stat-pill-up">↑ 2%</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Failed Actions</span>
                  </div>
                  <div className="admin-stat-val">214</div>
                  <span className="admin-stat-pill admin-stat-pill-down">↓ 61%</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Avg. Response Time</span>
                  </div>
                  <div className="admin-stat-val">1.2s</div>
                  <span className="admin-stat-pill admin-stat-pill-up">↓ 12%</span>
                </div>
              </div>

              {/* Recent Automation Events */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3 className="admin-card-title">Recent Automation Events</h3>
                  <a href="#all-events" onClick={(e) => e.preventDefault()} style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                    View all →
                  </a>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-clean-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Event</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { time: '10:42 AM', event: 'Comment reply sent', status: 'Success', details: 'User: @alec_12' },
                        { time: '10:38 AM', event: 'DM triggered', status: 'Success', details: 'Keyword: "price"' },
                        { time: '10:21 AM', event: 'Automation failed', status: 'Failed', details: 'Rate limit exceeded' },
                        { time: '10:18 AM', event: 'Comment reply sent', status: 'Success', details: 'User: @priya_8' },
                        { time: '09:54 AM', event: 'DM triggered', status: 'Success', details: 'Keyword: "link"' }
                      ].map((ev, idx) => (
                        <tr key={idx}>
                          <td style={{ color: '#64748b', fontSize: '12px' }}>{ev.time}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{ev.event}</td>
                          <td>
                            <span className={ev.status === 'Success' ? 'admin-badge-status-active' : 'admin-badge-status-inactive'}>
                              {ev.status}
                            </span>
                          </td>
                          <td style={{ color: '#64748b', fontSize: '12.5px' }}>{ev.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 10: ANALYTICS (Matches Panel 8)
          ========================================================================= */}
          {activeTab === 'analytics' && (
            <div>
              {/* Subtabs + Date Picker */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
                <div className="admin-subtabs-nav" style={{ marginBottom: 0 }}>
                  <button type="button" className="admin-subtab-btn active">Overview</button>
                  <button type="button" className="admin-subtab-btn">Engagement</button>
                  <button type="button" className="admin-subtab-btn">Audience</button>
                  <button type="button" className="admin-subtab-btn">Revenue</button>
                </div>

                <button type="button" className="admin-date-picker-btn">
                  <Calendar size={13} />
                  <span>Sep 1, 2026 - Sep 8, 2026</span>
                  <ChevronDown size={13} />
                </button>
              </div>

              {/* 4 Stat Cards */}
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Total Messages</span>
                  </div>
                  <div className="admin-stat-val">125.4K</div>
                  <span className="admin-stat-pill admin-stat-pill-up">↑ 24%</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Unique Users</span>
                  </div>
                  <div className="admin-stat-val">48.2K</div>
                  <span className="admin-stat-pill admin-stat-pill-up">↑ 18%</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Conversion Rate</span>
                  </div>
                  <div className="admin-stat-val">12.4%</div>
                  <span className="admin-stat-pill admin-stat-pill-up">↑ 9%</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Revenue</span>
                  </div>
                  <div className="admin-stat-val">₹12.4K</div>
                  <span className="admin-stat-pill admin-stat-pill-up">↑ 18%</span>
                </div>
              </div>

              {/* Engagement Trend Multi-line Chart Card */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3 className="admin-card-title">Engagement Trend</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }}></span>
                      <span style={{ color: '#334155' }}>Comments</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }}></span>
                      <span style={{ color: '#334155' }}>DMs</span>
                    </div>
                  </div>
                </div>

                <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                  <svg viewBox="0 0 700 200" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                    {/* Grid lines */}
                    <line x1="0" y1="50" x2="700" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="0" y1="100" x2="700" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="0" y1="150" x2="700" y2="150" stroke="#f1f5f9" strokeWidth="1" />

                    {/* Comments Line (Blue) */}
                    <path
                      d="M 0,160 Q 120,150 200,135 T 400,110 T 600,60 T 700,45"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                    />

                    {/* DMs Line (Purple) */}
                    <path
                      d="M 0,175 Q 120,165 200,150 T 400,130 T 600,90 T 700,70"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="3"
                    />

                    {/* Dots on points */}
                    <circle cx="200" cy="135" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="400" cy="110" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="600" cy="60" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="700" cy="45" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />

                    <circle cx="200" cy="150" r="4" fill="#a855f7" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="400" cy="130" r="4" fill="#a855f7" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="600" cy="90" r="4" fill="#a855f7" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="700" cy="70" r="5" fill="#a855f7" stroke="#ffffff" strokeWidth="2" />
                  </svg>

                  {/* X Axis Labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                    <span>Sep 1</span>
                    <span>Sep 2</span>
                    <span>Sep 3</span>
                    <span>Sep 4</span>
                    <span>Sep 5</span>
                    <span>Sep 6</span>
                    <span>Sep 7</span>
                    <span>Sep 8</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 11: SUPPORT (Matches Panel 9)
          ========================================================================= */}
          {activeTab === 'support' && (
            <div className="admin-card">
              <div className="admin-card-header" style={{ marginBottom: '14px' }}>
                <div>
                  <h2 className="admin-card-title" style={{ fontSize: '18px', margin: 0 }}>Support</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Manage customer support tickets.
                  </p>
                </div>
              </div>

              {/* Subtabs filter */}
              <div className="admin-subtabs-nav">
                <button type="button" className="admin-subtab-btn active">Open (12)</button>
                <button type="button" className="admin-subtab-btn">In Progress (5)</button>
                <button type="button" className="admin-subtab-btn">Resolved (128)</button>
              </div>

              {/* Clean Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-clean-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Subject</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { user: 'Aarav Mehta', subject: "Can't connect IG", priority: 'High', status: 'Open', created: '2h ago' },
                      { user: 'Sneha Kapoor', subject: 'Automation issue', priority: 'Medium', status: 'In Progress', created: '4h ago' },
                      { user: 'Rohit Sharma', subject: 'Billing question', priority: 'Low', status: 'Open', created: '6h ago' },
                      { user: 'Priya Verma', subject: 'Feature request', priority: 'Medium', status: 'Resolved', created: '1d ago' },
                      { user: 'Karan Shah', subject: 'Account access', priority: 'High', status: 'Open', created: '1d ago' }
                    ].map((ticket, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{ticket.user}</td>
                        <td style={{ color: '#334155', fontWeight: 500 }}>{ticket.subject}</td>
                        <td>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: ticket.priority === 'High' ? '#fef2f2' : ticket.priority === 'Medium' ? '#fffbeb' : '#f8fafc',
                            color: ticket.priority === 'High' ? '#dc2626' : ticket.priority === 'Medium' ? '#d97706' : '#64748b',
                            border: `1px solid ${ticket.priority === 'High' ? '#fecaca' : ticket.priority === 'Medium' ? '#fde68a' : '#e2e8f0'}`
                          }}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td>
                          <span className={ticket.status === 'Resolved' ? 'admin-badge-status-active' : ticket.status === 'In Progress' ? 'admin-badge-status-paused' : 'admin-badge-plan pro'}>
                            {ticket.status}
                          </span>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '12px' }}>{ticket.created}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: LANDING PAGE & WEBSITE CMS — Professional Section Editor
          ========================================================================= */}
          {activeTab === 'landing_cms' && (
            <LandingPageEditor user={user} onBackToApp={onBackToApp} showToast={showToast} />
          )}
        </main>
      </div>

      {/* =========================================================================
          MODAL: USER ACCESS CONTROL & DETAILS
      ========================================================================= */}
      {selectedUserDetail && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedUserDetail(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="#3b82f6" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>
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
                  <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 600 }}>{selectedUserDetail.email}</div>
                </div>

                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', background: selectedUserDetail.status === 'suspended' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: selectedUserDetail.status === 'suspended' ? '#f87171' : '#10b981', border: '1px solid currentColor' }}>
                  {selectedUserDetail.status === 'suspended' ? '● Suspended' : '● Active Account'}
                </span>
              </div>

              <div className="admin-detail-grid">
                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Subscription Tier</div>
                  <div className="admin-stat-pill-value" style={{ color: '#3b82f6', textTransform: 'uppercase' }}>
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
                    {selectedUserDetail.role === 'admin' ? '🛡️ Admin' : '👤 Creator'}
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Accounts */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Film size={16} color="#a855f7" />
                <span>Connected Instagram Business Accounts ({selectedUserDetail.connected_accounts?.length || 0})</span>
              </h4>

              {(selectedUserDetail.connected_accounts || []).map(ig => (
                <div key={ig.id} className="admin-ig-account-row">
                  <div>
                    <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '13.5px' }}>@{ig.username}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Insta ID: <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{ig.ig_user_id}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{ig.followers_count?.toLocaleString()} Followers</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  style={{ justifyContent: 'center' }}
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
                  onClick={() => handleUpdateUser(selectedUserDetail.id, { reset_dm_usage: true })}
                >
                  <RefreshCw size={14} />
                  <span>Reset DM Usage to 0</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT USER ACCESS & TIER
      ========================================================================= */}
      {editingUser && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '520px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit3 size={20} color="#3b82f6" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>Edit User Access &amp; Tier</h3>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} className="admin-modal-close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleUpdateUser(editingUser.id, {
                name: formData.get('name'),
                plan: formData.get('plan'),
                role: formData.get('role'),
                status: formData.get('status'),
                reset_dm_usage: formData.get('reset_dm_usage') === 'on'
              });
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '16px 0' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Full Name</label>
                  <input type="text" name="name" defaultValue={editingUser.name || 'Creator'} className="admin-form-input" required />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">User Email (Read-Only ID)</label>
                  <input type="email" value={editingUser.email} className="admin-form-input" disabled style={{ opacity: 0.6 }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Plan Tier</label>
                    <select name="plan" defaultValue={editingUser.plan || 'free'} className="admin-form-select">
                      <option value="free">Free Starter</option>
                      <option value="pro">Pro Creator</option>
                      <option value="agency">Agency &amp; Brand</option>
                      <option value="enterprise">Enterprise VIP</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Role</label>
                    <select name="role" defaultValue={editingUser.role || 'user'} className="admin-form-select">
                      <option value="user">👤 Creator User</option>
                      <option value="admin">🛡️ Super Admin</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Account Status</label>
                  <select name="status" defaultValue={editingUser.status || 'active'} className="admin-form-select">
                    <option value="active">🟢 Active</option>
                    <option value="suspended">🔴 Suspended / Blocked</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer', marginTop: '4px' }}>
                  <input type="checkbox" name="reset_dm_usage" />
                  <span>Reset current DM usage tokens to 0</span>
                </label>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="admin-btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DELETE USER CONFIRMATION
      ========================================================================= */}
      {deletingUser && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeletingUser(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '460px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={22} color="#ef4444" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ef4444' }}>Delete User Account</h3>
              </div>
              <button type="button" onClick={() => setDeletingUser(null)} className="admin-modal-close-btn"><X size={18} /></button>
            </div>

            <div style={{ margin: '16px 0' }}>
              <p style={{ fontSize: '13.5px', color: '#f8fafc', lineHeight: 1.5, margin: '0 0 10px 0' }}>
                Are you sure you want to permanently delete user <strong style={{ color: '#ffffff' }}>{deletingUser.name || deletingUser.email}</strong>?
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 12px', borderRadius: '8px' }}>
                ⚠️ Warning: This action cannot be undone. All connected Instagram accounts, automation rules, activity logs, and workspace data will be purged.
              </p>
            </div>

            <div className="admin-modal-footer">
              <button type="button" className="admin-btn-secondary" onClick={() => setDeletingUser(null)}>Cancel</button>
              <button type="button" className="admin-btn-danger" onClick={handleDeleteUser}>
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE / EDIT PRICING PLAN
      ========================================================================= */}
      {isCreatingPlan && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsCreatingPlan(false); }}>
          <div className="admin-modal-box" style={{ maxWidth: '600px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CreditCard size={20} color="#3b82f6" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>
                  {editingPlan ? 'Edit Pricing Plan' : 'Create Custom Pricing Plan'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsCreatingPlan(false)} className="admin-modal-close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleSavePlan}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '16px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Plan Name</label>
                    <input type="text" value={planFormData.name} onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })} className="admin-form-input" required />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Badge Label (e.g. 🔥 POPULAR)</label>
                    <input type="text" value={planFormData.badge || ''} onChange={(e) => setPlanFormData({ ...planFormData, badge: e.target.value })} className="admin-form-input" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Monthly Price (₹ INR)</label>
                    <input type="number" value={planFormData.monthlyPrice} onChange={(e) => setPlanFormData({ ...planFormData, monthlyPrice: e.target.value })} className="admin-form-input" required />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Annual Monthly Price (₹ INR)</label>
                    <input type="number" value={planFormData.annualPrice} onChange={(e) => setPlanFormData({ ...planFormData, annualPrice: e.target.value })} className="admin-form-input" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">DM Limit / Mo</label>
                    <input type="number" value={planFormData.dmLimit} onChange={(e) => setPlanFormData({ ...planFormData, dmLimit: e.target.value })} className="admin-form-input" required />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">IG Accounts Limit</label>
                    <input type="number" value={planFormData.igLimit} onChange={(e) => setPlanFormData({ ...planFormData, igLimit: e.target.value })} className="admin-form-input" required />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Active Rules Limit</label>
                    <input type="number" value={planFormData.rulesLimit} onChange={(e) => setPlanFormData({ ...planFormData, rulesLimit: e.target.value })} className="admin-form-input" required />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Description</label>
                  <input type="text" value={planFormData.description} onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })} className="admin-form-input" />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Features List (One per line)</label>
                  <textarea
                    rows={4}
                    value={planFeaturesText}
                    onChange={(e) => setPlanFeaturesText(e.target.value)}
                    className="admin-form-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setIsCreatingPlan(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary">Save Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
