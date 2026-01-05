/**
 * needs-review.js - Admin-only page for items needing review
 */

import { getPeople, getConflicts, getDuplicateCandidates, getUnmappedTags, getState, updatePerson, mapTag } from '../store.js';
import { CATEGORIES, CATEGORY_COLORS } from '../taxonomy.js';
import { navigate } from '../router.js';

export async function render(ctx) {
    const container = document.getElementById('main-content');
    if (!container) return;

    const state = getState();

    // Check admin access
    if (!state.isAdmin) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon text-warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3 class="empty-state-title">Yetki Gerekli</h3>
        <p class="empty-state-description">Bu sayfayı görüntülemek için admin girişi yapmalısınız.</p>
        <a href="#/admin" class="btn btn-primary mt-4">Admin Girişi</a>
      </div>
    `;
        return;
    }

    const needsReview = getPeople({ needsReview: true });
    const conflicts = getConflicts().filter(c => !c.resolved);
    const duplicates = getDuplicateCandidates();
    const unmappedTags = getUnmappedTags();

    // Group needs review by reason
    const missingCategory = needsReview.filter(p => !p.category);
    const hasUnmappedTags = needsReview.filter(p => p.unmappedTags?.length > 0);

    let activeTab = 'missing-category';

    function renderTabContent() {
        switch (activeTab) {
            case 'missing-category':
                return renderMissingCategoryTab(missingCategory);
            case 'unmapped-tags':
                return renderUnmappedTagsTab(unmappedTags, hasUnmappedTags);
            case 'conflicts':
                return renderConflictsTab(conflicts);
            case 'duplicates':
                return renderDuplicatesTab(duplicates);
            default:
                return '';
        }
    }

    container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">İnceleme Bekleyenler</h1>
      <p class="page-description">Kategori eksik, eşlenmemiş etiketli veya çakışmalı kayıtlar</p>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-4 gap-6 mb-6">
      <div class="card cursor-pointer tab-card ${activeTab === 'missing-category' ? 'ring-2 ring-accent' : ''}" data-tab="missing-category">
        <div class="text-sm text-secondary">Kategori Eksik</div>
        <div class="text-3xl font-bold text-warning mt-2">${missingCategory.length}</div>
      </div>
      <div class="card cursor-pointer tab-card ${activeTab === 'unmapped-tags' ? 'ring-2 ring-accent' : ''}" data-tab="unmapped-tags">
        <div class="text-sm text-secondary">Eşlenmemiş Etiket</div>
        <div class="text-3xl font-bold text-warning mt-2">${unmappedTags.length}</div>
      </div>
      <div class="card cursor-pointer tab-card ${activeTab === 'conflicts' ? 'ring-2 ring-accent' : ''}" data-tab="conflicts">
        <div class="text-sm text-secondary">Çakışma (Active+Departed)</div>
        <div class="text-3xl font-bold text-danger mt-2">${conflicts.length}</div>
      </div>
      <div class="card cursor-pointer tab-card ${activeTab === 'duplicates' ? 'ring-2 ring-accent' : ''}" data-tab="duplicates">
        <div class="text-sm text-secondary">Muhtemel Duplike</div>
        <div class="text-3xl font-bold mt-2">${duplicates.length}</div>
      </div>
    </div>

    <!-- Tab Content -->
    <div id="tab-content">
      ${renderTabContent()}
    </div>
  `;

    // Tab click handlers
    container.querySelectorAll('.tab-card').forEach(card => {
        card.addEventListener('click', () => {
            activeTab = card.dataset.tab;

            // Update active state
            container.querySelectorAll('.tab-card').forEach(c => {
                c.classList.toggle('ring-2', c.dataset.tab === activeTab);
                c.classList.toggle('ring-accent', c.dataset.tab === activeTab);
            });

            // Update content
            document.getElementById('tab-content').innerHTML = renderTabContent();
            attachTabListeners();
        });
    });

    function attachTabListeners() {
        // Category assignment buttons
        document.querySelectorAll('.assign-category-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const personId = btn.dataset.personId;
                const category = btn.dataset.category;

                try {
                    updatePerson(personId, { category, needsReview: false });
                    window.showToast(`Kategori atandı: ${category}`, 'success');

                    // Refresh
                    const mod = await import('./needs-review.js');
                    mod.render(ctx);
                } catch (err) {
                    window.showToast(err.message, 'error');
                }
            });
        });

        // Tag mapping buttons
        document.querySelectorAll('.map-tag-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tag = btn.dataset.tag;
                const category = btn.dataset.category;

                try {
                    mapTag(tag, category);
                    window.showToast(`"${tag}" → ${category} olarak eşlendi`, 'success');

                    // Refresh
                    const mod = await import('./needs-review.js');
                    mod.render(ctx);
                } catch (err) {
                    window.showToast(err.message, 'error');
                }
            });
        });
    }

    attachTabListeners();
}

function renderMissingCategoryTab(people) {
    if (people.length === 0) {
        return `
      <div class="card">
        <div class="empty-state">
          <div class="text-success text-lg">✓</div>
          <h3 class="empty-state-title">Tüm personelin kategorisi tanımlı</h3>
        </div>
      </div>
    `;
    }

    return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Kategorisi Eksik Personel</h3>
        <span class="badge badge-warning">${people.length} kayıt</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Rol</th>
              <th>Durum</th>
              <th>Kategori Ata</th>
            </tr>
          </thead>
          <tbody>
            ${people.slice(0, 50).map(p => `
              <tr>
                <td class="cell-name">${p.fullName}</td>
                <td>${p.role || '-'}</td>
                <td><span class="badge badge-status-${p.status}">${p.status}</span></td>
                <td>
                  <div class="d-flex gap-1 flex-wrap">
                    ${CATEGORIES.map(cat => `
                      <button class="btn btn-sm assign-category-btn" 
                              data-person-id="${p.personId}" 
                              data-category="${cat}"
                              style="background: ${CATEGORY_COLORS[cat]}20; color: ${CATEGORY_COLORS[cat]}; border: 1px solid ${CATEGORY_COLORS[cat]}40;">
                        ${cat.substring(0, 3)}
                      </button>
                    `).join('')}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${people.length > 50 ? `<div class="p-4 text-center text-secondary">+${people.length - 50} daha fazla kayıt</div>` : ''}
    </div>
  `;
}

function renderUnmappedTagsTab(tags, affectedPeople) {
    if (tags.length === 0) {
        return `
      <div class="card">
        <div class="empty-state">
          <div class="text-success text-lg">✓</div>
          <h3 class="empty-state-title">Tüm etiketler eşlenmiş</h3>
        </div>
      </div>
    `;
    }

    return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Eşlenmemiş Etiketler</h3>
        <span class="badge badge-warning">${tags.length} etiket</span>
      </div>
      <p class="text-sm text-secondary mb-4">
        Bu etiketler Excel dosyalarından geldi ama tanımlı 8 kategoriden birine atanamadı. 
        Hangi kategoriye ait olduğunu seçin.
      </p>
      <div class="d-flex flex-col gap-4">
        ${tags.map(tag => `
          <div class="p-4 rounded-lg bg-tertiary">
            <div class="d-flex items-center justify-between mb-3">
              <div class="font-semibold">"${tag}"</div>
              <span class="badge badge-neutral">${affectedPeople.filter(p => p.unmappedTags?.includes(tag)).length} kişi</span>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              ${CATEGORIES.map(cat => `
                <button class="btn btn-sm map-tag-btn" 
                        data-tag="${tag}" 
                        data-category="${cat}"
                        style="background: ${CATEGORY_COLORS[cat]}20; color: ${CATEGORY_COLORS[cat]}; border: 1px solid ${CATEGORY_COLORS[cat]}40;">
                  ${cat}
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderConflictsTab(conflicts) {
    if (conflicts.length === 0) {
        return `
      <div class="card">
        <div class="empty-state">
          <div class="text-success text-lg">✓</div>
          <h3 class="empty-state-title">Çakışma yok</h3>
        </div>
      </div>
    `;
    }

    return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Aktif + Ayrılan Çakışmaları</h3>
        <span class="badge badge-danger">${conflicts.length} çakışma</span>
      </div>
      <p class="text-sm text-secondary mb-4">
        Bu kişiler hem aktif personel hem de ayrılan listesinde görünüyor.
      </p>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Kategori</th>
              <th>Aktif Kaynak</th>
              <th>Ayrılan Kaynağı</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${conflicts.map(c => `
              <tr>
                <td class="cell-name">${c.fullName}</td>
                <td>${c.category || '-'}</td>
                <td class="cell-secondary">${c.activeSource || '-'}</td>
                <td class="cell-secondary">${c.departedSource || '-'}</td>
                <td>
                  <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-secondary">Aktif Tut</button>
                    <button class="btn btn-sm btn-danger">Ayrıldı Olarak İşaretle</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDuplicatesTab(duplicates) {
    if (duplicates.length === 0) {
        return `
      <div class="card">
        <div class="empty-state">
          <div class="text-success text-lg">✓</div>
          <h3 class="empty-state-title">Muhtemel duplike bulunamadı</h3>
        </div>
      </div>
    `;
    }

    return `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Muhtemel Duplike Kayıtlar</h3>
        <span class="badge badge-info">${duplicates.length} aday</span>
      </div>
      <p class="text-sm text-secondary mb-4">
        Bu kayıtlar benzer isim veya özelliklere sahip. Birleştirme veya ayrı tutma işlemi yapılabilir.
      </p>
      <div class="d-flex flex-col gap-4">
        ${duplicates.map((dup, i) => `
          <div class="p-4 rounded-lg bg-tertiary">
            <div class="d-flex items-center justify-between mb-3">
              <div class="font-semibold">Grup ${i + 1}</div>
              <span class="badge badge-info">${dup.personIds?.length || 2} kayıt - %${Math.round((dup.similarity || 0.9) * 100)} benzerlik</span>
            </div>
            <div class="d-flex gap-4">
              ${(dup.names || [dup.name1, dup.name2]).map(name => `
                <div class="p-3 rounded bg-secondary flex-1">
                  <div class="font-medium">${name}</div>
                </div>
              `).join('')}
            </div>
            <div class="d-flex gap-2 mt-3">
              <button class="btn btn-sm btn-primary">Birleştir</button>
              <button class="btn btn-sm btn-secondary">Ayrı Tut</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
