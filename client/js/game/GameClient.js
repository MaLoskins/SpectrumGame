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
 * FIXED: Reduced notifications, better error handling, prevented double submissions
 * ================================= */

/**
 * GameClient Class
 * Central coordinator for all game-related functionality
 */
export class GameClient {
    constructor(stateManager, socketClient) {
        this.stateManager = stateManager;
        this.socketClient = socketClient;
        
        // Game state
        this.isInitialized = false;
        this.currentRoomId = null;
        this.playerId = null;
        
        // Debug mode
        this.debugMode = false; // Changed to false by default
        
        // Submission tracking to prevent double submissions
        this.isSubmitting = false;
        
        // Bind methods
        this.init = this.init.bind(this);
    }

    /**
     * Initialize the game client
     */
    async init() {
        console.log('🎮 Initializing GameClient...');
        
        // Set up socket event handlers
        this.setupSocketEventHandlers();
        
        // Set up state event handlers
        this.setupStateEventHandlers();
        
        this.isInitialized = true;
        console.log('✅ GameClient initialized');
    }
    /**
     * Handle phase change event
     */
    handlePhaseChange(data) {
        if (this.debugMode) {
            console.log('🎮 Phase change received:', data);
        }
        
        // Update the game phase
        this.stateManager.setGamePhase(data.phase);
        
        // Only add system message for important phase changes
        if (data.message && data.phase === 'finished') {
            this.stateManager.addChatMessage({
                type: 'system',
                content: data.message,
                timestamp: Date.now()
            });
        }
    }
    /**
     * Set up socket event handlers
     */
    setupSocketEventHandlers() {
        console.log('🔌 Setting up socket event handlers');
        
        // Room events
        this.socketClient.on('room:created', this.handleRoomCreated.bind(this));
        this.socketClient.on('room:joined', this.handleRoomJoined.bind(this));
        this.socketClient.on('room:player-joined', this.handlePlayerJoined.bind(this));
        this.socketClient.on('room:player-left', this.handlePlayerLeft.bind(this));
        this.socketClient.on('room:host-changed', this.handleHostChanged.bind(this));
        
        // Game events
        this.socketClient.on('game:state-update', this.handleGameStateUpdate.bind(this));
        this.socketClient.on('game:round-start', this.handleRoundStart.bind(this));
        this.socketClient.on('game:clue-submitted', this.handleClueSubmitted.bind(this));
        this.socketClient.on('game:guess-submitted', this.handleGuessSubmitted.bind(this));
        this.socketClient.on('game:round-end', this.handleRoundEnd.bind(this));
        this.socketClient.on('game:finished', this.handleGameFinished.bind(this));
        
        // Timer events
        this.socketClient.on('timer:update', this.handleTimerUpdate.bind(this));
        
        // Chat events
        this.socketClient.on('chat:message', this.handleChatMessage.bind(this));
        
        // Error events
        this.socketClient.on('error', this.handleSocketError.bind(this));
        this.socketClient.on('game:phase-change', this.handlePhaseChange.bind(this));
    }
    
    /**
     * Set up state event handlers
     */
    setupStateEventHandlers() {
        console.log('📊 Setting up state event handlers');
        
        // Listen for UI-triggered actions
        this.stateManager.on('ui:create-room', this.createRoom.bind(this));
        this.stateManager.on('ui:join-room', this.joinRoom.bind(this));
        this.stateManager.on('ui:start-game', this.startGame.bind(this));
        this.stateManager.on('ui:submit-clue', this.submitClue.bind(this));
        this.stateManager.on('ui:submit-guess', this.submitGuess.bind(this));
        this.stateManager.on('ui:send-chat', this.sendChatMessage.bind(this));
        this.stateManager.on('ui:leave-room', this.leaveRoom.bind(this));
    }

    /**
     * Create a new room
     */
    async createRoom(data) {
        try {
            if (this.debugMode) {
                console.log('🏠 Creating room...', data);
            }
            
            // Validate input
            if (!this.validatePlayerName(data.playerName)) {
                throw new Error('Invalid player name');
            }
            
            // Update state to show loading
            this.stateManager.setLoading(true);
            
            // Send create room request
            this.socketClient.emit('room:create', {
                playerName: data.playerName.trim(),
                settings: data.settings || {
                    maxPlayers: 6,
                    roundDuration: 60,
                    totalRounds: 10
                }
            });
            
        } catch (error) {
            console.error('❌ Failed to create room:', error);
            this.handleError(error);
        }
    }

    /**
     * Join an existing room
     */
    async joinRoom(data) {
        try {
            if (this.debugMode) {
                console.log('🚪 Joining room...', data);
            }
            
            // Validate input
            if (!this.validateRoomCode(data.roomCode)) {
                throw new Error('Invalid room code');
            }
            
            if (!this.validatePlayerName(data.playerName)) {
                throw new Error('Invalid player name');
            }
            
            // Update state to show loading
            this.stateManager.setLoading(true);
            
            // Send join room request
            this.socketClient.emit('room:join', {
                roomCode: data.roomCode.trim().toUpperCase(),
                playerName: data.playerName.trim()
            });
            
        } catch (error) {
            console.error('❌ Failed to join room:', error);
            this.handleError(error);
        }
    }

    /**
     * Start the game (host only)
     */
    async startGame() {
        try {
            if (this.debugMode) {
                console.log('🎯 Starting game...');
            }
            
            if (!this.currentRoomId) {
                throw new Error('Not in a room');
            }
            
            // Send start game request
            this.socketClient.emit('game:start', {
                roomId: this.currentRoomId
            });
            
        } catch (error) {
            console.error('❌ Failed to start game:', error);
            this.handleError(error);
        }
    }

    /**
     * Submit a clue (Clue Giver only)
     */
    async submitClue(data) {
        try {
            if (this.debugMode) {
                console.log('💡 Submitting clue...', data);
            }
            
            // Validate clue
            if (!this.validateClue(data.clue)) {
                throw new Error('Invalid clue');
            }
            
            if (!this.currentRoomId) {
                throw new Error('Not in a room');
            }
            
            // Send clue submission
            this.socketClient.emit('game:submit-clue', {
                roomId: this.currentRoomId,
                clue: data.clue.trim()
            });
            
        } catch (error) {
            console.error('❌ Failed to submit clue:', error);
            this.handleError(error);
        }
    }

    /**
     * Submit a guess (Guessers only) - FIXED: Prevent double submission
     */
    async submitGuess(data) {
        try {
            // Prevent double submission
            if (this.isSubmitting) {
                if (this.debugMode) {
                    console.log('⚠️ Guess submission already in progress');
                }
                return;
            }
            
            this.isSubmitting = true;
            
            if (this.debugMode) {
                console.log('🎯 Submitting guess...', data);
            }
            
            // Validate guess
            if (!this.validateGuess(data.position)) {
                this.isSubmitting = false;
                throw new Error('Invalid guess position');
            }
            
            if (!this.currentRoomId) {
                this.isSubmitting = false;
                throw new Error('Not in a room');
            }
            
            // Send guess submission
            this.socketClient.emit('game:submit-guess', {
                roomId: this.currentRoomId,
                position: Number(data.position)
            });
            
        } catch (error) {
            this.isSubmitting = false;
            console.error('❌ Failed to submit guess:', error);
            this.handleError(error);
        }
    }

    /**
     * Send chat message
     */
    async sendChatMessage(data) {
        try {
            if (this.debugMode) {
                console.log('💬 Sending chat message...', data);
            }
            
            if (!data.message || !data.message.trim()) {
                return; // Don't send empty messages
            }
            
            if (!this.currentRoomId) {
                throw new Error('Not in a room');
            }
            
            // Send chat message
            this.socketClient.emit('chat:send', {
                roomId: this.currentRoomId,
                message: data.message.trim()
            });
            
        } catch (error) {
            console.error('❌ Failed to send chat message:', error);
            this.handleError(error);
        }
    }

    /**
     * Leave the current room
     */
    async leaveRoom() {
        try {
            if (this.debugMode) {
                console.log('🚪 Leaving room...');
            }
            
            if (!this.currentRoomId) {
                return; // Already not in a room
            }
            
            // Send leave room request
            this.socketClient.emit('player:disconnect', {
                roomId: this.currentRoomId,
                playerId: this.playerId
            });
            
            // Reset local state
            this.currentRoomId = null;
            this.playerId = null;
            
            // Update state manager
            this.stateManager.resetGameState();
            this.stateManager.setCurrentView('lobby');
            
        } catch (error) {
            console.error('❌ Failed to leave room:', error);
            this.handleError(error);
        }
    }

    /**
     * Handle room created event
     */
    handleRoomCreated(data) {
        if (this.debugMode) {
            console.log('🏠 Room created:', data);
        }
        
        this.currentRoomId = data.roomId;
        this.playerId = data.playerId;
        
        // Update state
        this.stateManager.setLoading(false);
        this.stateManager.setConnected(data.playerId, data.roomCode);
        this.stateManager.updatePlayers(data.players);
        
        // Make sure we have full room info
        if (data.room) {
            this.stateManager.setRoomInfo(data.room);
        } else {
            // Fallback if room info is missing
            this.stateManager.setRoomInfo({
                code: data.roomCode,
                hostId: data.playerId,
                playerCount: data.players.length,
                maxPlayers: 4,
                canStart: data.players.length >= 2,
                settings: {}
            });
        }
        
        this.stateManager.setCurrentView('game');
        this.stateManager.setGamePhase('lobby');
        
        // Only show notification in debug mode
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'success',
                message: `Room ${data.roomCode} created successfully!`,
                duration: 3000
            });
        }
    }

    /**
     * Handle room joined event
     */
    handleRoomJoined(data) {
        if (this.debugMode) {
            console.log('🚪 Room joined:', data);
        }
        
        this.currentRoomId = data.roomId;
        this.playerId = data.playerId;
        
        // Update state
        this.stateManager.setLoading(false);
        this.stateManager.setConnected(data.playerId, data.roomCode);
        this.stateManager.updatePlayers(data.players);
        this.stateManager.setRoomInfo(data.room);
        this.stateManager.updateGameState(data.gameState);
        this.stateManager.setCurrentView('game');
        
        // Only show notification in debug mode
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'success',
                message: `Joined room ${data.roomCode} successfully!`,
                duration: 3000
            });
        }
    }

    /**
     * Handle player joined event
     */
    handlePlayerJoined(data) {
        if (this.debugMode) {
            console.log('👋 Player joined:', data.player);
        }
        this.stateManager.addPlayer(data.player);
        
        // Update room player count
        const currentRoom = this.stateManager.getRoomState();
        this.stateManager.updateRoomState({
            playerCount: Object.keys(this.stateManager.getPlayers()).length,
            canStart: Object.keys(this.stateManager.getPlayers()).length >= 2
        });
        
        // If we're in lobby phase, update the UI
        const gameState = this.stateManager.getGameState();
        if (gameState.phase === 'lobby') {
            this.stateManager.emit('state:game.phase', {
                newValue: 'lobby',
                oldValue: 'lobby'
            });
        }
        
        // Only show notification for other players
        if (data.player.id !== this.playerId && this.debugMode) {
            this.stateManager.addNotification({
                type: 'info',
                message: `${data.player.name} joined the room`,
                duration: 2000
            });
        }
    }

    /**
     * Handle player left event
     */
    handlePlayerLeft(data) {
        if (this.debugMode) {
            console.log('👋 Player left:', data);
        }
        this.stateManager.removePlayer(data.playerId);
        
        // Only show notification in debug mode
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'info',
                message: `${data.playerName} ${data.isDisconnected ? 'disconnected' : 'left the room'}`,
                duration: 2000
            });
        }
    }

    /**
     * Handle host changed event
     */
    handleHostChanged(data) {
        if (this.debugMode) {
            console.log('👑 Host changed:', data);
        }
        
        // Update room state
        this.stateManager.updateRoomState({
            hostId: data.newHostId
        });
        
        // Only show notification if you became the host
        if (data.newHostId === this.playerId && this.debugMode) {
            this.stateManager.addNotification({
                type: 'info',
                message: 'You are now the host',
                duration: 3000
            });
        }
    }

    /**
     * Handle game state update
     */
    handleGameStateUpdate(data) {
        if (this.debugMode) {
            console.log('🎮 Game state update:', data);
        }
        this.stateManager.handleGameStateUpdate(data);
    }

    /**
     * Handle round start - FIXED: Reduced logging and notifications
     */
    handleRoundStart(data) {
        if (this.debugMode) {
            console.log('🎯 Round started:', data);
        }
        
        // Validate data
        if (!data || !data.spectrum) {
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
        
        // The server sends targetPosition ONLY to the clue giver
        // If we receive a targetPosition, we ARE the clue giver
        const isClueGiver = data.targetPosition !== undefined && data.targetPosition !== null;
        
        if (this.debugMode) {
            console.log('📍 Round start data received:', {
                roundNumber: data.roundNumber,
                clueGiverId: data.clueGiverId,
                myPlayerId: this.playerId,
                targetPositionReceived: data.targetPosition,
                isClueGiver: isClueGiver
            });
        }
        
        // Prepare game state update
        const gameStateUpdate = {
            phase: 'giving-clue',
            currentRound: data.roundNumber || 1,
            totalRounds: data.totalRounds || 10,
            clueGiverId: data.clueGiverId,
            spectrum: data.spectrum,
            targetPosition: data.targetPosition || null,  // Will be null for guessers
            timeRemaining: data.duration || 60,
            clue: null,
            guesses: {},
            roundScores: {}
        };
        
        // Update game state atomically
        this.stateManager.updateGameState(gameStateUpdate);
        
        // Reset all players' "hasGuessed" status and submission state
        const players = this.stateManager.getPlayers();
        Object.keys(players).forEach(playerId => {
            this.stateManager.updatePlayer(playerId, { hasGuessed: false });
        });
        
        // Reset submission tracking
        this.isSubmitting = false;
        
        // Update UI state based on role
        if (isClueGiver) {
            // Clue giver: show target, disable spectrum interaction
            this.stateManager.showTargetPosition(true);
            this.stateManager.enableSpectrumInteraction(false);
            if (this.debugMode) {
                console.log('🎯 Clue giver mode activated: Target visible at position', data.targetPosition);
            }
        } else {
            // Guesser: hide target, disable interaction until clue is given
            this.stateManager.showTargetPosition(false);
            this.stateManager.enableSpectrumInteraction(false);
            if (this.debugMode) {
                console.log('🎲 Guesser mode activated: Waiting for clue');
            }
        }
        
        // Force UI update to ensure correct controls are shown
        // Using setTimeout to ensure state has propagated
        setTimeout(() => {
            // Trigger phase update to refresh UI
            this.stateManager.emit('state:game.phase', {
                newValue: 'giving-clue',
                oldValue: 'lobby'
            });
            
            // Additional check for clue giver UI
            if (isClueGiver) {
                const clueSection = document.getElementById('clue-input-section');
                const clueInput = document.getElementById('clue-input-field');
                
                if (clueSection && clueSection.classList.contains('hidden')) {
                    if (this.debugMode) {
                        console.log('🔧 Fixing hidden clue input section');
                    }
                    clueSection.classList.remove('hidden');
                }
                
                if (clueInput) {
                    clueInput.value = '';
                    clueInput.disabled = false;
                    clueInput.focus();
                }
            }
        }, 100);
        
        // Only show important notifications
        if (isClueGiver && this.debugMode) {
            this.stateManager.addNotification({
                type: 'warning',
                message: `You are the Clue Giver! Target is at ${data.targetPosition}%`,
                duration: 5000
            });
        }
    }
    
    recoverFromError(error, context) {
        console.error(`❌ Error in ${context}:`, error);
        
        // Log detailed error info
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            context: context,
            state: {
                connected: this.socketClient?.isConnected(),
                roomId: this.currentRoomId,
                playerId: this.playerId,
                gamePhase: this.stateManager.getGameState().phase
            }
        };
        
        if (this.debugMode) {
            console.table(errorInfo);
        }
        
        // Attempt recovery based on context
        switch (context) {
            case 'round-start':
                // Request game state refresh
                if (this.socketClient?.isConnected() && this.currentRoomId) {
                    this.socketClient.emit('game:request-state', { roomId: this.currentRoomId });
                }
                break;
                
            case 'clue-submission':
                // Re-enable UI elements
                const clueInput = document.getElementById('clue-input-field');
                const submitBtn = document.getElementById('submit-clue');
                if (clueInput) clueInput.disabled = false;
                if (submitBtn) submitBtn.disabled = false;
                break;
                
            case 'guess-submission':
                // Re-enable guess controls
                const guessBtn = document.getElementById('submit-guess');
                if (guessBtn) guessBtn.disabled = false;
                this.isSubmitting = false;
                break;
        }
        
        // Show user-friendly error message only in debug mode
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'error',
                message: `Something went wrong. Please try again.`,
                duration: 5000
            });
        }
    }

    /**
     * Handle clue submitted
     */
    handleClueSubmitted(data) {
        if (this.debugMode) {
            console.log('💡 Clue submitted:', data);
        }
        
        this.stateManager.updateGameState({
            phase: 'guessing',
            clue: data.clue
        });
        
        // Update UI state based on role
        const isClueGiver = data.clueGiverId === this.playerId;
        if (isClueGiver) {
            // Clue giver continues to see target but can't interact
            this.stateManager.showTargetPosition(true);
            this.stateManager.enableSpectrumInteraction(false);
            if (this.debugMode) {
                console.log('🎯 Clue giver in guessing phase: Target still visible, interaction disabled');
            }
        } else {
            // Guessers can now interact
            this.stateManager.showTargetPosition(false);
            this.stateManager.enableSpectrumInteraction(true);
            if (this.debugMode) {
                console.log('🎲 Guesser in guessing phase: Target hidden, interaction enabled');
            }
        }
        
        // No notifications needed - the clue text appears on screen
    }

    /**
     * Handle guess submitted - FIXED: Reset submission state
     */
    handleGuessSubmitted(data) {
        if (this.debugMode) {
            console.log('🎯 Guess submitted:', data);
        }
        
        // Update player state
        this.stateManager.updatePlayer(data.playerId, {
            hasGuessed: data.hasGuessed
        });
        
        // Reset submission state if it's our guess
        if (data.playerId === this.playerId) {
            this.isSubmitting = false;
            
            // Only show notification in debug mode
            if (this.debugMode) {
                this.stateManager.addNotification({
                    type: 'success',
                    message: 'Guess submitted! Waiting for other players...',
                    duration: 3000
                });
            }
        }
    }

    /**
     * Handle round end
     */
    handleRoundEnd(data) {
        if (this.debugMode) {
            console.log('🏁 Round ended:', data);
        }
        
        // Clear any UI verification intervals during results
        if (this.stateVerificationInterval) {
            clearInterval(this.stateVerificationInterval);
            this.stateVerificationInterval = null;
        }
        
        this.stateManager.updateGameState({
            phase: 'results',
            targetPosition: data.targetPosition,
            guesses: data.guesses,
            roundScores: data.roundScores,
            totalScores: data.totalScores,
            bonusAwarded: data.bonusAwarded
        });
        
        // Show target to everyone during results
        this.stateManager.showTargetPosition(true);
        this.stateManager.enableSpectrumInteraction(false);
        
        // Update player scores
        Object.entries(data.totalScores).forEach(([playerId, score]) => {
            this.stateManager.updatePlayer(playerId, { score });
        });
        
        // Only show notification for bonus rounds in debug mode
        if (data.bonusAwarded && this.debugMode) {
            this.stateManager.addNotification({
                type: 'success',
                message: '🎉 Bonus round! All players guessed within 10%!',
                duration: 5000
            });
        }
    }

    /**
     * Handle game finished
     */
    handleGameFinished(data) {
        if (this.debugMode) {
            console.log('🎉 Game finished:', data);
        }
        
        this.stateManager.updateGameState({
            phase: 'finished',
            finalScores: data.finalScores,
            winner: data.winner,
            gameStats: data.gameStats
        });
        
        // Show game end notification
        const isWinner = data.winner === this.playerId;
        const winnerName = this.getPlayerName(data.winner);
        const message = isWinner 
            ? '🎉 Congratulations! You won the game!'
            : `Game finished! Winner: ${winnerName}`;
            
        this.stateManager.addNotification({
            type: isWinner ? 'success' : 'info',
            message,
            duration: 8000
        });
    }

    /**
     * Handle timer update
     */
    handleTimerUpdate(data) {
        this.stateManager.updateTimer(data.timeRemaining);
        
        // Only show warning notifications in debug mode
        if (this.debugMode) {
            if (data.timeRemaining === 10) {
                this.stateManager.addNotification({
                    type: 'warning',
                    message: '⏰ 10 seconds remaining!',
                    duration: 2000
                });
            } else if (data.timeRemaining === 5) {
                this.stateManager.addNotification({
                    type: 'warning',
                    message: '⏰ 5 seconds left!',
                    duration: 2000
                });
            }
        }
    }

    /**
     * Handle chat message
     */
    handleChatMessage(data) {
        if (this.debugMode) {
            console.log('💬 Chat message received:', data);
        }
        
        // Handle potential null/undefined content
        if (!data.message && data.content) {
            data.message = data.content;
        } else if (!data.message && data.text) {
            data.message = data.text;
        }
        
        this.stateManager.addChatMessage({
            playerId: data.playerId,
            playerName: data.playerName,
            content: data.message || '',
            timestamp: data.timestamp
        });
    }

    /**
     * Handle socket errors - FIXED: Don't set connection status to error for game logic errors
     */
    handleSocketError(error) {
        console.error('🔌 Socket error:', error);
        
        this.stateManager.setLoading(false);
        
        // Only set connection status to error for actual connection errors
        const isConnectionError = error.code && (
            error.code.includes('CONNECT') || 
            error.code.includes('NETWORK') ||
            error.code.includes('TIMEOUT')
        );
        
        if (isConnectionError) {
            this.stateManager.updateConnectionState({
                status: 'error',
                error: error.message || 'Connection error occurred'
            });
        }
        
        // For game logic errors (like double submission), just reset state
        if (error.code === 'GUESS_SUBMIT_FAILED' && error.message === 'Player has already guessed') {
            this.isSubmitting = false;
            // Don't show error - the guess was already submitted
            return;
        }
        
        // Show error notification only in debug mode
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'error',
                message: error.message || 'An error occurred',
                duration: 5000
            });
        }
    }

    /**
     * Get player name by ID
     */
    getPlayerName(playerId) {
        const player = this.stateManager.getPlayer(playerId);
        return player ? player.name : 'Unknown';
    }

    /**
     * Validate player name
     */
    validatePlayerName(name) {
        if (!name || typeof name !== 'string') {
            return false;
        }
        
        const trimmed = name.trim();
        return trimmed.length >= 1 && trimmed.length <= 20 && /^[a-zA-Z0-9\s\-_]+$/.test(trimmed);
    }

    /**
     * Validate room code
     */
    validateRoomCode(code) {
        if (!code || typeof code !== 'string') {
            return false;
        }
        
        const trimmed = code.trim().toUpperCase();
        return /^[A-Z0-9]{4,6}$/.test(trimmed);
    }

    /**
     * Validate clue text
     */
    validateClue(clue) {
        if (!clue || typeof clue !== 'string') {
            return false;
        }
        
        const trimmed = clue.trim();
        return trimmed.length >= 1 && trimmed.length <= 100 && !/\d/.test(trimmed);
    }

    /**
     * Validate guess position
     */
    validateGuess(position) {
        const num = Number(position);
        return !isNaN(num) && num >= 0 && num <= 100;
    }

    /**
     * Handle errors
     */
    handleError(error) {
        console.error('GameClient error:', error);
        
        // Update connection state only for connection errors
        this.stateManager.setLoading(false);
        
        // Show error notification only in debug mode
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'error',
                message: error.message,
                duration: 5000
            });
        }
    }

    /**
     * Get current game state
     */
    getGameState() {
        return this.stateManager.getGameState();
    }

    /**
     * Get current players
     */
    getPlayers() {
        return this.stateManager.getPlayers();
    }

    /**
     * Check if current player is Clue Giver
     */
    isClueGiver() {
        const gameState = this.stateManager.getGameState();
        return gameState.clueGiverId === this.playerId;
    }

    /**
     * Check if current player has guessed
     */
    hasGuessed() {
        const players = this.stateManager.getPlayers();
        const currentPlayer = players[this.playerId];
        return currentPlayer ? currentPlayer.hasGuessed : false;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Remove event listeners
        this.socketClient.removeAllListeners();
        this.stateManager.removeAllListeners();
        
        // Reset state
        this.currentRoomId = null;
        this.playerId = null;
        this.isInitialized = false;
        this.isSubmitting = false;
        
        console.log('🧹 GameClient destroyed');
    }
}