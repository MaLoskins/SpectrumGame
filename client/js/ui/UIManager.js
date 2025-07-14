/**
 * UI Manager - Coordinates all UI interactions and state updates
 * Handles DOM manipulation, screen transitions, form validation, and reactive updates
 *
 * @class UIManager
 * @description Enhanced UI manager with performance optimizations, accessibility improvements,
 * smooth transitions, celebration effects, and comprehensive user feedback
 */

import { gameLogic } from '../game/GameLogic.js';

export class UIManager {
    constructor(stateManager, gameClient) {
        this.stateManager = stateManager;
        this.gameClient = gameClient;
        
        // DOM element references
        this.elements = {};
        
        // UI state
        this.currentView = 'lobby';
        this.isInitialized = false;
        this.activeModal = null;
        this.notifications = [];
        
        // Bind methods
        this.init = this.init.bind(this);
        this.setupEventListeners = this.setupEventListeners.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    /**
     * Initialize the UI Manager
     */
    async init() {
        console.log('🎨 Initializing UIManager...');
        
        // Cache DOM elements
        this.cacheElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up state listeners
        this.setupStateListeners();
        
        // Initialize UI state
        this.initializeUI();
        
        this.isInitialized = true;
        console.log('✅ UIManager initialized');
    }

    // In UIManager.js, add this enhanced cacheElements method:

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        console.log('🎨 Caching DOM elements...');
        
        this.elements = {
            // Main containers
            app: document.getElementById('app'),
            lobby: document.getElementById('lobby'),
            gameRoom: document.getElementById('game-room'),
            
            // Lobby elements
            createRoomBtn: document.getElementById('create-room-btn'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            playerNameSection: document.getElementById('player-name-section'),
            roomCodeSection: document.getElementById('room-code-section'),
            playerNameInput: document.getElementById('player-name'),
            roomCodeInput: document.getElementById('room-code'),
            confirmActionBtn: document.getElementById('confirm-action-btn'),
            cancelActionBtn: document.getElementById('cancel-action-btn'),
            
            // Game header elements
            currentRoomCode: document.getElementById('current-room-code'),
            currentRound: document.getElementById('current-round'),
            totalRounds: document.getElementById('total-rounds'),
            gamePhaseText: document.getElementById('game-phase-text'),
            roundTimer: document.getElementById('round-timer'),
            
            // Spectrum elements
            spectrumName: document.getElementById('spectrum-name'),
            clueText: document.getElementById('clue-text'),
            leftLabel: document.getElementById('left-label'),
            rightLabel: document.getElementById('right-label'),
            leftValue: document.getElementById('left-value'),
            rightValue: document.getElementById('right-value'),
            spectrumLine: document.getElementById('spectrum-line'),
            targetMarker: document.getElementById('target-marker'),
            guessMarkers: document.getElementById('guess-markers'),
            
            // Player list elements
            playersContainer: document.getElementById('players-container'),
            scoreboardContainer: document.getElementById('scoreboard-container'),
            
            // Chat elements
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            sendChatBtn: document.getElementById('send-chat'),
            toggleChatBtn: document.getElementById('toggle-chat'),
            
            // Control elements - CRITICAL FOR CLUE SUBMISSION
            clueInputSection: document.getElementById('clue-input-section'),
            guessInputSection: document.getElementById('guess-input-section'),
            waitingSection: document.getElementById('waiting-section'),
            resultsSection: document.getElementById('results-section'),
            clueInput: document.getElementById('clue-input'),
            submitClueBtn: document.getElementById('submit-clue'),
            guessSlider: document.getElementById('guess-slider'),
            guessValue: document.getElementById('guess-value'),
            submitGuessBtn: document.getElementById('submit-guess'),
            startGameBtn: document.getElementById('start-game'),
            waitingMessage: document.getElementById('waiting-message'),
            resultsContainer: document.getElementById('results-container'),
            nextRoundBtn: document.getElementById('next-round'),
            viewFinalScoresBtn: document.getElementById('view-final-scores'),
            
            // Modal elements
            modalOverlay: document.getElementById('modal-overlay'),
            modalTitle: document.getElementById('modal-title'),
            modalContent: document.getElementById('modal-content'),
            modalConfirm: document.getElementById('modal-confirm'),
            modalCancel: document.getElementById('modal-cancel'),
            modalClose: document.getElementById('modal-close'),
            
            // Loading and notifications
            loadingIndicator: document.getElementById('loading-indicator'),
            notificationsContainer: document.getElementById('notifications-container')
        };
        
        // Verify critical elements exist
        const criticalElements = [
            'clueInputSection',
            'clueInput',
            'submitClueBtn',
            'guessInputSection',
            'waitingSection'
        ];
        
        let missingElements = [];
        criticalElements.forEach(elementKey => {
            if (!this.elements[elementKey]) {
                console.error(`❌ Critical element missing: ${elementKey}`);
                missingElements.push(elementKey);
            } else {
                console.log(`✅ Found element: ${elementKey}`);
            }
        });
        
        if (missingElements.length > 0) {
            console.error('❌ Missing critical UI elements:', missingElements);
            console.error('This will prevent proper game functionality!');
        } else {
            console.log('✅ All critical elements cached successfully');
        }
    }

    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');
        // Lobby actions
        this.elements.createRoomBtn?.addEventListener('click', () => this.handleCreateRoom());
        this.elements.joinRoomBtn?.addEventListener('click', () => this.handleJoinRoom());
        this.elements.confirmActionBtn?.addEventListener('click', () => this.handleConfirmAction());
        this.elements.cancelActionBtn?.addEventListener('click', () => this.handleCancelAction());
        
        // Game controls
        this.elements.startGameBtn?.addEventListener('click', () => this.handleStartGame());
        this.elements.submitClueBtn?.addEventListener('click', () => this.handleSubmitClue());
        this.elements.submitGuessBtn?.addEventListener('click', () => this.handleSubmitGuess());
        this.elements.nextRoundBtn?.addEventListener('click', () => this.handleNextRound());
        this.elements.viewFinalScoresBtn?.addEventListener('click', () => this.handleViewFinalScores());
        // Game controls - with null checks
        if (this.elements.startGameBtn) {
            this.elements.startGameBtn.addEventListener('click', () => this.handleStartGame());
        }
        
        if (this.elements.submitClueBtn) {
            this.elements.submitClueBtn.addEventListener('click', () => this.handleSubmitClue());
            console.log('✅ Submit clue button listener attached');
        } else {
            console.error('❌ Submit clue button not found during event setup');
        }
        
        if (this.elements.submitGuessBtn) {
            this.elements.submitGuessBtn.addEventListener('click', () => this.handleSubmitGuess());
        }
        // Chat
        this.elements.sendChatBtn?.addEventListener('click', () => this.handleSendChat());
        this.elements.chatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendChat();
        });
        this.elements.toggleChatBtn?.addEventListener('click', () => this.handleToggleChat());
        
        // Guess slider
        this.elements.guessSlider?.addEventListener('input', (e) => {
            this.elements.guessValue.textContent = e.target.value;
        });
        
        // Modal
        this.elements.modalClose?.addEventListener('click', () => this.hideModal());
        this.elements.modalCancel?.addEventListener('click', () => this.hideModal());
        this.elements.modalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) this.hideModal();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Form validation
        this.elements.playerNameInput?.addEventListener('input', () => this.validatePlayerName());
        this.elements.roomCodeInput?.addEventListener('input', () => this.validateRoomCode());
        this.elements.clueInput?.addEventListener('input', () => this.validateClue());
    }

    /**
     * Set up state change listeners
     */
    setupStateListeners() {
        // Connection state changes
        this.stateManager.on('state:connection.status', (data) => {
            this.updateConnectionStatus(data.newValue);
        });
        
        // Game state changes
        this.stateManager.on('state:game.phase', (data) => {
            this.updateGamePhase(data.newValue);
        });
        
        this.stateManager.on('state:game.spectrum', (data) => {
            this.updateSpectrum(data.newValue);
        });
        
        this.stateManager.on('state:game.clue', (data) => {
            this.updateClue(data.newValue);
        });
        
        this.stateManager.on('state:game.timeRemaining', (data) => {
            this.updateTimer(data.newValue);
        });
        
        this.stateManager.on('state:game.currentRound', (data) => {
            this.updateRoundInfo(data.newValue);
        });
        
        // Player state changes
        this.stateManager.on('state:players', (data) => {
            this.updatePlayerList(data.newValue);
            this.updateScoreboard(data.newValue);
        });
        
        // UI state changes
        this.stateManager.on('state:ui.currentView', (data) => {
            this.switchView(data.newValue);
        });
        
        this.stateManager.on('state:ui.activeModal', (data) => {
            if (data.newValue) {
                this.showModal(data.newValue.id, data.newValue.data);
            } else {
                this.hideModal();
            }
        });
        
        this.stateManager.on('state:ui.notifications', (data) => {
            this.updateNotifications(data.newValue);
        });
        
        this.stateManager.on('state:ui.loading', (data) => {
            this.updateLoadingState(data.newValue);
        });
        
        // Chat state changes
        this.stateManager.on('state:chat.messages', (data) => {
            this.updateChatMessages(data.newValue);
        });
    }

    /**
     * Initialize UI state
     */
    initializeUI() {
        // Set initial view
        this.switchView('lobby');
        
        // Hide all sections initially
        this.hideAllControlSections();
        
        // Set up initial form states
        this.resetLobbyForm();
        
        // Initialize spectrum interaction
        this.setupSpectrumInteraction();
    }

    /**
     * Handle create room action
     * @description Enhanced with smooth transitions and user feedback
     */
    handleCreateRoom() {
        // Add button press animation
        this.addButtonPressEffect(this.elements.createRoomBtn);
        
        // Smooth transition to input state
        this.animateToInputState(() => {
            this.showPlayerNameInput();
            this.elements.confirmActionBtn.textContent = 'Create Room';
            this.elements.confirmActionBtn.dataset.action = 'create';
            this.showActionButtons();
        });
        
        // Focus management for accessibility
        setTimeout(() => {
            this.elements.playerNameInput.focus();
        }, 300);
    }

    /**
     * Handle join room action
     * @description Enhanced with smooth transitions and user feedback
     */
    handleJoinRoom() {
        // Add button press animation
        this.addButtonPressEffect(this.elements.joinRoomBtn);
        
        // Smooth transition to input state
        this.animateToInputState(() => {
            this.showPlayerNameInput();
            this.showRoomCodeInput();
            this.elements.confirmActionBtn.textContent = 'Join Room';
            this.elements.confirmActionBtn.dataset.action = 'join';
            this.showActionButtons();
        });
        
        // Focus management for accessibility
        setTimeout(() => {
            this.elements.playerNameInput.focus();
        }, 300);
    }

    /**
     * Handle confirm action
     */
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

    /**
     * Handle cancel action
     */
    handleCancelAction() {
        this.resetLobbyForm();
    }

    /**
     * Handle start game
     */
    handleStartGame() {
        this.stateManager.emit('ui:start-game');
    }

    /**
     * Handle submit clue
     * @description Enhanced with validation feedback and success animations
     */
    handleSubmitClue() {
        console.log('🎯 Submit clue button clicked');
        
        // Check if clue input element exists
        if (!this.elements.clueInput) {
            console.error('❌ Clue input element not found!');
            this.showNotification('Error: Clue input not found', 'error');
            return;
        }
        
        const clue = this.elements.clueInput.value.trim();
        console.log(`💡 Clue value: "${clue}"`);
        
        if (!this.validateClue()) {
            this.showValidationError(this.elements.clueInput, 'Please enter a valid clue (no numbers, 1-100 characters)');
            return;
        }
        
        // Add success animation
        this.addButtonPressEffect(this.elements.submitClueBtn);
        this.elements.clueInput.classList.add('animate-guess-submitted');
        
        // Emit event and update UI
        console.log('📤 Emitting clue submission event');
        this.stateManager.emit('ui:submit-clue', { clue });
        
        // Clear input and disable button to prevent double submission
        this.elements.clueInput.value = '';
        if (this.elements.submitClueBtn) {
            this.elements.submitClueBtn.disabled = true;
        }
        
        // Show success feedback
        this.showNotification('Clue submitted successfully! 🎯', 'success', 3000);
        
        // Clean up animation
        setTimeout(() => {
            if (this.elements.clueInput) {
                this.elements.clueInput.classList.remove('animate-guess-submitted');
            }
        }, 500);
    }

    /**
     * Handle submit guess
     * @description Enhanced with celebration effects and user feedback
     */
    handleSubmitGuess() {
        const position = parseInt(this.elements.guessSlider.value);
        
        // Add celebration animation
        this.addButtonPressEffect(this.elements.submitGuessBtn);
        this.elements.guessSlider.classList.add('animate-slider-pulse');
        
        // Emit event and update UI
        this.stateManager.emit('ui:submit-guess', { position });
        this.elements.submitGuessBtn.disabled = true;
        
        // Show success feedback with position
        this.showNotification(`Guess submitted: ${position}% 🎲`, 'success', 3000);
        
        // Add visual feedback to the spectrum
        this.addGuessSubmissionEffect(position);
        
        // Clean up animation
        setTimeout(() => {
            this.elements.guessSlider.classList.remove('animate-slider-pulse');
        }, 1000);
    }

    /**
     * Handle next round
     */
    handleNextRound() {
        this.hideAllControlSections();
        this.elements.waitingSection.classList.remove('hidden');
        this.elements.waitingMessage.textContent = 'Preparing next round...';
    }

    /**
     * Handle view final scores
     */
    handleViewFinalScores() {
        this.showModal('final-scores', this.stateManager.getGameState().finalScores);
    }

    /**
     * Handle send chat message
     */
    handleSendChat() {
        const message = this.elements.chatInput.value.trim();
        if (message) {
            this.stateManager.emit('ui:send-chat', { message });
            this.elements.chatInput.value = '';
        }
    }

    /**
     * Handle toggle chat visibility
     */
    handleToggleChat() {
        const chatVisible = this.stateManager.getUIState().chatVisible;
        this.stateManager.updateUIState({ chatVisible: !chatVisible });
        
        const chatMessages = this.elements.chatMessages;
        const toggleBtn = this.elements.toggleChatBtn;
        
        if (chatVisible) {
            chatMessages.style.display = 'none';
            toggleBtn.textContent = '+';
        } else {
            chatMessages.style.display = 'flex';
            toggleBtn.textContent = '−';
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Escape key closes modals
        if (e.key === 'Escape' && this.activeModal) {
            this.hideModal();
        }
        
        // Enter key in forms
        if (e.key === 'Enter') {
            if (this.elements.playerNameInput === document.activeElement ||
                this.elements.roomCodeInput === document.activeElement) {
                this.handleConfirmAction();
            } else if (this.elements.clueInput === document.activeElement) {
                this.handleSubmitClue();
            }
        }
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(status) {
        const indicator = this.elements.loadingIndicator;
        
        switch (status) {
            case 'connecting':
                indicator.classList.remove('hidden');
                indicator.querySelector('p').textContent = 'Connecting...';
                break;
            case 'connected':
                indicator.classList.add('hidden');
                break;
            case 'disconnected':
                indicator.classList.add('hidden');
                this.showNotification('Disconnected from server', 'error');
                break;
            case 'error':
                indicator.classList.add('hidden');
                this.showNotification('Connection error', 'error');
                break;
        }
    }

    /**
     * Update game phase
     */
    updateGamePhase(phase) {
        const gameState = this.stateManager.getGameState();
        const isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        
        console.log(`🎮 Updating game phase to: ${phase}, isClueGiver: ${isClueGiver}`);
        
        // Update phase text
        this.elements.gamePhaseText.textContent = gameLogic.getPhaseDisplayText(
            phase, 
            isClueGiver, 
            gameState.timeRemaining
        );
        
        // Show/hide appropriate control sections
        this.hideAllControlSections();
        
        switch (phase) {
            case 'lobby':
                this.elements.waitingSection.classList.remove('hidden');
                this.elements.waitingMessage.textContent = 'Waiting for players...';
                
                // Check if current player is host
                const roomState = this.stateManager.getRoomState();
                const connectionState = this.stateManager.getConnectionState();
                
                console.log('🎮 Lobby phase - checking host status');
                console.log('Room hostId:', roomState.hostId);
                console.log('My playerId:', connectionState.playerId);
                
                if (roomState.hostId === connectionState.playerId) {
                    console.log('✅ I am the host!');
                    if (roomState.playerCount >= 2) {
                        this.elements.startGameBtn.classList.remove('hidden');
                        console.log('✅ Showing start game button');
                    } else {
                        this.elements.startGameBtn.classList.add('hidden');
                        this.elements.waitingMessage.textContent = `Waiting for players... (${roomState.playerCount}/2 minimum)`;
                    }
                } else {
                    console.log('❌ I am not the host');
                    this.elements.startGameBtn.classList.add('hidden');
                }
                break;
                
            case 'giving-clue':
                console.log(`🎯 Giving clue phase - isClueGiver: ${isClueGiver}`);
                
                if (isClueGiver) {
                    // IMPORTANT: Make sure the clue input section exists and is shown
                    if (this.elements.clueInputSection) {
                        this.elements.clueInputSection.classList.remove('hidden');
                        console.log('✅ Showing clue input section');
                        
                        // Focus the clue input for better UX
                        setTimeout(() => {
                            if (this.elements.clueInput) {
                                this.elements.clueInput.focus();
                            }
                        }, 100);
                    } else {
                        console.error('❌ Clue input section element not found!');
                    }
                } else {
                    this.elements.waitingSection.classList.remove('hidden');
                    this.elements.waitingMessage.textContent = 'Waiting for clue...';
                }
                break;
                
            case 'guessing':
                if (!isClueGiver) {
                    this.elements.guessInputSection.classList.remove('hidden');
                    // Enable submit button in case it was disabled
                    if (this.elements.submitGuessBtn) {
                        this.elements.submitGuessBtn.disabled = false;
                    }
                } else {
                    this.elements.waitingSection.classList.remove('hidden');
                    this.elements.waitingMessage.textContent = 'Players are guessing...';
                }
                break;
                
            case 'scoring':
                this.elements.resultsSection.classList.remove('hidden');
                break;
                
            case 'finished':
                this.elements.resultsSection.classList.remove('hidden');
                this.elements.viewFinalScoresBtn.classList.remove('hidden');
                break;
                
            default:
                console.warn(`⚠️ Unknown game phase: ${phase}`);
                this.elements.waitingSection.classList.remove('hidden');
                this.elements.waitingMessage.textContent = 'Loading...';
                break;
        }
    }

    /**
     * Update spectrum display
     */
    updateSpectrum(spectrum) {
        if (!spectrum) return;
        
        this.elements.spectrumName.textContent = spectrum.name;
        this.elements.leftLabel.textContent = spectrum.leftLabel;
        this.elements.rightLabel.textContent = spectrum.rightLabel;
        this.elements.leftValue.textContent = spectrum.leftValue;
        this.elements.rightValue.textContent = spectrum.rightValue;
        
        // Update spectrum gradient
        const gradient = gameLogic.getSpectrumGradient(spectrum);
        const spectrumGradient = this.elements.spectrumLine.querySelector('.spectrum-gradient');
        spectrumGradient.style.background = gradient;
    }

    /**
     * Update clue display
     */
    updateClue(clue) {
        if (clue) {
            this.elements.clueText.textContent = clue;
            this.elements.clueText.classList.remove('hidden');
            this.elements.clueText.classList.add('animate-slide-in-top');
        } else {
            this.elements.clueText.classList.add('hidden');
        }
    }

    /**
     * Update timer display
     */
    updateTimer(timeRemaining) {
        const formattedTime = gameLogic.formatTimeRemaining(timeRemaining);
        this.elements.roundTimer.textContent = formattedTime;
        
        // Add warning/danger classes based on time remaining
        const warningLevel = gameLogic.getTimeWarningLevel(timeRemaining, 60);
        this.elements.roundTimer.className = `timer ${warningLevel}`;
    }

    /**
     * Update round information
     */
    updateRoundInfo(currentRound) {
        const gameState = this.stateManager.getGameState();
        this.elements.currentRound.textContent = currentRound;
        this.elements.totalRounds.textContent = gameState.totalRounds;
        this.elements.currentRoomCode.textContent = this.stateManager.getConnectionState().roomCode;
    }

    /**
     * Update player list
     */
    updatePlayerList(players) {
        const container = this.elements.playersContainer;
        container.innerHTML = '';
        
        const gameState = this.stateManager.getGameState();
        const currentPlayerId = this.stateManager.getConnectionState().playerId;
        
        Object.values(players).forEach((player, index) => {
            const playerElement = this.createPlayerElement(player, index, gameState, currentPlayerId);
            container.appendChild(playerElement);
        });
    }

    /**
     * Create player element
     */
    createPlayerElement(player, index, gameState, currentPlayerId) {
        const div = document.createElement('div');
        div.className = 'player-item';
        
        if (player.id === currentPlayerId) {
            div.classList.add('current-player');
        }
        
        if (player.id === gameState.clueGiverId) {
            div.classList.add('clue-giver');
        }
        
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
        
        info.appendChild(name);
        info.appendChild(status);
        div.appendChild(avatar);
        div.appendChild(info);
        
        return div;
    }

    /**
     * Get player status text
     */
    getPlayerStatus(player, gameState) {
        if (player.id === gameState.clueGiverId) {
            return 'Clue Giver';
        }
        
        if (gameState.phase === 'guessing' && player.hasGuessed) {
            return 'Guessed';
        }
        
        if (gameState.phase === 'lobby') {
            return 'Ready';
        }
        
        return 'Waiting';
    }

    /**
     * Update scoreboard
     */
    updateScoreboard(players) {
        const container = this.elements.scoreboardContainer;
        container.innerHTML = '';
        
        const rankings = gameLogic.calculateRankings(players);
        
        rankings.forEach((player, index) => {
            const scoreElement = this.createScoreElement(player, index === 0);
            container.appendChild(scoreElement);
        });
    }

    /**
     * Create score element
     */
    createScoreElement(player, isLeader) {
        const div = document.createElement('div');
        div.className = 'score-item';
        
        if (isLeader) {
            div.classList.add('leader');
        }
        
        const playerName = document.createElement('span');
        playerName.className = 'score-player';
        playerName.textContent = player.name;
        
        const scoreValue = document.createElement('span');
        scoreValue.className = 'score-value';
        scoreValue.textContent = gameLogic.formatScore(player.score || 0);
        
        div.appendChild(playerName);
        div.appendChild(scoreValue);
        
        return div;
    }

    /**
     * Update chat messages
     */
    updateChatMessages(messages) {
        const container = this.elements.chatMessages;
        container.innerHTML = '';
        
        messages.forEach(message => {
            const messageElement = this.createChatMessage(message);
            container.appendChild(messageElement);
        });
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Create chat message element
     */
    createChatMessage(message) {
        const div = document.createElement('div');
        div.className = 'chat-message animate-message-slide-in';
        
        if (message.type === 'system') {
            div.classList.add('system');
        }
        
        const currentPlayerId = this.stateManager.getConnectionState().playerId;
        if (message.playerId === currentPlayerId) {
            div.classList.add('own');
        }
        
        if (message.type !== 'system') {
            const header = document.createElement('div');
            header.className = 'message-header';
            
            const sender = document.createElement('span');
            sender.className = 'message-sender';
            sender.textContent = message.playerName || 'Unknown';
            
            const time = document.createElement('span');
            time.className = 'message-time';
            time.textContent = new Date(message.timestamp).toLocaleTimeString();
            
            header.appendChild(sender);
            header.appendChild(time);
            div.appendChild(header);
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message.content || message.text;
        
        div.appendChild(content);
        
        return div;
    }

    /**
     * Switch between views
     */
    switchView(view) {
        // Hide all views
        this.elements.lobby.classList.add('hidden');
        this.elements.gameRoom.classList.add('hidden');
        
        // Show target view
        switch (view) {
            case 'lobby':
                this.elements.lobby.classList.remove('hidden');
                this.elements.lobby.classList.add('animate-fade-in');
                break;
            case 'game':
                this.elements.gameRoom.classList.remove('hidden');
                this.elements.gameRoom.classList.add('animate-fade-in');
                break;
        }
        
        this.currentView = view;
    }

    /**
     * Show lobby view
     */
    showLobby() {
        this.switchView('lobby');
        this.resetLobbyForm();
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Update responsive elements
        if (this.elements.spectrumCanvas) {
            // Trigger spectrum renderer resize if needed
            const event = new Event('resize');
            window.dispatchEvent(event);
        }
        
        // Update modal positioning if active
        if (this.activeModal) {
            this.repositionModal();
        }
        
        // Update chat scroll position
        if (this.elements.chatMessages) {
            this.scrollChatToBottom();
        }
    }

    /**
     * Reposition modal for responsive design
     */
    repositionModal() {
        if (!this.activeModal || !this.elements.modalOverlay) return;
        
        const modal = this.elements.modalOverlay.querySelector('.modal');
        if (modal) {
            // Reset any inline styles to let CSS handle responsive positioning
            modal.style.transform = '';
        }
    }

    /**
     * Scroll chat to bottom
     */
    scrollChatToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }

    /**
     * Show modal
     */
    showModal(modalId, data = null) {
        this.elements.modalOverlay.classList.remove('hidden');
        this.elements.modalOverlay.classList.add('animate-fade-in');
        
        const modal = this.elements.modalOverlay.querySelector('.modal');
        modal.classList.add('animate-modal-slide-in');
        
        // Set modal content based on type
        this.setModalContent(modalId, data);
        
        this.activeModal = modalId;
    }

    /**
     * Hide modal
     */
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

    /**
     * Set modal content
     */
    setModalContent(modalId, data) {
        switch (modalId) {
            case 'final-scores':
                this.elements.modalTitle.textContent = 'Final Scores';
                this.elements.modalContent.innerHTML = this.generateFinalScoresHTML(data);
                break;
            case 'error':
                this.elements.modalTitle.textContent = 'Error';
                this.elements.modalContent.innerHTML = `<p>${data.message}</p>`;
                break;
            default:
                this.elements.modalTitle.textContent = 'Information';
                this.elements.modalContent.innerHTML = '<p>No content available</p>';
        }
    }

    /**
     * Generate final scores HTML
     */
    generateFinalScoresHTML(scores) {
        if (!scores) return '<p>No scores available</p>';
        
        const rankings = Object.entries(scores)
            .map(([playerId, score]) => {
                const player = this.stateManager.getPlayer(playerId);
                return { playerId, score, name: player?.name || 'Unknown' };
            })
            .sort((a, b) => b.score - a.score);
        
        return rankings.map((player, index) => `
            <div class="player-result ${index === 0 ? 'best-guess' : ''}">
                <div class="player-result-name">${player.name}</div>
                <div class="player-result-score">${gameLogic.formatScore(player.score)}</div>
                <div class="player-result-distance">${index === 0 ? '🏆 Winner!' : `#${index + 1}`}</div>
            </div>
        `).join('');
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info', duration = 5000) {
        this.stateManager.addNotification({
            message,
            type,
            duration
        });
    }

    /**
     * Update notifications display
     */
    updateNotifications(notifications) {
        const container = this.elements.notificationsContainer;
        container.innerHTML = '';
        
        notifications.forEach(notification => {
            const notificationElement = this.createNotificationElement(notification);
            container.appendChild(notificationElement);
        });
    }

    /**
     * Create notification element
     */
    createNotificationElement(notification) {
        const div = document.createElement('div');
        div.className = `notification ${notification.type} animate-notification-slide-in`;
        div.dataset.id = notification.id;
        
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.textContent = this.getNotificationIcon(notification.type);
        
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
        closeBtn.addEventListener('click', () => {
            this.stateManager.removeNotification(notification.id);
        });
        
        div.appendChild(icon);
        div.appendChild(content);
        div.appendChild(closeBtn);
        
        return div;
    }

    /**
     * Get notification icon
     */
    getNotificationIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            default: return 'ℹ️';
        }
    }

    /**
     * Update loading state
     */
    updateLoadingState(loading) {
        if (loading) {
            this.elements.loadingIndicator.classList.remove('hidden');
        } else {
            this.elements.loadingIndicator.classList.add('hidden');
        }
    }

    /**
     * Setup spectrum interaction
     */
    setupSpectrumInteraction() {
        this.elements.spectrumLine.addEventListener('click', (e) => {
            const gameState = this.stateManager.getGameState();
            const uiState = this.stateManager.getUIState();
            
            if (!uiState.spectrumInteractionEnabled || gameState.phase !== 'guessing') {
                return;
            }
            
            const rect = this.elements.spectrumLine.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = (x / rect.width) * 100;
            const position = Math.max(0, Math.min(100, Math.round(percentage)));
            
            this.elements.guessSlider.value = position;
            this.elements.guessValue.textContent = position;
            
            // Visual feedback
            this.elements.spectrumLine.classList.add('animate-pulse');
            setTimeout(() => {
                this.elements.spectrumLine.classList.remove('animate-pulse');
            }, 300);
        });
    }

    /**
     * Validation methods
     */
    validatePlayerName() {
        const name = this.elements.playerNameInput.value.trim();
        const validation = gameLogic.validatePlayerName(name);
        
        if (!validation.valid) {
            this.elements.playerNameInput.classList.add('error');
            return false;
        }
        
        this.elements.playerNameInput.classList.remove('error');
        return true;
    }

    /**
     * Validate room code
     */
    validateRoomCode() {
        const code = this.elements.roomCodeInput.value.trim();
        const validation = gameLogic.validateRoomCode(code);
        
        if (!validation.valid) {
            this.elements.roomCodeInput.classList.add('error');
            return false;
        }
        
        this.elements.roomCodeInput.classList.remove('error');
        return true;
    }

    /**
     * Validate clue
     */
    validateClue() {
        const clue = this.elements.clueInput.value.trim();
        const validation = gameLogic.validateClue(clue);
        
        if (!validation.valid) {
            this.elements.clueInput.classList.add('error');
            return false;
        }
        
        this.elements.clueInput.classList.remove('error');
        return true;
    }

    /**
     * Helper methods
     */
    isHost() {
        const roomState = this.stateManager.getRoomState();
        const connectionState = this.stateManager.getConnectionState();
        const isHost = roomState.hostId === connectionState.playerId;
        
        // Debug logging
        console.log('🔍 Host check:', {
            hostId: roomState.hostId,
            playerId: connectionState.playerId,
            isHost: isHost
        });
        
        return isHost;
    }

    showPlayerNameInput() {
        this.elements.playerNameSection.classList.remove('hidden');
        this.elements.playerNameInput.focus();
    }

    showRoomCodeInput() {
        this.elements.roomCodeSection.classList.remove('hidden');
    }

    showActionButtons() {
        this.elements.confirmActionBtn.classList.remove('hidden');
        this.elements.cancelActionBtn.classList.remove('hidden');
    }

    hideActionButtons() {
        this.elements.confirmActionBtn.classList.add('hidden');
        this.elements.cancelActionBtn.classList.add('hidden');
    }

    resetLobbyForm() {
        this.elements.playerNameSection.classList.add('hidden');
        this.elements.roomCodeSection.classList.add('hidden');
        this.hideActionButtons();
        this.elements.playerNameInput.value = '';
        this.elements.roomCodeInput.value = '';
        this.elements.playerNameInput.classList.remove('error');
        this.elements.roomCodeInput.classList.remove('error');
    }

    hideAllControlSections() {
        this.elements.clueInputSection.classList.add('hidden');
        this.elements.guessInputSection.classList.add('hidden');
        this.elements.waitingSection.classList.add('hidden');
        this.elements.resultsSection.classList.add('hidden');
        this.elements.startGameBtn.classList.add('hidden');
        this.elements.nextRoundBtn.classList.add('hidden');
        this.elements.viewFinalScoresBtn.classList.add('hidden');
    }

    /**
     * ===== ENHANCED ANIMATION AND EFFECT METHODS =====
     */

    /**
     * Add button press effect with ripple animation
     * @param {HTMLElement} button - Button element to animate
     */
    addButtonPressEffect(button) {
        if (!button) return;
        
        button.classList.add('animate-button-press');
        
        // Create ripple effect
        const ripple = document.createElement('span');
        ripple.classList.add('ripple-effect');
        button.appendChild(ripple);
        
        setTimeout(() => {
            button.classList.remove('animate-button-press');
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 300);
    }

    /**
     * Animate transition to input state
     * @param {Function} callback - Callback to execute during transition
     */
    animateToInputState(callback) {
        const lobbyActions = document.querySelector('.lobby-actions');
        if (lobbyActions) {
            lobbyActions.classList.add('animate-fade-out');
            
            setTimeout(() => {
                callback();
                lobbyActions.classList.remove('animate-fade-out');
                lobbyActions.classList.add('animate-fade-in');
                
                setTimeout(() => {
                    lobbyActions.classList.remove('animate-fade-in');
                }, 300);
            }, 150);
        } else {
            callback();
        }
    }

    /**
     * Show validation error with enhanced feedback
     * @param {HTMLElement} element - Input element with error
     * @param {string} message - Error message
     */
    showValidationError(element, message) {
        if (!element) return;
        
        element.classList.add('animate-error-shake');
        element.focus();
        
        this.showNotification(message, 'error', 4000);
        
        setTimeout(() => {
            element.classList.remove('animate-error-shake');
        }, 500);
    }

    /**
     * Add guess submission effect to spectrum
     * @param {number} position - Guess position (0-100)
     */
    addGuessSubmissionEffect(position) {
        const spectrumLine = this.elements.spectrumLine;
        if (!spectrumLine) return;
        
        // Create temporary effect element
        const effect = document.createElement('div');
        effect.style.position = 'absolute';
        effect.style.left = `${position}%`;
        effect.style.top = '50%';
        effect.style.transform = 'translate(-50%, -50%)';
        effect.style.width = '20px';
        effect.style.height = '20px';
        effect.style.borderRadius = '50%';
        effect.style.background = 'var(--accent-green)';
        effect.style.zIndex = '20';
        effect.classList.add('animate-guess-placement');
        
        spectrumLine.appendChild(effect);
        
        setTimeout(() => {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, 800);
    }

    /**
     * Enhanced loading state with progress indication
     * @param {boolean} loading - Loading state
     * @param {string} message - Loading message
     * @param {number} progress - Progress percentage (0-100)
     */
    setEnhancedLoading(loading, message = 'Loading...', progress = null) {
        const indicator = this.elements.loadingIndicator;
        if (!indicator) return;
        
        if (loading) {
            indicator.classList.remove('hidden');
            indicator.classList.add('animate-fade-in');
            
            const messageEl = indicator.querySelector('p');
            if (messageEl) {
                messageEl.textContent = message;
            }
            
            // Enhanced spinner
            const spinner = indicator.querySelector('.spinner');
            if (spinner) {
                spinner.classList.add('spinner-enhanced');
            }
        } else {
            indicator.classList.add('animate-fade-out');
            
            setTimeout(() => {
                indicator.classList.add('hidden');
                indicator.classList.remove('animate-fade-in', 'animate-fade-out');
                
                // Reset spinner
                const spinner = indicator.querySelector('.spinner');
                if (spinner) {
                    spinner.classList.remove('spinner-enhanced');
                }
            }, 300);
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Remove event listeners
        this.stateManager.removeAllListeners();
        
        // Clear DOM references
        this.elements = {};
        
        // Reset state
        this.currentView = 'lobby';
        this.isInitialized = false;
        this.activeModal = null;
        this.notifications = [];
        
        console.log('🧹 UIManager destroyed');
    }
}