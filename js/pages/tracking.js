/**
 * tracking.js - Permit tracking page module
 */

import { getTracking, getPeople, getState } from '../store.js';
import { formatDate } from '../utils.js';

export async function render(ctx) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const state = getState();
  const tracking = getTracking();
  const people = getPeople();

  // Create person lookup
  const personMap = new Map(people.map(p => [p.personId, p]));

  // Enrich tracking with person data
  const enrichedTracking = tracking.map(t => ({
    ...t,
    person: personMap.get(t.personId)
  }));

  // Group by status
  const byStatus = {
    'ÖN İZNİ ONAYLANDI': enrichedTracking.filter(t => t.status === 'ÖN İZNİ ONAYLANDI'),
    'SAĞLIĞA SEVK EDİLECEK': enrichedTracking.filter(t => t.status === 'SAĞLIĞA SEVK EDİLECEK'),
    'SAĞLIĞA SEVK EDİLDİ': enrichedTracking.filter(t => t.status === 'SAĞLIĞA SEVK EDİLDİ')
  };

  // Get unique contact persons
  const contactPersons = [...new Set(enrichedTracking.map(t => t.contactPerson).filter(Boolean))];

  let searchQuery = '';
  let statusFilter = '';
  let contactFilter = '';

  function filterTracking() {
    return enrichedTracking.filter(t => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.person?.fullName.toLowerCase().includes(q) &&
          !t.applicationNo?.toLowerCase().includes(q) &&
          !t.fullName?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (statusFilter && t.status !== statusFilter) {
        return false;
      }
      if (contactFilter && t.contactPerson !== contactFilter) {
        return false;
      }
      return true;
    });
  }

  function renderTable() {
    const filtered = filterTracking();

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Personel</th>
            <th>Başvuru No</th>
            <th>Meslek</th>
            <th>Durum</th>
            <th>Tarih</th>
            <th>İrtibat</th>
            ${state.isAdmin ? '<th>İşlem</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${filtered.length > 0 ? filtered.map(t => {
      const hasId = t.id || t.trackingId;

      return `
            <tr>
              <td class="cell-name">${t.person?.fullName || t.fullName || 'Bilinmeyen'}</td>
              <td class="cell-mono">${t.applicationNo || '-'}</td>
              <td class="cell-secondary">${t.profession || '-'}</td>
              <td>
                <span class="badge ${getStatusBadgeClass(t.status)}">${getStatusShort(t.status)}</span>
              </td>
              <td class="cell-mono">${formatDate(t.expectedDate) || t.notes || '-'}</td>
              <td class="cell-secondary">${t.contactPerson || '-'}</td>
              ${state.isAdmin ? `
              <td>
                ${hasId ? `
                  <div class="d-flex gap-2">
                      <button class="btn btn-icon btn-sm text-primary edit-tracking-btn" data-id="${hasId}" title="Düzenle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button class="btn btn-icon btn-sm text-danger delete-tracking-btn" data-id="${hasId}" title="Sil">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                  </div>
                ` : '<span class="text-xs text-tertiary">Salt Okunur</span>'}
              </td>
              ` : ''}
            </tr>
          `;
    }).join('') : `
            <tr>
              <td colspan="${state.isAdmin ? 7 : 6}" class="text-center text-secondary p-6">Takip kaydı bulunamadı</td>
            </tr>
          `}
        </tbody>
      </table>
    `;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="d-flex items-center justify-between">
        <div>
          <h1 class="page-title">Çalışma İzni Takibi</h1>
          <p class="page-description">Ön izin ve çalışma izni süreç takibi</p>
        </div>
        ${state.isAdmin ? `
          <button class="btn btn-primary" id="add-tracking-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Kayıt Ekle
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Status Summary -->
    <div class="grid grid-cols-3 gap-6 mb-6">
      <div class="card">
        <div class="d-flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">Ön İzni Onaylı</div>
            <div class="text-3xl font-bold mt-1">${byStatus['ÖN İZNİ ONAYLANDI'].length}</div>
          </div>
          <div class="avatar" style="background: var(--color-success-50); color: var(--color-success-500);">✓</div>
        </div>
      </div>
      <div class="card">
        <div class="d-flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">Sağlığa Sevk Edilecek</div>
            <div class="text-3xl font-bold mt-1">${byStatus['SAĞLIĞA SEVK EDİLECEK'].length}</div>
          </div>
          <div class="avatar" style="background: var(--color-warning-50); color: var(--color-warning-500);">⏳</div>
        </div>
      </div>
      <div class="card">
        <div class="d-flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">Sağlığa Sevk Edildi</div>
            <div class="text-3xl font-bold mt-1">${byStatus['SAĞLIĞA SEVK EDİLDİ'].length}</div>
          </div>
          <div class="avatar" style="background: var(--color-info-50); color: var(--color-info-500);">🏥</div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="card mb-6">
      <div class="d-flex items-center gap-4 flex-wrap">
        <div class="search-input flex-1" style="min-width: 200px;">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" class="form-input" id="search-input" placeholder="İsim veya başvuru no ara...">
        </div>
        <select class="form-select filter-select" id="status-filter">
          <option value="">Tüm Durumlar</option>
          <option value="ÖN İZNİ ONAYLANDI">Ön İzni Onaylı</option>
          <option value="SAĞLIĞA SEVK EDİLECEK">Sevk Edilecek</option>
          <option value="SAĞLIĞA SEVK EDİLDİ">Sevk Edildi</option>
        </select>
        <select class="form-select filter-select" id="contact-filter">
          <option value="">Tüm İrtibatlar</option>
          ${contactPersons.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrapper" id="tracking-table">
      ${renderTable()}
    </div>
  `;

  // Event listeners
  const searchInput = container.querySelector('#search-input');
  const statusSelect = container.querySelector('#status-filter');
  const contactSelect = container.querySelector('#contact-filter');
  const tableWrapper = container.querySelector('#tracking-table');
  const addBtn = container.querySelector('#add-tracking-btn');

  let debounceTimer;

  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = e.target.value;
      tableWrapper.innerHTML = renderTable();
      attachRowListeners();
    }, 300);
  });

  statusSelect?.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    tableWrapper.innerHTML = renderTable();
    attachRowListeners();
  });

  contactSelect?.addEventListener('change', (e) => {
    contactFilter = e.target.value;
    tableWrapper.innerHTML = renderTable();
    attachRowListeners();
  });

  function attachRowListeners() {
    // Delete
    container.querySelectorAll('.delete-tracking-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu takip kaydını silmek istediğinize emin misiniz?')) return;
        try {
          const { deleteTracking } = await import('../store.js');
          deleteTracking(btn.dataset.id);
          window.showToast('Kayıt silindi', 'success');
          render(ctx);
        } catch (err) {
          window.showToast(err.message, 'error');
        }
      });
    });

    // Edit
    container.querySelectorAll('.edit-tracking-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const record = enrichedTracking.find(t => (t.id || t.trackingId) === id);
        if (record) openModal(record);
      });
    });
  }

  attachRowListeners();

  // Add/Edit Modal
  addBtn?.addEventListener('click', () => openModal(null));

  function openModal(record) {
    // People select options (Active + Pending)
    const relevantPeople = getPeople().filter(p => !p.status || p.status !== 'departed')
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const isEdit = !!record;

    const formHtml = `
            <form id="tracking-form" class="d-flex flex-col gap-4">
                <div class="form-group">
                    <label class="form-label required">Personel</label>
                    <div class="select-wrapper">
                        <select class="form-select" name="personId" required>
                            <option value="">Seçiniz...</option>
                            ${relevantPeople.map(p => `
                                <option value="${p.personId}" ${isEdit && record.personId === p.personId ? 'selected' : ''}>
                                    ${p.fullName} (${p.status || 'Active'})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">Başvuru No</label>
                        <input type="text" class="form-input" name="applicationNo" value="${isEdit ? (record.applicationNo || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Meslek</label>
                        <input type="text" class="form-input" name="profession" value="${isEdit ? (record.profession || '') : ''}">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                     <div class="form-group">
                        <label class="form-label">Tarih</label>
                        <input type="date" class="form-input" name="expectedDate" value="${isEdit ? (record.expectedDate ? record.expectedDate.split('T')[0] : '') : ''}">
                    </div>
                     <div class="form-group">
                        <label class="form-label">İrtibat Kişisi</label>
                        <input type="text" class="form-input" name="contactPerson" value="${isEdit ? (record.contactPerson || '') : ''}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Durum</label>
                    <select class="form-select" name="status">
                        <option value="ÖN İZNİ ONAYLANDI" ${isEdit && record.status === 'ÖN İZNİ ONAYLANDI' ? 'selected' : ''}>Ön İzni Onaylandı</option>
                        <option value="SAĞLIĞA SEVK EDİLECEK" ${isEdit && record.status === 'SAĞLIĞA SEVK EDİLECEK' ? 'selected' : ''}>Sağlığa Sevk Edilecek</option>
                        <option value="SAĞLIĞA SEVK EDİLDİ" ${isEdit && record.status === 'SAĞLIĞA SEVK EDİLDİ' ? 'selected' : ''}>Sağlığa Sevk Edildi</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Notlar</label>
                    <textarea class="form-input" name="notes" rows="2">${isEdit ? (record.notes || '') : ''}</textarea>
                </div>
            </form>
        `;

    window.showModal(isEdit ? 'Kayıt Düzenle' : 'Yeni Takip Kaydı', formHtml, `
            <button class="btn btn-secondary" onclick="hideModal()">İptal</button>
            <button class="btn btn-primary" id="save-tracking-btn">${isEdit ? 'Güncelle' : 'Kaydet'}</button>
        `);

    document.getElementById('save-tracking-btn').addEventListener('click', async () => {
      const form = document.getElementById('tracking-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      try {
        const module = await import('../store.js');
        if (isEdit) {
          module.updateTracking(record.id || record.trackingId, data);
          window.showToast('Kayıt güncellendi', 'success');
        } else {
          module.addTracking(data);
          window.showToast('Kayıt oluşturuldu', 'success');
        }
        window.hideModal();
        render(ctx);
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  }
}

function getStatusBadgeClass(status) {
  if (status?.includes('ONAYLANDI')) return 'badge-success';
  if (status?.includes('EDİLECEK')) return 'badge-warning';
  if (status?.includes('EDİLDİ')) return 'badge-info';
  return 'badge-neutral';
}

function getStatusShort(status) {
  if (status === 'ÖN İZNİ ONAYLANDI') return 'Onaylı';
  if (status === 'SAĞLIĞA SEVK EDİLECEK') return 'Sevk Edilecek';
  if (status === 'SAĞLIĞA SEVK EDİLDİ') return 'Sevk Edildi';
  return status || '-';
}
