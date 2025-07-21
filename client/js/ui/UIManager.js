/**
 * UI Manager - Coordinates all UI interactions and state updates
 * Handles DOM manipulation, screen transitions, form validation, and reactive updates
 * UPDATED: Integrated game controls into notification panel
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
            debugMode: false,
            // Performance optimizations
            animationFrame: null,
            domUpdateQueue: [],
            batchUpdateTimeout: null,
            // Dark mode colors for dynamic elements
            colors: {
                teal: '#00d4ff',
                lilac: '#b794f4',
                electricBlue: '#0096ff',
                pink: '#ff006e',
                green: '#00f593',
                orange: '#ff9500',
                red: '#ff3864',
                darkBg: '#0a0f1c',
                glassBg: 'rgba(255, 255, 255, 0.05)',
                textPrimary: '#e0e6f0',
                textSecondary: '#a8b2c7'
            }
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
        
        // Batch all DOM queries
        const elementMap = {
            app: '#app', 
            lobby: '#lobby', 
            gameRoom: '#game-room',
            createRoomBtn: '#create-room-btn', 
            joinRoomBtn: '#join-room-btn',
            playerNameSection: '#player-name-section', 
            roomCodeSection: '#room-code-section',
            playerNameInput: '#player-name', 
            roomCodeInput: '#room-code',
            confirmActionBtn: '#confirm-action-btn', 
            cancelActionBtn: '#cancel-action-btn',
            currentRoomCode: '#current-room-code', 
            currentRound: '#current-round',
            totalRounds: '#total-rounds', 
            gamePhaseText: '#game-phase-text', 
            roundTimer: '#round-timer',
            clueText: '#clue-text',
            spectrumXLeft: '#spectrumX-left',
            spectrumXRight: '#spectrumX-right',
            spectrumYTop: '#spectrumY-top',
            spectrumYBottom: '#spectrumY-bottom',
            spectrumXName: '#spectrumX-name',
            spectrumYName: '#spectrumY-name',
            playersContainer: '#players-container', 
            scoreboardContainer: '#scoreboard-container',
            chatMessages: '#chat-messages', 
            chatInput: '#chat-input',
            sendChatBtn: '#send-chat', 
            toggleChatBtn: '#toggle-chat',
            // Game control elements in notification panel
            gameControlContainer: '#game-control-container',
            clueInputSection: '#clue-input-section',
            guessInputSection: '#guess-input-section',
            waitingSection: '#waiting-section', 
            resultsSection: '#results-section',
            clueInput: '#clue-input-field', 
            submitClueBtn: '#submit-clue',
            startGameBtn: '#start-game', 
            waitingMessage: '#waiting-message',
            resultsContainer: '#results-container', 
            nextRoundBtn: '#next-round',
            viewFinalScoresBtn: '#view-final-scores',
            modalOverlay: '#modal-overlay', 
            modalTitle: '#modal-title',
            modalContent: '#modal-content', 
            modalConfirm: '#modal-confirm',
            modalCancel: '#modal-cancel', 
            modalClose: '#modal-close',
            loadingIndicator: '#loading-indicator', 
            notificationsContainer: '#notifications-container'
        };
        
        // Single batch query
        Object.entries(elementMap).forEach(([key, selector]) => {
            this.elements[key] = document.querySelector(selector);
        });
        
        const criticalElements = ['clueInputSection', 'clueInput', 'submitClueBtn', 'guessInputSection', 'waitingSection'];
        const missingElements = criticalElements.filter(key => !this.elements[key]);
        
        if (missingElements.length > 0) {
            console.error('❌ Missing critical UI elements:', missingElements);
        }
    }

    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        
        // Use event delegation for better performance
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        document.addEventListener('keydown', this.handleGlobalKeydown.bind(this));
        
        // Specific input handlers
        this.elements.playerNameInput?.addEventListener('input', () => this.validatePlayerName());
        this.elements.roomCodeInput?.addEventListener('input', () => this.validateRoomCode());
        this.elements.clueInput?.addEventListener('input', () => this.validateClue());
        this.elements.chatInput?.addEventListener('keypress', e => { if (e.key === 'Enter') this.handleSendChat(); });
    }

    handleGlobalClick(e) {
        const target = e.target;
        
        // Button clicks via delegation
        if (target.matches('#create-room-btn')) this.handleCreateRoom();
        else if (target.matches('#join-room-btn')) this.handleJoinRoom();
        else if (target.matches('#confirm-action-btn')) this.handleConfirmAction();
        else if (target.matches('#cancel-action-btn')) this.handleCancelAction();
        else if (target.matches('#start-game')) this.handleStartGame();
        else if (target.matches('#submit-clue')) this.handleSubmitClue();
        else if (target.matches('#next-round')) this.handleNextRound();
        else if (target.matches('#view-final-scores')) this.handleViewFinalScores();
        else if (target.matches('#send-chat')) this.handleSendChat();
        else if (target.matches('#toggle-chat')) this.handleToggleChat();
        else if (target.matches('#modal-close, #modal-cancel')) this.hideModal();
        else if (target === this.elements.modalOverlay) this.hideModal();
    }

    handleGlobalKeydown(e) {
        this.handleKeyboardShortcuts(e);
    }

    setupStateListeners() {
        const stateHandlers = {
            'connection.status': data => this.updateConnectionStatus(data.newValue),
            'game.phase': data => this.updateGamePhase(data.newValue),
            'game.spectrumX': () => this.queueDOMUpdate(() => this.updateSpectrumLabels()),
            'game.spectrumY': () => this.queueDOMUpdate(() => this.updateSpectrumLabels()),
            'game.clue': data => this.updateClue(data.newValue),
            'game.timeRemaining': data => this.updateTimer(data.newValue),
            'game.currentRound': data => this.updateRoundInfo(data.newValue),
            'players': data => this.queueDOMUpdate(() => {
                this.updatePlayerList(data.newValue);
                this.updateScoreboard(data.newValue);
            }),
            'ui.currentView': data => this.switchView(data.newValue),
            'ui.activeModal': data => data.newValue ? this.showModal(data.newValue.id, data.newValue.data) : this.hideModal(),
            'ui.notifications': data => this.queueDOMUpdate(() => this.updateNotifications(data.newValue)),
            'ui.loading': data => this.updateLoadingState(data.newValue),
            'chat.messages': data => this.queueDOMUpdate(() => this.updateChatMessages(data.newValue))
        };
        
        Object.entries(stateHandlers).forEach(([state, handler]) => 
            this.stateManager.on(`state:${state}`, handler));
    }

    // Batch DOM updates for performance
    queueDOMUpdate(updateFn) {
        this.domUpdateQueue.push(updateFn);
        
        if (!this.batchUpdateTimeout) {
            this.batchUpdateTimeout = requestAnimationFrame(() => {
                this.processDOMUpdates();
            });
        }
    }

    processDOMUpdates() {
        const updates = [...this.domUpdateQueue];
        this.domUpdateQueue = [];
        this.batchUpdateTimeout = null;
        
        // Execute all queued updates
        updates.forEach(fn => fn());
    }

    initializeUI() {
        this.switchView('lobby');
        this.hideAllControlSections();
        this.resetLobbyForm();
    }

    handleCreateRoom() {
        this.addButtonPressEffect(this.elements.createRoomBtn);
        this.animateToInputState(() => {
            this.showPlayerNameInput();
            this.elements.confirmActionBtn.textContent = 'Create Room';
            this.elements.confirmActionBtn.dataset.action = 'create';
            this.showActionButtons();
        });
        requestAnimationFrame(() => this.elements.playerNameInput.focus());
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
        requestAnimationFrame(() => this.elements.playerNameInput.focus());
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
        
        // Scroll notification panel to show relevant content
        const scrollToControl = () => {
            if (this.elements.gameControlContainer) {
                this.elements.gameControlContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        
        // Use requestAnimationFrame for DOM updates
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
            
            // Scroll to show relevant control section
            if (['giving-clue', 'results', 'finished'].includes(phase)) {
                setTimeout(scrollToControl, 300);
            }
        });
    }

    handleLobbyPhase() {
        this.updateSpectrumLabels();
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
                
                requestAnimationFrame(() => this.elements.clueInput?.focus());
                
                // Add notification badge
                this.showNotification('Your turn to give a clue!', 'info', 5000);
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
            
            // Add notification
            this.showNotification('Click on the grid to place your guess!', 'info', 5000);
        } else {
            this.elements.waitingSection.classList.remove('hidden');
            this.elements.waitingMessage.textContent = 'Players are guessing...';
            this.elements.waitingMessage.classList.add('animate-pulse');
        }
    }

    handleScoringPhase() {
        this.updateSpectrumLabels();
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

    handleWaitingPhase() {
        this.updateSpectrumLabels();
        this.handleScoringPhase();
    }

    handleResultsPhase(gameState) {
        if (this.debugMode) console.log('📊 Results phase');
        
        this.elements.resultsSection.classList.remove('hidden');
        this.updateResultsDisplay(gameState);
        
        // Add notification
        this.showNotification('Round complete! Check the results below.', 'success', 5000);
        
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
        
        // Add celebration notification
        this.showNotification('🎉 Game finished! Check the final scores!', 'success', 0);
    }

    handleDefaultPhase() {
        this.elements.waitingSection.classList.remove('hidden');
        this.elements.waitingMessage.textContent = 'Loading...';
        this.elements.waitingMessage.classList.add('animate-pulse');
    }

    updateSpectrumInteraction(phase, isClueGiver) {
        const spectrumWrapper = document.getElementById('spectrum-grid');
        if (!spectrumWrapper) return;
        
        const interactive = phase === 'guessing' && !isClueGiver;
        spectrumWrapper.classList.toggle('interactive', interactive);
        spectrumWrapper.classList.toggle('disabled', !interactive);
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
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        const summary = document.createElement('div');
        summary.className = 'round-summary';
        summary.innerHTML = `
            <p>Target was at: <strong>(${gameState.targetCoordinate?.x || 0}, ${gameState.targetCoordinate?.y || 0})</strong></p>
        `;
        fragment.appendChild(summary);
        
        if (gameState.guesses && gameState.roundScores) {
            Object.entries(gameState.guesses).forEach(([playerId, coordinate]) => {
                const player = this.stateManager.getPlayer(playerId);
                const score = gameState.roundScores[playerId] || 0;
                const distance = gameState.targetCoordinate ? 
                    Math.round(gameLogic.calculateDistance(coordinate, gameState.targetCoordinate) * 10) / 10 : 0;
                
                fragment.appendChild(this.createPlayerResultElement(player, coordinate, score, distance));
            });
        }
        
        if (gameState.bonusAwarded) {
            const bonus = document.createElement('div');
            bonus.className = 'bonus-indicator animate-success-celebration';
            bonus.innerHTML = '🎉 <strong>Bonus Round!</strong> All players guessed within 10 units!';
            fragment.appendChild(bonus);
        }
        
        // Single DOM update
        container.innerHTML = '';
        container.appendChild(fragment);
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

    createPlayerResultElement(player, coordinate, score, distance) {
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
                <span class="guess-position">Guessed: (${coordinate?.x || 0}, ${coordinate?.y || 0})</span>
                <span class="guess-distance">Distance: ${distance}</span>
            </div>
        `;
        
        return div;
    }

    updateSpectrumLabels() {
        const { spectrumX, spectrumY } = this.stateManager.getGameState();

        const setLabels = (nameEl, startEl, endEl, spectrum) => {
            if (spectrum) {
                if (nameEl) {
                    nameEl.textContent = spectrum.name;
                    nameEl.style.opacity = '1';
                }
                if (startEl) {
                    startEl.textContent = spectrum.leftLabel;
                    startEl.style.opacity = '1';
                }
                if (endEl) {
                    endEl.textContent = spectrum.rightLabel;
                    endEl.style.opacity = '1';
                }
            } else {
                if (nameEl) {
                    nameEl.textContent = '';
                    nameEl.style.opacity = '0';
                }
                if (startEl) {
                    startEl.textContent = '';
                    startEl.style.opacity = '0';
                }
                if (endEl) {
                    endEl.textContent = '';
                    endEl.style.opacity = '0';
                }
            }
        };

        // Set X-Axis Labels
        setLabels(this.elements.spectrumXName, this.elements.spectrumXLeft, this.elements.spectrumXRight, spectrumX);
        
        // Set Y-Axis Labels (Note: Top is rightLabel, Bottom is leftLabel for proper orientation)
        setLabels(this.elements.spectrumYName, this.elements.spectrumYBottom, this.elements.spectrumYTop, spectrumY);
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
        const fragment = document.createDocumentFragment();
        
        const gameState = this.stateManager.getGameState();
        const currentPlayerId = this.stateManager.getConnectionState().playerId;
        
        Object.values(players).forEach((player, index) => {
            fragment.appendChild(this.createPlayerElement(player, index, gameState, currentPlayerId));
        });
        
        // Single DOM update
        container.innerHTML = '';
        container.appendChild(fragment);
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
        const fragment = document.createDocumentFragment();
        
        const rankings = gameLogic.calculateRankings(players);
        
        rankings.forEach((player, index) => {
            fragment.appendChild(this.createScoreElement(player, index === 0));
        });
        
        // Single DOM update
        container.innerHTML = '';
        container.appendChild(fragment);
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
        const fragment = document.createDocumentFragment();
        
        messages.forEach(message => {
            fragment.appendChild(this.createChatMessage(message));
        });
        
        // Single DOM update
        container.innerHTML = '';
        container.appendChild(fragment);
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
        
        // Update room code display when switching to game view
        if (view === 'game') {
            const connectionState = this.stateManager.getConnectionState();
            if (connectionState.roomCode && this.elements.currentRoomCode) {
                this.elements.currentRoomCode.textContent = connectionState.roomCode;
            }
        }
    }

    showLobby() {
        this.switchView('lobby');
        this.resetLobbyForm();
    }

    handleResize = () => {
        if (window.dispatchEvent) window.dispatchEvent(new Event('resize'));
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
            'help': () => {
                this.elements.modalTitle.textContent = 'How to Play';
                this.elements.modalContent.innerHTML = data.content;
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
        this.stateManager.addNotification({ message, type, duration });
    }

    updateNotifications(notifications) {
        const container = this.elements.notificationsContainer;
        const fragment = document.createDocumentFragment();
        
        notifications.forEach(notification => {
            fragment.appendChild(this.createNotificationElement(notification));
        });
        
        // Single DOM update
        container.innerHTML = '';
        container.appendChild(fragment);
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
        
        // Use CSS animation instead of creating DOM elements
        setTimeout(() => {
            button.classList.remove('animate-button-press');
        }, 300);
    }

    animateToInputState(callback) {
        const lobbyActions = document.querySelector('.lobby-actions');
        if (lobbyActions) {
            lobbyActions.classList.add('animate-fade-out');
            
            requestAnimationFrame(() => {
                setTimeout(() => {
                    callback();
                    lobbyActions.classList.remove('animate-fade-out');
                    lobbyActions.classList.add('animate-fade-in');
                    
                    setTimeout(() => lobbyActions.classList.remove('animate-fade-in'), 300);
                }, 150);
            });
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
        // Clean up event listeners
        document.removeEventListener('click', this.handleGlobalClick);
        document.removeEventListener('keydown', this.handleGlobalKeydown);
        
        // Cancel any pending DOM updates
        if (this.batchUpdateTimeout) {
            cancelAnimationFrame(this.batchUpdateTimeout);
        }
        
        // Clear state
        this.stateManager.removeAllListeners();
        this.elements = {};
        this.domUpdateQueue = [];
        Object.assign(this, {
            currentView: 'lobby',
            isInitialized: false,
            activeModal: null,
            notifications: []
        });
        console.log('🧹 UIManager destroyed');
    }
}