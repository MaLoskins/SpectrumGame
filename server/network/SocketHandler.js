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
 * UPDATED: Support for 2D coordinate system
 * ================================= */

class SocketHandler {
    constructor(io, roomManager, gameManager) {
        Object.assign(this, { 
            io, 
            roomManager, 
            gameManager,
            connectedPlayers: new Map(),
            socketPlayers: new Map(),
            debugMode: true
        });
        console.log('🔌 SocketHandler initialized');
    }

    init() {
        this.io.on('connection', socket => {
            console.log(`🔌 New connection: ${socket.id}`);
            this.setupSocketEventHandlers(socket);
        });
    }

    setupSocketEventHandlers(socket) {
        const handlers = {
            'room:create': data => this.handleCreateRoom(socket, data),
            'room:join': data => this.handleJoinRoom(socket, data),
            'game:start': data => this.handleStartGame(socket, data),
            'game:submit-clue': data => this.handleSubmitClue(socket, data),
            'game:submit-guess': data => this.handleSubmitGuess(socket, data),
            'chat:send': data => this.handleChatMessage(socket, data),
            'player:disconnect': data => this.handlePlayerLeave(socket, data),
            'ping': ts => socket.emit('pong', ts),
            'game:request-state': data => this.handleStateRequest(socket, data)
        };
        
        Object.entries(handlers).forEach(([event, handler]) => 
            socket.on(event, handler));
        
        socket.on('disconnect', reason => this.handleDisconnection(socket, reason));
    }

    async handleCreateRoom(socket, { playerName, settings = {} }) {
        try {
            console.log(`🏠 Creating room for ${playerName}`);
            this.validatePlayerName(playerName);
            
            const playerId = this.generatePlayerId();
            const result = this.roomManager.createRoom(playerId, playerName, settings);
            const room = this.roomManager.getRoomByCode(result.code); // Get actual room object
            this.setupRoom(room, this.io);
            
            socket.join(room.id);
            this.trackPlayer(socket, playerId, playerName, result.code, room.id);
            
            socket.emit('room:created', {
                roomId: room.id,
                roomCode: result.code,
                playerId,
                players: this.roomManager.getRoomPlayers(result.code),
                room: this.roomManager.getRoomInfo(result.code)
            });
            
            console.log(`✅ Room ${result.code} created successfully`);
        } catch (error) {
            this.handleError(socket, 'ROOM_CREATE_FAILED', error);
        }
    }

    async handleJoinRoom(socket, { playerName, roomCode }) {
        try {
            console.log(`🚪 ${playerName} joining room ${roomCode}`);
            this.validatePlayerName(playerName);
            this.validateRoomCode(roomCode);
            
            const playerId = this.generatePlayerId();
            const roomInfo = this.roomManager.joinRoom(roomCode, playerId, playerName);
            const room = this.roomManager.getRoomByCode(roomCode);
            this.setupRoom(room, this.io);
            
            socket.join(room.id);
            this.trackPlayer(socket, playerId, playerName, roomCode, room.id);
            
            // Send joined confirmation to the joining player
            socket.emit('room:joined', {
                roomId: room.id,
                roomCode,
                playerId,
                players: roomInfo.players,
                room: roomInfo,
                gameState: roomInfo.gameState
            });
            
            // Broadcast to all OTHER clients in the room (including the host)
            socket.to(room.id).emit('room:player-joined', {
                player: roomInfo.players.find(p => p.id === playerId)
            });
            
            console.log(`✅ ${playerName} joined room ${roomCode} successfully`);
            console.log(`📢 Broadcasting player-joined to room ${room.id}`);
        } catch (error) {
            this.handleError(socket, 'ROOM_JOIN_FAILED', error);
        }
    }

    async handleStartGame(socket) {
        try {
            const { room, playerId } = this.getPlayerRoom(socket);
            this.setupRoom(room, this);
            
            const player = room.players.get(playerId);
            if (!player?.isHost) throw new Error('Only the host can start the game');
            if (!this.gameManager.canStartGame(room)) throw new Error('Not enough players to start game');
            
            console.log(`🎯 Starting game in room ${room.code}`);
            room.phase = 'active';
            const roundData = this.gameManager.startRound(room);
            
            this.broadcastRoundStart(room, roundData);
            console.log(`✅ Game started in room ${room.code}`);
        } catch (error) {
            this.handleError(socket, 'GAME_START_FAILED', error);
        }
    }

    handleStateRequest(socket) {
        try {
            const { room, playerId } = this.getPlayerRoom(socket);
            const roomInfo = this.roomManager.getRoomInfo(room.code);
            
            socket.emit('game:state-update', {
                gameState: {
                    phase: room.phase,
                    currentRound: room.currentRound,
                    totalRounds: room.totalRounds || 10,
                    clueGiverId: room.clueGiverId,
                    spectrumX: room.spectrumX,
                    spectrumY: room.spectrumY,
                    clue: room.clue,
                    timeRemaining: this.calculateTimeRemaining(room),
                    targetCoordinate: playerId === room.clueGiverId ? room.targetCoordinate : null
                },
                roomInfo,
                players: roomInfo.players,
                playerId
            });
            
            console.log(`📤 Sent state update to player ${playerId}`);
        } catch (error) {
            this.handleError(socket, 'STATE_REQUEST_FAILED', error);
        }
    }

    async handleSubmitClue(socket, { clue }) {
        try {
            const { room, playerId } = this.getPlayerRoom(socket);
            console.log(`💡 Clue submitted in room ${room.code}: "${clue}"`);
            
            const result = this.gameManager.submitClue(room, playerId, clue);
            this.io.to(room.id).emit('game:clue-submitted', result);
            
            console.log(`✅ Clue submitted successfully in room ${room.code}`);
        } catch (error) {
            this.handleError(socket, 'CLUE_SUBMIT_FAILED', error);
        }
    }

    async handleSubmitGuess(socket, { coordinate }) {
        try {
            const { room, playerId } = this.getPlayerRoom(socket);
            console.log(`🎯 Guess submitted in room ${room.code}: (${coordinate.x}, ${coordinate.y})`);
            
            const result = this.gameManager.submitGuess(room, playerId, coordinate);
            this.io.to(room.id).emit('game:guess-submitted', result);
            
            console.log(`✅ Guess submitted successfully in room ${room.code}`);
        } catch (error) {
            this.handleError(socket, 'GUESS_SUBMIT_FAILED', error);
        }
    }

    async handleChatMessage(socket, { message }) {
        try {
            const { room, playerId } = this.getPlayerRoom(socket);
            const player = room.players.get(playerId);
            if (!player) throw new Error('Player not in room');
            
            this.validateChatMessage(message);
            console.log(`💬 Chat message in room ${room.code}: ${player.name}: ${message}`);
            
            this.io.to(room.id).emit('chat:message', {
                playerId,
                playerName: player.name,
                message: message.trim(),
                timestamp: Date.now()
            });
        } catch (error) {
            this.handleError(socket, 'CHAT_SEND_FAILED', error);
        }
    }

    async handlePlayerLeave(socket) {
        const playerId = this.socketPlayers.get(socket.id);
        playerId && this.removePlayer(playerId, socket);
    }

    handleDisconnection(socket, reason) {
        console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
        const playerId = this.socketPlayers.get(socket.id);
        
        if (playerId) {
            const playerData = this.connectedPlayers.get(playerId);
            if (playerData) {
                this.roomManager.updatePlayerConnection(playerId, false);
                const room = this.roomManager.getRoomByCode(playerData.roomCode);
                room && this.io.to(room.id).emit('room:player-left', {
                    playerId,
                    playerName: playerData.playerName,
                    isDisconnected: true
                });
            }
            this.connectedPlayers.delete(playerId);
            this.socketPlayers.delete(socket.id);
        }
    }

    removePlayer(playerId, socket) {
        const playerData = this.connectedPlayers.get(playerId);
        if (!playerData) return;
        
        try {
            const result = this.roomManager.leaveRoom(playerId);
            console.log(`🚪 Player ${playerData.playerName} left room ${playerData.roomCode}`);
            socket.leave(playerData.roomId);
            
            if (!result.roomDeleted) {
                this.io.to(playerData.roomId).emit('room:player-left', {
                    playerId,
                    playerName: playerData.playerName
                });
                
                result.newHost && this.io.to(playerData.roomId).emit('room:host-changed', {
                    newHostId: result.newHost.id,
                    newHostName: result.newHost.name
                });
            }
        } catch (error) {
            console.error('❌ Error removing player:', error);
        }
        
        this.connectedPlayers.delete(playerId);
        this.socketPlayers.delete(socket.id);
    }

    // Helper methods
    setupRoom(room, handler) {
        room.io = this.io;
        room.socketHandler = handler;
    }

    broadcastRoundStart(room, roundData) {
        room.players.forEach((player, pid) => {
            const playerSocket = this.getPlayerSocket(pid);
            playerSocket?.emit('game:round-start', {
                ...roundData,
                targetCoordinate: pid === room.clueGiverId ? room.targetCoordinate : null
            });
        });
    }

    calculateTimeRemaining(room) {
        if (!room.roundStartTime) return 0;
        return Math.max(0, Math.ceil((this.gameManager.ROUND_DURATION * 1000 - (Date.now() - room.roundStartTime)) / 1000));
    }

    getPlayerSocket(playerId) {
        const playerData = this.connectedPlayers.get(playerId);
        return playerData ? this.io.sockets.sockets.get(playerData.socketId) : null;
    }

    getPlayerRoom(socket) {
        const playerId = this.socketPlayers.get(socket.id);
        if (!playerId) throw new Error('Player not found');
        
        const playerData = this.connectedPlayers.get(playerId);
        if (!playerData?.roomCode) throw new Error('Room not found');
        
        const room = this.roomManager.getRoomByCode(playerData.roomCode);
        if (!room) throw new Error('Room not found');
        
        return { room, playerId, playerData };
    }

    trackPlayer(socket, playerId, playerName, roomCode, roomId) {
        const playerData = { socketId: socket.id, playerId, playerName, roomCode, roomId, connectedAt: Date.now() };
        this.connectedPlayers.set(playerId, playerData);
        this.socketPlayers.set(socket.id, playerId);
    }

    generatePlayerId = () => `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validation methods
    validatePlayerName(name) {
        if (!name?.trim()) throw new Error('Player name is required');
        const trimmed = name.trim();
        if (trimmed.length > 20) throw new Error('Player name must be 20 characters or less');
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) throw new Error('Player name contains invalid characters');
    }

    validateRoomCode(code) {
        if (!code?.trim()) throw new Error('Room code is required');
        if (!/^[A-Z0-9]{4,6}$/.test(code.trim().toUpperCase())) throw new Error('Invalid room code format');
    }

    validateChatMessage(message) {
        if (!message?.trim()) throw new Error('Message cannot be empty');
        if (message.trim().length > 200) throw new Error('Message must be 200 characters or less');
    }

    handleError(socket, code, error) {
        console.error(`❌ ${code}:`, error);
        socket.emit('error', { code, message: error.message });
    }

    // Broadcast methods
    broadcastRoundEnd = (room, results) => this.io.to(room.id).emit('game:round-end', results);
    broadcastGameEnd = (room, results) => this.io.to(room.id).emit('game:finished', results);
    broadcastTimerUpdate = (room, timeRemaining) => 
        (timeRemaining % 5 === 0 || timeRemaining <= 10 || timeRemaining === 30) && 
        this.io.to(room.id).emit('timer:update', { timeRemaining, phase: room.phase });

    // Stats and utility
    getConnectedPlayerCount = () => this.connectedPlayers.size;
    getConnectionStats = () => ({
        connectedPlayers: this.connectedPlayers.size,
        activeSockets: this.io.sockets.sockets.size,
        rooms: this.roomManager.getActiveRoomCount()
    });

    broadcast = (event, data) => this.io.emit(event, data);
    broadcastToRoom = (roomId, event, data) => this.io.to(roomId).emit(event, data);

    cleanup() {
        this.connectedPlayers.clear();
        this.socketPlayers.clear();
        console.log('🧹 SocketHandler cleaned up');
    }
}

module.exports = { SocketHandler };