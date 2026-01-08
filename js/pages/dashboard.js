/**
 * dashboard.js - Dashboard page module
 */

import {
  getStats,
  getPeople,
  getDepartures
} from '../store.js';
import { CATEGORIES, CATEGORY_COLORS } from '../taxonomy.js';
import { formatDate } from '../utils.js';

export async function render(ctx) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const stats = getStats();
  const recentDepartures = getDepartures().slice(0, 5);

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <p class="page-description">Personel yönetim sistemi özet görünümü</p>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-kpi mb-6">
      ${renderKpiCard('Aktif Personel', stats.activeRosterCount || 0, 'users', 'primary')}
      ${renderKpiCard('Bekleyen', stats.pendingCount || 0, 'clock', 'warning')}
      ${renderKpiCard('Ayrılan', stats.departedCount || 0, 'log-out', 'neutral')}
    </div>

    <!-- Category Distribution & Chart -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Kategori Dağılımı</h3>
        <a href="#/categories" class="btn btn-ghost btn-sm">Tümünü Gör</a>
      </div>
      <div class="card-body">
        ${renderCategoryDonutChart(stats.byCategory || {})}
      </div>
    </div>

    <!-- Role Distribution -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Rol Dağılımı</h3>
        <a href="#/roles" class="btn btn-ghost btn-sm">Tümünü Gör</a>
      </div>
      <div class="card-body custom-scrollbar" style="max-height: 240px; overflow-y: auto;">
        <div class="grid grid-cols-2 sm:grid-cols-1 gap-3 content-start">
          ${renderRoleCards(stats.byRole || {})}
        </div>
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
              <td class="cell-mono">${formatDate(dep.exitDate)}</td>
              <td><span class="badge badge-neutral">${dep.totalDays || 0}</span></td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="5" class="text-center text-secondary p-6">Henüz ayrılan personel kaydı yok</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  </div>
  `;
}

function renderKpiCard(label, value, icon, variant) {
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
    'log-out': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
  };

  return `
    <div class="card kpi-card">
      <div class="kpi-icon" style="background: ${bgColors[variant]}; color: ${colors[variant]};">
        ${icons[icon] || ''}
      </div>
      <div class="kpi-value">${value.toLocaleString('tr-TR')}</div>
      <div class="kpi-label">${label}</div>
    </div>
  `;
}

function renderCategoryDonutChart(byCategory) {
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0) || 1;
  const cats = CATEGORIES.filter(c => byCategory[c] > 0).sort((a, b) => byCategory[b] - byCategory[a]);

  let currentOffset = 0;
  // SVG size and calculations
  const size = 200;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const segments = cats.map(cat => {
    const count = byCategory[cat];
    const percentage = count / total;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    const color = CATEGORY_COLORS[cat] || '#ccc';

    currentOffset += percentage * circumference;

    return `<circle 
      cx="${center}" 
      cy="${center}" 
      r="${radius}" 
      fill="transparent" 
      stroke="${color}" 
      stroke-width="24" 
      stroke-dasharray="${strokeDasharray}" 
      stroke-dashoffset="${strokeDashoffset}"
      class="chart-segment"
    />`;
  }).join('');

  const legend = cats.map(cat => {
    const count = byCategory[cat];
    const color = CATEGORY_COLORS[cat] || '#ccc';
    const percentage = Math.round((count / total) * 100);

    return `
      <div class="d-flex items-center justify-between text-sm py-2 border-b border-secondary last:border-0 hover:bg-tertiary px-2 rounded transition">
        <div class="d-flex items-center gap-2">
          <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${color}; flex-shrink:0;"></span>
          <span class="truncate w-24 font-medium">${cat}</span>
        </div>
        <div class="d-flex items-center gap-3">
          <span class="font-bold">${count}</span>
          <span class="text-xs text-secondary w-8 text-right">%${percentage}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="chart-container">
      <div class="chart-svg-wrapper">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);">
          ${segments}
          <circle cx="${center}" cy="${center}" r="${radius - 12}" fill="var(--bg-primary)" />
        </svg>
        <div class="chart-center-text">
          <div class="text-3xl font-bold">${total}</div>
          <div class="text-xs text-secondary uppercase">Personel</div>
        </div>
      </div>
      <div class="chart-legend custom-scrollbar">
        ${legend}
      </div>
    </div>
  `;
}

function renderRoleCards(byRole) {
  const roles = Object.entries(byRole).filter(([role, count]) => role !== 'UNASSIGNED' && count > 0);

  if (roles.length === 0) {
    return '<div class="text-center text-secondary p-4 col-span-2">Rol verisi yok</div>';
  }

  return roles.map(([role, count]) => `
    <div class="p-3 rounded-lg bg-tertiary text-center cursor-pointer transition hover:opacity-80" 
         onclick="window.location.hash = '#/roles/${role.toLowerCase().replace(/\s+/g, '-')}'">
      <div class="text-xl font-bold text-primary">${count}</div>
      <div class="text-xs text-secondary mt-1 truncate" title="${role}">${role}</div>
    </div>
  `).join('');
}
