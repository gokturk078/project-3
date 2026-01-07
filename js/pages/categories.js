/**
 * categories.js - Categories page module
 */

import { getPeople, getState } from '../store.js';
import { CATEGORIES, CATEGORY_COLORS } from '../taxonomy.js';
import { navigate } from '../router.js';

export async function render(ctx) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const { subPath } = ctx;

  if (subPath && CATEGORIES.includes(subPath.toUpperCase())) {
    await renderCategoryDetail(container, subPath.toUpperCase());
  } else {
    await renderCategoryList(container);
  }
}

async function renderCategoryList(container) {
  const allPeople = getPeople();

  // Active roster = people with status 'active'
  const activeRoster = allPeople.filter(p => p.status === 'active');
  const pendingPeople = allPeople.filter(p => p.status === 'pending');

  const categoryStats = CATEGORIES.map(cat => ({
    name: cat,
    count: activeRoster.filter(p => p.category === cat).length,
    color: CATEGORY_COLORS[cat]
  }));

  // Uncategorized in ACTIVE roster only (should be 0)
  const uncategorizedActive = activeRoster.filter(p => !p.category).length;

  // Total of category stats should equal activeRoster.length
  const totalCategorized = categoryStats.reduce((sum, cat) => sum + cat.count, 0);

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Kategoriler</h1>
      <p class="page-description">8 sabit kategori - Aktif Roster: ${activeRoster.length} personel</p>
    </div>

    <div class="grid grid-cols-4 gap-6" id="category-grid">
      ${categoryStats.map(cat => `
        <div class="card cursor-pointer transition category-card" data-category="${cat.name}" style="border-left: 4px solid ${cat.color};">
          <div class="d-flex items-center justify-between mb-4">
            <div class="avatar" style="background: ${cat.color}20; color: ${cat.color};">
              ${cat.name.charAt(0)}
            </div>
            <span class="text-3xl font-bold">${cat.count}</span>
          </div>
          <h3 class="text-lg font-semibold">${cat.name}</h3>
          <p class="text-sm text-secondary mt-1">Personel sayısı</p>
        </div>
      `).join('')}
    </div>

    ${uncategorizedActive > 0 ? `
      <div class="card mt-6" style="border-left: 4px solid var(--color-danger-500);">
        <div class="d-flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-danger">❌ Kategorisiz Aktif Personel</h3>
            <p class="text-sm text-secondary">Bu bir hata! Aktif roster'da kategorisiz kişi olmamalı.</p>
          </div>
          <div class="d-flex items-center gap-4">
            <span class="text-3xl font-bold text-danger">${uncategorizedActive}</span>
            <a href="#/needs-review" class="btn btn-danger">Düzelt</a>
          </div>
        </div>
      </div>
    ` : `
      <div class="card mt-6" style="border-left: 4px solid var(--color-success-500);">
        <div class="d-flex items-center gap-3">
          <span class="text-success text-xl">✓</span>
          <div>
            <h3 class="font-semibold text-success">Tüm aktif personel kategorize edilmiş</h3>
            <p class="text-sm text-secondary">${totalCategorized} kişi 8 kategoride dağılmış durumda.</p>
          </div>
        </div>
      </div>
    `}

    ${pendingPeople.length > 0 ? `
      <div class="card mt-6" style="border-left: 4px solid var(--color-warning-500);">
        <div class="d-flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-warning">⏳ Bekleyen Başvurular</h3>
            <p class="text-sm text-secondary">Takip listesinden gelen, henüz kategorize edilmemiş yeni başvurular.</p>
          </div>
          <div class="d-flex items-center gap-4">
            <span class="text-3xl font-bold text-warning">${pendingPeople.length}</span>
            <a href="#/tracking" class="btn btn-secondary">Takip Listesi</a>
          </div>
        </div>
      </div>
    ` : ''}
  `;

  // Add click event listeners for category cards
  const categoryGrid = container.querySelector('#category-grid');
  categoryGrid?.addEventListener('click', (e) => {
    const card = e.target.closest('.category-card');
    if (card) {
      const categoryName = card.dataset.category;
      navigate(`categories/${categoryName}`);
    }
  });
}

async function renderCategoryDetail(container, category) {
  const people = getPeople({ category });
  const color = CATEGORY_COLORS[category];

  let searchQuery = '';
  let roleFilter = '';

  function filterPeople() {
    return people.filter(p => {
      if (searchQuery && !p.fullName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (roleFilter && p.role !== roleFilter) {
        return false;
      }
      return true;
    });
  }

  function renderTable() {
    const filtered = filterPeople();
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Ad Soyad</th>
            <th>Rol</th>
            <th>Durum</th>
            <th>İnceleme</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length > 0 ? filtered.map(p => `
            <tr class="clickable" onclick="navigate('people', { id: '${p.personId}' })">
              <td class="cell-name">${p.fullName}</td>
              <td>${p.role ? `<span class="badge badge-primary">${p.role}</span>` : '<span class="badge badge-neutral">-</span>'}</td>
              <td><span class="badge badge-status-${p.status}">${getStatusLabel(p.status)}</span></td>
              <td>${p.needsReview ? '<span class="badge badge-warning">⚠️ Bekliyor</span>' : '<span class="text-success">✓</span>'}</td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="4" class="text-center text-secondary p-6">Sonuç bulunamadı</td>
            </tr>
          `}
        </tbody>
      </table>
    `;
  }

  // Get unique roles in this category
  const rolesInCategory = [...new Set(people.map(p => p.role).filter(Boolean))];

  container.innerHTML = `
    <div class="page-header">
      <div class="d-flex items-center gap-3 mb-2">
        <button class="btn btn-ghost btn-icon" onclick="navigate('categories')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="avatar avatar-lg" style="background: ${color}20; color: ${color};">
          ${category.charAt(0)}
        </div>
        <div>
          <h1 class="page-title">${category}</h1>
          <p class="page-description">${people.length} personel</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card mb-6">
      <div class="d-flex items-center gap-4">
        <div class="search-input flex-1">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" class="form-input" id="search-input" placeholder="İsim ara...">
        </div>
        <select class="form-select" id="role-filter" style="width: 200px;">
          <option value="">Tüm Roller</option>
          ${rolesInCategory.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrapper" id="people-table">
      ${renderTable()}
    </div>
  `;

  // Event listeners
  const searchInput = container.querySelector('#search-input');
  const roleSelect = container.querySelector('#role-filter');
  const tableWrapper = container.querySelector('#people-table');

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    tableWrapper.innerHTML = renderTable();
  });

  roleSelect?.addEventListener('change', (e) => {
    roleFilter = e.target.value;
    tableWrapper.innerHTML = renderTable();
  });
}

function getStatusLabel(status) {
  const labels = {
    active: 'Aktif',
    pending: 'Bekleyen',
    departed: 'Ayrıldı',
    conflict: 'Çakışma'
  };
  return labels[status] || status;
}
