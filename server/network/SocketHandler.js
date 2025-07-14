/**
 * ===================================
 * SPECTRUM GAME - SOCKET HANDLER
 * ===================================
 * 
 * Socket handler that:
 * - Manages WebSocket connections
 * - Routes socket events to appropriate handlers
 * - Handles player authentication and validation
 * - Manages real-time game communication
 * 
 * FIXED: Better timer handling and debugging
 * ================================= */

/**
 * SocketHandler Class
 * Handles all Socket.io communication and event routing
 */
class SocketHandler {
    constructor(io, roomManager, gameManager) {
        this.io = io;
        this.roomManager = roomManager;
        this.gameManager = gameManager;
        
        // Connected players tracking
        this.connectedPlayers = new Map();
        
        // Socket to player mapping
        this.socketPlayers = new Map();
        
        // Debug mode
        this.debugMode = true;
        
        console.log('🔌 SocketHandler initialized');
    }

    /**
     * Initialize socket event handlers
     */
    init() {
        this.io.on('connection', (socket) => {
            console.log(`🔌 New connection: ${socket.id}`);
            
            // Set up event handlers for this socket
            this.setupSocketEventHandlers(socket);
        });
    }

    /**
     * Set up event handlers for a socket
     */
    setupSocketEventHandlers(socket) {
        // Room management events
        socket.on('room:create', (data) => this.handleCreateRoom(socket, data));
        socket.on('room:join', (data) => this.handleJoinRoom(socket, data));
        
        // Game events
        socket.on('game:start', (data) => this.handleStartGame(socket, data));
        socket.on('game:submit-clue', (data) => this.handleSubmitClue(socket, data));
        socket.on('game:submit-guess', (data) => this.handleSubmitGuess(socket, data));
        
        // Chat events
        socket.on('chat:send', (data) => this.handleChatMessage(socket, data));
        
        // Connection events
        socket.on('player:disconnect', (data) => this.handlePlayerLeave(socket, data));
        socket.on('disconnect', (reason) => this.handleDisconnection(socket, reason));
        
        // Utility events
        socket.on('ping', (timestamp) => socket.emit('pong', timestamp));
    }

    /**
     * Handle room creation
     */
    async handleCreateRoom(socket, data) {
        try {
            console.log(`🏠 Creating room for ${data.playerName}`);
            
            // Validate input
            this.validatePlayerName(data.playerName);
            
            // Generate player ID
            const playerId = this.generatePlayerId();
            
            // Create room
            const result = this.roomManager.createRoom(playerId, data.playerName, data.settings);
            
            // Get room reference
            const room = this.roomManager.getRoomByCode(result.code);
            room.io = this.io; // Set io reference for the room
            
            // Join socket to room
            socket.join(room.id);
            
            // Track player connection
            this.connectedPlayers.set(playerId, {
                socketId: socket.id,
                playerId,
                playerName: data.playerName,
                roomCode: result.code,
                roomId: room.id,
                connectedAt: Date.now()
            });
            
            this.socketPlayers.set(socket.id, playerId);
            
            // Send success response
            socket.emit('room:created', {
                roomId: room.id,
                roomCode: result.code,
                playerId: playerId,
                players: this.roomManager.getRoomPlayers(result.code),
                room: this.roomManager.getRoomInfo(result.code)  // This should include canStart
            });
                        
            console.log(`✅ Room ${result.code} created successfully`);
            
        } catch (error) {
            console.error('❌ Error creating room:', error);
            socket.emit('error', {
                code: 'ROOM_CREATE_FAILED',
                message: error.message
            });
        }
    }

    /**
     * Handle room joining
     */
    async handleJoinRoom(socket, data) {
        try {
            console.log(`🚪 ${data.playerName} joining room ${data.roomCode}`);
            
            // Validate input
            this.validatePlayerName(data.playerName);
            this.validateRoomCode(data.roomCode);
            
            // Generate player ID
            const playerId = this.generatePlayerId();
            
            // Join room
            const roomInfo = this.roomManager.joinRoom(data.roomCode, playerId, data.playerName);
            
            // Get room reference
            const room = this.roomManager.getRoomByCode(data.roomCode);
            room.io = this.io; // Set io reference for the room
            
            // Join socket to room
            socket.join(room.id);
            
            // Track player connection
            this.connectedPlayers.set(playerId, {
                socketId: socket.id,
                playerId,
                playerName: data.playerName,
                roomCode: data.roomCode,
                roomId: room.id,
                connectedAt: Date.now()
            });
            
            this.socketPlayers.set(socket.id, playerId);
            
            // Send success response to joining player
            socket.emit('room:joined', {
                roomId: room.id,
                roomCode: data.roomCode,
                playerId: playerId,
                players: roomInfo.players,
                room: roomInfo,  // This already uses getRoomInfo
                gameState: roomInfo.gameState
            });
            
            // Notify other players in room
            socket.to(room.id).emit('room:player-joined', {
                player: roomInfo.players.find(p => p.id === playerId)
            });
            
            console.log(`✅ ${data.playerName} joined room ${data.roomCode} successfully`);
            
        } catch (error) {
            console.error('❌ Error joining room:', error);
            socket.emit('error', {
                code: 'ROOM_JOIN_FAILED',
                message: error.message
            });
        }
    }

    /**
     * Handle game start
     */
    async handleStartGame(socket, data) {
        try {
            const playerId = this.socketPlayers.get(socket.id);
            
            if (!playerId) {
                throw new Error('Player not found');
            }
            
            const roomCode = this.connectedPlayers.get(playerId)?.roomCode;
            const room = this.roomManager.getRoomByCode(roomCode);
            
            if (!room) {
                throw new Error('Room not found');
            }
            
            // Validate player is host
            const player = room.players.get(playerId);
            if (!player || !player.isHost) {
                throw new Error('Only the host can start the game');
            }
            
            // Validate game can start
            if (!this.gameManager.canStartGame(room)) {
                throw new Error('Not enough players to start game');
            }
            
            console.log(`🎯 Starting game in room ${room.code}`);
            
            // Set room phase to active
            room.phase = 'active';
            
            // Start first round
            const roundData = this.gameManager.startRound(room);
            
            console.log(`🎯 Starting round ${roundData.roundNumber} for room ${room.code}`);
            console.log(`🎯 Clue giver: ${room.clueGiverId}, Target position: ${room.targetPosition}`);
            
            // Send role-specific round start events to each player
            room.players.forEach((player, playerId) => {
                const playerSocket = this.getPlayerSocket(playerId);
                if (playerSocket) {
                    const isClueGiver = playerId === room.clueGiverId;
                    
                    // Prepare event data based on player role
                    const eventData = {
                        roundNumber: roundData.roundNumber,
                        clueGiverId: roundData.clueGiverId,
                        spectrum: roundData.spectrum,
                        duration: roundData.duration
                    };
                    
                    // Only include target position for the clue giver
                    if (isClueGiver) {
                        eventData.targetPosition = room.targetPosition;
                        console.log(`🎯 Sending round-start with target ${room.targetPosition} to clue giver ${playerId}`);
                    } else {
                        console.log(`🎲 Sending round-start without target to guesser ${playerId}`);
                    }
                    
                    playerSocket.emit('game:round-start', eventData);
                } else {
                    console.warn(`⚠️ Could not find socket for player ${playerId}`);
                }
            });
            
            console.log(`✅ Game started in room ${room.code}`);
            
        } catch (error) {
            console.error('❌ Error starting game:', error);
            socket.emit('error', {
                code: 'GAME_START_FAILED',
                message: error.message
            });
        }
    }

    /**
     * Handle clue submission
     */
    async handleSubmitClue(socket, data) {
        try {
            const playerId = this.socketPlayers.get(socket.id);
            
            if (!playerId) {
                throw new Error('Player not found');
            }
            
            const roomCode = this.connectedPlayers.get(playerId)?.roomCode;
            const room = this.roomManager.getRoomByCode(roomCode);
            
            if (!room) {
                throw new Error('Room not found');
            }
            
            console.log(`💡 Clue submitted in room ${room.code}: "${data.clue}"`);
            
            // Submit clue through game manager
            const result = this.gameManager.submitClue(room, playerId, data.clue);
            
            // Broadcast clue to all players
            this.io.to(room.id).emit('game:clue-submitted', result);
            
            console.log(`✅ Clue submitted successfully in room ${room.code}`);
            
        } catch (error) {
            console.error('❌ Error submitting clue:', error);
            socket.emit('error', {
                code: 'CLUE_SUBMIT_FAILED',
                message: error.message
            });
        }
    }

    /**
     * Handle guess submission
     */
    async handleSubmitGuess(socket, data) {
        try {
            const playerId = this.socketPlayers.get(socket.id);
            
            if (!playerId) {
                throw new Error('Player not found');
            }
            
            const roomCode = this.connectedPlayers.get(playerId)?.roomCode;
            const room = this.roomManager.getRoomByCode(roomCode);
            
            if (!room) {
                throw new Error('Room not found');
            }
            
            console.log(`🎯 Guess submitted in room ${room.code}: ${data.position}`);
            
            // Submit guess through game manager
            const result = this.gameManager.submitGuess(room, playerId, data.position);
            
            // Broadcast guess submission (without revealing position)
            this.io.to(room.id).emit('game:guess-submitted', result);
            
            console.log(`✅ Guess submitted successfully in room ${room.code}`);
            
        } catch (error) {
            console.error('❌ Error submitting guess:', error);
            socket.emit('error', {
                code: 'GUESS_SUBMIT_FAILED',
                message: error.message
            });
        }
    }

    /**
     * Handle chat message
     */
    async handleChatMessage(socket, data) {
        try {
            const playerId = this.socketPlayers.get(socket.id);
            
            if (!playerId) {
                throw new Error('Player not found');
            }
            
            const roomCode = this.connectedPlayers.get(playerId)?.roomCode;
            const room = this.roomManager.getRoomByCode(roomCode);
            
            if (!room) {
                throw new Error('Room not found');
            }
            
            const player = room.players.get(playerId);
            
            if (!player) {
                throw new Error('Player not in room');
            }
            
            // Validate message
            this.validateChatMessage(data.message);
            
            console.log(`💬 Chat message in room ${room.code}: ${player.name}: ${data.message}`);
            
            // Broadcast message to all players in room
            this.io.to(room.id).emit('chat:message', {
                playerId,
                playerName: player.name,
                message: data.message,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ Error sending chat message:', error);
            socket.emit('error', {
                code: 'CHAT_SEND_FAILED',
                message: error.message
            });
        }
    }

    /**
     * Handle player leave
     */
    async handlePlayerLeave(socket, data) {
        const playerId = this.socketPlayers.get(socket.id);
        
        if (playerId) {
            this.removePlayer(playerId, socket);
        }
    }

    /**
     * Handle socket disconnection
     */
    handleDisconnection(socket, reason) {
        console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
        
        const playerId = this.socketPlayers.get(socket.id);
        
        if (playerId) {
            const playerData = this.connectedPlayers.get(playerId);
            
            if (playerData) {
                // Update player connection status
                this.roomManager.updatePlayerConnection(playerId, false);
                
                // Notify other players
                const room = this.roomManager.getRoomByCode(playerData.roomCode);
                if (room) {
                    this.io.to(room.id).emit('room:player-left', {
                        playerId: playerId,
                        playerName: playerData.playerName,
                        isDisconnected: true
                    });
                }
            }
            
            // Clean up tracking
            this.connectedPlayers.delete(playerId);
            this.socketPlayers.delete(socket.id);
        }
    }

    /**
     * Remove player from room
     */
    removePlayer(playerId, socket) {
        const playerData = this.connectedPlayers.get(playerId);
        
        if (playerData) {
            try {
                const result = this.roomManager.leaveRoom(playerId);
                
                console.log(`🚪 Player ${playerData.playerName} left room ${playerData.roomCode}`);
                
                // Leave socket room
                socket.leave(playerData.roomId);
                
                // Notify other players if room still exists
                if (!result.roomDeleted) {
                    this.io.to(playerData.roomId).emit('room:player-left', {
                        playerId: playerId,
                        playerName: playerData.playerName
                    });
                    
                    // If host changed, notify about new host
                    if (result.newHost) {
                        this.io.to(playerData.roomId).emit('room:host-changed', {
                            newHostId: result.newHost.id,
                            newHostName: result.newHost.name
                        });
                    }
                }
            } catch (error) {
                console.error('❌ Error removing player:', error);
            }
        }
        
        // Clean up tracking
        this.connectedPlayers.delete(playerId);
        this.socketPlayers.delete(socket.id);
    }

    /**
     * Get socket for a player
     */
    getPlayerSocket(playerId) {
        const playerData = this.connectedPlayers.get(playerId);
        
        if (playerData) {
            return this.io.sockets.sockets.get(playerData.socketId);
        }
        
        return null;
    }

    /**
     * Generate unique player ID
     */
    generatePlayerId() {
        return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validate player name
     */
    validatePlayerName(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Player name is required');
        }
        
        const trimmed = name.trim();
        
        if (trimmed.length === 0) {
            throw new Error('Player name cannot be empty');
        }
        
        if (trimmed.length > 20) {
            throw new Error('Player name must be 20 characters or less');
        }
        
        // Check for forbidden characters
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
            throw new Error('Player name contains invalid characters');
        }
    }

    /**
     * Validate room code
     */
    validateRoomCode(code) {
        if (!code || typeof code !== 'string') {
            throw new Error('Room code is required');
        }
        
        const trimmed = code.trim().toUpperCase();
        
        if (!/^[A-Z0-9]{4,6}$/.test(trimmed)) {
            throw new Error('Invalid room code format');
        }
    }

    /**
     * Validate chat message
     */
    validateChatMessage(message) {
        if (!message || typeof message !== 'string') {
            throw new Error('Message is required');
        }
        
        const trimmed = message.trim();
        
        if (trimmed.length === 0) {
            throw new Error('Message cannot be empty');
        }
        
        if (trimmed.length > 200) {
            throw new Error('Message must be 200 characters or less');
        }
    }

    /**
     * Broadcast round end results
     */
    broadcastRoundEnd(room, results) {
        console.log(`📊 Broadcasting round end for room ${room.code}`);
        this.io.to(room.id).emit('game:round-end', results);
    }

    /**
     * Broadcast game end results
     */
    broadcastGameEnd(room, results) {
        console.log(`🎉 Broadcasting game end for room ${room.code}`);
        this.io.to(room.id).emit('game:finished', results);
    }

    /**
     * Broadcast timer updates - FIXED: Reduced frequency
     */
    broadcastTimerUpdate(room, timeRemaining) {
        // Only broadcast at specific intervals to reduce noise
        const shouldBroadcast = 
            timeRemaining % 5 === 0 || // Every 5 seconds
            timeRemaining <= 10 || // Last 10 seconds
            timeRemaining === 30; // 30 second warning
        
        if (shouldBroadcast) {
            if (this.debugMode && timeRemaining <= 10) {
                console.log(`⏰ Timer update for room ${room.code}: ${timeRemaining}s`);
            }
            
            this.io.to(room.id).emit('timer:update', {
                timeRemaining,
                phase: room.phase
            });
        }
    }

    /**
     * Get connected player count
     */
    getConnectedPlayerCount() {
        return this.connectedPlayers.size;
    }

    /**
     * Get connection statistics
     */
    getConnectionStats() {
        return {
            connectedPlayers: this.connectedPlayers.size,
            activeSockets: this.io.sockets.sockets.size,
            rooms: this.roomManager.getActiveRoomCount()
        };
    }

    /**
     * Broadcast to all connected clients
     */
    broadcast(event, data) {
        this.io.emit(event, data);
    }

    /**
     * Broadcast to specific room
     */
    broadcastToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear all tracking
        this.connectedPlayers.clear();
        this.socketPlayers.clear();
        
        console.log('🧹 SocketHandler cleaned up');
    }
}

module.exports = { SocketHandler };