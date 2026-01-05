/**
 * leaves.js - Leave records page module
 */

import { getLeaves, getPeople, getState } from '../store.js';
import { formatDate, daysBetween } from '../utils.js';

export async function render(ctx) {
    const container = document.getElementById('main-content');
    if (!container) return;

    const state = getState();
    const leaves = getLeaves();
    const people = getPeople();

    // Create person lookup
    const personMap = new Map(people.map(p => [p.personId, p]));

    // Enrich leaves with person data
    const enrichedLeaves = leaves.map(leave => ({
        ...leave,
        person: personMap.get(leave.personId)
    }));

    // Calculate stats
    const now = new Date();
    const activeLeaves = enrichedLeaves.filter(l => {
        const end = new Date(l.endDate);
        return end >= now;
    });
    const upcomingEnd = enrichedLeaves.filter(l => {
        const end = new Date(l.endDate);
        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return end >= now && end <= sevenDays;
    });

    let searchQuery = '';
    let typeFilter = '';

    function filterLeaves() {
        return enrichedLeaves.filter(l => {
            if (searchQuery && !l.person?.fullName.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }
            if (typeFilter && l.type !== typeFilter) {
                return false;
            }
            return true;
        });
    }

    function renderTable() {
        const filtered = filterLeaves();

        return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Personel</th>
            <th>Başlangıç</th>
            <th>Bitiş</th>
            <th>Gün</th>
            <th>Tür</th>
            <th>Not</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length > 0 ? filtered.map(l => {
            const endDate = new Date(l.endDate);
            const isActive = endDate >= now;
            const isEnding = endDate >= now && endDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            return `
              <tr>
                <td class="cell-name">${l.person?.fullName || 'Bilinmeyen'}</td>
                <td class="cell-mono">${formatDate(l.startDate)}</td>
                <td class="cell-mono">${formatDate(l.endDate)}</td>
                <td><span class="badge badge-neutral">${l.days}</span></td>
                <td><span class="badge ${l.type === 'ÜCRETSİZ' ? 'badge-warning' : 'badge-info'}">${l.type || 'NORMAL'}</span></td>
                <td class="cell-secondary">${l.note || '-'}</td>
                <td>
                  ${isEnding ? '<span class="badge badge-danger">⚠️ Bitiyor</span>' :
                    isActive ? '<span class="badge badge-success">Aktif</span>' :
                        '<span class="badge badge-neutral">Bitti</span>'}
                </td>
              </tr>
            `;
        }).join('') : `
            <tr>
              <td colspan="7" class="text-center text-secondary p-6">İzin kaydı bulunamadı</td>
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
          <h1 class="page-title">İzinler</h1>
          <p class="page-description">Personel izin kayıtları</p>
        </div>
        ${state.isAdmin ? `
          <button class="btn btn-primary" id="add-leave-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            İzin Ekle
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-6 mb-6">
      <div class="card">
        <div class="d-flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">Toplam Kayıt</div>
            <div class="text-3xl font-bold mt-1">${enrichedLeaves.length}</div>
          </div>
          <div class="avatar" style="background: var(--accent-light); color: var(--accent);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="d-flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">Aktif İzin</div>
            <div class="text-3xl font-bold mt-1">${activeLeaves.length}</div>
          </div>
          <div class="avatar" style="background: var(--color-success-50); color: var(--color-success-500);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
        </div>
      </div>
      <div class="card" style="border-left: 4px solid var(--color-warning-500);">
        <div class="d-flex items-center justify-between">
          <div>
            <div class="text-sm text-secondary">7 Gün İçinde Bitiyor</div>
            <div class="text-3xl font-bold text-warning mt-1">${upcomingEnd.length}</div>
          </div>
          <div class="avatar" style="background: var(--color-warning-50); color: var(--color-warning-500);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
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
          <input type="text" class="form-input" id="search-input" placeholder="Personel ara...">
        </div>
        <select class="form-select" id="type-filter" style="width: 160px;">
          <option value="">Tüm Türler</option>
          <option value="NORMAL">Normal</option>
          <option value="ÜCRETSİZ">Ücretsiz</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrapper" id="leaves-table">
      ${renderTable()}
    </div>
  `;

    // Event listeners
    const searchInput = container.querySelector('#search-input');
    const typeSelect = container.querySelector('#type-filter');
    const tableWrapper = container.querySelector('#leaves-table');
    const addBtn = container.querySelector('#add-leave-btn');

    searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        tableWrapper.innerHTML = renderTable();
    });

    typeSelect?.addEventListener('change', (e) => {
        typeFilter = e.target.value;
        tableWrapper.innerHTML = renderTable();
    });

    addBtn?.addEventListener('click', () => {
        window.showToast('İzin ekleme özelliği yakında eklenecek', 'info');
    });
}
