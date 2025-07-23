/**
 * ===================================
 * SPECTRUM GAME - EVENT CONSTANTS
 * ===================================
 *
 * Centralized event name constants using the module:action format
 * This prevents typos and ensures consistency across the codebase
 *
 * This file is used by both client and server
 * ================================= */

/**
 * Socket connection events
 */
const CONNECTION_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ERROR: 'reconnect_error',
  PING: 'ping',
  PONG: 'pong'
};

/**
 * Room-related events
 */
const ROOM_EVENTS = {
  CREATE: 'room:create',
  CREATED: 'room:created',
  JOIN: 'room:join',
  JOINED: 'room:joined',
  PLAYER_JOINED: 'room:player-joined',
  PLAYER_LEFT: 'room:player-left',
  HOST_CHANGED: 'room:host-changed',
  SETTINGS_UPDATED: 'room:settings-updated'
};

/**
 * Game-related events
 */
const GAME_EVENTS = {
  START: 'game:start',
  STATE_UPDATE: 'game:state-update',
  ROUND_START: 'game:round-start',
  SUBMIT_CLUE: 'game:submit-clue',
  CLUE_SUBMITTED: 'game:clue-submitted',
  SUBMIT_GUESS: 'game:submit-guess',
  GUESS_SUBMITTED: 'game:guess-submitted',
  ROUND_END: 'game:round-end',
  FINISHED: 'game:finished',
  PHASE_CHANGE: 'game:phase-change',
  REQUEST_STATE: 'game:request-state'
};

/**
 * Player-related events
 */
const PLAYER_EVENTS = {
  DISCONNECT: 'player:disconnect',
  UPDATE: 'player:update'
};

/**
 * Chat-related events
 */
const CHAT_EVENTS = {
  SEND: 'chat:send',
  MESSAGE: 'chat:message'
};

/**
 * Timer-related events
 */
const TIMER_EVENTS = {
  UPDATE: 'timer:update',
  EXPIRED: 'timer:expired'
};

/**
 * UI-related events
 */
const UI_EVENTS = {
  CREATE_ROOM: 'ui:create-room',
  JOIN_ROOM: 'ui:join-room',
  START_GAME: 'ui:start-game',
  SUBMIT_CLUE: 'ui:submit-clue',
  SEND_CHAT: 'ui:send-chat',
  LEAVE_ROOM: 'ui:leave-room',
  SPECTRUM_GUESS_PLACED: 'spectrum:guess-placed'
};

/**
 * State-related events
 */
const STATE_EVENTS = {
  CHANGED: 'state:changed',
  BATCH_UPDATED: 'state:batch-updated',
  RESET: 'state:reset'
};

/**
 * Error events
 */
const ERROR_EVENTS = {
  GENERAL: 'error',
  CONNECTION: 'connection-error'
};

/**
 * Helper function to get event name with proper format
 * @param {string} category - The event category
 * @param {string} action - The specific action
 * @returns {string} Formatted event name
 */
function getEventName(category, action) {
  return `${category}:${action}`;
}

// Combine all events into a single object
const EVENTS = {
  CONNECTION: CONNECTION_EVENTS,
  ROOM: ROOM_EVENTS,
  GAME: GAME_EVENTS,
  PLAYER: PLAYER_EVENTS,
  CHAT: CHAT_EVENTS,
  TIMER: TIMER_EVENTS,
  UI: UI_EVENTS,
  STATE: STATE_EVENTS,
  ERROR: ERROR_EVENTS,
  getEventName
};

// CommonJS module exports for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONNECTION_EVENTS,
    ROOM_EVENTS,
    GAME_EVENTS,
    PLAYER_EVENTS,
    CHAT_EVENTS,
    TIMER_EVENTS,
    UI_EVENTS,
    STATE_EVENTS,
    ERROR_EVENTS,
    getEventName,
    EVENTS
  };
}

// ES6 module exports for browsers
export {
  CONNECTION_EVENTS,
  ROOM_EVENTS,
  GAME_EVENTS,
  PLAYER_EVENTS,
  CHAT_EVENTS,
  TIMER_EVENTS,
  UI_EVENTS,
  STATE_EVENTS,
  ERROR_EVENTS,
  getEventName,
  EVENTS
};
