// frontend/src/components/Sidebar.jsx
import React from 'react';
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
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  onOpenUpgrade,
  onOpenConnect,
  onLogout,
  darkMode,
  setDarkMode,
  unreadCount = 12,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'connect', label: 'Connect Account', icon: Link2, action: onOpenConnect },
    { id: 'rules', label: 'Automation Rules', icon: Zap },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare, badge: unreadCount },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'simulator', label: 'Live Simulator', icon: PlayCircle },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-logo">
        <div className="logo-icon-wrap" style={{
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
          padding: '3px'
        }}>
          <img
            src="/logo-icon.png"
            alt="ReplyOS Icon"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div className="logo-text">
          <div className="name" style={{ display: 'flex', alignItems: 'center', fontSize: '18px', fontWeight: 900, letterSpacing: '-0.3px', lineHeight: 1.15 }}>
            <span style={{ color: 'var(--text-main)' }}>Reply</span>
            <span style={{ color: '#0066FF' }}>OS</span>
          </div>
          <div className="tagline" style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-light)', marginTop: '2px' }}>
            Automate Conversations
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="sidebar-nav">
        <div className="nav-section-title" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', padding: '8px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Menu
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else {
                  setActiveTab(item.id);
                }
              }}
              style={{
                width: '100%',
                border: 'none',
                background: isActive ? 'var(--primary-gradient)' : 'transparent',
                textAlign: 'left',
              }}
            >
              <Icon size={18} />
              <span className="label" style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? (
                <span className="nav-badge" style={{
                  background: isActive ? '#ffffff' : '#ef4444',
                  color: isActive ? 'var(--primary)' : '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Upgrade to Pro Box */}
      <div className="sidebar-upgrade-box" style={{
        margin: '12px 14px',
        padding: '16px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.12))',
        border: '1px solid rgba(99, 102, 241, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}>
            <Sparkles size={14} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
            Upgrade to Pro
          </span>
        </div>

        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 12px 0',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
        }}>
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
          onClick={onOpenUpgrade}
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
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Upgrade Now
        </button>
      </div>

      {/* Sidebar Footer Controls */}
      <div className="sidebar-footer" style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}>
        <button
          type="button"
          className="nav-item"
          style={{ width: '100%', border: 'none', background: 'transparent' }}
          onClick={() => alert('Need help? Contact support@replyos.com')}
        >
          <HelpCircle size={17} />
          <span className="label">Help & Support</span>
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: '10px',
          fontSize: '13px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {darkMode ? <Moon size={16} /> : <Sun size={16} />}
            <span>Dark Mode</span>
          </div>
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(e) => setDarkMode(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
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
          onClick={onLogout}
        >
          <LogOut size={17} />
          <span className="label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
