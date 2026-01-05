/**
 * departures.js - Departures report page module
 * Ferit's requirements: Monthly breakdown + Category distribution
 */

import { getDepartures, getDeparturesByMonth, getState } from '../store.js';
import { CATEGORIES, CATEGORY_COLORS } from '../taxonomy.js';
import { formatDate, getMonthDisplay } from '../utils.js';

export async function render(ctx) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const state = getState();
  const departuresByMonth = getDeparturesByMonth();
  const allDepartures = getDepartures();

  // Total stats
  const totalDeparted = allDepartures.length;
  const totalDays = allDepartures.reduce((sum, d) => sum + (d.totalDays || 0), 0);
  const avgDays = totalDeparted > 0 ? Math.round(totalDays / totalDeparted) : 0;

  // Category totals
  const categoryTotals = {};
  CATEGORIES.forEach(cat => {
    categoryTotals[cat] = allDepartures.filter(d => d.category === cat).length;
  });
  categoryTotals['UNCATEGORIZED'] = allDepartures.filter(d => !d.category).length;

  let expandedMonths = new Set([departuresByMonth[0]?.month]); // Expand first month by default
  let searchQuery = '';
  let categoryFilter = '';

  function filterDepartures(departures) {
    return departures.filter(d => {
      if (searchQuery && !d.fullName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (categoryFilter && d.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }

  function renderMonthAccordion() {
    if (departuresByMonth.length === 0) {
      return `
        <div class="empty-state">
          <div class="text-tertiary">Ayrılan personel kaydı bulunamadı</div>
        </div>
      `;
    }

    return departuresByMonth.map(({ month, departures, count, byCategory }) => {
      const isExpanded = expandedMonths.has(month);
      const filtered = filterDepartures(departures);
      const displayMonth = getMonthDisplay(month);

      // Category distribution mini chart
      const catDist = CATEGORIES.map(cat => ({
        cat,
        count: byCategory[cat] || 0,
        color: CATEGORY_COLORS[cat]
      })).filter(c => c.count > 0);

      return `
        <div class="card mb-4" data-month="${month}">
          <div class="d-flex items-center justify-between cursor-pointer month-header" data-month="${month}">
            <div class="d-flex items-center gap-4">
              <div class="avatar" style="background: var(--accent-light); color: var(--accent);">
                ${month.split('-')[1]}
              </div>
              <div>
                <h3 class="font-semibold">${displayMonth}</h3>
                <div class="d-flex items-center gap-2 mt-1">
                  ${catDist.slice(0, 5).map(c => `
                    <span class="badge" style="background: ${c.color}20; color: ${c.color};">${c.cat}: ${c.count}</span>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="d-flex items-center gap-4">
              <span class="text-2xl font-bold">${count}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" 
                   style="transform: rotate(${isExpanded ? '180deg' : '0deg'}); transition: transform 0.2s;">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          
          ${isExpanded ? `
            <div class="mt-4 pt-4 border-t border-secondary">
              <div class="table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>Kategori</th>
                      <th>Görevi</th>
                      <th>Giriş Tarihi</th>
                      <th>Çıkış Tarihi</th>
                      <th>Toplam Gün</th>
                      ${state.isAdmin ? `<th>İşlem</th>` : ''}
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.length > 0 ? filtered.map(d => `
                      <tr>
                        <td class="cell-name">${d.fullName}</td>
                        <td>
                          ${d.category ?
          `<span class="badge badge-cat-${d.category.toLowerCase().replace(/[^a-z]/g, '')}">${d.category}</span>` :
          `<span class="badge badge-neutral">-</span>`
        }
                        </td>
                        <td class="cell-secondary">${d.job || '-'}</td>
                        <td class="cell-mono">${formatDate(d.entryDate)}</td>
                        <td class="cell-mono">${formatDate(d.exitDate)}</td>
                        <td><span class="badge badge-neutral">${d.totalDays || 0}</span></td>
                        ${state.isAdmin ? `
                        <td>
                          <div class="d-flex gap-2">
                            <button class="btn btn-icon btn-sm text-secondary edit-departure-btn" data-id="${d.id}" title="Düzenle">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                            <button class="btn btn-icon btn-sm text-danger delete-departure-btn" data-id="${d.id}" title="Sil">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                        ` : ''}
                      </tr>
                    `).join('') : `
                      <tr>
                        <td colspan="6" class="text-center text-secondary p-4">Filtreye uygun kayıt yok</td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="d-flex items-center justify-between">
        <div>
          <h1 class="page-title">İşten Ayrılanlar</h1>
          <p class="page-description">Aylık ve kategoriye göre ayrılan personel raporu</p>
        </div>
        ${state.isAdmin ? `
          <div class="d-flex gap-2">
            <button class="btn btn-secondary" id="export-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Dışa Aktar
            </button>
            <button class="btn btn-primary" id="add-departure-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Kayıt Ekle
            </button>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-4 gap-6 mb-6">
      <div class="card">
        <div class="text-sm text-secondary">Toplam Ayrılan</div>
        <div class="text-3xl font-bold mt-2">${totalDeparted}</div>
      </div>
      <div class="card">
        <div class="text-sm text-secondary">Ortalama Çalışma Süresi</div>
        <div class="text-3xl font-bold mt-2">${avgDays} <span class="text-lg font-normal text-secondary">gün</span></div>
      </div>
      <div class="card">
        <div class="text-sm text-secondary">Ay Sayısı</div>
        <div class="text-3xl font-bold mt-2">${departuresByMonth.length}</div>
      </div>
      <div class="card" style="border-left: 4px solid var(--color-warning-500);">
        <div class="text-sm text-secondary">Kategorisiz</div>
        <div class="text-3xl font-bold text-warning mt-2">${categoryTotals['UNCATEGORIZED']}</div>
      </div>
    </div>

    <!-- Category Distribution -->
    <div class="card mb-6">
      <h3 class="font-semibold mb-4">Kategori Dağılımı</h3>
      <div class="d-flex gap-4 flex-wrap">
        ${CATEGORIES.map(cat => `
          <div class="d-flex items-center gap-2 p-2 rounded-lg cursor-pointer transition category-chip ${categoryFilter === cat ? 'bg-accent-light' : 'bg-tertiary'}"
               data-category="${cat}">
            <div class="w-3 h-3 rounded-full" style="background: ${CATEGORY_COLORS[cat]};"></div>
            <span class="font-medium">${cat}</span>
            <span class="badge badge-neutral">${categoryTotals[cat]}</span>
          </div>
        `).join('')}
        <div class="d-flex items-center gap-2 p-2 rounded-lg cursor-pointer transition category-chip ${!categoryFilter ? 'bg-accent-light' : 'bg-tertiary'}"
             data-category="">
          <span class="font-medium">Tümü</span>
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

    <!-- Monthly Accordions -->
    <div id="months-container">
      ${renderMonthAccordion()}
    </div>
  `;

  // Event listeners
  const searchInput = container.querySelector('#search-input');
  const monthsContainer = container.querySelector('#months-container');
  const categoryChips = container.querySelectorAll('.category-chip');
  const exportBtn = container.querySelector('#export-btn');
  const addBtn = container.querySelector('#add-departure-btn');

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    monthsContainer.innerHTML = renderMonthAccordion();
    attachListeners();
  });

  categoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
      categoryFilter = chip.dataset.category;

      // Update active state
      categoryChips.forEach(c => {
        c.classList.toggle('bg-accent-light', c.dataset.category === categoryFilter);
        c.classList.toggle('bg-tertiary', c.dataset.category !== categoryFilter);
      });

      monthsContainer.innerHTML = renderMonthAccordion();
      attachListeners();
    });
  });

  exportBtn?.addEventListener('click', () => {
    exportToCsv();
  });

  // Action Listeners (Month + CRUD)
  function attachListeners() {
    // Accordion toggle
    monthsContainer.querySelectorAll('.month-header').forEach(header => {
      header.addEventListener('click', (e) => {
        // Prevent toggling if clicking action buttons inside
        if (e.target.closest('button')) return;

        const month = header.dataset.month;
        if (expandedMonths.has(month)) {
          expandedMonths.delete(month);
        } else {
          expandedMonths.add(month);
        }
        monthsContainer.innerHTML = renderMonthAccordion();
        attachListeners();
      });
    });

    // Delete Buttons
    monthsContainer.querySelectorAll('.delete-departure-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu ayrılan kaydını silmek istediğinize emin misiniz?')) return;

        try {
          const { deleteDeparture } = await import('../store.js');
          deleteDeparture(btn.dataset.id);
          window.showToast('Kayıt silindi', 'success');
          render(ctx);
        } catch (err) {
          window.showToast(err.message, 'error');
        }
      });
    });

    // Edit Buttons
    monthsContainer.querySelectorAll('.edit-departure-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const departure = allDepartures.find(d => d.id === id);
        if (departure) openModal(departure);
      });
    });
  }

  attachListeners();

  // Add/Edit Modal
  function openModal(editingRecord = null) {
    const isEdit = !!editingRecord;

    const formHtml = `
            <form id="departure-form" class="d-flex flex-col gap-4">
                <div class="form-group">
                    <label class="form-label required">Ad Soyad</label>
                    <input type="text" class="form-input" name="fullName" required value="${isEdit ? editingRecord.fullName : ''}">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">Kategori</label>
                        <select class="form-select" name="category">
                            <option value="">Seçiniz...</option>
                            ${CATEGORIES.map(c => `
                                <option value="${c}" ${isEdit && editingRecord.category === c ? 'selected' : ''}>${c}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Görevi</label>
                        <input type="text" class="form-input" name="job" value="${isEdit ? (editingRecord.job || '') : ''}">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">Giriş Tarihi</label>
                        <input type="date" class="form-input" name="entryDate" value="${isEdit ? (editingRecord.entryDate || '') : ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Çıkış Tarihi</label>
                        <input type="date" class="form-input" name="exitDate" required value="${isEdit ? (editingRecord.exitDate || '') : ''}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Toplam Gün (Otomatik Hesaplanır)</label>
                    <input type="number" class="form-input" name="totalDays" placeholder="Boş bırakılırsa tarihe göre hesaplanır" value="${isEdit ? (editingRecord.totalDays || '') : ''}">
                </div>
            </form>
      `;

    window.showModal(isEdit ? 'Kaydı Düzenle' : 'Yeni Ayrılan Kaydı', formHtml, `
        <button class="btn btn-secondary" onclick="hideModal()">İptal</button>
        <button class="btn btn-primary" id="save-dep-btn">${isEdit ? 'Güncelle' : 'Kaydet'}</button>
      `);

    document.getElementById('save-dep-btn').addEventListener('click', async () => {
      const form = document.getElementById('departure-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      if (data.totalDays) data.totalDays = parseInt(data.totalDays);

      try {
        const { addDeparture, updateDeparture } = await import('../store.js');
        if (isEdit) {
          updateDeparture(editingRecord.id, data);
          window.showToast('Kayıt güncellendi', 'success');
        } else {
          addDeparture(data);
          window.showToast('Kayıt oluşturuldu', 'success');
        }
        window.hideModal();
        render(ctx);
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  }

  addBtn?.addEventListener('click', () => openModal());
}

function exportToCsv() {
  const departures = getDepartures();

  const headers = ['Ad Soyad', 'Kategori', 'Görevi', 'Giriş Tarihi', 'Çıkış Tarihi', 'Toplam Gün', 'Çıkış Ayı'];
  const rows = departures.map(d => [
    d.fullName,
    d.category || 'Kategorisiz',
    d.job || '',
    d.entryDate || '',
    d.exitDate || '',
    d.totalDays || 0,
    d.exitMonth || ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ayrilanlar_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();

  window.showToast('CSV dosyası indirildi', 'success');
}
