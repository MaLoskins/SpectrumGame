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

    getInitialState() {
        return {
            connection: {
                status: 'disconnected',
                playerId: null,
                roomCode: null,
                error: null,
                lastConnected: null
            },
            game: {
                phase: 'lobby',
                currentRound: 0,
                totalRounds: 0,
                timeRemaining: 0,
                spectrumX: null,      // Updated for 2D - X-axis spectrum
                spectrumY: null,      // Updated for 2D - Y-axis spectrum
                clue: null,
                targetCoordinate: null, // Updated for 2D - {x, y} instead of single position
                clueGiverId: null,
                guesses: {},          // Will store {playerId: {x, y}} format
                roundScores: {},
                totalScores: {},
                finalScores: {},
                winner: null,
                gameStats: null,
                bonusAwarded: false,
                roundSummary: []
            },
            players: {},
            room: {
                code: null,
                hostId: null,
                playerCount: 0,
                maxPlayers: 4,
                canStart: false,
                settings: {}
            },
            ui: {
                activeModal: null,
                chatVisible: true,
                scoreboardVisible: true,
                notifications: [],
                loading: false,
                currentView: 'lobby',
                spectrumInteractionEnabled: false,
                showTargetCoordinate: false  // Updated for 2D
            },
            chat: {
                messages: [],
                unreadCount: 0,
                maxMessages: 100
            }
        };
    }

    async init() {
        console.log('📊 Initializing StateManager...');
        this.loadPersistedState();
        this.setupStatePersistence();
        this.setupStateValidation();
        console.log('✅ StateManager initialized');
        if (this.debugMode) console.log('🔍 Initial state:', this.state);
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) this.eventListeners.set(event, new Set());
        this.eventListeners.get(event).add(callback);
        if (this.debugMode) console.log(`🔔 Listener added for event: ${event}`);
    }

    off(event, callback) {
        this.eventListeners.get(event)?.delete(callback);
    }

    emit(event, data = null) {
        if (this.debugMode && !event.startsWith('timer:')) console.log(`📢 Emitting event: ${event}`, data);
        this.eventListeners.get(event)?.forEach(callback => {
            try { callback(data); } 
            catch (error) { console.error(`❌ Error in event listener for ${event}:`, error); }
        });
    }

    removeAllListeners() { this.eventListeners.clear(); }

    updateState(path, newValue, emitEvent = true) {
        const oldValue = this.getStateValue(path);
        if (typeof newValue !== 'object' && oldValue === newValue) return;
        
        if (this.debugMode && !path.includes('timeRemaining')) 
            console.log(`🔄 State update: ${path}`, { oldValue, newValue });
        
        this.setStateValue(path, newValue);
        this.addToHistory(path, oldValue, newValue);
        
        if (emitEvent) {
            const eventData = { path, oldValue, newValue, fullState: this.state };
            this.emit(`state:${path}`, eventData);
            this.emit('state:changed', eventData);
        }
    }

    getStateValue(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    setStateValue(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => obj[key] ??= {}, this.state);
        target[lastKey] = value;
    }

    updateConnectionState(updates) {
        console.log('🔌 Updating connection state:', updates);
        Object.entries(updates).forEach(([key, value]) => this.updateState(`connection.${key}`, value));
    }

    getConnectionState = () => ({ ...this.state.connection });

    setConnected(playerId, roomCode) {
        console.log(`✅ Connected as player ${playerId} to room ${roomCode}`);
        this.updateConnectionState({ status: 'connected', playerId, roomCode, error: null, lastConnected: Date.now() });
    }

    setDisconnected(error = null) {
        console.log('❌ Disconnected:', error);
        this.updateConnectionState({ status: 'disconnected', error });
    }

    setConnecting = () => { console.log('🔄 Connecting...'); this.updateState('connection.status', 'connecting'); };
    setReconnecting = () => { console.log('🔄 Reconnecting...'); this.updateState('connection.status', 'reconnecting'); };

    updateGameState(updates) {
        console.log('🎮 Updating game state:', updates);
        const oldValues = {};
        const changedKeys = Object.keys(updates);
        
        changedKeys.forEach(key => {
            if (key in this.state.game) {
                oldValues[key] = this.state.game[key];
                this.state.game[key] = updates[key];
            }
        });
        
        changedKeys.forEach(key => {
            const path = `game.${key}`;
            if (oldValues[key] !== updates[key]) {
                this.addToHistory(path, oldValues[key], updates[key]);
                this.emit(`state:${path}`, { path, oldValue: oldValues[key], newValue: updates[key], fullState: this.state });
            }
        });
        
        this.emit('state:changed', { path: 'game', updates, fullState: this.state });
    }

    getGameState = () => ({ ...this.state.game });
    resetGameState = () => { console.log('🔄 Resetting game state'); this.updateState('game', this.getInitialState().game); };
    setGamePhase = phase => { console.log(`🎮 Game phase changing to: ${phase}`); this.updateState('game.phase', phase); };
    
    // Updated for 2D
    setSpectrums(spectrumX, spectrumY) {
        console.log('🌈 Setting spectrums:', spectrumX?.name, 'x', spectrumY?.name);
        this.updateState('game.spectrumX', spectrumX);
        this.updateState('game.spectrumY', spectrumY);
    }
    
    // Updated for 2D
    setTargetCoordinate(coordinate) {
        console.log(`🎯 Target coordinate set to: (${coordinate?.x}, ${coordinate?.y})`);
        this.updateState('game.targetCoordinate', coordinate);
    }
    
    updateTimer = timeRemaining => this.updateState('game.timeRemaining', timeRemaining);

    setClue(clue, clueGiverId) {
        console.log(`💡 Clue set by ${clueGiverId}: "${clue}"`);
        this.updateGameState({ clue, clueGiverId });
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

    updateRoomState(updates) {
        console.log('🏠 Updating room state:', updates);
        Object.entries(updates).forEach(([key, value]) => this.updateState(`room.${key}`, value));
    }

    getRoomState = () => ({ ...this.state.room });

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

    updatePlayers(players) {
        console.log('👥 Updating players:', players);
        const playersObj = Array.isArray(players) 
            ? players.reduce((obj, player) => ({ ...obj, [player.id]: player }), {})
            : players;
        this.updateState('players', playersObj);
    }

    addPlayer(player) {
        console.log('➕ Adding player:', player);
        this.updateState('players', { ...this.state.players, [player.id]: player });
    }

    updatePlayer(playerId, updates) {
        console.log(`📝 Updating player ${playerId}:`, updates);
        const player = this.state.players[playerId];
        if (player) this.updateState('players', { ...this.state.players, [playerId]: { ...player, ...updates } });
    }

    removePlayer(playerId) {
        console.log(`➖ Removing player ${playerId}`);
        const { [playerId]: removed, ...remaining } = this.state.players;
        this.updateState('players', remaining);
    }

    getPlayers = () => ({ ...this.state.players });
    getPlayer = playerId => this.state.players[playerId] ? { ...this.state.players[playerId] } : null;
    getCurrentPlayer = () => this.getPlayer(this.state.connection.playerId);

    isCurrentPlayerClueGiver() {
        const { playerId } = this.state.connection;
        const { clueGiverId } = this.state.game;
        const isClueGiver = playerId === clueGiverId;
        
        if (this.debugMode && !this._clueGiverLogCount) this._clueGiverLogCount = 0;
        if (this.debugMode && this._clueGiverLogCount++ % 300 === 0) 
            console.log(`🤔 Is current player clue giver? ${isClueGiver} (Player: ${playerId}, Clue Giver: ${clueGiverId})`);
        
        return isClueGiver;
    }

    updateUIState(updates) {
        console.log('🖼️ Updating UI state:', updates);
        Object.entries(updates).forEach(([key, value]) => this.updateState(`ui.${key}`, value));
    }

    getUIState = () => ({ ...this.state.ui });
    showModal = (modalId, data = null) => { console.log(`📋 Showing modal: ${modalId}`); this.updateState('ui.activeModal', { id: modalId, data }); };
    hideModal = () => { console.log('📋 Hiding modal'); this.updateState('ui.activeModal', null); };
    setLoading = loading => { console.log(`⏳ Loading: ${loading}`); this.updateState('ui.loading', loading); };
    setCurrentView = view => { console.log(`👀 Switching view to: ${view}`); this.updateState('ui.currentView', view); };
    enableSpectrumInteraction = enabled => { console.log(`🖱️ Spectrum interaction: ${enabled ? 'enabled' : 'disabled'}`); this.updateState('ui.spectrumInteractionEnabled', enabled); };
    
    // Updated for 2D
    showTargetCoordinate = show => { 
        console.log(`👁️ Show target coordinate: ${show}`); 
        this.updateState('ui.showTargetCoordinate', show); 
    };

    addNotification(notification) {
        const id = Date.now() + Math.random();
        const notifications = [...this.state.ui.notifications, { id, timestamp: Date.now(), type: 'info', duration: 5000, ...notification }];
        
        console.log(`🔔 Notification: [${notification.type}] ${notification.message}`);
        this.updateState('ui.notifications', notifications);
        
        if (notification.duration !== 0) {
            setTimeout(() => this.removeNotification(id), notification.duration || 5000);
        }
    }

    removeNotification(notificationId) {
        this.updateState('ui.notifications', this.state.ui.notifications.filter(n => n.id !== notificationId));
    }

    addChatMessage(message) {
        const messageWithMeta = { id: Date.now() + Math.random(), timestamp: Date.now(), type: 'message', ...message };
        const messages = [...this.state.chat.messages, messageWithMeta].slice(-this.state.chat.maxMessages);
        
        this.updateState('chat.messages', messages);
        if (!this.state.ui.chatVisible) this.updateState('chat.unreadCount', this.state.chat.unreadCount + 1);
    }

    clearChatMessages = () => { console.log('🧹 Clearing chat messages'); this.updateState('chat.messages', []); this.updateState('chat.unreadCount', 0); };
    markChatAsRead = () => this.updateState('chat.unreadCount', 0);
    getChatMessages = () => [...this.state.chat.messages];

    addToHistory(path, oldValue, newValue) {
        if (path.includes('timeRemaining')) return;
        this.stateHistory.push({ timestamp: Date.now(), path, oldValue, newValue });
        if (this.stateHistory.length > this.maxHistorySize) this.stateHistory.shift();
    }

    getStateHistory = () => [...this.stateHistory];

    setupStatePersistence() {
        this.on('state:changed', ({ path }) => {
            if (['ui.chatVisible', 'ui.scoreboardVisible'].some(p => path.startsWith(p))) this.savePersistedState();
        });
    }

    savePersistedState() {
        try {
            localStorage.setItem('spectrum-game-state', JSON.stringify({
                ui: { chatVisible: this.state.ui.chatVisible, scoreboardVisible: this.state.ui.scoreboardVisible }
            }));
        } catch (error) { console.warn('Failed to save state to localStorage:', error); }
    }

    loadPersistedState() {
        try {
            const saved = localStorage.getItem('spectrum-game-state');
            if (saved) {
                const { ui } = JSON.parse(saved);
                if (ui) Object.entries(ui).forEach(([key, value]) => this.updateState(`ui.${key}`, value, false));
                console.log('💾 Loaded persisted state');
            }
        } catch (error) { console.warn('Failed to load state from localStorage:', error); }
    }

    setupStateValidation() {
        if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            this.on('state:changed', () => this.validateState());
        }
    }

    validateState() {
        const requiredPaths = ['connection.status', 'game.phase', 'players', 'ui.currentView', 'chat.messages'];
        const missing = requiredPaths.filter(path => this.getStateValue(path) == null);
        if (missing.length) console.warn('⚠️ Missing required state paths:', missing);
        return !missing.length;
    }

    handleGameStateUpdate(gameState) {
        console.log('🎮 Handling game state update:', gameState);
        const previousPhase = this.state.game.phase;
        this.updateGameState(gameState);
        
        const isClueGiver = this.isCurrentPlayerClueGiver();
        
        const phaseHandlers = {
            'giving-clue': () => {
                this.enableSpectrumInteraction(false);
                if (isClueGiver) {
                    this.showTargetCoordinate(true);
                    console.log('🎯 Clue giver mode: Target visible, interaction disabled');
                } else {
                    this.showTargetCoordinate(false);
                    if (this.state.game.targetCoordinate !== null) {
                        console.log('🔧 Clearing target coordinate for guesser');
                        this.updateState('game.targetCoordinate', null);
                    }
                    console.log('🎲 Guesser mode: Target hidden, interaction disabled (waiting for clue)');
                }
            },
            waiting: () => {
                this.showTargetCoordinate(false);
                this.enableSpectrumInteraction(false);
                console.log('⏳ Waiting mode: Preparing for next round');
            },
            guessing: () => {
                if (isClueGiver) {
                    this.showTargetCoordinate(true);
                    this.enableSpectrumInteraction(false);
                    console.log('🎯 Clue giver in guessing phase: Target visible, interaction disabled');
                } else {
                    this.showTargetCoordinate(false);
                    this.enableSpectrumInteraction(true);
                    if (this.state.game.targetCoordinate !== null) {
                        console.log('🔧 Clearing target coordinate for guesser');
                        this.updateState('game.targetCoordinate', null);
                    }
                    console.log('🎲 Guesser in guessing phase: Target hidden, interaction enabled');
                }
            },
            scoring: () => {
                this.showTargetCoordinate(true);
                this.enableSpectrumInteraction(false);
                console.log('📊 Scoring mode: Target visible to all, interaction disabled');
            },
            lobby: () => {
                this.showTargetCoordinate(false);
                this.enableSpectrumInteraction(false);
                if (!['lobby', 'waiting'].includes(previousPhase)) {
                    console.log('🧹 Clearing target coordinate when returning to lobby/waiting');
                    this.updateState('game.targetCoordinate', null);
                }
                console.log('🏠 Lobby/Waiting mode: Target hidden, interaction disabled');
            }
        };
        
        (phaseHandlers[gameState.phase] || phaseHandlers.lobby)();
    }

    handleRoomJoined(data) {
        console.log('🏠 Handling room joined:', data);
        this.setConnected(data.playerId, data.roomCode);
        this.updatePlayers(data.players);
        this.setRoomInfo(data.room || {});
        this.setCurrentView('game');
    }

    handlePlayerUpdate(playerData) {
        Array.isArray(playerData) ? this.updatePlayers(playerData) : this.updatePlayer(playerData.id, playerData);
    }

    handleRoundEnd(results) {
        console.log('🏁 Handling round end:', results);
        this.setRoundResults(results);
        this.setGamePhase('scoring');
        this.showTargetCoordinate(true);
        this.enableSpectrumInteraction(false);
    }

    handleGameEnd(results) {
        console.log('🎉 Handling game end:', results);
        this.setFinalResults(results);
        this.setGamePhase('finished');
        this.showTargetCoordinate(true);
        this.enableSpectrumInteraction(false);
    }

    debugState(component = null) {
        const state = this.getFullState();
        console.group(`🔍 State Debug ${component ? `- ${component}` : ''}`);
        console.log('Timestamp:', new Date().toISOString());
        
        ['📡 Connection', '🎮 Game State', '👥 Players', '🖼️ UI State'].forEach((title, i) => {
            console.group(title);
            console.table([state.connection, 
                { phase: state.game.phase, round: `${state.game.currentRound}/${state.game.totalRounds}`, 
                  clueGiverId: state.game.clueGiverId, targetCoordinate: state.game.targetCoordinate, 
                  clue: state.game.clue, timeRemaining: state.game.timeRemaining },
                state.players,
                { currentView: state.ui.currentView, loading: state.ui.loading, 
                  spectrumInteractionEnabled: state.ui.spectrumInteractionEnabled, 
                  showTargetCoordinate: state.ui.showTargetCoordinate, activeModal: state.ui.activeModal }
            ][i]);
            console.groupEnd();
        });
        
        console.groupEnd();
    }

    getFullState = () => JSON.parse(JSON.stringify(this.state));
    resetState = () => { console.log('🔄 Resetting entire state'); this.state = this.getInitialState(); this.stateHistory = []; this.emit('state:reset'); };
    
    batchUpdate(updates) {
        console.log('🔄 Batch update:', updates);
        Object.entries(updates).forEach(([path, value]) => this.updateState(path, value, false));
        this.emit('state:batch-updated', { updates, fullState: this.state });
    }

    logState = () => console.log('📊 Current State:', this.getFullState());
    logStateHistory = () => console.log('📜 State History:', this.getStateHistory());

    destroy() {
        this.removeAllListeners();
        this.savePersistedState();
        this.resetState();
        console.log('🧹 StateManager destroyed');
    }
}

export const stateManager = new StateManager();
export { StateManager };