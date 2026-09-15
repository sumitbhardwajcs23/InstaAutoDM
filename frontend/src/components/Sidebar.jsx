// frontend/src/components/Sidebar.jsx
import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Link2,
  Zap,
  MessageSquare,
  BarChart3,
  PlayCircle,
  FileText,
  CreditCard,
  Settings,
  Sparkles,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Instagram,
  Film,
  Shield,
  X,
} from 'lucide-react';

export default function Sidebar({
  user,
  activeTab,
  setActiveTab,
  onOpenUpgrade,
  onOpenConnect,
  onOpenAdmin,
  onLogout,
  darkMode,
  setDarkMode,
  unreadCount = 12,
  isOpen = false,
  onClose,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'media', label: 'Content & Media', icon: Film },
    { id: 'rules', label: 'Automation Rules', icon: Zap },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare, badge: unreadCount },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'simulator', label: 'Live Simulator', icon: PlayCircle },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Close sidebar on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavClick = (item) => {
    if (item.action) {
      item.action();
    } else {
      setActiveTab(item.id);
    }
    // Close drawer on mobile after navigation
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile overlay — clicking outside closes the drawer */}
      <div
        className={`sidebar-overlay${isOpen ? ' active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`sidebar${isOpen ? ' sidebar-is-open' : ''}`}
        role="navigation"
        aria-label="Main navigation"
        aria-hidden={!isOpen ? 'false' : undefined}
      >
        {/* Brand Header */}
        <div className="sidebar-logo">
          <div
            className="logo-icon-wrap"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#ffffff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              padding: '3px',
            }}
          >
            <img
              src="/logo-icon.png"
              alt="Airvix Icon"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div className="logo-text" style={{ flex: 1, minWidth: 0 }}>
            <div
              className="name"
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '19px',
                fontWeight: 900,
                letterSpacing: '-0.4px',
                lineHeight: 1.15,
              }}
            >
              <span style={{ color: 'var(--text-main)' }}>Air</span>
              <span style={{ color: '#6366F1' }}>vix</span>
            </div>
            <div
              className="tagline"
              style={{
                fontSize: '8.5px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-light)',
                marginTop: '2px',
              }}
            >
              Automate Conversations
            </div>
          </div>

          {/* Mobile close button — visible only inside drawer on mobile */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              minWidth: '32px',
              minHeight: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            className="sidebar-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav Menu */}
        <nav className="sidebar-nav">
          <div
            className="nav-section-title"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-light)',
              padding: '8px 12px 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Menu
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item${isActive ? ' active' : ''}`}
                onClick={() => handleNavClick(item)}
                style={{
                  width: '100%',
                  border: 'none',
                  background: isActive ? 'var(--primary-gradient)' : 'transparent',
                  textAlign: 'left',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Icon size={18} />
                <span className="label" style={{ flex: 1 }}>
                  {item.label}
                </span>
                {item.badge ? (
                  <span
                    className="nav-badge"
                    style={{
                      background: isActive ? '#ffffff' : '#ef4444',
                      color: isActive ? 'var(--primary)' : '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Upgrade to Pro Box */}
        <div
          className="sidebar-upgrade-box"
          style={{
            margin: '12px 14px',
            padding: '16px',
            borderRadius: '16px',
            background:
              'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.12))',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <Sparkles size={14} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
              Upgrade to Pro
            </span>
          </div>

          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 12px 0',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> Unlimited DMs & comments
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> AI smart reply generator
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span> Advanced analytics & export
            </li>
          </ul>

          <button
            type="button"
            onClick={() => { onOpenUpgrade(); if (onClose) onClose(); }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              color: '#ffffff',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              transition: 'opacity 0.2s',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Upgrade Now
          </button>
        </div>

        {/* Sidebar Footer Controls */}
        <div
          className="sidebar-footer"
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            paddingBottom: 'max(12px, calc(12px + env(safe-area-inset-bottom, 0px)))',
          }}
        >
          <button
            type="button"
            className="nav-item"
            style={{ width: '100%', border: 'none', background: 'transparent' }}
            onClick={() => alert('Need help? Contact support@airvix.com')}
          >
            <HelpCircle size={17} />
            <span className="label">Help & Support</span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '13px',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {darkMode ? <Moon size={16} /> : <Sun size={16} />}
              <span>Dark Mode</span>
            </div>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
              aria-label="Toggle dark mode"
            />
          </div>

          <button
            type="button"
            className="nav-item"
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              color: '#ef4444',
              marginTop: '2px',
            }}
            onClick={() => { onLogout(); if (onClose) onClose(); }}
          >
            <LogOut size={17} />
            <span className="label">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
