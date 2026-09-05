// frontend/src/components/Topbar.jsx
import React, { useState } from 'react';
import { Search, Bell, Crown, ChevronDown, User, LogOut, Settings as SettingsIcon, Instagram, Plus } from 'lucide-react';

export default function Topbar({
  user,
  account,
  accounts = [],
  onSelectAccount,
  onOpenConnect,
  onOpenUpgrade,
  onLogout,
  onSearch,
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const displayPlan = user?.plan === 'pro' ? 'Pro Plan' : 'Free Plan';
  const initial = (displayName.charAt(0) || 'U').toUpperCase();

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  return (
    <header className="topbar" style={{
      height: '68px',
      background: 'var(--bg-sidebar)',
      borderBottom: '1px solid var(--border-light)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Search Input (Centered / Left) */}
      <div style={{ position: 'relative', width: '380px' }}>
        <Search
          size={17}
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-light)',
          }}
        />
        <input
          type="text"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder="Search conversations, rules, or keywords..."
          style={{
            width: '100%',
            padding: '10px 65px 10px 40px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-subtle)',
            fontSize: '13px',
            color: 'var(--text-main)',
            outline: 'none',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--primary)';
            e.target.style.background = '#ffffff';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-subtle)';
            e.target.style.background = 'var(--bg-subtle)';
          }}
        />
        <span style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-light)',
          background: 'var(--bg-sidebar)',
          padding: '2px 6px',
          borderRadius: '6px',
          border: '1px solid var(--border-light)',
          pointerEvents: 'none',
        }}>
          ⌘K
        </span>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Account Selector / Switcher */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-main)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Instagram size={15} color="#e1306c" />
            <span>{account?.username ? `@${account.username}` : 'Connect Account'}</span>
            <ChevronDown size={13} color="var(--text-light)" />
          </button>

          {showAccountMenu && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: '230px',
              background: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
              border: '1px solid var(--border-light)',
              padding: '6px',
              zIndex: 100,
            }}>
              <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.05em' }}>
                INSTAGRAM ACCOUNTS
              </div>
              {accounts && accounts.length > 0 ? (
                accounts.map(acc => {
                  const isSelected = account?.id === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        if (onSelectAccount) onSelectAccount(acc.id);
                        setShowAccountMenu(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        border: 'none',
                        background: isSelected ? 'var(--bg-subtle)' : 'transparent',
                        color: 'var(--text-main)',
                        fontSize: '12.5px',
                        fontWeight: isSelected ? 700 : 500,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Instagram size={14} color={isSelected ? '#e1306c' : 'var(--text-muted)'} />
                        @{acc.username}
                      </span>
                      {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />}
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  No connected accounts
                </div>
              )}

              <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 0' }} />
              <button
                type="button"
                onClick={() => {
                  setShowAccountMenu(false);
                  if (onOpenConnect) onOpenConnect();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Plus size={14} /> Connect Another Account
              </button>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          style={{
            position: 'relative',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-sidebar)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onClick={() => alert('Notifications:\n• ReplyOS Engine is online\n• Webhook endpoints active\n• Connected account monitored')}
        >
          <Bell size={18} />
          <span style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#ef4444',
            border: '2px solid var(--bg-sidebar)',
          }} />
        </button>

        {/* Upgrade Pill Button */}
        <button
          type="button"
          onClick={onOpenUpgrade}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 88, 12, 0.15))',
            color: '#b45309',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'transform 0.15s',
          }}
        >
          <Crown size={15} color="#d97706" />
          <span>Upgrade</span>
        </button>

        {/* User Profile Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 10px',
              borderRadius: '12px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-sidebar)',
              cursor: 'pointer',
            }}
          >
            {/* Avatar D */}
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '14px',
            }}>
              {initial}
            </div>

            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {displayPlan}
              </div>
            </div>

            <ChevronDown size={14} color="var(--text-light)" />
          </button>

          {/* User Popover Menu */}
          {showUserMenu && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: '180px',
              background: 'var(--bg-sidebar)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              border: '1px solid var(--border-light)',
              padding: '6px',
              zIndex: 100,
            }}>
              <button
                type="button"
                onClick={() => { setShowUserMenu(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <User size={15} />
                <span>My Profile</span>
              </button>

              <button
                type="button"
                onClick={() => { setShowUserMenu(false); onOpenUpgrade(); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Crown size={15} color="#d97706" />
                <span>Billing & Plans</span>
              </button>

              <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />

              <button
                type="button"
                onClick={() => { setShowUserMenu(false); onLogout(); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'transparent',
                  color: '#ef4444',
                  fontSize: '13px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
