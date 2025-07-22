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

    async init() {
        console.log('📊 Initializing StateManager...');
        this.loadPersistedState();
        this.setupPersistence();
        this.debugMode && this.on('state:changed', () => this.validateState());
        console.log('✅ StateManager initialized');
        this.debugMode && console.log('🔍 Initial state:', this.state);
    }

    // Event system
    on(event, callback) {
        (this.eventListeners.get(event) || this.eventListeners.set(event, new Set()).get(event)).add(callback);
        this.debugMode && console.log(`🔔 Listener added for event: ${event}`);
    }

    off(event, callback) { this.eventListeners.get(event)?.delete(callback); }
    
    emit(event, data = null) {
        if (this.debugMode && !event.startsWith('timer:')) console.log(`📢 Emitting event: ${event}`, data);
        this.eventListeners.get(event)?.forEach(cb => { try { cb(data); } catch (e) { console.error(`❌ Error in ${event}:`, e); } });
    }

    removeAllListeners() { this.eventListeners.clear(); }

    // State updates
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

    getStateValue(path) { return path.split('.').reduce((obj, key) => obj?.[key], this.state); }
    
    setStateValue(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        keys.reduce((obj, key) => obj[key] ??= {}, this.state)[lastKey] = value;
    }

    // Batch updates
    batchUpdate(updates) {
        console.log('🔄 Batch update:', updates);
        Object.entries(updates).forEach(([path, value]) => this.updateState(path, value, false));
        this.emit('state:batch-updated', { updates, fullState: this.state });
    }

    // Connection state
    updateConnectionState(updates) {
        console.log('🔌 Updating connection state:', updates);
        Object.entries(updates).forEach(([key, value]) => this.updateState(`connection.${key}`, value));
    }

    getConnectionState = () => ({ ...this.state.connection });
    setConnected = (playerId, roomCode) => this.updateConnectionState({ status: 'connected', playerId, roomCode, error: null, lastConnected: Date.now() });
    setDisconnected = error => this.updateConnectionState({ status: 'disconnected', error });
    setConnecting = () => this.updateState('connection.status', 'connecting');
    setReconnecting = () => this.updateState('connection.status', 'reconnecting');

    // Game state
    updateGameState(updates) {
        console.log('🎮 Updating game state:', updates);
        const oldValues = {};
        Object.keys(updates).forEach(key => {
            if (key in this.state.game) {
                oldValues[key] = this.state.game[key];
                this.state.game[key] = updates[key];
            }
        });
        
        Object.keys(updates).forEach(key => {
            const path = `game.${key}`;
            if (oldValues[key] !== updates[key]) {
                this.addToHistory(path, oldValues[key], updates[key]);
                this.emit(`state:${path}`, { path, oldValue: oldValues[key], newValue: updates[key], fullState: this.state });
            }
        });
        
        this.emit('state:changed', { path: 'game', updates, fullState: this.state });
    }

    getGameState = () => ({ ...this.state.game });
    resetGameState = () => this.updateState('game', this.getInitialState().game);
    setGamePhase = phase => this.updateState('game.phase', phase);
    setSpectrums = (spectrumX, spectrumY) => this.batchUpdate({ 'game.spectrumX': spectrumX, 'game.spectrumY': spectrumY });
    setTargetCoordinate = coordinate => this.updateState('game.targetCoordinate', coordinate);
    updateTimer = timeRemaining => this.updateState('game.timeRemaining', timeRemaining);
    setClue = (clue, clueGiverId) => this.updateGameState({ clue, clueGiverId });
    setRoundResults = results => this.updateGameState({ roundScores: results.roundScores || {}, totalScores: results.totalScores || {}, bonusAwarded: results.bonusAwarded || false, roundSummary: results.roundSummary || [] });
    setFinalResults = results => this.updateGameState({ finalScores: results.finalScores || {}, winner: results.winner || null, gameStats: results.gameStats || null });

    // Room state
    updateRoomState(updates) {
        console.log('🏠 Updating room state:', updates);
        Object.entries(updates).forEach(([key, value]) => this.updateState(`room.${key}`, value));
    }

    getRoomState = () => ({ ...this.state.room });
    setRoomInfo = roomInfo => this.updateRoomState({ code: roomInfo.code, hostId: roomInfo.hostId, playerCount: roomInfo.playerCount, maxPlayers: roomInfo.maxPlayers, canStart: roomInfo.canStart, settings: roomInfo.settings || {} });

    // Player management
    updatePlayers(players) {
        const playersObj = Array.isArray(players) ? Object.fromEntries(players.map(p => [p.id, p])) : players;
        this.updateState('players', playersObj);
    }

    addPlayer = player => this.updateState('players', { ...this.state.players, [player.id]: player });
    updatePlayer = (playerId, updates) => this.state.players[playerId] && this.updateState('players', { ...this.state.players, [playerId]: { ...this.state.players[playerId], ...updates } });
    removePlayer = playerId => { const { [playerId]: _, ...remaining } = this.state.players; this.updateState('players', remaining); };
    getPlayers = () => ({ ...this.state.players });
    getPlayer = playerId => this.state.players[playerId] ? { ...this.state.players[playerId] } : null;
    getCurrentPlayer = () => this.getPlayer(this.state.connection.playerId);
    isCurrentPlayerClueGiver = () => this.state.connection.playerId === this.state.game.clueGiverId;

    // UI state
    updateUIState(updates) {
        console.log('🖼️ Updating UI state:', updates);
        Object.entries(updates).forEach(([key, value]) => this.updateState(`ui.${key}`, value));
    }

    getUIState = () => ({ ...this.state.ui });
    showModal = (modalId, data = null) => this.updateState('ui.activeModal', { id: modalId, data });
    hideModal = () => this.updateState('ui.activeModal', null);
    setLoading = loading => this.updateState('ui.loading', loading);
    setCurrentView = view => this.updateState('ui.currentView', view);
    enableSpectrumInteraction = enabled => this.updateState('ui.spectrumInteractionEnabled', enabled);
    showTargetCoordinate = show => this.updateState('ui.showTargetCoordinate', show);

    addNotification(notification) {
        const n = { id: Date.now() + Math.random(), timestamp: Date.now(), type: 'info', duration: 5000, ...notification };
        this.updateState('ui.notifications', [...this.state.ui.notifications, n]);
        n.duration !== 0 && setTimeout(() => this.removeNotification(n.id), n.duration);
    }

    removeNotification = notificationId => this.updateState('ui.notifications', this.state.ui.notifications.filter(n => n.id !== notificationId));

    // Chat
    addChatMessage(message) {
        const msg = { id: Date.now() + Math.random(), timestamp: Date.now(), type: 'message', ...message };
        const messages = [...this.state.chat.messages, msg].slice(-this.state.chat.maxMessages);
        this.updateState('chat.messages', messages);
        !this.state.ui.chatVisible && this.updateState('chat.unreadCount', this.state.chat.unreadCount + 1);
    }

    clearChatMessages = () => this.batchUpdate({ 'chat.messages': [], 'chat.unreadCount': 0 });
    markChatAsRead = () => this.updateState('chat.unreadCount', 0);
    getChatMessages = () => [...this.state.chat.messages];

    // History
    addToHistory(path, oldValue, newValue) {
        if (path.includes('timeRemaining')) return;
        this.stateHistory = [...this.stateHistory.slice(-(this.maxHistorySize - 1)), { timestamp: Date.now(), path, oldValue, newValue }];
    }

    getStateHistory = () => [...this.stateHistory];

    // Persistence
    setupPersistence() {
        this.on('state:changed', ({ path }) => 
            ['ui.chatVisible', 'ui.scoreboardVisible'].some(p => path.startsWith(p)) && this.savePersistedState());
    }

    savePersistedState() {
        try {
            localStorage.setItem('spectrum-game-state', JSON.stringify({ ui: { chatVisible: this.state.ui.chatVisible, scoreboardVisible: this.state.ui.scoreboardVisible } }));
        } catch (e) { console.warn('Failed to save state:', e); }
    }

    loadPersistedState() {
        try {
            const saved = JSON.parse(localStorage.getItem('spectrum-game-state') || '{}');
            saved.ui && Object.entries(saved.ui).forEach(([key, value]) => this.updateState(`ui.${key}`, value, false));
        } catch (e) { console.warn('Failed to load state:', e); }
    }

    // Validation
    validateState() {
        const required = ['connection.status', 'game.phase', 'players', 'ui.currentView', 'chat.messages'];
        const missing = required.filter(path => this.getStateValue(path) == null);
        missing.length && console.warn('⚠️ Missing state paths:', missing);
        return !missing.length;
    }

    // Complex state handlers
    handleGameStateUpdate(gameState) {
        console.log('🎮 Handling game state update:', gameState);
        const previousPhase = this.state.game.phase;
        this.updateGameState(gameState);
        
        const isClueGiver = this.isCurrentPlayerClueGiver();
        const phaseHandlers = {
            'giving-clue': () => {
                this.enableSpectrumInteraction(false);
                this.showTargetCoordinate(isClueGiver);
                !isClueGiver && this.updateState('game.targetCoordinate', null);
            },
            guessing: () => {
                this.showTargetCoordinate(isClueGiver);
                this.enableSpectrumInteraction(!isClueGiver);
                !isClueGiver && this.updateState('game.targetCoordinate', null);
            },
            scoring: () => { this.showTargetCoordinate(true); this.enableSpectrumInteraction(false); },
            lobby: () => {
                this.showTargetCoordinate(false);
                this.enableSpectrumInteraction(false);
                !['lobby', 'waiting'].includes(previousPhase) && this.updateState('game.targetCoordinate', null);
            }
        };
        
        (phaseHandlers[gameState.phase] || phaseHandlers.lobby)();
    }

    handleRoomJoined(data) {
        this.setConnected(data.playerId, data.roomCode);
        this.updatePlayers(data.players);
        this.setRoomInfo(data.room || {});
        this.setCurrentView('game');
    }

    handlePlayerUpdate = playerData => Array.isArray(playerData) ? this.updatePlayers(playerData) : this.updatePlayer(playerData.id, playerData);

    handleRoundEnd(results) {
        this.setRoundResults(results);
        this.setGamePhase('scoring');
        this.showTargetCoordinate(true);
        this.enableSpectrumInteraction(false);
    }

    handleGameEnd(results) {
        this.setFinalResults(results);
        this.setGamePhase('finished');
        this.showTargetCoordinate(true);
        this.enableSpectrumInteraction(false);
    }

    // Debug
    debugState(component = null) {
        const state = this.getFullState();
        console.group(`🔍 State Debug ${component ? `- ${component}` : ''}`);
        console.log('Timestamp:', new Date().toISOString());
        console.table([state.connection, 
            { phase: state.game.phase, round: `${state.game.currentRound}/${state.game.totalRounds}`, clueGiverId: state.game.clueGiverId, targetCoordinate: state.game.targetCoordinate },
            state.players,
            { currentView: state.ui.currentView, loading: state.ui.loading, spectrumInteractionEnabled: state.ui.spectrumInteractionEnabled }
        ]);
        console.groupEnd();
    }

    getFullState = () => JSON.parse(JSON.stringify(this.state));
    resetState = () => { this.state = this.getInitialState(); this.stateHistory = []; this.emit('state:reset'); };
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