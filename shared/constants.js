/**
 * ===================================
 * SPECTRUM GAME - SHARED CONSTANTS
 * ===================================
 *
 * Centralized constants for the Spectrum game including:
 * - Game rules and limits
 * - Scoring parameters
 * - Validation constraints
 * - Network configuration
 * - UI settings
 *
 * This file is used by both client and server
 * ================================= */

/**
 * Game rules and limits
 */
const GAME_RULES = {
  // Player limits
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  
  // Round settings
  ROUND_DURATION: 180, // seconds
  MAX_ROUNDS: 10,
  RESULTS_VIEWING_TIME: 7000, // ms
  BETWEEN_ROUNDS_DELAY: 3000, // ms
  
  // Spectrum boundaries
  SPECTRUM_MIN: 0,
  SPECTRUM_MAX: 100,
  MAX_DISTANCE: Math.sqrt(20000) // ~141.4 (diagonal distance across 100x100 grid)
};

/**
 * Scoring parameters
 */
const SCORING = {
  BONUS_THRESHOLD: 10, // distance units
  BONUS_POINTS: 50
};

/**
 * Validation constraints
 */
const VALIDATION = {
  // Input length limits
  MAX_PLAYER_NAME_LENGTH: 20,
  MAX_CLUE_LENGTH: 100,
  MAX_CHAT_MESSAGE_LENGTH: 200,
  
  // Regex patterns
  PLAYER_NAME_PATTERN: /^[a-zA-Z0-9\s\-_]+$/,
  ROOM_CODE_PATTERN: /^[A-Z0-9]{4,6}$/,
  CLUE_PATTERN: /^[^\d]+$/
};

/**
 * Network configuration
 */
const NETWORK = {
  // Connection settings
  RECONNECT_ATTEMPTS: 5,
  INITIAL_RECONNECT_DELAY: 1000, // ms
  MAX_RECONNECT_DELAY: 30000, // ms
  CONNECTION_TIMEOUT: 10000, // ms
  
  // Server URLs
  LOCAL_SERVER_URL: 'http://localhost:3000',
  
  // WebSocket options
  TRANSPORTS: ['websocket', 'polling']
};

/**
 * UI settings
 */
const UI = {
  // Animation durations
  NOTIFICATION_DURATION: 5000, // ms
  ANIMATION_DURATION: 300, // ms
  
  // Colors
  COLORS: {
    // Primary colors
    TEAL: '#00d4ff',
    LILAC: '#b794f4',
    ELECTRIC_BLUE: '#0096ff',
    PINK: '#ff006e',
    GREEN: '#00f593',
    ORANGE: '#ff9500',
    RED: '#ff3864',
    
    // Background colors
    DARK_BG: '#0a0f1c',
    SECONDARY_BG: '#0f1628',
    ACCENT_BG: '#141d33',
    GLASS_BG: 'rgba(255, 255, 255, 0.05)',
    
    // Text colors
    TEXT_PRIMARY: '#e0e6f0',
    TEXT_SECONDARY: '#a8b2c7',
    TEXT_MUTED: '#6b7890'
  }
};

/**
 * Error codes
 */
const ERROR_CODES = {
  // Validation errors
  INVALID_PLAYER_NAME: 'INVALID_PLAYER_NAME',
  INVALID_ROOM_CODE: 'INVALID_ROOM_CODE',
  INVALID_CLUE: 'INVALID_CLUE',
  INVALID_GUESS: 'INVALID_GUESS',
  
  // Room errors
  ROOM_CREATE_FAILED: 'ROOM_CREATE_FAILED',
  ROOM_JOIN_FAILED: 'ROOM_JOIN_FAILED',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  
  // Game errors
  GAME_START_FAILED: 'GAME_START_FAILED',
  CLUE_SUBMIT_FAILED: 'CLUE_SUBMIT_FAILED',
  GUESS_SUBMIT_FAILED: 'GUESS_SUBMIT_FAILED',
  
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_LOST: 'CONNECTION_LOST'
};

// Combine all constants into a single object
const CONSTANTS = {
  GAME_RULES,
  SCORING,
  VALIDATION,
  NETWORK,
  UI,
  ERROR_CODES
};

// CommonJS module exports for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GAME_RULES,
    SCORING,
    VALIDATION,
    NETWORK,
    UI,
    ERROR_CODES,
    CONSTANTS
  };
}

// Make available globally in browser
if (typeof window !== 'undefined') {
  window.GAME_RULES = GAME_RULES;
  window.SCORING = SCORING;
  window.VALIDATION = VALIDATION;
  window.NETWORK = NETWORK;
  window.UI = UI;
  window.ERROR_CODES = ERROR_CODES;
  window.CONSTANTS = CONSTANTS;
}
