/**
 * Client-side game logic and utilities for Spectrum
 * Handles game rule validation, score calculations, and utility functions
 */

class GameLogic {
    constructor() {
        // Game constants - match server constants
        this.SPECTRUM_MIN = 0;
        this.SPECTRUM_MAX = 100;
        this.MAX_CLUE_LENGTH = 100;
        this.MAX_PLAYER_NAME_LENGTH = 20;
        this.ROUND_DURATION = 60; // seconds
        this.BONUS_THRESHOLD = 10; // percentage
        this.BONUS_POINTS = 50;
        this.MIN_PLAYERS = 2;
        this.MAX_PLAYERS = 4;
    }

    /**
     * Calculate distance between guess and target
     * @param {number} guess - Player's guess position
     * @param {number} target - Target position
     * @returns {number} Distance between guess and target
     */
    calculateDistance(guess, target) {
        return Math.abs(guess - target);
    }

    /**
     * Calculate score based on distance from target
     * Formula: Math.max(0, 100 - Math.abs(targetPosition - guessPosition))
     * @param {number} guess - Player's guess position
     * @param {number} target - Target position
     * @returns {Object} Score calculation result
     */
    calculateScore(guess, target) {
        const distance = this.calculateDistance(guess, target);
        const baseScore = Math.max(0, 100 - distance);
        
        return {
            baseScore,
            distance,
            distancePercentage: distance / 100
        };
    }

    /**
     * Calculate Clue Giver score based on all guesses
     * @param {Array} guesses - Array of guess positions
     * @param {number} target - Target position
     * @returns {Object} Clue giver score calculation
     */
    calculateClueGiverScore(guesses, target) {
        if (!guesses || guesses.length === 0) {
            return {
                score: 0,
                averageScore: 0,
                bonusAwarded: false,
                bonusPoints: 0
            };
        }

        const scores = guesses.map(guess => this.calculateScore(guess, target));
        const averageScore = scores.reduce((sum, s) => sum + s.baseScore, 0) / scores.length;
        
        // Bonus if all guesses within threshold
        const allWithinBonus = scores.every(s => s.distancePercentage <= (this.BONUS_THRESHOLD / 100));
        const bonusPoints = allWithinBonus ? this.BONUS_POINTS : 0;
        
        return {
            score: Math.round(averageScore) + bonusPoints,
            averageScore: Math.round(averageScore),
            bonusAwarded: allWithinBonus,
            bonusPoints
        };
    }

    /**
     * Determine the best guess (closest to target)
     * @param {Object} guesses - Object with playerId: guess pairs
     * @param {number} target - Target position
     * @returns {Object|null} Best guess information
     */
    getBestGuess(guesses, target) {
        if (!guesses || Object.keys(guesses).length === 0) {
            return null;
        }

        let bestPlayerId = null;
        let bestDistance = Infinity;

        Object.entries(guesses).forEach(([playerId, guess]) => {
            const distance = this.calculateDistance(guess, target);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestPlayerId = playerId;
            }
        });

        return {
            playerId: bestPlayerId,
            guess: guesses[bestPlayerId],
            distance: bestDistance
        };
    }

    /**
     * Validate guess position
     * @param {number} position - Guess position
     * @returns {boolean} True if valid
     */
    validateGuess(position) {
        const num = Number(position);
        return !isNaN(num) && num >= this.SPECTRUM_MIN && num <= this.SPECTRUM_MAX;
    }

    /**
     * Validate clue text
     * @param {string} clue - Clue text
     * @returns {Object} Validation result
     */
    validateClue(clue) {
        if (!clue || typeof clue !== 'string') {
            return { valid: false, error: 'Clue must be text' };
        }

        const trimmed = clue.trim();
        
        if (trimmed.length === 0) {
            return { valid: false, error: 'Clue cannot be empty' };
        }
        
        if (trimmed.length > this.MAX_CLUE_LENGTH) {
            return { valid: false, error: `Clue must be ${this.MAX_CLUE_LENGTH} characters or less` };
        }

        // Check for forbidden content (numbers that might give away position)
        if (this.containsNumbers(trimmed)) {
            return { valid: false, error: 'Clue cannot contain numbers' };
        }

        return { valid: true };
    }

    /**
     * Validate player name
     * @param {string} name - Player name
     * @returns {Object} Validation result
     */
    validatePlayerName(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: 'Name must be text' };
        }

        const trimmed = name.trim();
        
        if (trimmed.length === 0) {
            return { valid: false, error: 'Name cannot be empty' };
        }
        
        if (trimmed.length > this.MAX_PLAYER_NAME_LENGTH) {
            return { valid: false, error: `Name must be ${this.MAX_PLAYER_NAME_LENGTH} characters or less` };
        }

        // Check for forbidden characters
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
            return { valid: false, error: 'Name can only contain letters, numbers, spaces, hyphens, and underscores' };
        }

        return { valid: true };
    }

    /**
     * Validate room code
     * @param {string} code - Room code
     * @returns {Object} Validation result
     */
    validateRoomCode(code) {
        if (!code || typeof code !== 'string') {
            return { valid: false, error: 'Room code must be text' };
        }

        const trimmed = code.trim().toUpperCase();
        
        if (!/^[A-Z0-9]{4,6}$/.test(trimmed)) {
            return { valid: false, error: 'Room code must be 4-6 characters (letters and numbers only)' };
        }

        return { valid: true, code: trimmed };
    }

    /**
     * Check if text contains numbers
     * @param {string} text - Text to check
     * @returns {boolean} True if contains numbers
     */
    containsNumbers(text) {
        return /\d/.test(text);
    }

    /**
     * Format time remaining
     * @param {number} seconds - Seconds remaining
     * @returns {string} Formatted time string
     */
    formatTimeRemaining(seconds) {
        if (seconds <= 0) {
            return '0:00';
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get time warning level
     * @param {number} timeRemaining - Time remaining in seconds
     * @param {number} totalTime - Total time for the phase
     * @returns {string} Warning level: 'normal', 'warning', 'danger'
     */
    getTimeWarningLevel(timeRemaining, totalTime) {
        const percentage = timeRemaining / totalTime;
        
        if (percentage <= 0.1) {
            return 'danger'; // 10% or less
        } else if (percentage <= 0.25) {
            return 'warning'; // 25% or less
        }
        
        return 'normal';
    }

    /**
     * Calculate game progress
     * @param {number} currentRound - Current round number
     * @param {number} totalRounds - Total number of rounds
     * @returns {number} Progress percentage
     */
    calculateGameProgress(currentRound, totalRounds) {
        return Math.round((currentRound / totalRounds) * 100);
    }

    /**
     * Determine game phase display text
     * @param {string} phase - Current game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     * @param {number} timeRemaining - Time remaining in current phase
     * @returns {string} Display text for the phase
     */
    getPhaseDisplayText(phase, isClueGiver = false, timeRemaining = 0) {
        switch (phase) {
            case 'lobby':
                return 'Waiting for players...';
            case 'waiting':
                return 'Get ready for the next round!';
            case 'giving-clue':
                return isClueGiver ? 'Give a clue for your target!' : 'Waiting for clue...';
            case 'guessing':
                return isClueGiver ? 'Players are guessing...' : 'Make your guess!';
            case 'scoring':
                return 'Round results';
            case 'finished':
                return 'Game finished!';
            default:
                return 'Loading...';
        }
    }

    /**
     * Get spectrum position as percentage
     * @param {number} position - Position value
     * @returns {number} Clamped percentage
     */
    getSpectrumPercentage(position) {
        return Math.max(0, Math.min(100, position));
    }

    /**
     * Convert percentage to spectrum position
     * @param {number} percentage - Percentage value
     * @returns {number} Position value
     */
    percentageToPosition(percentage) {
        return Math.round(Math.max(0, Math.min(100, percentage)));
    }

    /**
     * Generate random target position (avoiding edges)
     * @param {number} minMargin - Minimum margin from edges
     * @returns {number} Random target position
     */
    generateRandomTarget(minMargin = 5) {
        const min = this.SPECTRUM_MIN + minMargin;
        const max = this.SPECTRUM_MAX - minMargin;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Check if all players have guessed
     * @param {Object} players - Players object
     * @param {string} clueGiverId - ID of clue giver
     * @returns {boolean} True if all non-clue-giver players have guessed
     */
    allPlayersGuessed(players, clueGiverId) {
        const guessers = Object.values(players).filter(p => p.id !== clueGiverId);
        return guessers.every(p => p.hasGuessed);
    }

    /**
     * Get player role display text
     * @param {string} playerId - Player ID
     * @param {string} clueGiverId - Clue giver ID
     * @returns {string} Role text
     */
    getPlayerRoleText(playerId, clueGiverId) {
        return playerId === clueGiverId ? 'Clue Giver' : 'Guesser';
    }

    /**
     * Calculate leaderboard rankings
     * @param {Object} players - Players object
     * @returns {Array} Sorted array of players with rankings
     */
    calculateRankings(players) {
        return Object.values(players)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .map((player, index) => ({
                ...player,
                rank: index + 1
            }));
    }

    /**
     * Get distance description
     * @param {number} distance - Distance from target
     * @returns {string} Description of the distance
     */
    getDistanceDescription(distance) {
        if (distance <= 5) {
            return 'Excellent!';
        } else if (distance <= 15) {
            return 'Very close!';
        } else if (distance <= 30) {
            return 'Close!';
        } else if (distance <= 50) {
            return 'Not bad!';
        } else {
            return 'Try again!';
        }
    }

    /**
     * Get score color based on performance
     * @param {number} score - Score value
     * @returns {string} CSS color value
     */
    getScoreColor(score) {
        if (score >= 80) {
            return '#4CAF50'; // Green
        } else if (score >= 60) {
            return '#FF9800'; // Orange
        } else if (score >= 40) {
            return '#FFC107'; // Yellow
        } else {
            return '#F44336'; // Red
        }
    }

    /**
     * Check if game can start
     * @param {Object} players - Players object
     * @param {number} minPlayers - Minimum number of players
     * @returns {boolean} True if game can start
     */
    canStartGame(players, minPlayers = this.MIN_PLAYERS) {
        const playerCount = Object.keys(players).length;
        return playerCount >= minPlayers && playerCount <= this.MAX_PLAYERS;
    }

    /**
     * Get next clue giver in rotation
     * @param {Object} players - Players object
     * @param {string} currentClueGiverId - Current clue giver ID
     * @returns {string} Next clue giver ID
     */
    getNextClueGiver(players, currentClueGiverId) {
        const playerIds = Object.keys(players);
        const currentIndex = playerIds.indexOf(currentClueGiverId);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        return playerIds[nextIndex];
    }

    /**
     * Format score for display
     * @param {number} score - Score value
     * @returns {string} Formatted score string
     */
    formatScore(score) {
        return Math.round(score || 0).toLocaleString();
    }

    /**
     * Get game statistics
     * @param {Array} gameHistory - Array of round history
     * @returns {Object|null} Game statistics
     */
    calculateGameStats(gameHistory) {
        if (!gameHistory || gameHistory.length === 0) {
            return null;
        }

        const totalRounds = gameHistory.length;
        const averageDistance = gameHistory.reduce((sum, round) => {
            const distances = Object.values(round.guesses || {}).map(guess => 
                this.calculateDistance(guess, round.target)
            );
            const avgDistance = distances.length > 0 
                ? distances.reduce((s, d) => s + d, 0) / distances.length 
                : 0;
            return sum + avgDistance;
        }, 0) / totalRounds;

        const bonusRounds = gameHistory.filter(round => round.bonusAwarded).length;

        return {
            totalRounds,
            averageDistance: Math.round(averageDistance * 10) / 10,
            bonusRounds,
            bonusPercentage: Math.round((bonusRounds / totalRounds) * 100)
        };
    }

    /**
     * Utility method to deep clone objects
     * @param {Object} obj - Object to clone
     * @returns {Object} Deep cloned object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Utility method to generate unique IDs
     * @returns {string} Unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Check if bonus is eligible for given guesses
     * @param {Array} guesses - Array of guess positions
     * @param {number} target - Target position
     * @returns {boolean} True if bonus eligible
     */
    checkBonusEligibility(guesses, target) {
        if (!guesses || guesses.length === 0) {
            return false;
        }

        return guesses.every(guess => {
            const distance = this.calculateDistance(guess, target);
            return distance <= this.BONUS_THRESHOLD;
        });
    }

    /**
     * Get game phase order
     * @returns {Array} Array of game phases in order
     */
    getGamePhaseOrder() {
        return ['lobby', 'waiting', 'giving-clue', 'guessing', 'scoring', 'finished'];
    }

    /**
     * Check if phase transition is valid
     * @param {string} currentPhase - Current phase
     * @param {string} newPhase - New phase
     * @returns {boolean} True if transition is valid
     */
    isValidPhaseTransition(currentPhase, newPhase) {
        const validTransitions = {
            'lobby': ['waiting', 'giving-clue'],
            'waiting': ['giving-clue', 'lobby'],
            'giving-clue': ['guessing', 'lobby'],
            'guessing': ['scoring', 'lobby'],
            'scoring': ['giving-clue', 'finished', 'lobby'],
            'finished': ['lobby']
        };

        return validTransitions[currentPhase]?.includes(newPhase) || false;
    }

    /**
     * Get spectrum gradient CSS
     * @param {Object} spectrum - Spectrum object
     * @returns {string} CSS gradient string
     */
    getSpectrumGradient(spectrum) {
        if (!spectrum || !spectrum.gradient) {
            return 'linear-gradient(90deg, #ccc, #666)';
        }

        const { start, middle, end } = spectrum.gradient;
        
        if (middle) {
            return `linear-gradient(90deg, ${start} 0%, ${middle} 50%, ${end} 100%)`;
        } else {
            return `linear-gradient(90deg, ${start} 0%, ${end} 100%)`;
        }
    }
}

// Export singleton instance
export const gameLogic = new GameLogic();
export { GameLogic };