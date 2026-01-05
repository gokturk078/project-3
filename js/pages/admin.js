/**
 * admin.js - Admin panel page module
 */

import {
    getState,
    isAdminPasswordSet,
    setAdminPassword,
    adminLogin,
    adminLogout,
    getAudit,
    exportDb,
    importDb,
    getRemoteConfig,
    configureRemoteStore,
    setRemoteToken,
    publishToRemote,
    getUnmappedTags,
    mapTag
} from '../store.js';
import { CATEGORIES, CATEGORY_COLORS } from '../taxonomy.js';
import { formatDate } from '../utils.js';
import { navigate } from '../router.js';

export async function render(ctx) {
    const container = document.getElementById('main-content');
    if (!container) return;

    const state = getState();
    const isPasswordSet = isAdminPasswordSet();

    // If not logged in, show login/setup
    if (!state.isAdmin) {
        if (!isPasswordSet) {
            renderSetupPassword(container);
        } else {
            renderLogin(container);
        }
        return;
    }

    // Admin is logged in - show admin panel
    renderAdminPanel(container, state);
}

function renderSetupPassword(container) {
    container.innerHTML = `
    <div class="d-flex items-center justify-center min-h-screen">
      <div class="card" style="max-width: 400px; width: 100%;">
        <div class="text-center mb-6">
          <div class="avatar avatar-xl mx-auto" style="background: var(--accent-light); color: var(--accent);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 class="text-xl font-bold mt-4">Admin Şifresi Oluştur</h2>
          <p class="text-sm text-secondary mt-2">İlk kez giriş yapıyorsunuz. Güvenli bir şifre belirleyin.</p>
        </div>
        
        <form id="setup-form" class="d-flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label required">Şifre (min. 12 karakter)</label>
            <input type="password" class="form-input" id="password" required minlength="12" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label class="form-label required">Şifre Tekrar</label>
            <input type="password" class="form-input" id="confirm-password" required minlength="12" autocomplete="new-password">
          </div>
          <div id="error-message" class="text-danger text-sm hidden"></div>
          <button type="submit" class="btn btn-primary w-full">Şifreyi Kaydet</button>
        </form>
        
        <div class="mt-4 p-3 rounded-lg bg-warning-50 border border-warning-500">
          <div class="d-flex items-start gap-2">
            <span class="text-warning">⚠️</span>
            <div class="text-sm text-warning">
              <strong>Önemli:</strong> Bu şifreyi kaybederseniz, db.json dosyasını düzenleyerek sıfırlamanız gerekecek.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    const form = container.querySelector('#setup-form');
    const errorEl = container.querySelector('#error-message');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const password = document.getElementById('password').value;
        const confirm = document.getElementById('confirm-password').value;

        if (password !== confirm) {
            errorEl.textContent = 'Şifreler eşleşmiyor';
            errorEl.classList.remove('hidden');
            return;
        }

        if (password.length < 12) {
            errorEl.textContent = 'Şifre en az 12 karakter olmalıdır';
            errorEl.classList.remove('hidden');
            return;
        }

        try {
            await setAdminPassword(password);
            await adminLogin(password);
            window.showToast('Admin şifresi oluşturuldu ve giriş yapıldı', 'success');
            navigate('admin');
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
        }
    });
}

function renderLogin(container) {
    container.innerHTML = `
    <div class="d-flex items-center justify-center min-h-screen">
      <div class="card" style="max-width: 400px; width: 100%;">
        <div class="text-center mb-6">
          <div class="avatar avatar-xl mx-auto" style="background: var(--accent-light); color: var(--accent);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 class="text-xl font-bold mt-4">Admin Girişi</h2>
          <p class="text-sm text-secondary mt-2">Yönetim paneline erişmek için şifrenizi girin.</p>
        </div>
        
        <form id="login-form" class="d-flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label">Şifre</label>
            <input type="password" class="form-input" id="password" required autocomplete="current-password">
          </div>
          <div id="error-message" class="text-danger text-sm hidden"></div>
          <button type="submit" class="btn btn-primary w-full">Giriş Yap</button>
        </form>
        
        <div class="text-center mt-4">
          <a href="#/dashboard" class="text-sm text-secondary">← Dashboard'a Dön</a>
        </div>
      </div>
    </div>
  `;

    const form = container.querySelector('#login-form');
    const errorEl = container.querySelector('#error-message');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const password = document.getElementById('password').value;

        try {
            await adminLogin(password);
            window.showToast('Giriş başarılı', 'success');
            navigate('admin');
        } catch (err) {
            errorEl.textContent = 'Geçersiz şifre';
            errorEl.classList.remove('hidden');
        }
    });
}

function renderAdminPanel(container, state) {
    const audit = getAudit().slice(0, 20);
    const remoteConfig = getRemoteConfig();
    const unmappedTags = getUnmappedTags();

    let activeSection = 'overview';

    function renderSection() {
        switch (activeSection) {
            case 'overview':
                return renderOverviewSection(state, unmappedTags);
            case 'tag-mapping':
                return renderTagMappingSection(unmappedTags);
            case 'data':
                return renderDataSection(remoteConfig);
            case 'audit':
                return renderAuditSection(audit);
            default:
                return '';
        }
    }

    container.innerHTML = `
    <div class="page-header">
      <div class="d-flex items-center justify-between">
        <div>
          <h1 class="page-title">Admin Panel</h1>
          <p class="page-description">Sistem yönetimi ve yapılandırma</p>
        </div>
        <button class="btn btn-danger" id="logout-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Çıkış Yap
        </button>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 240px 1fr; gap: var(--space-6);">
      <!-- Sidebar Menu -->
      <div class="d-flex flex-col gap-2">
        <button class="btn ${activeSection === 'overview' ? 'btn-primary' : 'btn-ghost'} justify-start admin-nav" data-section="overview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          Genel Bakış
        </button>
        <button class="btn ${activeSection === 'tag-mapping' ? 'btn-primary' : 'btn-ghost'} justify-start admin-nav" data-section="tag-mapping">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          Tag Mapping
          ${unmappedTags.length > 0 ? `<span class="badge badge-warning ml-auto">${unmappedTags.length}</span>` : ''}
        </button>
        <button class="btn ${activeSection === 'data' ? 'btn-primary' : 'btn-ghost'} justify-start admin-nav" data-section="data">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          Veri Yönetimi
        </button>
        <button class="btn ${activeSection === 'audit' ? 'btn-primary' : 'btn-ghost'} justify-start admin-nav" data-section="audit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Audit Log
        </button>
        
        <hr class="my-4 border-secondary">
        
        <a href="#/needs-review" class="btn btn-ghost justify-start">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          İnceleme Bekleyenler
        </a>
      </div>

      <!-- Content -->
      <div id="admin-content">
        ${renderSection()}
      </div>
    </div>
  `;

    // Event listeners
    container.querySelector('#logout-btn')?.addEventListener('click', () => {
        adminLogout();
        window.showToast('Çıkış yapıldı', 'success');
        navigate('dashboard');
    });

    container.querySelectorAll('.admin-nav').forEach(btn => {
        btn.addEventListener('click', () => {
            activeSection = btn.dataset.section;

            // Update active state
            container.querySelectorAll('.admin-nav').forEach(b => {
                b.classList.toggle('btn-primary', b.dataset.section === activeSection);
                b.classList.toggle('btn-ghost', b.dataset.section !== activeSection);
            });

            // Update content
            document.getElementById('admin-content').innerHTML = renderSection();
            attachSectionListeners();
        });
    });

    function attachSectionListeners() {
        // Export button
        document.getElementById('export-btn')?.addEventListener('click', () => {
            const data = exportDb();
            const blob = new Blob([data], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `db_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            window.showToast('Veri dışa aktarıldı', 'success');
        });

        // Import form
        document.getElementById('import-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('import-file').files[0];
            if (!file) return;

            try {
                const text = await file.text();
                importDb(text);
                window.showToast('Veri içe aktarıldı', 'success');
                navigate('admin');
            } catch (err) {
                window.showToast(err.message, 'error');
            }
        });

        // Remote store config
        document.getElementById('remote-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const gistId = document.getElementById('gist-id').value;

            try {
                configureRemoteStore(gistId);
                window.showToast('Remote store yapılandırıldı', 'success');
            } catch (err) {
                window.showToast(err.message, 'error');
            }
        });

        // Publish button
        document.getElementById('publish-btn')?.addEventListener('click', async () => {
            const token = document.getElementById('github-token').value;
            if (!token) {
                window.showToast('GitHub token gerekli', 'error');
                return;
            }

            try {
                setRemoteToken(token);
                await publishToRemote();
                window.showToast('Veriler remote store\'a yayınlandı', 'success');
            } catch (err) {
                window.showToast(err.message, 'error');
            }
        });

        // Tag mapping
        document.querySelectorAll('.map-tag-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag;
                const category = btn.dataset.category;

                try {
                    mapTag(tag, category);
                    window.showToast(`"${tag}" → ${category}`, 'success');
                    document.getElementById('admin-content').innerHTML = renderTagMappingSection(getUnmappedTags());
                    attachSectionListeners();
                } catch (err) {
                    window.showToast(err.message, 'error');
                }
            });
        });
    }

    attachSectionListeners();
}

function renderOverviewSection(state, unmappedTags) {
    return `
    <div class="card mb-6">
      <h3 class="font-semibold mb-4">Oturum Bilgileri</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-xs text-tertiary uppercase">Oturum ID</div>
          <div class="font-mono text-sm mt-1">${state.adminSession?.id?.slice(0, 8) || '-'}...</div>
        </div>
        <div>
          <div class="text-xs text-tertiary uppercase">Oturum Bitiş</div>
          <div class="text-sm mt-1">${state.adminSession?.expiresAt ? new Date(state.adminSession.expiresAt).toLocaleString('tr-TR') : '-'}</div>
        </div>
      </div>
    </div>
    
    <div class="grid grid-cols-2 gap-6">
      <div class="card">
        <h3 class="font-semibold mb-4">Hızlı Eylemler</h3>
        <div class="d-flex flex-col gap-2">
          <a href="#/needs-review" class="btn btn-secondary justify-start">
            İnceleme Bekleyenleri Gör
            ${unmappedTags.length > 0 ? `<span class="badge badge-warning ml-auto">${unmappedTags.length}</span>` : ''}
          </a>
          <button class="btn btn-secondary justify-start" onclick="navigate('people')">Personel Listesi</button>
          <button class="btn btn-secondary justify-start" onclick="navigate('departures')">Ayrılanlar Raporu</button>
        </div>
      </div>
      
      <div class="card">
        <h3 class="font-semibold mb-4">Sistem Durumu</h3>
        <div class="d-flex flex-col gap-3">
          <div class="d-flex items-center justify-between">
            <span class="text-secondary">Veri Kaynağı</span>
            <span class="badge badge-success">Aktif</span>
          </div>
          <div class="d-flex items-center justify-between">
            <span class="text-secondary">Remote Store</span>
            <span class="badge ${getRemoteConfig()?.enabled ? 'badge-success' : 'badge-neutral'}">${getRemoteConfig()?.enabled ? 'Yapılandırıldı' : 'Kapalı'}</span>
          </div>
          <div class="d-flex items-center justify-between">
            <span class="text-secondary">Son Senkron</span>
            <span class="text-sm">${state.lastSync ? formatDate(state.lastSync) : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTagMappingSection(unmappedTags) {
    if (unmappedTags.length === 0) {
        return `
      <div class="card">
        <div class="empty-state">
          <div class="text-success text-2xl">✓</div>
          <h3 class="empty-state-title">Tüm etiketler eşlenmiş</h3>
          <p class="empty-state-description">Yeni eşlenmemiş etiket yok.</p>
        </div>
      </div>
    `;
    }

    return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Eşlenmemiş Etiketler</h3>
        <span class="badge badge-warning">${unmappedTags.length}</span>
      </div>
      <p class="text-sm text-secondary mb-4">
        Bu etiketler Excel dosyalarından geldi. Her birini 8 kategoriden birine eşleyin.
      </p>
      <div class="d-flex flex-col gap-4">
        ${unmappedTags.map(tag => `
          <div class="p-4 rounded-lg bg-tertiary">
            <div class="font-semibold mb-3">"${tag}"</div>
            <div class="d-flex gap-2 flex-wrap">
              ${CATEGORIES.map(cat => `
                <button class="btn btn-sm map-tag-btn" data-tag="${tag}" data-category="${cat}"
                        style="background: ${CATEGORY_COLORS[cat]}20; color: ${CATEGORY_COLORS[cat]};">
                  ${cat}
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderDataSection(remoteConfig) {
    return `
    <div class="grid grid-cols-2 gap-6">
      <div class="card">
        <h3 class="font-semibold mb-4">Dışa Aktar</h3>
        <p class="text-sm text-secondary mb-4">Tüm verileri JSON formatında indirin.</p>
        <button class="btn btn-primary" id="export-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          db.json İndir
        </button>
      </div>
      
      <div class="card">
        <h3 class="font-semibold mb-4">İçe Aktar</h3>
        <p class="text-sm text-secondary mb-4">JSON dosyasından verileri yükleyin.</p>
        <form id="import-form" class="d-flex gap-2">
          <input type="file" class="form-input flex-1" id="import-file" accept=".json" required>
          <button type="submit" class="btn btn-secondary">Yükle</button>
        </form>
      </div>
    </div>
    
    <div class="card mt-6">
      <h3 class="font-semibold mb-4">Remote Store (GitHub Gist)</h3>
      <p class="text-sm text-secondary mb-4">
        Verileri GitHub Gist üzerinde saklayarak canlı senkronizasyon sağlayın.
      </p>
      
      <div class="p-4 rounded-lg bg-warning-50 border border-warning-500 mb-4">
        <div class="d-flex items-start gap-2">
          <span class="text-warning">⚠️</span>
          <div class="text-sm text-warning">
            <strong>Güvenlik Uyarısı:</strong> GitHub token'ınızı asla kodda saklamayın. 
            Token sadece bu oturum boyunca bellekte tutulur ve çıkışta silinir.
          </div>
        </div>
      </div>
      
      <form id="remote-form" class="d-flex flex-col gap-4 mb-4">
        <div class="form-group">
          <label class="form-label">Gist ID</label>
          <input type="text" class="form-input" id="gist-id" placeholder="abc123..." value="${remoteConfig?.gistId || ''}">
          <div class="form-hint">Gist URL'den ID kısmını kopyalayın</div>
        </div>
        <button type="submit" class="btn btn-secondary">Kaydet</button>
      </form>
      
      ${remoteConfig?.enabled ? `
        <hr class="my-4 border-secondary">
        <h4 class="font-medium mb-3">Yayınla</h4>
        <div class="form-group mb-4">
          <label class="form-label">GitHub Personal Access Token</label>
          <input type="password" class="form-input" id="github-token" placeholder="ghp_...">
          <div class="form-hint">Token sadece bu oturum için bellekte tutulur</div>
        </div>
        <button class="btn btn-primary" id="publish-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          Remote'a Yayınla
        </button>
      ` : ''}
    </div>
  `;
}

function renderAuditSection(audit) {
    return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Audit Log</h3>
        <span class="badge badge-neutral">Son 20 işlem</span>
      </div>
      ${audit.length > 0 ? `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İşlem</th>
                <th>Tür</th>
                <th>Detay</th>
              </tr>
            </thead>
            <tbody>
              ${audit.map(a => `
                <tr>
                  <td class="cell-mono text-sm">${formatDate(a.timestamp)}</td>
                  <td><span class="badge ${getAuditBadge(a.action)}">${a.action}</span></td>
                  <td class="cell-secondary">${a.entityType}</td>
                  <td class="cell-secondary text-sm">${a.entityId?.slice(0, 8) || '-'}...</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="empty-state">
          <p class="text-secondary">Henüz audit kaydı yok</p>
        </div>
      `}
    </div>
  `;
}

function getAuditBadge(action) {
    switch (action) {
        case 'CREATE': return 'badge-success';
        case 'UPDATE': return 'badge-info';
        case 'DELETE': return 'badge-danger';
        case 'MERGE': return 'badge-primary';
        case 'TAG_MAP': return 'badge-warning';
        case 'IMPORT': return 'badge-neutral';
        default: return 'badge-neutral';
    }
}
