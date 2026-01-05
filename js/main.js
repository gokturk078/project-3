/**
 * main.js - Application entry point
 */

import {
    loadData,
    getState,
    subscribe,
    getTheme,
    applyTheme,
    setTheme,
    getSidebarCollapsed,
    setSidebarCollapsed,
    checkAdminSession,
    getStats
} from './store.js';

import {
    initRouter,
    navigate,
    registerRoute,
    renderNavigation
} from './router.js';

// ============================================================================
// UI HELPERS
// ============================================================================

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-content">
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 200);
    });

    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 200);
            }
        }, duration);
    }
}

function showDrawer(title, content, footer = '') {
    const backdrop = document.getElementById('drawer-backdrop');
    const drawer = document.getElementById('drawer');
    const titleEl = document.getElementById('drawer-title');
    const bodyEl = document.getElementById('drawer-body');
    const footerEl = document.getElementById('drawer-footer');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;
    if (footerEl) footerEl.innerHTML = footer;

    backdrop?.classList.add('open');
    drawer?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function hideDrawer() {
    const backdrop = document.getElementById('drawer-backdrop');
    const drawer = document.getElementById('drawer');

    backdrop?.classList.remove('open');
    drawer?.classList.remove('open');
    document.body.style.overflow = '';
}

function showModal(title, content, footer = '', size = '') {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;
    if (footerEl) footerEl.innerHTML = footer;

    modal?.classList.remove('modal-lg', 'modal-xl');
    if (size) modal?.classList.add(`modal-${size}`);

    backdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function hideModal() {
    const backdrop = document.getElementById('modal-backdrop');
    backdrop?.classList.remove('open');
    document.body.style.overflow = '';
}

function showCommandPalette() {
    const backdrop = document.getElementById('command-backdrop');
    const input = document.getElementById('command-input');

    backdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';

    setTimeout(() => input?.focus(), 100);
}

function hideCommandPalette() {
    const backdrop = document.getElementById('command-backdrop');
    const input = document.getElementById('command-input');

    backdrop?.classList.remove('open');
    document.body.style.overflow = '';

    if (input) input.value = '';

    const results = document.getElementById('command-results');
    if (results) results.innerHTML = '';
}

// Make these available globally for page modules
window.showToast = showToast;
window.showDrawer = showDrawer;
window.hideDrawer = hideDrawer;
window.showModal = showModal;
window.hideModal = hideModal;

// ============================================================================
// THEME HANDLING
// ============================================================================

function initTheme() {
    const theme = getTheme();
    applyTheme(theme);
    updateThemeIcon(theme);
}

function toggleTheme() {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const sunIcon = toggle.querySelector('.icon-sun');
    const moonIcon = toggle.querySelector('.icon-moon');

    if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

// ============================================================================
// SIDEBAR HANDLING
// ============================================================================

function initSidebar() {
    const app = document.getElementById('app');
    const isCollapsed = getSidebarCollapsed();

    if (isCollapsed && app) {
        app.classList.add('sidebar-collapsed');
    }
}

function toggleSidebar() {
    const app = document.getElementById('app');
    if (!app) return;

    const isCollapsed = app.classList.toggle('sidebar-collapsed');
    setSidebarCollapsed(isCollapsed);
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.toggle('mobile-open');
}

// ============================================================================
// COMMAND PALETTE
// ============================================================================

function initCommandPalette() {
    const input = document.getElementById('command-input');
    const results = document.getElementById('command-results');

    if (!input || !results) return;

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();

        if (query.length < 2) {
            results.innerHTML = renderCommandHints();
            return;
        }

        const searchResults = searchAll(query);
        results.innerHTML = renderCommandResults(searchResults);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideCommandPalette();
        } else if (e.key === 'Enter') {
            const selected = results.querySelector('.command-item.selected');
            if (selected) {
                selected.click();
            }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            navigateCommandResults(e.key === 'ArrowDown' ? 1 : -1);
        }
    });

    // Initial hints
    results.innerHTML = renderCommandHints();
}

function renderCommandHints() {
    return `
    <div class="command-group-title">Sayfalar</div>
    <div class="command-item" onclick="navigate('dashboard'); hideCommandPalette();">
      <span class="command-item-label">Dashboard</span>
    </div>
    <div class="command-item" onclick="navigate('people'); hideCommandPalette();">
      <span class="command-item-label">Personel Listesi</span>
    </div>
    <div class="command-item" onclick="navigate('departures'); hideCommandPalette();">
      <span class="command-item-label">İşten Ayrılanlar</span>
    </div>
  `;
}

function searchAll(query) {
    const results = { pages: [], people: [] };
    const state = getState();

    // Search pages
    const pages = [
        { name: 'Dashboard', path: 'dashboard' },
        { name: 'Kategoriler', path: 'categories' },
        { name: 'Roller', path: 'roles' },
        { name: 'Personel', path: 'people' },
        { name: 'İzinler', path: 'leaves' },
        { name: 'Takip', path: 'tracking' },
        { name: 'Ayrılanlar', path: 'departures' },
        { name: 'Admin', path: 'admin' }
    ];

    results.pages = pages.filter(p =>
        p.name.toLowerCase().includes(query)
    );

    // Search people
    if (state.db?.people) {
        results.people = state.db.people
            .filter(p => p.fullName.toLowerCase().includes(query))
            .slice(0, 5);
    }

    return results;
}

function renderCommandResults(results) {
    let html = '';

    if (results.pages.length > 0) {
        html += '<div class="command-group-title">Sayfalar</div>';
        html += results.pages.map(p => `
      <div class="command-item" onclick="navigate('${p.path}'); hideCommandPalette();">
        <span class="command-item-label">${p.name}</span>
      </div>
    `).join('');
    }

    if (results.people.length > 0) {
        html += '<div class="command-group-title">Personel</div>';
        html += results.people.map(p => `
      <div class="command-item" data-person-id="${p.personId}" onclick="navigateToPerson('${p.personId}')">
        <span class="command-item-label">${p.fullName}</span>
        <span class="command-item-shortcut">${p.category || '-'}</span>
      </div>
    `).join('');
    }

    if (!html) {
        html = '<div class="p-4 text-center text-secondary">Sonuç bulunamadı</div>';
    }

    return html;
}

function navigateCommandResults(direction) {
    const results = document.getElementById('command-results');
    const items = results?.querySelectorAll('.command-item');
    if (!items?.length) return;

    const current = [...items].findIndex(i => i.classList.contains('selected'));
    const next = Math.max(0, Math.min(items.length - 1, current + direction));

    items.forEach((item, i) => {
        item.classList.toggle('selected', i === next);
    });

    items[next]?.scrollIntoView({ block: 'nearest' });
}

// Global navigation helper
window.navigateToPerson = (personId) => {
    hideCommandPalette();
    navigate('people', { id: personId });
};

window.navigate = navigate;
window.hideCommandPalette = hideCommandPalette;

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function initEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

    // Sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);

    // Mobile menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);

    // Search trigger
    document.getElementById('search-trigger')?.addEventListener('click', showCommandPalette);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Cmd/Ctrl + K for search
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            showCommandPalette();
        }

        // Escape to close overlays
        if (e.key === 'Escape') {
            hideCommandPalette();
            hideDrawer();
            hideModal();
        }
    });

    // Drawer close
    document.getElementById('drawer-close')?.addEventListener('click', hideDrawer);
    document.getElementById('drawer-backdrop')?.addEventListener('click', hideDrawer);

    // Modal close
    document.getElementById('modal-close')?.addEventListener('click', hideModal);
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) hideModal();
    });

    // Command palette backdrop
    document.getElementById('command-backdrop')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) hideCommandPalette();
    });
}

// ============================================================================
// PAGE MODULES (lazy loaded)
// ============================================================================

async function loadPageModule(name) {
    try {
        const module = await import(`./pages/${name}.js`);
        return module;
    } catch (error) {
        console.error(`Failed to load page module: ${name}`, error);
        throw error;
    }
}

// Register route handlers
async function registerPageHandlers() {
    registerRoute('dashboard', async (ctx) => {
        const mod = await loadPageModule('dashboard');
        await mod.render(ctx);
    });

    registerRoute('categories', async (ctx) => {
        const mod = await loadPageModule('categories');
        await mod.render(ctx);
    });

    registerRoute('roles', async (ctx) => {
        const mod = await loadPageModule('roles');
        await mod.render(ctx);
    });

    registerRoute('people', async (ctx) => {
        const mod = await loadPageModule('people');
        await mod.render(ctx);
    });

    registerRoute('leaves', async (ctx) => {
        const mod = await loadPageModule('leaves');
        await mod.render(ctx);
    });

    registerRoute('tracking', async (ctx) => {
        const mod = await loadPageModule('tracking');
        await mod.render(ctx);
    });

    registerRoute('departures', async (ctx) => {
        const mod = await loadPageModule('departures');
        await mod.render(ctx);
    });

    registerRoute('needs-review', async (ctx) => {
        const mod = await loadPageModule('needs-review');
        await mod.render(ctx);
    });

    registerRoute('admin', async (ctx) => {
        const mod = await loadPageModule('admin');
        await mod.render(ctx);
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
    console.log('🚀 Initializing Personnel Portal...');

    try {
        // Initialize theme
        initTheme();

        // Initialize sidebar state
        initSidebar();

        // Check admin session
        checkAdminSession();

        // Load data
        await loadData();

        // Get state
        const state = getState();
        const stats = getStats();

        // Render navigation
        renderNavigation(state.isAdmin, stats);

        // Register page handlers
        await registerPageHandlers();

        // Initialize event listeners
        initEventListeners();

        // Initialize command palette
        initCommandPalette();

        // Initialize router
        initRouter();

        // Hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');

        if (loadingScreen) loadingScreen.classList.add('hidden');
        if (app) app.style.display = '';

        console.log('✅ Portal initialized successfully');

    } catch (error) {
        console.error('❌ Initialization failed:', error);

        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.innerHTML = `
        <div class="loading-content">
          <div class="loading-logo" style="background: var(--color-danger-500);">!</div>
          <div class="loading-text">Yükleme hatası: ${error.message}</div>
          <button class="btn btn-primary mt-4" onclick="location.reload()">Yeniden Dene</button>
        </div>
      `;
        }
    }
}

// Subscribe to state changes
subscribe((state) => {
    const stats = getStats();
    renderNavigation(state.isAdmin, stats);
});

// Start application
document.addEventListener('DOMContentLoaded', init);
