/**
 * ===================================
 * SPECTRUM GAME - ERROR HANDLING
 * ===================================
 *
 * Standardized error handling with:
 * - Base GameError class
 * - Specific error subclasses
 * - Error code constants
 * - Error formatting utilities
 *
 * This file is used by both client and server
 * ================================= */


/**
 * Base GameError class for standardized error handling
 * @extends Error
 */
class GameError extends Error {
  /**
   * Create a new GameError
   * @param {string} code - Error code from ERROR_CODES
   * @param {string} message - Human-readable error message
   * @param {Object} details - Additional error details (optional)
   */
  constructor(code, message, details = null) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
  }

  /**
   * Convert error to a plain object for serialization
   * @returns {Object} Plain object representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }

  /**
   * Create a string representation of the error
   * @returns {string} String representation
   */
  toString() {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

/**
 * Validation error for input validation failures
 * @extends GameError
 */
class ValidationError extends GameError {
  /**
   * Create a new ValidationError
   * @param {string} code - Error code from ERROR_CODES
   * @param {string} message - Human-readable error message
   * @param {Object} field - The field that failed validation
   * @param {*} value - The invalid value
   */
  constructor(code, message, field, value) {
    super(code, message, { field, value });
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Network error for connection and communication failures
 * @extends GameError
 */
class NetworkError extends GameError {
  /**
   * Create a new NetworkError
   * @param {string} code - Error code from ERROR_CODES
   * @param {string} message - Human-readable error message
   * @param {Object} details - Additional error details (optional)
   */
  constructor(code, message, details = null) {
    super(code, message, details);
    this.name = 'NetworkError';
  }
}

/**
 * Room error for room-related failures
 * @extends GameError
 */
class RoomError extends GameError {
  /**
   * Create a new RoomError
   * @param {string} code - Error code from ERROR_CODES
   * @param {string} message - Human-readable error message
   * @param {string} roomCode - The room code (if applicable)
   */
  constructor(code, message, roomCode = null) {
    super(code, message, { roomCode });
    this.name = 'RoomError';
    this.roomCode = roomCode;
  }
}

/**
 * Game error for game logic failures
 * @extends GameError
 */
class GameLogicError extends GameError {
  /**
   * Create a new GameLogicError
   * @param {string} code - Error code from ERROR_CODES
   * @param {string} message - Human-readable error message
   * @param {string} phase - The game phase when the error occurred (if applicable)
   * @param {Object} details - Additional error details (optional)
   */
  constructor(code, message, phase = null, details = null) {
    super(code, message, { ...details, phase });
    this.name = 'GameLogicError';
    this.phase = phase;
  }
}

/**
 * Create a ValidationError for invalid player name
 * @param {string} name - The invalid player name
 * @param {string} message - Custom error message (optional)
 * @returns {ValidationError} Validation error
 */
function createPlayerNameError(name, message = 'Invalid player name') {
  return new ValidationError(
    ERROR_CODES.INVALID_PLAYER_NAME,
    message,
    'playerName',
    name
  );
}

/**
 * Create a ValidationError for invalid room code
 * @param {string} code - The invalid room code
 * @param {string} message - Custom error message (optional)
 * @returns {ValidationError} Validation error
 */
function createRoomCodeError(code, message = 'Invalid room code') {
  return new ValidationError(
    ERROR_CODES.INVALID_ROOM_CODE,
    message,
    'roomCode',
    code
  );
}

/**
 * Create a ValidationError for invalid clue
 * @param {string} clue - The invalid clue
 * @param {string} message - Custom error message (optional)
 * @returns {ValidationError} Validation error
 */
function createClueError(clue, message = 'Invalid clue') {
  return new ValidationError(
    ERROR_CODES.INVALID_CLUE,
    message,
    'clue',
    clue
  );
}

/**
 * Create a ValidationError for invalid guess/coordinate
 * @param {Object} coord - The invalid coordinate
 * @param {string} message - Custom error message (optional)
 * @returns {ValidationError} Validation error
 */
function createCoordinateError(coord, message = 'Invalid coordinate') {
  return new ValidationError(
    ERROR_CODES.INVALID_GUESS,
    message,
    'coordinate',
    coord
  );
}

/**
 * Create a RoomError for room not found
 * @param {string} roomCode - The room code
 * @returns {RoomError} Room error
 */
function createRoomNotFoundError(roomCode) {
  return new RoomError(
    ERROR_CODES.ROOM_NOT_FOUND,
    `Room ${roomCode} not found`,
    roomCode
  );
}

/**
 * Create a RoomError for room full
 * @param {string} roomCode - The room code
 * @param {number} maxPlayers - Maximum number of players
 * @returns {RoomError} Room error
 */
function createRoomFullError(roomCode, maxPlayers) {
  return new RoomError(
    ERROR_CODES.ROOM_FULL,
    `Room ${roomCode} is full (max ${maxPlayers} players)`,
    roomCode
  );
}

/**
 * Create a NetworkError for connection failure
 * @param {string} message - Error message
 * @param {Object} details - Additional details (optional)
 * @returns {NetworkError} Network error
 */
function createConnectionError(message, details = null) {
  return new NetworkError(
    ERROR_CODES.CONNECTION_FAILED,
    message,
    details
  );
}

/**
 * Create a GameLogicError for invalid game state
 * @param {string} message - Error message
 * @param {string} phase - Current game phase
 * @returns {GameLogicError} Game logic error
 */
function createGameStateError(message, phase) {
  return new GameLogicError(
    ERROR_CODES.GAME_START_FAILED,
    message,
    phase
  );
}

/**
 * Convert a standard Error to a GameError
 * @param {Error} error - Standard error object
 * @param {string} defaultCode - Default error code to use
 * @returns {GameError} Converted GameError
 */
function convertToGameError(error, defaultCode = 'UNKNOWN_ERROR') {
  if (error instanceof GameError) {
    return error;
  }
  
  return new GameError(
    defaultCode,
    error.message || 'An unknown error occurred',
    { originalError: error.toString() }
  );
}

// Combine all errors into a single object
const Errors = {
  GameError,
  ValidationError,
  NetworkError,
  RoomError,
  GameLogicError,
  createPlayerNameError,
  createRoomCodeError,
  createClueError,
  createCoordinateError,
  createRoomNotFoundError,
  createRoomFullError,
  createConnectionError,
  createGameStateError,
  convertToGameError
};

// CommonJS module exports for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GameError,
    ValidationError,
    NetworkError,
    RoomError,
    GameLogicError,
    createPlayerNameError,
    createRoomCodeError,
    createClueError,
    createCoordinateError,
    createRoomNotFoundError,
    createRoomFullError,
    createConnectionError,
    createGameStateError,
    convertToGameError,
    Errors
  };
}

// Make available globally in browser
if (typeof window !== 'undefined') {
  window.GameError = GameError;
  window.ValidationError = ValidationError;
  window.NetworkError = NetworkError;
  window.RoomError = RoomError;
  window.GameLogicError = GameLogicError;
  window.createPlayerNameError = createPlayerNameError;
  window.createRoomCodeError = createRoomCodeError;
  window.createClueError = createClueError;
  window.createCoordinateError = createCoordinateError;
  window.createRoomNotFoundError = createRoomNotFoundError;
  window.createRoomFullError = createRoomFullError;
  window.createConnectionError = createConnectionError;
  window.createGameStateError = createGameStateError;
  window.convertToGameError = convertToGameError;
  window.Errors = Errors;
}
