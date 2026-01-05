/**
 * taxonomy.js - Fixed taxonomy definitions
 * 8 Categories and 12 Roles - IMMUTABLE
 */

// 8 Fixed Categories
export const CATEGORIES = Object.freeze([
  'REPSAM',
  'KALMES',
  'NEŞAT',
  'BANGLADEŞ',
  'ÖZBEK',
  'TÜRKMEN',
  'ZİMBAVE',
  'CAPRA'
]);

// 12 Fixed Roles
export const ROLES = Object.freeze([
  'CAPRA İŞVEREN',
  'CAPRA DİREKTÖR',
  'REPSAM İŞVEREN',
  'REPSAM DİREKTÖR',
  'ÜLKE KOORDİNATÖRÜ',
  'MİMAR',
  'MÜHENDİS',
  'FORMEN',
  'İSG',
  'OFİS PERSONELİ',
  'PROJE MÜDÜRÜ',
  'HİZMETLİ'
]);

// Category set for O(1) lookup
export const CATEGORY_SET = new Set(CATEGORIES);

// Role set for O(1) lookup
export const ROLE_SET = new Set(ROLES);

// Known typo corrections (applied before classification)
export const TYPO_FIXES = Object.freeze({
  'RPSAM İŞVEREN': 'REPSAM İŞVEREN',
  'RPSAM DİREKTÖR': 'REPSAM DİREKTÖR',
  'RPSAM': 'REPSAM'
});

// Roles that imply a specific category
export const ROLE_TO_CATEGORY = Object.freeze({
  'CAPRA İŞVEREN': 'CAPRA',
  'CAPRA DİREKTÖR': 'CAPRA',
  'REPSAM İŞVEREN': 'REPSAM',
  'REPSAM DİREKTÖR': 'REPSAM'
});

/**
 * Classify a tag from Excel data
 * @param {string} rawTag - The raw tag from Excel
 * @param {Object} tagMap - Admin-defined tag mappings from db.json
 * @returns {Object} { category, role, needsReview, unmappedTag }
 */
export function classifyTag(rawTag, tagMap = {}) {
  if (!rawTag || typeof rawTag !== 'string') {
    return { category: null, role: null, needsReview: true, unmappedTag: null };
  }

  // Clean and normalize
  let tag = rawTag.trim().toUpperCase();
  
  // Apply typo fixes
  if (TYPO_FIXES[tag]) {
    tag = TYPO_FIXES[tag];
  }

  // Check admin-defined tag map first
  if (tagMap[tag]) {
    const mappedCategory = tagMap[tag];
    if (CATEGORY_SET.has(mappedCategory)) {
      return { category: mappedCategory, role: null, needsReview: false, unmappedTag: null };
    }
  }

  // Case 1: Tag is a category
  if (CATEGORY_SET.has(tag)) {
    return { category: tag, role: null, needsReview: false, unmappedTag: null };
  }

  // Case 2: Tag is a role
  if (ROLE_SET.has(tag)) {
    const impliedCategory = ROLE_TO_CATEGORY[tag] || null;
    return { 
      category: impliedCategory, 
      role: tag, 
      needsReview: impliedCategory === null, // General roles need category review
      unmappedTag: null 
    };
  }

  // Case 3: Unmapped tag
  return { 
    category: null, 
    role: null, 
    needsReview: true, 
    unmappedTag: tag 
  };
}

/**
 * Get category color for UI
 */
export const CATEGORY_COLORS = Object.freeze({
  'REPSAM': '#6366f1',    // Indigo
  'KALMES': '#8b5cf6',    // Purple
  'NEŞAT': '#ec4899',     // Pink
  'BANGLADEŞ': '#14b8a6', // Teal
  'ÖZBEK': '#f59e0b',     // Amber
  'TÜRKMEN': '#10b981',   // Emerald
  'ZİMBAVE': '#ef4444',   // Red
  'CAPRA': '#3b82f6'      // Blue
});

/**
 * Get status color for UI
 */
export const STATUS_COLORS = Object.freeze({
  'active': '#10b981',    // Green
  'pending': '#f59e0b',   // Amber
  'departed': '#6b7280',  // Gray
  'conflict': '#ef4444'   // Red
});
