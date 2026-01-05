/**
 * utils.js - Utility functions for data processing
 */

/**
 * Normalize a name for comparison and deduplication
 * Unicode NFKD normalization + diacritics removal + uppercase + trim
 * @param {string} name - Raw name string
 * @returns {string} Normalized name
 */
export function normalizeName(name) {
    if (!name || typeof name !== 'string') return '';

    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .toUpperCase()
        .trim()
        .replace(/\s+/g, ' '); // Collapse multiple spaces
}

/**
 * Generate SHA-1 hash (for browser and Node.js)
 * @param {string} str - String to hash
 * @returns {Promise<string>} Hex hash string
 */
export async function sha1(str) {
    // Node.js environment
    if (typeof crypto !== 'undefined' && crypto.createHash) {
        const { createHash } = await import('crypto');
        return createHash('sha1').update(str).digest('hex');
    }

    // Browser environment
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Synchronous SHA-1 for Node.js (used in ingest script)
 */
export function sha1Sync(str) {
    const crypto = require('crypto');
    return crypto.createHash('sha1').update(str).digest('hex');
}

/**
 * Generate UUID v4
 * @returns {string} UUID string
 */
export function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshtein(a, b) {
    if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);

    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio (0-1) between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity ratio (1 = identical)
 */
export function similarity(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;

    return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Parse date from various Excel formats
 * @param {any} value - Date value from Excel
 * @returns {string|null} ISO date string (YYYY-MM-DD) or null
 */
export function parseDate(value) {
    if (!value) return null;

    // Excel serial date number
    if (typeof value === 'number') {
        const date = excelSerialToDate(value);
        return formatDateISO(date);
    }

    // String date
    if (typeof value === 'string') {
        const str = value.trim();

        // DD/MM/YYYY or DD.MM.YYYY
        const dmyMatch = str.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})$/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10);
            let year = parseInt(dmyMatch[3], 10);
            if (year < 100) year += 2000;
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        // MM/DD/YY (US format)
        const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
        if (mdyMatch) {
            const month = parseInt(mdyMatch[1], 10);
            const day = parseInt(mdyMatch[2], 10);
            let year = parseInt(mdyMatch[3], 10) + 2000;
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        // ISO format
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        }

        // Try native parsing
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            return formatDateISO(date);
        }
    }

    return null;
}

/**
 * Convert Excel serial date to JavaScript Date
 */
function excelSerialToDate(serial) {
    // Excel epoch is 1899-12-30
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
}

/**
 * Format Date to ISO string (YYYY-MM-DD)
 */
function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calculate days between two dates
 * @param {string} startDate - Start date (ISO format)
 * @param {string} endDate - End date (ISO format)
 * @returns {number} Number of days (inclusive)
 */
export function daysBetween(startDate, endDate) {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
}

/**
 * Format date for display (Turkish locale)
 * @param {string} isoDate - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(isoDate) {
    if (!isoDate) return '-';

    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;

    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Get month key from date (YYYY-MM)
 * @param {string} isoDate - ISO date string
 * @returns {string} Month key
 */
export function getMonthKey(isoDate) {
    if (!isoDate) return 'unknown';
    return isoDate.substring(0, 7);
}

/**
 * Get month display name
 * @param {string} monthKey - YYYY-MM format
 * @returns {string} Display name (e.g., "Ocak 2025")
 */
export function getMonthDisplay(monthKey) {
    if (!monthKey || monthKey === 'unknown') return 'Bilinmiyor';

    const [year, month] = monthKey.split('-');
    const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    return `${months[parseInt(month, 10) - 1]} ${year}`;
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
