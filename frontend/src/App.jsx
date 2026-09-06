// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DashboardView from './components/DashboardView';
import RulesView from './components/RulesView';
import ConversationsView from './components/ConversationsView';
import SimulatorView from './components/SimulatorView';
import AnalyticsView from './components/AnalyticsView';
import BillingView from './components/BillingView';
import SettingsView from './components/SettingsView';
import AuthView from './components/AuthView';
import LandingView from './components/LandingView';
import CreateRuleModal from './components/CreateRuleModal';
import ConnectIgModal from './components/ConnectIgModal';
import UpgradeModal from './components/UpgradeModal';
import { getCurrentUser, clearAuthSession, apiFetch } from './api/client';

export default function App() {
  const [user, setUser] = useState(getCurrentUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);

  // View routing: 'landing' | 'auth-login' | 'auth-signup' | 'app'
  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    if (path === '/login' || hash === '#login') return 'auth-login';
    if (path === '/signup' || path === '/register' || hash === '#signup' || hash === '#register') return 'auth-signup';
    if (path === '/app' || hash === '#app') {
      return getCurrentUser() ? 'app' : 'auth-login';
    }
    // DEFAULT FOR FIRST-TIME VISITORS AND HOME: LANDING PAGE
    return 'landing';
  });

  // Modals
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [isConnectIgOpen, setIsConnectIgOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);

  // Data states
  const [stats, setStats] = useState(null);
  const [rules, setRules] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [account, setAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Sync hash changes with view state
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#login') setCurrentView('auth-login');
      else if (hash === '#signup' || hash === '#register') setCurrentView('auth-signup');
      else if (hash === '#app') setCurrentView(user ? 'app' : 'auth-login');
      else if (hash === '#landing' || hash === '' || hash === '#') setCurrentView('landing');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  // Handle OAuth callback URL parameters (?connected=true or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      setNotification({ type: 'success', message: '🎉 Instagram account successfully connected to ReplyOS!' });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      setNotification({ type: 'error', message: `Instagram connection note: ${decodeURIComponent(params.get('error'))}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Listen for unauthorized 401 events
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Fetch all user data
  const loadData = useCallback(async (targetAccId) => {
    if (!user) return;
    const activeAccId = targetAccId !== undefined ? targetAccId : selectedAccountId;
    const queryParam = activeAccId ? `?account_id=${activeAccId}` : '';

    try {
      // 0. Fetch list of all accounts for this user
      const accountsRes = await apiFetch('/instagram/accounts');
      if (accountsRes.ok) {
        const accsData = await accountsRes.json();
        setAccounts(accsData.accounts || []);
      }

      // 1. Fetch dashboard stats + active account
      const statsRes = await apiFetch(`/dashboard/stats${queryParam}`);
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats({
          dmsSent: d.totalDmsSent ?? 0,
          dmsLimit: d.dmLimit ?? 1000,
          dmRemaining: d.dmRemaining ?? Math.max(0, (d.dmLimit || 1000) - (d.totalDmsSent || 0)),
          commentsReplied: d.commentsReplied ?? 0,
          commentsRepliedChange: d.commentsRepliedChange ?? 0,
          activeRules: d.activeRules ?? 0,
          totalRules: d.totalRules ?? 0,
          usagePercent: d.usagePercent ?? 0,
          accountHealthy: d.accountHealthy ?? false,
          recentConversations: d.recent_conversations || [],
        });
        setAccount(d.account || null);
        if (d.user) {
          setUser(prev => ({ ...prev, name: d.user.name, plan: d.user.plan }));
        }
      }

      // 2. Fetch rules
      const rulesRes = await apiFetch(`/rules${queryParam}`);
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData.rules || []);
      }

      // 3. Fetch conversations
      const convRes = await apiFetch(`/conversations${queryParam}`);
      if (convRes.ok) {
        const convData = await convRes.json();
        setConversations(convData.conversations || []);
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    }
  }, [user, selectedAccountId]);

  useEffect(() => {
    if (currentView === 'app') {
      loadData();
    }
  }, [currentView, loadData]);

  const handleSelectAccount = (accId) => {
    setSelectedAccountId(accId);
    loadData(accId);
  };

  // Handlers
  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    window.location.hash = '';
    setCurrentView('landing');
  };

  const handleNavigate = (view) => {
    if (view === 'auth-login') {
      window.location.hash = '#login';
      setCurrentView('auth-login');
    } else if (view === 'auth-signup') {
      window.location.hash = '#signup';
      setCurrentView('auth-signup');
    } else if (view === 'app') {
      window.location.hash = '#app';
      setCurrentView('app');
    } else {
      window.location.hash = '';
      setCurrentView('landing');
    }
  };

  const handleAuthSuccess = (loggedUser) => {
    setUser(loggedUser);
    window.location.hash = '#app';
    setCurrentView('app');
  };

  const handleToggleRule = async (ruleId, newActiveState) => {
    try {
      await apiFetch(`/rules/${ruleId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: newActiveState ? 1 : 0 }),
      });
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, is_active: newActiveState ? 1 : 0 } : r))
      );
      loadData();
    } catch (e) {
      console.error('Failed to toggle rule:', e);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await apiFetch(`/rules/${ruleId}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      loadData();
    } catch (e) {
      console.error('Failed to delete rule:', e);
    }
  };

  const handleRuleCreated = (newRule) => {
    setRules((prev) => [newRule, ...prev]);
    loadData();
  };

  const handleAccountConnected = (newAcc) => {
    setAccount(newAcc);
    loadData();
  };

  const handleDisconnectAccount = async (accId) => {
    const targetId = accId || account?.id;
    if (!targetId) return;
    if (!window.confirm('Are you sure you want to disconnect this Instagram account?')) return;
    try {
      const res = await apiFetch(`/instagram/accounts/${targetId}`, { method: 'DELETE' });
      if (res.ok) {
        setNotification({ type: 'success', message: 'Instagram account disconnected successfully.' });
        setSelectedAccountId(null);
        setAccount(null);
        await loadData(null);
      } else {
        setNotification({ type: 'error', message: 'Failed to disconnect account.' });
      }
    } catch (e) {
      setNotification({ type: 'error', message: 'Failed to disconnect account.' });
    }
  };

  // 1. Landing View (Default for first-time visitors)
  if (currentView === 'landing') {
    return <LandingView onNavigate={handleNavigate} user={user} />;
  }

  // 2. Auth View (Login / Signup)
  if (currentView === 'auth-login' || currentView === 'auth-signup' || !user) {
    return (
      <AuthView
        initialMode={currentView === 'auth-signup' ? 'signup' : 'login'}
        onAuthSuccess={handleAuthSuccess}
        onBackToLanding={() => handleNavigate('landing')}
      />
    );
  }

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUpgrade={() => setIsUpgradeOpen(true)}
        onOpenConnect={() => setIsConnectIgOpen(true)}
        onLogout={handleLogout}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        unreadCount={conversations.length}
      />

      {/* Main Content Pane */}
      <div
        className="main-viewport"
        style={{
          marginLeft: 'var(--sidebar-width)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          background: 'var(--bg-body)',
        }}
      >
        {/* Topbar */}
        <Topbar
          user={user}
          account={account}
          accounts={accounts}
          onSelectAccount={handleSelectAccount}
          onDisconnectAccount={handleDisconnectAccount}
          onOpenConnect={() => setIsConnectIgOpen(true)}
          onOpenUpgrade={() => setIsUpgradeOpen(true)}
          onLogout={handleLogout}
          onSearch={(q) => console.log('Searching for:', q)}
        />

        {/* Global OAuth / Alert Toast Banner */}
        {notification && (
          <div style={{
            margin: '16px 24px 0',
            padding: '12px 18px',
            borderRadius: '12px',
            background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: notification.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '13.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            animation: 'fadeIn 0.2s ease',
          }}>
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* View Router */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              stats={stats}
              rules={rules}
              conversations={conversations}
              account={account}
              accounts={accounts}
              onSelectAccount={handleSelectAccount}
              onDisconnectAccount={handleDisconnectAccount}
              onNavigate={setActiveTab}
              onOpenCreateRule={() => setIsCreateRuleOpen(true)}
              onOpenUpgrade={() => setIsUpgradeOpen(true)}
              onOpenConnect={() => setIsConnectIgOpen(true)}
              onToggleRule={handleToggleRule}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'rules' && (
            <RulesView
              rules={rules}
              onOpenCreateRule={() => setIsCreateRuleOpen(true)}
              onToggleRule={handleToggleRule}
              onDeleteRule={handleDeleteRule}
            />
          )}

          {activeTab === 'conversations' && (
            <ConversationsView 
              conversations={conversations} 
              onRefresh={loadData} 
              selectedAccountId={selectedAccountId || account?.id} 
            />
          )}

          {activeTab === 'simulator' && (
            <SimulatorView rules={rules} onRefreshStats={loadData} />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView stats={stats} rules={rules} account={account} />
          )}

          {activeTab === 'billing' && (
            <BillingView user={user} onUpgrade={() => setIsUpgradeOpen(true)} />
          )}

          {activeTab === 'settings' && (
            <SettingsView account={account} onOpenConnect={() => setIsConnectIgOpen(true)} onDisconnectAccount={handleDisconnectAccount} onRefresh={() => loadData()} />
          )}

          {activeTab === 'templates' && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <h2>Message & Reply Templates</h2>
              <p>Pre-made e-commerce and creator response sequences.</p>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateRuleModal
        isOpen={isCreateRuleOpen}
        onClose={() => setIsCreateRuleOpen(false)}
        onRuleCreated={handleRuleCreated}
        accountId={selectedAccountId || account?.id}
      />

      <ConnectIgModal
        isOpen={isConnectIgOpen}
        onClose={() => setIsConnectIgOpen(false)}
        onConnected={handleAccountConnected}
      />

      <UpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
        onUpgraded={(plan) => {
          setUser((prev) => ({ ...prev, plan }));
          loadData();
        }}
      />
    </div>
  );
}
