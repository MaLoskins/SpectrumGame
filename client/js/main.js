/**
 * ===================================
 * SPECTRUM GAME - MAIN ENTRY POINT
 * ===================================
 * 
 * Main application entry point that:
 * - Initializes the game client
 * - Sets up event listeners
 * - Manages application lifecycle
 * - Coordinates between modules
 * 
 * FIXED: Better initialization and debugging
 * ================================= */

import { GameClient } from './game/GameClient.js';
import { StateManager } from './game/StateManager.js';
import { SocketClient } from './network/SocketClient.js';
import { UIManager } from './ui/UIManager.js';
import { SpectrumRenderer } from './ui/SpectrumRenderer.js';
import { ChatManager } from './ui/ChatManager.js';
import { helpers } from './utils/helpers.js';

/**
 * Main Application Class
 * Orchestrates the entire client-side application
 */
class SpectrumApp {
    constructor() {
        this.isInitialized = false;
        this.modules = {};
        this.debugMode = true;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.handleDOMContentLoaded = this.handleDOMContentLoaded.bind(this);
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('🎮 Initializing Spectrum Game...');
            console.log('📍 Environment:', window.location.hostname);
            console.log('🌐 Browser:', navigator.userAgent);
            
            // Initialize core modules
            await this.initializeModules();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start the application
            this.start();
            
            this.isInitialized = true;
            console.log('✅ Spectrum Game initialized successfully');
            
            // Log initial status
            if (this.debugMode) {
                console.log('📊 Application Status:', this.getStatus());
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize Spectrum Game:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize all core modules
     */
    async initializeModules() {
        try {
            console.log('📦 Initializing modules...');
            
            // Initialize state manager first (other modules depend on it)
            console.log('  1️⃣ StateManager...');
            this.modules.stateManager = new StateManager();
            await this.modules.stateManager.init();
            
            // Initialize socket client
            console.log('  2️⃣ SocketClient...');
            this.modules.socketClient = new SocketClient(this.modules.stateManager);
            await this.modules.socketClient.init();
            
            // Initialize game client
            console.log('  3️⃣ GameClient...');
            this.modules.gameClient = new GameClient(
                this.modules.stateManager,
                this.modules.socketClient
            );
            await this.modules.gameClient.init();
            
            // Initialize UI modules
            console.log('  4️⃣ UIManager...');
            this.modules.uiManager = new UIManager(
                this.modules.stateManager,
                this.modules.gameClient
            );
            await this.modules.uiManager.init();
            
            console.log('  5️⃣ SpectrumRenderer...');
            this.modules.spectrumRenderer = new SpectrumRenderer(
                this.modules.stateManager
            );
            await this.modules.spectrumRenderer.init();
            
            console.log('  6️⃣ ChatManager...');
            this.modules.chatManager = new ChatManager(
                this.modules.stateManager,
                this.modules.socketClient
            );
            await this.modules.chatManager.init();
            
            console.log('✅ All modules initialized successfully');
            
        } catch (error) {
            console.error('❌ Module initialization failed:', error);
            throw error;
        }
    }

    /**
     * Set up global event listeners
     */
    setupEventListeners() {
        console.log('🎧 Setting up global event listeners...');
        
        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Error handling
        window.addEventListener('error', this.handleGlobalError.bind(this));
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        
        // Responsive design
        window.addEventListener('resize', helpers.debounce(this.handleResize.bind(this), 250));
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
        
        // Connection status monitoring
        this.modules.socketClient.on('connected', () => {
            console.log('🔌 Application connected to server');
            this.modules.stateManager.addNotification({
                type: 'success',
                message: 'Connected to server',
                duration: 3000
            });
        });
        
        this.modules.socketClient.on('disconnected', (reason) => {
            console.log('🔌 Application disconnected from server:', reason);
            this.modules.stateManager.addNotification({
                type: 'warning',
                message: 'Disconnected from server',
                duration: 5000
            });
        });
        
        this.modules.socketClient.on('connection-error', (error) => {
            console.error('🔌 Connection error:', error);
            this.modules.stateManager.addNotification({
                type: 'error',
                message: 'Connection error. Attempting to reconnect...',
                duration: 5000
            });
        });
        
        // Debug helpers
        if (this.debugMode) {
            // Make modules available in console for debugging
            window.spectrumDebug = {
                app: this,
                modules: this.modules,
                state: () => this.modules.stateManager.getFullState(),
                history: () => this.modules.stateManager.getStateHistory(),
                players: () => this.modules.stateManager.getPlayers(),
                game: () => this.modules.stateManager.getGameState(),
                logState: () => this.modules.stateManager.logState()
            };
            
            console.log('🔧 Debug tools available at window.spectrumDebug');
        }
    }

    /**
     * Start the application
     */
    start() {
        console.log('🚀 Starting Spectrum Game...');
        
        // Show the lobby by default
        this.modules.stateManager.setCurrentView('lobby');
        
        // Set up initial UI state
        this.modules.stateManager.updateConnectionState({
            status: this.modules.socketClient.isConnected() ? 'connected' : 'disconnected'
        });
        
        // Log application start
        console.log('🚀 Spectrum Game started');
        
        // Show welcome notification
        this.modules.stateManager.addNotification({
            type: 'info',
            message: 'Welcome to Spectrum! Create or join a room to start playing.',
            duration: 5000
        });
    }

    /**
     * Handle DOM content loaded
     */
    handleDOMContentLoaded() {
        console.log('📄 DOM loaded, initializing app...');
        this.init();
    }

    /**
     * Handle before unload (user leaving page)
     */
    handleBeforeUnload(event) {
        if (this.modules.socketClient && this.modules.socketClient.isConnected()) {
            // Attempt to gracefully disconnect
            this.modules.socketClient.disconnect();
            
            // Show confirmation dialog if in active game
            const gameState = this.modules.stateManager.getGameState();
            if (gameState.phase !== 'lobby' && gameState.phase !== 'finished') {
                event.preventDefault();
                event.returnValue = 'You are currently in a game. Are you sure you want to leave?';
                return event.returnValue;
            }
        }
    }

    /**
     * Handle visibility change (tab switching)
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden
            this.modules.stateManager.emit('app:hidden');
            console.log('📱 App hidden');
        } else {
            // Page is visible
            this.modules.stateManager.emit('app:visible');
            console.log('📱 App visible');
            
            // Reconnect if needed
            if (this.modules.socketClient && !this.modules.socketClient.isConnected()) {
                console.log('🔄 Attempting reconnection after visibility change');
                this.modules.socketClient.reconnect();
            }
        }
    }

    /**
     * Handle global errors
     */
    handleGlobalError(event) {
        console.error('❌ Global error:', event.error);
        
        // Show user-friendly error message
        this.modules.stateManager?.addNotification({
            type: 'error',
            message: 'An unexpected error occurred. Please refresh the page if problems persist.',
            duration: 8000
        });
        
        // Report error (in production, this would send to error tracking service)
        this.reportError(event.error);
    }

    /**
     * Handle unhandled promise rejections
     */
    handleUnhandledRejection(event) {
        console.error('❌ Unhandled promise rejection:', event.reason);
        
        // Prevent default browser behavior
        event.preventDefault();
        
        // Show user-friendly error message
        this.modules.stateManager?.addNotification({
            type: 'error',
            message: 'A network error occurred. Please check your connection.',
            duration: 5000
        });
        
        // Report error
        this.reportError(event.reason);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        // Only handle shortcuts when not typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (event.key) {
            case 'Escape':
                // Close modals or cancel current action
                this.modules.stateManager?.hideModal();
                break;
                
            case 'Enter':
                // Confirm current action
                if (event.ctrlKey || event.metaKey) {
                    // Handle enter key for forms
                    const activeElement = document.activeElement;
                    if (activeElement && activeElement.form) {
                        const submitButton = activeElement.form.querySelector('button[type="submit"]');
                        if (submitButton) {
                            submitButton.click();
                        }
                    }
                }
                break;
                
            case 'c':
                // Toggle chat (if in game)
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    const gameState = this.modules.stateManager?.getGameState();
                    if (gameState && gameState.phase !== 'lobby') {
                        this.modules.chatManager?.toggleChat();
                    }
                }
                break;
                
            case 'h':
                // Show help (if available)
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.showHelp();
                }
                break;
                
            case 'r':
                // Reconnect (if disconnected)
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    if (!this.modules.socketClient?.isConnected()) {
                        console.log('🔄 Manual reconnection triggered');
                        this.modules.socketClient?.reconnect();
                    }
                }
                break;
                
            case 'd':
                // Toggle debug mode
                if (event.ctrlKey || event.metaKey && event.shiftKey) {
                    event.preventDefault();
                    this.toggleDebugMode();
                }
                break;
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Update responsive components
        this.modules.spectrumRenderer?.handleResize();
        this.modules.uiManager?.handleResize();
        
        // Emit resize event
        this.modules.stateManager?.emit('app:resize', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }

    /**
     * Handle orientation change (mobile)
     */
    handleOrientationChange() {
        // Wait for orientation change to complete
        setTimeout(() => {
            this.handleResize();
        }, 100);
    }

    /**
     * Show help modal
     */
    showHelp() {
        this.modules.stateManager?.showModal('help', {
            title: 'How to Play Spectrum',
            content: `
                <div class="help-content">
                    <h3>🎯 Objective</h3>
                    <p>Guess where concepts fall on various spectrums based on clues!</p>
                    
                    <h3>🎮 How to Play</h3>
                    <ol>
                        <li><strong>Clue Giver:</strong> See the target position and give a helpful clue</li>
                        <li><strong>Guessers:</strong> Use the clue to guess where the target is on the spectrum</li>
                        <li><strong>Scoring:</strong> Closer guesses earn more points</li>
                        <li><strong>Bonus:</strong> If all players guess within 10% of the target, everyone gets bonus points!</li>
                    </ol>
                    
                    <h3>⌨️ Keyboard Shortcuts</h3>
                    <ul>
                        <li><kbd>Ctrl+C</kbd> - Toggle chat</li>
                        <li><kbd>Ctrl+R</kbd> - Reconnect if disconnected</li>
                        <li><kbd>Ctrl+H</kbd> - Show this help</li>
                        <li><kbd>Escape</kbd> - Close modals</li>
                        <li><kbd>Ctrl+Enter</kbd> - Submit forms</li>
                        <li><kbd>Ctrl+Shift+D</kbd> - Toggle debug mode</li>
                    </ul>
                </div>
            `
        });
    }

    /**
     * Toggle debug mode
     */
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        
        if (this.modules.spectrumRenderer) {
            this.modules.spectrumRenderer.debugMode = this.debugMode;
        }
        
        console.log(`🔧 Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
        
        this.modules.stateManager?.addNotification({
            type: 'info',
            message: `Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`,
            duration: 3000
        });
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        console.error('💥 Initialization error:', error);
        
        // Show fallback UI
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            ">
                <div style="
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 500px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                ">
                    <h1 style="color: #ff6b6b; margin-bottom: 20px; font-size: 2.5em;">
                        ⚠️ Failed to Load Game
                    </h1>
                    <p style="margin-bottom: 20px; font-size: 1.2em; line-height: 1.6;">
                        Sorry, we couldn't load the Spectrum Game. This might be due to:
                    </p>
                    <ul style="text-align: left; margin-bottom: 30px; font-size: 1.1em;">
                        <li>Network connectivity issues</li>
                        <li>Server maintenance</li>
                        <li>Browser compatibility problems</li>
                    </ul>
                    <button onclick="window.location.reload()" style="
                        padding: 15px 30px;
                        background: linear-gradient(45deg, #4ecdc4, #44a08d);
                        color: white;
                        border: none;
                        border-radius: 25px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        transition: transform 0.2s;
                        margin-right: 10px;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        🔄 Refresh Page
                    </button>
                    <button onclick="this.nextElementSibling.style.display='block'" style="
                        padding: 15px 30px;
                        background: rgba(255, 255, 255, 0.2);
                        color: white;
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        border-radius: 25px;
                        cursor: pointer;
                        font-size: 16px;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
                        🔍 Technical Details
                    </button>
                    <details style="margin-top: 20px; text-align: left; display: none;">
                        <summary style="cursor: pointer; color: #ffd93d; margin-bottom: 10px;">Error Information</summary>
                        <pre style="
                            background: rgba(0, 0, 0, 0.3);
                            padding: 15px;
                            border-radius: 10px;
                            overflow: auto;
                            font-size: 12px;
                            color: #f8f8f2;
                            white-space: pre-wrap;
                            word-break: break-word;
                        ">${error.stack || error.message}</pre>
                    </details>
                </div>
            </div>
        `;
    }

    /**
     * Report error to monitoring service (placeholder)
     */
    reportError(error) {
        // In production, this would send error details to a monitoring service
        // like Sentry, LogRocket, or custom error tracking
        const errorReport = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            gameState: this.modules.stateManager?.getFullState(),
            connectionStatus: this.modules.socketClient?.getConnectionStatus()
        };
        
        console.log('📊 Error reported:', errorReport);
        
        // In development, also log to console for debugging
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.table(errorReport);
        }
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            modules: Object.keys(this.modules),
            connectionStatus: this.modules.socketClient?.getConnectionStatus(),
            gameState: this.modules.stateManager?.getGameState()?.phase,
            playerCount: Object.keys(this.modules.stateManager?.getPlayers() || {}).length,
            debugMode: this.debugMode
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        console.log('🧹 Cleaning up Spectrum Game...');
        
        // Disconnect socket
        if (this.modules.socketClient) {
            this.modules.socketClient.disconnect();
        }
        
        // Cleanup modules
        Object.values(this.modules).forEach(module => {
            if (module.destroy && typeof module.destroy === 'function') {
                try {
                    module.destroy();
                } catch (error) {
                    console.error('Error destroying module:', error);
                }
            }
        });
        
        // Remove event listeners
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        this.isInitialized = false;
        this.modules = {};
        
        console.log('✅ Spectrum Game cleaned up');
    }
}

// Initialize application when DOM is ready
const app = new SpectrumApp();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.handleDOMContentLoaded);
} else {
    // DOM is already ready
    app.handleDOMContentLoaded();
}

// Make app available globally for debugging
window.SpectrumApp = app;

// Export for module usage
export default app;