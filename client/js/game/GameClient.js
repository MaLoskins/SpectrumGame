/**
 * ===================================
 * SPECTRUM GAME - GAME CLIENT
 * ===================================
 * 
 * Main game client that:
 * - Coordinates game flow and user interactions
 * - Manages game state transitions
 * - Handles user input validation
 * - Triggers UI updates through StateManager
 * 
 * UPDATED: Support for 2D coordinate system
 * ================================= */

export class GameClient {
    constructor(stateManager, socketClient) {
        Object.assign(this, {
            stateManager,
            socketClient,
            isInitialized: false,
            currentRoomId: null,
            playerId: null,
            debugMode: false,
            isSubmitting: false
        });
    }

    async init() {
        console.log('🎮 Initializing GameClient...');
        this.setupSocketEventHandlers();
        this.setupStateEventHandlers();
        this.isInitialized = true;
        console.log('✅ GameClient initialized');
    }

    setupSocketEventHandlers() {
        console.log('🔌 Setting up socket event handlers');
        const handlers = {
            'room:created': 'RoomCreated',
            'room:joined': 'RoomJoined',
            'room:player-joined': 'PlayerJoined',
            'room:player-left': 'PlayerLeft',
            'room:host-changed': 'HostChanged',
            'game:state-update': 'GameStateUpdate',
            'game:round-start': 'RoundStart',
            'game:clue-submitted': 'ClueSubmitted',
            'game:guess-submitted': 'GuessSubmitted',
            'game:round-end': 'RoundEnd',
            'game:finished': 'GameFinished',
            'game:phase-change': 'PhaseChange',
            'timer:update': 'TimerUpdate',
            'chat:message': 'ChatMessage',
            'error': 'SocketError'
        };
        
        Object.entries(handlers).forEach(([event, handler]) => 
            this.socketClient.on(event, this[`handle${handler}`].bind(this)));
    }

    setupStateEventHandlers() {
        console.log('📊 Setting up state event handlers');
        const actions = {
            'create-room': 'createRoom',
            'join-room': 'joinRoom',
            'start-game': 'startGame',
            'submit-clue': 'submitClue',
            'send-chat': 'sendChatMessage',
            'leave-room': 'leaveRoom'
        };
        
        Object.entries(actions).forEach(([event, method]) => 
            this.stateManager.on(`ui:${event}`, this[method].bind(this)));
            this.stateManager.on('spectrum:guess-placed', this.submitGuess.bind(this));
    }

    async createRoom(data) {
        try {
            if (this.debugMode) console.log('🏠 Creating room...', data);
            if (!this.validatePlayerName(data.playerName)) throw new Error('Invalid player name');
            
            this.stateManager.setLoading(true);
            this.socketClient.emit('room:create', {
                playerName: data.playerName.trim(),
                settings: data.settings || { maxPlayers: 6, roundDuration: 60, totalRounds: 10 }
            });
        } catch (error) {
            console.error('❌ Failed to create room:', error);
            this.handleError(error);
        }
    }

    async joinRoom(data) {
        try {
            if (this.debugMode) console.log('🚪 Joining room...', data);
            if (!this.validateRoomCode(data.roomCode)) throw new Error('Invalid room code');
            if (!this.validatePlayerName(data.playerName)) throw new Error('Invalid player name');
            
            this.stateManager.setLoading(true);
            this.socketClient.emit('room:join', {
                roomCode: data.roomCode.trim().toUpperCase(),
                playerName: data.playerName.trim()
            });
        } catch (error) {
            console.error('❌ Failed to join room:', error);
            this.handleError(error);
        }
    }

    async startGame() {
        try {
            if (this.debugMode) console.log('🎯 Starting game...');
            if (!this.currentRoomId) throw new Error('Not in a room');
            this.socketClient.emit('game:start', { roomId: this.currentRoomId });
        } catch (error) {
            console.error('❌ Failed to start game:', error);
            this.handleError(error);
        }
    }

    async submitClue(data) {
        try {
            if (this.debugMode) console.log('💡 Submitting clue...', data);
            if (!this.validateClue(data.clue)) throw new Error('Invalid clue');
            if (!this.currentRoomId) throw new Error('Not in a room');
            
            this.socketClient.emit('game:submit-clue', {
                roomId: this.currentRoomId,
                clue: data.clue.trim()
            });
        } catch (error) {
            console.error('❌ Failed to submit clue:', error);
            this.handleError(error);
        }
    }

    async submitGuess(data) {
        try {
            if (this.isSubmitting) {
                if (this.debugMode) console.log('⚠️ Guess submission already in progress');
                return;
            }
            
            this.isSubmitting = true;
            if (this.debugMode) console.log('🎯 Submitting guess...', data);
            if (!this.validateGuess(data.coordinate)) {
                this.isSubmitting = false;
                throw new Error('Invalid guess coordinate');
            }
            if (!this.currentRoomId) {
                this.isSubmitting = false;
                throw new Error('Not in a room');
            }
            
            this.socketClient.emit('game:submit-guess', {
                roomId: this.currentRoomId,
                coordinate: {
                    x: Number(data.coordinate.x),
                    y: Number(data.coordinate.y)
                }
            });
        } catch (error) {
            this.isSubmitting = false;
            console.error('❌ Failed to submit guess:', error);
            this.handleError(error);
        }
    }

    async sendChatMessage(data) {
        try {
            if (this.debugMode) console.log('💬 Sending chat message...', data);
            if (!data.message?.trim() || !this.currentRoomId) return;
            
            this.socketClient.emit('chat:send', {
                roomId: this.currentRoomId,
                message: data.message.trim()
            });
        } catch (error) {
            console.error('❌ Failed to send chat message:', error);
            this.handleError(error);
        }
    }

    async leaveRoom() {
        try {
            if (this.debugMode) console.log('🚪 Leaving room...');
            if (!this.currentRoomId) return;
            
            this.socketClient.emit('player:disconnect', {
                roomId: this.currentRoomId,
                playerId: this.playerId
            });
            
            this.currentRoomId = null;
            this.playerId = null;
            this.stateManager.resetGameState();
            this.stateManager.setCurrentView('lobby');
        } catch (error) {
            console.error('❌ Failed to leave room:', error);
            this.handleError(error);
        }
    }

    handleRoomCreated(data) {
        if (this.debugMode) console.log('🏠 Room created:', data);
        
        this.currentRoomId = data.roomId;
        this.playerId = data.playerId;
        
        this.stateManager.setLoading(false);
        this.stateManager.setConnected(data.playerId, data.roomCode);
        this.stateManager.updatePlayers(data.players);
        this.stateManager.setRoomInfo(data.room || {
            code: data.roomCode,
            hostId: data.playerId,
            playerCount: data.players.length,
            maxPlayers: 4,
            canStart: data.players.length >= 2,
            settings: {}
        });
        this.stateManager.setCurrentView('game');
        this.stateManager.setGamePhase('lobby');
        
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'success',
                message: `Room ${data.roomCode} created successfully!`,
                duration: 3000
            });
        }
    }

    handleRoomJoined(data) {
        if (this.debugMode) console.log('🚪 Room joined:', data);
        
        this.currentRoomId = data.roomId;
        this.playerId = data.playerId;
        
        this.stateManager.setLoading(false);
        this.stateManager.setConnected(data.playerId, data.roomCode);
        this.stateManager.updatePlayers(data.players);
        this.stateManager.setRoomInfo(data.room);
        this.stateManager.updateGameState(data.gameState);
        this.stateManager.setCurrentView('game');
        
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'success',
                message: `Joined room ${data.roomCode} successfully!`,
                duration: 3000
            });
        }
    }

    handlePlayerJoined(data) {
        if (this.debugMode) console.log('👋 Player joined:', data.player);
        this.stateManager.addPlayer(data.player);
        
        const players = this.stateManager.getPlayers();
        this.stateManager.updateRoomState({
            playerCount: Object.keys(players).length,
            canStart: Object.keys(players).length >= 2
        });
        
        if (this.stateManager.getGameState().phase === 'lobby') {
            this.stateManager.emit('state:game.phase', { newValue: 'lobby', oldValue: 'lobby' });
        }
        
        if (data.player.id !== this.playerId && this.debugMode) {
            this.stateManager.addNotification({
                type: 'info',
                message: `${data.player.name} joined the room`,
                duration: 2000
            });
        }
    }

    handlePlayerLeft(data) {
        if (this.debugMode) console.log('👋 Player left:', data);
        this.stateManager.removePlayer(data.playerId);
        
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'info',
                message: `${data.playerName} ${data.isDisconnected ? 'disconnected' : 'left the room'}`,
                duration: 2000
            });
        }
    }

    handleHostChanged(data) {
        if (this.debugMode) console.log('👑 Host changed:', data);
        this.stateManager.updateRoomState({ hostId: data.newHostId });
        
        if (data.newHostId === this.playerId && this.debugMode) {
            this.stateManager.addNotification({
                type: 'info',
                message: 'You are now the host',
                duration: 3000
            });
        }
    }

    handleGameStateUpdate(data) {
        if (this.debugMode) console.log('🎮 Game state update:', data);
        this.stateManager.handleGameStateUpdate(data);
    }

    handlePhaseChange(data) {
        if (this.debugMode) console.log('🎮 Phase change received:', data);
        this.stateManager.setGamePhase(data.phase);
        
        if (data.message && data.phase === 'finished') {
            this.stateManager.addChatMessage({
                type: 'system',
                content: data.message,
                timestamp: Date.now()
            });
        }
    }

    handleRoundStart(data) {
        if (this.debugMode) console.log('🎯 Round started:', data);
        
        if (!data?.spectrumX || !data?.spectrumY) {
            console.error('❌ Invalid round start data received:', data);
            if (this.debugMode) {
                this.stateManager.addNotification({
                    type: 'error',
                    message: 'Failed to start round - invalid data received',
                    duration: 5000
                });
            }
            return;
        }
        
        const isClueGiver = data.targetCoordinate !== undefined && data.targetCoordinate !== null;
        
        if (this.debugMode) {
            console.log('📍 Round start data received:', {
                roundNumber: data.roundNumber,
                clueGiverId: data.clueGiverId,
                myPlayerId: this.playerId,
                targetCoordinateReceived: data.targetCoordinate,
                isClueGiver
            });
        }
        
        this.stateManager.updateGameState({
            phase: 'giving-clue',
            currentRound: data.roundNumber || 1,
            totalRounds: data.totalRounds || 10,
            clueGiverId: data.clueGiverId,
            spectrumX: data.spectrumX,
            spectrumY: data.spectrumY,
            targetCoordinate: data.targetCoordinate || null,
            timeRemaining: data.duration || 60,
            clue: null,
            guesses: {},
            roundScores: {}
        });
        
        Object.keys(this.stateManager.getPlayers()).forEach(playerId => 
            this.stateManager.updatePlayer(playerId, { hasGuessed: false }));
        
        this.isSubmitting = false;
        
        this.stateManager.showTargetCoordinate(isClueGiver);
        this.stateManager.enableSpectrumInteraction(false);
        
        if (this.debugMode) {
            console.log(isClueGiver 
                ? `🎯 Clue giver mode activated: Target visible at (${data.targetCoordinate.x}, ${data.targetCoordinate.y})`
                : '🎲 Guesser mode activated: Waiting for clue');
        }
        
        setTimeout(() => {
            this.stateManager.emit('state:game.phase', { newValue: 'giving-clue', oldValue: 'lobby' });
            
            if (isClueGiver) {
                const clueSection = document.getElementById('clue-input-section');
                const clueInput = document.getElementById('clue-input-field');
                
                if (clueSection?.classList.contains('hidden')) {
                    if (this.debugMode) console.log('🔧 Fixing hidden clue input section');
                    clueSection.classList.remove('hidden');
                }
                
                if (clueInput) {
                    clueInput.value = '';
                    clueInput.disabled = false;
                    clueInput.focus();
                }
            }
        }, 100);
        
        if (isClueGiver && this.debugMode) {
            this.stateManager.addNotification({
                type: 'warning',
                message: `You are the Clue Giver! Target is at (${data.targetCoordinate.x}, ${data.targetCoordinate.y})`,
                duration: 5000
            });
        }
    }

    handleClueSubmitted(data) {
        if (this.debugMode) console.log('💡 Clue submitted:', data);
        
        this.stateManager.updateGameState({ phase: 'guessing', clue: data.clue });
        
        const isClueGiver = data.clueGiverId === this.playerId;
        this.stateManager.showTargetCoordinate(isClueGiver);
        this.stateManager.enableSpectrumInteraction(!isClueGiver);
        
        if (this.debugMode) {
            console.log(isClueGiver 
                ? '🎯 Clue giver in guessing phase: Target still visible, interaction disabled'
                : '🎲 Guesser in guessing phase: Target hidden, interaction enabled');
        }
    }

    handleGuessSubmitted(data) {
        if (this.debugMode) console.log('🎯 Guess submitted:', data);
        
        this.stateManager.updatePlayer(data.playerId, { hasGuessed: data.hasGuessed });
        
        if (data.playerId === this.playerId) {
            this.isSubmitting = false;
            if (this.debugMode) {
                this.stateManager.addNotification({
                    type: 'success',
                    message: 'Guess submitted! Waiting for other players...',
                    duration: 3000
                });
            }
        }
    }

    handleRoundEnd(data) {
        if (this.debugMode) console.log('🏁 Round ended:', data);
        
        if (this.stateVerificationInterval) {
            clearInterval(this.stateVerificationInterval);
            this.stateVerificationInterval = null;
        }
        
        this.stateManager.updateGameState({
            phase: 'results',
            targetCoordinate: data.targetCoordinate,
            guesses: data.guesses,
            roundScores: data.roundScores,
            totalScores: data.totalScores,
            bonusAwarded: data.bonusAwarded
        });
        
        this.stateManager.showTargetCoordinate(true);
        this.stateManager.enableSpectrumInteraction(false);
        
        Object.entries(data.totalScores).forEach(([playerId, score]) => 
            this.stateManager.updatePlayer(playerId, { score }));
        
        if (data.bonusAwarded && this.debugMode) {
            this.stateManager.addNotification({
                type: 'success',
                message: '🎉 Bonus round! All players guessed within 10 units!',
                duration: 5000
            });
        }
    }

    handleGameFinished(data) {
        if (this.debugMode) console.log('🎉 Game finished:', data);
        
        this.stateManager.updateGameState({
            phase: 'finished',
            finalScores: data.finalScores,
            winner: data.winner,
            gameStats: data.gameStats
        });
        
        const isWinner = data.winner === this.playerId;
        const winnerName = this.getPlayerName(data.winner);
        
        this.stateManager.addNotification({
            type: isWinner ? 'success' : 'info',
            message: isWinner 
                ? '🎉 Congratulations! You won the game!'
                : `Game finished! Winner: ${winnerName}`,
            duration: 8000
        });
    }

    handleTimerUpdate(data) {
        this.stateManager.updateTimer(data.timeRemaining);
        
        if (this.debugMode && [10, 5].includes(data.timeRemaining)) {
            this.stateManager.addNotification({
                type: 'warning',
                message: `⏰ ${data.timeRemaining} seconds ${data.timeRemaining === 10 ? 'remaining' : 'left'}!`,
                duration: 2000
            });
        }
    }

    handleChatMessage(data) {
        if (this.debugMode) console.log('💬 Chat message received:', data);
        
        this.stateManager.addChatMessage({
            playerId: data.playerId,
            playerName: data.playerName,
            content: data.message || data.content || data.text || '',
            timestamp: data.timestamp
        });
    }

    handleSocketError(error) {
        console.error('🔌 Socket error:', error);
        this.stateManager.setLoading(false);
        
        const isConnectionError = error.code && ['CONNECT', 'NETWORK', 'TIMEOUT']
            .some(type => error.code.includes(type));
        
        if (isConnectionError) {
            this.stateManager.updateConnectionState({
                status: 'error',
                error: error.message || 'Connection error occurred'
            });
        }
        
        if (error.code === 'GUESS_SUBMIT_FAILED' && error.message === 'Player has already guessed') {
            this.isSubmitting = false;
            return;
        }
        
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'error',
                message: error.message || 'An error occurred',
                duration: 5000
            });
        }
    }

    getPlayerName(playerId) {
        return this.stateManager.getPlayer(playerId)?.name || 'Unknown';
    }

    validatePlayerName(name) {
        const trimmed = name?.trim();
        return trimmed && trimmed.length <= 20 && /^[a-zA-Z0-9\s\-_]+$/.test(trimmed);
    }

    validateRoomCode(code) {
        return /^[A-Z0-9]{4,6}$/.test(code?.trim().toUpperCase());
    }

    validateClue(clue) {
        const trimmed = clue?.trim();
        return trimmed && trimmed.length <= 100 && !/\d/.test(trimmed);
    }

    validateGuess(coordinate) {
        if (!coordinate || typeof coordinate.x !== 'number' || typeof coordinate.y !== 'number') {
            return false;
        }
        return coordinate.x >= 0 && coordinate.x <= 100 && coordinate.y >= 0 && coordinate.y <= 100;
    }

    handleError(error) {
        console.error('GameClient error:', error);
        this.stateManager.setLoading(false);
        
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'error',
                message: error.message,
                duration: 5000
            });
        }
    }

    getGameState() { return this.stateManager.getGameState(); }
    getPlayers() { return this.stateManager.getPlayers(); }
    isClueGiver() { return this.stateManager.getGameState().clueGiverId === this.playerId; }
    hasGuessed() { return this.stateManager.getPlayers()[this.playerId]?.hasGuessed || false; }

    destroy() {
        this.socketClient.removeAllListeners();
        this.stateManager.removeAllListeners();
        this.currentRoomId = null;
        this.playerId = null;
        this.isInitialized = false;
        this.isSubmitting = false;
        console.log('🧹 GameClient destroyed');
    }
}