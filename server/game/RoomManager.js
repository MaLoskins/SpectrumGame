/**
 * Room and player management for Spectrum
 * Handles room creation, player joining/leaving, and room lifecycle
 * UPDATED: Support for 2D coordinate system
 */

const crypto = require('crypto');

class RoomManager {
    constructor() {
        Object.assign(this, {
            rooms: new Map(),
            playerRooms: new Map(),
            MIN_PLAYERS: 2,
            MAX_PLAYERS: 4,
            ROOM_CODE_LENGTH: 6,
            ROOM_CLEANUP_INTERVAL: 300000, // 5 minutes
            ROOM_TIMEOUT: 1800000 // 30 minutes
        });
        
        // Start cleanup interval
        setInterval(() => this.cleanupInactiveRooms(), this.ROOM_CLEANUP_INTERVAL);
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        
        do {
            code = Array.from({ length: this.ROOM_CODE_LENGTH }, () => 
                chars[Math.floor(Math.random() * chars.length)]
            ).join('');
        } while (this.rooms.has(code));
        
        return code;
    }

    createRoom(hostId, hostName, settings = {}) {
        if (this.playerRooms.has(hostId)) throw new Error('Player is already in a room');

        const roomCode = this.generateRoomCode();
        const room = {
            code: roomCode,
            id: `room_${roomCode}`,
            hostId,
            players: new Map([[hostId, {
                id: hostId,
                name: hostName,
                isHost: true,
                isReady: true,
                joinedAt: Date.now(),
                connected: true,
                score: 0
            }]]),
            state: 'lobby',
            phase: 'lobby',
            createdAt: Date.now(),
            lastActivity: Date.now(),
            settings: { maxPlayers: this.MAX_PLAYERS, roundDuration: 60000, ...settings },
            
            // Game state - Updated for 2D
            currentRound: 0,
            clueGiverId: null,
            spectrumX: null,
            spectrumY: null,
            targetCoordinate: null,
            clue: null,
            guesses: new Map(),
            roundScores: new Map(),
            roundStartTime: null,
            usedSpectrums: [],
            io: null
        };

        this.rooms.set(roomCode, room);
        this.playerRooms.set(hostId, roomCode);

        console.log(`🏠 Created room ${roomCode} with host ${hostName}`);
        return { code: roomCode, room: this.getRoomInfo(roomCode) };
    }

    joinRoom(roomCode, playerId, playerName) {
        if (this.playerRooms.has(playerId)) throw new Error('Player is already in a room');

        const room = this.getRoomByCode(roomCode);
        if (!room) throw new Error('Room not found');
        if (room.players.size >= this.MAX_PLAYERS) throw new Error('Room is full');
        if (!['lobby', 'waiting'].includes(room.phase)) throw new Error('Cannot join room - game in progress');

        // Check duplicate names
        if (Array.from(room.players.values()).some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            throw new Error('Player name already taken in this room');
        }

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

    leaveRoom(playerId) {
        const roomCode = this.playerRooms.get(playerId);
        if (!roomCode) throw new Error('Player is not in a room');

        const room = this.rooms.get(roomCode);
        if (!room) throw new Error('Room not found');

        const player = room.players.get(playerId);
        if (!player) throw new Error('Player not found in room');

        const wasHost = player.isHost;
        const playerName = player.name;
        
        room.players.delete(playerId);
        this.playerRooms.delete(playerId);
        room.lastActivity = Date.now();

        console.log(`🚪 Player ${playerName} left room ${roomCode}`);

        // Handle empty room
        if (room.players.size === 0) {
            this.rooms.delete(roomCode);
            return { roomDeleted: true, newHost: null };
        }

        // Assign new host if needed
        let newHost = null;
        if (wasHost) {
            newHost = room.players.values().next().value;
            newHost.isHost = true;
            room.hostId = newHost.id;
            console.log(`👑 Transferred host to ${newHost.name} in room ${roomCode}`);
        }

        return { roomDeleted: false, newHost, room: this.getRoomInfo(roomCode) };
    }

    setPlayerReady(playerId, ready) {
        const roomCode = this.playerRooms.get(playerId);
        if (!roomCode) throw new Error('Player is not in a room');

        const room = this.rooms.get(roomCode);
        const player = room.players.get(playerId);
        if (!player) throw new Error('Player not found in room');

        player.isReady = ready;
        room.lastActivity = Date.now();
        return this.getRoomInfo(roomCode);
    }

    areAllPlayersReady = roomCode => {
        const room = this.rooms.get(roomCode);
        return room && room.players.size >= this.MIN_PLAYERS && 
               Array.from(room.players.values()).every(p => p.isReady);
    };

    updatePlayerConnection(playerId, connected) {
        const roomCode = this.playerRooms.get(playerId);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        const player = room?.players.get(playerId);
        
        if (player) {
            player.connected = connected;
            room.lastActivity = Date.now();
            console.log(`🔌 Player ${player.name} ${connected ? 'reconnected to' : 'disconnected from'} room ${roomCode}`);
        }
    }

    getRoomByCode = roomCode => this.rooms.get(roomCode.toUpperCase()) || null;

    getRoomInfo(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        return {
            code: room.code,
            hostId: room.hostId,
            state: room.state,
            phase: room.phase,
            players: Array.from(room.players.values()).map(({ id, name, isHost, isReady, connected, score }) => 
                ({ id, name, isHost, isReady, connected, score })),
            playerCount: room.players.size,
            maxPlayers: room.settings.maxPlayers,
            canStart: this.canStartGame(roomCode),
            createdAt: room.createdAt,
            settings: room.settings,
            gameState: {
                currentRound: room.currentRound,
                clueGiverId: room.clueGiverId,
                spectrumX: room.spectrumX,
                spectrumY: room.spectrumY,
                clue: room.clue,
                phase: room.phase
            }
        };
    }

    canStartGame = roomCode => {
        const room = this.rooms.get(roomCode);
        return room && room.phase === 'lobby' && 
               room.players.size >= this.MIN_PLAYERS && 
               this.areAllPlayersReady(roomCode);
    };

    updateRoomState = (roomCode, newState) => this.updateRoom(roomCode, { state: newState });
    updateRoomPhase = (roomCode, newPhase) => this.updateRoom(roomCode, { phase: newPhase });

    updateRoom(roomCode, updates) {
        const room = this.rooms.get(roomCode);
        if (!room) throw new Error('Room not found');
        Object.assign(room, updates, { lastActivity: Date.now() });
    }

    getPlayerRoom = playerId => this.playerRooms.get(playerId) || null;
    getRoomPlayers = roomCode => Array.from(this.rooms.get(roomCode)?.players.values() || []);

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

    getRoomStats(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;

        const players = Array.from(room.players.values());
        return {
            totalPlayers: players.length,
            connectedPlayers: players.filter(p => p.connected).length,
            readyPlayers: players.filter(p => p.isReady).length,
            averageScore: players.length ? Math.round(players.reduce((sum, p) => sum + p.score, 0) / players.length) : 0,
            uptime: Date.now() - room.createdAt
        };
    }

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
                room.players.forEach((_, playerId) => this.playerRooms.delete(playerId));
                this.rooms.delete(roomCode);
            }
        });

        return roomsToDelete.length;
    }

    getServerStats = () => ({
        totalRooms: this.rooms.size,
        totalPlayers: this.playerRooms.size,
        activeRooms: Array.from(this.rooms.values()).filter(r => r.phase !== 'lobby').length,
        roomStates: Array.from(this.rooms.values()).reduce((acc, room) => {
            acc[room.phase] = (acc[room.phase] || 0) + 1;
            return acc;
        }, {})
    });

    forceRemovePlayer(playerId) {
        try {
            this.leaveRoom(playerId);
            return true;
        } catch { return false; }
    }

    getAllRooms = () => Array.from(this.rooms.keys()).map(code => this.getRoomInfo(code));
    getActiveRoomCount = () => this.rooms.size;

    cleanup() {
        this.rooms.clear();
        this.playerRooms.clear();
        console.log('🧹 RoomManager cleaned up');
    }
}

module.exports = RoomManager;