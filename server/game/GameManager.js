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
 * UPDATED: Added center exclusion zone for target generation
 * ================================= */

const { GAME_RULES, SCORING, VALIDATION } = require('../../shared/constants.js');
const Validator = require('../../shared/validation.js');
const { GameError, ValidationError, GameLogicError } = require('../../shared/errors.js');

class GameManager {
    constructor(spectrums) {
        Object.assign(this, {
            spectrums,
            ROUND_DURATION: GAME_RULES.ROUND_DURATION,
            MAX_ROUNDS: GAME_RULES.MAX_ROUNDS,
            MIN_PLAYERS: GAME_RULES.MIN_PLAYERS,
            MAX_PLAYERS: GAME_RULES.MAX_PLAYERS,
            BONUS_THRESHOLD: SCORING.BONUS_THRESHOLD,
            BONUS_POINTS: SCORING.BONUS_POINTS,
            RESULTS_VIEWING_TIME: 7000,
            BETWEEN_ROUNDS_DELAY: 3000,
            MAX_DISTANCE: GAME_RULES.MAX_DISTANCE,
            CENTER_EXCLUSION_RADIUS: 20, // 20% radius from center
            gameTimers: new Map()
        });
        console.log('🎮 GameManager initialized');
    }

    /**
     * Generate a target coordinate that respects the center exclusion zone
     * @returns {Object} Target coordinate {x, y}
     * @private
     */
    generateTargetCoordinate() {
        const centerX = 50;
        const centerY = 50;
        const margin = 5; // Keep at least 5 units from edges
        
        let x, y, distance;
        let attempts = 0;
        const maxAttempts = 1000; // Prevent infinite loop
        
        // Keep generating until we get a coordinate outside the exclusion zone
        do {
            x = Math.floor(Math.random() * (100 - 2 * margin + 1)) + margin;
            y = Math.floor(Math.random() * (100 - 2 * margin + 1)) + margin;
            
            // Calculate distance from center
            distance = Math.sqrt(
                Math.pow(x - centerX, 2) + 
                Math.pow(y - centerY, 2)
            );
            
            attempts++;
            if (attempts > maxAttempts) {
                console.error('❌ Failed to generate valid target coordinate after', maxAttempts, 'attempts');
                // Fallback to a guaranteed valid position
                const angle = Math.random() * Math.PI * 2;
                const radius = this.CENTER_EXCLUSION_RADIUS + 10; // Place it just outside the exclusion zone
                x = Math.round(centerX + Math.cos(angle) * radius);
                y = Math.round(centerY + Math.sin(angle) * radius);
                // Clamp to valid range
                x = Math.max(margin, Math.min(100 - margin, x));
                y = Math.max(margin, Math.min(100 - margin, y));
                break;
            }
        } while (distance <= this.CENTER_EXCLUSION_RADIUS);
        
        console.log(`🎯 Generated target at (${x}, ${y}), distance from center: ${distance.toFixed(1)}`);
        return { x, y };
    }

    startRound(room) {
        try {
            console.log(`🎯 Starting round ${room.currentRound + 1} for room ${room.code}`);
            this.clearAllRoomTimers(room.id);
            
            room.currentRound++;
            this.selectClueGiver(room);
            
            const { spectrumX, spectrumY } = this.selectSpectrums(room);
            Object.assign(room, {
                spectrumX, spectrumY,
                targetCoordinate: this.generateTargetCoordinate(), // Use new method
                clue: null,
                guesses: new Map(),
                roundStartTime: Date.now(),
                phase: 'giving-clue',
                roundScores: new Map()
            });
            
            this.startRoundTimer(room);
            
            return {
                roundNumber: room.currentRound,
                clueGiverId: room.clueGiverId,
                spectrumX: room.spectrumX,
                spectrumY: room.spectrumY,
                targetCoordinate: room.targetCoordinate,
                duration: this.ROUND_DURATION
            };
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
        
        const spectrumX = available[Math.floor(Math.random() * available.length)];
        const spectrumY = available.filter(s => s.id !== spectrumX.id)[Math.floor(Math.random() * (available.length - 1))];
        
        room.usedSpectrums.push(spectrumX.id, spectrumY.id);
        console.log(`🌈 Selected spectrums: X: ${spectrumX.name}, Y: ${spectrumY.name}`);
        
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
            if (playerId !== room.clueGiverId) {
                throw new GameLogicError(
                    'CLUE_SUBMIT_FAILED',
                    'Only the clue giver can submit clues',
                    room.phase
                );
            }
            
            if (room.phase !== 'giving-clue') {
                throw new GameLogicError(
                    'CLUE_SUBMIT_FAILED',
                    'Not in clue giving phase',
                    room.phase
                );
            }
            
            const validation = Validator.clue(clue);
            if (!validation.valid) {
                throw new ValidationError(
                    'INVALID_CLUE',
                    validation.error,
                    'clue',
                    clue
                );
            }
            
            room.clue = clue.trim();
            room.phase = 'guessing';
            console.log(`💡 Clue submitted for room ${room.code}: "${clue}"`);
            
            return { 
                clue: room.clue, 
                clueGiverId: room.clueGiverId || playerId  // Ensure clueGiverId is always included
            };
        } catch (error) {
            console.error('❌ Error submitting clue:', error);
            throw error;
        }
    }

    submitGuess(room, playerId, coordinate) {
        try {
            if (playerId === room.clueGiverId) {
                throw new GameLogicError(
                    'GUESS_SUBMIT_FAILED',
                    'Clue giver cannot submit guesses',
                    room.phase
                );
            }
            
            if (room.phase !== 'guessing') {
                throw new GameLogicError(
                    'GUESS_SUBMIT_FAILED',
                    'Not in guessing phase',
                    room.phase
                );
            }
            
            const validation = Validator.coordinate(coordinate);
            if (!validation.valid) {
                throw new ValidationError(
                    'INVALID_GUESS',
                    validation.error,
                    'coordinate',
                    coordinate
                );
            }
            
            if (room.guesses.has(playerId)) {
                throw new GameLogicError(
                    'GUESS_SUBMIT_FAILED',
                    'Player has already guessed',
                    room.phase,
                    { playerId }
                );
            }
            
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
            
            const nextAction = room.currentRound >= this.MAX_ROUNDS 
                ? () => this.endGame(room)
                : () => this.prepareNextRound(room);
            
            const delay = room.currentRound >= this.MAX_ROUNDS ? this.RESULTS_VIEWING_TIME : this.RESULTS_VIEWING_TIME;
            this.gameTimers.set(`${room.id}_${room.currentRound >= this.MAX_ROUNDS ? 'gameEnd' : 'transition'}`, 
                setTimeout(nextAction, delay));
            
            return roundResults;
        } catch (error) {
            console.error('❌ Error ending round:', error);
            this.clearAllRoomTimers(room.id);
            room.phase = 'waiting';
            throw error;
        }
    }

    prepareNextRound(room) {
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
    }

    calculateDistance = (guess, target) => Math.hypot(guess.x - target.x, guess.y - target.y);

    calculateRoundScores(room) {
        const roundScores = new Map();
        const guesses = Array.from(room.guesses.entries());
        let bestDistance = Infinity, bestPlayerId = null;
        
        guesses.forEach(([playerId, guess]) => {
            const distance = this.calculateDistance(guess, room.targetCoordinate);
            const score = Math.max(0, Math.round(100 * (1 - distance / this.MAX_DISTANCE)));
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
            roundScores.set(room.clueGiverId, Math.round(avgScore) + (allWithinBonus ? this.BONUS_POINTS : 0));
            
            return {
                roundScores,
                bonusAwarded: allWithinBonus,
                bestGuess: bestPlayerId ? { playerId: bestPlayerId, distance: Math.round(bestDistance * 10) / 10 } : null
            };
        }
        
        roundScores.set(room.clueGiverId, 0);
        return { roundScores, bonusAwarded: false, bestGuess: null };
    }

    getTotalScores = room => Object.fromEntries(
        Array.from(room.players.entries()).map(([id, player]) => [id, player.score || 0])
    );

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
        return Validator.clue(clue);
    }

    validateGuess(coordinate) {
        return Validator.coordinate(coordinate);
    }

    canStartGame = room => room.players.size >= this.MIN_PLAYERS && room.players.size <= this.MAX_PLAYERS;

    getGameConfig = () => ({
        ROUND_DURATION: this.ROUND_DURATION,
        MAX_ROUNDS: this.MAX_ROUNDS,
        MIN_PLAYERS: this.MIN_PLAYERS,
        MAX_PLAYERS: this.MAX_PLAYERS,
        BONUS_THRESHOLD: this.BONUS_THRESHOLD,
        BONUS_POINTS: this.BONUS_POINTS,
        RESULTS_VIEWING_TIME: this.RESULTS_VIEWING_TIME,
        BETWEEN_ROUNDS_DELAY: this.BETWEEN_ROUNDS_DELAY,
        MAX_DISTANCE: this.MAX_DISTANCE,
        CENTER_EXCLUSION_RADIUS: this.CENTER_EXCLUSION_RADIUS
    });

    cleanup() {
        this.gameTimers.forEach((timer, key) => {
            (typeof timer === 'number' ? clearTimeout : clearInterval)(timer);
        });
        this.gameTimers.clear();
        console.log('🧹 GameManager cleaned up');
    }
}

module.exports = { GameManager };