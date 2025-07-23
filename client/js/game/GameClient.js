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

import { GAME_RULES, VALIDATION, UI } from '../../shared/constants.js';
import { EVENTS, ROOM_EVENTS, GAME_EVENTS, PLAYER_EVENTS, CHAT_EVENTS, TIMER_EVENTS, UI_EVENTS } from '../../shared/events.js';
import { Validator } from '../../shared/validation.js';
import { GameError, ValidationError, convertToGameError } from '../../shared/errors.js';

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

    /**
     * Initialize the game client
     * Sets up event handlers and marks client as initialized
     * @returns {Promise<void>}
     */
    async init() {
        console.log('🎮 Initializing GameClient...');
        this.setupHandlers();
        this.isInitialized = true;
        console.log('✅ GameClient initialized');
    }

    /**
     * Set up event handlers for socket events and UI actions
     * Maps socket events to handler methods and UI events to actions
     */
    setupHandlers() {
        console.log('🔌 Setting up event handlers');
        
        // Socket event mappings
        const socketHandlers = {
            [ROOM_EVENTS.CREATED]: this.handleRoomCreated,
            [ROOM_EVENTS.JOINED]: this.handleRoomJoined,
            [ROOM_EVENTS.PLAYER_JOINED]: this.handlePlayerJoined,
            [ROOM_EVENTS.PLAYER_LEFT]: this.handlePlayerLeft,
            [ROOM_EVENTS.HOST_CHANGED]: d => this.updateRoom({ hostId: d.newHostId }, d.newHostId === this.playerId ? 'You are now the host' : null),
            [GAME_EVENTS.STATE_UPDATE]: d => this.stateManager.handleGameStateUpdate(d),
            [GAME_EVENTS.ROUND_START]: this.handleRoundStart,
            [GAME_EVENTS.CLUE_SUBMITTED]: this.handleClueSubmitted,  // Use dedicated handler
            [GAME_EVENTS.GUESS_SUBMITTED]: d => this.updateGuess(d.playerId, d.hasGuessed),
            [GAME_EVENTS.ROUND_END]: this.handleRoundEnd,
            [GAME_EVENTS.FINISHED]: this.handleGameFinished,
            [GAME_EVENTS.PHASE_CHANGE]: d => this.stateManager.setGamePhase(d.phase),
            [TIMER_EVENTS.UPDATE]: d => this.stateManager.updateTimer(d.timeRemaining),
            [CHAT_EVENTS.MESSAGE]: d => this.stateManager.addChatMessage({ playerId: d.playerId, playerName: d.playerName, content: d.message || d.content || d.text || '', timestamp: d.timestamp }),
            'error': this.handleSocketError
        };
        
        Object.entries(socketHandlers).forEach(([event, handler]) => 
            this.socketClient.on(event, handler.bind(this)));

        // UI event mappings
        const uiActions = {
            'create-room': d => this.emitIfValid(d, ROOM_EVENTS.CREATE, {
                settings: d.settings || {
                    maxPlayers: GAME_RULES.MAX_PLAYERS,
                    roundDuration: GAME_RULES.ROUND_DURATION,
                    totalRounds: GAME_RULES.MAX_ROUNDS
                }
            }),
            'join-room': d => this.emitIfValid(d, ROOM_EVENTS.JOIN, { roomCode: d.roomCode.trim().toUpperCase() }),
            'start-game': () => this.emitIfConnected(GAME_EVENTS.START, { roomId: this.currentRoomId }),
            'submit-clue': d => this.emitIfValid(d, GAME_EVENTS.SUBMIT_CLUE, { roomId: this.currentRoomId, clue: d.clue.trim() }, 'clue'),
            'send-chat': d => d.message?.trim() && this.emitIfConnected(CHAT_EVENTS.SEND, { roomId: this.currentRoomId, message: d.message.trim() }),
            'leave-room': this.leaveRoom
        };
        
        Object.entries(uiActions).forEach(([event, handler]) => 
            this.stateManager.on(`ui:${event}`, handler.bind(this)));
        
        this.stateManager.on(UI_EVENTS.SPECTRUM_GUESS_PLACED, this.submitGuess.bind(this));
    }

    /**
     * Handle clue submission event from server
     * Updates game state to guessing phase and configures UI based on player role
     * @param {Object} data - Clue submission data
     * @param {string} data.clue - The submitted clue
     */
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

    /**
     * Validate data and emit socket event if valid
     * @param {Object} data - Data to validate
     * @param {string} event - Socket event name to emit
     * @param {Object} extraData - Additional data to include in emission
     * @param {string|null} validationType - Type of validation to perform ('clue' or null for playerName)
     * @returns {Promise<void>}
     */
    async emitIfValid(data, event, extraData = {}, validationType = null) {
        try {
            if (this.debugMode) console.log(`🔌 ${event}:`, data);
            
            const validation = validationType === 'clue'
                ? Validator.clue(data.clue)
                : Validator.playerName(data.playerName);
            
            if (!validation.valid) throw new ValidationError(
                validationType === 'clue' ? 'INVALID_CLUE' : 'INVALID_PLAYER_NAME',
                validation.error,
                validationType === 'clue' ? 'clue' : 'playerName',
                validationType === 'clue' ? data.clue : data.playerName
            );
            
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

    /**
     * Emit socket event if client is connected to a room
     * @param {string} event - Socket event name to emit
     * @param {Object} data - Data to include in emission
     * @throws {GameError} If not connected to a room
     */
    emitIfConnected(event, data) {
        if (!this.currentRoomId) throw new GameError('ROOM_NOT_FOUND', 'Not in a room');
        this.socketClient.emit(event, data);
    }

    /**
     * Submit a guess to the server
     * Validates coordinate and emits guess event
     * @param {Object} data - Guess data
     * @param {Object} data.coordinate - Coordinate of the guess {x, y}
     * @returns {Promise<void>}
     */
    async submitGuess(data) {
        if (this.isSubmitting) return;
        
        try {
            this.isSubmitting = true;
            if (this.debugMode) console.log('🎯 Submitting guess...', data);
            
            const coord = data.coordinate;
            const validation = Validator.coordinate(coord);
            if (!validation.valid) {
                throw new ValidationError('INVALID_GUESS', validation.error, 'coordinate', coord);
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

    /**
     * Leave the current room
     * Emits disconnect event and resets client state
     * @returns {Promise<void>}
     */
    async leaveRoom() {
        try {
            if (this.debugMode) console.log('🚪 Leaving room...');
            if (!this.currentRoomId) return;
            
            this.socketClient.emit(PLAYER_EVENTS.DISCONNECT, {
                roomId: this.currentRoomId,
                playerId: this.playerId
            });
            
            this.resetClient();
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Handle room creation event from server
     * Sets up room and shows success notification
     * @param {Object} data - Room creation data
     * @param {string} data.roomCode - Room code
     * @param {string} data.playerId - Player ID
     */
    handleRoomCreated(data) {
        this.setupRoom(data, data.playerId);
        this.stateManager.addNotification({
            type: 'success',
            message: `Room ${data.roomCode} created! Share this code with your friends.`,
            duration: 0
        });
    }

    /**
     * Handle room joined event from server
     * Sets up room and shows success notification
     * @param {Object} data - Room join data
     * @param {string} data.roomCode - Room code
     * @param {string} data.playerId - Player ID
     */
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

    /**
     * Set up room state after creation or joining
     * Updates client state and state manager with room information
     * @param {Object} data - Room data
     * @param {string} data.roomId - Room ID
     * @param {string} data.roomCode - Room code
     * @param {Array} data.players - Array of players
     * @param {Object} [data.room] - Room information
     * @param {Object} [data.gameState] - Current game state
     * @param {string} playerId - Current player ID
     */
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

    /**
     * Handle player joined event from server
     * Updates player list and room state
     * @param {Object} data - Player joined data
     * @param {Object} data.player - Player information
     * @param {string} data.player.id - Player ID
     * @param {string} data.player.name - Player name
     */
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

    /**
     * Handle player left event from server
     * Removes player from state and shows notification
     * @param {Object} data - Player left data
     * @param {string} data.playerId - ID of player who left
     * @param {string} data.playerName - Name of player who left
     * @param {boolean} data.isDisconnected - Whether player disconnected or left voluntarily
     */
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

    /**
     * Update room state and show notification
     * @param {Object} updates - Room state updates
     * @param {string|null} notification - Notification message to show
     */
    updateRoom(updates, notification) {
        this.stateManager.updateRoomState(updates);
        if (notification && this.debugMode) {
            this.stateManager.addNotification({ type: 'info', message: notification, duration: 3000 });
        }
    }

    /**
     * Update game state and configure UI based on player role
     * @param {Object} updates - Game state updates
     * @param {string} clueGiverId - ID of the clue giver
     */
    updateGame(updates, clueGiverId) {
        this.stateManager.updateGameState(updates);
        const isClueGiver = clueGiverId === this.playerId;
        this.stateManager.showTargetCoordinate(isClueGiver);
        this.stateManager.enableSpectrumInteraction(!isClueGiver);
    }

    /**
     * Update player's guess status and show notification
     * @param {string} playerId - ID of player who guessed
     * @param {boolean} hasGuessed - Whether player has guessed
     */
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

    /**
     * Handle round start event from server
     * Updates game state for new round and configures UI based on player role
     * @param {Object} data - Round start data
     * @param {Object} data.spectrumX - X-axis spectrum labels
     * @param {Object} data.spectrumY - Y-axis spectrum labels
     * @param {number} data.roundNumber - Current round number
     * @param {number} data.totalRounds - Total number of rounds
     * @param {string} data.clueGiverId - ID of the clue giver
     * @param {Object} [data.targetCoordinate] - Target coordinate (only sent to clue giver)
     * @param {number} data.duration - Round duration in seconds
     */
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
            timeRemaining: data.duration || GAME_RULES.ROUND_DURATION,
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

    /**
     * Handle round end event from server
     * Updates game state with round results and shows bonus notification if applicable
     * @param {Object} data - Round end data
     * @param {Object} data.targetCoordinate - Target coordinate
     * @param {Object} data.guesses - Player guesses
     * @param {Object} data.roundScores - Scores for this round
     * @param {Object} data.totalScores - Total scores
     * @param {boolean} data.bonusAwarded - Whether bonus was awarded
     */
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

    /**
     * Handle game finished event from server
     * Updates game state with final results and shows winner notification
     * @param {Object} data - Game finished data
     * @param {Object} data.finalScores - Final scores for all players
     * @param {string} data.winner - ID of the winning player
     * @param {Object} data.gameStats - Game statistics
     */
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

    /**
     * Handle socket error events
     * Updates UI state and shows error notification
     * @param {Object} error - Error object
     * @param {string} [error.code] - Error code
     * @param {string} [error.message] - Error message
     */
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

    /**
     * Get player name by ID
     * @param {string} playerId - Player ID
     * @returns {string} Player name or 'Unknown' if not found
     */
    getPlayerName(playerId) {
        return this.stateManager.getPlayer(playerId)?.name || 'Unknown';
    }

    /**
     * Validate player name
     * @param {string} name - Player name to validate
     * @returns {boolean} Whether the name is valid
     */
    validatePlayerName(name) {
        return Validator.playerName(name).valid;
    }

    /**
     * Validate clue text
     * @param {string} clue - Clue text to validate
     * @returns {boolean} Whether the clue is valid
     */
    validateClue(clue) {
        return Validator.clue(clue).valid;
    }

    /**
     * Handle errors in the GameClient
     * Converts errors to GameError format and shows notification
     * @param {Error|GameError} error - Error to handle
     */
    handleError(error) {
        console.error('GameClient error:', error);
        this.stateManager.setLoading(false);
        
        // Convert to GameError if it's not already
        const gameError = error instanceof GameError ? error : convertToGameError(error);
        
        if (this.debugMode) {
            this.stateManager.addNotification({
                type: 'error',
                message: gameError.message,
                duration: UI.NOTIFICATION_DURATION
            });
        }
    }

    /**
     * Reset client state
     * Clears room and player IDs and resets game state
     */
    resetClient() {
        this.currentRoomId = null;
        this.playerId = null;
        this.stateManager.resetGameState();
        this.stateManager.setCurrentView('lobby');
    }

    /**
     * Get current game state
     * @returns {Object} Current game state
     */
    getGameState = () => this.stateManager.getGameState();
    
    /**
     * Get all players
     * @returns {Object} Map of player IDs to player objects
     */
    getPlayers = () => this.stateManager.getPlayers();
    
    /**
     * Check if current player is the clue giver
     * @returns {boolean} Whether current player is the clue giver
     */
    isClueGiver = () => this.stateManager.getGameState().clueGiverId === this.playerId;
    
    /**
     * Check if current player has submitted a guess
     * @returns {boolean} Whether current player has guessed
     */
    hasGuessed = () => this.stateManager.getPlayers()[this.playerId]?.hasGuessed || false;

    /**
     * Clean up resources and reset state
     * Removes event listeners and resets client state
     */
    destroy() {
        this.socketClient.removeAllListeners();
        this.stateManager.removeAllListeners();
        this.resetClient();
        this.isInitialized = false;
        this.isSubmitting = false;
        console.log('🧹 GameClient destroyed');
    }
}