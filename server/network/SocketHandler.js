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
        Object.assign(this, { io, roomManager, gameManager });
        this.connectedPlayers = new Map();
        this.socketPlayers = new Map();
        this.debugMode = true;
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
            'room:create': 'CreateRoom',
            'room:join': 'JoinRoom',
            'game:start': 'StartGame',
            'game:submit-clue': 'SubmitClue',
            'game:submit-guess': 'SubmitGuess',
            'chat:send': 'ChatMessage',
            'player:disconnect': 'PlayerLeave',
            'ping': (s, ts) => s.emit('pong', ts),
            'game:request-state': 'StateRequest'
        };
        
        Object.entries(handlers).forEach(([event, handler]) => {
            socket.on(event, typeof handler === 'string' 
                ? data => this[`handle${handler}`](socket, data) 
                : data => handler(socket, data));
        });
        
        socket.on('disconnect', reason => this.handleDisconnection(socket, reason));
    }

    async handleCreateRoom(socket, { playerName, settings = {} }) {
        try {
            console.log(`🏠 Creating room for ${playerName}`);
            this.validatePlayerName(playerName);
            
            const playerId = this.generatePlayerId();
            const result = this.roomManager.createRoom(playerId, playerName, settings);
            const room = this.roomManager.getRoomByCode(result.code);
            room.io = this.io;
            
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
            room.io = this.io;
            
            socket.join(room.id);
            this.trackPlayer(socket, playerId, playerName, roomCode, room.id);
            
            socket.emit('room:joined', {
                roomId: room.id,
                roomCode,
                playerId,
                players: roomInfo.players,
                room: roomInfo,
                gameState: roomInfo.gameState
            });
            
            socket.to(room.id).emit('room:player-joined', {
                player: roomInfo.players.find(p => p.id === playerId)
            });
            
            console.log(`✅ ${playerName} joined room ${roomCode} successfully`);
        } catch (error) {
            this.handleError(socket, 'ROOM_JOIN_FAILED', error);
        }
    }

    async handleStartGame(socket) {
        try {
            const { room, playerId } = this.getPlayerRoom(socket);
            room.socketHandler = this;
            
            const player = room.players.get(playerId);
            if (!player?.isHost) throw new Error('Only the host can start the game');
            if (!this.gameManager.canStartGame(room)) throw new Error('Not enough players to start game');
            
            console.log(`🎯 Starting game in room ${room.code}`);
            room.phase = 'active';
            const roundData = this.gameManager.startRound(room);
            
            room.players.forEach((player, pid) => {
                const playerSocket = this.getPlayerSocket(pid);
                if (playerSocket) {
                    const isClueGiver = pid === room.clueGiverId;
                    playerSocket.emit('game:round-start', {
                        ...roundData,
                        targetCoordinate: isClueGiver ? room.targetCoordinate : null
                    });
                }
            });
            
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
                    spectrumX: room.spectrumX,      // Updated for 2D
                    spectrumY: room.spectrumY,      // Updated for 2D
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
        if (playerId) this.removePlayer(playerId, socket);
    }

    handleDisconnection(socket, reason) {
        console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
        const playerId = this.socketPlayers.get(socket.id);
        
        if (playerId) {
            const playerData = this.connectedPlayers.get(playerId);
            if (playerData) {
                this.roomManager.updatePlayerConnection(playerId, false);
                const room = this.roomManager.getRoomByCode(playerData.roomCode);
                if (room) {
                    this.io.to(room.id).emit('room:player-left', {
                        playerId,
                        playerName: playerData.playerName,
                        isDisconnected: true
                    });
                }
            }
            this.connectedPlayers.delete(playerId);
            this.socketPlayers.delete(socket.id);
        }
    }

    removePlayer(playerId, socket) {
        const playerData = this.connectedPlayers.get(playerId);
        if (playerData) {
            try {
                const result = this.roomManager.leaveRoom(playerId);
                console.log(`🚪 Player ${playerData.playerName} left room ${playerData.roomCode}`);
                socket.leave(playerData.roomId);
                
                if (!result.roomDeleted) {
                    this.io.to(playerData.roomId).emit('room:player-left', {
                        playerId,
                        playerName: playerData.playerName
                    });
                    
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
        this.connectedPlayers.delete(playerId);
        this.socketPlayers.delete(socket.id);
    }

    calculateTimeRemaining(room) {
        if (!room.roundStartTime) return 0;
        const remaining = Math.max(0, this.gameManager.ROUND_DURATION * 1000 - (Date.now() - room.roundStartTime));
        return Math.ceil(remaining / 1000);
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

    generatePlayerId() {
        return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

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
        const trimmed = message.trim();
        if (trimmed.length > 200) throw new Error('Message must be 200 characters or less');
    }

    handleError(socket, code, error) {
        console.error(`❌ ${code}:`, error);
        socket.emit('error', { code, message: error.message });
    }

    broadcastRoundEnd(room, results) {
        console.log(`📊 Broadcasting round end for room ${room.code}`);
        this.io.to(room.id).emit('game:round-end', results);
    }

    broadcastGameEnd(room, results) {
        console.log(`🎉 Broadcasting game end for room ${room.code}`);
        this.io.to(room.id).emit('game:finished', results);
    }

    broadcastTimerUpdate(room, timeRemaining) {
        if (timeRemaining % 5 === 0 || timeRemaining <= 10 || timeRemaining === 30) {
            if (this.debugMode && timeRemaining <= 10) {
                console.log(`⏰ Timer update for room ${room.code}: ${timeRemaining}s`);
            }
            this.io.to(room.id).emit('timer:update', { timeRemaining, phase: room.phase });
        }
    }

    getConnectedPlayerCount() { return this.connectedPlayers.size; }
    
    getConnectionStats() {
        return {
            connectedPlayers: this.connectedPlayers.size,
            activeSockets: this.io.sockets.sockets.size,
            rooms: this.roomManager.getActiveRoomCount()
        };
    }

    logError(error, context, metadata = {}) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            context,
            error: { message: error.message, code: error.code, stack: error.stack },
            metadata
        };
        console.error('🚨 Error Log:', JSON.stringify(errorLog, null, 2));
    }

    broadcast(event, data) { this.io.emit(event, data); }
    broadcastToRoom(roomId, event, data) { this.io.to(roomId).emit(event, data); }

    cleanup() {
        this.connectedPlayers.clear();
        this.socketPlayers.clear();
        console.log('🧹 SocketHandler cleaned up');
    }
}

module.exports = { SocketHandler };