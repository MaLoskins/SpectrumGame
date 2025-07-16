/**
 * Client-side game logic and utilities for Spectrum
 * Handles game rule validation, score calculations, and utility functions
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
            MAX_PLAYERS: 4
        });
    }

    calculateDistance = (guess, target) => Math.abs(guess - target);

    calculateScore(guess, target) {
        const distance = this.calculateDistance(guess, target);
        const baseScore = Math.max(0, 100 - distance);
        return { baseScore, distance, distancePercentage: distance / 100 };
    }

    calculateClueGiverScore(guesses, target) {
        if (!guesses?.length) return { score: 0, averageScore: 0, bonusAwarded: false, bonusPoints: 0 };
        
        const scores = guesses.map(g => this.calculateScore(g, target));
        const averageScore = scores.reduce((sum, s) => sum + s.baseScore, 0) / scores.length;
        const allWithinBonus = scores.every(s => s.distancePercentage <= this.BONUS_THRESHOLD / 100);
        const bonusPoints = allWithinBonus ? this.BONUS_POINTS : 0;
        
        return {
            score: Math.round(averageScore) + bonusPoints,
            averageScore: Math.round(averageScore),
            bonusAwarded: allWithinBonus,
            bonusPoints
        };
    }

    getBestGuess(guesses, target) {
        const entries = Object.entries(guesses || {});
        if (!entries.length) return null;
        
        return entries.reduce((best, [playerId, guess]) => {
            const distance = this.calculateDistance(guess, target);
            return distance < best.distance ? { playerId, guess, distance } : best;
        }, { distance: Infinity });
    }

    validateGuess = position => !isNaN(position) && position >= this.SPECTRUM_MIN && position <= this.SPECTRUM_MAX;

    validateClue(clue) {
        const trimmed = clue?.trim();
        if (!trimmed) return { valid: false, error: 'Clue cannot be empty' };
        if (trimmed.length > this.MAX_CLUE_LENGTH) 
            return { valid: false, error: `Clue must be ${this.MAX_CLUE_LENGTH} characters or less` };
        if (/\d/.test(trimmed)) return { valid: false, error: 'Clue cannot contain numbers' };
        return { valid: true };
    }

    validatePlayerName(name) {
        const trimmed = name?.trim();
        if (!trimmed) return { valid: false, error: 'Name cannot be empty' };
        if (trimmed.length > this.MAX_PLAYER_NAME_LENGTH) 
            return { valid: false, error: `Name must be ${this.MAX_PLAYER_NAME_LENGTH} characters or less` };
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) 
            return { valid: false, error: 'Name can only contain letters, numbers, spaces, hyphens, and underscores' };
        return { valid: true };
    }

    validateRoomCode(code) {
        const trimmed = code?.trim().toUpperCase();
        if (!/^[A-Z0-9]{4,6}$/.test(trimmed)) 
            return { valid: false, error: 'Room code must be 4-6 characters (letters and numbers only)' };
        return { valid: true, code: trimmed };
    }

    formatTimeRemaining(seconds) {
        if (seconds <= 0) return '0:00';
        return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    getTimeWarningLevel = (timeRemaining, totalTime) => 
        timeRemaining / totalTime <= 0.1 ? 'danger' : 
        timeRemaining / totalTime <= 0.25 ? 'warning' : 'normal';

    calculateGameProgress = (currentRound, totalRounds) => Math.round((currentRound / totalRounds) * 100);

    getPhaseDisplayText(phase, isClueGiver = false, timeRemaining = 0) {
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

    getSpectrumPercentage = position => Math.max(0, Math.min(100, position));
    percentageToPosition = percentage => Math.round(Math.max(0, Math.min(100, percentage)));
    generateRandomTarget = (minMargin = 5) => 
        Math.floor(Math.random() * (this.SPECTRUM_MAX - 2 * minMargin + 1)) + minMargin;

    allPlayersGuessed = (players, clueGiverId) => 
        Object.values(players).filter(p => p.id !== clueGiverId).every(p => p.hasGuessed);

    getPlayerRoleText = (playerId, clueGiverId) => playerId === clueGiverId ? 'Clue Giver' : 'Guesser';

    calculateRankings = players => 
        Object.values(players)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .map((player, index) => ({ ...player, rank: index + 1 }));

    getDistanceDescription = distance => 
        distance <= 5 ? 'Excellent!' :
        distance <= 15 ? 'Very close!' :
        distance <= 30 ? 'Close!' :
        distance <= 50 ? 'Not bad!' : 'Try again!';

    getScoreColor = score => 
        score >= 80 ? '#4CAF50' :
        score >= 60 ? '#FF9800' :
        score >= 40 ? '#FFC107' : '#F44336';

    canStartGame = (players, minPlayers = this.MIN_PLAYERS) => {
        const count = Object.keys(players).length;
        return count >= minPlayers && count <= this.MAX_PLAYERS;
    };

    getNextClueGiver(players, currentClueGiverId) {
        const playerIds = Object.keys(players);
        const currentIndex = playerIds.indexOf(currentClueGiverId);
        return playerIds[(currentIndex + 1) % playerIds.length];
    }

    formatScore = score => Math.round(score || 0).toLocaleString();

    calculateGameStats(gameHistory) {
        if (!gameHistory?.length) return null;
        
        const totalRounds = gameHistory.length;
        const averageDistance = gameHistory.reduce((sum, round) => {
            const distances = Object.values(round.guesses || {}).map(g => this.calculateDistance(g, round.target));
            return sum + (distances.length ? distances.reduce((s, d) => s + d, 0) / distances.length : 0);
        }, 0) / totalRounds;
        
        const bonusRounds = gameHistory.filter(r => r.bonusAwarded).length;
        
        return {
            totalRounds,
            averageDistance: Math.round(averageDistance * 10) / 10,
            bonusRounds,
            bonusPercentage: Math.round((bonusRounds / totalRounds) * 100)
        };
    }

    deepClone = obj => JSON.parse(JSON.stringify(obj));
    generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

    checkBonusEligibility = (guesses, target) => 
        guesses?.length && guesses.every(g => this.calculateDistance(g, target) <= this.BONUS_THRESHOLD);

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
        return middle 
            ? `linear-gradient(90deg, ${start} 0%, ${middle} 50%, ${end} 100%)`
            : `linear-gradient(90deg, ${start} 0%, ${end} 100%)`;
    }
}

export const gameLogic = new GameLogic();
export { GameLogic };