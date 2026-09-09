// frontend/src/components/MediaView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Film, 
  Image as ImageIcon, 
  Clock, 
  Zap, 
  RefreshCw, 
  ExternalLink, 
  Heart, 
  MessageCircle, 
  Search, 
  Plus, 
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';
import { apiFetch } from '../api/client';

export default function MediaView({ 
  account, 
  accounts = [], 
  onSelectAccount, 
  onAutomateMedia, 
  onOpenConnect 
}) {
  const [media, setMedia] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'reels' | 'posts' | 'stories'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'comments' | 'likes'
  const [error, setError] = useState(null);

  // Load initial media (top 30)
  const fetchMedia = useCallback(async (cursor = null, isLoadMore = false) => {
    if (!account?.id) return;
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const cursorParam = cursor ? `&after=${encodeURIComponent(cursor)}` : '';
      const res = await apiFetch(`/instagram/media?account_id=${account.id}&limit=30${cursorParam}`);
      if (!res.ok) throw new Error('Failed to load Instagram media');
      
      const data = await res.json();
      const newItems = data.media || [];
      
      if (isLoadMore) {
        setMedia(prev => [...prev, ...newItems]);
      } else {
        setMedia(newItems);
      }
      setNextCursor(data.paging?.cursors?.after || data.paging?.next_cursor || null);
    } catch (err) {
      console.error('Error fetching media:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [account?.id]);

  // Load active 24h stories
  const fetchStories = useCallback(async () => {
    if (!account?.id) return;
    try {
      const res = await apiFetch(`/instagram/stories?account_id=${account.id}`);
      if (res.ok) {
        const data = await res.json();
        setStories(data.stories || []);
      }
    } catch (e) {
      console.warn('Stories fetch warning:', e);
    }
  }, [account?.id]);

  useEffect(() => {
    fetchMedia();
    fetchStories();
  }, [fetchMedia, fetchStories]);

  const handleRefresh = () => {
    fetchMedia(null, false);
    fetchStories();
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchMedia(nextCursor, true);
    }
  };

  // Filter & Sort
  const currentList = activeTab === 'stories' ? stories : media;
  const filteredList = currentList.filter(item => {
    // Tab filter
    if (activeTab === 'reels') {
      const isReel = item.media_product_type === 'REELS' || item.media_type === 'VIDEO';
      if (!isReel) return false;
    } else if (activeTab === 'posts') {
      const isPost = item.media_product_type === 'FEED' || item.media_type === 'IMAGE' || item.media_type === 'CAROUSEL_ALBUM';
      if (!isPost) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cap = (item.caption || '').toLowerCase();
      if (!cap.includes(q)) return false;
    }
    return true;
  });

  // Sort
  filteredList.sort((a, b) => {
    if (sortBy === 'comments') return (b.comments_count || 0) - (a.comments_count || 0);
    if (sortBy === 'likes') return (b.like_count || 0) - (a.like_count || 0);
    // default recent
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });

  // Stats calculation
  const totalReels = media.filter(m => m.media_product_type === 'REELS' || m.media_type === 'VIDEO').length;
  const totalPosts = media.filter(m => m.media_product_type === 'FEED' || m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM').length;
  const activeAutomationsCount = media.filter(m => m.active_rules_count > 0).length + stories.filter(s => s.active_rules_count > 0).length;

  if (!account) {
    return (
      <div style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-light)',
          padding: '48px 24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            margin: '0 auto 20px',
          }}>
            <Film size={32} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px' }}>Connect Your Instagram Account</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 24px', fontSize: '14.5px' }}>
            To fetch your uploaded Reels, Posts, and Stories and set up automated comment replies, connect your Instagram account first.
          </p>
          <button 
            className="btn btn-primary"
            onClick={onOpenConnect}
            style={{ padding: '12px 28px', fontSize: '15px', fontWeight: 600 }}
          >
            Connect Instagram Account →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="media-view-container" style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
              Content & Media Hub
            </h1>
            <span style={{
              background: 'rgba(99, 102, 241, 0.1)',
              color: 'var(--primary)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '999px'
            }}>
              Top 30 + Pagination
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            Browse your uploaded Reels, Posts, and active Stories. Click <b>"Automate"</b> on any item to target it with instant comment replies & DMs.
          </p>
        </div>

        {/* Account Selector + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {accounts.length > 1 && (
            <select
              value={account?.id}
              onChange={(e) => onSelectAccount(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  @{acc.username || acc.full_name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Fetching...' : 'Sync Media'}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.25))',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Film size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Reels Uploaded</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{totalReels}</div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(236, 72, 153, 0.25))',
            color: '#ec4899',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ImageIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Feed Posts</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{totalPosts}</div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(6, 182, 212, 0.25))',
            color: '#06b6d4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Active 24h Stories</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{stories.length}</div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.25))',
            color: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Content with Active Rules</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#22c55e' }}>{activeAutomationsCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'var(--bg-card)',
        padding: '12px 18px',
        borderRadius: '16px',
        border: '1px solid var(--border-light)',
        marginBottom: '24px'
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Content', count: media.length },
            { id: 'reels', label: '🎬 Reels', count: totalReels },
            { id: 'posts', label: '📸 Feed Posts', count: totalPosts },
            { id: 'stories', label: '⏳ Stories (24h)', count: stories.length },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--border-light)',
                color: activeTab === tab.id ? '#fff' : 'var(--text-dim)',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '999px'
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1', maxWidth: '420px', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input 
              type="text" 
              placeholder="Search by caption..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-body)',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-body)',
              color: 'var(--text-main)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <option value="recent">Most Recent</option>
            <option value="comments">Most Comments</option>
            <option value="likes">Most Likes</option>
          </select>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          fontSize: '13.5px',
          fontWeight: 600,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} style={{
              height: '380px',
              borderRadius: '18px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              animation: 'pulse 1.5s infinite ease-in-out'
            }} />
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{
          padding: '60px 24px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-light)',
          color: 'var(--text-muted)'
        }}>
          <Film size={40} style={{ color: 'var(--text-dim)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
            No media found
          </h3>
          <p style={{ fontSize: '13.5px', maxWidth: '400px', margin: '0 auto' }}>
            {searchQuery ? 'No media matches your search query.' : 'No uploads found for this account filter.'}
          </p>
        </div>
      ) : (
        <>
          {/* Media Grid Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {filteredList.map((item) => {
              const isReel = item.media_product_type === 'REELS' || item.media_type === 'VIDEO';
              const isStory = activeTab === 'stories' || item.media_product_type === 'STORY';
              const hasRule = item.active_rules_count > 0;
              const primaryRule = item.active_rules?.[0];
              const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently';

              return (
                <div 
                  key={item.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '18px',
                    border: hasRule ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-light)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: hasRule ? '0 4px 20px rgba(99, 102, 241, 0.1)' : '0 2px 8px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = hasRule ? '0 4px 20px rgba(99, 102, 241, 0.1)' : '0 2px 8px rgba(0,0,0,0.03)';
                  }}
                >
                  {/* Thumbnail Container */}
                  <div style={{
                    position: 'relative',
                    height: isReel || isStory ? '260px' : '200px',
                    background: '#111827',
                    overflow: 'hidden'
                  }}>
                    <img 
                      src={item.thumbnail_url || item.media_url || `https://picsum.photos/seed/${item.id}/400/500`}
                      alt={item.caption || 'Instagram media'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      loading="lazy"
                    />

                    {/* Media Type Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(8px)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isReel ? <Film size={12} color="#ec4899" /> : (isStory ? <Clock size={12} color="#06b6d4" /> : <ImageIcon size={12} color="#818cf8" />)}
                      <span>{isReel ? 'REEL' : (isStory ? 'STORY' : 'FEED POST')}</span>
                    </div>

                    {/* Permlink External Button */}
                    {item.permalink && (
                      <a
                        href={item.permalink}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: 'rgba(0, 0, 0, 0.65)',
                          backdropFilter: 'blur(8px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          textDecoration: 'none'
                        }}
                        title="Open on Instagram"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}

                    {/* Active Rule Indicator Tag on Thumbnail */}
                    {hasRule && (
                      <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '10px',
                        right: '10px',
                        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.95), rgba(236, 72, 153, 0.95))',
                        backdropFilter: 'blur(6px)',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                          <Zap size={13} fill="#ffffff" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Keyword: <b>"{primaryRule.trigger_keyword}"</b>
                          </span>
                        </div>
                        <span style={{ fontSize: '10.5px', background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '4px' }}>
                          Active
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    {/* Metrics Strip */}
                    {!isStory && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        marginBottom: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Heart size={13} color="#ec4899" />
                            {item.like_count || 0}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MessageCircle size={13} color="#818cf8" />
                            {item.comments_count || 0}
                          </span>
                        </div>
                        <span>{dateStr}</span>
                      </div>
                    )}

                    {/* Caption Preview */}
                    <div style={{
                      fontSize: '13px',
                      lineHeight: '1.45',
                      color: 'var(--text-main)',
                      marginBottom: '16px',
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {item.caption || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No caption provided</span>}
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => onAutomateMedia(item)}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: hasRule ? 'rgba(99, 102, 241, 0.1)' : 'var(--primary)',
                        color: hasRule ? 'var(--primary)' : '#ffffff',
                        border: hasRule ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
                      }}
                    >
                      <Zap size={14} fill={hasRule ? 'none' : '#ffffff'} />
                      <span>{hasRule ? 'Configure / Add Rule' : (isReel ? 'Automate this Reel ⚡' : 'Set Automation ⚡')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Pagination Button */}
          {nextCursor && (
            <div style={{ textAlign: 'center', margin: '24px 0 40px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  padding: '12px 32px',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
                }}
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={15} className="spin" />
                    Fetching Next 30 Items...
                  </>
                ) : (
                  <>
                    Load More Media (Next 30) <ArrowRight size={15} />
                  </>
                )}
              </button>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px' }}>
                Showing {filteredList.length} items from your Instagram account
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
