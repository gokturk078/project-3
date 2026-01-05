/**
 * roles.js - Roles page module
 */

import { getPeople } from '../store.js';
import { ROLES } from '../taxonomy.js';
import { navigate } from '../router.js';

export async function render(ctx) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const { subPath } = ctx;

  if (subPath && ROLES.includes(subPath.toUpperCase().replace(/-/g, ' '))) {
    await renderRoleDetail(container, subPath.toUpperCase().replace(/-/g, ' '));
  } else {
    await renderRoleList(container);
  }
}

async function renderRoleList(container) {
  const allPeople = getPeople();

  // Active roster only
  const activeRoster = allPeople.filter(p => p.status === 'active');

  const roleStats = ROLES.map(role => ({
    name: role,
    count: activeRoster.filter(p => p.role === role).length
  })).filter(r => r.count > 0); // Only show roles with people

  const unassigned = activeRoster.filter(p => !p.role).length;
  const assigned = activeRoster.length - unassigned;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Roller</h1>
      <p class="page-description">12 tanımlı rol - ${assigned} kişiye rol atanmış</p>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-3 gap-6 mb-6">
      <div class="card">
        <div class="d-flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">Aktif Roster</div>
            <div class="text-3xl font-bold mt-1">${activeRoster.length}</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="d-flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">Rolü Atanmış</div>
            <div class="text-3xl font-bold text-success mt-1">${assigned}</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="d-flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">Rol Atanmamış</div>
            <div class="text-3xl font-bold text-secondary mt-1">${unassigned}</div>
          </div>
          <div class="text-xs text-secondary">Normal - herkesin<br/>rolü olmak zorunda değil</div>
        </div>
      </div>
    </div>

    <h3 class="font-semibold mb-4">Rol Dağılımı</h3>
    <div class="grid grid-cols-3 gap-6">
      ${roleStats.map(role => `
        <div class="card cursor-pointer transition" onclick="navigate('roles/${role.name.toLowerCase().replace(/\\s+/g, '-')}')">
          <div class="d-flex items-center justify-between">
            <div>
              <h3 class="font-semibold">${role.name}</h3>
              <p class="text-sm text-secondary mt-1">Personel sayısı</p>
            </div>
            <span class="text-3xl font-bold text-accent">${role.count}</span>
          </div>
        </div>
      `).join('')}
    </div>

    ${roleStats.length === 0 ? `
      <div class="card text-center p-6">
        <div class="text-secondary">Henüz rol atanmış personel yok</div>
      </div>
    ` : ''}
  `;
}

async function renderRoleDetail(container, role) {
  const people = getPeople({ role });

  let searchQuery = '';

  function filterPeople() {
    return people.filter(p => {
      if (searchQuery && !p.fullName.toLowerCase().includes(searchQuery.toLowerCase())) {
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
            <th>Kategori</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length > 0 ? filtered.map(p => `
            <tr class="clickable" onclick="navigate('people', { id: '${p.personId}' })">
              <td class="cell-name">${p.fullName}</td>
              <td>${p.category ? `<span class="badge badge-cat-${p.category.toLowerCase().replace(/[^a-z]/g, '')}">${p.category}</span>` : '<span class="badge badge-neutral">-</span>'}</td>
              <td><span class="badge badge-status-${p.status}">${getStatusLabel(p.status)}</span></td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="3" class="text-center text-secondary p-6">Sonuç bulunamadı</td>
            </tr>
          `}
        </tbody>
      </table>
    `;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="d-flex items-center gap-3 mb-2">
        <button class="btn btn-ghost btn-icon" onclick="navigate('roles')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 class="page-title">${role}</h1>
          <p class="page-description">${people.length} personel</p>
        </div>
      </div>
    </div>

    <!-- Search -->
    <div class="card mb-6">
      <div class="search-input">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input type="text" class="form-input" id="search-input" placeholder="İsim ara...">
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrapper" id="people-table">
      ${renderTable()}
    </div>
  `;

  // Event listeners
  const searchInput = container.querySelector('#search-input');
  const tableWrapper = container.querySelector('#people-table');

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
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
