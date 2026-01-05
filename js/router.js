/**
 * router.js - Hash-based SPA router
 */

// ============================================================================
// ROUTES CONFIGURATION
// ============================================================================

const routes = [
    { path: 'dashboard', title: 'Dashboard', icon: 'home', section: 'main' },
    { path: 'categories', title: 'Kategoriler', icon: 'folder', section: 'main' },
    { path: 'roles', title: 'Roller', icon: 'users', section: 'main' },
    { path: 'people', title: 'Personel', icon: 'user', section: 'main' },
    { path: 'leaves', title: 'İzinler', icon: 'calendar', section: 'main' },
    { path: 'tracking', title: 'Takip', icon: 'clipboard', section: 'main' },
    { path: 'departures', title: 'Ayrılanlar', icon: 'log-out', section: 'main' },
    { path: 'needs-review', title: 'İnceleme Bekleyenler', icon: 'alert-circle', section: 'admin', adminOnly: true },
    { path: 'admin', title: 'Admin', icon: 'settings', section: 'admin' }
];

const routeHandlers = new Map();
let currentRoute = null;
let beforeNavigateCallback = null;

// ============================================================================
// ICONS
// ============================================================================

const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    'log-out': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    'alert-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};

// ============================================================================
// ROUTER API
// ============================================================================

export function getRoutes() {
    return routes;
}

export function getRouteIcon(iconName) {
    return ICONS[iconName] || '';
}

export function registerRoute(path, handler) {
    routeHandlers.set(path, handler);
}

export function getCurrentRoute() {
    return currentRoute;
}

export function setBeforeNavigate(callback) {
    beforeNavigateCallback = callback;
}

export function navigate(path, params = {}) {
    const url = new URL(window.location.href);
    url.hash = `#/${path}`;

    // Add query params
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
        }
    });

    window.history.pushState({}, '', url);
    handleRouteChange();
}

export function getRouteParams() {
    const url = new URL(window.location.href);
    const params = {};
    url.searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

// ============================================================================
// ROUTE HANDLING
// ============================================================================

function parseHash() {
    const hash = window.location.hash.slice(1); // Remove #
    const path = hash.startsWith('/') ? hash.slice(1) : hash; // Remove leading /

    // Handle sub-routes like categories/REPSAM
    const parts = path.split('/');
    const basePath = parts[0] || 'dashboard';
    const subPath = parts[1] || null;

    return { basePath, subPath, fullPath: path };
}

async function handleRouteChange() {
    const { basePath, subPath, fullPath } = parseHash();

    // Find matching route
    const route = routes.find(r => r.path === basePath);

    if (!route) {
        // Redirect to dashboard if route not found
        navigate('dashboard');
        return;
    }

    // Call before navigate callback
    if (beforeNavigateCallback) {
        const shouldContinue = await beforeNavigateCallback(route, currentRoute);
        if (shouldContinue === false) return;
    }

    currentRoute = { ...route, subPath, fullPath };

    // Update page title
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = route.title;
    }
    document.title = `${route.title} | Personel Portalı`;

    // Update active nav link
    updateActiveNavLink(basePath);

    // Call route handler
    const handler = routeHandlers.get(basePath);
    if (handler) {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = '<div class="d-flex items-center justify-center p-8"><div class="spinner spinner-lg"></div></div>';

            try {
                await handler({ basePath, subPath, params: getRouteParams() });
            } catch (error) {
                console.error('Route handler error:', error);
                mainContent.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon text-danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 class="empty-state-title">Sayfa yüklenirken hata oluştu</h3>
            <p class="empty-state-description">${error.message}</p>
            <button class="btn btn-primary mt-4" onclick="location.reload()">Yenile</button>
          </div>
        `;
            }
        }
    }
}

function updateActiveNavLink(activePath) {
    const navLinks = document.querySelectorAll('.sidebar-link');
    navLinks.forEach(link => {
        const linkPath = link.dataset.path;
        if (linkPath === activePath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initRouter() {
    // Listen for hash changes
    window.addEventListener('hashchange', handleRouteChange);

    // Handle initial route
    if (!window.location.hash) {
        window.location.hash = '#/dashboard';
    } else {
        handleRouteChange();
    }
}

// ============================================================================
// SIDEBAR NAVIGATION RENDERING
// ============================================================================

export function renderNavigation(isAdmin = false, stats = {}) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    const mainRoutes = routes.filter(r => r.section === 'main');
    const adminRoutes = routes.filter(r => r.section === 'admin');

    let html = `
    <div class="sidebar-section">
      <div class="sidebar-section-title">Ana Menü</div>
      ${mainRoutes.map(route => renderNavLink(route, stats)).join('')}
    </div>
  `;

    if (isAdmin || adminRoutes.some(r => !r.adminOnly)) {
        html += `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Yönetim</div>
        ${adminRoutes.filter(r => !r.adminOnly || isAdmin).map(route => renderNavLink(route, stats)).join('')}
      </div>
    `;
    }

    nav.innerHTML = html;

    // Add click handlers
    nav.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const path = link.dataset.path;
            if (path) navigate(path);
        });
    });

    // Update active state
    const { basePath } = parseHash();
    updateActiveNavLink(basePath);
}

function renderNavLink(route, stats) {
    const icon = ICONS[route.icon] || '';
    const badge = getBadgeForRoute(route.path, stats);

    return `
    <a href="#/${route.path}" class="sidebar-link" data-path="${route.path}">
      <span class="sidebar-link-icon">${icon}</span>
      <span class="sidebar-link-text">${route.title}</span>
      ${badge}
    </a>
  `;
}

function getBadgeForRoute(path, stats) {
    switch (path) {
        case 'people':
            return stats.totalPeople ? `<span class="sidebar-link-badge">${stats.totalPeople}</span>` : '';
        case 'needs-review':
            const reviewCount = stats.needsReviewCount || 0;
            return reviewCount > 0
                ? `<span class="sidebar-link-badge danger">${reviewCount}</span>`
                : '';
        case 'departures':
            return stats.departedCount ? `<span class="sidebar-link-badge">${stats.departedCount}</span>` : '';
        default:
            return '';
    }
}
