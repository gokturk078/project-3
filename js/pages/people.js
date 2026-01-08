/**
 * people.js - People directory page module
 */

import { getPeople, getPersonById, getLeaves, getTracking, getState } from '../store.js';
import { CATEGORIES, ROLES, CATEGORY_COLORS } from '../taxonomy.js';
import { formatDate } from '../utils.js';
import { getRouteParams } from '../router.js';

let currentPage = 1;
const pageSize = 20;
let filters = {
  search: '',
  category: '',
  role: '',
  status: ''
};

export async function render(ctx) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const params = getRouteParams();

  // If person ID in params, show drawer
  if (params.id) {
    await renderPeopleList(container);
    showPersonDrawer(params.id);
  } else {
    await renderPeopleList(container);
  }
}

async function renderPeopleList(container) {
  function getFilteredPeople() {
    return getPeople({
      search: filters.search,
      category: filters.category || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined
    });
  }

  function getPaginatedPeople() {
    const all = getFilteredPeople();
    const start = (currentPage - 1) * pageSize;
    return {
      people: all.slice(start, start + pageSize),
      total: all.length,
      totalPages: Math.ceil(all.length / pageSize)
    };
  }

  function renderTable() {
    const { people, total, totalPages } = getPaginatedPeople();

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Ad Soyad</th>
            <th>Kategori</th>
            <th>Rol</th>
            <th>Durum</th>
            <th>İnceleme</th>
          </tr>
        </thead>
        <tbody>
          ${people.length > 0 ? people.map(p => `
            <tr class="clickable" data-person-id="${p.personId}">
              <td class="cell-name">
                <div class="d-flex items-center gap-3">
                  <div class="avatar avatar-sm" style="background: ${getCategoryBg(p.category)}; color: ${getCategoryColor(p.category)};">
                    ${p.fullName.charAt(0)}
                  </div>
                  ${p.fullName}
                </div>
              </td>
              <td>${p.category ? `<span class="badge badge-cat-${p.category.toLowerCase().replace(/[^a-z]/g, '')}">${p.category}</span>` : '<span class="badge badge-neutral">-</span>'}</td>
              <td class="cell-secondary">${p.role || '-'}</td>
              <td><span class="badge badge-status-${p.status}">${getStatusLabel(p.status)}</span></td>
              <td>${p.needsReview ? '<span class="badge badge-warning">⚠️</span>' : '<span class="text-success">✓</span>'}</td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="5" class="text-center text-secondary p-6">Sonuç bulunamadı</td>
            </tr>
          `}
        </tbody>
      </table>
      
      <div class="pagination">
        <div class="pagination-info">
          ${total} kayıttan ${Math.min((currentPage - 1) * pageSize + 1, total)}-${Math.min(currentPage * pageSize, total)} arası gösteriliyor
        </div>
        <div class="pagination-controls">
          <button class="pagination-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          ${renderPageNumbers(currentPage, totalPages)}
          <button class="pagination-btn" id="next-page" ${currentPage >= totalPages ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  const state = getState();
  const allPeople = getPeople();

  container.innerHTML = `
    <div class="page-header">
      <div class="d-flex items-center justify-between">
        <div>
          <h1 class="page-title">Personel Dizini</h1>
          <p class="page-description">Tüm personel kayıtları</p>
        </div>
        ${state.isAdmin ? `
          <button class="btn btn-primary" id="add-person-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Personel Ekle
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Filters -->
    <div class="card mb-6">
      <div class="d-flex items-center gap-4 flex-wrap">
        <div class="search-input flex-1" style="min-width: 200px;">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" class="form-input" id="search-input" placeholder="İsim ara..." value="${filters.search}">
        </div>
        <select class="form-select filter-select" id="category-filter">
          <option value="">Tüm Kategoriler</option>
          ${CATEGORIES.map(c => `<option value="${c}" ${filters.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <select class="form-select filter-select" id="role-filter">
          <option value="">Tüm Roller</option>
          ${ROLES.map(r => `<option value="${r}" ${filters.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <select class="form-select filter-select" id="status-filter">
          <option value="">Tüm Durumlar</option>
          <option value="active" ${filters.status === 'active' ? 'selected' : ''}>Aktif</option>
          <option value="pending" ${filters.status === 'pending' ? 'selected' : ''}>Bekleyen</option>
          <option value="departed" ${filters.status === 'departed' ? 'selected' : ''}>Ayrılan</option>
          <option value="conflict" ${filters.status === 'conflict' ? 'selected' : ''}>Çakışma</option>
        </select>
        <button class="btn btn-ghost" id="clear-filters">Temizle</button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrapper" id="people-table">
      ${renderTable()}
    </div>
  `;

  // Event listeners
  const searchInput = container.querySelector('#search-input');
  const categoryFilter = container.querySelector('#category-filter');
  const roleFilter = container.querySelector('#role-filter');
  const statusFilter = container.querySelector('#status-filter');
  const clearBtn = container.querySelector('#clear-filters');
  const tableWrapper = container.querySelector('#people-table');
  const addPersonBtn = container.querySelector('#add-person-btn');

  let debounceTimer;

  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      filters.search = e.target.value;
      currentPage = 1;
      tableWrapper.innerHTML = renderTable();
      attachTableListeners();
    }, 300);
  });

  categoryFilter?.addEventListener('change', (e) => {
    filters.category = e.target.value;
    currentPage = 1;
    tableWrapper.innerHTML = renderTable();
    attachTableListeners();
  });

  roleFilter?.addEventListener('change', (e) => {
    filters.role = e.target.value;
    currentPage = 1;
    tableWrapper.innerHTML = renderTable();
    attachTableListeners();
  });

  statusFilter?.addEventListener('change', (e) => {
    filters.status = e.target.value;
    currentPage = 1;
    tableWrapper.innerHTML = renderTable();
    attachTableListeners();
  });

  clearBtn?.addEventListener('click', () => {
    filters = { search: '', category: '', role: '', status: '' };
    searchInput.value = '';
    categoryFilter.value = '';
    roleFilter.value = '';
    statusFilter.value = '';
    currentPage = 1;
    tableWrapper.innerHTML = renderTable();
    attachTableListeners();
  });

  addPersonBtn?.addEventListener('click', () => {
    showAddPersonModal();
  });

  function attachTableListeners() {
    // Row clicks
    tableWrapper.querySelectorAll('tr[data-person-id]').forEach(row => {
      row.addEventListener('click', () => {
        const personId = row.dataset.personId;
        showPersonDrawer(personId);
      });
    });

    // Pagination
    tableWrapper.querySelector('#prev-page')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        tableWrapper.innerHTML = renderTable();
        attachTableListeners();
      }
    });

    tableWrapper.querySelector('#next-page')?.addEventListener('click', () => {
      const { totalPages } = getPaginatedPeople();
      if (currentPage < totalPages) {
        currentPage++;
        tableWrapper.innerHTML = renderTable();
        attachTableListeners();
      }
    });

    tableWrapper.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page);
        tableWrapper.innerHTML = renderTable();
        attachTableListeners();
      });
    });
  }

  attachTableListeners();
}

function showPersonDrawer(personId) {
  const person = getPersonById(personId);
  if (!person) {
    window.showToast('Personel bulunamadı', 'error');
    return;
  }

  const leaves = getLeaves({ personId });
  const tracking = getTracking({ personId });
  const state = getState();

  const content = `
    <div class="d-flex items-center gap-4 mb-6">
      <div class="avatar avatar-xl" style="background: ${getCategoryBg(person.category)}; color: ${getCategoryColor(person.category)};">
        ${person.fullName.charAt(0)}
      </div>
      <div>
        <h2 class="text-2xl font-bold">${person.fullName}</h2>
        <div class="d-flex items-center gap-2 mt-2">
          ${person.category ? `<span class="badge badge-cat-${person.category.toLowerCase().replace(/[^a-z]/g, '')}">${person.category}</span>` : ''}
          ${person.role ? `<span class="badge badge-primary">${person.role}</span>` : ''}
          <span class="badge badge-status-${person.status}">${getStatusLabel(person.status)}</span>
        </div>
      </div>
    </div>

    ${person.needsReview ? `
      <div class="p-4 rounded-lg bg-warning-50 border border-warning-500 mb-6">
        <div class="d-flex items-center gap-2 text-warning font-medium">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          İnceleme Bekliyor
        </div>
        ${person.unmappedTags?.length > 0 ? `<p class="text-sm mt-2">Eşlenmemiş etiketler: ${person.unmappedTags.join(', ')}</p>` : ''}
      </div>
    ` : ''}

    <div class="border-t border-secondary pt-4 mb-4">
      <h3 class="font-semibold mb-3">Detaylar</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <div class="text-xs text-tertiary uppercase">Kaynak Dosya</div>
          <div class="text-sm mt-1">${person.sources?.[0]?.file || '-'}</div>
        </div>
        <div>
          <div class="text-xs text-tertiary uppercase">Oluşturulma</div>
          <div class="text-sm mt-1">${formatDate(person.createdAt)}</div>
        </div>
      </div>
    </div>

    ${person.trackingInfo ? `
      <div class="border-t border-secondary pt-4 mb-4">
        <h3 class="font-semibold mb-3">Takip Bilgileri</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-xs text-tertiary uppercase">Başvuru No</div>
            <div class="text-sm mt-1 font-mono">${person.trackingInfo.applicationNo || '-'}</div>
          </div>
          <div>
            <div class="text-xs text-tertiary uppercase">Durum</div>
            <div class="text-sm mt-1">${person.trackingInfo.status || '-'}</div>
          </div>
          <div>
            <div class="text-xs text-tertiary uppercase">Meslek</div>
            <div class="text-sm mt-1">${person.trackingInfo.profession || '-'}</div>
          </div>
          <div>
            <div class="text-xs text-tertiary uppercase">İrtibat</div>
            <div class="text-sm mt-1">${person.trackingInfo.contactPerson || '-'}</div>
          </div>
        </div>
      </div>
    ` : ''}

    ${leaves.length > 0 ? `
      <div class="border-t border-secondary pt-4 mb-4">
        <h3 class="font-semibold mb-3">İzinler</h3>
        <div class="d-flex flex-col gap-2">
          ${leaves.map(l => `
            <div class="p-3 rounded-lg bg-tertiary">
              <div class="d-flex justify-between">
                <span>${formatDate(l.startDate)} - ${formatDate(l.endDate)}</span>
                <span class="badge badge-info">${l.days} gün</span>
              </div>
              ${l.note ? `<div class="text-xs text-secondary mt-1">${l.note}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${tracking.length > 0 ? `
      <div class="border-t border-secondary pt-4">
        <h3 class="font-semibold mb-3">Takip Kayıtları</h3>
        <div class="d-flex flex-col gap-2">
          ${tracking.map(t => `
            <div class="p-3 rounded-lg bg-tertiary">
              <div class="d-flex justify-between items-center">
                <span class="font-mono text-sm">${t.applicationNo}</span>
                <span class="badge badge-neutral">${t.status}</span>
              </div>
              <div class="text-xs text-secondary mt-1">İrtibat: ${t.contactPerson || '-'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  const footer = state.isAdmin ? `
    <button class="btn btn-secondary" onclick="window.hideDrawer()">Kapat</button>
    <button class="btn btn-primary" onclick="window.editPerson('${personId}')">Düzenle</button>
  ` : `
    <button class="btn btn-secondary" onclick="window.hideDrawer()">Kapat</button>
  `;

  window.showDrawer(person.fullName, content, footer);
}

function showAddPersonModal() {
  const content = `
    <form id="add-person-form" class="d-flex flex-col gap-4">
      <div class="form-group">
        <label class="form-label required">Ad Soyad</label>
        <input type="text" class="form-input" name="fullName" required minlength="3">
      </div>
      <div class="form-group">
        <label class="form-label">Kategori</label>
        <select class="form-select" name="category">
          <option value="">Seçiniz</option>
          ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Rol</label>
        <select class="form-select" name="role">
          <option value="">Seçiniz</option>
          ${ROLES.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Durum</label>
        <select class="form-select" name="status">
          <option value="active">Aktif</option>
          <option value="pending">Bekleyen</option>
        </select>
      </div>
    </form>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="window.hideModal()">İptal</button>
    <button class="btn btn-primary" onclick="window.submitAddPerson()">Ekle</button>
  `;

  window.showModal('Yeni Personel Ekle', content, footer);
}

window.editPerson = (personId) => {
  const person = getPersonById(personId);
  if (!person) {
    window.showToast('Personel bulunamadı', 'error');
    return;
  }

  const content = `
    <form id="edit-person-form" class="d-flex flex-col gap-4">
      <input type="hidden" name="personId" value="${personId}">
      
      <!-- Name (read-only for now) -->
      <div class="form-group">
        <label class="form-label">Ad Soyad</label>
        <input type="text" class="form-input" value="${person.fullName}" disabled style="opacity: 0.7;">
        <div class="text-xs text-tertiary mt-1">İsim değişikliği için admin panelinden JSON düzenleme kullanın</div>
      </div>
      
      <!-- Category -->
      <div class="form-group">
        <label class="form-label">Kategori</label>
        <select class="form-select" name="category" id="edit-category">
          <option value="">Seçiniz</option>
          ${CATEGORIES.map(c => `<option value="${c}" ${person.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      
      <!-- Role -->
      <div class="form-group">
        <label class="form-label">Rol</label>
        <select class="form-select" name="role" id="edit-role">
          <option value="">Seçiniz</option>
          ${ROLES.map(r => `<option value="${r}" ${person.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
      
      <!-- Job Title -->
      <div class="form-group">
        <label class="form-label">İş Tanımı / Meslek</label>
        <input type="text" class="form-input" name="jobTitle" value="${person.jobTitle || ''}" placeholder="Örn: İnşaat İşçisi">
      </div>
      
      <!-- Status -->
      <div class="form-group">
        <label class="form-label">Durum</label>
        <select class="form-select" name="status" id="edit-status">
          <option value="active" ${person.status === 'active' ? 'selected' : ''}>✓ Aktif</option>
          <option value="pending" ${person.status === 'pending' ? 'selected' : ''}>⏳ Bekleyen</option>
          <option value="departed" ${person.status === 'departed' ? 'selected' : ''}>↗ Ayrıldı</option>
        </select>
      </div>
      
      <!-- Needs Review Toggle -->
      <div class="form-group">
        <label class="d-flex items-center gap-3 cursor-pointer">
          <input type="checkbox" name="needsReview" ${person.needsReview ? 'checked' : ''} style="width: 18px; height: 18px;">
          <span>İnceleme Bekliyor</span>
        </label>
      </div>
      
      ${person.unmappedTags?.length > 0 ? `
        <div class="p-3 rounded-lg bg-warning-50 border border-warning-200">
          <div class="font-medium text-sm mb-2">Eşlenmemiş Etiketler</div>
          <div class="d-flex flex-wrap gap-2">
            ${person.unmappedTags.map(t => `<span class="badge badge-warning">${t}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="border-t border-secondary pt-4 mt-2">
        <div class="text-xs text-tertiary">
          <div>Kayıt ID: <span class="font-mono">${personId.slice(0, 8)}...</span></div>
          <div>Oluşturulma: ${formatDate(person.createdAt)}</div>
          <div>Son Güncelleme: ${formatDate(person.updatedAt)}</div>
        </div>
      </div>
    </form>
  `;

  const footer = `
    <button class="btn btn-ghost" onclick="window.showPersonDrawer('${personId}')">İptal</button>
    <button class="btn btn-danger" onclick="window.confirmDeletePerson('${personId}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Sil
    </button>
    <button class="btn btn-primary" onclick="window.submitEditPerson()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
      </svg>
      Kaydet
    </button>
  `;

  window.showDrawer('Personel Düzenle', content, footer);
};

window.showPersonDrawer = (personId) => {
  showPersonDrawer(personId);
};

window.submitEditPerson = async () => {
  const form = document.getElementById('edit-person-form');
  if (!form) return;

  const formData = new FormData(form);
  const personId = formData.get('personId');

  const updates = {
    category: formData.get('category') || null,
    role: formData.get('role') || null,
    jobTitle: formData.get('jobTitle') || null,
    status: formData.get('status'),
    needsReview: formData.has('needsReview')
  };

  try {
    const { updatePerson } = await import('../store.js');
    const updated = updatePerson(personId, updates);

    window.showToast('Personel güncellendi', 'success');

    // Show updated drawer
    showPersonDrawer(personId);

    // Refresh table in background
    const tableWrapper = document.querySelector('#people-table');
    if (tableWrapper) {
      const { render } = await import('./people.js');
      render({});
    }
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};

window.confirmDeletePerson = (personId) => {
  const person = getPersonById(personId);
  if (!person) return;

  const content = `
    <div class="text-center p-4">
      <div class="text-4xl mb-4">⚠️</div>
      <h3 class="font-bold text-lg mb-2">Personeli Silmek Üzeresiniz</h3>
      <p class="text-secondary mb-4">"${person.fullName}" kalıcı olarak silinecek.</p>
      <p class="text-sm text-danger">Bu işlem geri alınamaz!</p>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="window.hideModal()">İptal</button>
    <button class="btn btn-danger" onclick="window.executeDeletePerson('${personId}')">Evet, Sil</button>
  `;

  window.showModal('Silme Onayı', content, footer);
};

window.executeDeletePerson = async (personId) => {
  try {
    const { deletePerson } = await import('../store.js');
    deletePerson(personId);

    window.hideModal();
    window.hideDrawer();
    window.showToast('Personel silindi', 'success');

    // Refresh table
    const { render } = await import('./people.js');
    render({});
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};

window.submitAddPerson = async () => {
  const form = document.getElementById('add-person-form');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    const { addPerson } = await import('../store.js');
    addPerson(data);
    window.hideModal();
    window.showToast('Personel eklendi', 'success');
    // Refresh the page
    const { render } = await import('./people.js');
    render({});
  } catch (err) {
    window.showToast(err.message, 'error');
  }
};

function renderPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
      .map(n => `<button class="pagination-btn page-btn ${n === current ? 'active' : ''}" data-page="${n}">${n}</button>`)
      .join('');
  }

  // Show first, last, and pages around current
  let pages = [1];

  if (current > 3) pages.push('...');

  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push('...');

  if (total > 1) pages.push(total);

  return pages.map(p => {
    if (p === '...') return `<span class="pagination-btn text-secondary">...</span>`;
    return `<button class="pagination-btn page-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }).join('');
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

function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || 'var(--text-secondary)';
}

function getCategoryBg(category) {
  const color = CATEGORY_COLORS[category];
  return color ? `${color}20` : 'var(--bg-tertiary)';
}
