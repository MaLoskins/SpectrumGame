/**
 * Centralized state management with event system for Spectrum
 * Maintains game state consistency and provides reactive state updates
 * FIXED: Better debugging, proper state updates for clue giver
 */

class StateManager {
    constructor() {
        // Event system
        this.eventListeners = new Map();
        
        // Application state
        this.state = this.getInitialState();
        
        // State history for debugging
        this.stateHistory = [];
        this.maxHistorySize = 50;
        
        // Debug mode
        this.debugMode = true;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.emit = this.emit.bind(this);
        this.on = this.on.bind(this);
        this.off = this.off.bind(this);
    }

    /**
     * Get initial application state
     * @returns {Object} Initial state object
     */
    getInitialState() {
        return {
            // Connection state
            connection: {
                status: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
                playerId: null,
                roomCode: null,
                error: null,
                lastConnected: null
            },
            
            // Game state
            game: {
                phase: 'lobby', // 'lobby' | 'waiting' | 'giving-clue' | 'guessing' | 'scoring' | 'finished'
                currentRound: 0,
                totalRounds: 0,
                timeRemaining: 0,
                spectrum: null,
                clue: null,
                targetPosition: null, // Only visible to Clue Giver
                clueGiverId: null,
                guesses: {},
                roundScores: {},
                totalScores: {},
                finalScores: {},
                winner: null,
                gameStats: null,
                bonusAwarded: false,
                roundSummary: []
            },
            
            // Players state
            players: {},
            
            // Room state
            room: {
                code: null,
                hostId: null,
                playerCount: 0,
                maxPlayers: 4,
                canStart: false,
                settings: {}
            },
            
            // UI state
            ui: {
                activeModal: null,
                chatVisible: true,
                scoreboardVisible: true,
                notifications: [],
                loading: false,
                currentView: 'lobby', // 'lobby' | 'game'
                spectrumInteractionEnabled: false,
                showTargetPosition: false
            },
            
            // Chat state
            chat: {
                messages: [],
                unreadCount: 0,
                maxMessages: 100
            }
        };
    }

    /**
     * Initialize the state manager
     */
    async init() {
        console.log('📊 Initializing StateManager...');
        
        // Load persisted state if available
        this.loadPersistedState();
        
        // Set up state persistence
        this.setupStatePersistence();
        
        // Set up state validation
        this.setupStateValidation();
        
        console.log('✅ StateManager initialized');
        
        // Log initial state if debug mode
        if (this.debugMode) {
            console.log('🔍 Initial state:', this.state);
        }
    }

    /**
     * Event system - Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
        
        if (this.debugMode) {
            console.log(`🔔 Listener added for event: ${event}`);
        }
    }

    /**
     * Event system - Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    /**
     * Event system - Emit event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data = null) {
        if (this.debugMode && !event.startsWith('timer:')) {
            console.log(`📢 Emitting event: ${event}`, data);
        }
        
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Remove all event listeners
     */
    removeAllListeners() {
        this.eventListeners.clear();
    }

    /**
     * Update state and emit events
     * @param {string} path - State path (dot notation)
     * @param {*} newValue - New value
     * @param {boolean} emitEvent - Whether to emit events
     */
    updateState(path, newValue, emitEvent = true) {
        const oldValue = this.getStateValue(path);
        
        // Don't update if value hasn't changed (except for objects/arrays)
        if (typeof newValue !== 'object' && oldValue === newValue) {
            return;
        }
        
        if (this.debugMode && !path.includes('timeRemaining')) {
            console.log(`🔄 State update: ${path}`, { oldValue, newValue });
        }
        
        // Update state
        this.setStateValue(path, newValue);
        
        // Add to history
        this.addToHistory(path, oldValue, newValue);
        
        // Emit specific event
        if (emitEvent) {
            this.emit(`state:${path}`, {
                path,
                oldValue,
                newValue,
                fullState: this.state
            });
            
            // Emit general state change event
            this.emit('state:changed', {
                path,
                oldValue,
                newValue,
                fullState: this.state
            });
        }
    }

    /**
     * Get state value by path
     * @param {string} path - State path (dot notation)
     * @returns {*} State value
     */
    getStateValue(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    /**
     * Set state value by path
     * @param {string} path - State path (dot notation)
     * @param {*} value - Value to set
     */
    setStateValue(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!(key in obj)) obj[key] = {};
            return obj[key];
        }, this.state);
        
        target[lastKey] = value;
    }

    /**
     * Connection state methods
     */
    updateConnectionState(updates) {
        console.log('🔌 Updating connection state:', updates);
        Object.entries(updates).forEach(([key, value]) => {
            this.updateState(`connection.${key}`, value);
        });
    }

    getConnectionState() {
        return { ...this.state.connection };
    }

    setConnected(playerId, roomCode) {
        console.log(`✅ Connected as player ${playerId} to room ${roomCode}`);
        this.updateConnectionState({
            status: 'connected',
            playerId,
            roomCode,
            error: null,
            lastConnected: Date.now()
        });
    }

    setDisconnected(error = null) {
        console.log('❌ Disconnected:', error);
        this.updateConnectionState({
            status: 'disconnected',
            error
        });
    }

    setConnecting() {
        console.log('🔄 Connecting...');
        this.updateState('connection.status', 'connecting');
    }

    setReconnecting() {
        console.log('🔄 Reconnecting...');
        this.updateState('connection.status', 'reconnecting');
    }

    /**
     * Game state methods
     */
    updateGameState(updates) {
        console.log('🎮 Updating game state:', updates);
        
        const oldValues = {};
        const changedKeys = Object.keys(updates);

        // Step 1: Atomically update the state object first, without emitting events.
        // Record the old values for the event payload.
        changedKeys.forEach(key => {
            if (this.state.game.hasOwnProperty(key)) {
                oldValues[key] = this.state.game[key];
                this.state.game[key] = updates[key];
            }
        });

        // Step 2: Now that the state is fully consistent, emit events for each changed property.
        // Any listener will now see the complete, updated state.
        changedKeys.forEach(key => {
            const path = `game.${key}`;
            const oldValue = oldValues[key];
            const newValue = updates[key];

            // Only proceed if the value actually changed
            if (oldValue !== newValue) {
                // Add individual change to history
                this.addToHistory(path, oldValue, newValue);
                
                // Emit the specific event for this property
                this.emit(`state:${path}`, {
                    path,
                    oldValue,
                    newValue,
                    fullState: this.state
                });
            }
        });
        
        // Finally, emit a general 'state changed' event for any all-purpose listeners
        this.emit('state:changed', {
            path: 'game',
            updates,
            fullState: this.state
        });
    }

    getGameState() {
        return { ...this.state.game };
    }

    resetGameState() {
        console.log('🔄 Resetting game state');
        const initialGameState = this.getInitialState().game;
        this.updateState('game', initialGameState);
    }

    setGamePhase(phase) {
        console.log(`🎮 Game phase changing to: ${phase}`);
        this.updateState('game.phase', phase);
    }

    setSpectrum(spectrum) {
        console.log('🌈 Setting spectrum:', spectrum?.name);
        this.updateState('game.spectrum', spectrum);
    }

    setClue(clue, clueGiverId) {
        console.log(`💡 Clue set by ${clueGiverId}: "${clue}"`);
        this.updateGameState({
            clue,
            clueGiverId
        });
    }

    setTargetPosition(position) {
        console.log(`🎯 Target position set to: ${position}`);
        this.updateState('game.targetPosition', position);
    }

    updateTimer(timeRemaining) {
        // Don't log timer updates in debug mode (too noisy)
        this.updateState('game.timeRemaining', timeRemaining);
    }

    setRoundResults(results) {
        console.log('📊 Round results:', results);
        this.updateGameState({
            roundScores: results.roundScores || {},
            totalScores: results.totalScores || {},
            bonusAwarded: results.bonusAwarded || false,
            roundSummary: results.roundSummary || []
        });
    }

    setFinalResults(results) {
        console.log('🏆 Final results:', results);
        this.updateGameState({
            finalScores: results.finalScores || {},
            winner: results.winner || null,
            gameStats: results.gameStats || null
        });
    }

    /**
     * Room state methods
     */
    updateRoomState(updates) {
        console.log('🏠 Updating room state:', updates);
        Object.entries(updates).forEach(([key, value]) => {
            this.updateState(`room.${key}`, value);
        });
    }

    getRoomState() {
        return { ...this.state.room };
    }

    setRoomInfo(roomInfo) {
        console.log('🏠 Setting room info:', roomInfo);
        this.updateRoomState({
            code: roomInfo.code,
            hostId: roomInfo.hostId,
            playerCount: roomInfo.playerCount,
            maxPlayers: roomInfo.maxPlayers,
            canStart: roomInfo.canStart,
            settings: roomInfo.settings || {}
        });
    }

    /**
     * Players state methods
     */
    updatePlayers(players) {
        console.log('👥 Updating players:', players);
        // Convert array to object if needed
        const playersObj = Array.isArray(players) 
            ? players.reduce((obj, player) => ({ ...obj, [player.id]: player }), {})
            : players;
            
        this.updateState('players', playersObj);
    }

    addPlayer(player) {
        console.log('➕ Adding player:', player);
        const currentPlayers = { ...this.state.players };
        currentPlayers[player.id] = player;
        this.updateState('players', currentPlayers);
    }

    updatePlayer(playerId, updates) {
        console.log(`📝 Updating player ${playerId}:`, updates);
        const currentPlayers = { ...this.state.players };
        if (currentPlayers[playerId]) {
            currentPlayers[playerId] = { ...currentPlayers[playerId], ...updates };
            this.updateState('players', currentPlayers);
        }
    }

    removePlayer(playerId) {
        console.log(`➖ Removing player ${playerId}`);
        const currentPlayers = { ...this.state.players };
        delete currentPlayers[playerId];
        this.updateState('players', currentPlayers);
    }

    getPlayers() {
        return { ...this.state.players };
    }

    getPlayer(playerId) {
        return this.state.players[playerId] ? { ...this.state.players[playerId] } : null;
    }

    getCurrentPlayer() {
        const playerId = this.state.connection.playerId;
        return playerId ? this.getPlayer(playerId) : null;
    }

    isCurrentPlayerClueGiver() {
        const playerId = this.state.connection.playerId;
        const clueGiverId = this.state.game.clueGiverId;
        const isClueGiver = playerId === clueGiverId;
        
        // Only log occasionally to avoid spam (every 300 frames = ~5 seconds at 60fps)
        if (this.debugMode && !this._clueGiverLogCount) {
            this._clueGiverLogCount = 0;
        }
        
        if (this.debugMode && this._clueGiverLogCount++ % 300 === 0) {
            console.log(`🤔 Is current player clue giver? ${isClueGiver} (Player: ${playerId}, Clue Giver: ${clueGiverId})`);
        }
        
        return isClueGiver;
    }

    /**
     * UI state methods
     */
    updateUIState(updates) {
        console.log('🖼️ Updating UI state:', updates);
        Object.entries(updates).forEach(([key, value]) => {
            this.updateState(`ui.${key}`, value);
        });
    }

    getUIState() {
        return { ...this.state.ui };
    }

    showModal(modalId, data = null) {
        console.log(`📋 Showing modal: ${modalId}`);
        this.updateState('ui.activeModal', { id: modalId, data });
    }

    hideModal() {
        console.log('📋 Hiding modal');
        this.updateState('ui.activeModal', null);
    }

    addNotification(notification) {
        const notifications = [...this.state.ui.notifications];
        const id = Date.now() + Math.random();
        
        notifications.push({
            id,
            timestamp: Date.now(),
            type: 'info',
            duration: 5000,
            ...notification
        });
        
        console.log(`🔔 Notification: [${notification.type}] ${notification.message}`);
        
        this.updateState('ui.notifications', notifications);
        
        // Auto-remove notification after duration
        if (notification.duration !== 0) {
            setTimeout(() => {
                this.removeNotification(id);
            }, notification.duration || 5000);
        }
    }

    removeNotification(notificationId) {
        const notifications = this.state.ui.notifications.filter(n => n.id !== notificationId);
        this.updateState('ui.notifications', notifications);
    }

    setLoading(loading) {
        console.log(`⏳ Loading: ${loading}`);
        this.updateState('ui.loading', loading);
    }

    setCurrentView(view) {
        console.log(`👀 Switching view to: ${view}`);
        this.updateState('ui.currentView', view);
    }

    enableSpectrumInteraction(enabled = true) {
        console.log(`🖱️ Spectrum interaction: ${enabled ? 'enabled' : 'disabled'}`);
        this.updateState('ui.spectrumInteractionEnabled', enabled);
    }

    showTargetPosition(show = true) {
        console.log(`👁️ Show target position: ${show}`);
        this.updateState('ui.showTargetPosition', show);
    }
    debugState(component = null) {
        const state = this.getFullState();
        
        console.group(`🔍 State Debug ${component ? `- ${component}` : ''}`);
        console.log('Timestamp:', new Date().toISOString());
        
        // Connection info
        console.group('📡 Connection');
        console.table(state.connection);
        console.groupEnd();
        
        // Game state
        console.group('🎮 Game State');
        console.table({
            phase: state.game.phase,
            round: `${state.game.currentRound}/${state.game.totalRounds}`,
            clueGiverId: state.game.clueGiverId,
            targetPosition: state.game.targetPosition,
            clue: state.game.clue,
            timeRemaining: state.game.timeRemaining
        });
        console.groupEnd();
        
        // Players
        console.group('👥 Players');
        console.table(state.players);
        console.groupEnd();
        
        // UI State
        console.group('🖼️ UI State');
        console.table({
            currentView: state.ui.currentView,
            loading: state.ui.loading,
            spectrumInteractionEnabled: state.ui.spectrumInteractionEnabled,
            showTargetPosition: state.ui.showTargetPosition,
            activeModal: state.ui.activeModal
        });
        console.groupEnd();
        
        console.groupEnd();
    }
    /**
     * Chat state methods
     */
    addChatMessage(message) {
        const messages = [...this.state.chat.messages];
        
        // Add timestamp and ID if not present
        const messageWithMeta = {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            type: 'message',
            ...message
        };
        
        messages.push(messageWithMeta);
        
        // Limit message history
        if (messages.length > this.state.chat.maxMessages) {
            messages.splice(0, messages.length - this.state.chat.maxMessages);
        }
        
        this.updateState('chat.messages', messages);
        
        // Update unread count if chat is not visible
        if (!this.state.ui.chatVisible) {
            this.updateState('chat.unreadCount', this.state.chat.unreadCount + 1);
        }
    }

    clearChatMessages() {
        console.log('🧹 Clearing chat messages');
        this.updateState('chat.messages', []);
        this.updateState('chat.unreadCount', 0);
    }

    markChatAsRead() {
        this.updateState('chat.unreadCount', 0);
    }

    getChatMessages() {
        return [...this.state.chat.messages];
    }

    /**
     * State history methods
     */
    addToHistory(path, oldValue, newValue) {
        // Don't add timer updates to history
        if (path.includes('timeRemaining')) return;
        
        this.stateHistory.push({
            timestamp: Date.now(),
            path,
            oldValue,
            newValue
        });
        
        // Limit history size
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }
    }

    getStateHistory() {
        return [...this.stateHistory];
    }

    /**
     * State persistence methods
     */
    setupStatePersistence() {
        // Save certain state to localStorage on changes
        this.on('state:changed', ({ path }) => {
            // Only persist certain state paths
            const persistablePaths = ['ui.chatVisible', 'ui.scoreboardVisible'];
            
            if (persistablePaths.some(p => path.startsWith(p))) {
                this.savePersistedState();
            }
        });
    }

    savePersistedState() {
        try {
            const persistableState = {
                ui: {
                    chatVisible: this.state.ui.chatVisible,
                    scoreboardVisible: this.state.ui.scoreboardVisible
                }
            };
            
            localStorage.setItem('spectrum-game-state', JSON.stringify(persistableState));
        } catch (error) {
            console.warn('Failed to save state to localStorage:', error);
        }
    }

    loadPersistedState() {
        try {
            const saved = localStorage.getItem('spectrum-game-state');
            if (saved) {
                const persistedState = JSON.parse(saved);
                
                // Merge persisted state with current state
                if (persistedState.ui) {
                    Object.entries(persistedState.ui).forEach(([key, value]) => {
                        this.updateState(`ui.${key}`, value, false);
                    });
                }
                
                console.log('💾 Loaded persisted state');
            }
        } catch (error) {
            console.warn('Failed to load state from localStorage:', error);
        }
    }

    /**
     * State validation setup
     */
    setupStateValidation() {
        // Validate state on changes in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.on('state:changed', () => {
                this.validateState();
            });
        }
    }

    /**
     * Utility methods
     */
    getFullState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    resetState() {
        console.log('🔄 Resetting entire state');
        this.state = this.getInitialState();
        this.stateHistory = [];
        this.emit('state:reset');
    }

    /**
     * Batch state updates
     * @param {Object} updates - Object with path: value pairs
     */
    batchUpdate(updates) {
        console.log('🔄 Batch update:', updates);
        Object.entries(updates).forEach(([path, value]) => {
            this.updateState(path, value, false);
        });
        
        // Emit single batch update event
        this.emit('state:batch-updated', {
            updates,
            fullState: this.state
        });
    }

    /**
     * Game-specific helper methods
     */
    handleRoomJoined(data) {
        console.log('🏠 Handling room joined:', data);
        this.setConnected(data.playerId, data.roomCode);
        this.updatePlayers(data.players);
        this.setRoomInfo(data.room || {});
        this.setCurrentView('game');
    }

    handleGameStateUpdate(gameState) {
        console.log('🎮 Handling game state update:', gameState);
        
        // Store previous phase for comparison
        const previousPhase = this.state.game.phase;
        
        // Update game state
        this.updateGameState(gameState);
        
        // Get current player role
        const isClueGiver = this.isCurrentPlayerClueGiver();
        
        // Update UI based on game state and player role
        switch (gameState.phase) {
            case 'giving-clue':
                // Clear interaction for everyone during clue giving
                this.enableSpectrumInteraction(false);
                
                if (isClueGiver) {
                    // Clue giver sees target
                    this.showTargetPosition(true);
                    console.log('🎯 Clue giver mode: Target visible, interaction disabled');
                } else {
                    // Guessers don't see target and target position should be null
                    this.showTargetPosition(false);
                    // Ensure target position is null for non-clue-givers
                    if (this.state.game.targetPosition !== null) {
                        console.log('🔧 Clearing target position for guesser');
                        this.updateState('game.targetPosition', null);
                    }
                    console.log('🎲 Guesser mode: Target hidden, interaction disabled (waiting for clue)');
                }
                break;
            case 'waiting':
                // Clear all round-specific UI state during waiting
                this.showTargetPosition(false);
                this.enableSpectrumInteraction(false);
                console.log('⏳ Waiting mode: Preparing for next round');
                break;
            case 'guessing':
                if (isClueGiver) {
                    // Clue giver continues to see target but can't interact
                    this.showTargetPosition(true);
                    this.enableSpectrumInteraction(false);
                    console.log('🎯 Clue giver in guessing phase: Target visible, interaction disabled');
                } else {
                    // Guessers can now interact but still don't see target
                    this.showTargetPosition(false);
                    this.enableSpectrumInteraction(true);
                    // Ensure target position is null for non-clue-givers
                    if (this.state.game.targetPosition !== null) {
                        console.log('🔧 Clearing target position for guesser');
                        this.updateState('game.targetPosition', null);
                    }
                    console.log('🎲 Guesser in guessing phase: Target hidden, interaction enabled');
                }
                break;
                
            case 'scoring':
                // Everyone sees target during scoring
                this.showTargetPosition(true);
                this.enableSpectrumInteraction(false);
                console.log('📊 Scoring mode: Target visible to all, interaction disabled');
                break;
                
            case 'lobby':
            case 'waiting':
                // Clear all round-specific UI state
                this.showTargetPosition(false);
                this.enableSpectrumInteraction(false);
                // Clear target position when returning to lobby
                if (previousPhase !== 'lobby' && previousPhase !== 'waiting') {
                    console.log('🧹 Clearing target position when returning to lobby/waiting');
                    this.updateState('game.targetPosition', null);
                }
                console.log('🏠 Lobby/Waiting mode: Target hidden, interaction disabled');
                break;
                
            default:
                // Default safe state
                this.showTargetPosition(false);
                this.enableSpectrumInteraction(false);
                break;
        }
    }

    handlePlayerUpdate(playerData) {
        if (Array.isArray(playerData)) {
            this.updatePlayers(playerData);
        } else {
            this.updatePlayer(playerData.id, playerData);
        }
    }

    handleRoundEnd(results) {
        console.log('🏁 Handling round end:', results);
        this.setRoundResults(results);
        this.setGamePhase('scoring');
        this.showTargetPosition(true); // Show target to everyone
        this.enableSpectrumInteraction(false);
    }

    handleGameEnd(results) {
        console.log('🎉 Handling game end:', results);
        this.setFinalResults(results);
        this.setGamePhase('finished');
        this.showTargetPosition(true);
        this.enableSpectrumInteraction(false);
    }

    /**
     * Debug methods
     */
    logState() {
        console.log('📊 Current State:', this.getFullState());
    }

    logStateHistory() {
        console.log('📜 State History:', this.getStateHistory());
    }

    /**
     * Validation methods
     */
    validateState() {
        // Basic state validation
        const requiredPaths = [
            'connection.status',
            'game.phase',
            'players',
            'ui.currentView',
            'chat.messages'
        ];
        
        const missing = requiredPaths.filter(path => {
            const value = this.getStateValue(path);
            return value === undefined || value === null;
        });
        
        if (missing.length > 0) {
            console.warn('⚠️ Missing required state paths:', missing);
            return false;
        }
        
        return true;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Clear all event listeners
        this.removeAllListeners();
        
        // Save final state
        this.savePersistedState();
        
        // Reset state
        this.resetState();
        
        console.log('🧹 StateManager destroyed');
    }
}

// Export singleton instance
export const stateManager = new StateManager();
export { StateManager };