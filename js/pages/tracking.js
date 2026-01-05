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
                    !t.applicationNo?.toLowerCase().includes(q)) {
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
          </tr>
        </thead>
        <tbody>
          ${filtered.length > 0 ? filtered.map(t => `
            <tr>
              <td class="cell-name">${t.person?.fullName || t.fullName || 'Bilinmeyen'}</td>
              <td class="cell-mono">${t.applicationNo || '-'}</td>
              <td class="cell-secondary">${t.profession || '-'}</td>
              <td>
                <span class="badge ${getStatusBadgeClass(t.status)}">${getStatusShort(t.status)}</span>
              </td>
              <td class="cell-mono">${formatDate(t.expectedDate) || t.notes || '-'}</td>
              <td class="cell-secondary">${t.contactPerson || '-'}</td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="6" class="text-center text-secondary p-6">Takip kaydı bulunamadı</td>
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
        <select class="form-select" id="status-filter" style="width: 200px;">
          <option value="">Tüm Durumlar</option>
          <option value="ÖN İZNİ ONAYLANDI">Ön İzni Onaylı</option>
          <option value="SAĞLIĞA SEVK EDİLECEK">Sevk Edilecek</option>
          <option value="SAĞLIĞA SEVK EDİLDİ">Sevk Edildi</option>
        </select>
        <select class="form-select" id="contact-filter" style="width: 160px;">
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
        }, 300);
    });

    statusSelect?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        tableWrapper.innerHTML = renderTable();
    });

    contactSelect?.addEventListener('change', (e) => {
        contactFilter = e.target.value;
        tableWrapper.innerHTML = renderTable();
    });

    addBtn?.addEventListener('click', () => {
        window.showToast('Takip kaydı ekleme yakında eklenecek', 'info');
    });
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
