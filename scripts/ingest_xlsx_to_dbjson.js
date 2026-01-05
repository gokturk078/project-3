#!/usr/bin/env node
/**
 * ingest_xlsx_to_dbjson.js - FIXED VERSION
 * 
 * Reads personnel data from category sheets (REPSAM, KALMES, etc.)
 * NOT from TÜM LİSTE - category membership is defined by sheet membership.
 * 
 * Validates against SAYILAR sheet for data integrity.
 * 
 * Usage:
 *   node scripts/ingest_xlsx_to_dbjson.js          # Fresh generation
 *   node scripts/ingest_xlsx_to_dbjson.js --merge  # Merge with existing db.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomUUID } from 'crypto';
import XLSX from 'xlsx';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const RAW_DATA_DIR = join(PROJECT_ROOT, 'data', 'raw');
const OUTPUT_PATH = join(PROJECT_ROOT, 'data', 'db.json');

// ============================================================================
// TAXONOMY (Immutable)
// ============================================================================

const CATEGORIES = [
    'REPSAM', 'KALMES', 'NEŞAT', 'BANGLADEŞ',
    'ÖZBEK', 'TÜRKMEN', 'ZİMBAVE', 'CAPRA'
];

const ROLES = [
    'CAPRA İŞVEREN', 'CAPRA DİREKTÖR',
    'REPSAM İŞVEREN', 'REPSAM DİREKTÖR',
    'ÜLKE KOORDİNATÖRÜ', 'MİMAR', 'MÜHENDİS',
    'FORMEN', 'İSG', 'OFİS PERSONELİ',
    'PROJE MÜDÜRÜ', 'HİZMETLİ'
];

const CATEGORY_SET = new Set(CATEGORIES);
const ROLE_SET = new Set(ROLES);

// Typo fixes for roles
const TYPO_FIXES = {
    'RPSAM İŞVEREN': 'REPSAM İŞVEREN',
    'RPSAM DİREKTÖR': 'REPSAM DİREKTÖR',
    'ISVEREN': 'İŞVEREN',
    'DIREKTOR': 'DİREKTÖR',
    'DIREKTÖR': 'DİREKTÖR',
    'MUHENDIS': 'MÜHENDİS',
    'MIMAR': 'MİMAR',
    'ISG': 'İSG',
    'HIZMETLI': 'HİZMETLİ',
    'İZMETLİ': 'HİZMETLİ',  // Common typo
    'OFIS PERSONELI': 'OFİS PERSONELİ',
    'ULKE KOORDINATORU': 'ÜLKE KOORDİNATÖRÜ',
    '      İŞVEREN': 'İŞVEREN'  // Leading spaces fix
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[.,;:'"!?()]/g, ''); // Remove punctuation
}

function normalizeRole(rawRole, categoryContext = null) {
    if (!rawRole || typeof rawRole !== 'string') return null;

    let role = rawRole.trim().toUpperCase();

    // Apply typo fixes
    if (TYPO_FIXES[role]) {
        role = TYPO_FIXES[role];
    }

    // If just "İŞVEREN" or "DİREKTÖR" and we have category context, prefix it
    if (categoryContext) {
        if (role === 'İŞVEREN' || role.includes('İŞVEREN')) {
            if (categoryContext === 'REPSAM') return 'REPSAM İŞVEREN';
            if (categoryContext === 'CAPRA') return 'CAPRA İŞVEREN';
        }
        if (role === 'DİREKTÖR' || role.includes('DİREKTÖR')) {
            if (categoryContext === 'REPSAM') return 'REPSAM DİREKTÖR';
            if (categoryContext === 'CAPRA') return 'CAPRA DİREKTÖR';
        }
    }

    // Check if it's a valid role
    if (ROLE_SET.has(role)) {
        return role;
    }

    // Check if it's a category (not a role)
    if (CATEGORY_SET.has(role)) {
        return null; // Category names are not roles
    }

    return null; // Not a valid role, will be stored as jobTitle
}

function sha1(str) {
    return createHash('sha1').update(str).digest('hex');
}

function uuid() {
    return randomUUID();
}

function parseDate(value) {
    if (!value) return null;

    if (typeof value === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
        return formatDateISO(date);
    }

    if (typeof value === 'string') {
        const str = value.trim();

        const dmyMatch = str.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})$/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10);
            let year = parseInt(dmyMatch[3], 10);
            if (year < 100) year += 2000;
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        }

        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            return formatDateISO(date);
        }
    }

    return null;
}

function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function daysBetween(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function levenshteinSimilarity(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 1 : 1 - matrix[b.length][a.length] / maxLen;
}

function getMonthKey(isoDate) {
    if (!isoDate) return 'unknown';
    return isoDate.substring(0, 7);
}

// ============================================================================
// EXCEL READING
// ============================================================================

function readExcelFile(filePath) {
    console.log(`  Reading: ${filePath}`);
    return XLSX.readFile(filePath);
}

function getSheetData(workbook, sheetName) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
        console.warn(`  Warning: Sheet "${sheetName}" not found`);
        return [];
    }
    return XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: true,
        defval: null
    });
}

// ============================================================================
// PARSE FROM CATEGORY SHEETS (THE FIX!)
// ============================================================================

function parseCategorySheets(workbook) {
    console.log('\n📂 Parsing category sheets...');

    const people = [];
    const categoryCounts = {};

    for (const category of CATEGORIES) {
        const rows = getSheetData(workbook, category);
        let count = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            // Check if first column is a row number (data row indicator)
            const rowNum = row[0];
            if (typeof rowNum !== 'number' && !/^\d+$/.test(String(rowNum))) continue;

            const fullName = String(row[1] || '').trim();
            if (!fullName || fullName.length < 2) continue;

            // Skip if name is a category name
            if (CATEGORY_SET.has(fullName.toUpperCase())) continue;

            const rawRole = String(row[2] || '').trim();
            const role = normalizeRole(rawRole, category);
            const jobTitle = role ? null : (rawRole && !CATEGORY_SET.has(rawRole.toUpperCase()) ? rawRole : null);

            const normalizedName = normalizeName(fullName);

            people.push({
                fullName,
                normalizedName,
                baseKey: normalizedName,
                category,  // Category comes from the SHEET NAME, not from tag!
                role,
                jobTitle,
                needsReview: false, // No review needed - category is certain
                unmappedTags: [],
                status: 'active',
                source: {
                    file: 'on_izin.xlsx',
                    sheet: category,
                    row: i + 1
                }
            });

            count++;
        }

        categoryCounts[category] = count;
        console.log(`  ${category}: ${count} people`);
    }

    console.log(`  Total from category sheets: ${people.length}`);

    return { people, categoryCounts };
}

// ============================================================================
// PARSE SAYILAR FOR VALIDATION
// ============================================================================

function parseSayilar(workbook) {
    const rows = getSheetData(workbook, 'SAYILAR');
    const expected = {};
    let expectedTotal = 0;

    for (const row of rows) {
        if (!row || !row[0]) continue;
        const name = String(row[0]).trim().toUpperCase();
        const count = parseInt(row[1], 10) || 0;

        if (CATEGORY_SET.has(name)) {
            expected[name] = count;
        } else if (name === 'GENEL TOPLAM') {
            expectedTotal = count;
        }
    }

    return { expected, expectedTotal };
}

// ============================================================================
// VALIDATE AGAINST SAYILAR
// ============================================================================

function validateAgainstSayilar(categoryCounts, sayilar) {
    console.log('\n🔍 Validating against SAYILAR...');

    const errors = [];
    const warnings = [];
    let totalActual = 0;

    for (const category of CATEGORIES) {
        const actual = categoryCounts[category] || 0;
        const expected = sayilar.expected[category] || 0;
        totalActual += actual;

        if (actual !== expected) {
            errors.push({
                category,
                actual,
                expected,
                diff: actual - expected
            });
            console.log(`  ❌ ${category}: ${actual} (expected ${expected}, diff ${actual - expected})`);
        } else {
            console.log(`  ✓ ${category}: ${actual}`);
        }
    }

    if (totalActual !== sayilar.expectedTotal) {
        errors.push({
            category: 'GENEL TOPLAM',
            actual: totalActual,
            expected: sayilar.expectedTotal,
            diff: totalActual - sayilar.expectedTotal
        });
        console.log(`  ❌ GENEL TOPLAM: ${totalActual} (expected ${sayilar.expectedTotal})`);
    } else {
        console.log(`  ✓ GENEL TOPLAM: ${totalActual}`);
    }

    return { errors, warnings, isValid: errors.length === 0 };
}

// ============================================================================
// PARSE DEPARTURES FILE
// ============================================================================

function parseAyrilanlarFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const rows = getSheetData(workbook, 'Table 1');

    const departures = [];
    const unmappedTags = new Set();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[1]) continue;

        const rowNum = row[0];
        if (typeof rowNum !== 'number' && !/^\d+$/.test(String(rowNum))) continue;

        const fullName = String(row[1] || '').trim();
        if (!fullName || fullName.length < 2) continue;

        const employerTag = String(row[2] || '').trim().toUpperCase();
        const job = String(row[3] || '').trim();
        const entryDate = parseDate(row[4]);
        const exitDate = parseDate(row[5]);
        const totalDays = row[6] ? parseInt(row[6], 10) : daysBetween(entryDate, exitDate);

        // Determine category from employer tag
        let category = null;
        let needsReview = false;

        if (CATEGORY_SET.has(employerTag)) {
            category = employerTag;
        } else if (employerTag) {
            unmappedTags.add(employerTag);
            needsReview = true;
        }

        const normalizedName = normalizeName(fullName);

        departures.push({
            id: uuid(),
            fullName,
            normalizedName,
            baseKey: normalizedName,
            category,
            job,
            entryDate,
            exitDate,
            totalDays,
            exitMonth: getMonthKey(exitDate),
            needsReview,
            unmappedTags: needsReview && employerTag ? [employerTag] : [],
            source: {
                file: 'ayrilanlar.xlsx',
                sheet: 'Table 1',
                row: i + 1
            }
        });
    }

    console.log(`  Parsed ${departures.length} departures`);
    console.log(`  Unmapped tags: ${[...unmappedTags].join(', ') || 'none'}`);

    return { departures, unmappedTags: [...unmappedTags] };
}

// ============================================================================
// PARSE LEAVES FILE
// ============================================================================

function parseIzinBelgeleriFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = getSheetData(workbook, sheetName);

    const leaves = [];

    // Find header row (contains "PERSONELİN İSMİ" or "İZİN")
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (!row) continue;
        const rowText = row.filter(Boolean).join(' ').toUpperCase();
        if (rowText.includes('PERSONEL') || rowText.includes('İZİN')) {
            headerRowIdx = i;
            break;
        }
    }

    console.log(`  Found header at row ${headerRowIdx + 1}`);

    // Parse data rows starting after header
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        // Column A (index 0): Row number
        const rowNum = row[0];
        if (typeof rowNum !== 'number' && !/^\d+$/.test(String(rowNum))) continue;

        // Column B (index 1): Person name
        const fullName = String(row[1] || '').trim();
        if (!fullName || fullName.length < 2) continue;

        // Column C (index 2): Start date (Excel serial number)
        const startDateRaw = row[2];
        const startDate = parseDate(startDateRaw);

        // Column D (index 3): End date (Excel serial number)
        const endDateRaw = row[3];
        const endDate = parseDate(endDateRaw);

        // Column E (index 4): Days
        const days = typeof row[4] === 'number' ? row[4] : parseInt(row[4], 10) || null;

        // Column F (index 5): Type (optional - ÜCRETSİZ İZİN etc)
        const typeRaw = String(row[5] || '').trim().toUpperCase();
        const type = typeRaw.includes('ÜCRETSİZ') ? 'ÜCRETSİZ' : 'NORMAL';

        if (!startDate) {
            console.log(`  Warning: Could not parse start date for ${fullName}: ${startDateRaw}`);
            continue;
        }

        const normalizedName = normalizeName(fullName);
        leaves.push({
            id: uuid(),
            fullName,
            normalizedName,
            baseKey: normalizedName,
            startDate,
            endDate: endDate || startDate,
            days: days || daysBetween(startDate, endDate || startDate),
            type,
            source: {
                file: 'izin_belgeleri.xlsx',
                sheet: sheetName,
                row: i + 1
            }
        });
    }

    console.log(`  Parsed ${leaves.length} leave records`);
    return { leaves };
}


// ============================================================================
// PARSE TRACKING FILE
// ============================================================================

function parseTakipFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = getSheetData(workbook, sheetName);

    const tracking = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[1]) continue;

        const rowNum = row[0];
        if (typeof rowNum !== 'number' && !/^\d+$/.test(String(rowNum))) continue;

        const fullName = String(row[1] || '').trim();
        if (!fullName || fullName.length < 2) continue;

        const normalizedName = normalizeName(fullName);

        tracking.push({
            id: uuid(),
            fullName,
            normalizedName,
            baseKey: normalizedName,
            applicationNo: String(row[2] || '').trim(),
            profession: String(row[3] || '').trim(),
            status: String(row[4] || '').trim(),
            expectedDate: parseDate(row[5]),
            contactPerson: String(row[6] || '').trim(),
            notes: String(row[7] || '').trim(),
            source: {
                file: 'takip.xlsx',
                sheet: sheetName,
                row: i + 1
            }
        });
    }

    console.log(`  Parsed ${tracking.length} tracking records`);
    return { tracking };
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

function deduplicatePeople(people) {
    console.log('\n🔍 Deduplicating people...');

    const byBaseKey = new Map();
    const duplicateCandidates = [];

    for (const person of people) {
        const key = person.baseKey;

        if (byBaseKey.has(key)) {
            const existing = byBaseKey.get(key);

            // Same person from same sheet = skip duplicate
            if (existing.source.sheet === person.source.sheet) continue;

            // Same person from different sheets with DIFFERENT categories = conflict
            if (existing.category !== person.category) {
                duplicateCandidates.push({
                    type: 'AMBIGUOUS_DUPLICATE',
                    names: [existing.fullName, person.fullName],
                    categories: [existing.category, person.category],
                    reason: 'Same name appears in multiple category sheets'
                });
            }

            // Merge sources
            if (!existing.mergedFrom) existing.mergedFrom = [];
            existing.mergedFrom.push(person.source);
        } else {
            byBaseKey.set(key, { ...person, mergedFrom: [] });
        }
    }

    const deduplicated = [...byBaseKey.values()];
    console.log(`  Deduplicated: ${people.length} → ${deduplicated.length}`);
    console.log(`  Duplicate candidates: ${duplicateCandidates.length}`);

    return { people: deduplicated, duplicateCandidates };
}

// ============================================================================
// DETECT CONFLICTS (ACTIVE + DEPARTED)
// ============================================================================

function detectConflicts(activePeople, departures) {
    console.log('\n🔍 Detecting active/departed conflicts...');

    const activeKeys = new Set(activePeople.map(p => p.baseKey));
    const conflicts = [];

    for (const dep of departures) {
        if (activeKeys.has(dep.baseKey)) {
            const activePerson = activePeople.find(p => p.baseKey === dep.baseKey);
            conflicts.push({
                type: 'ACTIVE_DEPARTED',
                fullName: dep.fullName,
                category: activePerson?.category || dep.category,
                activeSource: activePerson?.source?.sheet,
                departedSource: 'ayrilanlar.xlsx',
                exitDate: dep.exitDate
            });
        }
    }

    console.log(`  Found ${conflicts.length} active/departed conflicts`);
    return conflicts;
}

// ============================================================================
// LINK RECORDS TO PEOPLE
// ============================================================================

function linkRecordsToPeople(records, people, recordType) {
    const personByBaseKey = new Map(people.map(p => [p.baseKey, p]));

    const linked = [];
    const unlinked = [];

    for (const record of records) {
        const person = personByBaseKey.get(record.baseKey);

        if (person) {
            linked.push({ ...record, personId: person.personId });
        } else {
            // Try fuzzy match (similarity > 0.9)
            let bestMatch = null;
            let bestSim = 0;

            for (const p of people) {
                const sim = levenshteinSimilarity(record.normalizedName, p.normalizedName);
                if (sim > 0.9 && sim > bestSim) {
                    bestSim = sim;
                    bestMatch = p;
                }
            }

            if (bestMatch) {
                linked.push({ ...record, personId: bestMatch.personId });
                console.log(`  Fuzzy matched "${record.fullName}" → "${bestMatch.fullName}" (${Math.round(bestSim * 100)}%)`);
            } else {
                unlinked.push(record);
            }
        }
    }

    if (unlinked.length > 0) {
        console.log(`  ${unlinked.length} ${recordType} records could not be linked`);
    }

    return { linked, unlinked };
}

// ============================================================================
// CREATE PENDING FROM TRACKING
// ============================================================================

function createPendingFromTracking(unlinkedTracking, existingPeople) {
    const existingBaseKeys = new Set(existingPeople.map(p => p.baseKey));
    const pendingPeople = [];

    for (const track of unlinkedTracking) {
        if (existingBaseKeys.has(track.baseKey)) continue;

        pendingPeople.push({
            personId: uuid(),
            baseKey: track.baseKey,
            fullName: track.fullName,
            normalizedName: track.normalizedName,
            category: null,
            role: null,
            jobTitle: track.profession,
            needsReview: true,
            unmappedTags: [],
            status: 'pending',
            sources: [track.source],
            mergedFrom: [],
            trackingInfo: {
                applicationNo: track.applicationNo,
                profession: track.profession,
                status: track.status,
                expectedDate: track.expectedDate,
                contactPerson: track.contactPerson
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        existingBaseKeys.add(track.baseKey);
    }

    return pendingPeople;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('='.repeat(60));
    console.log('Personnel Data Ingestion Script (FIXED)');
    console.log('='.repeat(60));

    const isMerge = process.argv.includes('--merge');
    let existingDb = null;
    let tagMap = {};

    if (isMerge && existsSync(OUTPUT_PATH)) {
        console.log('\n📥 Loading existing db.json for merge...');
        existingDb = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
        tagMap = existingDb.taxonomy?.tagMap || {};
    }

    const allUnmappedTags = new Set();

    // File paths
    const onIzinPath = join(RAW_DATA_DIR, 'on_izin.xlsx');
    const ayrilanlarPath = join(RAW_DATA_DIR, 'ayrilanlar.xlsx');
    const izinBelgeleriPath = join(RAW_DATA_DIR, 'izin_belgeleri.xlsx');
    const takipPath = join(RAW_DATA_DIR, 'takip.xlsx');

    // 1. Parse ÖN İZİN - FROM CATEGORY SHEETS (THE FIX!)
    console.log('\n📂 Parsing ÖN İZİN file...');
    const onIzinWorkbook = readExcelFile(onIzinPath);

    // Parse from category sheets (NOT TÜM LİSTE!)
    const { people: rawPeople, categoryCounts } = parseCategorySheets(onIzinWorkbook);

    // Validate against SAYILAR
    const sayilar = parseSayilar(onIzinWorkbook);
    const validation = validateAgainstSayilar(categoryCounts, sayilar);

    if (!validation.isValid) {
        console.log('\n⚠️ WARNING: Category counts do not match SAYILAR!');
        console.log('   Please verify the Excel file.');
    } else {
        console.log('\n✅ All category counts match SAYILAR!');
    }

    // 2. Parse Departures
    console.log('\n📂 Parsing İşten Ayrılanlar file...');
    const { departures: rawDepartures, unmappedTags: ayrilanlarTags } = parseAyrilanlarFile(ayrilanlarPath);
    ayrilanlarTags.forEach(t => allUnmappedTags.add(t));

    // 3. Parse Leaves
    console.log('\n📂 Parsing İzin Belgeleri file...');
    const { leaves: rawLeaves } = parseIzinBelgeleriFile(izinBelgeleriPath);

    // 4. Parse Tracking
    console.log('\n📂 Parsing Takip file...');
    const { tracking: rawTracking } = parseTakipFile(takipPath);

    // Deduplicate active roster
    const { people: dedupedPeople, duplicateCandidates } = deduplicatePeople(rawPeople);

    // Add personId to each person
    const people = dedupedPeople.map(p => ({
        ...p,
        personId: uuid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));

    // Detect conflicts
    const conflicts = detectConflicts(people, rawDepartures);

    // Link records
    console.log('\n🔗 Linking records...');
    const { linked: linkedLeaves, unlinked: unlinkedLeaves } = linkRecordsToPeople(rawLeaves, people, 'leave');
    const { linked: linkedTracking, unlinked: unlinkedTracking } = linkRecordsToPeople(rawTracking, people, 'tracking');

    // Create pending from unlinked tracking
    console.log('\n👥 Creating pending roster...');
    const pendingPeople = createPendingFromTracking(unlinkedTracking, people);
    console.log(`  Created ${pendingPeople.length} pending people`);

    // Combine
    const allPeople = [...people, ...pendingPeople];

    // Link pending tracking
    const pendingPersonMap = new Map(pendingPeople.map(p => [p.baseKey, p]));
    const linkedPendingTracking = unlinkedTracking.map(track => {
        const person = pendingPersonMap.get(track.baseKey);
        return person ? { ...track, personId: person.personId } : null;
    }).filter(Boolean);

    const allTracking = [...linkedTracking, ...linkedPendingTracking];

    // Process departures
    const departures = rawDepartures.map(d => ({
        id: d.id,
        personId: uuid(),
        fullName: d.fullName,
        category: d.category,
        job: d.job,
        entryDate: d.entryDate,
        exitDate: d.exitDate,
        totalDays: d.totalDays,
        exitMonth: d.exitMonth,
        needsReview: d.needsReview,
        unmappedTags: d.unmappedTags
    }));

    // Calculate statistics
    const stats = {
        totalPeople: allPeople.length,
        activeRosterCount: people.length,  // This is the SAYILAR total
        pendingCount: pendingPeople.length,
        departedCount: departures.length,
        conflictCount: conflicts.length,
        needsReviewCount: allPeople.filter(p => p.needsReview).length,
        unmappedTagsCount: allUnmappedTags.size,
        duplicateCandidatesCount: duplicateCandidates.length,
        leavesCount: linkedLeaves.length,
        trackingCount: allTracking.length,
        byCategory: {},
        byRole: {}
    };

    // Count by category (active roster only)
    for (const cat of CATEGORIES) {
        stats.byCategory[cat] = people.filter(p => p.category === cat).length;
    }
    stats.byCategory['UNCATEGORIZED'] = people.filter(p => !p.category).length;

    // Count by role
    for (const role of ROLES) {
        stats.byRole[role] = allPeople.filter(p => p.role === role).length;
    }
    stats.byRole['UNASSIGNED'] = allPeople.filter(p => !p.role).length;

    // Build final db.json
    const db = {
        meta: {
            generatedAt: new Date().toISOString(),
            version: '3.0.0',
            sourceFiles: ['on_izin.xlsx', 'ayrilanlar.xlsx', 'izin_belgeleri.xlsx', 'takip.xlsx'],
            adminHash: existingDb?.meta?.adminHash || null,
            remoteStore: existingDb?.meta?.remoteStore || {
                enabled: false,
                gistId: null,
                repoUrl: null
            },
            validation: {
                isValid: validation.isValid,
                errors: validation.errors,
                sayilarExpected: sayilar.expected,
                sayilarTotal: sayilar.expectedTotal
            },
            stats
        },
        taxonomy: {
            categories: CATEGORIES,
            roles: ROLES,
            tagMap: {
                ...tagMap,
                ...[...allUnmappedTags].reduce((acc, tag) => {
                    if (!tagMap[tag]) acc[tag] = null;
                    return acc;
                }, {})
            }
        },
        people: allPeople,
        leaves: linkedLeaves,
        tracking: allTracking,
        departures,
        duplicateCandidates,
        conflicts,
        audit: existingDb?.audit || []
    };

    // Write output
    console.log('\n💾 Writing db.json...');
    writeFileSync(OUTPUT_PATH, JSON.stringify(db, null, 2), 'utf-8');
    console.log(`  Saved to: ${OUTPUT_PATH}`);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 INGESTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`
  Active Roster:       ${stats.activeRosterCount} (from category sheets)
  Pending:             ${stats.pendingCount}
  Total People:        ${stats.totalPeople}
  Departed:            ${stats.departedCount}
  
  Conflicts:           ${stats.conflictCount}
  Needs Review:        ${stats.needsReviewCount}
  Unmapped Tags:       ${stats.unmappedTagsCount}
  
  Leave Records:       ${stats.leavesCount}
  Tracking Records:    ${stats.trackingCount}
  
  By Category (Active Roster):
${CATEGORIES.map(cat => `    ${cat}: ${stats.byCategory[cat]}`).join('\n')}
    UNCATEGORIZED: ${stats.byCategory['UNCATEGORIZED']}
  
  Validation: ${validation.isValid ? '✅ PASSED' : '❌ FAILED'}
${validation.errors.length > 0 ? '  Errors:\n' + validation.errors.map(e => `    - ${e.category}: ${e.actual} (expected ${e.expected})`).join('\n') : ''}
`);

    // Final validation check
    if (stats.byCategory['UNCATEGORIZED'] > 0) {
        console.log('⚠️ WARNING: Found uncategorized people in active roster. This should be 0.');
    }

    if (!validation.isValid) {
        console.log('❌ VALIDATION FAILED: Category counts do not match SAYILAR.');
        process.exit(1);
    }

    console.log('✅ Ingestion complete!');
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
