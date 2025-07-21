/**
 * ===================================
 * SPECTRUM GAME - GAME MANAGER
 * ===================================
 * 
 * Game manager that:
 * - Enforces game rules and logic
 * - Calculates scores and bonuses
 * - Manages round timing
 * - Validates player actions
 * 
 * UPDATED: 2D grid mechanics with X/Y coordinates
 * ================================= */

class GameManager {
    constructor(spectrums) {
        Object.assign(this, {
            spectrums,
            ROUND_DURATION: 60,
            MAX_ROUNDS: 10,
            MIN_PLAYERS: 2,
            MAX_PLAYERS: 6,
            BONUS_THRESHOLD: 10, // Distance threshold for bonus
            BONUS_POINTS: 50,
            RESULTS_VIEWING_TIME: 7000,
            BETWEEN_ROUNDS_DELAY: 3000,
            MAX_DISTANCE: Math.sqrt(100 * 100 + 100 * 100), // ~141.4
            gameTimers: new Map()
        });
        console.log('🎮 GameManager initialized');
    }

    startRound(room) {
        try {
            console.log(`🎯 Starting round ${room.currentRound + 1} for room ${room.code}`);
            this.clearAllRoomTimers(room.id);
            
            room.currentRound++;
            this.selectClueGiver(room);
            
            // Select two different spectrums for X and Y axes
            const { spectrumX, spectrumY } = this.selectSpectrums(room);
            room.spectrumX = spectrumX;
            room.spectrumY = spectrumY;
            
            // Generate 2D target coordinate
            room.targetCoordinate = {
                x: Math.floor(Math.random() * 81) + 10, // 10-90
                y: Math.floor(Math.random() * 81) + 10  // 10-90
            };
            
            Object.assign(room, {
                clue: null,
                guesses: new Map(),
                roundStartTime: Date.now(),
                phase: 'giving-clue',
                roundScores: new Map()
            });
            
            const roundData = {
                roundNumber: room.currentRound,
                clueGiverId: room.clueGiverId,
                spectrumX: room.spectrumX,
                spectrumY: room.spectrumY,
                targetCoordinate: room.targetCoordinate,
                duration: this.ROUND_DURATION
            };
            
            this.startRoundTimer(room);
            return roundData;
        } catch (error) {
            console.error('❌ Error starting round:', error);
            throw error;
        }
    }

    selectClueGiver(room) {
        const playerIds = Array.from(room.players.keys());
        room.clueGiverId = !room.clueGiverId 
            ? playerIds[Math.floor(Math.random() * playerIds.length)]
            : playerIds[(playerIds.indexOf(room.clueGiverId) + 1) % playerIds.length];
        console.log(`👑 Selected clue giver: ${room.clueGiverId}`);
    }

    selectSpectrums(room) {
        const available = this.spectrums.spectrums.filter(s => 
            !room.usedSpectrums.includes(s.id) || room.usedSpectrums.length >= this.spectrums.spectrums.length - 4
        );
        
        if (available.length < 2) {
            room.usedSpectrums = room.usedSpectrums.slice(-4);
            return this.selectSpectrums(room);
        }
        
        // Select first spectrum
        const spectrumX = available[Math.floor(Math.random() * available.length)];
        // Select second spectrum, ensuring it's different
        const remainingSpectrums = available.filter(s => s.id !== spectrumX.id);
        const spectrumY = remainingSpectrums[Math.floor(Math.random() * remainingSpectrums.length)];
        
        room.usedSpectrums.push(spectrumX.id, spectrumY.id);
        console.log(`🌈 Selected spectrums: X-axis: ${spectrumX.name}, Y-axis: ${spectrumY.name}`);
        
        return { spectrumX, spectrumY };
    }

    startRoundTimer(room) {
        this.clearRoundTimer(room.id);
        let timeRemaining = this.ROUND_DURATION;
        room.timerActive = true;
        
        const timer = setInterval(() => {
            if (!room.timerActive) return clearInterval(timer);
            
            timeRemaining--;
            room.io?.to(room.id).emit('timer:update', { timeRemaining, phase: room.phase });
            
            if (room.phase === 'giving-clue' && timeRemaining <= 5 && !room.clue) {
                this.submitClue(room, room.clueGiverId, 'No clue given');
            }
            
            if (timeRemaining <= 0) this.endRound(room);
        }, 1000);
        
        this.gameTimers.set(room.id, timer);
    }

    clearRoundTimer(roomId) {
        const timer = this.gameTimers.get(roomId);
        if (timer) {
            clearInterval(timer);
            this.gameTimers.delete(roomId);
        }
    }

    clearAllRoomTimers(roomId) {
        [roomId, `${roomId}_transition`, `${roomId}_nextRound`, `${roomId}_gameEnd`].forEach(key => {
            const timer = this.gameTimers.get(key);
            if (timer) {
                (typeof timer === 'number' ? clearTimeout : clearInterval)(timer);
                this.gameTimers.delete(key);
            }
        });
    }

    submitClue(room, playerId, clue) {
        try {
            if (playerId !== room.clueGiverId) throw new Error('Only the clue giver can submit clues');
            if (room.phase !== 'giving-clue') throw new Error('Not in clue giving phase');
            
            const validation = this.validateClue(clue);
            if (!validation.valid) throw new Error(validation.error);
            
            room.clue = clue.trim();
            room.phase = 'guessing';
            console.log(`💡 Clue submitted for room ${room.code}: "${clue}"`);
            
            return { clue: room.clue, clueGiverId: room.clueGiverId };
        } catch (error) {
            console.error('❌ Error submitting clue:', error);
            throw error;
        }
    }

    submitGuess(room, playerId, coordinate) {
        try {
            if (playerId === room.clueGiverId) throw new Error('Clue giver cannot submit guesses');
            if (room.phase !== 'guessing') throw new Error('Not in guessing phase');
            
            const validation = this.validateGuess(coordinate);
            if (!validation.valid) throw new Error(validation.error);
            if (room.guesses.has(playerId)) throw new Error('Player has already guessed');
            
            room.guesses.set(playerId, coordinate);
            console.log(`🎯 Guess submitted for room ${room.code}: Player ${playerId} guessed (${coordinate.x}, ${coordinate.y})`);
            
            const nonClueGivers = Array.from(room.players.keys()).filter(id => id !== room.clueGiverId);
            if (nonClueGivers.every(id => room.guesses.has(id))) {
                setTimeout(() => this.endRound(room), 1000);
            }
            
            return { playerId, hasGuessed: true };
        } catch (error) {
            console.error('❌ Error submitting guess:', error);
            throw error;
        }
    }

    endRound(room) {
        try {
            console.log(`🏁 Ending round ${room.currentRound} for room ${room.code}`);
            room.timerActive = false;
            this.clearAllRoomTimers(room.id);
            
            if (['results', 'waiting'].includes(room.phase)) return;
            
            room.phase = 'results';
            const results = this.calculateRoundScores(room);
            
            results.roundScores.forEach((score, playerId) => {
                const player = room.players.get(playerId);
                if (player) player.score = (player.score || 0) + score;
            });
            
            const roundResults = {
                targetCoordinate: room.targetCoordinate,
                guesses: Object.fromEntries(room.guesses),
                roundScores: Object.fromEntries(results.roundScores),
                totalScores: this.getTotalScores(room),
                bonusAwarded: results.bonusAwarded,
                bestGuess: results.bestGuess
            };
            
            room.io?.to(room.id).emit('game:round-end', roundResults);
            
            if (room.currentRound >= this.MAX_ROUNDS) {
                this.gameTimers.set(`${room.id}_gameEnd`, 
                    setTimeout(() => this.endGame(room), this.RESULTS_VIEWING_TIME));
            } else {
                this.gameTimers.set(`${room.id}_transition`, setTimeout(() => {
                    room.phase = 'waiting';
                    room.io?.to(room.id).emit('game:phase-change', { 
                        phase: 'waiting',
                        message: 'Preparing next round...'
                    });
                    
                    this.gameTimers.set(`${room.id}_nextRound`, setTimeout(() => {
                        const nextRoundData = this.startRound(room);
                        if (room.io && room.socketHandler) {
                            room.players.forEach((player, playerId) => {
                                const socket = room.socketHandler.getPlayerSocket(playerId);
                                socket?.emit('game:round-start', {
                                    ...nextRoundData,
                                    targetCoordinate: playerId === room.clueGiverId ? room.targetCoordinate : null
                                });
                            });
                        }
                    }, this.BETWEEN_ROUNDS_DELAY));
                }, this.RESULTS_VIEWING_TIME));
            }
            
            return roundResults;
        } catch (error) {
            console.error('❌ Error ending round:', error);
            this.clearAllRoomTimers(room.id);
            room.phase = 'waiting';
            throw error;
        }
    }

    calculateDistance(guess, target) {
        return Math.sqrt(
            Math.pow(guess.x - target.x, 2) + 
            Math.pow(guess.y - target.y, 2)
        );
    }

    calculateRoundScores(room) {
        const roundScores = new Map();
        const guesses = Array.from(room.guesses.entries());
        let bestDistance = Infinity, bestPlayerId = null;
        
        guesses.forEach(([playerId, guess]) => {
            const distance = this.calculateDistance(guess, room.targetCoordinate);
            // Normalize score: closer = higher score
            const normalizedDistance = distance / this.MAX_DISTANCE;
            const score = Math.max(0, Math.round(100 * (1 - normalizedDistance)));
            roundScores.set(playerId, score);
            
            if (distance < bestDistance) {
                bestDistance = distance;
                bestPlayerId = playerId;
            }
        });
        
        if (guesses.length > 0) {
            const avgScore = Array.from(roundScores.values()).reduce((sum, s) => sum + s, 0) / roundScores.size;
            const allWithinBonus = guesses.every(([, guess]) => 
                this.calculateDistance(guess, room.targetCoordinate) <= this.BONUS_THRESHOLD
            );
            const bonus = allWithinBonus ? this.BONUS_POINTS : 0;
            roundScores.set(room.clueGiverId, Math.round(avgScore) + bonus);
            
            return {
                roundScores,
                bonusAwarded: allWithinBonus,
                bestGuess: bestPlayerId ? { 
                    playerId: bestPlayerId, 
                    distance: Math.round(bestDistance * 10) / 10 
                } : null
            };
        }
        
        roundScores.set(room.clueGiverId, 0);
        return { roundScores, bonusAwarded: false, bestGuess: null };
    }

    getTotalScores(room) {
        return Object.fromEntries(
            Array.from(room.players.entries()).map(([id, player]) => [id, player.score || 0])
        );
    }

    endGame(room) {
        try {
            console.log(`🎉 Ending game for room ${room.code}`);
            this.clearAllRoomTimers(room.id);
            room.timerActive = false;
            room.phase = 'finished';
            
            const finalScores = this.getTotalScores(room);
            const winner = Object.entries(finalScores).reduce((w, [id, score]) => 
                score > (w.score || -1) ? { id, score } : w, {}).id;
            
            const gameResults = {
                finalScores,
                winner,
                gameStats: {
                    totalRounds: room.currentRound,
                    duration: Date.now() - room.createdAt,
                    spectrumsUsed: room.usedSpectrums.length,
                    averageRoundTime: this.ROUND_DURATION
                }
            };
            
            room.io?.to(room.id).emit('game:finished', gameResults);
            return gameResults;
        } catch (error) {
            console.error('❌ Error ending game:', error);
            throw error;
        }
    }

    validateClue(clue) {
        if (!clue?.trim()) return { valid: false, error: 'Clue cannot be empty' };
        const trimmed = clue.trim();
        if (trimmed.length > 100) return { valid: false, error: 'Clue must be 100 characters or less' };
        if (/\d/.test(trimmed)) return { valid: false, error: 'Clue cannot contain numbers' };
        return { valid: true };
    }

    validateGuess(coordinate) {
        if (!coordinate || typeof coordinate.x !== 'number' || typeof coordinate.y !== 'number') {
            return { valid: false, error: 'Invalid coordinate format' };
        }
        if (coordinate.x < 0 || coordinate.x > 100 || coordinate.y < 0 || coordinate.y > 100) {
            return { valid: false, error: 'Coordinates must be between 0 and 100' };
        }
        return { valid: true };
    }

    canStartGame(room) {
        const count = room.players.size;
        return count >= this.MIN_PLAYERS && count <= this.MAX_PLAYERS;
    }

    getGameConfig() {
        return {
            ROUND_DURATION: this.ROUND_DURATION,
            MAX_ROUNDS: this.MAX_ROUNDS,
            MIN_PLAYERS: this.MIN_PLAYERS,
            MAX_PLAYERS: this.MAX_PLAYERS,
            BONUS_THRESHOLD: this.BONUS_THRESHOLD,
            BONUS_POINTS: this.BONUS_POINTS,
            RESULTS_VIEWING_TIME: this.RESULTS_VIEWING_TIME,
            BETWEEN_ROUNDS_DELAY: this.BETWEEN_ROUNDS_DELAY,
            MAX_DISTANCE: this.MAX_DISTANCE
        };
    }

    cleanup() {
        this.gameTimers.forEach((timer, key) => {
            (typeof timer === 'number' ? clearTimeout : clearInterval)(timer);
        });
        this.gameTimers.clear();
        console.log('🧹 GameManager cleaned up');
    }
}

module.exports = { GameManager };