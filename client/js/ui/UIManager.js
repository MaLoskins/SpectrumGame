/**
 * UI Manager - Coordinates all UI interactions and state updates
 * Handles DOM manipulation, screen transitions, form validation, and reactive updates
 */

import { gameLogic } from '../game/GameLogic.js';

export class UIManager {
    constructor(stateManager, gameClient) {
        Object.assign(this, {
            stateManager,
            gameClient,
            elements: {},
            currentView: 'lobby',
            isInitialized: false,
            activeModal: null,
            notifications: [],
            debugMode: false
        });
    }

    async init() {
        console.log('🎨 Initializing UIManager...');
        this.cacheElements();
        this.setupEventListeners();
        this.setupStateListeners();
        this.initializeUI();
        this.isInitialized = true;
        console.log('✅ UIManager initialized');
    }

    cacheElements() {
        console.log('🎨 Caching DOM elements...');
        
        const elementMap = {
            app: '#app', lobby: '#lobby', gameRoom: '#game-room',
            createRoomBtn: '#create-room-btn', joinRoomBtn: '#join-room-btn',
            playerNameSection: '#player-name-section', roomCodeSection: '#room-code-section',
            playerNameInput: '#player-name', roomCodeInput: '#room-code',
            confirmActionBtn: '#confirm-action-btn', cancelActionBtn: '#cancel-action-btn',
            currentRoomCode: '#current-room-code', currentRound: '#current-round',
            totalRounds: '#total-rounds', gamePhaseText: '#game-phase-text', roundTimer: '#round-timer',
            spectrumName: '#spectrum-name', clueText: '#clue-text',
            leftLabel: '#left-label', rightLabel: '#right-label',
            leftValue: '#left-value', rightValue: '#right-value',
            spectrumLine: '#spectrum-line', targetMarker: '#target-marker', guessMarkers: '#guess-markers',
            playersContainer: '#players-container', scoreboardContainer: '#scoreboard-container',
            chatMessages: '#chat-messages', chatInput: '#chat-input',
            sendChatBtn: '#send-chat', toggleChatBtn: '#toggle-chat',
            clueInputSection: '#clue-input-section', guessInputSection: '#guess-input-section',
            waitingSection: '#waiting-section', resultsSection: '#results-section',
            clueInput: '#clue-input-field', submitClueBtn: '#submit-clue',
            guessSlider: '#guess-slider', guessValue: '#guess-value', submitGuessBtn: '#submit-guess',
            startGameBtn: '#start-game', waitingMessage: '#waiting-message',
            resultsContainer: '#results-container', nextRoundBtn: '#next-round',
            viewFinalScoresBtn: '#view-final-scores',
            modalOverlay: '#modal-overlay', modalTitle: '#modal-title',
            modalContent: '#modal-content', modalConfirm: '#modal-confirm',
            modalCancel: '#modal-cancel', modalClose: '#modal-close',
            loadingIndicator: '#loading-indicator', notificationsContainer: '#notifications-container'
        };
        
        Object.entries(elementMap).forEach(([key, selector]) => {
            this.elements[key] = document.querySelector(selector);
        });
        
        const criticalElements = ['clueInputSection', 'clueInput', 'submitClueBtn', 'guessInputSection', 'waitingSection'];
        const missingElements = criticalElements.filter(key => !this.elements[key]);
        
        if (missingElements.length > 0) {
            console.error('❌ Missing critical UI elements:', missingElements);
        } else if (this.debugMode) {
            console.log('✅ All critical elements cached successfully');
        }
    }

    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        const listeners = [
            [this.elements.createRoomBtn, 'click', () => this.handleCreateRoom()],
            [this.elements.joinRoomBtn, 'click', () => this.handleJoinRoom()],
            [this.elements.confirmActionBtn, 'click', () => this.handleConfirmAction()],
            [this.elements.cancelActionBtn, 'click', () => this.handleCancelAction()],
            [this.elements.startGameBtn, 'click', () => this.handleStartGame()],
            [this.elements.submitClueBtn, 'click', () => this.handleSubmitClue()],
            [this.elements.submitGuessBtn, 'click', () => this.handleSubmitGuess()],
            [this.elements.nextRoundBtn, 'click', () => this.handleNextRound()],
            [this.elements.viewFinalScoresBtn, 'click', () => this.handleViewFinalScores()],
            [this.elements.sendChatBtn, 'click', () => this.handleSendChat()],
            [this.elements.chatInput, 'keypress', e => { if (e.key === 'Enter') this.handleSendChat(); }],
            [this.elements.toggleChatBtn, 'click', () => this.handleToggleChat()],
            [this.elements.guessSlider, 'input', e => { this.elements.guessValue.textContent = e.target.value; }],
            [this.elements.modalClose, 'click', () => this.hideModal()],
            [this.elements.modalCancel, 'click', () => this.hideModal()],
            [this.elements.modalOverlay, 'click', e => { if (e.target === this.elements.modalOverlay) this.hideModal(); }],
            [document, 'keydown', e => this.handleKeyboardShortcuts(e)],
            [this.elements.playerNameInput, 'input', () => this.validatePlayerName()],
            [this.elements.roomCodeInput, 'input', () => this.validateRoomCode()],
            [this.elements.clueInput, 'input', () => this.validateClue()]
        ];
        
        listeners.forEach(([el, event, handler]) => el?.addEventListener(event, handler));
    }

    setupStateListeners() {
        const stateHandlers = {
            'connection.status': data => this.updateConnectionStatus(data.newValue),
            'game.phase': data => this.updateGamePhase(data.newValue),
            'game.spectrum': data => this.updateSpectrum(data.newValue),
            'game.clue': data => this.updateClue(data.newValue),
            'game.timeRemaining': data => this.updateTimer(data.newValue),
            'game.currentRound': data => this.updateRoundInfo(data.newValue),
            'players': data => { this.updatePlayerList(data.newValue); this.updateScoreboard(data.newValue); },
            'ui.currentView': data => this.switchView(data.newValue),
            'ui.activeModal': data => data.newValue ? this.showModal(data.newValue.id, data.newValue.data) : this.hideModal(),
            'ui.notifications': data => this.updateNotifications(data.newValue),
            'ui.loading': data => this.updateLoadingState(data.newValue),
            'chat.messages': data => this.updateChatMessages(data.newValue)
        };
        
        Object.entries(stateHandlers).forEach(([state, handler]) => 
            this.stateManager.on(`state:${state}`, handler));
    }

    initializeUI() {
        this.switchView('lobby');
        this.hideAllControlSections();
        this.resetLobbyForm();
        this.setupSpectrumInteraction();
    }

    handleCreateRoom() {
        this.addButtonPressEffect(this.elements.createRoomBtn);
        this.animateToInputState(() => {
            this.showPlayerNameInput();
            this.elements.confirmActionBtn.textContent = 'Create Room';
            this.elements.confirmActionBtn.dataset.action = 'create';
            this.showActionButtons();
        });
        setTimeout(() => this.elements.playerNameInput.focus(), 300);
    }

    handleJoinRoom() {
        this.addButtonPressEffect(this.elements.joinRoomBtn);
        this.animateToInputState(() => {
            this.showPlayerNameInput();
            this.showRoomCodeInput();
            this.elements.confirmActionBtn.textContent = 'Join Room';
            this.elements.confirmActionBtn.dataset.action = 'join';
            this.showActionButtons();
        });
        setTimeout(() => this.elements.playerNameInput.focus(), 300);
    }

    handleConfirmAction() {
        const action = this.elements.confirmActionBtn.dataset.action;
        const playerName = this.elements.playerNameInput.value.trim();
        
        if (!this.validatePlayerName()) {
            this.showNotification('Please enter a valid player name', 'error');
            return;
        }
        
        if (action === 'create') {
            this.stateManager.emit('ui:create-room', { playerName });
        } else if (action === 'join') {
            const roomCode = this.elements.roomCodeInput.value.trim();
            if (!this.validateRoomCode()) {
                this.showNotification('Please enter a valid room code', 'error');
                return;
            }
            this.stateManager.emit('ui:join-room', { playerName, roomCode });
        }
        
        this.resetLobbyForm();
    }

    handleCancelAction = () => this.resetLobbyForm();
    handleStartGame = () => this.stateManager.emit('ui:start-game');

    handleSubmitClue() {
        if (this.debugMode) console.log('🎯 Submit clue button clicked');
        
        if (!this.elements.clueInput) {
            console.error('❌ Clue input element not found!');
            this.showNotification('Error: Clue input not found', 'error');
            return;
        }
        
        const clue = this.elements.clueInput.value.trim();
        if (this.debugMode) console.log(`💡 Clue value: "${clue}"`);
        
        if (!this.validateClue()) {
            this.showValidationError(this.elements.clueInput, 'Please enter a valid clue (no numbers, 1-100 characters)');
            return;
        }
        
        this.addButtonPressEffect(this.elements.submitClueBtn);
        this.elements.clueInput.classList.add('animate-guess-submitted');
        
        if (this.debugMode) console.log('📤 Emitting clue submission event');
        this.stateManager.emit('ui:submit-clue', { clue });
        
        this.elements.clueInput.value = '';
        if (this.elements.submitClueBtn) this.elements.submitClueBtn.disabled = true;
        
        if (this.debugMode) this.showNotification('Clue submitted successfully! 🎯', 'success', 3000);
        
        setTimeout(() => this.elements.clueInput?.classList.remove('animate-guess-submitted'), 500);
    }

    handleSubmitGuess() {
        const position = parseInt(this.elements.guessSlider.value);
        
        if (this.elements.submitGuessBtn) this.elements.submitGuessBtn.disabled = true;
        
        this.addButtonPressEffect(this.elements.submitGuessBtn);
        this.elements.guessSlider.classList.add('animate-slider-pulse');
        
        this.stateManager.emit('ui:submit-guess', { position });
        
        if (this.debugMode) this.showNotification(`Guess submitted: ${position}% 🎲`, 'success', 3000);
        
        this.addGuessSubmissionEffect(position);
        
        setTimeout(() => this.elements.guessSlider.classList.remove('animate-slider-pulse'), 1000);
    }

    handleNextRound() {
        this.hideAllControlSections();
        this.elements.waitingSection.classList.remove('hidden');
        this.elements.waitingMessage.textContent = 'Preparing next round...';
    }

    handleViewFinalScores = () => this.showModal('final-scores', this.stateManager.getGameState().finalScores);

    handleSendChat() {
        const message = this.elements.chatInput.value.trim();
        if (message) {
            this.stateManager.emit('ui:send-chat', { message });
            this.elements.chatInput.value = '';
        }
    }

    handleToggleChat() {
        const chatVisible = this.stateManager.getUIState().chatVisible;
        this.stateManager.updateUIState({ chatVisible: !chatVisible });
        
        this.elements.chatMessages.style.display = chatVisible ? 'none' : 'flex';
        this.elements.toggleChatBtn.textContent = chatVisible ? '+' : '−';
    }

    handleKeyboardShortcuts(e) {
        const shortcuts = {
            Escape: () => this.activeModal && this.hideModal(),
            Enter: () => {
                const activeElement = document.activeElement;
                if ([this.elements.playerNameInput, this.elements.roomCodeInput].includes(activeElement)) {
                    this.handleConfirmAction();
                } else if (activeElement === this.elements.clueInput) {
                    this.handleSubmitClue();
                }
            }
        };
        shortcuts[e.key]?.();
    }

    updateConnectionStatus(status) {
        const messages = {
            connecting: 'Connecting...',
            connected: null,
            disconnected: this.debugMode ? 'Disconnected from server' : null,
            error: this.debugMode ? 'Connection error' : null
        };
        
        const indicator = this.elements.loadingIndicator;
        if (status === 'connecting') {
            indicator.classList.remove('hidden');
            indicator.querySelector('p').textContent = messages.connecting;
        } else {
            indicator.classList.add('hidden');
            if (messages[status]) this.showNotification(messages[status], 'error');
        }
    }

    updateGamePhase(phase) {
        const gameState = this.stateManager.getGameState();
        const isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        
        if (this.debugMode) console.log(`🎮 Updating game phase to: ${phase}, isClueGiver: ${isClueGiver}`);
        
        this.elements.gamePhaseText.textContent = gameLogic.getPhaseDisplayText(phase, isClueGiver, gameState.timeRemaining);
        
        this.hideAllControlSections();
        
        requestAnimationFrame(() => {
            const phaseHandlers = {
                lobby: () => this.handleLobbyPhase(),
                'giving-clue': () => this.handleGivingCluePhase(isClueGiver),
                guessing: () => this.handleGuessingPhase(isClueGiver),
                scoring: () => this.handleScoringPhase(),
                waiting: () => this.handleWaitingPhase(),
                results: () => this.handleResultsPhase(gameState),
                finished: () => this.handleFinishedPhase(gameState)
            };
            
            (phaseHandlers[phase] || (() => this.handleDefaultPhase()))();
            
            this.updateSpectrumInteraction(phase, isClueGiver);
            this.updateTimerVisibility(phase);
        });
    }

    handleLobbyPhase() {
        this.elements.waitingSection.classList.remove('hidden');
        this.elements.waitingMessage.textContent = 'Waiting for players...';
        
        const roomState = this.stateManager.getRoomState();
        const connectionState = this.stateManager.getConnectionState();
        
        if (this.debugMode) {
            console.log('🎮 Lobby phase - checking host status');
            console.log('Room hostId:', roomState.hostId);
            console.log('My playerId:', connectionState.playerId);
        }
        
        if (roomState.hostId === connectionState.playerId) {
            if (roomState.playerCount >= 2) {
                this.elements.startGameBtn.classList.remove('hidden');
            } else {
                this.elements.startGameBtn.classList.add('hidden');
                this.elements.waitingMessage.textContent = `Waiting for players... (${roomState.playerCount}/2 minimum)`;
            }
        } else {
            this.elements.startGameBtn.classList.add('hidden');
        }
    }

    handleGivingCluePhase(isClueGiver) {
        if (this.debugMode) console.log(`🎯 Giving clue phase - isClueGiver: ${isClueGiver}`);
        
        if (isClueGiver) {
            if (this.elements.clueInputSection) {
                this.elements.clueInputSection.classList.remove('hidden');
                
                if (this.elements.clueInput) {
                    this.elements.clueInput.value = '';
                    this.elements.clueInput.disabled = false;
                    this.elements.clueInput.classList.remove('error');
                }
                
                if (this.elements.submitClueBtn) {
                    this.elements.submitClueBtn.disabled = false;
                    this.elements.submitClueBtn.classList.remove('disabled');
                }
                
                setTimeout(() => this.elements.clueInput?.focus(), 100);
            } else {
                console.error('❌ Clue input section element not found!');
            }
        } else {
            this.elements.waitingSection.classList.remove('hidden');
            this.elements.waitingMessage.textContent = 'Waiting for clue...';
            this.elements.waitingMessage.classList.remove('animate-pulse');
        }
    }

    handleGuessingPhase(isClueGiver) {
        if (this.debugMode) console.log(`🎲 Guessing phase - isClueGiver: ${isClueGiver}`);
        
        if (!isClueGiver) {
            this.elements.guessInputSection.classList.remove('hidden');
            
            if (this.elements.submitGuessBtn) {
                this.elements.submitGuessBtn.disabled = false;
                this.elements.submitGuessBtn.classList.remove('disabled');
            }
            
            if (this.elements.guessSlider) {
                this.elements.guessSlider.value = 50;
                this.elements.guessValue.textContent = '50';
                this.elements.guessSlider.disabled = false;
            }
            
            setTimeout(() => this.elements.guessSlider?.focus(), 100);
        } else {
            this.elements.waitingSection.classList.remove('hidden');
            this.elements.waitingMessage.textContent = 'Players are guessing...';
            this.elements.waitingMessage.classList.add('animate-pulse');
        }
    }

    handleScoringPhase() {
        this.elements.waitingSection.classList.remove('hidden');
        this.elements.waitingMessage.textContent = 'Preparing next round...';
        this.elements.waitingMessage.classList.add('animate-pulse');
        
        this.elements.clueInputSection.classList.add('hidden');
        this.elements.guessInputSection.classList.add('hidden');
        this.elements.resultsSection.classList.add('hidden');
        this.elements.startGameBtn.classList.add('hidden');
        
        this.updateSpectrumInteraction('scoring', false);
        this.updateTimerVisibility('scoring');
    }

    handleWaitingPhase = () => this.handleScoringPhase();

    handleResultsPhase(gameState) {
        if (this.debugMode) console.log('📊 Results phase');
        
        this.elements.resultsSection.classList.remove('hidden');
        this.updateResultsDisplay(gameState);
        
        const showButton = gameState.currentRound < gameState.totalRounds 
            ? this.elements.nextRoundBtn 
            : this.elements.viewFinalScoresBtn;
        
        setTimeout(() => {
            showButton?.classList.remove('hidden');
            showButton?.focus();
        }, 3000);
    }

    handleFinishedPhase(gameState) {
        if (this.debugMode) console.log('🎉 Game finished phase');
        
        this.elements.resultsSection.classList.remove('hidden');
        this.elements.viewFinalScoresBtn.classList.remove('hidden');
        this.elements.nextRoundBtn.classList.add('hidden');
        
        this.updateFinalResultsDisplay(gameState);
        this.elements.viewFinalScoresBtn?.focus();
    }

    handleDefaultPhase() {
        this.elements.waitingSection.classList.remove('hidden');
        this.elements.waitingMessage.textContent = 'Loading...';
        this.elements.waitingMessage.classList.add('animate-pulse');
    }

    updateSpectrumInteraction(phase, isClueGiver) {
        const spectrumLine = this.elements.spectrumLine;
        if (!spectrumLine) return;
        
        const interactive = phase === 'guessing' && !isClueGiver;
        spectrumLine.classList.toggle('interactive', interactive);
        spectrumLine.classList.toggle('disabled', !interactive);
    }

    updateTimerVisibility(phase) {
        const timer = this.elements.roundTimer;
        if (!timer) return;
        
        const showTimer = ['giving-clue', 'guessing'].includes(phase);
        timer.style.visibility = showTimer ? 'visible' : 'hidden';
        
        if (!showTimer) {
            timer.textContent = '--';
            timer.className = 'timer';
        }
    }

    updateResultsDisplay(gameState) {
        const container = this.elements.resultsContainer;
        if (!container) return;
        
        container.innerHTML = `
            <div class="round-summary">
                <h4>Round ${gameState.currentRound} Results</h4>
                <p>Target was at: <strong>${gameState.targetPosition}%</strong></p>
            </div>
        `;
        
        if (gameState.guesses && gameState.roundScores) {
            Object.entries(gameState.guesses).forEach(([playerId, guess]) => {
                const player = this.stateManager.getPlayer(playerId);
                const score = gameState.roundScores[playerId] || 0;
                const distance = Math.abs(guess - gameState.targetPosition);
                
                container.appendChild(this.createPlayerResultElement(player, guess, score, distance));
            });
        }
        
        if (gameState.bonusAwarded) {
            const bonus = document.createElement('div');
            bonus.className = 'bonus-indicator animate-success-celebration';
            bonus.innerHTML = '🎉 <strong>Bonus Round!</strong> All players guessed within 10%!';
            container.appendChild(bonus);
        }
    }

    updateFinalResultsDisplay(gameState) {
        const container = this.elements.resultsContainer;
        if (!container) return;
        
        container.innerHTML = `
            <div class="game-summary">
                <h3>🎉 Game Complete!</h3>
                <p>Total Rounds Played: ${gameState.currentRound}</p>
            </div>
            <div class="scores-preview">
                <p>Click "View Final Scores" to see the winner!</p>
            </div>
        `;
    }

    createPlayerResultElement(player, guess, score, distance) {
        const div = document.createElement('div');
        div.className = 'player-result';
        
        if (distance <= 5) div.classList.add('excellent-guess');
        else if (distance <= 10) div.classList.add('good-guess');
        
        div.innerHTML = `
            <div class="player-result-header">
                <span class="player-name">${player?.name || 'Unknown'}</span>
                <span class="player-score">+${score} points</span>
            </div>
            <div class="player-result-details">
                <span class="guess-position">Guessed: ${guess}%</span>
                <span class="guess-distance">Distance: ${distance}</span>
            </div>
        `;
        
        return div;
    }

    updateSpectrum(spectrum) {
        if (!spectrum) return;
        
        Object.assign(this.elements, {
            spectrumName: { textContent: spectrum.name },
            leftLabel: { textContent: spectrum.leftLabel },
            rightLabel: { textContent: spectrum.rightLabel },
            leftValue: { textContent: spectrum.leftValue },
            rightValue: { textContent: spectrum.rightValue }
        });
        
        const gradient = gameLogic.getSpectrumGradient(spectrum);
        const spectrumGradient = this.elements.spectrumLine.querySelector('.spectrum-gradient');
        spectrumGradient.style.background = gradient;
    }

    updateClue(clue) {
        if (clue) {
            this.elements.clueText.textContent = clue;
            this.elements.clueText.classList.remove('hidden');
            this.elements.clueText.classList.add('animate-slide-in-top');
        } else {
            this.elements.clueText.classList.add('hidden');
        }
    }

    updateTimer(timeRemaining) {
        const formattedTime = gameLogic.formatTimeRemaining(timeRemaining);
        this.elements.roundTimer.textContent = formattedTime;
        
        const warningLevel = gameLogic.getTimeWarningLevel(timeRemaining, 60);
        this.elements.roundTimer.className = `timer ${warningLevel}`;
    }

    updateRoundInfo(currentRound) {
        const gameState = this.stateManager.getGameState();
        this.elements.currentRound.textContent = currentRound;
        this.elements.totalRounds.textContent = gameState.totalRounds;
        this.elements.currentRoomCode.textContent = this.stateManager.getConnectionState().roomCode;
    }

    updatePlayerList(players) {
        const container = this.elements.playersContainer;
        container.innerHTML = '';
        
        const gameState = this.stateManager.getGameState();
        const currentPlayerId = this.stateManager.getConnectionState().playerId;
        
        Object.values(players).forEach((player, index) => {
            container.appendChild(this.createPlayerElement(player, index, gameState, currentPlayerId));
        });
    }

    createPlayerElement(player, index, gameState, currentPlayerId) {
        const div = document.createElement('div');
        div.className = 'player-item';
        
        if (player.id === currentPlayerId) div.classList.add('current-player');
        if (player.id === gameState.clueGiverId) div.classList.add('clue-giver');
        
        const avatar = document.createElement('div');
        avatar.className = `player-avatar player-${(index % 4) + 1}`;
        avatar.textContent = player.name.charAt(0).toUpperCase();
        
        const info = document.createElement('div');
        info.className = 'player-info';
        
        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = player.name;
        
        const status = document.createElement('div');
        status.className = 'player-status';
        status.textContent = this.getPlayerStatus(player, gameState);
        
        info.append(name, status);
        div.append(avatar, info);
        
        return div;
    }

    getPlayerStatus(player, gameState) {
        if (player.id === gameState.clueGiverId) return 'Clue Giver';
        if (gameState.phase === 'guessing' && player.hasGuessed) return 'Guessed';
        if (gameState.phase === 'lobby') return 'Ready';
        return 'Waiting';
    }

    updateScoreboard(players) {
        const container = this.elements.scoreboardContainer;
        container.innerHTML = '';
        
        const rankings = gameLogic.calculateRankings(players);
        
        rankings.forEach((player, index) => {
            container.appendChild(this.createScoreElement(player, index === 0));
        });
    }

    createScoreElement(player, isLeader) {
        const div = document.createElement('div');
        div.className = 'score-item';
        if (isLeader) div.classList.add('leader');
        
        const playerName = document.createElement('span');
        playerName.className = 'score-player';
        playerName.textContent = player.name;
        
        const scoreValue = document.createElement('span');
        scoreValue.className = 'score-value';
        scoreValue.textContent = gameLogic.formatScore(player.score || 0);
        
        div.append(playerName, scoreValue);
        return div;
    }

    updateChatMessages(messages) {
        const container = this.elements.chatMessages;
        container.innerHTML = '';
        
        messages.forEach(message => {
            container.appendChild(this.createChatMessage(message));
        });
        
        container.scrollTop = container.scrollHeight;
    }

    createChatMessage(message) {
        const div = document.createElement('div');
        div.className = 'chat-message animate-message-slide-in';
        
        if (message.type === 'system') div.classList.add('system');
        
        const currentPlayerId = this.stateManager.getConnectionState().playerId;
        if (message.playerId === currentPlayerId) div.classList.add('own');
        
        if (message.type !== 'system') {
            const header = document.createElement('div');
            header.className = 'message-header';
            
            const sender = document.createElement('span');
            sender.className = 'message-sender';
            sender.textContent = message.playerName || 'Unknown';
            
            const time = document.createElement('span');
            time.className = 'message-time';
            time.textContent = new Date(message.timestamp).toLocaleTimeString();
            
            header.append(sender, time);
            div.appendChild(header);
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message.content || message.text;
        
        div.appendChild(content);
        return div;
    }

    switchView(view) {
        this.elements.lobby.classList.add('hidden');
        this.elements.gameRoom.classList.add('hidden');
        
        const viewElement = view === 'lobby' ? this.elements.lobby : this.elements.gameRoom;
        viewElement.classList.remove('hidden');
        viewElement.classList.add('animate-fade-in');
        
        this.currentView = view;
    }

    showLobby() {
        this.switchView('lobby');
        this.resetLobbyForm();
    }

    handleResize = () => {
        if (this.elements.spectrumCanvas) window.dispatchEvent(new Event('resize'));
        if (this.activeModal) this.repositionModal();
        if (this.elements.chatMessages) this.scrollChatToBottom();
    }

    repositionModal() {
        if (!this.activeModal || !this.elements.modalOverlay) return;
        const modal = this.elements.modalOverlay.querySelector('.modal');
        if (modal) modal.style.transform = '';
    }

    scrollChatToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }

    showModal(modalId, data = null) {
        this.elements.modalOverlay.classList.remove('hidden');
        this.elements.modalOverlay.classList.add('animate-fade-in');
        
        const modal = this.elements.modalOverlay.querySelector('.modal');
        modal.classList.add('animate-modal-slide-in');
        
        this.setModalContent(modalId, data);
        this.activeModal = modalId;
    }

    hideModal() {
        if (!this.activeModal) return;
        
        const modal = this.elements.modalOverlay.querySelector('.modal');
        modal.classList.add('animate-modal-slide-out');
        
        setTimeout(() => {
            this.elements.modalOverlay.classList.add('hidden');
            modal.classList.remove('animate-modal-slide-in', 'animate-modal-slide-out');
            this.activeModal = null;
            this.stateManager.hideModal();
        }, 300);
    }

    setModalContent(modalId, data) {
        const content = {
            'final-scores': () => {
                this.elements.modalTitle.textContent = 'Final Scores';
                this.elements.modalContent.innerHTML = this.generateFinalScoresHTML(data);
            },
            error: () => {
                this.elements.modalTitle.textContent = 'Error';
                this.elements.modalContent.innerHTML = `<p>${data.message}</p>`;
            }
        };
        
        (content[modalId] || (() => {
            this.elements.modalTitle.textContent = 'Information';
            this.elements.modalContent.innerHTML = '<p>No content available</p>';
        }))();
    }

    generateFinalScoresHTML(scores) {
        if (!scores) return '<p>No scores available</p>';
        
        const rankings = Object.entries(scores)
            .map(([playerId, score]) => ({
                playerId,
                score,
                name: this.stateManager.getPlayer(playerId)?.name || 'Unknown'
            }))
            .sort((a, b) => b.score - a.score);
        
        return rankings.map((player, index) => `
            <div class="player-result ${index === 0 ? 'best-guess' : ''}">
                <div class="player-result-name">${player.name}</div>
                <div class="player-result-score">${gameLogic.formatScore(player.score)}</div>
                <div class="player-result-distance">${index === 0 ? '🏆 Winner!' : `#${index + 1}`}</div>
            </div>
        `).join('');
    }

    showNotification(message, type = 'info', duration = 5000) {
        if (!this.debugMode && type !== 'error') return;
        
        this.stateManager.addNotification({ message, type, duration });
    }

    updateNotifications(notifications) {
        const container = this.elements.notificationsContainer;
        container.innerHTML = '';
        
        notifications.forEach(notification => {
            container.appendChild(this.createNotificationElement(notification));
        });
    }

    createNotificationElement(notification) {
        const div = document.createElement('div');
        div.className = `notification ${notification.type} animate-notification-slide-in`;
        div.dataset.id = notification.id;
        
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.textContent = { success: '✅', warning: '⚠️', error: '❌' }[notification.type] || 'ℹ️';
        
        const content = document.createElement('div');
        content.className = 'notification-content';
        
        if (notification.title) {
            const title = document.createElement('div');
            title.className = 'notification-title';
            title.textContent = notification.title;
            content.appendChild(title);
        }
        
        const message = document.createElement('div');
        message.className = 'notification-message';
        message.textContent = notification.message;
        content.appendChild(message);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.stateManager.removeNotification(notification.id));
        
        div.append(icon, content, closeBtn);
        return div;
    }

    updateLoadingState(loading) {
        this.elements.loadingIndicator.classList.toggle('hidden', !loading);
    }

    setupSpectrumInteraction() {
        this.elements.spectrumLine.addEventListener('click', e => {
            const gameState = this.stateManager.getGameState();
            const uiState = this.stateManager.getUIState();
            
            if (!uiState.spectrumInteractionEnabled || gameState.phase !== 'guessing') return;
            
            const rect = this.elements.spectrumLine.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const position = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
            
            this.elements.guessSlider.value = position;
            this.elements.guessValue.textContent = position;
            
            this.elements.spectrumLine.classList.add('animate-pulse');
            setTimeout(() => this.elements.spectrumLine.classList.remove('animate-pulse'), 300);
        });
    }

    validatePlayerName() {
        const name = this.elements.playerNameInput.value.trim();
        const validation = gameLogic.validatePlayerName(name);
        
        this.elements.playerNameInput.classList.toggle('error', !validation.valid);
        return validation.valid;
    }

    validateRoomCode() {
        const code = this.elements.roomCodeInput.value.trim();
        const validation = gameLogic.validateRoomCode(code);
        
        this.elements.roomCodeInput.classList.toggle('error', !validation.valid);
        return validation.valid;
    }

    validateClue() {
        const clue = this.elements.clueInput.value.trim();
        const validation = gameLogic.validateClue(clue);
        
        this.elements.clueInput.classList.toggle('error', !validation.valid);
        return validation.valid;
    }

    isHost() {
        const roomState = this.stateManager.getRoomState();
        const connectionState = this.stateManager.getConnectionState();
        const isHost = roomState.hostId === connectionState.playerId;
        
        if (this.debugMode) {
            console.log('🔍 Host check:', { hostId: roomState.hostId, playerId: connectionState.playerId, isHost });
        }
        
        return isHost;
    }

    showPlayerNameInput() {
        this.elements.playerNameSection.classList.remove('hidden');
        this.elements.playerNameInput.focus();
    }

    showRoomCodeInput = () => this.elements.roomCodeSection.classList.remove('hidden');

    showActionButtons() {
        this.elements.confirmActionBtn.classList.remove('hidden');
        this.elements.cancelActionBtn.classList.remove('hidden');
    }

    hideActionButtons() {
        this.elements.confirmActionBtn.classList.add('hidden');
        this.elements.cancelActionBtn.classList.add('hidden');
    }

    resetLobbyForm() {
        ['playerNameSection', 'roomCodeSection'].forEach(section => 
            this.elements[section].classList.add('hidden'));
        this.hideActionButtons();
        this.elements.playerNameInput.value = '';
        this.elements.roomCodeInput.value = '';
        this.elements.playerNameInput.classList.remove('error');
        this.elements.roomCodeInput.classList.remove('error');
    }

    hideAllControlSections() {
        ['clueInputSection', 'guessInputSection', 'waitingSection', 'resultsSection', 
         'startGameBtn', 'nextRoundBtn', 'viewFinalScoresBtn'].forEach(section => 
            this.elements[section]?.classList.add('hidden'));
    }

    addButtonPressEffect(button) {
        if (!button) return;
        
        button.classList.add('animate-button-press');
        
        const ripple = document.createElement('span');
        ripple.classList.add('ripple-effect');
        button.appendChild(ripple);
        
        setTimeout(() => {
            button.classList.remove('animate-button-press');
            if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        }, 300);
    }

    animateToInputState(callback) {
        const lobbyActions = document.querySelector('.lobby-actions');
        if (lobbyActions) {
            lobbyActions.classList.add('animate-fade-out');
            
            setTimeout(() => {
                callback();
                lobbyActions.classList.remove('animate-fade-out');
                lobbyActions.classList.add('animate-fade-in');
                
                setTimeout(() => lobbyActions.classList.remove('animate-fade-in'), 300);
            }, 150);
        } else {
            callback();
        }
    }

    showValidationError(element, message) {
        if (!element) return;
        
        element.classList.add('animate-error-shake');
        element.focus();
        
        this.showNotification(message, 'error', 4000);
        
        setTimeout(() => element.classList.remove('animate-error-shake'), 500);
    }

    addGuessSubmissionEffect(position) {
        const spectrumLine = this.elements.spectrumLine;
        if (!spectrumLine) return;
        
        const effect = document.createElement('div');
        Object.assign(effect.style, {
            position: 'absolute',
            left: `${position}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'var(--accent-green)',
            zIndex: '20'
        });
        effect.classList.add('animate-guess-placement');
        
        spectrumLine.appendChild(effect);
        
        setTimeout(() => effect.parentNode?.removeChild(effect), 800);
    }

    setEnhancedLoading(loading, message = 'Loading...', progress = null) {
        const indicator = this.elements.loadingIndicator;
        if (!indicator) return;
        
        if (loading) {
            indicator.classList.remove('hidden');
            indicator.classList.add('animate-fade-in');
            
            const messageEl = indicator.querySelector('p');
            if (messageEl) messageEl.textContent = message;
            
            const spinner = indicator.querySelector('.spinner');
            if (spinner) spinner.classList.add('spinner-enhanced');
        } else {
            indicator.classList.add('animate-fade-out');
            
            setTimeout(() => {
                indicator.classList.add('hidden');
                indicator.classList.remove('animate-fade-in', 'animate-fade-out');
                
                const spinner = indicator.querySelector('.spinner');
                if (spinner) spinner.classList.remove('spinner-enhanced');
            }, 300);
        }
    }

    destroy() {
        this.stateManager.removeAllListeners();
        this.elements = {};
        Object.assign(this, {
            currentView: 'lobby',
            isInitialized: false,
            activeModal: null,
            notifications: []
        });
        console.log('🧹 UIManager destroyed');
    }
}