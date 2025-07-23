/**
 * Client-side game logic and utilities for Spectrum
 * Handles game rule validation, score calculations, and utility functions
 * UPDATED: Support for 2D coordinate system
 */



class GameLogic {
    constructor() {
        Object.assign(this, {
            SPECTRUM_MIN: GAME_RULES.SPECTRUM_MIN,
            SPECTRUM_MAX: GAME_RULES.SPECTRUM_MAX,
            MAX_CLUE_LENGTH: VALIDATION.MAX_CLUE_LENGTH,
            MAX_PLAYER_NAME_LENGTH: VALIDATION.MAX_PLAYER_NAME_LENGTH,
            ROUND_DURATION: GAME_RULES.ROUND_DURATION,
            BONUS_THRESHOLD: SCORING.BONUS_THRESHOLD,
            BONUS_POINTS: SCORING.BONUS_POINTS,
            MIN_PLAYERS: GAME_RULES.MIN_PLAYERS,
            MAX_PLAYERS: GAME_RULES.MAX_PLAYERS,
            MAX_DISTANCE: GAME_RULES.MAX_DISTANCE
        });
    }

    /**
     * Calculate Euclidean distance between two coordinates
     * @param {Object} guess - Guess coordinate {x, y}
     * @param {Object} target - Target coordinate {x, y}
     * @returns {number} Euclidean distance
     */
    calculateDistance = (guess, target) => Math.hypot(guess.x - target.x, guess.y - target.y);
    
    /**
     * Calculate score based on distance between guess and target
     * @param {Object} guess - Guess coordinate {x, y}
     * @param {Object} target - Target coordinate {x, y}
     * @returns {Object} Score details including baseScore, distance, and distancePercentage
     */
    calculateScore(guess, target) {
        const distance = this.calculateDistance(guess, target);
        const normalizedDistance = distance / this.MAX_DISTANCE;
        return {
            baseScore: Math.max(0, Math.round(100 * (1 - normalizedDistance))),
            distance: Math.round(distance * 10) / 10,
            distancePercentage: normalizedDistance
        };
    }

    /**
     * Calculate clue giver's score based on all guesses
     * @param {Array} guesses - Array of guess coordinates
     * @param {Object} target - Target coordinate {x, y}
     * @returns {Object} Clue giver score details including score, averageScore, bonusAwarded, and bonusPoints
     */
    calculateClueGiverScore(guesses, target) {
        if (!guesses?.length) return { score: 0, averageScore: 0, bonusAwarded: false, bonusPoints: 0 };
        
        const scores = guesses.map(g => this.calculateScore(g, target));
        const averageScore = scores.reduce((sum, s) => sum + s.baseScore, 0) / scores.length;
        const bonusAwarded = scores.every(s => s.distance <= this.BONUS_THRESHOLD);
        
        return {
            score: Math.round(averageScore) + (bonusAwarded ? this.BONUS_POINTS : 0),
            averageScore: Math.round(averageScore),
            bonusAwarded,
            bonusPoints: bonusAwarded ? this.BONUS_POINTS : 0
        };
    }

    /**
     * Find the best guess (closest to target) among all guesses
     * @param {Object} guesses - Object mapping playerIds to guess coordinates
     * @param {Object} target - Target coordinate {x, y}
     * @returns {Object} Best guess details including playerId, guess, and distance
     */
    getBestGuess(guesses, target) {
        const entries = Object.entries(guesses || {});
        return entries.reduce((best, [playerId, guess]) => {
            const distance = this.calculateDistance(guess, target);
            return distance < best.distance ? { playerId, guess, distance } : best;
        }, { distance: Infinity });
    }

    // Validation methods
    validateGuess = coord => Validator.coordinate(coord, this.SPECTRUM_MIN, this.SPECTRUM_MAX).valid;

    validateInput(value, maxLength, pattern, emptyError, lengthError, formatError) {
        return Validator.input(value, maxLength, pattern, emptyError, lengthError, formatError);
    }

    validateClue = clue => Validator.clue(clue);

    validatePlayerName = name => Validator.playerName(name);

    validateRoomCode = code => {
        const result = Validator.roomCode(code);
        return result.valid ? { ...result, code: result.value } : result;
    };

    /**
     * Format time remaining in MM:SS format
     * @param {number} seconds - Time remaining in seconds
     * @returns {string} Formatted time string
     */
    formatTimeRemaining = seconds => seconds <= 0 ? '0:00' : `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    
    /**
     * Get warning level based on time remaining
     * @param {number} timeRemaining - Time remaining in seconds
     * @param {number} totalTime - Total time in seconds
     * @returns {string} Warning level: 'danger', 'warning', or 'normal'
     */
    getTimeWarningLevel = (timeRemaining, totalTime) =>
        timeRemaining / totalTime <= 0.1 ? 'danger' : timeRemaining / totalTime <= 0.25 ? 'warning' : 'normal';

    /**
     * Calculate game progress percentage
     * @param {number} currentRound - Current round number
     * @param {number} totalRounds - Total number of rounds
     * @returns {number} Progress percentage (0-100)
     */
    calculateGameProgress = (currentRound, totalRounds) => Math.round((currentRound / totalRounds) * 100);

    /**
     * Get display text for current game phase
     * @param {string} phase - Current game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     * @returns {string} Display text for the phase
     */
    getPhaseDisplayText(phase, isClueGiver = false) {
        const phases = {
            lobby: 'Waiting for players...',
            waiting: 'Get ready for the next round!',
            'giving-clue': isClueGiver ? 'Give a clue for your target!' : 'Waiting for clue...',
            guessing: isClueGiver ? 'Players are guessing...' : 'Make your guess!',
            scoring: 'Round results',
            finished: 'Game finished!'
        };
        return phases[phase] || 'Loading...';
    }

    /**
     * Ensure coordinate values are within valid percentage range (0-100)
     * @param {Object} coord - Coordinate to normalize {x, y}
     * @returns {Object} Normalized coordinate {x, y}
     */
    getCoordinatePercentage = coord => ({ x: Math.max(0, Math.min(100, coord.x)), y: Math.max(0, Math.min(100, coord.y)) });
    
    /**
     * Convert percentage values to valid coordinates
     * @param {number} xPercent - X percentage (0-100)
     * @param {number} yPercent - Y percentage (0-100)
     * @returns {Object} Coordinate {x, y}
     */
    percentageToCoordinate = (xPercent, yPercent) => ({ x: Math.round(Math.max(0, Math.min(100, xPercent))), y: Math.round(Math.max(0, Math.min(100, yPercent))) });
    
    /**
     * Generate a random target coordinate with margin from edges
     * @param {number} margin - Margin from edges (default: 5)
     * @returns {Object} Random coordinate {x, y}
     */
    generateRandomTarget = (margin = 5) => ({
        x: Math.floor(Math.random() * (this.SPECTRUM_MAX - 2 * margin + 1)) + margin,
        y: Math.floor(Math.random() * (this.SPECTRUM_MAX - 2 * margin + 1)) + margin
    });

    /**
     * Check if all players (except clue giver) have submitted guesses
     * @param {Object} players - Object containing player data
     * @param {string} clueGiverId - ID of the clue giver
     * @returns {boolean} Whether all players have guessed
     */
    allPlayersGuessed = (players, clueGiverId) => Object.values(players).filter(p => p.id !== clueGiverId).every(p => p.hasGuessed);
    
    /**
     * Get player role text based on whether they are the clue giver
     * @param {string} playerId - Player ID
     * @param {string} clueGiverId - ID of the clue giver
     * @returns {string} Role text: 'Clue Giver' or 'Guesser'
     */
    getPlayerRoleText = (playerId, clueGiverId) => playerId === clueGiverId ? 'Clue Giver' : 'Guesser';
    
    /**
     * Calculate player rankings based on scores
     * @param {Object} players - Object containing player data
     * @returns {Array} Sorted array of players with rank property added
     */
    calculateRankings = players => Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, index) => ({ ...player, rank: index + 1 }));

    /**
     * Get descriptive text for a guess distance
     * @param {number} distance - Distance between guess and target
     * @returns {string} Descriptive text based on distance
     */
    getDistanceDescription = distance =>
        distance <= 5 ? 'Perfect!' : distance <= 10 ? 'Excellent!' : distance <= 20 ? 'Very close!' :
        distance <= 35 ? 'Close!' : distance <= 50 ? 'Not bad!' : 'Try again!';

    /**
     * Get color for score display
     * @param {number} score - Player score
     * @returns {string} Color hex code based on score
     */
    getScoreColor = score => score >= 80 ? '#4CAF50' : score >= 60 ? '#FF9800' : score >= 40 ? '#FFC107' : '#F44336';

    /**
     * Check if game can be started based on player count
     * @param {Object} players - Object containing player data
     * @param {number} minPlayers - Minimum number of players required (default: MIN_PLAYERS)
     * @returns {boolean} Whether game can be started
     */
    canStartGame = (players, minPlayers = this.MIN_PLAYERS) => {
        const count = Object.keys(players).length;
        return count >= minPlayers && count <= this.MAX_PLAYERS;
    };

    /**
     * Get the next clue giver in rotation
     * @param {Object} players - Object containing player data
     * @param {string} currentClueGiverId - Current clue giver ID
     * @returns {string} Next clue giver ID
     */
    getNextClueGiver(players, currentClueGiverId) {
        const playerIds = Object.keys(players);
        return playerIds[(playerIds.indexOf(currentClueGiverId) + 1) % playerIds.length];
    }

    /**
     * Format score for display
     * @param {number} score - Score to format
     * @returns {string} Formatted score
     */
    formatScore = score => Math.round(score || 0).toLocaleString();

    /**
     * Calculate game statistics from game history
     * @param {Array} gameHistory - Array of round data
     * @returns {Object|null} Game statistics or null if no history
     */
    calculateGameStats(gameHistory) {
        if (!gameHistory?.length) return null;
        
        const totalRounds = gameHistory.length;
        const distances = gameHistory.flatMap(round =>
            Object.values(round.guesses || {}).map(g => this.calculateDistance(g, round.target))
        );
        const bonusRounds = gameHistory.filter(r => r.bonusAwarded).length;
        
        return {
            totalRounds,
            averageDistance: Math.round((distances.reduce((s, d) => s + d, 0) / distances.length) * 10) / 10,
            bonusRounds,
            bonusPercentage: Math.round((bonusRounds / totalRounds) * 100)
        };
    }

    /**
     * Deep clone an object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    deepClone = obj => JSON.parse(JSON.stringify(obj));
    
    /**
     * Generate a unique ID
     * @returns {string} Unique ID
     */
    generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
    // checkBonusEligibility removed - redundant with calculateClueGiverScore
    // getGamePhaseOrder removed - unused

    // isValidPhaseTransition removed - unused

    // getSpectrumGradient removed - unused

    // create2DGradient removed - unused
}

export const gameLogic = new GameLogic();
export { GameLogic };