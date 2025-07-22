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
        this.setupHandlers();
        this.isInitialized = true;
        console.log('✅ GameClient initialized');
    }

    setupHandlers() {
        console.log('🔌 Setting up event handlers');
        
        // Socket event mappings
        const socketHandlers = {
            'room:created': this.handleRoomCreated,
            'room:joined': this.handleRoomJoined,
            'room:player-joined': this.handlePlayerJoined,
            'room:player-left': this.handlePlayerLeft,
            'room:host-changed': d => this.updateRoom({ hostId: d.newHostId }, d.newHostId === this.playerId ? 'You are now the host' : null),
            'game:state-update': d => this.stateManager.handleGameStateUpdate(d),
            'game:round-start': this.handleRoundStart,
            'game:clue-submitted': this.handleClueSubmitted,  // Use dedicated handler
            'game:guess-submitted': d => this.updateGuess(d.playerId, d.hasGuessed),
            'game:round-end': this.handleRoundEnd,
            'game:finished': this.handleGameFinished,
            'game:phase-change': d => this.stateManager.setGamePhase(d.phase),
            'timer:update': d => this.stateManager.updateTimer(d.timeRemaining),
            'chat:message': d => this.stateManager.addChatMessage({ playerId: d.playerId, playerName: d.playerName, content: d.message || d.content || d.text || '', timestamp: d.timestamp }),
            'error': this.handleSocketError
        };
        
        Object.entries(socketHandlers).forEach(([event, handler]) => 
            this.socketClient.on(event, handler.bind(this)));

        // UI event mappings
        const uiActions = {
            'create-room': d => this.emitIfValid(d, 'room:create', { settings: d.settings || { maxPlayers: 6, roundDuration: 60, totalRounds: 10 } }),
            'join-room': d => this.emitIfValid(d, 'room:join', { roomCode: d.roomCode.trim().toUpperCase() }),
            'start-game': () => this.emitIfConnected('game:start', { roomId: this.currentRoomId }),
            'submit-clue': d => this.emitIfValid(d, 'game:submit-clue', { roomId: this.currentRoomId, clue: d.clue.trim() }, 'clue'),
            'send-chat': d => d.message?.trim() && this.emitIfConnected('chat:send', { roomId: this.currentRoomId, message: d.message.trim() }),
            'leave-room': this.leaveRoom
        };
        
        Object.entries(uiActions).forEach(([event, handler]) => 
            this.stateManager.on(`ui:${event}`, handler.bind(this)));
        
        this.stateManager.on('spectrum:guess-placed', this.submitGuess.bind(this));
    }

    handleClueSubmitted(data) {
        if (this.debugMode) console.log('💡 Clue submitted:', data);
        
        // Update game state
        this.stateManager.updateGameState({ 
            phase: 'guessing', 
            clue: data.clue 
        });
        
        // Determine if current player is the clue giver
        const gameState = this.stateManager.getGameState();
        const isClueGiver = gameState.clueGiverId === this.playerId;
        
        // Update UI based on role
        this.stateManager.showTargetCoordinate(isClueGiver);
        this.stateManager.enableSpectrumInteraction(!isClueGiver);
        
        if (this.debugMode) {
            console.log(isClueGiver 
                ? '🎯 Clue giver in guessing phase: Target visible, interaction disabled'
                : '🎲 Guesser in guessing phase: Target hidden, interaction enabled');
        }
    }

    async emitIfValid(data, event, extraData = {}, validationType = null) {
        try {
            if (this.debugMode) console.log(`🔌 ${event}:`, data);
            
            const validation = validationType === 'clue' 
                ? this.validateClue(data.clue) 
                : this.validatePlayerName(data.playerName);
            
            if (!validation) throw new Error(`Invalid ${validationType || 'player name'}`);
            
            // Only set loading for room creation/joining, not for game actions
            if (['room:create', 'room:join'].includes(event)) {
                this.stateManager.setLoading(true);
            }
            
            this.socketClient.emit(event, { 
                playerName: data.playerName?.trim(), 
                ...extraData 
            });
        } catch (error) {
            this.handleError(error);
        }
    }

    emitIfConnected(event, data) {
        if (!this.currentRoomId) throw new Error('Not in a room');
        this.socketClient.emit(event, data);
    }

    async submitGuess(data) {
        if (this.isSubmitting) return;
        
        try {
            this.isSubmitting = true;
            if (this.debugMode) console.log('🎯 Submitting guess...', data);
            
            const coord = data.coordinate;
            if (!coord || typeof coord.x !== 'number' || typeof coord.y !== 'number' || 
                coord.x < 0 || coord.x > 100 || coord.y < 0 || coord.y > 100) {
                throw new Error('Invalid guess coordinate');
            }
            
            this.emitIfConnected('game:submit-guess', {
                roomId: this.currentRoomId,
                coordinate: { x: Number(coord.x), y: Number(coord.y) }
            });
        } catch (error) {
            this.handleError(error);
        } finally {
            this.isSubmitting = false;
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
            
            this.resetClient();
        } catch (error) {
            this.handleError(error);
        }
    }

    handleRoomCreated(data) {
        this.setupRoom(data, data.playerId);
        this.stateManager.addNotification({
            type: 'success',
            message: `Room ${data.roomCode} created! Share this code with your friends.`,
            duration: 0
        });
    }

    handleRoomJoined(data) {
        this.setupRoom(data, data.playerId);
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'success',
                message: `Joined room ${data.roomCode} successfully!`,
                duration: 3000
            });
        }
    }

    setupRoom(data, playerId) {
        if (this.debugMode) console.log('🏠 Setting up room:', data);
        
        this.currentRoomId = data.roomId;
        this.playerId = playerId;
        
        this.stateManager.setLoading(false);
        this.stateManager.setConnected(playerId, data.roomCode);
        this.stateManager.updatePlayers(data.players);
        this.stateManager.setRoomInfo(data.room || {
            code: data.roomCode,
            hostId: playerId,
            playerCount: data.players.length,
            maxPlayers: 4,
            canStart: data.players.length >= 2,
            settings: {}
        });
        this.stateManager.setCurrentView('game');
        this.stateManager.setGamePhase(data.gameState?.phase || 'lobby');
        if (data.gameState) this.stateManager.updateGameState(data.gameState);
    }

    handlePlayerJoined(data) {
        if (this.debugMode) console.log('👋 Player joined:', data.player);
        this.stateManager.addPlayer(data.player);
        
        const players = this.stateManager.getPlayers();
        const count = Object.keys(players).length;
        this.stateManager.updateRoomState({ 
            playerCount: count, 
            canStart: count >= 2 
        });
        
        // Force UI update for lobby phase
        if (this.stateManager.getGameState().phase === 'lobby') {
            this.stateManager.emit('state:game.phase', { newValue: 'lobby', oldValue: 'lobby' });
        }
        
        // Show notification for other players
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

    updateRoom(updates, notification) {
        this.stateManager.updateRoomState(updates);
        if (notification && this.debugMode) {
            this.stateManager.addNotification({ type: 'info', message: notification, duration: 3000 });
        }
    }

    updateGame(updates, clueGiverId) {
        this.stateManager.updateGameState(updates);
        const isClueGiver = clueGiverId === this.playerId;
        this.stateManager.showTargetCoordinate(isClueGiver);
        this.stateManager.enableSpectrumInteraction(!isClueGiver);
    }

    updateGuess(playerId, hasGuessed) {
        if (this.debugMode) console.log('🎯 Guess submitted:', { playerId, hasGuessed });
        this.stateManager.updatePlayer(playerId, { hasGuessed });
        
        if (playerId === this.playerId) {
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

    handleRoundStart(data) {
        if (this.debugMode) console.log('🎯 Round started:', data);
        
        if (!data?.spectrumX || !data?.spectrumY) {
            console.error('❌ Invalid round start data:', data);
            return;
        }
        
        const isClueGiver = data.targetCoordinate !== undefined && data.targetCoordinate !== null;
        
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
        
        setTimeout(() => {
            this.stateManager.emit('state:game.phase', { newValue: 'giving-clue', oldValue: 'lobby' });
            
            if (isClueGiver) {
                const clueSection = document.getElementById('clue-input-section');
                const clueInput = document.getElementById('clue-input-field');
                
                if (clueSection?.classList.contains('hidden')) clueSection.classList.remove('hidden');
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

    handleRoundEnd(data) {
        if (this.debugMode) console.log('🏁 Round ended:', data);
        
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
            message: isWinner ? '🎉 Congratulations! You won the game!' : `Game finished! Winner: ${winnerName}`,
            duration: 8000
        });
    }

    handleSocketError(error) {
        console.error('🔌 Socket error:', error);
        this.stateManager.setLoading(false);
        
        if (error.code === 'GUESS_SUBMIT_FAILED' && error.message === 'Player has already guessed') {
            this.isSubmitting = false;
            return;
        }
        
        const isConnectionError = error.code && ['CONNECT', 'NETWORK', 'TIMEOUT'].some(type => error.code.includes(type));
        if (isConnectionError) {
            this.stateManager.updateConnectionState({ status: 'error', error: error.message || 'Connection error occurred' });
        }
        
        if (this.debugMode) {
            this.stateManager.addNotification({ type: 'error', message: error.message || 'An error occurred', duration: 5000 });
        }
    }

    getPlayerName(playerId) {
        return this.stateManager.getPlayer(playerId)?.name || 'Unknown';
    }

    validatePlayerName(name) {
        const trimmed = name?.trim();
        return trimmed && trimmed.length <= 20 && /^[a-zA-Z0-9\s\-_]+$/.test(trimmed);
    }

    validateClue(clue) {
        const trimmed = clue?.trim();
        return trimmed && trimmed.length <= 100 && !/\d/.test(trimmed);
    }

    handleError(error) {
        console.error('GameClient error:', error);
        this.stateManager.setLoading(false);
        if (this.debugMode) {
            this.stateManager.addNotification({ type: 'error', message: error.message, duration: 5000 });
        }
    }

    resetClient() {
        this.currentRoomId = null;
        this.playerId = null;
        this.stateManager.resetGameState();
        this.stateManager.setCurrentView('lobby');
    }

    getGameState = () => this.stateManager.getGameState();
    getPlayers = () => this.stateManager.getPlayers();
    isClueGiver = () => this.stateManager.getGameState().clueGiverId === this.playerId;
    hasGuessed = () => this.stateManager.getPlayers()[this.playerId]?.hasGuessed || false;

    destroy() {
        this.socketClient.removeAllListeners();
        this.stateManager.removeAllListeners();
        this.resetClient();
        this.isInitialized = false;
        this.isSubmitting = false;
        console.log('🧹 GameClient destroyed');
    }
}