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
 * ================================= */

/**
 * GameManager Class
 * Handles all game logic and rule enforcement
 */
class GameManager {
    constructor(spectrums) {
        this.spectrums = spectrums;
        
        // Game constants
        this.ROUND_DURATION = 60; // seconds
        this.MAX_ROUNDS = 10;
        this.MIN_PLAYERS = 2;
        this.MAX_PLAYERS = 6;
        this.BONUS_THRESHOLD = 10; // percentage
        this.BONUS_POINTS = 50;
        
        // Active game timers
        this.gameTimers = new Map();
        
        console.log('🎮 GameManager initialized');
    }

    /**
     * Start a new round
     */
    startRound(room) {
        try {
            console.log(`🎯 Starting round ${room.currentRound + 1} for room ${room.code}`);
            
            // Increment round counter
            room.currentRound++;
            
            // Select clue giver
            this.selectClueGiver(room);
            
            // Select spectrum
            const spectrum = this.selectSpectrum(room);
            room.currentSpectrum = spectrum;
            
            // Generate target position
            room.targetPosition = this.generateTargetPosition();
            
            // Reset round state
            room.clue = null;
            room.guesses = new Map();
            room.roundStartTime = Date.now();
            room.phase = 'giving-clue';
            
            // Clear previous round scores
            room.roundScores = new Map();
            
            // Start round timer
            this.startRoundTimer(room);
            
            return {
                roundNumber: room.currentRound,
                clueGiverId: room.clueGiverId,
                spectrum: spectrum,
                targetPosition: room.targetPosition, // Only sent to clue giver
                duration: this.ROUND_DURATION
            };
            
        } catch (error) {
            console.error('❌ Error starting round:', error);
            throw error;
        }
    }

    /**
     * Select the next clue giver
     */
    selectClueGiver(room) {
        const playerIds = Array.from(room.players.keys());
        
        if (!room.clueGiverId) {
            // First round - select random player
            room.clueGiverId = playerIds[Math.floor(Math.random() * playerIds.length)];
        } else {
            // Rotate to next player
            const currentIndex = playerIds.indexOf(room.clueGiverId);
            const nextIndex = (currentIndex + 1) % playerIds.length;
            room.clueGiverId = playerIds[nextIndex];
        }
        
        console.log(`👑 Selected clue giver: ${room.clueGiverId}`);
    }

    /**
     * Select a spectrum for the round
     */
    selectSpectrum(room) {
        const availableSpectrums = this.spectrums.spectrums.filter(spectrum => {
            // Avoid repeating spectrums too soon
            return !room.usedSpectrums.includes(spectrum.id) || 
                   room.usedSpectrums.length >= this.spectrums.spectrums.length - 2;
        });
        
        // If we've used most spectrums, reset the used list but keep last 2
        if (availableSpectrums.length === 0) {
            room.usedSpectrums = room.usedSpectrums.slice(-2);
            return this.selectSpectrum(room);
        }
        
        // Select random spectrum
        const selectedSpectrum = availableSpectrums[Math.floor(Math.random() * availableSpectrums.length)];
        
        // Add to used spectrums
        room.usedSpectrums.push(selectedSpectrum.id);
        
        console.log(`🌈 Selected spectrum: ${selectedSpectrum.name}`);
        return selectedSpectrum;
    }

    /**
     * Generate random target position
     */
    generateTargetPosition() {
        // Avoid edges to make guessing more interesting
        return Math.floor(Math.random() * 81) + 10; // 10-90
    }

    /**
     * Start round timer
     */
    startRoundTimer(room) {
        // Clear existing timer
        this.clearRoundTimer(room.id);
        
        let timeRemaining = this.ROUND_DURATION;
        
        const timer = setInterval(() => {
            timeRemaining--;
            
            // Emit timer update
            if (room.io) {
                room.io.to(room.id).emit('timer:update', {
                    timeRemaining,
                    phase: room.phase
                });
            }
            
            // Check for phase transitions
            if (room.phase === 'giving-clue' && timeRemaining <= 30) {
                // Auto-submit empty clue if time is running out
                if (timeRemaining <= 5 && !room.clue) {
                    this.submitClue(room, room.clueGiverId, 'No clue given');
                }
            }
            
            // End round when timer expires
            if (timeRemaining <= 0) {
                this.endRound(room);
            }
        }, 1000);
        
        this.gameTimers.set(room.id, timer);
    }

    /**
     * Clear round timer
     */
    clearRoundTimer(roomId) {
        const timer = this.gameTimers.get(roomId);
        if (timer) {
            clearInterval(timer);
            this.gameTimers.delete(roomId);
        }
    }

    /**
     * Submit a clue
     */
    submitClue(room, playerId, clue) {
        try {
            // Validate clue giver
            if (playerId !== room.clueGiverId) {
                throw new Error('Only the clue giver can submit clues');
            }
            
            // Validate game phase
            if (room.phase !== 'giving-clue') {
                throw new Error('Not in clue giving phase');
            }
            
            // Validate clue
            const validation = this.validateClue(clue);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            // Set clue and change phase
            room.clue = clue.trim();
            room.phase = 'guessing';
            
            console.log(`💡 Clue submitted for room ${room.code}: "${clue}"`);
            
            return {
                clue: room.clue,
                clueGiverId: room.clueGiverId
            };
            
        } catch (error) {
            console.error('❌ Error submitting clue:', error);
            throw error;
        }
    }

    /**
     * Submit a guess
     */
    submitGuess(room, playerId, position) {
        try {
            // Validate player is not clue giver
            if (playerId === room.clueGiverId) {
                throw new Error('Clue giver cannot submit guesses');
            }
            
            // Validate game phase
            if (room.phase !== 'guessing') {
                throw new Error('Not in guessing phase');
            }
            
            // Validate guess
            const validation = this.validateGuess(position);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            // Check if player already guessed
            if (room.guesses.has(playerId)) {
                throw new Error('Player has already guessed');
            }
            
            // Store guess
            room.guesses.set(playerId, position);
            
            console.log(`🎯 Guess submitted for room ${room.code}: Player ${playerId} guessed ${position}`);
            
            // Check if all players have guessed
            const nonClueGivers = Array.from(room.players.keys()).filter(id => id !== room.clueGiverId);
            const allGuessed = nonClueGivers.every(id => room.guesses.has(id));
            
            if (allGuessed) {
                // End round immediately if all players have guessed
                setTimeout(() => this.endRound(room), 1000);
            }
            
            return {
                playerId,
                hasGuessed: true
            };
            
        } catch (error) {
            console.error('❌ Error submitting guess:', error);
            throw error;
        }
    }

    /**
     * End the current round
     */
    endRound(room) {
        try {
            console.log(`🏁 Ending round ${room.currentRound} for room ${room.code}`);
            
            // Clear timer
            this.clearRoundTimer(room.id);
            
            // Calculate scores
            const results = this.calculateRoundScores(room);
            
            // Update player scores
            results.roundScores.forEach((score, playerId) => {
                const player = room.players.get(playerId);
                if (player) {
                    player.score = (player.score || 0) + score;
                }
            });
            
            // Set phase to results
            room.phase = 'results';
            
            // Prepare results data
            const roundResults = {
                targetPosition: room.targetPosition,
                guesses: Object.fromEntries(room.guesses),
                roundScores: Object.fromEntries(results.roundScores),
                totalScores: this.getTotalScores(room),
                bonusAwarded: results.bonusAwarded,
                bestGuess: results.bestGuess
            };
            
            // Broadcast round end results
            if (room.io) {
                room.io.to(room.id).emit('game:round-end', roundResults);
            }
            
            // Check if game is finished
            if (room.currentRound >= this.MAX_ROUNDS) {
                setTimeout(() => this.endGame(room), 5000);
            } else {
                // Schedule next round
                setTimeout(() => this.startRound(room), 10000);
            }
            
            return roundResults;
            
        } catch (error) {
            console.error('❌ Error ending round:', error);
            throw error;
        }
    }

    /**
     * Calculate round scores
     */
    calculateRoundScores(room) {
        const roundScores = new Map();
        const guesses = Array.from(room.guesses.entries());
        const target = room.targetPosition;
        
        // Calculate scores for guessers
        let bestDistance = Infinity;
        let bestPlayerId = null;
        
        guesses.forEach(([playerId, guess]) => {
            const distance = Math.abs(guess - target);
            const distancePercentage = distance / 100;
            const baseScore = Math.max(0, 100 - Math.round(distancePercentage * 100));
            
            roundScores.set(playerId, baseScore);
            
            // Track best guess
            if (distance < bestDistance) {
                bestDistance = distance;
                bestPlayerId = playerId;
            }
        });
        
        // Calculate clue giver score
        if (guesses.length > 0) {
            const averageScore = Array.from(roundScores.values()).reduce((sum, score) => sum + score, 0) / roundScores.size;
            
            // Check for bonus (all guesses within threshold)
            const allWithinBonus = guesses.every(([, guess]) => {
                const distance = Math.abs(guess - target);
                return (distance / 100) <= (this.BONUS_THRESHOLD / 100);
            });
            
            const bonusPoints = allWithinBonus ? this.BONUS_POINTS : 0;
            const clueGiverScore = Math.round(averageScore) + bonusPoints;
            
            roundScores.set(room.clueGiverId, clueGiverScore);
            
            return {
                roundScores,
                bonusAwarded: allWithinBonus,
                bestGuess: bestPlayerId ? {
                    playerId: bestPlayerId,
                    distance: bestDistance
                } : null
            };
        }
        
        // No guesses - clue giver gets 0 points
        roundScores.set(room.clueGiverId, 0);
        
        return {
            roundScores,
            bonusAwarded: false,
            bestGuess: null
        };
    }

    /**
     * Get total scores for all players
     */
    getTotalScores(room) {
        const totalScores = {};
        
        room.players.forEach((player, playerId) => {
            totalScores[playerId] = player.score || 0;
        });
        
        return totalScores;
    }

    /**
     * End the game
     */
    endGame(room) {
        try {
            console.log(`🎉 Ending game for room ${room.code}`);
            
            // Clear any remaining timers
            this.clearRoundTimer(room.id);
            
            // Calculate final results
            const finalScores = this.getTotalScores(room);
            const winner = this.determineWinner(finalScores);
            const gameStats = this.calculateGameStats(room);
            
            // Set phase to finished
            room.phase = 'finished';
            
            const gameResults = {
                finalScores,
                winner,
                gameStats
            };
            
            // Broadcast game end results
            if (room.io) {
                room.io.to(room.id).emit('game:finished', gameResults);
            }
            
            return gameResults;
            
        } catch (error) {
            console.error('❌ Error ending game:', error);
            throw error;
        }
    }

    /**
     * Determine the winner
     */
    determineWinner(finalScores) {
        let highestScore = -1;
        let winner = null;
        
        Object.entries(finalScores).forEach(([playerId, score]) => {
            if (score > highestScore) {
                highestScore = score;
                winner = playerId;
            }
        });
        
        return winner;
    }

    /**
     * Calculate game statistics
     */
    calculateGameStats(room) {
        return {
            totalRounds: room.currentRound,
            duration: Date.now() - room.createdAt,
            spectrumsUsed: room.usedSpectrums.length,
            averageRoundTime: this.ROUND_DURATION // Simplified for now
        };
    }

    /**
     * Validate clue text
     */
    validateClue(clue) {
        if (!clue || typeof clue !== 'string') {
            return { valid: false, error: 'Clue must be text' };
        }
        
        const trimmed = clue.trim();
        
        if (trimmed.length === 0) {
            return { valid: false, error: 'Clue cannot be empty' };
        }
        
        if (trimmed.length > 100) {
            return { valid: false, error: 'Clue must be 100 characters or less' };
        }
        
        // Check for numbers (which might give away the position)
        if (/\d/.test(trimmed)) {
            return { valid: false, error: 'Clue cannot contain numbers' };
        }
        
        return { valid: true };
    }

    /**
     * Validate guess position
     */
    validateGuess(position) {
        const num = Number(position);
        
        if (isNaN(num)) {
            return { valid: false, error: 'Guess must be a number' };
        }
        
        if (num < 0 || num > 100) {
            return { valid: false, error: 'Guess must be between 0 and 100' };
        }
        
        return { valid: true };
    }

    /**
     * Check if game can start
     */
    canStartGame(room) {
        const playerCount = room.players.size;
        return playerCount >= this.MIN_PLAYERS && playerCount <= this.MAX_PLAYERS;
    }

    /**
     * Get game configuration
     */
    getGameConfig() {
        return {
            ROUND_DURATION: this.ROUND_DURATION,
            MAX_ROUNDS: this.MAX_ROUNDS,
            MIN_PLAYERS: this.MIN_PLAYERS,
            MAX_PLAYERS: this.MAX_PLAYERS,
            BONUS_THRESHOLD: this.BONUS_THRESHOLD,
            BONUS_POINTS: this.BONUS_POINTS
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear all timers
        this.gameTimers.forEach((timer, roomId) => {
            clearInterval(timer);
        });
        this.gameTimers.clear();
        
        console.log('🧹 GameManager cleaned up');
    }
}

module.exports = { GameManager };