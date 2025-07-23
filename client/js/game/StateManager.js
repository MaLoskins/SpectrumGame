/**
 * Centralized state management with event system for Spectrum
 * Maintains game state consistency and provides reactive state updates
 * UPDATED: Support for 2D coordinate system
 */

class StateManager {
    constructor() {
        this.eventListeners = new Map();
        this.state = this.getInitialState();
        this.stateHistory = [];
        this.maxHistorySize = 50;
        this.debugMode = true;
    }

    /**
     * Get initial state structure for the application
     * @returns {Object} Initial state object with default values
     */
    getInitialState() {
        return {
            connection: { status: 'disconnected', playerId: null, roomCode: null, error: null, lastConnected: null },
            game: {
                phase: 'lobby', currentRound: 0, totalRounds: 0, timeRemaining: 0,
                spectrumX: null, spectrumY: null, clue: null, targetCoordinate: null,
                clueGiverId: null, guesses: {}, roundScores: {}, totalScores: {},
                finalScores: {}, winner: null, gameStats: null, bonusAwarded: false, roundSummary: []
            },
            players: {},
            room: { code: null, hostId: null, playerCount: 0, maxPlayers: 4, canStart: false, settings: {} },
            ui: {
                activeModal: null, chatVisible: true, scoreboardVisible: true, notifications: [],
                loading: false, currentView: 'lobby', spectrumInteractionEnabled: false, showTargetCoordinate: false
            },
            chat: { messages: [], unreadCount: 0, maxMessages: 100 }
        };
    }

    /**
     * Initialize the state manager
     * Loads persisted state, sets up persistence, and initializes debug tools
     * @returns {Promise<void>}
     */
    async init() {
        console.log('📊 Initializing StateManager...');
        this.loadPersistedState();
        this.setupPersistence();
        this.debugMode && this.on('state:changed', () => this.validateState());
        console.log('✅ StateManager initialized');
        this.debugMode && console.log('🔍 Initial state:', this.state);
        
        // Initialize debug interface
        if (this.debugMode) {
            window.stateDebug = this.debug;
            console.log('🛠️ Debug interface available via window.stateDebug');
        }
    }

    // Event system
    /**
     * Register an event listener
     * @param {string} event - Event name to listen for
     * @param {Function} callback - Callback function to execute when event is emitted
     */
    on(event, callback) {
        (this.eventListeners.get(event) || this.eventListeners.set(event, new Set()).get(event)).add(callback);
        this.debugMode && console.log(`🔔 Listener added for event: ${event}`);
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) { this.eventListeners.get(event)?.delete(callback); }
    
    /**
     * Emit an event to all registered listeners
     * @param {string} event - Event name to emit
     * @param {*} data - Data to pass to listeners
     */
    emit(event, data = null) {
        if (this.debugMode && !event.startsWith('timer:')) console.log(`📢 Emitting event: ${event}`, data);
        this.eventListeners.get(event)?.forEach(cb => { try { cb(data); } catch (e) { console.error(`❌ Error in ${event}:`, e); } });
    }

    /**
     * Remove all event listeners
     * Clears all registered event listeners
     */
    removeAllListeners() { this.eventListeners.clear(); }

    // State updates
    /**
     * Update a specific path in the state
     * @param {string} path - Dot-notation path to the state property
     * @param {*} newValue - New value to set
     * @param {boolean} emitEvent - Whether to emit state change events
     */
    updateState(path, newValue, emitEvent = true) {
        const oldValue = this.getStateValue(path);
        if (typeof newValue !== 'object' && oldValue === newValue) return;
        
        if (this.debugMode && !path.includes('timeRemaining')) console.log(`🔄 State update: ${path}`, { oldValue, newValue });
        
        this.setStateValue(path, newValue);
        this.addToHistory(path, oldValue, newValue);
        
        if (emitEvent) {
            const eventData = { path, oldValue, newValue, fullState: this.state };
            this.emit(`state:${path}`, eventData);
            this.emit('state:changed', eventData);
        }
    }

    /**
     * Get a value from the state by path
     * @param {string} path - Dot-notation path to the state property
     * @returns {*} Value at the specified path
     */
    getStateValue(path) { return path.split('.').reduce((obj, key) => obj?.[key], this.state); }
    
    /**
     * Set a value in the state by path
     * @param {string} path - Dot-notation path to the state property
     * @param {*} value - Value to set
     */
    setStateValue(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        keys.reduce((obj, key) => obj[key] ??= {}, this.state)[lastKey] = value;
    }

    // Batch updates
    /**
     * Update multiple state paths at once
     * @param {Object} updates - Object mapping paths to values
     */
    batchUpdate(updates) {
        console.log('🔄 Batch update:', updates);
        Object.entries(updates).forEach(([path, value]) => this.updateState(path, value, false));
        this.emit('state:batch-updated', { updates, fullState: this.state });
    }

    // Connection state
    /**
     * Update connection state properties
     * @param {Object} updates - Object with connection state updates
     */
    updateConnectionState(updates) {
        console.log('🔌 Updating connection state:', updates);
        Object.entries(updates).forEach(([key, value]) => this.updateState(`connection.${key}`, value));
    }

    /**
     * Get current connection state
     * @returns {Object} Connection state object
     */
    getConnectionState = () => ({ ...this.state.connection });
    
    /**
     * Set connection state to connected
     * @param {string} playerId - Player ID
     * @param {string} roomCode - Room code
     */
    setConnected = (playerId, roomCode) => this.updateConnectionState({ status: 'connected', playerId, roomCode, error: null, lastConnected: Date.now() });
    
    /**
     * Set connection state to disconnected
     * @param {string|null} error - Error message or null
     */
    setDisconnected = error => this.updateConnectionState({ status: 'disconnected', error });
    
    /**
     * Set connection state to connecting
     */
    setConnecting = () => this.updateState('connection.status', 'connecting');
    /**
     * Set connection state to reconnecting
     */
    setReconnecting = () => this.updateState('connection.status', 'reconnecting');

    // Game state
    /**
     * Update multiple game state properties and emit appropriate events
     * @param {Object} updates - Object containing game state updates
     */
    updateGameState(updates) {
        console.log('🎮 Updating game state:', updates);
        
        // Collect old values and update state
        const oldValues = this.collectOldValuesAndUpdate(updates);
        
        // Emit events for individual property changes
        this.emitPropertyChangeEvents(updates, oldValues);
        
        // Emit overall state change event
        this.emit('state:changed', { path: 'game', updates, fullState: this.state });
    }
    
    /**
     * Collect old values and update state properties
     * @param {Object} updates - Object containing game state updates
     * @returns {Object} Old values before update
     * @private
     */
    collectOldValuesAndUpdate(updates) {
        const oldValues = {};
        
        Object.keys(updates).forEach(key => {
            if (key in this.state.game) {
                oldValues[key] = this.state.game[key];
                this.state.game[key] = updates[key];
            }
        });
        
        return oldValues;
    }
    
    /**
     * Emit events for individual property changes
     * @param {Object} updates - Object containing game state updates
     * @param {Object} oldValues - Old values before update
     * @private
     */
    emitPropertyChangeEvents(updates, oldValues) {
        Object.keys(updates).forEach(key => {
            const path = `game.${key}`;
            if (oldValues[key] !== updates[key]) {
                this.addToHistory(path, oldValues[key], updates[key]);
                this.emit(`state:${path}`, {
                    path,
                    oldValue: oldValues[key],
                    newValue: updates[key],
                    fullState: this.state
                });
            }
        });
    }

    /**
     * Get current game state
     * @returns {Object} Copy of game state
     */
    getGameState = () => ({ ...this.state.game });
    
    /**
     * Reset game state to initial values
     */
    resetGameState = () => this.updateState('game', this.getInitialState().game);
    
    /**
     * Set game phase
     * @param {string} phase - New game phase
     */
    setGamePhase = phase => this.updateState('game.phase', phase);
    
    /**
     * Set spectrum labels for X and Y axes
     * @param {Object} spectrumX - X-axis spectrum labels
     * @param {Object} spectrumY - Y-axis spectrum labels
     */
    setSpectrums = (spectrumX, spectrumY) => this.batchUpdate({ 'game.spectrumX': spectrumX, 'game.spectrumY': spectrumY });
    
    /**
     * Set target coordinate for current round
     * @param {Object} coordinate - Target coordinate {x, y}
     */
    setTargetCoordinate = coordinate => this.updateState('game.targetCoordinate', coordinate);
    
    /**
     * Update remaining time
     * @param {number} timeRemaining - Time remaining in seconds
     */
    updateTimer = timeRemaining => this.updateState('game.timeRemaining', timeRemaining);
    
    /**
     * Set clue and clue giver for current round
     * @param {string} clue - Clue text
     * @param {string} clueGiverId - ID of clue giver
     */
    setClue = (clue, clueGiverId) => this.updateGameState({ clue, clueGiverId });
    
    /**
     * Set round results
     * @param {Object} results - Round results
     * @param {Object} [results.roundScores] - Scores for this round
     * @param {Object} [results.totalScores] - Updated total scores
     * @param {boolean} [results.bonusAwarded] - Whether bonus was awarded
     * @param {Array} [results.roundSummary] - Round summary data
     */
    setRoundResults = results => this.updateGameState({ roundScores: results.roundScores || {}, totalScores: results.totalScores || {}, bonusAwarded: results.bonusAwarded || false, roundSummary: results.roundSummary || [] });
    
    /**
     * Set final game results
     * @param {Object} results - Final results
     * @param {Object} [results.finalScores] - Final scores
     * @param {string} [results.winner] - ID of winner
     * @param {Object} [results.gameStats] - Game statistics
     */
    setFinalResults = results => this.updateGameState({ finalScores: results.finalScores || {}, winner: results.winner || null, gameStats: results.gameStats || null });

    // Room state
    /**
     * Update room state properties
     * @param {Object} updates - Object with room state updates
     */
    updateRoomState(updates) {
        console.log('🏠 Updating room state:', updates);
        Object.entries(updates).forEach(([key, value]) => this.updateState(`room.${key}`, value));
    }

    /**
     * Get current room state
     * @returns {Object} Copy of room state
     */
    getRoomState = () => ({ ...this.state.room });
    
    /**
     * Set room information
     * @param {Object} roomInfo - Room information
     * @param {string} roomInfo.code - Room code
     * @param {string} roomInfo.hostId - Host player ID
     * @param {number} roomInfo.playerCount - Number of players
     * @param {number} roomInfo.maxPlayers - Maximum number of players
     * @param {boolean} roomInfo.canStart - Whether game can be started
     * @param {Object} [roomInfo.settings] - Room settings
     */
    setRoomInfo = roomInfo => this.updateRoomState({ code: roomInfo.code, hostId: roomInfo.hostId, playerCount: roomInfo.playerCount, maxPlayers: roomInfo.maxPlayers, canStart: roomInfo.canStart, settings: roomInfo.settings || {} });

    // Player management
    /**
     * Update players state
     * @param {Array|Object} players - Array of player objects or object mapping player IDs to player objects
     */
    updatePlayers(players) {
        const playersObj = Array.isArray(players) ? Object.fromEntries(players.map(p => [p.id, p])) : players;
        this.updateState('players', playersObj);
    }

    /**
     * Add a player to the state
     * @param {Object} player - Player object
     */
    addPlayer = player => this.updateState('players', { ...this.state.players, [player.id]: player });
    
    /**
     * Update a player's properties
     * @param {string} playerId - Player ID
     * @param {Object} updates - Properties to update
     */
    updatePlayer = (playerId, updates) => this.state.players[playerId] && this.updateState('players', { ...this.state.players, [playerId]: { ...this.state.players[playerId], ...updates } });
    
    /**
     * Remove a player from the state
     * @param {string} playerId - Player ID to remove
     */
    removePlayer = playerId => { const { [playerId]: _, ...remaining } = this.state.players; this.updateState('players', remaining); };
    /**
     * Get all players
     * @returns {Object} Copy of players state
     */
    getPlayers = () => ({ ...this.state.players });
    
    /**
     * Get a specific player by ID
     * @param {string} playerId - Player ID
     * @returns {Object|null} Player object or null if not found
     */
    getPlayer = playerId => this.state.players[playerId] ? { ...this.state.players[playerId] } : null;
    /**
     * Get current player
     * @returns {Object|null} Current player object or null if not connected
     */
    getCurrentPlayer = () => this.getPlayer(this.state.connection.playerId);
    
    /**
     * Check if current player is the clue giver
     * @returns {boolean} Whether current player is the clue giver
     */
    isCurrentPlayerClueGiver = () => this.state.connection.playerId === this.state.game.clueGiverId;

    // UI state
    /**
     * Update UI state properties
     * @param {Object} updates - Object with UI state updates
     */
    updateUIState(updates) {
        console.log('🖼️ Updating UI state:', updates);
        Object.entries(updates).forEach(([key, value]) => this.updateState(`ui.${key}`, value));
    }

    /**
     * Get current UI state
     * @returns {Object} Copy of UI state
     */
    getUIState = () => ({ ...this.state.ui });
    /**
     * Show a modal dialog
     * @param {string} modalId - ID of modal to show
     * @param {*} [data=null] - Data to pass to modal
     */
    showModal = (modalId, data = null) => this.updateState('ui.activeModal', { id: modalId, data });
    
    /**
     * Hide the active modal
     */
    hideModal = () => this.updateState('ui.activeModal', null);
    
    /**
     * Set loading state
     * @param {boolean} loading - Whether UI is in loading state
     */
    setLoading = loading => this.updateState('ui.loading', loading);
    
    /**
     * Set current view
     * @param {string} view - View to display
     */
    setCurrentView = view => this.updateState('ui.currentView', view);
    
    /**
     * Enable or disable spectrum interaction
     * @param {boolean} enabled - Whether spectrum interaction is enabled
     */
    enableSpectrumInteraction = enabled => this.updateState('ui.spectrumInteractionEnabled', enabled);
    
    /**
     * Show or hide target coordinate
     * @param {boolean} show - Whether to show target coordinate
     */
    showTargetCoordinate = show => this.updateState('ui.showTargetCoordinate', show);

    /**
     * Add a notification to the UI
     * @param {Object} notification - Notification object
     * @param {string} [notification.type='info'] - Notification type
     * @param {string} notification.message - Notification message
     * @param {number} [notification.duration=5000] - Duration in milliseconds
     */
    addNotification(notification) {
        const n = { id: Date.now() + Math.random(), timestamp: Date.now(), type: 'info', duration: 5000, ...notification };
        this.updateState('ui.notifications', [...this.state.ui.notifications, n]);
        n.duration !== 0 && setTimeout(() => this.removeNotification(n.id), n.duration);
    }

    /**
     * Remove a notification from the UI
     * @param {string|number} notificationId - ID of notification to remove
     */
    removeNotification = notificationId => this.updateState('ui.notifications', this.state.ui.notifications.filter(n => n.id !== notificationId));

    // Chat
    /**
     * Add a chat message
     * @param {Object} message - Chat message object
     */
    addChatMessage(message) {
        const msg = { id: Date.now() + Math.random(), timestamp: Date.now(), type: 'message', ...message };
        const messages = [...this.state.chat.messages, msg].slice(-this.state.chat.maxMessages);
        this.updateState('chat.messages', messages);
        !this.state.ui.chatVisible && this.updateState('chat.unreadCount', this.state.chat.unreadCount + 1);
    }

    /**
     * Clear all chat messages
     */
    clearChatMessages = () => this.batchUpdate({ 'chat.messages': [], 'chat.unreadCount': 0 });
    
    /**
     * Mark all chat messages as read
     */
    markChatAsRead = () => this.updateState('chat.unreadCount', 0);
    
    /**
     * Get all chat messages
     * @returns {Array} Copy of chat messages
     */
    getChatMessages = () => [...this.state.chat.messages];

    // History
    /**
     * Add a state change to history
     * @param {string} path - Path of changed state property
     * @param {*} oldValue - Previous value
     * @param {*} newValue - New value
     * @private
     */
    addToHistory(path, oldValue, newValue) {
        if (path.includes('timeRemaining')) return;
        this.stateHistory = [...this.stateHistory.slice(-(this.maxHistorySize - 1)), { timestamp: Date.now(), path, oldValue, newValue }];
    }

    /**
     * Get state change history
     * @returns {Array} Copy of state history
     */
    getStateHistory = () => [...this.stateHistory];

    // Persistence
    /**
     * Set up state persistence
     * Saves UI preferences when they change
     * @private
     */
    setupPersistence() {
        this.on('state:changed', ({ path }) => 
            ['ui.chatVisible', 'ui.scoreboardVisible'].some(p => path.startsWith(p)) && this.savePersistedState());
    }

    /**
     * Save UI preferences to localStorage
     * @private
     */
    savePersistedState() {
        try {
            localStorage.setItem('spectrum-game-state', JSON.stringify({ ui: { chatVisible: this.state.ui.chatVisible, scoreboardVisible: this.state.ui.scoreboardVisible } }));
        } catch (e) { console.warn('Failed to save state:', e); }
    }

    /**
     * Load UI preferences from localStorage
     * @private
     */
    loadPersistedState() {
        try {
            const saved = JSON.parse(localStorage.getItem('spectrum-game-state') || '{}');
            saved.ui && Object.entries(saved.ui).forEach(([key, value]) => this.updateState(`ui.${key}`, value, false));
        } catch (e) { console.warn('Failed to load state:', e); }
    }

    // Validation
    /**
     * Validate state structure
     * Checks for required state paths
     * @returns {boolean} Whether state is valid
     * @private
     */
    validateState() {
        const required = ['connection.status', 'game.phase', 'players', 'ui.currentView', 'chat.messages'];
        const missing = required.filter(path => this.getStateValue(path) == null);
        missing.length && console.warn('⚠️ Missing state paths:', missing);
        return !missing.length;
    }

    /**
     * Handle game state updates and apply phase-specific logic
     * @param {Object} gameState - New game state
     */
    handleGameStateUpdate(gameState) {
        console.log('🎮 Handling game state update:', gameState);
        const previousPhase = this.state.game.phase;
        this.updateGameState(gameState);
        
        const isClueGiver = this.isCurrentPlayerClueGiver();
        
        // Apply phase-specific handler or default to lobby handler
        const handler = this.getPhaseHandler(gameState.phase);
        handler(previousPhase, isClueGiver);
    }
    
    /**
     * Get the appropriate phase handler function
     * @param {string} phase - Game phase
     * @returns {Function} Phase handler function
     * @private
     */
    getPhaseHandler(phase) {
        const phaseHandlers = {
            'giving-clue': this.handleGivingCluePhase.bind(this),
            'guessing': this.handleGuessingPhase.bind(this),
            'scoring': this.handleScoringPhase.bind(this),
            'lobby': this.handleLobbyPhase.bind(this)
        };
        
        return phaseHandlers[phase] || phaseHandlers.lobby;
    }
    
    /**
     * Handle giving-clue phase
     * @param {string} previousPhase - Previous game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     * @private
     */
    handleGivingCluePhase(previousPhase, isClueGiver) {
        this.enableSpectrumInteraction(false);
        this.showTargetCoordinate(isClueGiver);
        
        if (!isClueGiver) {
            this.updateState('game.targetCoordinate', null);
        }
    }
    
    /**
     * Handle guessing phase
     * @param {string} previousPhase - Previous game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     * @private
     */
    handleGuessingPhase(previousPhase, isClueGiver) {
        this.showTargetCoordinate(isClueGiver);
        this.enableSpectrumInteraction(!isClueGiver);
        
        if (!isClueGiver) {
            this.updateState('game.targetCoordinate', null);
        }
    }
    
    /**
     * Handle scoring phase
     * @param {string} previousPhase - Previous game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     * @private
     */
    handleScoringPhase(previousPhase, isClueGiver) {
        this.showTargetCoordinate(true);
        this.enableSpectrumInteraction(false);
    }
    
    /**
     * Handle lobby phase
     * @param {string} previousPhase - Previous game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     * @private
     */
    handleLobbyPhase(previousPhase, isClueGiver) {
        this.showTargetCoordinate(false);
        this.enableSpectrumInteraction(false);
        
        if (!['lobby', 'waiting'].includes(previousPhase)) {
            this.updateState('game.targetCoordinate', null);
        }
    }

    /**
     * Handle room joined event
     * Updates connection state, players, and room info
     * @param {Object} data - Room joined data
     * @param {string} data.playerId - Player ID
     * @param {string} data.roomCode - Room code
     * @param {Array} data.players - Array of players
     * @param {Object} [data.room] - Room information
     */
    handleRoomJoined(data) {
        this.setConnected(data.playerId, data.roomCode);
        this.updatePlayers(data.players);
        this.setRoomInfo(data.room || {});
        this.setCurrentView('game');
    }

    /**
     * Handle player update event
     * Updates one or multiple players
     * @param {Object|Array} playerData - Player data or array of players
     */
    handlePlayerUpdate = playerData => Array.isArray(playerData) ? this.updatePlayers(playerData) : this.updatePlayer(playerData.id, playerData);

    /**
     * Handle round end event
     * Updates game state with round results
     * @param {Object} results - Round results
     */
    handleRoundEnd(results) {
        this.setRoundResults(results);
        this.setGamePhase('scoring');
        this.showTargetCoordinate(true);
        this.enableSpectrumInteraction(false);
    }

    /**
     * Handle game end event
     * Updates game state with final results
     * @param {Object} results - Final results
     */
    handleGameEnd(results) {
        this.setFinalResults(results);
        this.setGamePhase('finished');
        this.showTargetCoordinate(true);
        this.enableSpectrumInteraction(false);
    }

    // Debug interface - consolidated debug methods
    /**
     * Debug interface for development and troubleshooting
     * @type {Object}
     */
    debug = {
        /**
         * Log state information with optional component filter
         * @param {string|null} component - Optional component name to filter
         */
        state: (component = null) => {
            const state = this.getFullState();
            console.group(`🔍 State Debug ${component ? `- ${component}` : ''}`);
            console.log('Timestamp:', new Date().toISOString());
            console.table([state.connection,
                { phase: state.game.phase, round: `${state.game.currentRound}/${state.game.totalRounds}`, clueGiverId: state.game.clueGiverId, targetCoordinate: state.game.targetCoordinate },
                state.players,
                { currentView: state.ui.currentView, loading: state.ui.loading, spectrumInteractionEnabled: state.ui.spectrumInteractionEnabled }
            ]);
            console.groupEnd();
        },
        
        /**
         * Log current state to console
         */
        log: () => console.log('📊 Current State:', this.getFullState()),
        
        /**
         * Enable or disable debug mode
         * @param {boolean} enabled - Whether debug mode is enabled
         */
        setEnabled: (enabled) => { this.debugMode = enabled; }
    };
    
    /**
     * Get a deep copy of the full state
     * @returns {Object} Deep copy of state
     */
    getFullState = () => JSON.parse(JSON.stringify(this.state));
    
    /**
     * Reset state to initial values
     * Clears history and emits reset event
     */
    resetState = () => { this.state = this.getInitialState(); this.stateHistory = []; this.emit('state:reset'); };
    // logStateHistory removed - unused

    /**
     * Clean up resources and save state
     * Removes event listeners and resets state
     */
    destroy() {
        this.removeAllListeners();
        this.savePersistedState();
        this.resetState();
        console.log('🧹 StateManager destroyed');
    }
}

export const stateManager = new StateManager();
export { StateManager };