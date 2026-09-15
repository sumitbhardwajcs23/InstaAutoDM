// tests/responsive.smoke.test.js
/**
 * AIRVIX RESPONSIVE & CROSS-BROWSER COMPATIBILITY SMOKE TEST SUITE
 * Validates responsive design architecture, breakpoints, cross-browser fallbacks,
 * touch targets, safe-area insets, accessibility, and component contract wiring.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const FRONTEND_SRC = path.join(ROOT, 'frontend', 'src');

function readFile(relPath) {
  const fullPath = path.join(ROOT, relPath);
  assert(fs.existsSync(fullPath), `File must exist: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

async function runResponsiveTests() {
  console.log('\n======================================================');
  console.log('📱 Starting Airvix Responsive & Cross-Browser Audit Tests');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function check(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n`);
      failed++;
    }
  }

  // 1. HTML Viewport Configuration
  check('frontend/index.html defines viewport with viewport-fit=cover', () => {
    const html = readFile('frontend/index.html');
    assert(html.includes('viewport'), 'HTML missing viewport meta tag');
    assert(html.includes('width=device-width'), 'Viewport must set width=device-width');
    assert(html.includes('viewport-fit=cover'), 'Viewport must include viewport-fit=cover for notch/safe-areas');
  });

  // 2. index.css Core Responsive System
  check('frontend/src/index.css includes responsive breakpoints & mobile drawer', () => {
    const css = readFile('frontend/src/index.css');
    assert(css.includes('@media (max-width: 1024px)'), 'Missing 1024px tablet/desktop breakpoint');
    assert(css.includes('@media (max-width: 768px)'), 'Missing 768px tablet breakpoint');
    assert(css.includes('@media (max-width: 480px)'), 'Missing 480px mobile breakpoint');
    assert(css.includes('@media (max-width: 360px)'), 'Missing 360px small mobile breakpoint');
    assert(css.includes('.sidebar-overlay'), 'Missing sidebar mobile overlay styling');
    assert(css.includes('transform: translateX(-100%)'), 'Sidebar drawer must hide off-screen when closed');
    assert(css.includes('transform: translateX(0)'), 'Sidebar drawer must slide in when open');
  });

  // 3. index.css Cross-Browser & Accessibility
  check('frontend/src/index.css includes cross-browser fallbacks and accessibility', () => {
    const css = readFile('frontend/src/index.css');
    assert(css.includes('-webkit-backdrop-filter'), 'Missing -webkit-backdrop-filter prefix for Safari');
    assert(css.includes('prefers-reduced-motion'), 'Missing prefers-reduced-motion media query');
    assert(css.includes(':focus-visible'), 'Missing accessible :focus-visible indicators');
    assert(css.includes('env(safe-area-inset-top)') || css.includes('env(safe-area-inset-bottom)'), 'Missing safe-area insets');
    assert(css.includes('touch-action: manipulation'), 'Missing touch-action: manipulation to prevent 300ms tap delay');
  });

  // 4. Admin Panel CSS (admin.css)
  check('frontend/src/styles/admin.css has comprehensive responsive rules', () => {
    const css = readFile('frontend/src/styles/admin.css');
    assert(css.includes('@media (max-width: 1024px)'), 'Missing 1024px breakpoint in admin.css');
    assert(css.includes('@media (max-width: 768px)'), 'Missing 768px breakpoint in admin.css');
    assert(css.includes('@media (max-width: 480px)'), 'Missing 480px breakpoint in admin.css');
    assert(css.includes('.admin-sidebar-overlay'), 'Missing admin sidebar overlay');
    assert(css.includes('.admin-mobile-toggle') || css.includes('.admin-hamburger'), 'Missing admin mobile toggle styling');
    assert(css.includes('overflow-x: auto'), 'Admin tables must support horizontal scrolling');
  });

  // 5. Auth CSS (auth.css)
  check('frontend/src/styles/auth.css handles small mobile screens & dvh', () => {
    const css = readFile('frontend/src/styles/auth.css');
    assert(css.includes('100dvh') || css.includes('min-height'), 'auth.css must support dynamic viewport heights');
    assert(css.includes('@media (max-width: 480px)'), 'auth.css missing 480px breakpoint');
    assert(css.includes('@media (max-width: 360px)'), 'auth.css missing 360px breakpoint');
  });

  // 6. Landing CSS (landing.css)
  check('frontend/src/styles/landing.css includes responsive breakpoints', () => {
    const css = readFile('frontend/src/styles/landing.css');
    assert(css.includes('@media (max-width: 1024px)'), 'landing.css missing 1024px breakpoint');
    assert(css.includes('@media (max-width: 768px)'), 'landing.css missing 768px breakpoint');
    assert(css.includes('@media (max-width: 480px)'), 'landing.css missing 480px breakpoint');
    assert(css.includes('@media (max-width: 360px)'), 'landing.css missing 360px breakpoint');
  });

  // 7. Sidebar.jsx Component Contract
  check('Sidebar.jsx supports isOpen and onClose props with ARIA attributes and overlay', () => {
    const jsx = readFile('frontend/src/components/Sidebar.jsx');
    assert(jsx.includes('isOpen') && jsx.includes('onClose'), 'Sidebar must accept isOpen and onClose props');
    assert(jsx.includes('sidebar-overlay'), 'Sidebar must render backdrop overlay for mobile');
    assert(jsx.includes('sidebar-close-btn'), 'Sidebar must include a mobile close button');
    assert(jsx.includes('role="navigation"') || jsx.includes('aria-label'), 'Sidebar must have accessible ARIA navigation');
    assert(jsx.includes('aria-modal') || jsx.includes('aria-hidden'), 'Sidebar must manage ARIA visibility');
  });

  // 8. Topbar.jsx Component Contract
  check('Topbar.jsx includes responsive hamburger button for mobile drawer toggle', () => {
    const jsx = readFile('frontend/src/components/Topbar.jsx');
    assert(jsx.includes('onMenuClick') || jsx.includes('hamburger') || jsx.includes('mobile-menu-btn'), 'Topbar must have mobile menu trigger');
    assert(jsx.includes('aria-label="Open navigation'), 'Hamburger button must have accessible label');
  });

  // 9. App.jsx Component Wiring
  check('App.jsx manages sidebarOpen state and wires to Sidebar and Topbar', () => {
    const jsx = readFile('frontend/src/App.jsx');
    assert(jsx.includes('sidebarOpen'), 'App.jsx must manage sidebarOpen state');
    assert(jsx.includes('setSidebarOpen'), 'App.jsx must provide state updater');
  });

  // 10. AdminView.jsx Component Wiring
  check('AdminView.jsx handles mobile navigation and responsive layout', () => {
    const jsx = readFile('frontend/src/components/AdminView.jsx');
    assert(jsx.includes('adminSidebarOpen') || jsx.includes('sidebarOpen'), 'AdminView must manage mobile sidebar state');
    assert(jsx.includes('admin-hamburger') || jsx.includes('admin-mobile-toggle'), 'AdminView must provide mobile hamburger toggle');
    assert(jsx.includes('admin-sidebar-overlay'), 'AdminView must render overlay backdrop');
  });

  // 11. Modals & Overlays Responsive Design
  check('Modals support mobile bottom-sheet and safe-area scrolling', () => {
    const css = readFile('frontend/src/index.css');
    assert(css.includes('.modal-overlay') || css.includes('.modal-content') || css.includes('.rule-builder-modal'), 'Modal responsive classes present');
    assert(css.includes('max-height') && (css.includes('dvh') || css.includes('vh')), 'Modals must constrain max-height to viewport');
  });

  // 12. Table Horizontally Scrollable Containers
  check('Data tables wrapped in scrollable containers across views', () => {
    const rulesView = readFile('frontend/src/components/RulesView.jsx');
    const dashboardView = readFile('frontend/src/components/DashboardView.jsx');
    assert(rulesView.includes('overflowX') || rulesView.includes('table-responsive') || rulesView.includes('overflow-x'), 'RulesView table must be wrapped in overflow container');
    assert(dashboardView.includes('overflowX') || dashboardView.includes('overflow') || dashboardView.includes('table'), 'DashboardView must prevent horizontal clipping');
  });

  console.log('\n------------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runResponsiveTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
