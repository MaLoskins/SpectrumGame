/**
 * Client-side game logic and utilities for Spectrum
 * Handles game rule validation, score calculations, and utility functions
 * UPDATED: Support for 2D coordinate system
 */

class GameLogic {
    constructor() {
        Object.assign(this, {
            SPECTRUM_MIN: 0,
            SPECTRUM_MAX: 100,
            MAX_CLUE_LENGTH: 100,
            MAX_PLAYER_NAME_LENGTH: 20,
            ROUND_DURATION: 60,
            BONUS_THRESHOLD: 10,
            BONUS_POINTS: 50,
            MIN_PLAYERS: 2,
            MAX_PLAYERS: 4,
            MAX_DISTANCE: Math.sqrt(20000) // ~141.4
        });
    }

    // Core calculations
    calculateDistance = (guess, target) => Math.hypot(guess.x - target.x, guess.y - target.y);
    
    calculateScore(guess, target) {
        const distance = this.calculateDistance(guess, target);
        const normalizedDistance = distance / this.MAX_DISTANCE;
        return { 
            baseScore: Math.max(0, Math.round(100 * (1 - normalizedDistance))), 
            distance: Math.round(distance * 10) / 10,
            distancePercentage: normalizedDistance 
        };
    }

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

    getBestGuess(guesses, target) {
        const entries = Object.entries(guesses || {});
        return entries.reduce((best, [playerId, guess]) => {
            const distance = this.calculateDistance(guess, target);
            return distance < best.distance ? { playerId, guess, distance } : best;
        }, { distance: Infinity });
    }

    // Validation methods
    validateGuess = coord => coord && typeof coord.x === 'number' && typeof coord.y === 'number' &&
        coord.x >= this.SPECTRUM_MIN && coord.x <= this.SPECTRUM_MAX &&
        coord.y >= this.SPECTRUM_MIN && coord.y <= this.SPECTRUM_MAX;

    validateInput(value, maxLength, pattern, emptyError, lengthError, formatError) {
        const trimmed = value?.trim();
        if (!trimmed) return { valid: false, error: emptyError };
        if (trimmed.length > maxLength) return { valid: false, error: lengthError };
        if (pattern && !pattern.test(trimmed)) return { valid: false, error: formatError };
        return { valid: true, value: trimmed };
    }

    validateClue = clue => this.validateInput(clue, this.MAX_CLUE_LENGTH, /^[^\d]+$/, 
        'Clue cannot be empty', `Clue must be ${this.MAX_CLUE_LENGTH} characters or less`, 'Clue cannot contain numbers');

    validatePlayerName = name => this.validateInput(name, this.MAX_PLAYER_NAME_LENGTH, /^[a-zA-Z0-9\s\-_]+$/,
        'Name cannot be empty', `Name must be ${this.MAX_PLAYER_NAME_LENGTH} characters or less`, 
        'Name can only contain letters, numbers, spaces, hyphens, and underscores');

    validateRoomCode = code => {
        const result = this.validateInput(code?.toUpperCase(), 6, /^[A-Z0-9]{4,6}$/, 
            'Room code cannot be empty', '', 'Room code must be 4-6 characters (letters and numbers only)');
        return result.valid ? { ...result, code: result.value } : result;
    };

    // UI helpers
    formatTimeRemaining = seconds => seconds <= 0 ? '0:00' : `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    
    getTimeWarningLevel = (timeRemaining, totalTime) => 
        timeRemaining / totalTime <= 0.1 ? 'danger' : timeRemaining / totalTime <= 0.25 ? 'warning' : 'normal';

    calculateGameProgress = (currentRound, totalRounds) => Math.round((currentRound / totalRounds) * 100);

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

    // Coordinate helpers
    getCoordinatePercentage = coord => ({ x: Math.max(0, Math.min(100, coord.x)), y: Math.max(0, Math.min(100, coord.y)) });
    percentageToCoordinate = (xPercent, yPercent) => ({ x: Math.round(Math.max(0, Math.min(100, xPercent))), y: Math.round(Math.max(0, Math.min(100, yPercent))) });
    generateRandomTarget = (margin = 5) => ({ 
        x: Math.floor(Math.random() * (this.SPECTRUM_MAX - 2 * margin + 1)) + margin,
        y: Math.floor(Math.random() * (this.SPECTRUM_MAX - 2 * margin + 1)) + margin
    });

    // Game state helpers
    allPlayersGuessed = (players, clueGiverId) => Object.values(players).filter(p => p.id !== clueGiverId).every(p => p.hasGuessed);
    getPlayerRoleText = (playerId, clueGiverId) => playerId === clueGiverId ? 'Clue Giver' : 'Guesser';
    calculateRankings = players => Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, index) => ({ ...player, rank: index + 1 }));

    getDistanceDescription = distance => 
        distance <= 5 ? 'Perfect!' : distance <= 10 ? 'Excellent!' : distance <= 20 ? 'Very close!' :
        distance <= 35 ? 'Close!' : distance <= 50 ? 'Not bad!' : 'Try again!';

    getScoreColor = score => score >= 80 ? '#4CAF50' : score >= 60 ? '#FF9800' : score >= 40 ? '#FFC107' : '#F44336';

    canStartGame = (players, minPlayers = this.MIN_PLAYERS) => {
        const count = Object.keys(players).length;
        return count >= minPlayers && count <= this.MAX_PLAYERS;
    };

    getNextClueGiver(players, currentClueGiverId) {
        const playerIds = Object.keys(players);
        return playerIds[(playerIds.indexOf(currentClueGiverId) + 1) % playerIds.length];
    }

    formatScore = score => Math.round(score || 0).toLocaleString();

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

    deepClone = obj => JSON.parse(JSON.stringify(obj));
    generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
    checkBonusEligibility = (guesses, target) => guesses?.length && guesses.every(g => this.calculateDistance(g, target) <= this.BONUS_THRESHOLD);
    getGamePhaseOrder = () => ['lobby', 'waiting', 'giving-clue', 'guessing', 'scoring', 'finished'];

    isValidPhaseTransition(currentPhase, newPhase) {
        const transitions = {
            lobby: ['waiting', 'giving-clue'],
            waiting: ['giving-clue', 'lobby'],
            'giving-clue': ['guessing', 'lobby'],
            guessing: ['scoring', 'lobby'],
            scoring: ['giving-clue', 'finished', 'lobby'],
            finished: ['lobby']
        };
        return transitions[currentPhase]?.includes(newPhase) || false;
    }

    getSpectrumGradient(spectrum) {
        if (!spectrum?.gradient) return 'linear-gradient(90deg, #ccc, #666)';
        const { start, middle, end } = spectrum.gradient;
        return middle ? `linear-gradient(90deg, ${start} 0%, ${middle} 50%, ${end} 100%)` : `linear-gradient(90deg, ${start} 0%, ${end} 100%)`;
    }

    create2DGradient(spectrumX, spectrumY) {
        if (!spectrumX?.gradient || !spectrumY?.gradient) return { background: 'linear-gradient(45deg, #333, #666)', fallback: '#444' };
        
        return {
            background: `linear-gradient(to right, ${spectrumX.gradient.start}00, ${spectrumX.gradient.end}ff), linear-gradient(to bottom, ${spectrumY.gradient.start}ff, ${spectrumY.gradient.end}00)`,
            backgroundBlendMode: 'multiply',
            fallback: spectrumX.gradient.middle || '#666'
        };
    }
}

export const gameLogic = new GameLogic();
export { GameLogic };