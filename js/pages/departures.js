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
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.length > 0 ? filtered.map(d => `
                      <tr>
                        <td class="cell-name">${d.fullName}</td>
                        <td>
                          ${d.category ?
                    `<span class="badge badge-cat-${d.category.toLowerCase().replace(/[^a-z]/g, '')}">${d.category}</span>` :
                    `<span class="badge badge-warning">⚠️ İnceleme</span>`
                }
                        </td>
                        <td class="cell-secondary">${d.job || '-'}</td>
                        <td class="cell-mono">${formatDate(d.entryDate)}</td>
                        <td class="cell-mono">${formatDate(d.exitDate)}</td>
                        <td><span class="badge badge-neutral">${d.totalDays || 0}</span></td>
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
          <button class="btn btn-secondary" id="export-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Dışa Aktar
          </button>
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

    searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        monthsContainer.innerHTML = renderMonthAccordion();
        attachMonthListeners();
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
            attachMonthListeners();
        });
    });

    exportBtn?.addEventListener('click', () => {
        exportToCsv();
    });

    function attachMonthListeners() {
        monthsContainer.querySelectorAll('.month-header').forEach(header => {
            header.addEventListener('click', () => {
                const month = header.dataset.month;
                if (expandedMonths.has(month)) {
                    expandedMonths.delete(month);
                } else {
                    expandedMonths.add(month);
                }
                monthsContainer.innerHTML = renderMonthAccordion();
                attachMonthListeners();
            });
        });
    }

    attachMonthListeners();
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
