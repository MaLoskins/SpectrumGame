/**
 * ===================================
 * SPECTRUM GAME - VALIDATION
 * ===================================
 *
 * Centralized validation logic for:
 * - Player names
 * - Room codes
 * - Clues
 * - Coordinates
 * - Chat messages
 *
 * This file is used by both client and server
 * ================================= */

import { VALIDATION } from './constants.js';


/**
 * Validator class for centralizing all validation logic
 */
class Validator {
  /**
   * Validate a player name
   * @param {string} name - The player name to validate
   * @returns {Object} Validation result with valid flag and error message if invalid
   */
  static playerName(name) {
    const trimmed = name?.trim();
    
    if (!trimmed) {
      return { valid: false, error: 'Player name cannot be empty' };
    }
    
    if (trimmed.length > VALIDATION.MAX_PLAYER_NAME_LENGTH) {
      return {
        valid: false,
        error: `Player name must be ${VALIDATION.MAX_PLAYER_NAME_LENGTH} characters or less`
      };
    }
    
    if (!VALIDATION.PLAYER_NAME_PATTERN.test(trimmed)) {
      return {
        valid: false,
        error: 'Player name can only contain letters, numbers, spaces, hyphens, and underscores'
      };
    }
    
    return { valid: true, value: trimmed };
  }

  /**
   * Validate a room code
   * @param {string} code - The room code to validate
   * @returns {Object} Validation result with valid flag and error message if invalid
   */
  static roomCode(code) {
    const trimmed = code?.trim().toUpperCase();
    
    if (!trimmed) {
      return { valid: false, error: 'Room code cannot be empty' };
    }
    
    if (!VALIDATION.ROOM_CODE_PATTERN.test(trimmed)) {
      return {
        valid: false,
        error: 'Room code must be 4-6 characters (letters and numbers only)'
      };
    }
    
    return { valid: true, value: trimmed };
  }

  /**
   * Validate a clue
   * @param {string} clue - The clue to validate
   * @returns {Object} Validation result with valid flag and error message if invalid
   */
  static clue(clue) {
    const trimmed = clue?.trim();
    
    if (!trimmed) {
      return { valid: false, error: 'Clue cannot be empty' };
    }
    
    if (trimmed.length > VALIDATION.MAX_CLUE_LENGTH) {
      return {
        valid: false,
        error: `Clue must be ${VALIDATION.MAX_CLUE_LENGTH} characters or less`
      };
    }
    
    if (!VALIDATION.CLUE_PATTERN.test(trimmed)) {
      return { valid: false, error: 'Clue cannot contain numbers' };
    }
    
    return { valid: true, value: trimmed };
  }

  /**
   * Validate a coordinate
   * @param {Object} coord - The coordinate to validate {x, y}
   * @param {number} min - Minimum allowed value (default: 0)
   * @param {number} max - Maximum allowed value (default: 100)
   * @returns {Object} Validation result with valid flag and error message if invalid
   */
  static coordinate(coord, min = 0, max = 100) {
    if (!coord || typeof coord.x !== 'number' || typeof coord.y !== 'number') {
      return { valid: false, error: 'Invalid coordinate format' };
    }
    
    if (coord.x < min || coord.x > max || coord.y < min || coord.y > max) {
      return {
        valid: false,
        error: `Coordinates must be between ${min} and ${max}`
      };
    }
    
    return { valid: true, value: { x: coord.x, y: coord.y } };
  }

  /**
   * Validate a chat message
   * @param {string} message - The chat message to validate
   * @returns {Object} Validation result with valid flag and error message if invalid
   */
  static chatMessage(message) {
    const trimmed = message?.trim();
    
    if (!trimmed) {
      return { valid: false, error: 'Message cannot be empty' };
    }
    
    if (trimmed.length > VALIDATION.MAX_CHAT_MESSAGE_LENGTH) {
      return {
        valid: false,
        error: `Message must be ${VALIDATION.MAX_CHAT_MESSAGE_LENGTH} characters or less`
      };
    }
    
    return { valid: true, value: trimmed };
  }

  /**
   * Generic input validation method
   * @param {string} value - The value to validate
   * @param {number} maxLength - Maximum allowed length
   * @param {RegExp} pattern - Optional regex pattern to test
   * @param {string} emptyError - Error message for empty value
   * @param {string} lengthError - Error message for length violation
   * @param {string} formatError - Error message for pattern violation
   * @returns {Object} Validation result with valid flag and error message if invalid
   */
  static input(value, maxLength, pattern, emptyError, lengthError, formatError) {
    const trimmed = value?.trim();
    
    if (!trimmed) {
      return { valid: false, error: emptyError };
    }
    
    if (trimmed.length > maxLength) {
      return { valid: false, error: lengthError };
    }
    
    if (pattern && !pattern.test(trimmed)) {
      return { valid: false, error: formatError };
    }
    
    return { valid: true, value: trimmed };
  }
}

// CommonJS module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Validator;
}

// ES6 module export for browsers
export default Validator;
export { Validator };