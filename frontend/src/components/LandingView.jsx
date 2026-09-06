// frontend/src/components/LandingView.jsx
import React, { useState, useEffect, useRef } from 'react';
import '../styles/landing.css';

export default function LandingView({ onNavigate, user }) {
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const heroCanvasRef = useRef(null);
  const vizCanvasRef = useRef(null);
  const ctaCanvasRef = useRef(null);

  const cursorDotRef = useRef(null);
  const cursorOutlineRef = useRef(null);

  // Scroll detection for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Custom Cursor
  useEffect(() => {
    const dot = cursorDotRef.current;
    const outline = cursorOutlineRef.current;
    if (!dot || !outline) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let outlineX = mouseX;
    let outlineY = mouseY;
    let animationFrameId;

    const onMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
    };

    const animateOutline = () => {
      outlineX += (mouseX - outlineX) * 0.2;
      outlineY += (mouseY - outlineY) * 0.2;
      outline.style.left = `${outlineX}px`;
      outline.style.top = `${outlineY}px`;
      animationFrameId = requestAnimationFrame(animateOutline);
    };

    const onMouseEnterInteractive = () => outline.classList.add('hover');
    const onMouseLeaveInteractive = () => outline.classList.remove('hover');

    window.addEventListener('mousemove', onMouseMove);
    animationFrameId = requestAnimationFrame(animateOutline);

    const interactiveElements = document.querySelectorAll('.replyos-landing button, .replyos-landing a, .replyos-landing .feature-card, .replyos-landing .pricing-card');
    interactiveElements.forEach((el) => {
      el.addEventListener('mouseenter', onMouseEnterInteractive);
      el.addEventListener('mouseleave', onMouseLeaveInteractive);
    });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
      interactiveElements.forEach((el) => {
        el.removeEventListener('mouseenter', onMouseEnterInteractive);
        el.removeEventListener('mouseleave', onMouseLeaveInteractive);
      });
    };
  }, []);

  // Three.js Smoothie Blob initialization (Ultra-optimized)
  useEffect(() => {
    const cleanupFns = [];

    const startThree = () => {
      if (!window.THREE) return;
      const THREE = window.THREE;

      const initBlob = (container, color1, color2, color3) => {
        if (!container) return;

        const width = container.offsetWidth || 400;
        const height = container.offsetHeight || 400;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        container.appendChild(renderer.domElement);

        // High-performance organic blob (Detail 12 gives ~720 vertices vs 40,000 in 64)
        const geometry = new THREE.IcosahedronGeometry(2, 12);
        const positions = geometry.attributes.position;
        const originalPositions = positions.array.slice();

        const material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color1),
          emissive: new THREE.Color(color2),
          emissiveIntensity: 0.2,
          metalness: 0.1,
          roughness: 0.2,
          clearcoat: 0.8,
          clearcoatRoughness: 0.1,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // Inner glow
        const glowGeometry = new THREE.IcosahedronGeometry(1.5, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color3),
          transparent: true,
          opacity: 0.15,
        });
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        scene.add(glowMesh);

        // Ambient particles
        const particleCount = 28;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i++) {
          particlePositions[i] = (Math.random() - 0.5) * 8;
        }
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

        const particleMaterial = new THREE.PointsMaterial({
          color: new THREE.Color(color1),
          size: 0.05,
          transparent: true,
          opacity: 0.5,
        });

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        const pointLight = new THREE.PointLight(color2, 1.8, 10);
        pointLight.position.set(-3, 2, 3);
        scene.add(pointLight);

        camera.position.z = 5;

        let time = 0;
        let isVisible = true;
        let animId = null;
        let lastTime = performance.now();

        const animate = () => {
          if (!isVisible) {
            animId = null;
            return;
          }
          animId = requestAnimationFrame(animate);
          const now = performance.now();
          const delta = (now - lastTime) * 0.001;
          lastTime = now;
          time += delta;

          // Vertex displacement on lightweight mesh
          const pos = geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const x = originalPositions[i * 3];
            const y = originalPositions[i * 3 + 1];
            const z = originalPositions[i * 3 + 2];
            const noise = Math.sin(x * 2 + time) * Math.cos(y * 2 + time * 0.8) * Math.sin(z * 2 + time * 1.2);
            const distortion = 1 + noise * 0.14;
            pos.setXYZ(i, x * distortion, y * distortion, z * distortion);
          }
          pos.needsUpdate = true;
          geometry.computeVertexNormals();

          mesh.rotation.y += delta * 0.2;
          mesh.rotation.x += delta * 0.1;
          glowMesh.rotation.y -= delta * 0.15;

          particles.rotation.y += delta * 0.04;

          renderer.render(scene, camera);
        };

        // Viewport intersection observer to pause WebGL when off-screen
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            isVisible = entry.isIntersecting;
            if (isVisible && !animId) {
              lastTime = performance.now();
              animate();
            }
          });
        }, { threshold: 0.05 });
        observer.observe(container);

        animate();

        const onResize = () => {
          if (!container) return;
          const w = container.offsetWidth;
          const h = container.offsetHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };

        window.addEventListener('resize', onResize);

        const onMouseMove = (e) => {
          if (!isVisible) return;
          const rect = container.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
          const my = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
          mesh.rotation.x = my * 0.25;
          mesh.rotation.y = mx * 0.25;
        };
        container.addEventListener('mousemove', onMouseMove);

        cleanupFns.push(() => {
          if (animId) cancelAnimationFrame(animId);
          observer.disconnect();
          window.removeEventListener('resize', onResize);
          container.removeEventListener('mousemove', onMouseMove);
          if (renderer.domElement && renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
          }
          geometry.dispose();
          material.dispose();
          glowGeometry.dispose();
          glowMaterial.dispose();
          particleGeometry.dispose();
          particleMaterial.dispose();
          renderer.dispose();
        });
      };

      // Helper for lazy loading off-screen canvases on demand
      const lazyInit = (container, c1, c2, c3) => {
        if (!container) return;
        const lazyObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            initBlob(container, c1, c2, c3);
            lazyObserver.disconnect();
          }
        }, { rootMargin: '300px' });
        lazyObserver.observe(container);
        cleanupFns.push(() => lazyObserver.disconnect());
      };

      // Hero Blob initializes immediately
      initBlob(heroCanvasRef.current, '#4F6AF6', '#8B5CF6', '#06B6D4');
      // Viz and CTA blobs load lazily when user scrolls
      lazyInit(vizCanvasRef.current, '#EC4899', '#8B5CF6', '#4F6AF6');
      lazyInit(ctaCanvasRef.current, '#06B6D4', '#4F6AF6', '#8B5CF6');
    };

    if (window.THREE) {
      startThree();
    } else {
      const timer = setInterval(() => {
        if (window.THREE) {
          clearInterval(timer);
          startThree();
        }
      }, 50);
      cleanupFns.push(() => clearInterval(timer));
    }

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  // GSAP Scroll Animations (Optimized for instant perceived load)
  useEffect(() => {
    let ctx;
    const startGsap = () => {
      if (!window.gsap || !window.ScrollTrigger) return;
      const gsap = window.gsap;
      const ScrollTrigger = window.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        // Fast, snappy hero entrance (sub-500ms total)
        gsap.from('.replyos-landing .hero-badge', { opacity: 0.2, y: 15, duration: 0.35, delay: 0.05, ease: 'power2.out' });
        gsap.from('.replyos-landing .title-line', { opacity: 0.2, y: 20, duration: 0.45, stagger: 0.06, delay: 0.08, ease: 'power2.out' });
        gsap.from('.replyos-landing .hero-subtitle', { opacity: 0.2, y: 15, duration: 0.35, delay: 0.15, ease: 'power2.out' });
        gsap.from('.replyos-landing .hero-buttons', { opacity: 0.2, y: 15, duration: 0.35, delay: 0.2, ease: 'power2.out' });
        gsap.from('.replyos-landing .hero-trust', { opacity: 0.2, y: 12, duration: 0.35, delay: 0.25, ease: 'power2.out' });
        gsap.from('.replyos-landing .dashboard-mockup', { opacity: 0.2, x: 30, duration: 0.5, delay: 0.15, ease: 'power2.out' });
        gsap.from('.replyos-landing .floating-card', { opacity: 0.2, scale: 0.9, duration: 0.35, stagger: 0.1, delay: 0.25, ease: 'back.out(1.5)' });

        // Features scroll trigger
        gsap.from('.replyos-landing .features-header', {
          scrollTrigger: { trigger: '.replyos-landing .features', start: 'top 85%' },
          opacity: 0.3, y: 25, duration: 0.4,
        });
        gsap.from('.replyos-landing .feature-flow .flow-card', {
          scrollTrigger: { trigger: '.replyos-landing .feature-flow', start: 'top 85%' },
          opacity: 0.3, x: -25, duration: 0.35, stagger: 0.1,
        });
        gsap.from('.replyos-landing .feature-card', {
          scrollTrigger: { trigger: '.replyos-landing .features-grid', start: 'top 90%' },
          opacity: 0.3, y: 25, duration: 0.35, stagger: 0.08,
        });

        // Workflow trigger
        gsap.from('.replyos-landing .workflow-grid', {
          scrollTrigger: { trigger: '.replyos-landing .workflow', start: 'top 80%' },
          opacity: 0.3, y: 25, duration: 0.4,
        });

        // Testimonials trigger
        gsap.from('.replyos-landing .testimonials-grid', {
          scrollTrigger: { trigger: '.replyos-landing .testimonials', start: 'top 85%' },
          opacity: 0.3, y: 20, duration: 0.35, stagger: 0.08,
        });

        // Founder Note trigger
        gsap.from('.replyos-landing .founder-card', {
          scrollTrigger: { trigger: '.replyos-landing .founder-section', start: 'top 85%' },
          opacity: 0.3, y: 25, duration: 0.45, ease: 'power2.out',
        });

        // Pricing trigger
        gsap.from('.replyos-landing .pricing-card', {
          scrollTrigger: { trigger: '.replyos-landing .pricing-grid', start: 'top 90%' },
          opacity: 0.3, y: 25, duration: 0.35, stagger: 0.08,
        });
      });
    };

    if (window.gsap && window.ScrollTrigger) {
      startGsap();
    } else {
      const timer = setInterval(() => {
        if (window.gsap && window.ScrollTrigger) {
          clearInterval(timer);
          startGsap();
        }
      }, 50);
      return () => clearInterval(timer);
    }

    return () => {
      if (ctx) ctx.revert();
    };
  }, []);

  // Keyboard escape for video modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isVideoModalOpen) {
        setIsVideoModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoModalOpen]);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="replyos-landing">
      {/* Custom Cursor */}
      <div className="landing-cursor-dot" ref={cursorDotRef} />
      <div className="landing-cursor-outline" ref={cursorOutlineRef} />

      {/* Navbar */}
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <a href="#" className="logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#0A0A0A" />
              <path d="M12 24L24 12M24 12H16M24 12V20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>Reply<span className="logo-accent">OS</span></span>
          </a>

          <div className="nav-links">
            <button className="nav-link" onClick={() => scrollToSection('features')}>Product</button>
            <button className="nav-link" onClick={() => scrollToSection('workflow')}>Solutions</button>
            <button className="nav-link" onClick={() => scrollToSection('pricing')}>Pricing</button>
            <button className="nav-link" onClick={() => scrollToSection('testimonials')}>Stories</button>
            <button className="nav-link" onClick={() => scrollToSection('founder')}>Founder's Note</button>
          </div>

          <div className="nav-actions">
            {user ? (
              <button
                className="btn btn-primary"
                onClick={() => onNavigate('app')}
              >
                Dashboard →
              </button>
            ) : (
              <>
                <button
                  className="nav-link"
                  onClick={() => onNavigate('auth-login')}
                  style={{ fontWeight: 600 }}
                >
                  Log in
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => onNavigate('auth-signup')}
                >
                  Start free →
                </button>
              </>
            )}
          </div>

          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'active' : ''}`}>
        <button className="mobile-link" onClick={() => scrollToSection('features')}>Product</button>
        <button className="mobile-link" onClick={() => scrollToSection('workflow')}>Solutions</button>
        <button className="mobile-link" onClick={() => scrollToSection('pricing')}>Pricing</button>
        <button className="mobile-link" onClick={() => scrollToSection('testimonials')}>Stories</button>
        <button className="mobile-link" onClick={() => scrollToSection('founder')}>Founder's Note</button>
        {user ? (
          <button className="btn btn-primary btn-full" onClick={() => onNavigate('app')}>
            Go to Dashboard →
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-outline btn-full" onClick={() => onNavigate('auth-login')}>
              Log in
            </button>
            <button className="btn btn-primary btn-full" onClick={() => onNavigate('auth-signup')}>
              Start free →
            </button>
          </div>
        )}
      </div>

      {/* Hero Section */}
      <section className="hero" id="hero">
        <div id="hero-canvas-container" ref={heroCanvasRef} />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot" />
            #1 Instagram Automation Platform
          </div>
          <h1 className="hero-title">
            <span className="title-line">Conversations</span>
            <span className="title-line">create <span className="gradient-text">opportunities.</span></span>
          </h1>
          <p className="hero-subtitle">
            ReplyOS helps you automatically reply to Instagram comments and DMs, nurture your audience, and turn engagement into real business growth.
          </p>
          <div className="hero-buttons">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => onNavigate(user ? 'app' : 'auth-signup')}
            >
              {user ? 'Go to Dashboard →' : 'Start for free →'}
            </button>
            <button className="btn btn-video btn-lg" onClick={() => setIsVideoModalOpen(true)}>
              <span className="play-icon">▶</span> Watch video
            </button>
          </div>
          <div className="hero-trust">
            <span>✓ No credit card required</span>
            <span>✓ Setup in 2 minutes</span>
            <span>✓ Loved by 10K+ creators</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="dashboard-mockup">
            <div className="mockup-header">
              <div className="mockup-dots"><span /><span /><span /></div>
              <div className="mockup-title">ReplyOS Dashboard</div>
            </div>
            <div className="mockup-body">
              <div className="mockup-sidebar">
                <div className="sidebar-item active">◆</div>
                <div className="sidebar-item">✉</div>
                <div className="sidebar-item">⚡</div>
                <div className="sidebar-item">📊</div>
                <div className="sidebar-item">⚙</div>
              </div>
              <div className="mockup-main">
                <div className="mockup-greeting">Good morning, Alex 👋</div>
                <div className="mockup-stats">
                  <div className="stat-card">
                    <div className="stat-label">Total Replies</div>
                    <div className="stat-value">1,248</div>
                    <div className="stat-change positive">+12%</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Engagement</div>
                    <div className="stat-value">892</div>
                    <div className="stat-change positive">+8%</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">New Followers</div>
                    <div className="stat-value">520</div>
                    <div className="stat-change positive">+24%</div>
                  </div>
                </div>
                <div className="mockup-chart">
                  <div className="chart-title">Engagement Growth</div>
                  <div className="chart-bars">
                    <div className="chart-bar" style={{ height: '40%' }} />
                    <div className="chart-bar" style={{ height: '55%' }} />
                    <div className="chart-bar" style={{ height: '45%' }} />
                    <div className="chart-bar" style={{ height: '70%' }} />
                    <div className="chart-bar" style={{ height: '60%' }} />
                    <div className="chart-bar" style={{ height: '85%' }} />
                    <div className="chart-bar active" style={{ height: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="floating-card card-1">
            <div className="fc-icon">📈</div>
            <div className="fc-text">
              <div className="fc-label">Growth</div>
              <div className="fc-value">+247%</div>
            </div>
          </div>

          <div className="floating-card card-2">
            <div className="fc-avatars">
              <div className="fc-avatar">A</div>
              <div className="fc-avatar">B</div>
              <div className="fc-avatar">C</div>
            </div>
            <div className="fc-text">
              <div className="fc-label">Active Now</div>
              <div className="fc-value">1,234</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Ticker */}
      <section className="trusted-by">
        <div className="container">
          <p className="trusted-label">Trusted by creators, brands and agencies</p>
          <div className="logos-track">
            {['Zomato', 'Boat', 'Mamaearth', 'Noise', 'The Derma Co', 'Sugar', 'MensXP', 'Zomato', 'Boat', 'Mamaearth', 'Noise', 'The Derma Co', 'Sugar', 'MensXP'].map((brand, i) => (
              <div className="logo-item" key={i}>{brand}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <div className="container">
          <div className="features-header">
            <div className="section-badge">✨ Everything you need</div>
            <h2 className="section-title">More than just<br /><span className="gradient-text">auto replies.</span></h2>
            <p className="section-subtitle">A complete toolkit to turn Instagram engagement into measurable results.</p>
            <button className="btn btn-dark" onClick={() => scrollToSection('workflow')}>
              Explore features →
            </button>
          </div>

          <div className="features-showcase">
            <div className="feature-flow">
              <div className="flow-card flow-trigger">
                <div className="flow-icon insta">📷</div>
                <div className="flow-content">
                  <div className="flow-title">New comment</div>
                  <div className="flow-text">"Price?"</div>
                  <div className="flow-time">2m ago</div>
                </div>
              </div>
              <div className="flow-arrow">↓</div>
              <div className="flow-card flow-ai">
                <div className="flow-icon ai">🧠</div>
                <div className="flow-content">
                  <div className="flow-title">AI analyzes intent</div>
                  <div className="flow-text">Detects keyword: price</div>
                </div>
              </div>
              <div className="flow-arrow">↓</div>
              <div className="flow-card flow-action">
                <div className="flow-icon send">✈</div>
                <div className="flow-content">
                  <div className="flow-title">Sends personalized DM</div>
                  <div className="flow-text">"Here's the link with 20% off!"</div>
                </div>
              </div>
            </div>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrap">💬</div>
              <h3 className="feature-title">Comment to DM</h3>
              <p className="feature-desc">Automatically reply to comments with personalized DMs. Turn every public comment into a private conversion.</p>
              <button className="feature-link" onClick={() => scrollToSection('workflow')}>Learn more →</button>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">⚡</div>
              <h3 className="feature-title">Smart Automations</h3>
              <p className="feature-desc">Use keyword triggers, AI sentiment, and custom business rules to trigger the right reply at the right moment.</p>
              <button className="feature-link" onClick={() => scrollToSection('workflow')}>Learn more →</button>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">📥</div>
              <h3 className="feature-title">Unified Inbox</h3>
              <p className="feature-desc">Manage all your Instagram DMs and comment threads in one ultra-fast inbox. Never miss a buyer.</p>
              <button className="feature-link" onClick={() => scrollToSection('workflow')}>Learn more →</button>
            </div>
            <div className="feature-card">
              <div className="feature-icon-wrap">📊</div>
              <h3 className="feature-title">Advanced Analytics</h3>
              <p className="feature-desc">Track engagement response rate, conversion ROI, and follower growth with real-time graphs and reports.</p>
              <button className="feature-link" onClick={() => scrollToSection('workflow')}>Learn more →</button>
            </div>
          </div>
        </div>
      </section>

      {/* 3D Viz Section */}
      <section className="viz-section" id="vizSection">
        <div id="viz-canvas-container" ref={vizCanvasRef} />
        <div className="viz-content">
          <div className="container">
            <div className="viz-text">
              <div className="section-badge dark">🎲 3D Experience</div>
              <h2 className="section-title light">See your growth<br />in a new dimension.</h2>
              <p className="section-subtitle light">
                Interactive 3D visualizations that bring your engagement data to life. Smooth, fluid, and state of the art.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Workflow Builder */}
      <section className="workflow" id="workflow">
        <div className="container">
          <div className="workflow-grid">
            <div className="workflow-text">
              <div className="section-badge dark">🌿 Visual Automation Builder</div>
              <h2 className="section-title light">Build workflows<br />without limits.</h2>
              <p className="section-subtitle light">Create multi-step automations with our visual rule engine. No code required. Set up in 2 minutes.</p>
              <ul className="workflow-list">
                <li>✓ Keyword-based comment triggers</li>
                <li>✓ AI-powered contextual smart replies</li>
                <li>✓ Follower verification & conditional filters</li>
                <li>✓ Easy to monitor, modify, and pause anytime</li>
              </ul>
              <button
                className="btn btn-light"
                onClick={() => onNavigate(user ? 'app' : 'auth-signup')}
              >
                Try the builder →
              </button>
            </div>

            <div className="workflow-visual">
              <div className="builder-mockup">
                <div className="builder-header">
                  <div className="builder-title">Product Inquiry Flow</div>
                  <div className="builder-actions">
                    <button className="builder-btn">Save</button>
                    <button className="builder-btn primary">Publish</button>
                  </div>
                </div>
                <div className="builder-canvas">
                  <div className="node node-trigger">
                    <div className="node-icon">📷</div>
                    <div className="node-text">Comment contains "price" or "link"</div>
                  </div>
                  <div className="node-connector" />
                  <div className="node node-action">
                    <div className="node-icon">✈</div>
                    <div className="node-text">Send DM<br />"Here's your special link!"</div>
                  </div>
                  <div className="node-connector" />
                  <div className="node node-delay">
                    <div className="node-icon">🕐</div>
                    <div className="node-text">Wait 1 day</div>
                  </div>
                  <div className="node-connector" />
                  <div className="node node-followup">
                    <div className="node-icon">🔄</div>
                    <div className="node-text">Follow up<br />"Did you have any questions?"</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials" id="testimonials">
        <div className="container">
          <div className="testimonials-header">
            <h2 className="section-title">Real creators.<br />Real results.</h2>
            <p className="section-subtitle">Creators, brands, and agencies use ReplyOS to save hours and grow 10x faster.</p>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card featured">
              <div className="testimonial-quote">
                <p>
                  "ReplyOS completely changed how we handle Instagram engagement. What used to take hours every day now happens automatically. Our response time dropped from 4 hours to under 30 seconds."
                </p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">SM</div>
                <div className="author-info">
                  <div className="author-name">Sarah Mitchell</div>
                  <div className="author-role">Growth Lead, StudioX</div>
                </div>
                <div className="author-rating">★★★★★</div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-visual">
                <div>
                  <div className="viz-big">3x</div>
                  <div className="viz-small">More Conversations & Sales</div>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-quote">
                <p>"We saw a 340% increase in DM conversions within the first month. The AI understands intent better than any tool we've tried."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">JK</div>
                <div className="author-info">
                  <div className="author-name">James Kim</div>
                  <div className="author-role">Founder, BrandScale</div>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-quote">
                <p>"The visual workflow builder is incredibly intuitive. I built our entire customer onboarding journey in under 10 minutes without coding."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">EP</div>
                <div className="author-info">
                  <div className="author-name">Elena Perez</div>
                  <div className="author-role">Marketing Director, Luxe Co</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder & Developer Note */}
      <section className="founder-section" id="founder">
        <div className="founder-glow-bg" />
        <div className="container">
          <div className="founder-card">
            <div className="founder-visual">
              <div className="founder-img-wrapper">
                <img
                  src="/founder.jpg"
                  alt="Sumit Bhardwaj - Founder & Lead Architect"
                  className="founder-img"
                  loading="lazy"
                />
                <div className="founder-img-overlay" />
                <div className="founder-img-caption">
                  <div className="founder-img-name">
                    Sumit Bhardwaj
                    <span className="founder-verified-badge">✓ Founder</span>
                  </div>
                  <div className="founder-img-role">Creator & Lead Architect, ReplyOS</div>
                </div>
              </div>

              {/* Floating feature pills */}
              <div className="founder-badge-floating top-right">
                <span>🛡️</span>
                <span>100% Meta Official API</span>
              </div>
              <div className="founder-badge-floating bottom-left">
                <span>⚡</span>
                <span>Sub-Second Response Engine</span>
              </div>
            </div>

            <div className="founder-note-content">
              <div className="section-badge" style={{ alignSelf: 'flex-start', marginBottom: '16px' }}>
                👋 Founder & Developer's Note
              </div>
              <div className="founder-quote-mark">“</div>
              <h2 className="founder-heading">
                We built ReplyOS because slow DMs kill high-intent leads.
              </h2>

              <div className="founder-letter">
                <p>
                  Every creator and brand owner knows the feeling: you post a high-effort Reel or run an ad, and comments flood in with <em>"Link please!"</em> or <em>"How much?"</em>. If you don't reply within 90 seconds, that buyer has already closed Instagram and moved on.
                </p>
                <p>
                  Doing this manually means gluing yourself to your screen 18 hours a day. And the third-party tools out there? Clunky, unreliable, or worse — using unofficial web-scraping hacks that put your Instagram account at risk of shadowbans and suspensions.
                </p>
                <p>
                  I engineered <strong>ReplyOS</strong> to solve this with zero compromises: <strong>100% compliant with Meta's official Graph API</strong>, armed with bulletproof AES-256 token encryption, and an ultra-fast event queue that delivers your message before the user even exits your post.
                </p>
              </div>

              <div className="founder-pillars">
                <div className="pillar-item">
                  <div className="pillar-icon">🔒</div>
                  <div className="pillar-title">100% Safe & Compliant</div>
                  <div className="pillar-desc">Only official Meta webhooks. Zero scraping, zero password sharing, zero shadowban risk.</div>
                </div>
                <div className="pillar-item">
                  <div className="pillar-icon">⚡</div>
                  <div className="pillar-title">Instant Sub-Second DMs</div>
                  <div className="pillar-desc">Delivers links, discounts, and personalized replies in under 2 seconds while intent is peak.</div>
                </div>
                <div className="pillar-item">
                  <div className="pillar-icon">🤝</div>
                  <div className="pillar-title">Direct Founder Access</div>
                  <div className="pillar-desc">Built for creators by an engineer. Have an idea or need custom help? You talk to me directly.</div>
                </div>
              </div>

              <div className="founder-footer">
                <div className="founder-signoff">
                  <div className="founder-sign-name">Sumit Bhardwaj</div>
                  <div className="founder-sign-title">Founder & Lead Engineer, ReplyOS</div>
                </div>

                <div className="founder-actions">
                  <a
                    href="mailto:sumitbhardwaj2227@gmail.com?subject=ReplyOS%20Founder%20Inquiry"
                    className="btn-founder-contact"
                  >
                    ✉️ Email Founder
                  </a>
                  <button
                    className="btn btn-primary"
                    onClick={() => onNavigate(user ? 'app' : 'auth-signup')}
                  >
                    {user ? 'Open Dashboard →' : 'Start Free Today →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing" id="pricing">
        <div className="container">
          <div className="pricing-header">
            <h2 className="section-title">Choose the plan<br />that fits your growth.</h2>
            <p className="section-subtitle">Start free and scale as your audience expands.</p>

            <div className="pricing-toggle">
              <button
                className={`toggle-btn ${billingPeriod === 'monthly' ? 'active' : ''}`}
                onClick={() => setBillingPeriod('monthly')}
              >
                Monthly
              </button>
              <button
                className={`toggle-btn ${billingPeriod === 'yearly' ? 'active' : ''}`}
                onClick={() => setBillingPeriod('yearly')}
              >
                Yearly <span className="save-badge">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="pricing-grid">
            {/* Starter */}
            <div className="pricing-card">
              <div className="pricing-name">Starter</div>
              <div className="pricing-price">
                <span className="currency">$</span>
                <span className="amount">0</span>
                <span className="period">/month</span>
              </div>
              <ul className="pricing-features">
                <li>✓ 1 Instagram account</li>
                <li>✓ 500 automated replies/mo</li>
                <li>✓ Comment to DM triggers</li>
                <li>✓ Standard speed delivery</li>
                <li>✓ Community support</li>
              </ul>
              <button
                className="btn btn-outline btn-full"
                onClick={() => onNavigate(user ? 'app' : 'auth-signup')}
              >
                Get started free
              </button>
            </div>

            {/* Pro */}
            <div className="pricing-card popular">
              <div className="popular-badge">Most popular</div>
              <div className="pricing-name">Pro</div>
              <div className="pricing-price">
                <span className="currency">$</span>
                <span className="amount">{billingPeriod === 'yearly' ? '23' : '29'}</span>
                <span className="period">/month</span>
              </div>
              <ul className="pricing-features">
                <li>✓ 3 Instagram accounts</li>
                <li>✓ 10,000 automated replies/mo</li>
                <li>✓ AI intent detection & multi-rules</li>
                <li>✓ Full unified inbox & real profiles</li>
                <li>✓ Priority queue delivery</li>
              </ul>
              <button
                className="btn btn-primary btn-full"
                onClick={() => onNavigate(user ? 'app' : 'auth-signup')}
              >
                Start free trial
              </button>
            </div>

            {/* Business */}
            <div className="pricing-card">
              <div className="pricing-name">Business</div>
              <div className="pricing-price">
                <span className="currency">$</span>
                <span className="amount">{billingPeriod === 'yearly' ? '79' : '99'}</span>
                <span className="period">/month</span>
              </div>
              <ul className="pricing-features">
                <li>✓ Unlimited Instagram accounts</li>
                <li>✓ Unlimited automated replies</li>
                <li>✓ Custom AI tone & multi-step flows</li>
                <li>✓ Advanced analytics & webhooks</li>
                <li>✓ Dedicated account manager</li>
              </ul>
              <button
                className="btn btn-outline btn-full"
                onClick={() => onNavigate(user ? 'app' : 'auth-signup')}
              >
                Get Business
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="cta">
        <div id="cta-canvas-container" ref={ctaCanvasRef} />
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to turn<br />engagement into growth?</h2>
            <p className="cta-subtitle">Join 10,000+ creators and brands automating with ReplyOS.</p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => onNavigate(user ? 'app' : 'auth-signup')}
            >
              {user ? 'Open Dashboard →' : 'Start for free →'}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="#" className="logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <rect width="36" height="36" rx="10" fill="#0A0A0F" />
                  <path d="M12 24L24 12M24 12H16M24 12V20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span>Reply<span className="logo-accent">OS</span></span>
              </a>
              <p className="footer-tagline">Automate conversations.<br />Accelerate growth.</p>
            </div>

            <div className="footer-links">
              <div className="footer-col">
                <h4>Product</h4>
                <button onClick={() => scrollToSection('features')}>Features</button>
                <button onClick={() => scrollToSection('workflow')}>Automations</button>
                <button onClick={() => scrollToSection('pricing')}>Pricing</button>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('hero'); }}>About</a>
                <button onClick={() => scrollToSection('founder')}>Founder's Note</button>
                <a href="mailto:support@replyos.io">Contact</a>
                <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
              </div>
              <div className="footer-col">
                <h4>Resources</h4>
                <button onClick={() => setIsVideoModalOpen(true)}>Demo Video</button>
                <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
                <a href="/data-deletion" target="_blank" rel="noreferrer">Data Deletion</a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} ReplyOS. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      {isVideoModalOpen && (
        <div
          className="landing-video-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsVideoModalOpen(false);
          }}
        >
          <div className="landing-video-dialog">
            <button
              className="landing-video-close"
              onClick={() => setIsVideoModalOpen(false)}
            >
              ✕
            </button>
            <div className="landing-video-container">
              <iframe
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"
                title="ReplyOS Product Demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
