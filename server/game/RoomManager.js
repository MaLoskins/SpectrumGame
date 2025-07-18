/**
 * Room and player management for Spectrum
 * Handles room creation, player joining/leaving, and room lifecycle
 * UPDATED: Support for 2D coordinate system
 */

const crypto = require('crypto');

class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomCode -> Room object
        this.playerRooms = new Map(); // playerId -> roomCode
        this.MIN_PLAYERS = 2;
        this.MAX_PLAYERS = 4;
        this.ROOM_CODE_LENGTH = 6;
        this.ROOM_CLEANUP_INTERVAL = 300000; // 5 minutes
        this.ROOM_TIMEOUT = 1800000; // 30 minutes of inactivity

        // Start cleanup interval
        this.startCleanupInterval();
    }

    /**
     * Generate a unique room code
     * @returns {string} 6-character room code
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        
        do {
            code = '';
            for (let i = 0; i < this.ROOM_CODE_LENGTH; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (this.rooms.has(code));
        
        return code;
    }

    /**
     * Create a new room
     * @param {string} hostId - ID of the host player
     * @param {string} hostName - Name of the host player
     * @returns {Object} Room object with code and initial state
     */
    createRoom(hostId, hostName) {
        if (this.playerRooms.has(hostId)) {
            throw new Error('Player is already in a room');
        }

        const roomCode = this.generateRoomCode();
        const room = {
            code: roomCode,
            id: `room_${roomCode}`,
            hostId: hostId,
            players: new Map(),
            state: 'lobby',
            phase: 'lobby', // Game phase: lobby, waiting, playing, scoring, finished
            createdAt: Date.now(),
            lastActivity: Date.now(),
            settings: {
                maxPlayers: this.MAX_PLAYERS,
                roundDuration: 60000
            },
            
            // Game state - Updated for 2D
            currentRound: 0,
            clueGiverId: null,
            spectrumX: null,      // X-axis spectrum
            spectrumY: null,      // Y-axis spectrum
            targetCoordinate: null, // {x, y} instead of single position
            clue: null,
            guesses: new Map(),
            roundScores: new Map(),
            roundStartTime: null,
            usedSpectrums: [],
            
            // Socket.io reference (will be set by SocketHandler)
            io: null
        };
        // Add host as first player
        room.players.set(hostId, {
            id: hostId,
            name: hostName,
            isHost: true,
            isReady: true,  // Host is ready by default
            joinedAt: Date.now(),
            connected: true,
            score: 0
        });

        this.rooms.set(roomCode, room);
        this.playerRooms.set(hostId, roomCode);

        console.log(`🏠 Created room ${roomCode} with host ${hostName}`);

        return {
            code: roomCode,
            room: this.getRoomInfo(roomCode)
        };
    }

    /**
     * Join an existing room
     * @param {string} roomCode - Room code to join
     * @param {string} playerId - ID of the joining player
     * @param {string} playerName - Name of the joining player
     * @returns {Object} Room information
     */
    joinRoom(roomCode, playerId, playerName) {
        if (this.playerRooms.has(playerId)) {
            throw new Error('Player is already in a room');
        }

        const room = this.getRoomByCode(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }

        if (room.players.size >= this.MAX_PLAYERS) {
            throw new Error('Room is full');
        }

        if (room.phase !== 'lobby' && room.phase !== 'waiting') {
            throw new Error('Cannot join room - game in progress');
        }

        // Check for duplicate names
        const existingNames = Array.from(room.players.values()).map(p => p.name.toLowerCase());
        if (existingNames.includes(playerName.toLowerCase())) {
            throw new Error('Player name already taken in this room');
        }

        // Add player to room
        room.players.set(playerId, {
            id: playerId,
            name: playerName,
            isHost: false,
            isReady: true,
            joinedAt: Date.now(),
            connected: true,
            score: 0
        });

        this.playerRooms.set(playerId, roomCode);
        room.lastActivity = Date.now();

        console.log(`🚪 Player ${playerName} joined room ${roomCode}`);

        return this.getRoomInfo(roomCode);
    }

    /**
     * Leave a room
     * @param {string} playerId - ID of the leaving player
     * @returns {Object} Result of leaving room
     */
    leaveRoom(playerId) {
        const roomCode = this.playerRooms.get(playerId);
        if (!roomCode) {
            throw new Error('Player is not in a room');
        }

        const room = this.rooms.get(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }

        const player = room.players.get(playerId);
        if (!player) {
            throw new Error('Player not found in room');
        }

        const wasHost = player.isHost;
        const playerName = player.name;
        
        room.players.delete(playerId);
        this.playerRooms.delete(playerId);
        room.lastActivity = Date.now();

        console.log(`🚪 Player ${playerName} left room ${roomCode}`);

        // If room is empty, delete it
        if (room.players.size === 0) {
            this.rooms.delete(roomCode);
            return { roomDeleted: true, newHost: null };
        }

        // If host left, assign new host
        let newHost = null;
        if (wasHost) {
            const remainingPlayers = Array.from(room.players.values());
            newHost = remainingPlayers[0];
            newHost.isHost = true;
            room.hostId = newHost.id;
            console.log(`👑 Transferred host to ${newHost.name} in room ${roomCode}`);
        }

        return {
            roomDeleted: false,
            newHost: newHost,
            room: this.getRoomInfo(roomCode)
        };
    }

    /**
     * Set player ready status
     * @param {string} playerId - Player ID
     * @param {boolean} ready - Ready status
     * @returns {Object} Updated room info
     */
    setPlayerReady(playerId, ready) {
        const roomCode = this.playerRooms.get(playerId);
        if (!roomCode) {
            throw new Error('Player is not in a room');
        }

        const room = this.rooms.get(roomCode);
        const player = room.players.get(playerId);
        
        if (!player) {
            throw new Error('Player not found in room');
        }

        player.isReady = ready;
        room.lastActivity = Date.now();

        return this.getRoomInfo(roomCode);
    }

    /**
     * Check if all players are ready
     * @param {string} roomCode - Room code
     * @returns {boolean} True if all players are ready
     */
    areAllPlayersReady(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room || room.players.size < this.MIN_PLAYERS) {
            return false;
        }

        return Array.from(room.players.values()).every(player => player.isReady);
    }

    /**
     * Update player connection status
     * @param {string} playerId - Player ID
     * @param {boolean} connected - Connection status
     */
    updatePlayerConnection(playerId, connected) {
        const roomCode = this.playerRooms.get(playerId);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        const player = room?.players.get(playerId);
        
        if (player) {
            player.connected = connected;
            room.lastActivity = Date.now();
            
            if (!connected) {
                console.log(`🔌 Player ${player.name} disconnected from room ${roomCode}`);
            } else {
                console.log(`🔌 Player ${player.name} reconnected to room ${roomCode}`);
            }
        }
    }

    /**
     * Get room by code
     * @param {string} roomCode - Room code
     * @returns {Object} Room object or null
     */
    getRoomByCode(roomCode) {
        return this.rooms.get(roomCode.toUpperCase()) || null;
    }

    /**
     * Get room information
     * @param {string} roomCode - Room code
     * @returns {Object} Room information object
     */
    getRoomInfo(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return null;
        }

        return {
            code: room.code,
            hostId: room.hostId,
            state: room.state,
            phase: room.phase,
            players: Array.from(room.players.values()).map(player => ({
                id: player.id,
                name: player.name,
                isHost: player.isHost,
                isReady: player.isReady,
                connected: player.connected,
                score: player.score
            })),
            playerCount: room.players.size,
            maxPlayers: room.settings.maxPlayers,
            canStart: this.canStartGame(roomCode),
            createdAt: room.createdAt,
            settings: room.settings,
            gameState: {
                currentRound: room.currentRound,
                clueGiverId: room.clueGiverId,
                spectrumX: room.spectrumX,      // Updated for 2D
                spectrumY: room.spectrumY,      // Updated for 2D
                clue: room.clue,
                phase: room.phase
            }
        };
    }

    /**
     * Check if game can start
     * @param {string} roomCode - Room code
     * @returns {boolean} True if game can start
     */
    canStartGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return false;

        return room.phase === 'lobby' && 
               room.players.size >= this.MIN_PLAYERS && 
               this.areAllPlayersReady(roomCode);
    }

    /**
     * Update room state
     * @param {string} roomCode - Room code
     * @param {string} newState - New state
     */
    updateRoomState(roomCode, newState) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }

        room.state = newState;
        room.lastActivity = Date.now();
    }

    /**
     * Update room phase
     * @param {string} roomCode - Room code
     * @param {string} newPhase - New phase
     */
    updateRoomPhase(roomCode, newPhase) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            throw new Error('Room not found');
        }

        room.phase = newPhase;
        room.lastActivity = Date.now();
    }

    /**
     * Get player's current room
     * @param {string} playerId - Player ID
     * @returns {string|null} Room code or null
     */
    getPlayerRoom(playerId) {
        return this.playerRooms.get(playerId) || null;
    }

    /**
     * Get all players in a room
     * @param {string} roomCode - Room code
     * @returns {Array} Array of player objects
     */
    getRoomPlayers(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return [];

        return Array.from(room.players.values());
    }

    /**
     * Update player score
     * @param {string} playerId - Player ID
     * @param {number} score - New score
     */
    updatePlayerScore(playerId, score) {
        const roomCode = this.playerRooms.get(playerId);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        const player = room?.players.get(playerId);
        
        if (player) {
            player.score = score;
            room.lastActivity = Date.now();
        }
    }

    /**
     * Get room statistics
     * @param {string} roomCode - Room code
     * @returns {Object} Room statistics
     */
    getRoomStats(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        const players = Array.from(room.players.values());
        return {
            totalPlayers: players.length,
            connectedPlayers: players.filter(p => p.connected).length,
            readyPlayers: players.filter(p => p.isReady).length,
            averageScore: players.length > 0 ? 
                Math.round(players.reduce((sum, p) => sum + p.score, 0) / players.length) : 0,
            uptime: Date.now() - room.createdAt
        };
    }

    /**
     * Clean up inactive rooms
     */
    cleanupInactiveRooms() {
        const now = Date.now();
        const roomsToDelete = [];

        for (const [roomCode, room] of this.rooms) {
            if (now - room.lastActivity > this.ROOM_TIMEOUT) {
                roomsToDelete.push(roomCode);
            }
        }

        roomsToDelete.forEach(roomCode => {
            const room = this.rooms.get(roomCode);
            if (room) {
                // Remove all players from tracking
                for (const playerId of room.players.keys()) {
                    this.playerRooms.delete(playerId);
                }
                this.rooms.delete(roomCode);
            }
        });

        return roomsToDelete.length;
    }

    /**
     * Start cleanup interval
     */
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupInactiveRooms();
        }, this.ROOM_CLEANUP_INTERVAL);
    }

    /**
     * Get server statistics
     * @returns {Object} Server statistics
     */
    getServerStats() {
        return {
            totalRooms: this.rooms.size,
            totalPlayers: this.playerRooms.size,
            activeRooms: Array.from(this.rooms.values()).filter(r => r.phase !== 'lobby').length,
            roomStates: Array.from(this.rooms.values()).reduce((acc, room) => {
                acc[room.phase] = (acc[room.phase] || 0) + 1;
                return acc;
            }, {})
        };
    }

    /**
     * Force remove a player (for admin purposes)
     * @param {string} playerId - Player ID to remove
     * @returns {boolean} True if player was removed
     */
    forceRemovePlayer(playerId) {
        try {
            this.leaveRoom(playerId);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get all rooms (for admin purposes)
     * @returns {Array} Array of room information
     */
    getAllRooms() {
        return Array.from(this.rooms.keys()).map(code => this.getRoomInfo(code));
    }

    /**
     * Get active room count
     */
    getActiveRoomCount() {
        return this.rooms.size;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear all rooms
        this.rooms.clear();
        this.playerRooms.clear();
        
        console.log('🧹 RoomManager cleaned up');
    }
}

module.exports = RoomManager;