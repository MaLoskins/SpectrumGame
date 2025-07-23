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

    /**
     * Initialize the UI manager
     * Caches DOM elements, sets up event listeners, and initializes UI
     * @returns {Promise<void>}
     */
    async init() {
        console.log('🎨 Initializing UIManager...');
        this.cacheElements();
        this.setupEventListeners();
        this.setupStateListeners();
        this.initializeUI();
        this.isInitialized = true;
        console.log('✅ UIManager initialized');
    }

    /**
     * Cache DOM elements for faster access
     * Stores references to frequently accessed DOM elements
     */
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

    /**
     * Set up event listeners for user interactions
     * Attaches global and specific event handlers for UI elements
     */
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

    /**
     * Handle global click events using event delegation
     * Routes clicks to appropriate handlers based on target element
     * @param {Event} e - Click event object
     */
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

    /**
     * Handle global keydown events
     * @param {KeyboardEvent} e - Keydown event object
     */
    handleGlobalKeydown(e) {
        this.handleKeyboardShortcuts(e);
    }

    /**
     * Set up state change listeners
     * Maps state changes to UI update handlers
     */
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
    /**
     * Queue a DOM update for batch processing
     * Uses requestIdleCallback or requestAnimationFrame for performance optimization
     * @param {Function} updateFn - Function to execute for the update
     * @param {boolean} critical - Whether the update is critical and should be processed immediately
     */
    queueDOMUpdate(updateFn, critical = false) {
        this.domUpdateQueue.push({ fn: updateFn, critical });
        
        if (!this.batchUpdateTimeout) {
            // Use requestIdleCallback for non-critical updates when browser is idle
            if (window.requestIdleCallback && !critical) {
                this.batchUpdateTimeout = requestIdleCallback(() => {
                    this.processDOMUpdates();
                }, { timeout: 200 }); // Ensure it runs within 200ms even if browser is busy
            } else {
                this.batchUpdateTimeout = requestAnimationFrame(() => {
                    this.processDOMUpdates();
                });
            }
        }
    }

    /**
     * Process queued DOM updates
     * Handles critical updates first, then processes non-critical updates in chunks
     * @private
     */
    processDOMUpdates() {
        const updates = [...this.domUpdateQueue];
        this.domUpdateQueue = [];
        this.batchUpdateTimeout = null;
        
        // Process critical updates first
        const criticalUpdates = updates.filter(update => update.critical);
        const nonCriticalUpdates = updates.filter(update => !update.critical);
        
        // Execute critical updates immediately
        criticalUpdates.forEach(update => update.fn());
        
        // Execute non-critical updates in chunks to avoid blocking the main thread
        if (nonCriticalUpdates.length > 0) {
            const chunkSize = 5;
            const chunks = [];
            
            for (let i = 0; i < nonCriticalUpdates.length; i += chunkSize) {
                chunks.push(nonCriticalUpdates.slice(i, i + chunkSize));
            }
            
            const processChunk = (index) => {
                if (index >= chunks.length) return;
                
                chunks[index].forEach(update => update.fn());
                
                requestAnimationFrame(() => {
                    processChunk(index + 1);
                });
            };
            
            processChunk(0);
        }
    }

    /**
     * Initialize the UI to its default state
     * Sets up initial view and resets form elements
     */
    initializeUI() {
        this.switchView('lobby');
        this.hideAllControlSections();
        this.resetLobbyForm();
    }

    /**
     * Handle create room button click
     * Animates to input state and shows player name input
     */
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

    /**
     * Handle join room button click
     * Animates to input state and shows player name and room code inputs
     */
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

    /**
     * Handle confirm action button click
     * Validates inputs and emits appropriate events based on action type
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
     * Handle cancel action button click
     * Resets the lobby form to its initial state
     */
    handleCancelAction = () => this.resetLobbyForm();
    /**
     * Handle start game button click
     * Emits event to start the game
     */
    handleStartGame = () => this.stateManager.emit('ui:start-game');

    /**
     * Handle submit clue button click
     * Validates and submits the clue to the game
     */
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

    /**
     * Handle next round button click
     * Updates UI to waiting state for next round
     */
    handleNextRound() {
        this.hideAllControlSections();
        this.elements.waitingSection.classList.remove('hidden');
        this.elements.waitingMessage.textContent = 'Preparing next round...';
    }

    /**
     * Handle view final scores button click
     * Shows modal with final game scores
     */
    handleViewFinalScores = () => this.showModal('final-scores', this.stateManager.getGameState().finalScores);

    /**
     * Handle send chat button click
     * Sends chat message and clears input field
     */
    handleSendChat() {
        const message = this.elements.chatInput.value.trim();
        if (message) {
            this.stateManager.emit('ui:send-chat', { message });
            this.elements.chatInput.value = '';
        }
    }

    /**
     * Handle toggle chat button click
     * Toggles chat visibility and updates button text
     */
    handleToggleChat() {
        const chatVisible = this.stateManager.getUIState().chatVisible;
        this.stateManager.updateUIState({ chatVisible: !chatVisible });
        
        this.elements.chatMessages.style.display = chatVisible ? 'none' : 'flex';
        this.elements.toggleChatBtn.textContent = chatVisible ? '+' : '−';
    }

    /**
     * Handle keyboard shortcuts
     * Maps key presses to appropriate actions
     * @param {KeyboardEvent} e - Keyboard event object
     */
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

    /**
     * Update UI based on connection status
     * Shows/hides loading indicator and displays appropriate messages
     * @param {string} status - Current connection status
     */
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

    /**
     * Update the UI based on the current game phase
     * @param {string} phase - Current game phase
     */
    updateGamePhase(phase) {
        const gameState = this.stateManager.getGameState();
        const isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        
        if (this.debugMode) console.log(`🎮 Updating game phase to: ${phase}, isClueGiver: ${isClueGiver}`);
        
        // Update phase display text
        this.updatePhaseDisplayText(phase, isClueGiver, gameState);
        
        // Hide all control sections before showing the relevant one
        this.hideAllControlSections();
        
        // Use requestAnimationFrame for DOM updates
        requestAnimationFrame(() => {
            // Apply phase-specific handler
            this.applyPhaseHandler(phase, isClueGiver, gameState);
            
            // Update common UI elements
            this.updateCommonPhaseElements(phase, isClueGiver);
            
            // Scroll to relevant section if needed
            this.scrollToRelevantSection(phase);
        });
    }
    
    /**
     * Update the phase display text
     * @param {string} phase - Current game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     * @param {Object} gameState - Current game state
     * @private
     */
    updatePhaseDisplayText(phase, isClueGiver, gameState) {
        this.elements.gamePhaseText.textContent = gameLogic.getPhaseDisplayText(
            phase,
            isClueGiver,
            gameState.timeRemaining
        );
    }
    
    /**
     * Apply the appropriate phase handler based on current phase
     * @param {string} phase - Current game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     * @param {Object} gameState - Current game state
     * @private
     */
    applyPhaseHandler(phase, isClueGiver, gameState) {
        const phaseHandlers = {
            lobby: () => this.handleLobbyPhase(),
            'giving-clue': () => this.handleGivingCluePhase(isClueGiver),
            guessing: () => this.handleGuessingPhase(isClueGiver),
            scoring: () => this.handleScoringPhase(),
            waiting: () => this.handleWaitingPhase(),
            results: () => this.handleResultsPhase(gameState),
            finished: () => this.handleFinishedPhase(gameState)
        };
        
        // Execute the appropriate handler or default
        (phaseHandlers[phase] || (() => this.handleDefaultPhase()))();
    }
    
    /**
     * Update common UI elements that change with phase
     * @param {string} phase - Current game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     * @private
     */
    updateCommonPhaseElements(phase, isClueGiver) {
        this.updateSpectrumInteraction(phase, isClueGiver);
        this.updateTimerVisibility(phase);
    }
    
    /**
     * Scroll to the relevant section based on phase
     * @param {string} phase - Current game phase
     * @private
     */
    scrollToRelevantSection(phase) {
        if (['giving-clue', 'results', 'finished'].includes(phase)) {
            setTimeout(this.scrollToControlContainer, 300);
        }
    }
    
    /**
     * Scroll to the game control container
     * @private
     */
    scrollToControlContainer = () => {
        if (this.elements.gameControlContainer) {
            this.elements.gameControlContainer.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    };

    /**
     * Handle lobby phase UI updates
     * Updates spectrum labels and shows/hides start game button based on player count
     */
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

    /**
     * Handle the giving-clue phase UI updates
     * @param {boolean} isClueGiver - Whether current player is clue giver
     */
    handleGivingCluePhase(isClueGiver) {
        if (this.debugMode) console.log(`🎯 Giving clue phase - isClueGiver: ${isClueGiver}`);
        
        if (isClueGiver) {
            this.setupClueGiverUI();
        } else {
            this.setupClueWaiterUI();
        }
    }
    
    /**
     * Set up UI for the clue giver
     * @private
     */
    setupClueGiverUI() {
        if (!this.elements.clueInputSection) {
            console.error('❌ Clue input section element not found!');
            return;
        }
        
        // Show clue input section
        this.elements.clueInputSection.classList.remove('hidden');
        
        // Reset and enable clue input
        this.resetClueInput();
        
        // Enable submit button
        this.enableSubmitButton();
        
        // Focus the input field
        requestAnimationFrame(() => this.elements.clueInput?.focus());
        
        // Show notification
        this.showNotification('Your turn to give a clue!', 'info', 5000);
    }
    
    /**
     * Reset and prepare the clue input field
     * @private
     */
    resetClueInput() {
        if (this.elements.clueInput) {
            this.elements.clueInput.value = '';
            this.elements.clueInput.disabled = false;
            this.elements.clueInput.classList.remove('error');
        }
    }
    
    /**
     * Enable the submit button
     * @private
     */
    enableSubmitButton() {
        if (this.elements.submitClueBtn) {
            this.elements.submitClueBtn.disabled = false;
            this.elements.submitClueBtn.classList.remove('disabled');
        }
    }
    
    /**
     * Set up UI for players waiting for a clue
     * @private
     */
    setupClueWaiterUI() {
        this.elements.waitingSection.classList.remove('hidden');
        this.elements.waitingMessage.textContent = 'Waiting for clue...';
        this.elements.waitingMessage.classList.remove('animate-pulse');
    }

    /**
     * Handle guessing phase UI updates
     * Shows appropriate UI elements based on player role
     * @param {boolean} isClueGiver - Whether current player is clue giver
     */
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

    /**
     * Handle scoring phase UI updates
     * Updates spectrum labels and shows waiting message
     */
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

    /**
     * Handle waiting phase UI updates
     * Updates spectrum labels and delegates to scoring phase handler
     */
    handleWaitingPhase() {
        this.updateSpectrumLabels();
        this.handleScoringPhase();
    }

    /**
     * Handle results phase UI updates
     * Shows results section and updates display with round results
     * @param {Object} gameState - Current game state
     */
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

    /**
     * Handle finished phase UI updates
     * Shows final results and celebration notification
     * @param {Object} gameState - Current game state
     */
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

    /**
     * Handle default phase UI updates
     * Shows loading message when no specific phase handler is available
     */
    handleDefaultPhase() {
        this.elements.waitingSection.classList.remove('hidden');
        this.elements.waitingMessage.textContent = 'Loading...';
        this.elements.waitingMessage.classList.add('animate-pulse');
    }

    /**
     * Update spectrum interaction based on game phase and player role
     * Enables/disables spectrum grid interactivity
     * @param {string} phase - Current game phase
     * @param {boolean} isClueGiver - Whether current player is clue giver
     */
    updateSpectrumInteraction(phase, isClueGiver) {
        const spectrumWrapper = document.getElementById('spectrum-grid');
        if (!spectrumWrapper) return;
        
        const interactive = phase === 'guessing' && !isClueGiver;
        spectrumWrapper.classList.toggle('interactive', interactive);
        spectrumWrapper.classList.toggle('disabled', !interactive);
    }

    /**
     * Update timer visibility based on game phase
     * Shows/hides timer and resets its appearance
     * @param {string} phase - Current game phase
     */
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

    /**
     * Update the results display with round results
     * @param {Object} gameState - Current game state
     */
    updateResultsDisplay(gameState) {
        const container = this.elements.resultsContainer;
        if (!container) return;
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Add target summary
        fragment.appendChild(this.createTargetSummary(gameState));
        
        // Add player results
        this.addPlayerResults(fragment, gameState);
        
        // Add bonus indicator if applicable
        if (gameState.bonusAwarded) {
            fragment.appendChild(this.createBonusIndicator());
        }
        
        // Single DOM update
        container.innerHTML = '';
        container.appendChild(fragment);
    }
    
    /**
     * Create the target summary element
     * @param {Object} gameState - Current game state
     * @returns {HTMLElement} Target summary element
     * @private
     */
    createTargetSummary(gameState) {
        const summary = document.createElement('div');
        summary.className = 'round-summary';
        
        const targetX = gameState.targetCoordinate?.x || 0;
        const targetY = gameState.targetCoordinate?.y || 0;
        
        summary.innerHTML = `
            <p>Target was at: <strong>(${targetX}, ${targetY})</strong></p>
        `;
        
        return summary;
    }
    
    /**
     * Add player results to the fragment
     * @param {DocumentFragment} fragment - Document fragment to append to
     * @param {Object} gameState - Current game state
     * @private
     */
    addPlayerResults(fragment, gameState) {
        if (!gameState.guesses || !gameState.roundScores) return;
        
        Object.entries(gameState.guesses).forEach(([playerId, coordinate]) => {
            const player = this.stateManager.getPlayer(playerId);
            const score = gameState.roundScores[playerId] || 0;
            const distance = this.calculateGuessDistance(coordinate, gameState.targetCoordinate);
            
            fragment.appendChild(this.createPlayerResultElement(player, coordinate, score, distance));
        });
    }
    
    /**
     * Calculate the distance between a guess and the target
     * @param {Object} coordinate - Guess coordinate
     * @param {Object} targetCoordinate - Target coordinate
     * @returns {number} Rounded distance
     * @private
     */
    calculateGuessDistance(coordinate, targetCoordinate) {
        if (!targetCoordinate) return 0;
        
        const distance = gameLogic.calculateDistance(coordinate, targetCoordinate);
        return Math.round(distance * 10) / 10;
    }
    
    /**
     * Create a bonus indicator element
     * @returns {HTMLElement} Bonus indicator element
     * @private
     */
    createBonusIndicator() {
        const bonus = document.createElement('div');
        bonus.className = 'bonus-indicator animate-success-celebration';
        bonus.innerHTML = '🎉 <strong>Bonus Round!</strong> All players guessed within 10 units!';
        return bonus;
    }

    /**
     * Update the final results display with game summary
     * @param {Object} gameState - Current game state
     */
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

    /**
     * Create a player result element for the results display
     * @param {Object} player - Player data
     * @param {Object} coordinate - Player's guess coordinate
     * @param {number} score - Player's score for the round
     * @param {number} distance - Distance from player's guess to target
     * @returns {HTMLElement} Player result element
     */
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

    /**
     * Update spectrum labels with current game state
     * Sets axis labels and names based on current spectrums
     */
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

    /**
     * Update clue display with current clue
     * Shows/hides clue text with animation
     * @param {string} clue - Current clue text
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
     * Update timer display with remaining time
     * Sets timer text and applies appropriate warning level styling
     * @param {number} timeRemaining - Time remaining in seconds
     */
    updateTimer(timeRemaining) {
        const formattedTime = gameLogic.formatTimeRemaining(timeRemaining);
        this.elements.roundTimer.textContent = formattedTime;
        
        const warningLevel = gameLogic.getTimeWarningLevel(timeRemaining, 60);
        this.elements.roundTimer.className = `timer ${warningLevel}`;
    }

    /**
     * Update round information display
     * Sets current round, total rounds, and room code
     * @param {number} currentRound - Current round number
     */
    updateRoundInfo(currentRound) {
        const gameState = this.stateManager.getGameState();
        this.elements.currentRound.textContent = currentRound;
        this.elements.totalRounds.textContent = gameState.totalRounds;
        this.elements.currentRoomCode.textContent = this.stateManager.getConnectionState().roomCode;
    }

    /**
     * Update player list display with current players
     * Creates and displays player elements
     * @param {Object} players - Map of player objects
     */
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

    /**
     * Create a player element for the player list
     * @param {Object} player - Player data
     * @param {number} index - Player index for styling
     * @param {Object} gameState - Current game state
     * @param {string} currentPlayerId - Current player's ID
     * @returns {HTMLElement} Player element
     */
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

    /**
     * Get player status text based on game state
     * @param {Object} player - Player data
     * @param {Object} gameState - Current game state
     * @returns {string} Player status text
     */
    getPlayerStatus(player, gameState) {
        if (player.id === gameState.clueGiverId) return 'Clue Giver';
        if (gameState.phase === 'guessing' && player.hasGuessed) return 'Guessed';
        if (gameState.phase === 'lobby') return 'Ready';
        return 'Waiting';
    }

    /**
     * Update scoreboard display with current players
     * Creates and displays score elements in ranking order
     * @param {Object} players - Map of player objects
     */
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

    /**
     * Create a score element for the scoreboard
     * @param {Object} player - Player data
     * @param {boolean} isLeader - Whether player is the current leader
     * @returns {HTMLElement} Score element
     */
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

    /**
     * Update chat messages display
     * Creates and displays chat message elements
     * @param {Array} messages - Array of chat message objects
     */
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

    /**
     * Create a chat message element
     * @param {Object} message - Chat message data
     * @returns {HTMLElement} Chat message element
     */
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

    /**
     * Switch between main views (lobby/game)
     * @param {string} view - View to switch to ('lobby' or 'game')
     */
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

    /**
     * Show lobby view
     * Switches to lobby view and resets form
     */
    showLobby() {
        this.switchView('lobby');
        this.resetLobbyForm();
    }

    /**
     * Handle window resize events
     * Repositions modal and scrolls chat to bottom
     */
    handleResize = () => {
            // Don't dispatch a new resize event - this causes an infinite loop!
            if (this.activeModal) this.repositionModal();
            if (this.elements.chatMessages) this.scrollChatToBottom();
        }

    /**
     * Reposition modal on window resize
     * Resets transform to ensure proper positioning
     */
    repositionModal() {
        if (!this.activeModal || !this.elements.modalOverlay) return;
        const modal = this.elements.modalOverlay.querySelector('.modal');
        if (modal) modal.style.transform = '';
    }

    /**
     * Scroll chat messages container to bottom
     * Ensures newest messages are visible
     */
    scrollChatToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }

    /**
     * Show modal with specified content
     * @param {string} modalId - ID of modal content to show
     * @param {Object} data - Data to pass to modal content generator
     */
    showModal(modalId, data = null) {
        this.elements.modalOverlay.classList.remove('hidden');
        this.elements.modalOverlay.classList.add('animate-fade-in');
        
        const modal = this.elements.modalOverlay.querySelector('.modal');
        modal.classList.add('animate-modal-slide-in');
        
        this.setModalContent(modalId, data);
        this.activeModal = modalId;
    }

    /**
     * Hide currently active modal
     * Animates modal out and updates state
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
     * Set modal content based on modal ID
     * @param {string} modalId - ID of modal content to show
     * @param {Object} data - Data to pass to modal content generator
     */
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

    // Update the generateFinalScoresHTML method (around line 1219)
    generateFinalScoresHTML(scores) {
        if (!scores) return '<p>No scores available</p>';
        
        const rankings = Object.entries(scores)
            .map(([playerId, score]) => ({
                playerId,
                score,
                name: this.stateManager.getPlayer(playerId)?.name || 'Unknown'
            }))
            .sort((a, b) => b.score - a.score);
        
        return `<div class="final-scores-container">` + rankings.map((player, index) => `
            <div class="player-result ${index === 0 ? 'best-guess' : ''}">
                <div class="player-result-header">
                    <div class="player-result-name">${player.name}</div>
                    <div class="player-result-score">${gameLogic.formatScore(player.score)}</div>
                </div>
                <div class="player-result-distance">${index === 0 ? '🏆 Winner!' : `#${index + 1}`}</div>
            </div>
        `).join('') + '</div>';
    }

    /**
     * Show notification message
     * @param {string} message - Notification message text
     * @param {string} type - Notification type ('info', 'success', 'warning', 'error')
     * @param {number} duration - Duration in milliseconds (0 for persistent)
     */
    showNotification(message, type = 'info', duration = 5000) {
        this.stateManager.addNotification({ message, type, duration });
    }

    /**
     * Update notifications display
     * Adds new notifications and removes old ones with animation
     * @param {Array} notifications - Array of notification objects
     */
    updateNotifications(notifications) {
        const container = this.elements.notificationsContainer;
        if (!container) return;
        
        // Get existing notification elements
        const existingNotifications = Array.from(container.children);
        const existingIds = new Set(existingNotifications.map(el => el.dataset.id));
        
        // Find notifications to add and remove
        const notificationsToAdd = notifications.filter(n => !existingIds.has(n.id.toString()));
        const idsToKeep = new Set(notifications.map(n => n.id.toString()));
        const elementsToRemove = existingNotifications.filter(el => !idsToKeep.has(el.dataset.id));
        
        // Remove old notifications
        elementsToRemove.forEach(el => {
            el.classList.add('animate-notification-slide-out');
            setTimeout(() => el.remove(), 300);
        });
        
        // Add new notifications
        if (notificationsToAdd.length > 0) {
            const fragment = document.createDocumentFragment();
            notificationsToAdd.forEach(notification => {
                fragment.appendChild(this.createNotificationElement(notification));
            });
            container.appendChild(fragment);
        }
    }

    /**
     * Create a notification element
     * @param {Object} notification - Notification data
     * @returns {HTMLElement} Notification element
     */
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

    /**
     * Update loading indicator visibility
     * @param {boolean} loading - Whether loading is in progress
     */
    updateLoadingState(loading) {
        this.elements.loadingIndicator.classList.toggle('hidden', !loading);
    }

    /**
     * Validate player name input
     * Applies error styling if invalid
     * @returns {boolean} Whether name is valid
     */
    validatePlayerName() {
        const name = this.elements.playerNameInput.value.trim();
        const validation = gameLogic.validatePlayerName(name);
        
        this.elements.playerNameInput.classList.toggle('error', !validation.valid);
        return validation.valid;
    }

    /**
     * Validate room code input
     * Applies error styling if invalid
     * @returns {boolean} Whether room code is valid
     */
    validateRoomCode() {
        const code = this.elements.roomCodeInput.value.trim();
        const validation = gameLogic.validateRoomCode(code);
        
        this.elements.roomCodeInput.classList.toggle('error', !validation.valid);
        return validation.valid;
    }

    /**
     * Validate clue input
     * Applies error styling if invalid
     * @returns {boolean} Whether clue is valid
     */
    validateClue() {
        const clue = this.elements.clueInput.value.trim();
        const validation = gameLogic.validateClue(clue);
        
        this.elements.clueInput.classList.toggle('error', !validation.valid);
        return validation.valid;
    }

    /**
     * Check if current player is the room host
     * @returns {boolean} Whether current player is host
     */
    isHost() {
        const roomState = this.stateManager.getRoomState();
        const connectionState = this.stateManager.getConnectionState();
        const isHost = roomState.hostId === connectionState.playerId;
        
        if (this.debugMode) {
            console.log('🔍 Host check:', { hostId: roomState.hostId, playerId: connectionState.playerId, isHost });
        }
        
        return isHost;
    }

    /**
     * Show player name input section
     * Reveals input field and sets focus
     */
    showPlayerNameInput() {
        this.elements.playerNameSection.classList.remove('hidden');
        this.elements.playerNameInput.focus();
    }

    /**
     * Show room code input section
     * Reveals input field
     */
    showRoomCodeInput = () => this.elements.roomCodeSection.classList.remove('hidden');

    /**
     * Show action buttons (confirm/cancel)
     * Reveals buttons for form submission
     */
    showActionButtons() {
        this.elements.confirmActionBtn.classList.remove('hidden');
        this.elements.cancelActionBtn.classList.remove('hidden');
    }

    /**
     * Hide action buttons (confirm/cancel)
     * Hides buttons for form submission
     */
    hideActionButtons() {
        this.elements.confirmActionBtn.classList.add('hidden');
        this.elements.cancelActionBtn.classList.add('hidden');
    }

    /**
     * Reset lobby form to initial state
     * Hides input sections, clears values, and removes error styling
     */
    resetLobbyForm() {
        ['playerNameSection', 'roomCodeSection'].forEach(section => 
            this.elements[section].classList.add('hidden'));
        this.hideActionButtons();
        this.elements.playerNameInput.value = '';
        this.elements.roomCodeInput.value = '';
        this.elements.playerNameInput.classList.remove('error');
        this.elements.roomCodeInput.classList.remove('error');
    }

    /**
     * Hide all game control sections
     * Hides all interactive game control elements
     */
    hideAllControlSections() {
        ['clueInputSection', 'guessInputSection', 'waitingSection', 'resultsSection', 
         'startGameBtn', 'nextRoundBtn', 'viewFinalScoresBtn'].forEach(section => 
            this.elements[section]?.classList.add('hidden'));
    }

    /**
     * Add button press animation effect
     * @param {HTMLElement} button - Button element to animate
     */
    addButtonPressEffect(button) {
        if (!button) return;
        
        button.classList.add('animate-button-press');
        
        // Use CSS animation instead of creating DOM elements
        setTimeout(() => {
            button.classList.remove('animate-button-press');
        }, 300);
    }

    /**
     * Animate transition to input state
     * Fades out lobby actions and executes callback
     * @param {Function} callback - Function to execute after animation
     */
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

    /**
     * Show validation error with animation
     * Applies shake animation and shows error notification
     * @param {HTMLElement} element - Input element with error
     * @param {string} message - Error message to display
     */
    showValidationError(element, message) {
        if (!element) return;
        
        element.classList.add('animate-error-shake');
        element.focus();
        
        this.showNotification(message, 'error', 4000);
        
        setTimeout(() => element.classList.remove('animate-error-shake'), 500);
    }

    /**
     * Set enhanced loading indicator state
     * Shows/hides loading indicator with custom message and animation
     * @param {boolean} loading - Whether loading is in progress
     * @param {string} message - Loading message to display
     * @param {number} progress - Optional progress value (0-100)
     */
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

    /**
     * Destroy the UI manager and clean up resources
     * Removes event listeners, cancels pending updates, and resets state
     */
    destroy() {
        // Clean up event listeners
        document.removeEventListener('click', this.handleGlobalClick.bind(this));
        document.removeEventListener('keydown', this.handleGlobalKeydown.bind(this));
        
        // Clean up specific input handlers
        this.elements.playerNameInput?.removeEventListener('input', () => this.validatePlayerName());
        this.elements.roomCodeInput?.removeEventListener('input', () => this.validateRoomCode());
        this.elements.clueInput?.removeEventListener('input', () => this.validateClue());
        this.elements.chatInput?.removeEventListener('keypress', e => { if (e.key === 'Enter') this.handleSendChat(); });
        
        // Clean up notification close buttons
        const notifications = document.querySelectorAll('.notification-close');
        notifications.forEach(btn => {
            const id = btn.parentElement?.dataset.id;
            if (id) btn.removeEventListener('click', () => this.stateManager.removeNotification(id));
        });
        
        // Cancel any pending DOM updates
        if (this.batchUpdateTimeout) {
            if (window.cancelIdleCallback && typeof this.batchUpdateTimeout === 'number') {
                cancelIdleCallback(this.batchUpdateTimeout);
            } else {
                cancelAnimationFrame(this.batchUpdateTimeout);
            }
        }
        
        // Clear all timeouts
        const timeouts = [];
        for (let i = 0; i < 100; i++) {
            timeouts.push(setTimeout(() => {}, 0));
        }
        timeouts.forEach(id => clearTimeout(id));
        
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