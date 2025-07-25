/**
 * ===================================
 * SPECTRUM GAME - UTILITY HELPERS
 * ===================================
 * 
 * Utility functions including:
 * - Common helper functions
 * - DOM manipulation utilities
 * - Event handling helpers
 * - Validation utilities
 * - Performance optimizations
 * - Dark mode color utilities
 * 
 * ================================= */

/**
 * Debounce function to limit function calls
 */
export function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

/**
 * Throttle function to limit function calls
 */
export function throttle(func, limit) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            lastRan = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(this, args);
                    lastRan = Date.now();
                }
            }, Math.max(limit - (Date.now() - lastRan), 0));
        }
    };
}

/**
 * Deep clone an object (optimized version)
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof RegExp) return new RegExp(obj);
    
    const clonedObj = new obj.constructor();
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            clonedObj[key] = deepClone(obj[key]);
        }
    }
    return clonedObj;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Format time duration
 */
export function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
        return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Clamp a number between min and max
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
export function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

/**
 * Map a value from one range to another
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

/**
 * Check if a value is between two numbers
 */
export function isBetween(value, min, max, inclusive = true) {
    return inclusive ? value >= min && value <= max : value > min && value < max;
}

/**
 * Get random number between min and max
 */
export function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Get random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle an array (Fisher-Yates)
 */
export function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Get random item from array
 */
export function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Remove item from array (immutable)
 */
export function removeItem(array, item) {
    const index = array.indexOf(item);
    if (index === -1) return array;
    return [...array.slice(0, index), ...array.slice(index + 1)];
}

/**
 * Check if string is empty or whitespace
 */
export function isEmpty(str) {
    return !str || str.trim().length === 0;
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// titleCase function removed - unused

/**
 * Truncate string with ellipsis
 */
export function truncate(str, length, suffix = '...') {
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Escape HTML characters (optimized)
 */
const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
};

export function escapeHtml(text) {
    return text.replace(/[&<>"'/]/g, char => escapeMap[char]);
}

/**
 * Parse query string parameters
 */
export function parseQueryString(queryString = window.location.search) {
    const params = {};
    const urlParams = new URLSearchParams(queryString);
    
    for (const [key, value] of urlParams) {
        params[key] = value;
    }
    
    return params;
}

/**
 * Create query string from object
 */
export function createQueryString(params) {
    const urlParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) {
            urlParams.append(key, value);
        }
    }
    
    return urlParams.toString();
}

/**
 * Check if device is mobile
 */
export function isMobile() {
    return window.innerWidth <= 767 || 
           /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// isTablet function removed - unused

/**
 * Check if device is desktop
 */
export function isDesktop() {
    return window.innerWidth > 1023;
}

/**
 * Check if device supports touch
 */
export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get viewport dimensions
 */
export function getViewport() {
    return {
        width: window.innerWidth,
        height: window.innerHeight
    };
}

// scrollToElement function removed - unused

// isInViewport function removed - unused

// addClassWithAnimation function removed - unused

// removeClassWithAnimation function removed - unused

/**
 * Wait for specified time
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry(fn, maxAttempts = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxAttempts) {
                throw lastError;
            }
            
            await wait(delay * Math.pow(2, attempt - 1));
        }
    }
}

/**
 * Create a promise that resolves after specified time
 */
export function timeout(ms, value) {
    return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

// withTimeout function removed - unused

/**
 * Local storage helpers with error handling
 */
export const storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Failed to get from localStorage:', error);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Failed to set localStorage:', error);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.warn('Failed to clear localStorage:', error);
            return false;
        }
    }
};

// cookies object removed - unused

// EventEmitter class removed - unused

// perf object removed - unused

/**
 * Dark mode color utilities
 */
export const darkModeColors = {
    // Primary colors
    teal: '#00d4ff',
    lilac: '#b794f4',
    electricBlue: '#0096ff',
    pink: '#ff006e',
    green: '#00f593',
    orange: '#ff9500',
    red: '#ff3864',
    
    // Background colors
    darkBg: '#0a0f1c',
    secondaryBg: '#0f1628',
    accentBg: '#141d33',
    glassBg: 'rgba(255, 255, 255, 0.05)',
    
    // Text colors
    textPrimary: '#e0e6f0',
    textSecondary: '#a8b2c7',
    textMuted: '#6b7890',
    
    // Glass effect colors
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    glassShadow: '0 8px 32px rgba(0, 212, 255, 0.1)',
    glowShadow: '0 0 30px rgba(0, 212, 255, 0.2)'
};

/**
 * Color utilities (optimized)
 */
export const color = {
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    
    lighten(hex, percent) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex;
        
        const factor = 1 + (percent / 100);
        return this.rgbToHex(
            Math.min(255, Math.round(rgb.r * factor)),
            Math.min(255, Math.round(rgb.g * factor)),
            Math.min(255, Math.round(rgb.b * factor))
        );
    },
    
    darken(hex, percent) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex;
        
        const factor = 1 - (percent / 100);
        return this.rgbToHex(
            Math.max(0, Math.round(rgb.r * factor)),
            Math.max(0, Math.round(rgb.g * factor)),
            Math.max(0, Math.round(rgb.b * factor))
        );
    },
    
    addAlpha(hex, alpha) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex;
        
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    },
    
    getGlassEffect(color = '#ffffff', opacity = 0.05) {
        return {
            background: this.addAlpha(color, opacity),
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: `1px solid ${this.addAlpha(color, opacity * 2)}`
        };
    },
    
    getNeonGlow(color, intensity = 1) {
        return `
            0 0 ${10 * intensity}px ${color},
            0 0 ${20 * intensity}px ${color},
            0 0 ${30 * intensity}px ${this.addAlpha(color, 0.5)}
        `;
    }
};

/**
 * Export all helpers as a single object
 */
export const helpers = {
    debounce,
    throttle,
    deepClone,
    generateId,
    formatDuration,
    formatNumber,
    clamp,
    lerp,
    mapRange,
    isBetween,
    randomBetween,
    randomInt,
    shuffle,
    randomItem,
    removeItem,
    isEmpty,
    capitalize,
    // titleCase removed - unused
    truncate,
    escapeHtml,
    parseQueryString,
    createQueryString,
    isMobile,
    // isTablet removed - unused
    isDesktop,
    isTouchDevice,
    getViewport,
    // scrollToElement, isInViewport, addClassWithAnimation, removeClassWithAnimation removed - unused
    wait,
    retry,
    timeout,
    // withTimeout, cookies, EventEmitter, perf removed - unused
    storage,
    color,
    darkModeColors
};

export default helpers;