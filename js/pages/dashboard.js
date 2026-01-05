/**
 * dashboard.js - Dashboard page module
 */

import {
  getStats,
  getPeople,
  getLeaves,
  getDepartures,
  getConflicts,
  getUnmappedTags,
  getState
} from '../store.js';
import { CATEGORIES, CATEGORY_COLORS } from '../taxonomy.js';
import { formatDate, getMonthDisplay } from '../utils.js';

export async function render(ctx) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const stats = getStats();
  const state = getState();
  const upcomingLeaves = getLeaves({ upcoming: true });
  const recentDepartures = getDepartures().slice(0, 5);
  const conflicts = getConflicts().filter(c => !c.resolved);
  const unmappedTags = getUnmappedTags();

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <p class="page-description">Personel yönetim sistemi özet görünümü</p>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-kpi mb-6">
      ${renderKpiCard('Aktif Roster', stats.activeRosterCount || 0, 'users', 'primary', 'SAYILAR Genel Toplam')}
      ${renderKpiCard('Bekleyen', stats.pendingCount || 0, 'clock', 'warning', 'Takip listesindeki yeni başvurular')}
      ${renderKpiCard('Ayrılan', stats.departedCount || 0, 'log-out', 'neutral', 'İşten ayrılan toplam')}
      ${renderKpiCard('Çakışma', stats.conflictCount || 0, 'alert-circle', stats.conflictCount > 0 ? 'danger' : 'success', 'Aktif + Ayrılan çakışmaları')}
    </div>

    <!-- Alerts Row -->
    ${conflicts.length > 0 || unmappedTags.length > 0 ? `
      <div class="grid grid-cols-2 mb-6">
        ${conflicts.length > 0 ? `
          <div class="card" style="border-left: 4px solid var(--color-danger-500);">
            <div class="card-header">
              <h3 class="card-title text-danger">⚠️ Çözülmemiş Çakışmalar</h3>
              <span class="badge badge-danger">${conflicts.length}</span>
            </div>
            <p class="text-sm text-secondary">
              Aynı kişi hem aktif hem ayrılan listesinde görünüyor.
              ${state.isAdmin ? '<a href="#/needs-review" class="text-accent ml-2">İncele →</a>' : ''}
            </p>
          </div>
        ` : ''}
        ${unmappedTags.length > 0 ? `
          <div class="card" style="border-left: 4px solid var(--color-warning-500);">
            <div class="card-header">
              <h3 class="card-title text-warning">📋 Eşlenmemiş Etiketler</h3>
              <span class="badge badge-warning">${unmappedTags.length}</span>
            </div>
            <p class="text-sm text-secondary">
              ${unmappedTags.slice(0, 3).join(', ')}${unmappedTags.length > 3 ? '...' : ''}
              ${state.isAdmin ? '<a href="#/admin" class="text-accent ml-2">Eşle →</a>' : ''}
            </p>
          </div>
        ` : ''}
      </div>
    ` : ''}

    <div class="grid grid-cols-2 gap-6">
      <!-- Category Distribution -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Kategori Dağılımı</h3>
          <a href="#/categories" class="btn btn-ghost btn-sm">Tümünü Gör</a>
        </div>
        <div class="card-body">
          ${renderCategoryChart(stats.byCategory || {})}
        </div>
      </div>

      <!-- Upcoming Leave Expirations -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Yaklaşan İzin Bitişleri</h3>
          <span class="badge badge-info">${upcomingLeaves.length}</span>
        </div>
        <div class="card-body">
          ${upcomingLeaves.length > 0 ? `
            <div class="d-flex flex-col gap-3">
              ${upcomingLeaves.slice(0, 5).map(leave => {
    const person = getPeople().find(p => p.personId === leave.personId);
    return `
                  <div class="d-flex items-center justify-between p-3 rounded-lg bg-tertiary">
                    <div>
                      <div class="font-medium">${person?.fullName || 'Bilinmeyen'}</div>
                      <div class="text-sm text-secondary">Bitiş: ${formatDate(leave.endDate)}</div>
                    </div>
                    <span class="badge badge-warning">${leave.days} gün</span>
                  </div>
                `;
  }).join('')}
            </div>
          ` : `
            <div class="empty-state p-6">
              <div class="text-tertiary text-sm">Yaklaşan izin bitişi yok</div>
            </div>
          `}
        </div>
      </div>
    </div>

    <!-- Recent Departures -->
    <div class="card mt-6">
      <div class="card-header">
        <h3 class="card-title">Son Ayrılanlar</h3>
        <a href="#/departures" class="btn btn-ghost btn-sm">Tümünü Gör</a>
      </div>
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
            ${recentDepartures.length > 0 ? recentDepartures.map(dep => `
              <tr>
                <td class="cell-name">${dep.fullName}</td>
                <td>${dep.category ? `<span class="badge badge-cat-${dep.category.toLowerCase().replace(/[^a-z]/g, '')}">${dep.category}</span>` : '<span class="badge badge-neutral">-</span>'}</td>
                <td class="cell-secondary">${dep.job || '-'}</td>
                <td class="cell-mono">${formatDate(dep.entryDate)}</td>
                <td class="cell-mono">${formatDate(dep.exitDate)}</td>
                <td><span class="badge badge-neutral">${dep.totalDays || 0}</span></td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="6" class="text-center text-secondary p-6">Henüz ayrılan personel kaydı yok</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Role Distribution -->
    <div class="card mt-6">
      <div class="card-header">
        <h3 class="card-title">Rol Dağılımı</h3>
        <a href="#/roles" class="btn btn-ghost btn-sm">Tümünü Gör</a>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-4 gap-4">
          ${renderRoleCards(stats.byRole || {})}
        </div>
      </div>
    </div>
  `;
}

function renderKpiCard(label, value, icon, variant, tooltip = '') {
  const colors = {
    primary: 'var(--accent)',
    success: 'var(--color-success-500)',
    warning: 'var(--color-warning-500)',
    danger: 'var(--color-danger-500)',
    neutral: 'var(--text-secondary)'
  };

  const bgColors = {
    primary: 'var(--accent-light)',
    success: 'var(--color-success-50)',
    warning: 'var(--color-warning-50)',
    danger: 'var(--color-danger-50)',
    neutral: 'var(--bg-tertiary)'
  };

  const icons = {
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'check-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    'clock': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'log-out': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    'alert-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  return `
    <div class="card kpi-card" ${tooltip ? `title="${tooltip}"` : ''}>
      <div class="kpi-icon" style="background: ${bgColors[variant]}; color: ${colors[variant]};">
        ${icons[icon] || ''}
      </div>
      <div class="kpi-value">${value.toLocaleString('tr-TR')}</div>
      <div class="kpi-label">${label}</div>
    </div>
  `;
}

function renderCategoryChart(byCategory) {
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0) || 1;

  return `
    <div class="d-flex flex-col gap-3">
      ${CATEGORIES.map(cat => {
    const count = byCategory[cat] || 0;
    const percentage = Math.round((count / total) * 100);
    const color = CATEGORY_COLORS[cat] || 'var(--text-tertiary)';

    return `
          <div class="d-flex items-center gap-3">
            <div class="w-24 text-sm font-medium truncate" title="${cat}">${cat}</div>
            <div class="flex-1 h-2 rounded-full bg-tertiary overflow-hidden">
              <div class="h-full rounded-full transition-all" style="width: ${percentage}%; background: ${color};"></div>
            </div>
            <div class="w-12 text-right text-sm font-medium">${count}</div>
          </div>
        `;
  }).join('')}
      ${byCategory['UNCATEGORIZED'] > 0 ? `
        <div class="d-flex items-center gap-3">
          <div class="w-24 text-sm font-medium truncate text-warning">Kategorisiz</div>
          <div class="flex-1 h-2 rounded-full bg-tertiary overflow-hidden">
            <div class="h-full rounded-full" style="width: ${Math.round((byCategory['UNCATEGORIZED'] / total) * 100)}%; background: var(--color-warning-500);"></div>
          </div>
          <div class="w-12 text-right text-sm font-medium text-warning">${byCategory['UNCATEGORIZED']}</div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderRoleCards(byRole) {
  const roles = Object.entries(byRole).filter(([role, count]) => role !== 'UNASSIGNED' && count > 0);

  if (roles.length === 0) {
    return '<div class="text-center text-secondary p-4">Rol verisi yok</div>';
  }

  return roles.map(([role, count]) => `
    <div class="p-4 rounded-lg bg-tertiary text-center">
      <div class="text-2xl font-bold text-primary">${count}</div>
      <div class="text-xs text-secondary mt-1 truncate" title="${role}">${role}</div>
    </div>
  `).join('');
}
