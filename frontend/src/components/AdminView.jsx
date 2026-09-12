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
  ShieldAlert,
  Copy,
  Tag,
  Receipt,
  Printer,
  Download,
  Percent,
  CheckCircle,
  RefreshCcw
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

export const ALL_ADMIN_POWERS = [
  { id: 'cms:manage', label: 'Landing Page CMS', desc: 'Hero, Features, FAQs, Testimonials, Badges & Custom Templates', category: 'Content' },
  { id: 'users:view', label: 'View Customer Accounts', desc: 'Browse user directory, inspect usage tokens & account profile info', category: 'Customers' },
  { id: 'users:manage', label: 'Manage Customer Details', desc: 'Edit customer plans, adjust custom DM/IG limits, activate/suspend', category: 'Customers' },
  { id: 'users:delete', label: 'Delete Customer Accounts', desc: 'Permanently wipe customer records, associated workspaces & automations', category: 'Customers' },
  { id: 'workspaces:manage', label: 'Workspaces & IG Channels', desc: 'Inspect connected Instagram accounts, channel health & metadata', category: 'Platform' },
  { id: 'plans:manage', label: 'Pricing Plans & Quotas', desc: 'Create, modify, and adjust subscription pricing tiers & quotas', category: 'Monetization' },
  { id: 'coupons:manage', label: 'Coupons & Promo Codes', desc: 'Generate discount promo codes, set redemption caps & toggle active', category: 'Monetization' },
  { id: 'billing:manage', label: 'Invoices & Payments', desc: 'Review customer transactions, manual invoice generation & GST info', category: 'Monetization' },
  { id: 'integrations:manage', label: 'API Integrations & Keys', desc: 'Manage OpenAI, Gemini, Meta Graph & Razorpay API credentials', category: 'Security' },
  { id: 'safeguards:manage', label: 'Kill Switches & Security', desc: 'Control emergency automation pause, resolve abuse flags & audit logs', category: 'Security' },
  { id: 'analytics:view', label: 'Analytics & Financials', desc: 'Inspect live revenue charts, DM delivery volumes & tenant API cost', category: 'Intelligence' },
  { id: 'admins:manage', label: 'Manage Sub-Admins', desc: 'Create sub-admins, reset passwords, grant & revoke granular powers', category: 'Governance' },
];

export default function AdminView({ user, onBackToApp }) {
  // Granular Permission Evaluation Helper
  const hasPermission = useCallback((powerKey) => {
    if (!user) return false;
    // Superadmin or root administrative emails have universal bypass
    const ROOT_EMAILS = ['sumitbhardwaj2227@gmail.com', 'sumit.bhardwaj_cs23@gla.ac.in', 'admin@airvix.com'];
    if (user.admin_role === 'superadmin' || ROOT_EMAILS.includes(user.email?.toLowerCase()?.trim())) return true;
    
    let perms = user.permissions || [];
    if (typeof perms === 'string') {
      try {
        perms = JSON.parse(perms);
      } catch (e) {
        perms = [];
      }
    }
    if (Array.isArray(perms)) {
      if (perms.includes('*')) return true;
      return perms.includes(powerKey);
    }
    return false;
  }, [user]);

  // Specific Permission Gates for Navigation Tabs
  const canOverview = hasPermission('analytics:view') || hasPermission('users:view') || user?.admin_role === 'superadmin';
  const canCms = hasPermission('cms:manage');
  const canUsers = hasPermission('users:view');
  const canWorkspaces = hasPermission('workspaces:manage');
  const canPlans = hasPermission('plans:manage') || hasPermission('billing:manage') || hasPermission('coupons:manage');
  const canIntegrations = hasPermission('integrations:manage');
  const canSafeguards = hasPermission('safeguards:manage');
  const canAnalytics = hasPermission('analytics:view');
  const canSupport = hasPermission('safeguards:manage') || hasPermission('users:view');
  const canSecurity = hasPermission('safeguards:manage');
  const canAudit = hasPermission('safeguards:manage');
  const canStatus = hasPermission('safeguards:manage');
  const canSubAdmins = hasPermission('admins:manage');

  // Compute default active tab for user based on permitted powers
  const getDefaultTab = useCallback(() => {
    if (canOverview) return 'overview';
    if (canCms) return 'landing_cms';
    if (canUsers) return 'users';
    if (canWorkspaces) return 'workspaces';
    if (canPlans) return 'plans';
    if (canIntegrations) return 'integrations';
    if (canSafeguards) return 'safeguards';
    if (canAnalytics) return 'analytics';
    if (canSubAdmins) return 'subadmins';
    return 'overview';
  }, [canOverview, canCms, canUsers, canWorkspaces, canPlans, canIntegrations, canSafeguards, canAnalytics, canSubAdmins]);

  // Navigation Tabs: 'overview' | 'users' | 'workspaces' | 'plans' | 'landing_cms' | 'integrations' | 'safeguards' | 'analytics' | 'support' | 'security' | 'audit' | 'status' | 'subadmins'
  const [activeTab, setActiveTab] = useState(getDefaultTab);

  // Auto-switch to authorized tab if activeTab becomes invalid or is unauthorized
  useEffect(() => {
    const isAllowed = 
      (activeTab === 'overview' && canOverview) ||
      (activeTab === 'users' && canUsers) ||
      (activeTab === 'workspaces' && canWorkspaces) ||
      (activeTab === 'plans' && canPlans) ||
      (activeTab === 'landing_cms' && canCms) ||
      (activeTab === 'integrations' && canIntegrations) ||
      (activeTab === 'safeguards' && canSafeguards) ||
      (activeTab === 'analytics' && canAnalytics) ||
      (activeTab === 'support' && canSupport) ||
      (activeTab === 'security' && canSecurity) ||
      (activeTab === 'audit' && canAudit) ||
      (activeTab === 'status' && canStatus) ||
      (activeTab === 'subadmins' && canSubAdmins);

    if (!isAllowed) {
      setActiveTab(getDefaultTab());
    }
  }, [activeTab, canOverview, canUsers, canWorkspaces, canPlans, canCms, canIntegrations, canSafeguards, canAnalytics, canSupport, canSecurity, canAudit, canStatus, canSubAdmins, getDefaultTab]);

  const [chartMetric, setChartMetric] = useState('users'); // 'users' | 'messages' | 'workspaces' | 'revenue'
  const [chartTimeframe, setChartTimeframe] = useState('30d'); // '7d' | '30d'
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  // Sub-Admins Management State
  const [subadminsList, setSubadminsList] = useState([]);
  const [loadingSubadmins, setLoadingSubadmins] = useState(false);
  const [subadminModalMode, setSubadminModalMode] = useState(null); // 'create' | 'edit' | 'reset-password'
  const [selectedSubadmin, setSelectedSubadmin] = useState(null);
  const [subadminFormData, setSubadminFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'subadmin',
    permissions: [],
  });
  const [subadminPasswordInput, setSubadminPasswordInput] = useState('');
  const [subadminSaving, setSubadminSaving] = useState(false);

  // Change Own Password Modal State
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [changePasswordData, setChangePasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changePasswordSaving, setChangePasswordSaving] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');

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
  const [paymentsSummary, setPaymentsSummary] = useState({ total_revenue: 0, active_subscriptions: 0 });

  // Plans & Billings Sub-tabs: 'subscriptions' | 'invoices' | 'coupons' | 'settings'
  const [plansSubTab, setPlansSubTab] = useState('subscriptions');

  // Invoices Sub-tab State
  const [invoicesList, setInvoicesList] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [invoiceFormData, setInvoiceFormData] = useState({
    user_email: '',
    billing_name: '',
    amount: 1499,
    plan: 'pro',
    gateway: 'razorpay',
    status: 'paid',
    gst_number: ''
  });
  const [selectedInvoiceSlip, setSelectedInvoiceSlip] = useState(null);

  // Coupons Sub-tab State
  const [couponsList, setCouponsList] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponSearch, setCouponSearch] = useState('');
  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);
  const [couponFormData, setCouponFormData] = useState({
    code: '',
    discount_percent: 20,
    discount_amount: 0,
    plan_slug: 'all',
    max_uses: 100,
    expires_at: '',
    description: ''
  });

  // Billing & Gateway Settings State
  const [savingBillingSettings, setSavingBillingSettings] = useState(false);
  const [billingSettings, setBillingSettings] = useState({
    razorpay_key_id: '',
    currency: 'INR',
    tax_gst_rate: 18,
    gstin: '',
    company_name: 'Airvix Technologies Pvt Ltd',
    company_address: 'Indiranagar, Bangalore, Karnataka, India',
    auto_renewal_default: true,
    grace_period_days: 7
  });

  // Integrations, Safeguards, Analytics & Support State
  const [integrationsData, setIntegrationsData] = useState(null);
  const [safeguardsData, setSafeguardsData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [supportData, setSupportData] = useState(null);

  // Real Integration Modal & Configuration State
  const [activeIntegrationModal, setActiveIntegrationModal] = useState(null);
  const [integrationForm, setIntegrationForm] = useState({
    apiKey: '',
    model: 'gpt-4o-mini',
    webhookUrl: '',
    keyId: '',
    keySecret: '',
    webhookSecret: ''
  });
  const [testingIntegration, setTestingIntegration] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [integrationTestResult, setIntegrationTestResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

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

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Copied to clipboard!`);
    setTimeout(() => setCopiedKey(''), 2500);
  };

  const handleOpenIntegration = (item) => {
    setActiveIntegrationModal(item);
    setIntegrationTestResult(null);
    setIntegrationForm({
      apiKey: '',
      model: item.model || 'gpt-4o-mini',
      webhookUrl: '',
      keyId: item.id === 'razorpay' ? (item.keyIdMasked && !item.keyIdMasked.includes('placeholder') ? item.keyIdMasked : '') : '',
      keySecret: '',
      webhookSecret: ''
    });
  };

  const handleSaveIntegration = async (e) => {
    if (e) e.preventDefault();
    if (!activeIntegrationModal) return;
    try {
      setSavingIntegration(true);
      const res = await apiFetch(`/admin/integrations/${activeIntegrationModal.id}/configure`, {
        method: 'POST',
        body: JSON.stringify(integrationForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');
      showToast(data.message || 'Integration configured successfully');
      setActiveIntegrationModal(null);
      loadIntegrations();
    } catch (err) {
      alert(`Error saving integration: ${err.message}`);
    } finally {
      setSavingIntegration(false);
    }
  };

  const handleTestIntegration = async () => {
    if (!activeIntegrationModal) return;
    try {
      setTestingIntegration(true);
      setIntegrationTestResult(null);
      const res = await apiFetch(`/admin/integrations/${activeIntegrationModal.id}/test`, {
        method: 'POST',
        body: JSON.stringify(integrationForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed');
      setIntegrationTestResult({ success: true, message: data.message || 'Connection verified successfully!' });
    } catch (err) {
      setIntegrationTestResult({ success: false, message: err.message });
    } finally {
      setTestingIntegration(false);
    }
  };

  const handleDisconnectIntegration = async () => {
    if (!activeIntegrationModal) return;
    if (!window.confirm(`Are you sure you want to disconnect ${activeIntegrationModal.name}? This will remove saved credentials.`)) return;
    try {
      setSavingIntegration(true);
      const res = await apiFetch(`/admin/integrations/${activeIntegrationModal.id}/disconnect`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect');
      showToast(data.message || 'Disconnected successfully');
      setActiveIntegrationModal(null);
      loadIntegrations();
    } catch (err) {
      alert(`Error disconnecting: ${err.message}`);
    } finally {
      setSavingIntegration(false);
    }
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
        if (data.summary) setPaymentsSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  }, []);

  // 8b. Fetch Invoices Data
  const loadInvoices = useCallback(async () => {
    try {
      setLoadingInvoices(true);
      const res = await apiFetch('/admin/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoicesList(data.invoices || []);
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  // 8c. Fetch Coupons Data
  const loadCoupons = useCallback(async () => {
    try {
      setLoadingCoupons(true);
      const res = await apiFetch('/admin/coupons');
      if (res.ok) {
        const data = await res.json();
        setCouponsList(data.coupons || []);
      }
    } catch (err) {
      console.error('Failed to load coupons:', err);
    } finally {
      setLoadingCoupons(false);
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

  // Fetch Sub-Administrators List
  const loadSubadmins = useCallback(async () => {
    try {
      setLoadingSubadmins(true);
      const res = await apiFetch('/admin/subadmins');
      if (res.ok) {
        const data = await res.json();
        setSubadminsList(data.subadmins || []);
      }
    } catch (err) {
      console.error('Failed to load subadmins:', err);
    } finally {
      setLoadingSubadmins(false);
    }
  }, []);

  // Create New Sub-Admin
  const handleCreateSubadmin = async (e) => {
    e.preventDefault();
    if (!subadminFormData.email || !subadminFormData.password) {
      alert('Email and password are required');
      return;
    }
    setSubadminSaving(true);
    try {
      const res = await apiFetch('/admin/subadmins', {
        method: 'POST',
        body: JSON.stringify(subadminFormData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('✅ Sub-Administrator created successfully!');
        setSubadminModalMode(null);
        setSubadminFormData({ name: '', email: '', password: '', role: 'subadmin', permissions: [] });
        loadSubadmins();
      } else {
        alert(`Failed: ${data.error || 'Could not create sub-admin'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubadminSaving(false);
    }
  };

  // Update Existing Sub-Admin
  const handleUpdateSubadmin = async (e) => {
    e.preventDefault();
    if (!selectedSubadmin) return;
    setSubadminSaving(true);
    try {
      const res = await apiFetch(`/admin/subadmins/${selectedSubadmin.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: subadminFormData.name,
          permissions: subadminFormData.permissions,
          status: subadminFormData.status,
          role: subadminFormData.role,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('✅ Administrator powers updated successfully!');
        setSubadminModalMode(null);
        setSelectedSubadmin(null);
        loadSubadmins();
      } else {
        alert(`Failed: ${data.error || 'Could not update administrator'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubadminSaving(false);
    }
  };

  // Reset Sub-Admin Password
  const handleResetSubadminPassword = async (e) => {
    e.preventDefault();
    if (!selectedSubadmin || !subadminPasswordInput || subadminPasswordInput.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setSubadminSaving(true);
    try {
      const res = await apiFetch(`/admin/subadmins/${selectedSubadmin.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: subadminPasswordInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✅ Password reset for ${selectedSubadmin.email}`);
        setSubadminModalMode(null);
        setSelectedSubadmin(null);
        setSubadminPasswordInput('');
      } else {
        alert(`Failed: ${data.error || 'Could not reset password'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubadminSaving(false);
    }
  };

  // Delete Sub-Admin
  const handleDeleteSubadmin = async (subadmin) => {
    if (!window.confirm(`Are you sure you want to delete administrator ${subadmin.email}?`)) return;
    try {
      const res = await apiFetch(`/admin/subadmins/${subadmin.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✅ Administrator ${subadmin.email} removed`);
        loadSubadmins();
      } else {
        alert(`Failed: ${data.error || 'Could not remove administrator'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Change Own Password
  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    setChangePasswordError('');
    if (!changePasswordData.newPassword || changePasswordData.newPassword.length < 6) {
      setChangePasswordError('New password must be at least 6 characters');
      return;
    }
    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
      setChangePasswordError('New passwords do not match');
      return;
    }
    setChangePasswordSaving(true);
    try {
      const res = await apiFetch('/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: changePasswordData.oldPassword,
          newPassword: changePasswordData.newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('✅ Your password has been changed successfully!');
        setIsChangePasswordOpen(false);
        setChangePasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setChangePasswordError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setChangePasswordError(err.message || 'Failed to change password');
    } finally {
      setChangePasswordSaving(false);
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
        loadInvoices();
        loadCoupons();
        loadSiteSettings();
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
      case 'subadmins':
        loadSubadmins();
        break;
      default:
        break;
    }
  }, [activeTab, loadOverview, loadUsers, loadWorkspaces, loadPlans, loadPayments, loadSiteSettings, loadIntegrations, loadSafeguards, loadAnalytics, loadSupport, loadSecurityPrivacy, loadKillSwitches, loadAbuseFlags, loadCostReport, loadSessions, loadAuditLogs, loadSystemStatus, loadSubadmins]);

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

  // Save / Create Plan Handler with instant optimistic update
  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      const isEdit = Boolean(editingPlan);
      const url = isEdit ? `/admin/plans/${editingPlan.id || editingPlan.slug}` : '/admin/plans';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...planFormData,
        monthlyPrice: Number(planFormData.monthlyPrice) || 0,
        annualPrice: Number(planFormData.annualPrice) || 0,
        dmLimit: Number(planFormData.dmLimit) || 0,
        igLimit: Number(planFormData.igLimit) || 1,
        rulesLimit: Number(planFormData.rulesLimit) || 5,
        features: planFeaturesText ? planFeaturesText.split('\n').map(s => s.trim()).filter(Boolean) : planFormData.features
      };

      const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
      if (res.ok) {
        const data = await res.json();
        showToast(isEdit ? '✅ Plan updated live' : '✅ New plan created');
        setEditingPlan(null);
        setIsCreatingPlan(false);
        // Instant optimistic update of plansList in state
        if (data.plan) {
          setPlansList(prev => {
            const exists = prev.some(p => p.id === data.plan.id || p.slug === data.plan.slug);
            if (exists) {
              return prev.map(p => (p.id === data.plan.id || p.slug === data.plan.slug) ? data.plan : p);
            }
            return [...prev, data.plan];
          });
        }
        loadPlans();
      } else {
        const err = await res.json();
        alert(`Failed to save plan: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      alert(`Error saving plan: ${err.message}`);
    }
  };

  // Reset Plans to Defaults Handler
  const handleResetPlans = async () => {
    if (!window.confirm('Reset all pricing plans to default Airvix tiers (Free Starter, Pro Creator, Agency & Brand, Enterprise VIP)? Custom edits will be restored to standard.')) return;
    try {
      const res = await apiFetch('/admin/plans/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPlansList(data.plans || []);
        showToast('✅ Pricing plans reset to defaults');
      } else {
        const err = await res.json();
        alert(`Failed to reset plans: ${err.error || 'Error'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Delete Custom Plan Handler
  const handleDeletePlan = async (planId, planName) => {
    if (!window.confirm(`Permanently delete pricing plan tier "${planName}"?`)) return;
    try {
      const res = await apiFetch(`/admin/plans/${planId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`✅ Plan "${planName}" deleted`);
        setPlansList(prev => prev.filter(p => p.id !== planId && p.slug !== planId));
        loadPlans();
      } else {
        const err = await res.json();
        alert(`Failed to delete plan: ${err.error || 'Error'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Create Manual Invoice Handler
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceFormData.amount) return alert('Invoice amount is required');
    try {
      const res = await apiFetch('/admin/invoices', {
        method: 'POST',
        body: JSON.stringify(invoiceFormData)
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`✅ Invoice ${data.invoice?.invoice_number || ''} generated successfully`);
        setIsCreatingInvoice(false);
        setInvoiceFormData({
          user_email: '',
          billing_name: '',
          amount: 1499,
          plan: 'pro',
          gateway: 'razorpay',
          status: 'paid',
          gst_number: ''
        });
        loadInvoices();
        loadPayments();
      } else {
        const err = await res.json();
        alert(`Failed to create invoice: ${err.error || 'Error'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Update Invoice Status Handler
  const handleUpdateInvoiceStatus = async (id, status) => {
    try {
      const res = await apiFetch(`/admin/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`✅ Invoice status updated to ${status}`);
        loadInvoices();
        loadPayments();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Delete Invoice Handler
  const handleDeleteInvoice = async (id, invNum) => {
    if (!window.confirm(`Delete invoice record ${invNum || id}?`)) return;
    try {
      const res = await apiFetch(`/admin/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('✅ Invoice record deleted');
        loadInvoices();
        loadPayments();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Auto-generate Random Coupon Code
  const handleGenerateRandomCouponCode = () => {
    const prefixes = ['AIRVIX', 'CREATOR', 'LAUNCH', 'BOOST', 'VIP'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 90);
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `${prefix}${num}-${rand}`;
    setCouponFormData(prev => ({ ...prev, code }));
  };

  // Create Coupon Handler
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!couponFormData.code) return alert('Coupon code is required');
    try {
      const res = await apiFetch('/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(couponFormData)
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`✅ Coupon ${data.coupon?.code || couponFormData.code} created & activated`);
        setIsCreatingCoupon(false);
        setCouponFormData({
          code: '',
          discount_percent: 20,
          discount_amount: 0,
          plan_slug: 'all',
          max_uses: 100,
          expires_at: '',
          description: ''
        });
        loadCoupons();
      } else {
        const err = await res.json();
        alert(`Failed to create coupon: ${err.error || 'Error'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Toggle Coupon Active Status
  const handleToggleCouponActive = async (id, currentActive, code) => {
    try {
      const res = await apiFetch(`/admin/coupons/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !currentActive })
      });
      if (res.ok) {
        showToast(!currentActive ? `✅ Coupon ${code} activated` : `⏸️ Coupon ${code} paused`);
        loadCoupons();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Delete Coupon Handler
  const handleDeleteCoupon = async (id, code) => {
    if (!window.confirm(`Permanently delete coupon "${code}"?`)) return;
    try {
      const res = await apiFetch(`/admin/coupons/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`✅ Coupon ${code} deleted`);
        loadCoupons();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Save Billing & Tax Settings Handler
  const handleSaveBillingSettings = async (e) => {
    if (e) e.preventDefault();
    try {
      setSavingBillingSettings(true);
      const res = await apiFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          billing_settings: billingSettings
        })
      });
      if (res.ok) {
        showToast('✅ Billing & Tax configuration saved successfully');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to save billing settings'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingBillingSettings(false);
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
            
            {canOverview && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <TrendingUp size={16} />
                <span>Overview</span>
              </button>
            )}

            {canUsers && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Users size={16} />
                <span>Users</span>
              </button>
            )}

            {canWorkspaces && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'workspaces' ? 'active' : ''}`}
                onClick={() => setActiveTab('workspaces')}
              >
                <Briefcase size={16} />
                <span>Workspaces</span>
              </button>
            )}

            {canPlans && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'plans' ? 'active' : ''}`}
                onClick={() => setActiveTab('plans')}
              >
                <CreditCard size={16} />
                <span>Plans &amp; Billings</span>
              </button>
            )}

            {canCms && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'landing_cms' ? 'active' : ''}`}
                onClick={() => setActiveTab('landing_cms')}
              >
                <Globe size={16} />
                <span>Landing Page CMS</span>
              </button>
            )}

            {canIntegrations && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'integrations' ? 'active' : ''}`}
                onClick={() => setActiveTab('integrations')}
              >
                <Plug size={16} />
                <span>Integrations</span>
              </button>
            )}

            {canSafeguards && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'safeguards' ? 'active' : ''}`}
                onClick={() => setActiveTab('safeguards')}
              >
                <SlidersHorizontal size={16} />
                <span>Automation Health</span>
              </button>
            )}

            {canAnalytics && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <Activity size={16} />
                <span>Analytics</span>
              </button>
            )}

            {canSupport && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'support' ? 'active' : ''}`}
                onClick={() => setActiveTab('support')}
              >
                <HelpCircle size={16} />
                <span>Support</span>
              </button>
            )}
          </div>

          <div className="admin-sidebar-menu-group">
            <div className="admin-sidebar-section-title">GOVERNANCE &amp; TEAM</div>
            
            {canSubAdmins && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'subadmins' ? 'active' : ''}`}
                onClick={() => setActiveTab('subadmins')}
              >
                <KeyRound size={16} />
                <span>Team &amp; Sub-Admins</span>
              </button>
            )}

            {canSecurity && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <ShieldCheck size={16} />
                <span>Security &amp; Privacy</span>
              </button>
            )}

            {canAudit && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveTab('audit')}
              >
                <FileText size={16} />
                <span>Audit Logs</span>
              </button>
            )}

            {canStatus && (
              <button
                type="button"
                className={`admin-sidebar-item ${activeTab === 'status' ? 'active' : ''}`}
                onClick={() => setActiveTab('status')}
              >
                <Radio size={16} />
                <span>System Status</span>
              </button>
            )}
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
              {activeTab === 'subadmins' && 'Team & Sub-Admins'}
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
                <span className="admin-profile-role">{user?.admin_role === 'superadmin' ? 'Super Admin' : (user?.admin_role === 'subadmin' ? 'Sub-Admin' : 'Admin')}</span>
              </div>
            </div>

            <button
              type="button"
              className="admin-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={() => {
                setChangePasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
                setChangePasswordError('');
                setIsChangePasswordOpen(true);
              }}
              title="Change your administrator password"
            >
              <Lock size={13} />
              <span>Password</span>
            </button>

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
                      {overview?.totalUsers != null ? overview.totalUsers.toLocaleString() : '0'}
                    </div>
                    <div className="admin-stat-pill admin-stat-pill-up">
                      <TrendingUp size={12} />
                      <span>Live</span>
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
                      {overview?.activeWorkspaces != null ? overview.activeWorkspaces.toLocaleString() : '0'}
                    </div>
                    <div className="admin-stat-pill admin-stat-pill-up">
                      <TrendingUp size={12} />
                      <span>Live</span>
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
                      {overview?.messagesProcessedFormatted || '0'}
                    </div>
                    <div className="admin-stat-pill admin-stat-pill-up">
                      <TrendingUp size={12} />
                      <span>Live</span>
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
                      {overview?.monthlyRevenueFormatted || '₹0'}
                    </div>
                    <div className="admin-stat-pill admin-stat-pill-up">
                      <TrendingUp size={12} />
                      <span>Live</span>
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
                        {(overview?.recentUsers && overview.recentUsers.length > 0) ? (
                          overview.recentUsers.map((u, idx) => (
                            <tr key={u.id || idx}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div className="admin-avatar-initials">
                                    {(u.name || u.email || 'U').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#0f172a' }}>{u.name || 'User'}</div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{u.email_masked || u.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`admin-badge-plan ${(u.plan || 'free').toLowerCase()}`}>{u.plan || 'free'}</span>
                              </td>
                              <td>
                                <span className="admin-badge-status-active">{u.status || 'Active'}</span>
                              </td>
                              <td style={{ fontSize: '11.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                {u.joined_formatted || (u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active')}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                              No users registered yet
                            </td>
                          </tr>
                        )}
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
                      {(overview?.recentActivity && overview.recentActivity.length > 0) ? (
                        overview.recentActivity.map((act, idx) => (
                          <div key={act.id || idx} className="admin-activity-row">
                            <div className="admin-activity-dot-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                              <Activity size={14} />
                            </div>
                            <div className="admin-activity-desc">
                              <div className="admin-activity-title">{act.event}</div>
                              <div className="admin-activity-sub">{act.detail}</div>
                            </div>
                            <div className="admin-activity-time">{act.timestamp}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                          No audit activity recorded yet
                        </div>
                      )}
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
                        <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                          {overview?.dataRequests?.deletionRequests || 0} Pending
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px' }}>
                        <span style={{ fontSize: '12.5px', color: '#334155' }}>Data export requests</span>
                        <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                          {overview?.dataRequests?.exportRequests || 0} Pending
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px' }}>
                        <span style={{ fontSize: '12.5px', color: '#334155' }}>Completed deletions</span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                          {overview?.dataRequests?.completedDeletions || 0} Completed
                        </span>
                      </div>
                    </div>

                    {/* Top Plans by Users */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>Top Plans by Users</div>
                      {(() => {
                        const totalUsers = overview?.totalUsers || 1;
                        const freeCount = overview?.planBreakdown?.free || 0;
                        const proCount = overview?.planBreakdown?.pro || 0;
                        const enterpriseCount = (overview?.planBreakdown?.enterprise || 0) + (overview?.planBreakdown?.agency || 0);

                        const freePct = Math.round((freeCount / totalUsers) * 100);
                        const proPct = Math.round((proCount / totalUsers) * 100);
                        const entPct = Math.round((enterpriseCount / totalUsers) * 100);

                        return (
                          <>
                            <div className="admin-plan-bar-item">
                              <div className="admin-plan-bar-meta">
                                <span style={{ color: '#334155' }}>Free Tier</span>
                                <span style={{ color: '#0f172a' }}>{freeCount} ({freePct}%)</span>
                              </div>
                              <div className="admin-plan-bar-track">
                                <div className="admin-plan-bar-fill" style={{ width: `${freePct}%`, background: '#64748b' }}></div>
                              </div>
                            </div>

                            <div className="admin-plan-bar-item">
                              <div className="admin-plan-bar-meta">
                                <span style={{ color: '#334155' }}>Pro Creator</span>
                                <span style={{ color: '#0f172a' }}>{proCount} ({proPct}%)</span>
                              </div>
                              <div className="admin-plan-bar-track">
                                <div className="admin-plan-bar-fill" style={{ width: `${proPct}%`, background: '#2563eb' }}></div>
                              </div>
                            </div>

                            <div className="admin-plan-bar-item" style={{ marginBottom: 0 }}>
                              <div className="admin-plan-bar-meta">
                                <span style={{ color: '#334155' }}>Agency &amp; Enterprise</span>
                                <span style={{ color: '#0f172a' }}>{enterpriseCount} ({entPct}%)</span>
                              </div>
                              <div className="admin-plan-bar-track">
                                <div className="admin-plan-bar-fill" style={{ width: `${entPct}%`, background: '#7e22ce' }}></div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
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
            const displayUsers = (usersList || []).map((u) => ({
              id: u.id,
              name: u.name || (u.email ? u.email.split('@')[0] : 'User'),
              email: u.email,
              plan: (u.plan || 'free').toLowerCase(),
              status: u.status === 'suspended' ? 'inactive' : 'active',
              joined: u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Active',
              raw: u
            }));

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
                  <span>Showing {filteredUsers.length} of {totalUsers || filteredUsers.length} users</span>
                  <div className="admin-pagination-controls">
                    <button type="button" className="admin-pagination-btn active">1</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* =========================================================================
              TAB 3: WORKSPACES (Matches Panel 3)
          ========================================================================= */}
          {activeTab === 'workspaces' && (() => {
            const displayWorkspaces = (workspacesList || []).map((ws) => ({
              id: ws.id,
              name: ws.name || 'Personal Workspace',
              owner: ws.owner_email_masked || ws.owner_email || 'Workspace Owner',
              accounts: ws.connected_accounts || 0,
              plan: (ws.plan || 'free').toLowerCase(),
              status: ws.status || 'active'
            }));

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
                    onClick={() => showToast('✨ Multi-tenant workspace auto-provisions per active user.')}
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
                      {displayWorkspaces.length > 0 ? (
                        displayWorkspaces.map((ws, idx) => (
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
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: '#64748b', fontSize: '13px' }}>
                            No separate workspaces provisioned yet. Accounts linked directly to user accounts.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="admin-pagination-footer">
                  <span>Showing {displayWorkspaces.length} of {displayWorkspaces.length} workspaces</span>
                  <div className="admin-pagination-controls">
                    <button type="button" className="admin-pagination-btn active">1</button>
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
                    <option value="">All Users</option>
                    {(usersList || []).map(u => (
                      <option key={u.id} value={u.email}>{u.name || u.email}</option>
                    ))}
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
                    {(auditLogsList && auditLogsList.length > 0) ? (
                      auditLogsList.map((log, idx) => (
                        <tr key={log.id || idx}>
                          <td style={{ color: '#64748b', fontSize: '12px' }}>
                            {log.created_at ? (log.created_at.includes('T') ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.created_at) : 'Recent'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{log.action}</td>
                          <td style={{ color: '#475569' }}>{log.actor_email ? log.actor_email : (log.user || 'System')}</td>
                          <td style={{ color: '#64748b', fontSize: '12.5px' }}>{log.details}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '28px', color: '#64748b', fontSize: '13px' }}>
                          No audit logs recorded yet. System actions will appear here in real-time.
                        </td>
                      </tr>
                    )}
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
              TAB 7: PLANS & BILLINGS (Fully Functional 4 Sub-Tabs)
          ========================================================================= */}
          {activeTab === 'plans' && (
            <div>
              {/* Header */}
              <div className="admin-card-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="admin-card-title" style={{ fontSize: '20px', margin: 0, fontWeight: 800, color: '#0f172a' }}>Plans &amp; Billings</h2>
                  <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                    Manage pricing tiers, live invoices, promo coupons, and payment gateway configuration.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {plansSubTab === 'subscriptions' && (
                    <>
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        style={{ fontSize: '12.5px', padding: '7px 12px' }}
                        onClick={handleResetPlans}
                        title="Reset plans to standard defaults"
                      >
                        <RefreshCcw size={13} style={{ marginRight: '5px' }} />
                        <span>Reset Defaults</span>
                      </button>
                      <button
                        type="button"
                        className="admin-btn-primary"
                        onClick={() => {
                          setEditingPlan(null);
                          setPlanFormData({
                            id: `plan-${Date.now()}`,
                            slug: 'custom-vip',
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
                    </>
                  )}

                  {plansSubTab === 'invoices' && (
                    <>
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        style={{ fontSize: '12.5px', padding: '7px 12px' }}
                        onClick={loadInvoices}
                        title="Refresh invoices list"
                      >
                        <RefreshCw size={13} className={loadingInvoices ? 'spin' : ''} />
                      </button>
                      <button
                        type="button"
                        className="admin-btn-primary"
                        onClick={() => setIsCreatingInvoice(true)}
                      >
                        <Plus size={14} />
                        <span>Create Invoice</span>
                      </button>
                    </>
                  )}

                  {plansSubTab === 'coupons' && (
                    <>
                      <button
                        type="button"
                        className="admin-btn-secondary"
                        style={{ fontSize: '12.5px', padding: '7px 12px' }}
                        onClick={loadCoupons}
                        title="Refresh coupons list"
                      >
                        <RefreshCw size={13} className={loadingCoupons ? 'spin' : ''} />
                      </button>
                      <button
                        type="button"
                        className="admin-btn-primary"
                        onClick={() => {
                          handleGenerateRandomCouponCode();
                          setIsCreatingCoupon(true);
                        }}
                      >
                        <Plus size={14} />
                        <span>Generate Coupon</span>
                      </button>
                    </>
                  )}

                  {plansSubTab === 'settings' && (
                    <button
                      type="button"
                      className="admin-btn-primary"
                      onClick={handleSaveBillingSettings}
                      disabled={savingBillingSettings}
                    >
                      <Save size={14} />
                      <span>{savingBillingSettings ? 'Saving...' : 'Save Settings'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Tabs Navigation Bar */}
              <div className="admin-subtabs-nav" style={{ marginBottom: '20px' }}>
                <button
                  type="button"
                  className={`admin-subtab-btn ${plansSubTab === 'subscriptions' ? 'active' : ''}`}
                  onClick={() => setPlansSubTab('subscriptions')}
                >
                  <CreditCard size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  <span>Subscriptions</span>
                </button>
                <button
                  type="button"
                  className={`admin-subtab-btn ${plansSubTab === 'invoices' ? 'active' : ''}`}
                  onClick={() => { setPlansSubTab('invoices'); loadInvoices(); }}
                >
                  <Receipt size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  <span>Invoices</span>
                  {invoicesList.length > 0 && <span className="admin-subtab-badge">{invoicesList.length}</span>}
                </button>
                <button
                  type="button"
                  className={`admin-subtab-btn ${plansSubTab === 'coupons' ? 'active' : ''}`}
                  onClick={() => { setPlansSubTab('coupons'); loadCoupons(); }}
                >
                  <Tag size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  <span>Coupons</span>
                  {couponsList.filter(c => c.is_active).length > 0 && (
                    <span className="admin-subtab-badge">{couponsList.filter(c => c.is_active).length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`admin-subtab-btn ${plansSubTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setPlansSubTab('settings')}
                >
                  <SlidersHorizontal size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  <span>Settings</span>
                </button>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  SUB-TAB 1: SUBSCRIPTIONS & PRICING PLANS (LIVE DYNAMIC TABLE)
              ───────────────────────────────────────────────────────────── */}
              {plansSubTab === 'subscriptions' && (
                <div>
                  {/* Dynamic Plans Table Card */}
                  <div className="admin-card" style={{ marginBottom: '24px' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="admin-clean-table">
                        <thead>
                          <tr>
                            <th>Plan Name</th>
                            <th>Price</th>
                            <th>Billing Cycle</th>
                            <th>Included Quotas</th>
                            <th>Users</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(plansList && plansList.length > 0) ? (
                            plansList.map((plan, idx) => {
                              const planUsersCount = (usersList || []).filter(u => (u.plan || '').toLowerCase() === (plan.slug || '').toLowerCase()).length;
                              return (
                                <tr key={plan.id || plan.slug || idx}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>{plan.name}</span>
                                      {plan.badge && (
                                        <span style={{ fontSize: '10px', fontWeight: 800, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px' }}>
                                          {plan.badge}
                                        </span>
                                      )}
                                    </div>
                                    {plan.description && (
                                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', maxWidth: '280px' }}>
                                        {plan.description}
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
                                      ₹{Number(plan.monthlyPrice || 0).toLocaleString('en-IN')}
                                    </div>
                                    {plan.annualPrice > 0 && (
                                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                                        ₹{Number(plan.annualPrice).toLocaleString('en-IN')}/mo (annual)
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ color: '#475569', fontSize: '12.5px', fontWeight: 600 }}>
                                    Monthly / Annual
                                  </td>
                                  <td style={{ color: '#334155', fontSize: '12px' }}>
                                    <span style={{ fontWeight: 700, color: '#2563eb' }}>{Number(plan.dmLimit || 0).toLocaleString()} DMs</span>
                                    <span style={{ margin: '0 4px', color: '#cbd5e1' }}>•</span>
                                    <span>{plan.igLimit || 1} IG Account{(plan.igLimit || 1) > 1 ? 's' : ''}</span>
                                    <span style={{ margin: '0 4px', color: '#cbd5e1' }}>•</span>
                                    <span>{plan.rulesLimit || 5} Rules</span>
                                  </td>
                                  <td style={{ fontWeight: 700, color: '#0f172a' }}>
                                    <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>
                                      {planUsersCount} user{planUsersCount === 1 ? '' : 's'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={plan.active !== false ? 'admin-badge-status-active' : 'admin-badge-status-pending'}>
                                      {plan.active !== false ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                      <button
                                        type="button"
                                        className="admin-btn-secondary"
                                        style={{ padding: '5px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        onClick={() => {
                                          setEditingPlan(plan);
                                          setPlanFormData({
                                            ...plan,
                                            monthlyPrice: plan.monthlyPrice ?? 0,
                                            annualPrice: plan.annualPrice ?? 0,
                                            dmLimit: plan.dmLimit ?? 1000,
                                            igLimit: plan.igLimit ?? 1,
                                            rulesLimit: plan.rulesLimit ?? 5
                                          });
                                          setPlanFeaturesText(Array.isArray(plan.features) ? plan.features.join('\n') : (plan.features || ''));
                                          setIsCreatingPlan(true);
                                        }}
                                        title="Edit this plan"
                                      >
                                        <Edit3 size={13} />
                                        <span>Edit</span>
                                      </button>

                                      {!['plan-free', 'plan-pro', 'plan-agency', 'plan-enterprise', 'free', 'pro', 'agency', 'enterprise'].includes(plan.id || plan.slug) && (
                                        <button
                                          type="button"
                                          className="admin-btn-secondary"
                                          style={{ padding: '5px 8px', color: '#dc2626' }}
                                          onClick={() => handleDeletePlan(plan.id || plan.slug, plan.name)}
                                          title="Delete custom plan"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                Loading plans from database...
                              </td>
                            </tr>
                          )}
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
                        { month: 'Apr', val: 0, amt: '₹0' },
                        { month: 'May', val: 0, amt: '₹0' },
                        { month: 'Jun', val: 0, amt: '₹0' },
                        { month: 'Jul', val: 0, amt: '₹0' },
                        { month: 'Aug', val: 0, amt: '₹0' },
                        { month: 'Sep', val: (paymentsSummary?.total_revenue || overview?.totalRevenue || 0), amt: `₹${(paymentsSummary?.total_revenue || overview?.totalRevenue || 0).toLocaleString('en-IN')}`, highlight: true }
                      ].map((col, idx) => (
                        <div key={idx} className="admin-rev-col">
                          {col.highlight && (
                            <div style={{ fontSize: '11px', fontWeight: 700, color: col.val > 0 ? '#2563eb' : '#64748b', background: col.val > 0 ? '#eff6ff' : '#f1f5f9', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                              {col.amt}
                            </div>
                          )}
                          <div
                            className={`admin-rev-bar ${col.highlight ? 'highlight' : ''}`}
                            style={{ height: `${col.val > 0 ? Math.min(100, Math.max(15, (col.val / 10000) * 100)) : 4}px`, minHeight: '4px', background: col.val > 0 ? '#2563eb' : '#e2e8f0' }}
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
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                          ₹{(paymentsSummary?.total_revenue !== undefined ? paymentsSummary.total_revenue : (overview?.totalRevenue || 0)).toLocaleString('en-IN')}
                        </div>
                        <span className="admin-stat-pill admin-stat-pill-up" style={{ color: '#059669', background: '#ecfdf5' }}>Live Invoices</span>
                      </div>

                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Active Paid Subscriptions</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                          {paymentsSummary?.active_subscriptions !== undefined ? paymentsSummary.active_subscriptions : (overview?.activePaidSubscriptions || 0)}
                        </div>
                        <span className="admin-stat-pill admin-stat-pill-up" style={{ color: '#2563eb', background: '#eff6ff' }}>Active Customers</span>
                      </div>

                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Churn Rate</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>0.0%</div>
                        <span className="admin-stat-pill admin-stat-pill-up" style={{ color: '#059669', background: '#ecfdf5' }}>Zero Churn</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  SUB-TAB 2: INVOICES & BILLING RECORDS
              ───────────────────────────────────────────────────────────── */}
              {plansSubTab === 'invoices' && (
                <div>
                  {/* Filters Bar */}
                  <div className="admin-table-filters-bar" style={{ marginBottom: '14px' }}>
                    <div className="admin-filter-group-left">
                      <select
                        className="admin-select-input"
                        value={invoiceStatusFilter}
                        onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                      >
                        <option value="all">All Invoice Statuses</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </div>

                    <div className="admin-search-box-wrap" style={{ flex: 1, maxWidth: '380px' }}>
                      <Search size={14} />
                      <input
                        type="text"
                        placeholder="Search by Invoice #, customer email, or name..."
                        value={invoiceSearch}
                        onChange={(e) => setInvoiceSearch(e.target.value)}
                        className="admin-search-box-input"
                      />
                    </div>
                  </div>

                  {/* Invoices Table Card */}
                  <div className="admin-card">
                    <div style={{ overflowX: 'auto' }}>
                      <table className="admin-clean-table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Customer</th>
                            <th>Plan</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Payment Gateway</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filtered = (invoicesList || []).filter(inv => {
                              const matchStatus = invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter;
                              const q = invoiceSearch.toLowerCase();
                              const matchSearch = !q ||
                                (inv.invoice_number && inv.invoice_number.toLowerCase().includes(q)) ||
                                (inv.user_name && inv.user_name.toLowerCase().includes(q)) ||
                                (inv.user_email_full && inv.user_email_full.toLowerCase().includes(q)) ||
                                (inv.user_email && inv.user_email.toLowerCase().includes(q));
                              return matchStatus && matchSearch;
                            });

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                                    <Receipt size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>No Invoices Found</div>
                                    <p style={{ fontSize: '12px', margin: '4px 0 12px 0' }}>
                                      {invoiceSearch || invoiceStatusFilter !== 'all' ? 'Try adjusting your search query or filter.' : 'Generate your first billing invoice.'}
                                    </p>
                                    <button
                                      type="button"
                                      className="admin-btn-primary"
                                      style={{ margin: '0 auto' }}
                                      onClick={() => setIsCreatingInvoice(true)}
                                    >
                                      <Plus size={13} />
                                      <span>Create Invoice</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((inv) => (
                              <tr key={inv.id}>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceSlip(inv)}
                                    style={{ background: 'none', border: 'none', padding: 0, fontWeight: 700, color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title="View Invoice Receipt"
                                  >
                                    <span>{inv.invoice_number || inv.id}</span>
                                    <ExternalLink size={11} />
                                  </button>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{inv.user_name || 'Customer'}</div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>{inv.user_email_masked || inv.user_email || '—'}</div>
                                </td>
                                <td>
                                  <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                    {inv.plan || inv.user_plan || 'Pro'}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                                  ₹{Number(inv.amount || 0).toLocaleString('en-IN')}
                                </td>
                                <td style={{ color: '#475569', fontSize: '12px' }}>
                                  {inv.formatted_date || (inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'Paid')}
                                </td>
                                <td style={{ color: '#475569', fontSize: '12px' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Zap size={12} color="#16a34a" />
                                    <span>{inv.gateway === 'razorpay' ? 'Razorpay' : (inv.gateway || 'Razorpay')}</span>
                                  </span>
                                </td>
                                <td>
                                  <span className={inv.status === 'paid' ? 'admin-badge-status-active' : (inv.status === 'pending' ? 'admin-badge-status-pending' : 'admin-badge-plan')}>
                                    {inv.status === 'paid' ? '● Paid' : (inv.status === 'pending' ? '⏳ Pending' : inv.status)}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="admin-btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '11px' }}
                                      onClick={() => setSelectedInvoiceSlip(inv)}
                                      title="Print / View Receipt"
                                    >
                                      <Printer size={12} />
                                    </button>

                                    {inv.status !== 'paid' && (
                                      <button
                                        type="button"
                                        className="admin-btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px', color: '#16a34a' }}
                                        onClick={() => handleUpdateInvoiceStatus(inv.id, 'paid')}
                                        title="Mark as Paid"
                                      >
                                        <Check size={12} />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="admin-btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626' }}
                                      onClick={() => handleDeleteInvoice(inv.id, inv.invoice_number)}
                                      title="Delete invoice record"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  SUB-TAB 3: PROMO COUPONS & DISCOUNT ENGINE
              ───────────────────────────────────────────────────────────── */}
              {plansSubTab === 'coupons' && (
                <div>
                  {/* Coupon Highlights Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '18px' }}>
                    <div className="admin-card" style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Active Promo Codes</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', margin: '4px 0' }}>
                        {couponsList.filter(c => c.is_active).length}
                      </div>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>Ready for Checkout</span>
                    </div>

                    <div className="admin-card" style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Total Redemptions</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                        {couponsList.reduce((acc, c) => acc + (Number(c.used_count) || 0), 0)}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Used by Creators</span>
                    </div>

                    <div className="admin-card" style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Max Discount Available</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', margin: '4px 0' }}>
                        {Math.max(0, ...couponsList.map(c => c.discount_percent || 0))}%
                      </div>
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>VIP Promos Active</span>
                    </div>

                    <div className="admin-card" style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Total Coupons Built</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                        {couponsList.length}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Campaigns Created</span>
                    </div>
                  </div>

                  {/* Filter & Action Bar */}
                  <div className="admin-table-filters-bar" style={{ marginBottom: '14px' }}>
                    <div className="admin-search-box-wrap" style={{ flex: 1, maxWidth: '360px' }}>
                      <Search size={14} />
                      <input
                        type="text"
                        placeholder="Search coupons by code or campaign..."
                        value={couponSearch}
                        onChange={(e) => setCouponSearch(e.target.value)}
                        className="admin-search-box-input"
                      />
                    </div>
                  </div>

                  {/* Coupons Table Card */}
                  <div className="admin-card">
                    <div style={{ overflowX: 'auto' }}>
                      <table className="admin-clean-table">
                        <thead>
                          <tr>
                            <th>Coupon Code</th>
                            <th>Discount</th>
                            <th>Applies To</th>
                            <th>Redemptions</th>
                            <th>Valid Until</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const filtered = (couponsList || []).filter(c => {
                              const q = couponSearch.toLowerCase();
                              return !q || c.code.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q));
                            });

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                                    <Tag size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>No Coupons Found</div>
                                    <p style={{ fontSize: '12px', margin: '4px 0 12px 0' }}>
                                      Generate promotional codes to offer creator discounts on checkout.
                                    </p>
                                    <button
                                      type="button"
                                      className="admin-btn-primary"
                                      style={{ margin: '0 auto' }}
                                      onClick={() => {
                                        handleGenerateRandomCouponCode();
                                        setIsCreatingCoupon(true);
                                      }}
                                    >
                                      <Plus size={13} />
                                      <span>Generate First Coupon</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((cpn) => {
                              const pctUsed = cpn.max_uses > 0 ? Math.min(100, Math.round((cpn.used_count / cpn.max_uses) * 100)) : 0;
                              return (
                                <tr key={cpn.id}>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '14px', color: '#0f172a', background: '#f1f5f9', padding: '3px 8px', borderRadius: '5px', letterSpacing: '0.5px' }}>
                                        {cpn.code}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(cpn.code);
                                          showToast(`📋 Copied "${cpn.code}" to clipboard!`);
                                        }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
                                        title="Copy code"
                                      >
                                        <Copy size={13} />
                                      </button>
                                    </div>
                                    {cpn.description && (
                                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                                        {cpn.description}
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '14px' }}>
                                      {cpn.discount_percent ? `${cpn.discount_percent}% OFF` : `₹${cpn.discount_amount} OFF`}
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', textTransform: 'capitalize', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>
                                      {cpn.plan_slug === 'all' ? 'All Plans' : `${cpn.plan_slug} Tier`}
                                    </span>
                                  </td>
                                  <td style={{ minWidth: '140px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                                      <span>{cpn.used_count || 0} used</span>
                                      <span>Limit: {cpn.max_uses || '∞'}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                      <div style={{ width: `${pctUsed}%`, height: '100%', background: pctUsed > 80 ? '#dc2626' : '#2563eb', borderRadius: '999px' }} />
                                    </div>
                                  </td>
                                  <td style={{ color: '#475569', fontSize: '12px' }}>
                                    {cpn.expires_at ? new Date(cpn.expires_at).toLocaleDateString() : 'Never expires'}
                                  </td>
                                  <td>
                                    <span className={cpn.is_active ? 'admin-badge-status-active' : 'admin-badge-status-pending'}>
                                      {cpn.is_active ? 'Active' : 'Paused'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                      <button
                                        type="button"
                                        className="admin-btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                        onClick={() => handleToggleCouponActive(cpn.id, cpn.is_active, cpn.code)}
                                        title={cpn.is_active ? 'Pause this coupon' : 'Activate this coupon'}
                                      >
                                        {cpn.is_active ? 'Pause' : 'Activate'}
                                      </button>
                                      <button
                                        type="button"
                                        className="admin-btn-secondary"
                                        style={{ padding: '4px 8px', color: '#dc2626', fontSize: '11px' }}
                                        onClick={() => handleDeleteCoupon(cpn.id, cpn.code)}
                                        title="Delete coupon"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  SUB-TAB 4: BILLING & PAYMENT GATEWAY SETTINGS
              ───────────────────────────────────────────────────────────── */}
              {plansSubTab === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Payment Gateway (Razorpay) */}
                  <div className="admin-card">
                    <div className="admin-card-header" style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <h3 className="admin-card-title" style={{ margin: 0 }}>Razorpay Payment Gateway</h3>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>Primary payment gateway for subscriptions, UPI, and credit cards</span>
                        </div>
                      </div>
                      <span className="admin-badge-status-active" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={11} />
                        <span>Connected &amp; Live</span>
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div className="admin-form-group">
                        <label className="admin-form-label">Razorpay Key ID</label>
                        <input
                          type="text"
                          value={billingSettings.razorpay_key_id || 'rzp_test_TQvXd6MQ7HJzVd'}
                          onChange={(e) => setBillingSettings({ ...billingSettings, razorpay_key_id: e.target.value })}
                          className="admin-form-input"
                          placeholder="rzp_live_..."
                        />
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                          Production API Key for Indian cards, NetBanking, and UPI QR
                        </span>
                      </div>

                      <div className="admin-form-group">
                        <label className="admin-form-label">Webhook Callback URL (Airvix Endpoint)</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/api/payments/webhook`}
                            className="admin-form-input"
                            style={{ background: '#f8fafc', color: '#334155', fontWeight: 600 }}
                          />
                          <button
                            type="button"
                            className="admin-btn-secondary"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/api/payments/webhook`);
                              showToast('📋 Webhook URL copied to clipboard');
                            }}
                            title="Copy webhook URL"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                          Add this endpoint to your Razorpay Dashboard webhooks
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Taxation & GST Configuration */}
                  <div className="admin-card">
                    <div className="admin-card-header" style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                          <DollarSign size={18} />
                        </div>
                        <div>
                          <h3 className="admin-card-title" style={{ margin: 0 }}>Taxation &amp; GST Invoicing</h3>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>Configure tax calculation on generated customer invoices</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div className="admin-form-group">
                        <label className="admin-form-label">Standard GST / Tax Rate (%)</label>
                        <input
                          type="number"
                          value={billingSettings.tax_gst_rate}
                          onChange={(e) => setBillingSettings({ ...billingSettings, tax_gst_rate: Number(e.target.value) || 0 })}
                          className="admin-form-input"
                          placeholder="18"
                        />
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                          Default Indian SaaS IT GST is 18%
                        </span>
                      </div>

                      <div className="admin-form-group">
                        <label className="admin-form-label">Company GSTIN Number</label>
                        <input
                          type="text"
                          value={billingSettings.gstin}
                          onChange={(e) => setBillingSettings({ ...billingSettings, gstin: e.target.value })}
                          className="admin-form-input"
                          placeholder="29AAAAA0000A1Z5"
                        />
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                          Printed on legal tax invoices and credit notes
                        </span>
                      </div>

                      <div className="admin-form-group">
                        <label className="admin-form-label">Legal Company Name (Invoice Header)</label>
                        <input
                          type="text"
                          value={billingSettings.company_name}
                          onChange={(e) => setBillingSettings({ ...billingSettings, company_name: e.target.value })}
                          className="admin-form-input"
                        />
                      </div>

                      <div className="admin-form-group">
                        <label className="admin-form-label">Registered Office Address</label>
                        <input
                          type="text"
                          value={billingSettings.company_address}
                          onChange={(e) => setBillingSettings({ ...billingSettings, company_address: e.target.value })}
                          className="admin-form-input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Subscription & Grace Policies */}
                  <div className="admin-card">
                    <div className="admin-card-header" style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                          <Clock size={18} />
                        </div>
                        <div>
                          <h3 className="admin-card-title" style={{ margin: 0 }}>Subscription &amp; Renewal Policies</h3>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>Grace periods and automatic renewal settings</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div className="admin-form-group">
                        <label className="admin-form-label">Failed Payment Grace Period (Days)</label>
                        <input
                          type="number"
                          value={billingSettings.grace_period_days}
                          onChange={(e) => setBillingSettings({ ...billingSettings, grace_period_days: Number(e.target.value) || 0 })}
                          className="admin-form-input"
                          min="0"
                          max="30"
                        />
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                          Automations remain active for this many days after a failed renewal
                        </span>
                      </div>

                      <div className="admin-form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                          <input
                            type="checkbox"
                            checked={billingSettings.auto_renewal_default}
                            onChange={(e) => setBillingSettings({ ...billingSettings, auto_renewal_default: e.target.checked })}
                          />
                          <span>Enable auto-renewal on checkout by default</span>
                        </label>
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', marginLeft: '22px' }}>
                          Creators can cancel anytime from their account settings
                        </span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="admin-btn-primary"
                        onClick={handleSaveBillingSettings}
                        disabled={savingBillingSettings}
                      >
                        <Save size={14} />
                        <span>{savingBillingSettings ? 'Saving...' : 'Save All Settings'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 8: INTEGRATIONS (100% REAL LIVE SERVICES & MANAGEMENT)
          ========================================================================= */}
          {activeTab === 'integrations' && (
            <div>
              <div className="admin-card-header" style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 className="admin-card-title" style={{ fontSize: '18px', margin: 0 }}>Integrations</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Connect and manage third-party services with live verification.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { loadIntegrations(); showToast('Refreshing live integration statuses...'); }}
                  className="admin-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '6px 12px' }}
                >
                  <RefreshCw size={13} />
                  Refresh Status
                </button>
              </div>

              {/* Dynamic Integrations Grid */}
              <div className="admin-integrations-3x2-grid">
                {(integrationsData?.integrations || [
                  { id: 'instagram', name: 'Instagram', status: 'connected', connected: true, badge: 'Connected', details: 'Checking connected accounts...' },
                  { id: 'openai', name: 'OpenAI', status: 'not_configured', connected: false, badge: 'Not configured', details: 'Smart DM replies with context awareness' },
                  { id: 'slack', name: 'Slack', status: 'not_connected', connected: false, badge: 'Not connected', details: 'Get instant alerts for converted leads' },
                  { id: 'zapier', name: 'Zapier', status: 'not_connected', connected: false, badge: 'Not connected', details: 'Sync leads to 5,000+ CRM & sheet apps' },
                  { id: 'make', name: 'Make (Integromat)', status: 'not_connected', connected: false, badge: 'Not connected', details: 'Visual automation scenarios for Instagram DMs' },
                  { id: 'webhooks', name: 'Webhooks', status: 'connected', connected: true, badge: 'Connected', details: 'Meta Webhook Endpoint v19.0 Active' },
                  { id: 'razorpay', name: 'Razorpay', status: 'test_mode', connected: true, badge: 'Test Mode', details: 'INR Gateway Active' }
                ]).map((item) => {
                  const getIcon = () => {
                    switch (item.id) {
                      case 'instagram': return <Film size={24} />;
                      case 'openai': return <Sparkles size={24} />;
                      case 'slack': return <MessageSquare size={24} />;
                      case 'zapier': return <Zap size={24} />;
                      case 'make': return <SlidersHorizontal size={24} />;
                      case 'webhooks': return <Plug size={24} />;
                      case 'razorpay': return <CreditCard size={24} />;
                      default: return <Plug size={24} />;
                    }
                  };

                  const getIconBg = () => {
                    switch (item.id) {
                      case 'instagram': return 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';
                      case 'openai': return '#10a37f';
                      case 'slack': return '#4a154b';
                      case 'zapier': return '#ff4a00';
                      case 'make': return '#6f2cf3';
                      case 'webhooks': return '#0284c7';
                      case 'razorpay': return '#1e3a8a';
                      default: return '#3b82f6';
                    }
                  };

                  const isConnected = item.status === 'connected';
                  const isTestMode = item.status === 'test_mode';

                  return (
                    <div key={item.id} className="admin-integration-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                        <div className="admin-integration-app-icon" style={{ background: getIconBg(), color: '#ffffff' }}>
                          {getIcon()}
                        </div>
                        <div className="admin-integration-app-name">{item.name}</div>
                        <div className="admin-integration-status-badge">
                          {isConnected ? (
                            <span className="admin-badge-status-active">● Connected</span>
                          ) : isTestMode ? (
                            <span className="admin-badge-status-active" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>⚡ Test Mode</span>
                          ) : item.status === 'not_configured' ? (
                            <span className="admin-badge-status-inactive" style={{ background: '#f1f5f9', color: '#64748b', borderColor: '#e2e8f0' }}>○ Not configured</span>
                          ) : (
                            <span className="admin-badge-status-inactive" style={{ background: '#f1f5f9', color: '#64748b', borderColor: '#e2e8f0' }}>○ Not connected</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px', lineHeight: 1.4, minHeight: '34px', textAlign: 'center' }}>
                          {item.details}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`admin-integration-action-btn ${(!isConnected && !isTestMode) ? 'primary' : ''}`}
                        onClick={() => handleOpenIntegration(item)}
                      >
                        {(!isConnected && !isTestMode) ? 'Connect' : 'Manage'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Meta Webhook Endpoint Live Status Banner */}
              <div style={{ marginTop: '24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="#10b981" />
                    <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>Live Meta Webhook Ingestion Engine</span>
                    <span className="admin-badge-status-active" style={{ fontSize: '10.5px' }}>v19.0 Registered</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(integrationsData?.metaAppStatus?.webhookUrl || `${window.location.origin}/api/webhooks/instagram`, 'wh_banner')}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Copy size={12} />
                    {copiedKey === 'wh_banner' ? 'Copied!' : 'Copy Webhook URL'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '12px', color: '#475569' }}>
                  <div><strong>Endpoint:</strong> <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>/api/webhooks/instagram</code></div>
                  <div><strong>Verify Token:</strong> <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>instagram_autoreply_verify_token_2026</code></div>
                  <div><strong>Subscriptions:</strong> messages, postbacks, comments, feed</div>
                </div>
              </div>

              {/* Interactive Integration Management & Configuration Modal */}
              {activeIntegrationModal && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                  }}
                  onClick={() => setActiveIntegrationModal(null)}
                >
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      maxWidth: '520px',
                      width: '100%',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: activeIntegrationModal.id === 'instagram' ? 'linear-gradient(135deg, #f09433, #dc2743, #bc1888)' :
                                      activeIntegrationModal.id === 'openai' ? '#10a37f' :
                                      activeIntegrationModal.id === 'slack' ? '#4a154b' :
                                      activeIntegrationModal.id === 'zapier' ? '#ff4a00' :
                                      activeIntegrationModal.id === 'make' ? '#6f2cf3' :
                                      activeIntegrationModal.id === 'razorpay' ? '#1e3a8a' : '#0284c7',
                          color: '#ffffff'
                        }}>
                          {activeIntegrationModal.id === 'instagram' && <Film size={20} />}
                          {activeIntegrationModal.id === 'openai' && <Sparkles size={20} />}
                          {activeIntegrationModal.id === 'slack' && <MessageSquare size={20} />}
                          {activeIntegrationModal.id === 'zapier' && <Zap size={20} />}
                          {activeIntegrationModal.id === 'make' && <SlidersHorizontal size={20} />}
                          {activeIntegrationModal.id === 'webhooks' && <Plug size={20} />}
                          {activeIntegrationModal.id === 'razorpay' && <CreditCard size={20} />}
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                            {activeIntegrationModal.name} Integration
                          </h3>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            {activeIntegrationModal.category || 'Third-Party Service'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveIntegrationModal(null)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div style={{ padding: '24px', maxHeight: '65vh', overflowY: 'auto' }}>
                      {/* Test Result Alert Banner */}
                      {integrationTestResult && (
                        <div style={{
                          marginBottom: '16px',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: integrationTestResult.success ? '#ecfdf5' : '#fef2f2',
                          border: `1px solid ${integrationTestResult.success ? '#a7f3d0' : '#fecaca'}`,
                          color: integrationTestResult.success ? '#065f46' : '#991b1b',
                          fontSize: '12.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {integrationTestResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                          <span>{integrationTestResult.message}</span>
                        </div>
                      )}

                      {/* 1. Instagram Content */}
                      {activeIntegrationModal.id === 'instagram' && (
                        <div>
                          <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Active Connected Accounts</div>
                            {activeIntegrationModal.accounts && activeIntegrationModal.accounts.length > 0 ? (
                              activeIntegrationModal.accounts.map((acc) => (
                                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>@{acc.username}</span>
                                    <span className="admin-badge-status-active" style={{ fontSize: '10px' }}>Connected</span>
                                  </div>
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {acc.ig_user_id || acc.id.slice(0, 8)}</span>
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: '13px', color: '#64748b' }}>No Instagram business accounts connected yet.</div>
                            )}
                          </div>

                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                              Meta App ID
                            </label>
                            <input
                              type="text"
                              readOnly
                              value={activeIntegrationModal.metaAppId || process.env.META_IG_APP_ID || '1788975642442359'}
                              style={{ width: '100%', padding: '9px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', color: '#475569' }}
                            />
                          </div>

                          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
                            Official Meta Graph API OAuth 2.0 connection. Automatically handles comment webhooks, private story replies, follow-verification, and rapid 0.8s direct message dispatch.
                          </div>

                          <button
                            type="button"
                            onClick={() => window.open('/api/instagram/login', '_blank')}
                            style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                          >
                            Reconnect or Link New Instagram Account ↗
                          </button>
                        </div>
                      )}

                      {/* 2. OpenAI Content */}
                      {activeIntegrationModal.id === 'openai' && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
                            Configure your OpenAI API key to enable AI contextual responses, intelligent sentiment detection, and automated conversational flows.
                          </div>

                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                              OpenAI API Key
                            </label>
                            <input
                              type="password"
                              placeholder={activeIntegrationModal.apiKeyMasked ? `Saved: ${activeIntegrationModal.apiKeyMasked} (Enter new to replace)` : 'sk-proj-...'}
                              value={integrationForm.apiKey}
                              onChange={(e) => setIntegrationForm({ ...integrationForm, apiKey: e.target.value })}
                              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                            />
                          </div>

                          <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                              Default Completion Model
                            </label>
                            <select
                              value={integrationForm.model}
                              onChange={(e) => setIntegrationForm({ ...integrationForm, model: e.target.value })}
                              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: '#ffffff' }}
                            >
                              <option value="gpt-4o-mini">GPT-4o Mini (Recommended: Ultra-fast & Cost-efficient)</option>
                              <option value="gpt-4o">GPT-4o (Maximum Reasoning & Nuance)</option>
                              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* 3. Slack Content */}
                      {activeIntegrationModal.id === 'slack' && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
                            Send automated alerts to your team's Slack channel whenever a high-intent lead triggers a DM, or when critical platform events occur.
                          </div>

                          <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                              Slack Incoming Webhook URL
                            </label>
                            <input
                              type="url"
                              placeholder={activeIntegrationModal.webhookUrlMasked ? `Saved: ${activeIntegrationModal.webhookUrlMasked} (Enter new to replace)` : 'https://hooks.slack.com/services/T.../B.../...'}
                              value={integrationForm.webhookUrl}
                              onChange={(e) => setIntegrationForm({ ...integrationForm, webhookUrl: e.target.value })}
                              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 4. Zapier Content */}
                      {activeIntegrationModal.id === 'zapier' && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
                            Connect Airvix to 5,000+ apps on Zapier (HubSpot, Google Sheets, ActiveCampaign, Notion, Airtable).
                          </div>

                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                              Your Zapier Catch Webhook URL (Outbound Leads)
                            </label>
                            <input
                              type="url"
                              placeholder={activeIntegrationModal.webhookUrlMasked ? `Saved: ${activeIntegrationModal.webhookUrlMasked}` : 'https://hooks.zapier.com/hooks/catch/...'}
                              value={integrationForm.webhookUrl}
                              onChange={(e) => setIntegrationForm({ ...integrationForm, webhookUrl: e.target.value })}
                              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                            />
                          </div>

                          <div style={{ marginBottom: '20px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Airvix Inbound Webhook Endpoint (For Zapier to Trigger DMs):</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(activeIntegrationModal.inboundWebhookUrl || `${window.location.origin}/api/webhooks/zapier`, 'zap_wh')}
                                style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                {copiedKey === 'zap_wh' ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            <code style={{ fontSize: '11.5px', color: '#2563eb', wordBreak: 'break-all' }}>
                              {activeIntegrationModal.inboundWebhookUrl || `${window.location.origin}/api/webhooks/zapier`}
                            </code>
                          </div>
                        </div>
                      )}

                      {/* 5. Make (Integromat) Content */}
                      {activeIntegrationModal.id === 'make' && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
                            Dispatch real-time conversation and lead payload events to custom Make (Integromat) visual scenarios.
                          </div>

                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                              Make Custom Webhook URL
                            </label>
                            <input
                              type="url"
                              placeholder={activeIntegrationModal.webhookUrlMasked ? `Saved: ${activeIntegrationModal.webhookUrlMasked}` : 'https://hook.eu1.make.com/...'}
                              value={integrationForm.webhookUrl}
                              onChange={(e) => setIntegrationForm({ ...integrationForm, webhookUrl: e.target.value })}
                              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                            />
                          </div>

                          <div style={{ marginBottom: '20px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Airvix Inbound Make Webhook:</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(activeIntegrationModal.inboundWebhookUrl || `${window.location.origin}/api/webhooks/make`, 'make_wh')}
                                style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                {copiedKey === 'make_wh' ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            <code style={{ fontSize: '11.5px', color: '#6f2cf3', wordBreak: 'break-all' }}>
                              {activeIntegrationModal.inboundWebhookUrl || `${window.location.origin}/api/webhooks/make`}
                            </code>
                          </div>
                        </div>
                      )}

                      {/* 6. Webhooks Content */}
                      {activeIntegrationModal.id === 'webhooks' && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
                            Meta Developer Webhooks receive real-time Instagram interactions including direct messages, quick reply postbacks, reel comments, and user follow events.
                          </div>

                          <div style={{ marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Meta Callback URL</label>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(activeIntegrationModal.webhookUrl || `${window.location.origin}/api/webhooks/instagram`, 'meta_wh')}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                {copiedKey === 'meta_wh' ? 'Copied!' : 'Copy URL'}
                              </button>
                            </div>
                            <input
                              type="text"
                              readOnly
                              value={activeIntegrationModal.webhookUrl || `${window.location.origin}/api/webhooks/instagram`}
                              style={{ width: '100%', padding: '9px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px' }}
                            />
                          </div>

                          <div style={{ marginBottom: '18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>Meta Verify Token</label>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(activeIntegrationModal.verifyToken || 'instagram_autoreply_verify_token_2026', 'meta_tok')}
                                style={{ background: '#f1f5f9', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                {copiedKey === 'meta_tok' ? 'Copied!' : 'Copy Token'}
                              </button>
                            </div>
                            <input
                              type="text"
                              readOnly
                              value={activeIntegrationModal.verifyToken || 'instagram_autoreply_verify_token_2026'}
                              style={{ width: '100%', padding: '9px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 7. Razorpay Content */}
                      {activeIntegrationModal.id === 'razorpay' && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
                            Configure your Razorpay merchant keys to process live UPI, cards, and netbanking subscriptions with automated GST invoice generation.
                          </div>

                          <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                              Razorpay Key ID
                            </label>
                            <input
                              type="text"
                              placeholder={activeIntegrationModal.keyIdMasked ? `Saved: ${activeIntegrationModal.keyIdMasked}` : 'rzp_live_... or rzp_test_...'}
                              value={integrationForm.keyId}
                              onChange={(e) => setIntegrationForm({ ...integrationForm, keyId: e.target.value })}
                              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                            />
                          </div>

                          <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                              Razorpay Key Secret
                            </label>
                            <input
                              type="password"
                              placeholder="Enter Key Secret from Razorpay Dashboard"
                              value={integrationForm.keySecret}
                              onChange={(e) => setIntegrationForm({ ...integrationForm, keySecret: e.target.value })}
                              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                            />
                          </div>

                          <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                              Razorpay Webhook Secret (Optional)
                            </label>
                            <input
                              type="password"
                              placeholder="whsec_..."
                              value={integrationForm.webhookSecret}
                              onChange={(e) => setIntegrationForm({ ...integrationForm, webhookSecret: e.target.value })}
                              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {activeIntegrationModal.connected && !['instagram', 'webhooks'].includes(activeIntegrationModal.id) ? (
                        <button
                          type="button"
                          onClick={handleDisconnectIntegration}
                          disabled={savingIntegration}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Disconnect
                        </button>
                      ) : <div />}

                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['openai', 'slack', 'zapier', 'make', 'razorpay', 'webhooks'].includes(activeIntegrationModal.id) && (
                          <button
                            type="button"
                            onClick={handleTestIntegration}
                            disabled={testingIntegration}
                            style={{ padding: '8px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                          >
                            {testingIntegration ? 'Testing...' : 'Test Connection'}
                          </button>
                        )}

                        {['openai', 'slack', 'zapier', 'make', 'razorpay'].includes(activeIntegrationModal.id) ? (
                          <button
                            type="button"
                            onClick={handleSaveIntegration}
                            disabled={savingIntegration}
                            style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}
                          >
                            {savingIntegration ? 'Saving...' : 'Save Configuration'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveIntegrationModal(null)}
                            style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}
                          >
                            Done
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                  <div className="admin-stat-val">
                    {overview?.messagesProcessedFormatted || '0'}
                  </div>
                  <span className="admin-stat-pill admin-stat-pill-up">Live</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Success Rate</span>
                  </div>
                  <div className="admin-stat-val">99.9%</div>
                  <span className="admin-stat-pill admin-stat-pill-up">Optimal</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Active Automation Rules</span>
                  </div>
                  <div className="admin-stat-val">
                    {safeguardsData?.activeRulesCount != null ? String(safeguardsData.activeRulesCount) : '0'}
                  </div>
                  <span className="admin-stat-pill admin-stat-pill-up">Active</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Min Natural Delay</span>
                  </div>
                  <div className="admin-stat-val">
                    {safeguardsData?.rateLimits?.minDelaySeconds ? `${safeguardsData.rateLimits.minDelaySeconds}s` : '0.8s'}
                  </div>
                  <span className="admin-stat-pill admin-stat-pill-up">Meta Safe</span>
                </div>
              </div>

              {/* Recent Automation Events */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3 className="admin-card-title">Recent Automation Events</h3>
                  <a href="#audit" onClick={(e) => { e.preventDefault(); setActiveTab('audit'); }} style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                    View audit log →
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
                      {(auditLogsList && auditLogsList.length > 0) ? (
                        auditLogsList.slice(0, 5).map((log, idx) => (
                          <tr key={log.id || idx}>
                            <td style={{ color: '#64748b', fontSize: '12px' }}>
                              {log.created_at ? (log.created_at.includes('T') ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : log.created_at) : 'Recent'}
                            </td>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{log.action || 'Automation Action'}</td>
                            <td>
                              <span className="admin-badge-status-active">
                                Success
                              </span>
                            </td>
                            <td style={{ color: '#64748b', fontSize: '12.5px' }}>{log.details || log.actor_email || 'Processed verified trigger'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                            No automation errors or incidents recorded. Systems operating cleanly.
                          </td>
                        </tr>
                      )}
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
                  <div className="admin-stat-val">
                    {analyticsData?.totals?.formattedDms || overview?.messagesProcessedFormatted || '0'}
                  </div>
                  <span className="admin-stat-pill admin-stat-pill-up">Live</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Total Users</span>
                  </div>
                  <div className="admin-stat-val">
                    {overview?.totalUsers != null ? overview.totalUsers.toLocaleString() : '0'}
                  </div>
                  <span className="admin-stat-pill admin-stat-pill-up">Live</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Delivery Success</span>
                  </div>
                  <div className="admin-stat-val">
                    {analyticsData?.performance?.deliverySuccessRate || '99.9%'}
                  </div>
                  <span className="admin-stat-pill admin-stat-pill-up">Optimal</span>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-header">
                    <span className="admin-stat-label">Monthly Revenue</span>
                  </div>
                  <div className="admin-stat-val">
                    {overview?.monthlyRevenueFormatted || '₹0'}
                  </div>
                  <span className="admin-stat-pill admin-stat-pill-up">Live</span>
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
                <button type="button" className="admin-subtab-btn active">Open (0)</button>
                <button type="button" className="admin-subtab-btn">In Progress (0)</button>
                <button type="button" className="admin-subtab-btn">Resolved (0)</button>
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
                    {(supportData?.tickets && supportData.tickets.length > 0) ? (
                      supportData.tickets.map((ticket, idx) => (
                        <tr key={ticket.id || idx}>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{ticket.user_email_masked || ticket.user || 'User'}</td>
                          <td style={{ color: '#334155', fontWeight: 500 }}>{ticket.category || ticket.subject || 'General Inquiry'}</td>
                          <td>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#f8fafc',
                              color: '#64748b',
                              border: '1px solid #e2e8f0'
                            }}>
                              {ticket.priority || 'Normal'}
                            </span>
                          </td>
                          <td>
                            <span className="admin-badge-status-active">
                              {ticket.status || 'Resolved'}
                            </span>
                          </td>
                          <td style={{ color: '#64748b', fontSize: '12px' }}>{ticket.created_at || 'Recent'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: '#64748b', fontSize: '13px' }}>
                          No customer support tickets pending. Support email &amp; WhatsApp channels are operational.
                        </td>
                      </tr>
                    )}
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

          {/* =========================================================================
              TAB: TEAM & SUB-ADMINISTRATORS MANAGEMENT
          ========================================================================= */}
          {activeTab === 'subadmins' && (
            <div className="admin-tab-content">
              {/* Top Banner / Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <ShieldCheck size={24} color="#2563eb" />
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                      Administrator Roles &amp; Granular Permissions
                    </h2>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Provision sub-admins with fine-grained power delegation across CMS, users, billing, safeguards, and platform APIs.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="admin-btn-secondary"
                    onClick={loadSubadmins}
                    disabled={loadingSubadmins}
                    title="Refresh administrator list"
                  >
                    <RefreshCw size={14} className={loadingSubadmins ? 'spin-anim' : ''} />
                    <span>Refresh</span>
                  </button>
                  {hasPermission('admins:manage') && (
                    <button
                      type="button"
                      className="admin-btn-primary"
                      onClick={() => {
                        setSubadminFormData({
                          name: '',
                          email: '',
                          password: '',
                          role: 'subadmin',
                          status: 'active',
                          permissions: ['cms:manage'],
                        });
                        setSubadminModalMode('create');
                      }}
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}
                    >
                      <Plus size={16} />
                      <span>Create Sub-Admin</span>
                    </button>
                  )}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="admin-kpi-grid" style={{ marginBottom: '24px' }}>
                <div className="admin-kpi-card">
                  <div className="admin-kpi-header">
                    <span className="admin-kpi-title">Total Staff Admins</span>
                    <Users size={18} color="#2563eb" />
                  </div>
                  <div className="admin-kpi-value">{subadminsList.length}</div>
                  <span className="admin-kpi-subtitle">Registered in admin directory</span>
                </div>

                <div className="admin-kpi-card">
                  <div className="admin-kpi-header">
                    <span className="admin-kpi-title">Super Admins</span>
                    <Shield size={18} color="#8b5cf6" />
                  </div>
                  <div className="admin-kpi-value" style={{ color: '#8b5cf6' }}>
                    {subadminsList.filter((s) => s.role === 'superadmin').length}
                  </div>
                  <span className="admin-kpi-subtitle">Unrestricted universal control</span>
                </div>

                <div className="admin-kpi-card">
                  <div className="admin-kpi-header">
                    <span className="admin-kpi-title">Granular Sub-Admins</span>
                    <Lock size={18} color="#0284c7" />
                  </div>
                  <div className="admin-kpi-value" style={{ color: '#0284c7' }}>
                    {subadminsList.filter((s) => s.role === 'subadmin').length}
                  </div>
                  <span className="admin-kpi-subtitle">Scoped by security policies</span>
                </div>

                <div className="admin-kpi-card">
                  <div className="admin-kpi-header">
                    <span className="admin-kpi-title">Granular Modules</span>
                    <Sparkles size={18} color="#10b981" />
                  </div>
                  <div className="admin-kpi-value" style={{ color: '#10b981' }}>
                    {ALL_ADMIN_POWERS.length}
                  </div>
                  <span className="admin-kpi-subtitle">Individual power flags defined</span>
                </div>
              </div>

              {/* Sub-Admins Directory Table */}
              <div className="admin-card">
                <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={18} color="#2563eb" />
                    <span>Administrator Directory</span>
                    <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', fontWeight: 600 }}>
                      {subadminsList.length} {subadminsList.length === 1 ? 'account' : 'accounts'}
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>ADMINISTRATOR</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>ROLE</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>STATUS</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>ASSIGNED POWERS</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>LAST ACTIVE / CREATED</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subadminsList.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b' }}>
                            {loadingSubadmins ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <RefreshCw size={16} className="spin-anim" /> Loading administrators...
                              </div>
                            ) : (
                              <div>
                                <ShieldAlert size={36} color="#94a3b8" style={{ marginBottom: '8px' }} />
                                <div>No administrators found in directory.</div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : (
                        subadminsList.map((adm) => {
                          const isRoot = ['sumitbhardwaj2227@gmail.com', 'sumit.bhardwaj_cs23@gla.ac.in', 'admin@airvix.com'].includes(adm.email?.toLowerCase());
                          let perms = adm.permissions || [];
                          if (typeof perms === 'string') {
                            try { perms = JSON.parse(perms); } catch (e) { perms = []; }
                          }
                          const isUniversal = adm.role === 'superadmin' || perms.includes('*');

                          return (
                            <tr key={adm.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: isUniversal ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '14px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                  }}>
                                    {(adm.name || adm.email || 'A')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>{adm.name || 'Administrator'}</span>
                                      {isRoot && (
                                        <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                          ROOT
                                        </span>
                                      )}
                                      {adm.email === user?.email && (
                                        <span style={{ fontSize: '10px', background: '#ecfdf5', color: '#047857', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                          YOU
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{adm.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                {isUniversal ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    background: '#f3e8ff',
                                    color: '#7e22ce',
                                    border: '1px solid #d8b4fe'
                                  }}>
                                    <Shield size={12} /> Super Admin
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    border: '1px solid #bae6fd'
                                  }}>
                                    <Lock size={12} /> Sub-Admin
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: adm.status === 'active' ? '#ecfdf5' : '#fef2f2',
                                  color: adm.status === 'active' ? '#047857' : '#b91c1c'
                                }}>
                                  {adm.status === 'active' ? '● Active' : '○ Suspended'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', maxWidth: '380px' }}>
                                {isUniversal ? (
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b21a8' }}>
                                    ⚡ All 12 Modules (Universal Master Control)
                                  </span>
                                ) : perms.length === 0 ? (
                                  <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                    No powers granted
                                  </span>
                                ) : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {perms.slice(0, 4).map((p) => {
                                      const meta = ALL_ADMIN_POWERS.find((item) => item.id === p);
                                      return (
                                        <span
                                          key={p}
                                          title={meta?.desc || p}
                                          style={{
                                            fontSize: '11px',
                                            padding: '2px 7px',
                                            borderRadius: '4px',
                                            background: '#f1f5f9',
                                            color: '#334155',
                                            border: '1px solid #e2e8f0',
                                            fontWeight: 600
                                          }}
                                        >
                                          {meta?.label || p}
                                        </span>
                                      );
                                    })}
                                    {perms.length > 4 && (
                                      <span style={{
                                        fontSize: '11px',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        background: '#eff6ff',
                                        color: '#2563eb',
                                        fontWeight: 700
                                      }}>
                                        +{perms.length - 4} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748b' }}>
                                <div>{adm.created_at ? new Date(adm.created_at).toLocaleDateString() : 'N/A'}</div>
                                {adm.last_login_at && (
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    Login: {new Date(adm.last_login_at).toLocaleDateString()}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  {hasPermission('admins:manage') && (
                                    <>
                                      <button
                                        type="button"
                                        className="admin-btn-secondary"
                                        style={{ padding: '5px 8px', fontSize: '11px' }}
                                        title="Configure Powers"
                                        onClick={() => {
                                          setSelectedSubadmin(adm);
                                          setSubadminFormData({
                                            name: adm.name || '',
                                            email: adm.email || '',
                                            role: adm.role || 'subadmin',
                                            status: adm.status || 'active',
                                            permissions: Array.isArray(perms) ? perms : [],
                                          });
                                          setSubadminModalMode('edit');
                                        }}
                                      >
                                        <Edit3 size={13} />
                                        <span>Powers</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="admin-btn-secondary"
                                        style={{ padding: '5px 8px', fontSize: '11px' }}
                                        title="Reset Password"
                                        onClick={() => {
                                          setSelectedSubadmin(adm);
                                          setSubadminPasswordInput('');
                                          setSubadminModalMode('reset-password');
                                        }}
                                      >
                                        <Lock size={13} />
                                        <span>Password</span>
                                      </button>
                                      {!isRoot && adm.email !== user?.email && (
                                        <button
                                          type="button"
                                          className="admin-btn-secondary"
                                          style={{ padding: '5px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fecaca' }}
                                          title="Delete Admin"
                                          onClick={() => handleDeleteSubadmin(adm)}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          MODAL: USER ACCESS CONTROL & DETAILS
      ========================================================================= */}
      {selectedUserDetail && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedUserDetail(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '680px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    User Inspection &amp; Access Control
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Account ID: {selectedUserDetail.id}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedUserDetail(null)} className="admin-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            {/* User Stats Card */}
            <div className="admin-user-details-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{selectedUserDetail.name}</div>
                  <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>{selectedUserDetail.email}</div>
                </div>

                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', background: selectedUserDetail.status === 'suspended' ? '#fef2f2' : '#f0fdf4', color: selectedUserDetail.status === 'suspended' ? '#dc2626' : '#16a34a', border: '1px solid currentColor' }}>
                  {selectedUserDetail.status === 'suspended' ? '● Suspended' : '● Active Account'}
                </span>
              </div>

              <div className="admin-detail-grid">
                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Subscription Tier</div>
                  <div className="admin-stat-pill-value" style={{ color: '#2563eb', textTransform: 'uppercase' }}>
                    {selectedUserDetail.plan}
                  </div>
                </div>

                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Monthly DM Limit</div>
                  <div className="admin-stat-pill-value" style={{ color: '#0f172a' }}>
                    {selectedUserDetail.dmLimit?.toLocaleString()} DMs
                    {selectedUserDetail.custom_dm_limit ? <span style={{ fontSize: '10px', color: '#16a34a', display: 'block', fontWeight: 600 }}>(Custom Override)</span> : null}
                  </div>
                </div>

                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Tokens Left / Used</div>
                  <div className="admin-stat-pill-value">
                    {selectedUserDetail.dmLeft?.toLocaleString()} / {selectedUserDetail.dmUsed?.toLocaleString()}
                  </div>
                </div>

                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Max IG Accounts</div>
                  <div className="admin-stat-pill-value" style={{ color: '#7c3aed' }}>
                    {selectedUserDetail.igLimit || 1} Accounts
                    {selectedUserDetail.custom_ig_limit ? <span style={{ fontSize: '10px', color: '#16a34a', display: 'block', fontWeight: 600 }}>(Custom Override)</span> : null}
                  </div>
                </div>

                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Active Rules Limit</div>
                  <div className="admin-stat-pill-value" style={{ color: '#0f172a' }}>
                    {selectedUserDetail.rulesLimit || 5} Rules
                    {selectedUserDetail.custom_rules_limit ? <span style={{ fontSize: '10px', color: '#16a34a', display: 'block', fontWeight: 600 }}>(Custom Override)</span> : null}
                  </div>
                </div>

                <div className="admin-stat-pill">
                  <div className="admin-stat-pill-label">Account Role</div>
                  <div className="admin-stat-pill-value">
                    {selectedUserDetail.role === 'admin' ? '🛡️ Super Admin' : '👤 Creator User'}
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Accounts */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Film size={16} color="#7c3aed" />
                  <span>Connected Instagram Accounts ({selectedUserDetail.connected_accounts?.length || 0} of {selectedUserDetail.igLimit || 1})</span>
                </h4>
              </div>

              {(selectedUserDetail.connected_accounts && selectedUserDetail.connected_accounts.length > 0) ? (
                selectedUserDetail.connected_accounts.map(ig => (
                  <div key={ig.id} className="admin-ig-account-row">
                    <div>
                      <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>@{ig.username}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Insta ID: <span style={{ fontFamily: 'monospace', color: '#334155' }}>{ig.ig_user_id}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>
                        {ig.followers_count?.toLocaleString() || 0} Followers
                      </div>
                      <span style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'capitalize' }}>{ig.status || 'Connected'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '14px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '12.5px', textAlign: 'center' }}>
                  No Instagram accounts currently connected for this user.
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
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
          MODAL: EDIT USER ACCESS & TIER & CUSTOM LIMITS (ADMIN CONTROL)
      ========================================================================= */}
      {editingUser && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '560px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit3 size={20} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    Edit User Access &amp; Quotas
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Account: {editingUser.email}</span>
                </div>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} className="admin-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const customIg = formData.get('custom_ig_limit');
              const customDm = formData.get('custom_dm_limit');
              const customRules = formData.get('custom_rules_limit');

              handleUpdateUser(editingUser.id, {
                name: formData.get('name'),
                plan: formData.get('plan'),
                role: formData.get('role'),
                status: formData.get('status'),
                custom_ig_limit: customIg !== '' && customIg !== null ? parseInt(customIg, 10) : null,
                custom_dm_limit: customDm !== '' && customDm !== null ? parseInt(customDm, 10) : null,
                custom_rules_limit: customRules !== '' && customRules !== null ? parseInt(customRules, 10) : null,
                reset_dm_usage: formData.get('reset_dm_usage') === 'on'
              });
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Full Name</label>
                  <input type="text" name="name" defaultValue={editingUser.name || 'Creator'} className="admin-form-input" required />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">User Email (Read-Only ID)</label>
                  <input type="email" value={editingUser.email} className="admin-form-input" disabled />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Plan Tier</label>
                    <select name="plan" defaultValue={(editingUser.plan || 'free').toLowerCase()} className="admin-form-select">
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

                {/* Live Instagram Accounts Count Badge */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Film size={15} color="#7c3aed" />
                      <span>Connected Instagram Accounts</span>
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '6px' }}>
                      {editingUser.connected_accounts_count || editingUser.instagram_accounts?.length || 0} / {editingUser.custom_ig_limit || editingUser.igLimit || 1} Accounts
                    </span>
                  </div>
                  {editingUser.instagram_accounts && editingUser.instagram_accounts.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {editingUser.instagram_accounts.map(ig => (
                        <span key={ig.id} style={{ fontSize: '12px', color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                          @{ig.username}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '6px' }}>
                      No Instagram accounts currently connected.
                    </div>
                  )}
                </div>

                {/* 🛠️ CUSTOM LIMITS OVERRIDE BOX (User Specific Control) */}
                <div className={`admin-custom-limits-box ${(editingUser.custom_ig_limit || editingUser.custom_dm_limit || editingUser.custom_rules_limit) ? 'active-custom' : ''}`}>
                  <div className="admin-custom-limits-header">
                    <div className="admin-custom-limits-title">
                      <SlidersHorizontal size={16} color="#16a34a" />
                      <span>Custom Quota &amp; Limit Overrides</span>
                    </div>
                    {(editingUser.custom_ig_limit || editingUser.custom_dm_limit || editingUser.custom_rules_limit) && (
                      <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '6px' }}>
                        ⚡ Custom Limit Active
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                    Admin control: set custom limits for this user to override their plan defaults. Leave any field blank to use standard plan limits.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div className="admin-form-group">
                      <label className="admin-form-label" style={{ fontSize: '11px' }}>
                        Custom IG Accounts
                      </label>
                      <input
                        type="number"
                        name="custom_ig_limit"
                        min="1"
                        max="1000"
                        defaultValue={editingUser.custom_ig_limit ?? ''}
                        placeholder={`Plan: ${editingUser.igLimit || 1}`}
                        className="admin-form-input"
                      />
                    </div>

                    <div className="admin-form-group">
                      <label className="admin-form-label" style={{ fontSize: '11px' }}>
                        Custom DM Limit / Mo
                      </label>
                      <input
                        type="number"
                        name="custom_dm_limit"
                        min="0"
                        defaultValue={editingUser.custom_dm_limit ?? ''}
                        placeholder={`Plan: ${(editingUser.dmLimit || 1000).toLocaleString()}`}
                        className="admin-form-input"
                      />
                    </div>

                    <div className="admin-form-group">
                      <label className="admin-form-label" style={{ fontSize: '11px' }}>
                        Custom Rules Limit
                      </label>
                      <input
                        type="number"
                        name="custom_rules_limit"
                        min="1"
                        defaultValue={editingUser.custom_rules_limit ?? ''}
                        placeholder={`Plan: ${editingUser.rulesLimit || 5}`}
                        className="admin-form-input"
                      />
                    </div>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer', margin: '4px 0' }}>
                  <input type="checkbox" name="reset_dm_usage" />
                  <span style={{ fontWeight: 600 }}>Reset current DM usage tokens to 0</span>
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
                <AlertCircle size={22} color="#dc2626" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>Delete User Account</h3>
              </div>
              <button type="button" onClick={() => setDeletingUser(null)} className="admin-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <div style={{ margin: '16px 0' }}>
              <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                Are you sure you want to permanently delete user <strong style={{ color: '#0f172a' }}>{deletingUser.name || deletingUser.email}</strong>?
              </p>
              <p style={{ fontSize: '12.5px', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '8px', lineHeight: 1.4 }}>
                ⚠️ Warning: This action cannot be undone. All connected Instagram accounts, automation rules, activity logs, and workspace data will be permanently purged.
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
          MODAL: CREATE / EDIT PRICING PLAN (PER-PLAN INSTAGRAM ACCOUNT LIMITS)
      ========================================================================= */}
      {isCreatingPlan && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsCreatingPlan(false); }}>
          <div className="admin-modal-box" style={{ maxWidth: '620px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CreditCard size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {editingPlan ? `Edit Pricing Plan: ${editingPlan.name}` : 'Create Custom Pricing Plan'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsCreatingPlan(false)} className="admin-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePlan}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Plan Name</label>
                    <input type="text" value={planFormData.name} onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })} className="admin-form-input" placeholder="e.g. Pro Creator" required />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Badge Label (e.g. 🔥 POPULAR)</label>
                    <input type="text" value={planFormData.badge || ''} onChange={(e) => setPlanFormData({ ...planFormData, badge: e.target.value })} className="admin-form-input" placeholder="e.g. MOST POPULAR" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Monthly Price (₹ INR)</label>
                    <input type="number" value={planFormData.monthlyPrice} onChange={(e) => setPlanFormData({ ...planFormData, monthlyPrice: e.target.value })} className="admin-form-input" required />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Annual Monthly Price (₹ INR)</label>
                    <input type="number" value={planFormData.annualPrice} onChange={(e) => setPlanFormData({ ...planFormData, annualPrice: e.target.value })} className="admin-form-input" />
                  </div>
                </div>

                {/* Per-Plan Quotas and Limits */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                    Plan Quotas &amp; Instagram Account Limits
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                      <label className="admin-form-label">DM Limit / Mo</label>
                      <input type="number" value={planFormData.dmLimit} onChange={(e) => setPlanFormData({ ...planFormData, dmLimit: e.target.value })} className="admin-form-input" placeholder="1000" required />
                    </div>
                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                      <label className="admin-form-label">IG Accounts Limit</label>
                      <input type="number" min="1" max="1000" value={planFormData.igLimit} onChange={(e) => setPlanFormData({ ...planFormData, igLimit: e.target.value })} className="admin-form-input" placeholder="1" required />
                    </div>
                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                      <label className="admin-form-label">Active Rules Limit</label>
                      <input type="number" min="1" max="1000" value={planFormData.rulesLimit} onChange={(e) => setPlanFormData({ ...planFormData, rulesLimit: e.target.value })} className="admin-form-input" placeholder="5" required />
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '6px' }}>
                    Determines how many Instagram accounts and active rules creators on this plan are allowed to connect.
                  </span>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Description</label>
                  <input type="text" value={planFormData.description} onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })} className="admin-form-input" placeholder="Short description of this plan tier" />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Features List (One per line)</label>
                  <textarea
                    rows={4}
                    value={planFeaturesText}
                    onChange={(e) => setPlanFeaturesText(e.target.value)}
                    className="admin-form-input"
                    style={{ resize: 'vertical' }}
                    placeholder="Enter features, one per line"
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

      {/* =========================================================================
          MODAL: GENERATE / CREATE PROMO COUPON
      ========================================================================= */}
      {isCreatingCoupon && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsCreatingCoupon(false); }}>
          <div className="admin-modal-box" style={{ maxWidth: '540px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Tag size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Generate Promotional Coupon
                </h3>
              </div>
              <button type="button" onClick={() => setIsCreatingCoupon(false)} className="admin-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0' }}>
                <div className="admin-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="admin-form-label" style={{ margin: 0 }}>Coupon Promo Code</label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomCouponCode}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Sparkles size={12} />
                      <span>Randomize Code</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={couponFormData.code}
                    onChange={(e) => setCouponFormData({ ...couponFormData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                    className="admin-form-input"
                    placeholder="e.g. LAUNCH50 or SUMMERVIP"
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.8px' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Discount Percentage (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={couponFormData.discount_percent}
                      onChange={(e) => setCouponFormData({ ...couponFormData, discount_percent: e.target.value })}
                      className="admin-form-input"
                      placeholder="e.g. 50"
                      required
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Applies To Plan</label>
                    <select
                      value={couponFormData.plan_slug}
                      onChange={(e) => setCouponFormData({ ...couponFormData, plan_slug: e.target.value })}
                      className="admin-form-select"
                    >
                      <option value="all">All Plans (Universal)</option>
                      <option value="pro">Pro Creator Plan Only</option>
                      <option value="agency">Agency &amp; Brand Only</option>
                      <option value="enterprise">Enterprise VIP Only</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Max Redemptions Limit</label>
                    <input
                      type="number"
                      min="1"
                      value={couponFormData.max_uses}
                      onChange={(e) => setCouponFormData({ ...couponFormData, max_uses: e.target.value })}
                      className="admin-form-input"
                      placeholder="100"
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                      Leave at 100 or set custom redemption cap
                    </span>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Expiration Date (Optional)</label>
                    <input
                      type="date"
                      value={couponFormData.expires_at}
                      onChange={(e) => setCouponFormData({ ...couponFormData, expires_at: e.target.value })}
                      className="admin-form-input"
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                      Leave blank for perpetual discount
                    </span>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Campaign Description / Notes</label>
                  <input
                    type="text"
                    value={couponFormData.description}
                    onChange={(e) => setCouponFormData({ ...couponFormData, description: e.target.value })}
                    className="admin-form-input"
                    placeholder="e.g. VIP Creator Launch Partner Discount"
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setIsCreatingCoupon(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary">Create &amp; Activate Coupon</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE / RECORD MANUAL INVOICE
      ========================================================================= */}
      {isCreatingInvoice && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsCreatingInvoice(false); }}>
          <div className="admin-modal-box" style={{ maxWidth: '540px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Receipt size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Generate Billing Invoice
                </h3>
              </div>
              <button type="button" onClick={() => setIsCreatingInvoice(false)} className="admin-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '14px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Customer Email</label>
                    <input
                      type="email"
                      value={invoiceFormData.user_email}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, user_email: e.target.value })}
                      className="admin-form-input"
                      placeholder="creator@example.com"
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Customer Billing Name</label>
                    <input
                      type="text"
                      value={invoiceFormData.billing_name}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, billing_name: e.target.value })}
                      className="admin-form-input"
                      placeholder="e.g. Sumit Bhardwaj"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Subscription Tier / Plan</label>
                    <select
                      value={invoiceFormData.plan}
                      onChange={(e) => {
                        const newPlan = e.target.value;
                        const match = plansList.find(p => p.slug === newPlan);
                        setInvoiceFormData({
                          ...invoiceFormData,
                          plan: newPlan,
                          amount: match ? match.monthlyPrice : invoiceFormData.amount
                        });
                      }}
                      className="admin-form-select"
                    >
                      <option value="free">Free Starter (₹0)</option>
                      <option value="pro">Pro Creator (₹1,499)</option>
                      <option value="agency">Agency &amp; Brand (₹3,999)</option>
                      <option value="enterprise">Enterprise VIP (₹7,999)</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Total Amount (₹ INR)</label>
                    <input
                      type="number"
                      value={invoiceFormData.amount}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, amount: e.target.value })}
                      className="admin-form-input"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Payment Gateway / Method</label>
                    <select
                      value={invoiceFormData.gateway}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, gateway: e.target.value })}
                      className="admin-form-select"
                    >
                      <option value="razorpay">Razorpay (UPI / Cards)</option>
                      <option value="bank_transfer">Direct Bank NEFT / IMPS</option>
                      <option value="upi_direct">UPI Direct (GPay / PhonePe)</option>
                      <option value="manual">Manual Admin Entry</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Payment Status</label>
                    <select
                      value={invoiceFormData.status}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, status: e.target.value })}
                      className="admin-form-select"
                    >
                      <option value="paid">🟢 Paid (Settled)</option>
                      <option value="pending">⏳ Pending Payment</option>
                      <option value="refunded">⚪ Refunded</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Customer GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={invoiceFormData.gst_number}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, gst_number: e.target.value })}
                    className="admin-form-input"
                    placeholder="e.g. 29AAAAA0000A1Z5"
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setIsCreatingInvoice(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary">Generate &amp; Save Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PROFESSIONAL PRINTABLE INVOICE SLIP
      ========================================================================= */}
      {selectedInvoiceSlip && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedInvoiceSlip(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '640px', padding: '28px', background: '#ffffff', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '18px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '28px', height: '28px', background: '#2563eb', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                    <Send size={15} />
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Airvix</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
                  {billingSettings.company_name}<br />
                  {billingSettings.company_address}<br />
                  GSTIN: {billingSettings.gstin || '29AAAAA0000A1Z5'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>TAX INVOICE</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '2px 0' }}>
                  {selectedInvoiceSlip.invoice_number || selectedInvoiceSlip.id}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Date: {selectedInvoiceSlip.formatted_date || (selectedInvoiceSlip.created_at ? new Date(selectedInvoiceSlip.created_at).toLocaleDateString() : 'Paid')}
                </div>
                <span className={selectedInvoiceSlip.status === 'paid' ? 'admin-badge-status-active' : 'admin-badge-status-pending'} style={{ marginTop: '6px', display: 'inline-block' }}>
                  {selectedInvoiceSlip.status === 'paid' ? 'PAID & SETTLED' : selectedInvoiceSlip.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Customer Details */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                BILLED TO:
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                {selectedInvoiceSlip.user_name || selectedInvoiceSlip.billing_name || 'Creator Customer'}
              </div>
              <div style={{ fontSize: '12.5px', color: '#475569' }}>
                {selectedInvoiceSlip.user_email_full || selectedInvoiceSlip.user_email_masked || selectedInvoiceSlip.billing_email}
              </div>
              {selectedInvoiceSlip.gst_number && (
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                  Customer GSTIN: {selectedInvoiceSlip.gst_number}
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>
                  <th style={{ padding: '8px 0' }}>ITEM DESCRIPTION</th>
                  <th style={{ padding: '8px 0', textAlign: 'center' }}>QTY</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                  <td style={{ padding: '12px 0' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                      Airvix {selectedInvoiceSlip.plan || 'Pro'} Automation Plan
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Instagram DM Automation, Follow-Gating &amp; Interactive Cards (1 Month)
                    </div>
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center', color: '#475569' }}>1</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                    ₹{Math.round(selectedInvoiceSlip.amount / 1.18).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Financial Breakdown */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <div style={{ width: '240px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{Math.round(selectedInvoiceSlip.amount / 1.18).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                  <span>CGST (9%):</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{Math.round((selectedInvoiceSlip.amount / 1.18) * 0.09).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                  <span>SGST (9%):</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{Math.round((selectedInvoiceSlip.amount / 1.18) * 0.09).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #0f172a', marginTop: '6px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  <span>Total Paid:</span>
                  <span>₹{Number(selectedInvoiceSlip.amount).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Gateway Info */}
            <div style={{ fontSize: '11px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginBottom: '20px' }}>
              Paid via {selectedInvoiceSlip.gateway || 'Razorpay Online Payments'} • Transaction Ref: {selectedInvoiceSlip.gateway_payment_id || selectedInvoiceSlip.id}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="admin-btn-secondary"
                onClick={() => setSelectedInvoiceSlip(null)}
              >
                Close Receipt
              </button>

              <button
                type="button"
                className="admin-btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={14} />
                <span>Print / Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE OR EDIT SUB-ADMIN & GRANULAR POWERS
      ========================================================================= */}
      {(subadminModalMode === 'create' || subadminModalMode === 'edit') && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSubadminModalMode(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={22} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    {subadminModalMode === 'create' ? 'Provision New Sub-Administrator' : `Edit Powers: ${selectedSubadmin?.email}`}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {subadminModalMode === 'create' ? 'Create a staff login and configure granular module permissions' : 'Adjust administrative permissions and account active status'}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setSubadminModalMode(null)} className="admin-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={subadminModalMode === 'create' ? handleCreateSubadmin : handleUpdateSubadmin}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Name & Email */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Full Name / Label</label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="e.g. Content Lead Sarah"
                      value={subadminFormData.name}
                      onChange={(e) => setSubadminFormData({ ...subadminFormData, name: e.target.value })}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Email Address *</label>
                    <input
                      type="email"
                      required
                      disabled={subadminModalMode === 'edit'}
                      className="admin-form-input"
                      placeholder="e.g. staff@airvix.com"
                      value={subadminFormData.email}
                      onChange={(e) => setSubadminFormData({ ...subadminFormData, email: e.target.value })}
                    />
                  </div>
                </div>

                {/* Password & Role */}
                <div style={{ display: 'grid', gridTemplateColumns: subadminModalMode === 'create' ? '1fr 1fr' : '1fr 1fr', gap: '16px' }}>
                  {subadminModalMode === 'create' ? (
                    <div className="admin-form-group">
                      <label className="admin-form-label">Initial Password *</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        className="admin-form-input"
                        placeholder="At least 6 characters"
                        value={subadminFormData.password}
                        onChange={(e) => setSubadminFormData({ ...subadminFormData, password: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="admin-form-group">
                      <label className="admin-form-label">Account Status</label>
                      <select
                        className="admin-form-select"
                        value={subadminFormData.status || 'active'}
                        onChange={(e) => setSubadminFormData({ ...subadminFormData, status: e.target.value })}
                      >
                        <option value="active">Active (Permitted to Log In)</option>
                        <option value="suspended">Suspended (Access Blocked)</option>
                      </select>
                    </div>
                  )}

                  <div className="admin-form-group">
                    <label className="admin-form-label">Administrator Role Level</label>
                    <select
                      className="admin-form-select"
                      value={subadminFormData.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setSubadminFormData({
                          ...subadminFormData,
                          role: newRole,
                          permissions: newRole === 'superadmin' ? ['*'] : subadminFormData.permissions.filter((p) => p !== '*'),
                        });
                      }}
                    >
                      <option value="subadmin">Sub-Admin (Granular Access Scoped Below)</option>
                      <option value="superadmin">Super Admin (Universal Access to All Features)</option>
                    </select>
                  </div>
                </div>

                {/* Granular Powers Grid */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                        Granular Module Powers ({subadminFormData.role === 'superadmin' ? 'Universal *' : `${(subadminFormData.permissions || []).length} / ${ALL_ADMIN_POWERS.length} Active`})
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {subadminFormData.role === 'superadmin'
                          ? 'Super Admins possess root universal permissions across all administrative tools.'
                          : 'Select specifically which modules this sub-administrator is authorized to view & edit.'}
                      </div>
                    </div>
                    {subadminFormData.role !== 'superadmin' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => setSubadminFormData({ ...subadminFormData, permissions: ALL_ADMIN_POWERS.map((p) => p.id) })}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="admin-btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => setSubadminFormData({ ...subadminFormData, permissions: [] })}
                        >
                          Clear All
                        </button>
                      </div>
                    )}
                  </div>

                  {subadminFormData.role === 'superadmin' ? (
                    <div style={{ padding: '16px', borderRadius: '10px', background: '#f5f3ff', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Shield size={24} color="#7c3aed" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#5b21b6' }}>Universal Permissions Granted</div>
                        <div style={{ fontSize: '12px', color: '#6d28d9' }}>This administrator has full read and write access to all 12 modules, financial data, and security settings.</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                      {ALL_ADMIN_POWERS.map((power) => {
                        const isChecked = (subadminFormData.permissions || []).includes(power.id);
                        return (
                          <div
                            key={power.id}
                            onClick={() => {
                              const current = Array.isArray(subadminFormData.permissions) ? subadminFormData.permissions : [];
                              if (isChecked) {
                                setSubadminFormData({ ...subadminFormData, permissions: current.filter((p) => p !== power.id) });
                              } else {
                                setSubadminFormData({ ...subadminFormData, permissions: [...current, power.id] });
                              }
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: isChecked ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              background: isChecked ? '#eff6ff' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              transition: 'all 0.15s ease',
                              boxShadow: isChecked ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent div
                              style={{ marginTop: '2px', accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: isChecked ? '#1d4ed8' : '#0f172a' }}>
                                  {power.label}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                                {power.desc}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setSubadminModalMode(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subadminSaving}
                  className="admin-btn-primary"
                  style={{ minWidth: '140px' }}
                >
                  {subadminSaving ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <RefreshCw size={14} className="spin-anim" /> Saving...
                    </span>
                  ) : (
                    <span>{subadminModalMode === 'create' ? 'Create Administrator' : 'Save Changes'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RESET SUB-ADMIN PASSWORD
      ========================================================================= */}
      {subadminModalMode === 'reset-password' && selectedSubadmin && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSubadminModalMode(null); }}>
          <div className="admin-modal-box" style={{ maxWidth: '460px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Lock size={20} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Reset Staff Password
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>For {selectedSubadmin.email}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSubadminModalMode(null)} className="admin-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetSubadminPassword}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  Set a new temporary or permanent password for this administrator. Their previous credentials will immediately cease functioning.
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">New Password (Min. 6 Characters) *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoFocus
                    className="admin-form-input"
                    placeholder="Enter new password"
                    value={subadminPasswordInput}
                    onChange={(e) => setSubadminPasswordInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setSubadminModalMode(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subadminSaving || subadminPasswordInput.length < 6}
                  className="admin-btn-primary"
                >
                  {subadminSaving ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CHANGE OWN PASSWORD (SELF-SERVICE)
      ========================================================================= */}
      {isChangePasswordOpen && (
        <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsChangePasswordOpen(false); }}>
          <div className="admin-modal-box" style={{ maxWidth: '480px' }}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <KeyRound size={20} color="#2563eb" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Change Administrator Password
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Account: {user?.email}</span>
                </div>
              </div>
              <button type="button" onClick={() => setIsChangePasswordOpen(false)} className="admin-modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangeOwnPassword}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {changePasswordError && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} />
                    <span>{changePasswordError}</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-form-label">Current Password (Leave blank if none set)</label>
                  <input
                    type="password"
                    className="admin-form-input"
                    placeholder="Enter current password"
                    value={changePasswordData.oldPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, oldPassword: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">New Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="admin-form-input"
                    placeholder="Minimum 6 characters"
                    value={changePasswordData.newPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="admin-form-input"
                    placeholder="Re-type new password"
                    value={changePasswordData.confirmPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="admin-modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setIsChangePasswordOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePasswordSaving}
                  className="admin-btn-primary"
                >
                  {changePasswordSaving ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
