/**
 * store.js - Data Store with persistence layers
 * 
 * Priority: Remote → /data/db.json → localStorage
 */

import { CATEGORIES, ROLES } from './taxonomy.js';

// ============================================================================
// STATE
// ============================================================================

let state = {
    db: null,
    isLoading: true,
    isAdmin: false,
    adminSession: null,
    remoteToken: null, // Never persisted, memory-only
    lastSync: null,
    error: null
};

const listeners = new Set();

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
    DB: 'personnel_portal_db',
    THEME: 'personnel_portal_theme',
    ADMIN_SESSION: 'personnel_portal_admin_session',
    SIDEBAR_COLLAPSED: 'personnel_portal_sidebar_collapsed'
};

const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export function getState() {
    return { ...state };
}

export function setState(updates) {
    state = { ...state, ...updates };
    notifyListeners();
}

export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notifyListeners() {
    listeners.forEach(listener => listener(state));
}

// ============================================================================
// DATA ACCESS
// ============================================================================

export function getDb() {
    return state.db;
}

export function getPeople(filters = {}) {
    if (!state.db?.people) return [];

    let people = [...state.db.people];

    // Apply filters
    if (filters.status) {
        people = people.filter(p => p.status === filters.status);
    }
    if (filters.category) {
        people = people.filter(p => p.category === filters.category);
    }
    if (filters.role) {
        people = people.filter(p => p.role === filters.role);
    }
    if (filters.needsReview !== undefined) {
        people = people.filter(p => p.needsReview === filters.needsReview);
    }
    if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        people = people.filter(p =>
            p.fullName.toLowerCase().includes(searchLower) ||
            p.normalizedName.toLowerCase().includes(searchLower)
        );
    }

    // Sort
    if (filters.sortBy) {
        const sortKey = filters.sortBy;
        const sortDir = filters.sortDir === 'desc' ? -1 : 1;
        people.sort((a, b) => {
            const aVal = a[sortKey] ?? '';
            const bVal = b[sortKey] ?? '';
            return aVal.localeCompare(bVal) * sortDir;
        });
    }

    return people;
}

export function getPersonById(personId) {
    if (!state.db?.people) return null;
    return state.db.people.find(p => p.personId === personId);
}

export function getLeaves(filters = {}) {
    if (!state.db?.leaves) return [];

    let leaves = [...state.db.leaves];

    if (filters.personId) {
        leaves = leaves.filter(l => l.personId === filters.personId);
    }
    if (filters.upcoming) {
        const now = new Date();
        const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        leaves = leaves.filter(l => {
            const endDate = new Date(l.endDate);
            return endDate >= now && endDate <= futureDate;
        });
    }

    return leaves;
}

export function getTracking(filters = {}) {
    if (!state.db?.tracking) return [];

    let tracking = [...state.db.tracking];

    if (filters.personId) {
        tracking = tracking.filter(t => t.personId === filters.personId);
    }
    if (filters.status) {
        tracking = tracking.filter(t => t.status === filters.status);
    }
    if (filters.contactPerson) {
        tracking = tracking.filter(t => t.contactPerson === filters.contactPerson);
    }
    if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        tracking = tracking.filter(t =>
            t.fullName?.toLowerCase().includes(searchLower) ||
            t.applicationNo?.toLowerCase().includes(searchLower)
        );
    }

    return tracking;
}

export function getDepartures(filters = {}) {
    if (!state.db?.departures) return [];

    let departures = [...state.db.departures];

    if (filters.exitMonth) {
        departures = departures.filter(d => d.exitMonth === filters.exitMonth);
    }
    if (filters.category) {
        departures = departures.filter(d => d.category === filters.category);
    }
    if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        departures = departures.filter(d =>
            d.fullName.toLowerCase().includes(searchLower)
        );
    }

    // Sort by exit date descending by default
    departures.sort((a, b) => {
        const dateA = a.exitDate || '';
        const dateB = b.exitDate || '';
        return dateB.localeCompare(dateA);
    });

    return departures;
}

export function getDeparturesByMonth() {
    const departures = getDepartures();
    const byMonth = new Map();

    for (const dep of departures) {
        const month = dep.exitMonth || 'unknown';
        if (!byMonth.has(month)) {
            byMonth.set(month, []);
        }
        byMonth.get(month).push(dep);
    }

    // Sort months descending
    const sortedMonths = [...byMonth.keys()].sort((a, b) => b.localeCompare(a));

    return sortedMonths.map(month => ({
        month,
        departures: byMonth.get(month),
        count: byMonth.get(month).length,
        byCategory: getCategoryDistribution(byMonth.get(month))
    }));
}

function getCategoryDistribution(items) {
    const dist = {};
    for (const cat of CATEGORIES) {
        dist[cat] = items.filter(i => i.category === cat).length;
    }
    dist['UNCATEGORIZED'] = items.filter(i => !i.category).length;
    return dist;
}

export function getConflicts() {
    return state.db?.conflicts || [];
}

export function getDuplicateCandidates() {
    return state.db?.duplicateCandidates || [];
}

export function getUnmappedTags() {
    if (!state.db?.taxonomy?.tagMap) return [];

    return Object.entries(state.db.taxonomy.tagMap)
        .filter(([tag, mapping]) => mapping === null)
        .map(([tag]) => tag);
}

export function getStats() {
    if (!state.db?.people) return {};

    const people = state.db.people;
    const activePeople = people.filter(p => p.status === 'active' || !p.status);
    const pendingPeople = people.filter(p => p.status === 'pending'); // From pending roster
    const departedPeople = state.db.departures || []; // Departures are separate array

    // Calculate Category Distribution (Active Only)
    const byCategory = {};
    for (const cat of CATEGORIES) {
        byCategory[cat] = activePeople.filter(p => p.category === cat).length;
    }
    // Add pending to uncategorized/others if needed, or keep separate. 
    // Dashboard typically shows active roster breakdown.

    // Calculate Role Distribution (Active Only)
    const byRole = {};
    for (const role of ROLES) {
        byRole[role] = activePeople.filter(p => p.role === role).length;
    }

    return {
        activeRosterCount: activePeople.length,
        pendingCount: pendingPeople.length,
        departedCount: departedPeople.length,
        byCategory,
        byRole,
        generatedAt: new Date().toISOString() // Dynamic timestamp
    };
}

export function getAudit() {
    return state.db?.audit || [];
}

// ============================================================================
// DATA LOADING
// ============================================================================

export async function loadData() {
    setState({ isLoading: true, error: null });

    try {
        let remoteDb = null;
        let localDb = null;

        // 1. Fetch Remote (Static file)
        try {
            const response = await fetch('data/db.json');
            if (response.ok) {
                remoteDb = await response.json();
            }
        } catch (e) {
            console.warn('Remote load failed', e);
        }

        // 2. Fetch LocalStorage
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.DB);
            if (stored) {
                localDb = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Local load failed', e);
        }

        // 3. Compare and Decide to prevent data loss during Vercel build
        let finalDb = null;

        if (remoteDb && localDb) {
            const remoteTime = new Date(remoteDb.meta?.lastUpdated || 0).getTime();
            const localTime = new Date(localDb.meta?.lastUpdated || 0).getTime();

            // Give preference to local if it's newer or equal
            // This handles the case where Vercel serves old data while build is pending
            if (localTime >= remoteTime) {
                finalDb = localDb;
                console.log('✅ Loaded from localStorage (Fresher/Equal)');
            } else {
                finalDb = remoteDb;
                console.log('✅ Loaded from Remote (Fresher)');
            }
        } else {
            finalDb = remoteDb || localDb;
            console.log(`✅ Loaded from ${remoteDb ? 'Remote' : 'localStorage'} (Fallback)`);
        }

        if (!finalDb) {
            throw new Error('No data source available');
        }

        // Validate structure
        if (!finalDb.people || !finalDb.taxonomy) {
            throw new Error('Invalid database structure');
        }

        setState({
            db: finalDb,
            isLoading: false,
            lastSync: new Date().toISOString()
        });

        // Ensure localStorage is in sync if we loaded from remote
        if (finalDb === remoteDb) {
            try {
                localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(finalDb));
            } catch (e) {
                console.warn('⚠️ localStorage save failed:', e.message);
            }
        }

        return finalDb;
    } catch (error) {
        setState({ isLoading: false, error: error.message });
        throw error;
    }
}

async function fetchRemoteDb(gistId) {
    const response = await fetch(`https://api.github.com/gists/${gistId}`);
    if (!response.ok) {
        throw new Error(`Gist fetch failed: ${response.status}`);
    }

    const gist = await response.json();
    const file = gist.files['db.json'];

    if (!file) {
        throw new Error('db.json not found in gist');
    }

    return JSON.parse(file.content);
}

// ============================================================================
// DATA MUTATION (Admin only)
// ============================================================================

export function updatePerson(personId, updates) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db) throw new Error('No database loaded');

    const idx = state.db.people.findIndex(p => p.personId === personId);
    if (idx === -1) throw new Error('Person not found');

    const oldPerson = { ...state.db.people[idx] };
    const newPerson = {
        ...oldPerson,
        ...updates,
        updatedAt: new Date().toISOString()
    };

    state.db.people[idx] = newPerson;

    // Log audit
    addAuditEntry('UPDATE', 'person', personId, { before: oldPerson, after: newPerson });

    saveToLocal();
    notifyListeners();

    return newPerson;
}

export function addPerson(personData) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db) throw new Error('No database loaded');

    const now = new Date().toISOString();
    const personId = crypto.randomUUID();

    const newPerson = {
        personId,
        baseKey: personData.normalizedName || personData.fullName.toUpperCase(),
        fullName: personData.fullName,
        normalizedName: personData.normalizedName || personData.fullName.toUpperCase(),
        category: personData.category || null,
        role: personData.role || null,
        needsReview: !personData.category,
        unmappedTags: [],
        status: personData.status || 'active',
        sources: [{ type: 'manual', date: now }],
        mergedFrom: [],
        createdAt: now,
        updatedAt: now
    };

    state.db.people.push(newPerson);

    addAuditEntry('CREATE', 'person', personId, { person: newPerson });

    saveToLocal();
    notifyListeners();

    return newPerson;
}

export function deletePerson(personId) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db) throw new Error('No database loaded');

    const idx = state.db.people.findIndex(p => p.personId === personId);
    if (idx === -1) throw new Error('Person not found');

    const deletedPerson = state.db.people.splice(idx, 1)[0];

    addAuditEntry('DELETE', 'person', personId, { person: deletedPerson });

    saveToLocal();
    notifyListeners();

    return deletedPerson;
}

export function addLeave(leaveData) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db) throw new Error('No database loaded');

    const now = new Date().toISOString();
    const leaveId = crypto.randomUUID();

    // Calculate days if not provided
    let days = leaveData.days;
    if (!days && leaveData.startDate && leaveData.endDate) {
        const start = new Date(leaveData.startDate);
        const end = new Date(leaveData.endDate);
        const diffTime = Math.abs(end - start);
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const newLeave = {
        id: leaveId,
        personId: leaveData.personId,
        startDate: leaveData.startDate,
        endDate: leaveData.endDate,
        days: days || 0,
        type: leaveData.type || 'NORMAL',
        note: leaveData.note || '',
        createdAt: now
    };

    if (!state.db.leaves) state.db.leaves = [];
    state.db.leaves.push(newLeave);

    addAuditEntry('CREATE', 'leave', leaveId, { leave: newLeave });

    saveToLocal();
    notifyListeners();

    return newLeave;
}

export function deleteLeave(leaveId) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db?.leaves) throw new Error('No database loaded');

    const idx = state.db.leaves.findIndex(l => (l.id === leaveId) || (l.leaveId === leaveId)); // Suboptimal check due to possible schema var
    // Actually our ingest creates leaves without IDs initially, maybe? 
    // Let's check ingest script or just use index if no ID.
    // Wait, ingestion script might not assign IDs to leaves.
    // If no ID, we might need to rely on object reference or generate IDs during load.
    // Let's assume we maintain IDs moving forward.

    // Fallback: finding by props if no ID? No, that's risky. 
    // Better: Ensure all leaves have IDs. 
    // If existing leaves don't have IDs, we should generate them on load or ingest.

    // For now, let's look for ID.
    if (idx === -1) throw new Error('Leave record not found');

    const deletedLeave = state.db.leaves.splice(idx, 1)[0];

    addAuditEntry('DELETE', 'leave', leaveId, { leave: deletedLeave });

    saveToLocal();
    notifyListeners();

    return deletedLeave;
}

export function addTracking(trackingData) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db) throw new Error('No database loaded');

    const now = new Date().toISOString();
    const trackingId = crypto.randomUUID();

    const newTracking = {
        id: trackingId,
        personId: trackingData.personId,
        applicationNo: trackingData.applicationNo || '',
        profession: trackingData.profession || '',
        status: trackingData.status || 'ÖN İZNİ ONAYLANDI',
        expectedDate: trackingData.expectedDate || null,
        contactPerson: trackingData.contactPerson || '',
        notes: trackingData.notes || '',
        createdAt: now,
        updatedAt: now
    };

    if (!state.db.tracking) state.db.tracking = [];
    state.db.tracking.push(newTracking);

    addAuditEntry('CREATE', 'tracking', trackingId, { tracking: newTracking });

    saveToLocal();
    notifyListeners();

    return newTracking;
}

export function updateTracking(trackingId, updates) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db?.tracking) throw new Error('No database loaded');

    const idx = state.db.tracking.findIndex(t => (t.id === trackingId) || (t.trackingId === trackingId));
    if (idx === -1) throw new Error('Tracking record not found');

    const oldTracking = { ...state.db.tracking[idx] };
    const newTracking = {
        ...oldTracking,
        ...updates,
        updatedAt: new Date().toISOString()
    };

    state.db.tracking[idx] = newTracking;

    addAuditEntry('UPDATE', 'tracking', trackingId, { before: oldTracking, after: newTracking });

    saveToLocal();
    notifyListeners();

    return newTracking;
}

export function deleteTracking(trackingId) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db?.tracking) throw new Error('No database loaded');

    const idx = state.db.tracking.findIndex(t => (t.id === trackingId) || (t.trackingId === trackingId));
    if (idx === -1) throw new Error('Tracking record not found');

    const deletedTracking = state.db.tracking.splice(idx, 1)[0];

    addAuditEntry('DELETE', 'tracking', trackingId, { tracking: deletedTracking });

    saveToLocal();
    notifyListeners();

    return deletedTracking;
}

export function updateLeave(leaveId, updates) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db?.leaves) throw new Error('No database loaded');

    const idx = state.db.leaves.findIndex(l => (l.id === leaveId) || (l.leaveId === leaveId));
    if (idx === -1) throw new Error('Leave record not found');

    const oldLeave = { ...state.db.leaves[idx] };

    // Recalculate days if dates change
    let days = updates.days || oldLeave.days;
    if ((updates.startDate || updates.endDate) && !updates.days) {
        const start = new Date(updates.startDate || oldLeave.startDate);
        const end = new Date(updates.endDate || oldLeave.endDate);
        const diffTime = Math.abs(end - start);
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const newLeave = {
        ...oldLeave,
        ...updates,
        days,
        updatedAt: new Date().toISOString()
    };

    state.db.leaves[idx] = newLeave;

    addAuditEntry('UPDATE', 'leave', leaveId, { before: oldLeave, after: newLeave });

    saveToLocal();
    notifyListeners();

    return newLeave;
}

export function addDeparture(departureData) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db) throw new Error('No database loaded');

    const now = new Date().toISOString();
    const departureId = crypto.randomUUID();

    // Calculate total days
    let totalDays = departureData.totalDays;
    if (!totalDays && departureData.entryDate && departureData.exitDate) {
        const start = new Date(departureData.entryDate);
        const end = new Date(departureData.exitDate);
        const diffTime = Math.abs(end - start);
        totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Calculate exit month for grouping
    const exitMonth = departureData.exitDate ? departureData.exitDate.substring(0, 7) : now.substring(0, 7);

    const newDeparture = {
        id: departureId,
        personId: departureData.personId || null,
        fullName: departureData.fullName,
        category: departureData.category || null,
        job: departureData.job || '',
        entryDate: departureData.entryDate || '',
        exitDate: departureData.exitDate || '',
        totalDays: totalDays || 0,
        exitMonth: exitMonth,
        createdAt: now,
        updatedAt: now
    };

    if (!state.db.departures) state.db.departures = [];
    state.db.departures.push(newDeparture);

    addAuditEntry('CREATE', 'departure', departureId, { departure: newDeparture });

    saveToLocal();
    notifyListeners();

    return newDeparture;
}

export function updateDeparture(departureId, updates) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db?.departures) throw new Error('No database loaded');

    const idx = state.db.departures.findIndex(d => (d.id === departureId) || (d.id === departureId)); // consistency
    if (idx === -1) throw new Error('Departure record not found');

    const oldDeparture = { ...state.db.departures[idx] };

    // Recalculate derived fields if needed
    let totalDays = updates.totalDays || oldDeparture.totalDays;
    if ((updates.entryDate || updates.exitDate) && !updates.totalDays) {
        const start = new Date(updates.entryDate || oldDeparture.entryDate);
        const end = new Date(updates.exitDate || oldDeparture.exitDate);
        if (!isNaN(start) && !isNaN(end)) {
            const diffTime = Math.abs(end - start);
            totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
    }

    let exitMonth = oldDeparture.exitMonth;
    if (updates.exitDate) {
        exitMonth = updates.exitDate.substring(0, 7);
    }

    // Recalc groupedMonth if present? No, view handles grouping.
    // Just ensure exitMonth is correct string YYYY-MM.

    const newDeparture = {
        ...oldDeparture,
        ...updates,
        totalDays,
        exitMonth,
        updatedAt: new Date().toISOString()
    };

    state.db.departures[idx] = newDeparture;

    addAuditEntry('UPDATE', 'departure', departureId, { before: oldDeparture, after: newDeparture });

    saveToLocal();
    notifyListeners();

    return newDeparture;
}

export function deleteDeparture(departureId) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db?.departures) throw new Error('No database loaded');

    const idx = state.db.departures.findIndex(d => d.id === departureId);
    if (idx === -1) throw new Error('Departure record not found');

    const deletedDeparture = state.db.departures.splice(idx, 1)[0];

    addAuditEntry('DELETE', 'departure', departureId, { departure: deletedDeparture });

    saveToLocal();
    notifyListeners();

    return deletedDeparture;
}

export function mapTag(tag, category) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db?.taxonomy?.tagMap) throw new Error('No database loaded');
    if (!CATEGORIES.includes(category)) throw new Error('Invalid category');

    state.db.taxonomy.tagMap[tag] = category;

    // Update all people with this tag
    for (const person of state.db.people) {
        if (person.unmappedTags?.includes(tag)) {
            person.category = category;
            person.unmappedTags = person.unmappedTags.filter(t => t !== tag);
            person.needsReview = false;
            person.updatedAt = new Date().toISOString();
        }
    }

    addAuditEntry('TAG_MAP', 'taxonomy', tag, { category });

    saveToLocal();
    notifyListeners();
}

export function mergePeople(personIds) {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.db) throw new Error('No database loaded');
    if (personIds.length < 2) throw new Error('Need at least 2 people to merge');

    const people = personIds.map(id => getPersonById(id)).filter(Boolean);
    if (people.length < 2) throw new Error('Could not find all people');

    // Use first person as base
    const base = people[0];
    const merged = {
        ...base,
        sources: people.flatMap(p => p.sources || []),
        mergedFrom: personIds.slice(1),
        updatedAt: new Date().toISOString()
    };

    // Remove merged people (except base)
    for (let i = 1; i < personIds.length; i++) {
        const idx = state.db.people.findIndex(p => p.personId === personIds[i]);
        if (idx !== -1) {
            state.db.people.splice(idx, 1);
        }
    }

    // Update base
    const baseIdx = state.db.people.findIndex(p => p.personId === base.personId);
    state.db.people[baseIdx] = merged;

    // Remove from duplicate candidates
    state.db.duplicateCandidates = state.db.duplicateCandidates.filter(dc =>
        !personIds.some(id => dc.personIds?.includes(id))
    );

    addAuditEntry('MERGE', 'person', base.personId, { merged: personIds });

    saveToLocal();
    notifyListeners();

    return merged;
}

function addAuditEntry(action, entityType, entityId, details) {
    if (!state.db.audit) state.db.audit = [];

    state.db.audit.unshift({
        id: crypto.randomUUID(),
        action,
        entityType,
        entityId,
        details,
        timestamp: new Date().toISOString(),
        adminSession: state.adminSession?.id || null
    });

    // Keep last 1000 entries
    if (state.db.audit.length > 1000) {
        state.db.audit = state.db.audit.slice(0, 1000);
    }
}

function saveToLocal() {
    try {
        // Update timestamp before saving
        if (!state.db.meta) state.db.meta = {};
        state.db.meta.lastUpdated = new Date().toISOString();

        localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(state.db));

        // SYNC: Try to save to server
        fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.db)
        }).then(res => {
            if (res.ok) console.log('✅ Synced to server');
            else console.warn('⚠️ Sync failed:', res.status);
        }).catch(err => {
            // Silent fail for static mode
        });
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
}

// ============================================================================
// ADMIN AUTH
// ============================================================================

// FIXED PASSWORD IMPLEMENTATION
const FIXED_ADMIN_PASSWORD = 'admin';

export function isAdminPasswordSet() {
    return true; // Always show login screen, never setup
}

export async function setAdminPassword(password) {
    // No-op for fixed password
    console.warn('Fixed password is active. Cannot change via UI.');
}

export async function adminLogin(password) {
    // Check against fixed password
    if (password !== FIXED_ADMIN_PASSWORD) {
        throw new Error('Hatalı şifre');
    }

    const session = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
    };

    localStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(session));

    setState({
        isAdmin: true,
        adminSession: session
    });

    return session;
}

export function adminLogout() {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);

    setState({
        isAdmin: false,
        adminSession: null,
        remoteToken: null
    });
}

export function checkAdminSession() {
    const stored = localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION);
    if (!stored) return false;

    try {
        const session = JSON.parse(stored);

        if (Date.now() > session.expiresAt) {
            localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
            return false;
        }

        setState({
            isAdmin: true,
            adminSession: session
        });

        return true;
    } catch {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
        return false;
    }
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// REMOTE STORE
// ============================================================================

export function getRemoteConfig() {
    return state.db?.meta?.remoteStore || null;
}

export function setRemoteToken(token) {
    // Memory only - never persisted
    state.remoteToken = token;
}

export async function publishToRemote() {
    if (!state.isAdmin) throw new Error('Admin access required');
    if (!state.remoteToken) throw new Error('Remote token not set');

    const config = getRemoteConfig();
    if (!config?.gistId) throw new Error('Gist ID not configured');

    const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `token ${state.remoteToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            files: {
                'db.json': {
                    content: JSON.stringify(state.db, null, 2)
                }
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Publish failed');
    }

    setState({ lastSync: new Date().toISOString() });

    return true;
}

export function configureRemoteStore(gistId) {
    if (!state.isAdmin) throw new Error('Admin access required');

    if (!state.db.meta) state.db.meta = {};
    state.db.meta.remoteStore = {
        enabled: true,
        gistId,
        repoUrl: null
    };

    saveToLocal();
    notifyListeners();
}

// ============================================================================
// EXPORT / IMPORT
// ============================================================================

export function exportDb() {
    return JSON.stringify(state.db, null, 2);
}

export function importDb(jsonString) {
    if (!state.isAdmin) throw new Error('Admin access required');

    try {
        const importedDb = JSON.parse(jsonString);

        // Validate
        if (!importedDb.people || !importedDb.taxonomy) {
            throw new Error('Invalid database format');
        }

        // Preserve admin hash if not in import
        if (!importedDb.meta?.adminHash && state.db?.meta?.adminHash) {
            if (!importedDb.meta) importedDb.meta = {};
            importedDb.meta.adminHash = state.db.meta.adminHash;
        }

        state.db = importedDb;

        addAuditEntry('IMPORT', 'database', 'full', { recordCount: importedDb.people.length });

        saveToLocal();
        notifyListeners();

        return true;
    } catch (e) {
        throw new Error(`Import failed: ${e.message}`);
    }
}

// ============================================================================
// THEME
// ============================================================================

export function getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'system';
}

export function setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    applyTheme(theme);
}

export function applyTheme(theme) {
    const root = document.documentElement;

    if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
    } else {
        root.removeAttribute('data-theme');
    }
}

// ============================================================================
// SIDEBAR
// ============================================================================

export function getSidebarCollapsed() {
    return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
}

export function setSidebarCollapsed(collapsed) {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(collapsed));
}
