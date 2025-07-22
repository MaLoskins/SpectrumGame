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

class SpectrumApp {
    constructor() {
        Object.assign(this, {
            isInitialized: false,
            modules: {},
            debugMode: true,
            resizeRAF: null,
            visibilityTimeout: null
        });
    }

    async init() {
        try {
            console.log('🎮 Initializing Spectrum Game...');
            console.log('📍 Environment:', window.location.hostname);
            console.log('🌐 Browser:', navigator.userAgent);
            
            await this.initializeModules();
            this.setupEventListeners();
            this.start();
            
            this.isInitialized = true;
            console.log('✅ Spectrum Game initialized successfully');
            
            if (this.debugMode) console.log('📊 Application Status:', this.getStatus());
        } catch (error) {
            console.error('❌ Failed to initialize Spectrum Game:', error);
            this.handleInitializationError(error);
        }
    }

    async initializeModules() {
        try {
            console.log('📦 Initializing modules...');
            
            // Initialize modules in dependency order
            const moduleConfig = [
                ['stateManager', StateManager],
                ['socketClient', SocketClient, m => m.stateManager],
                ['gameClient', GameClient, m => [m.stateManager, m.socketClient]],
                ['uiManager', UIManager, m => [m.stateManager, m.gameClient]],
                ['spectrumRenderer', SpectrumRenderer, m => m.stateManager],
                ['chatManager', ChatManager, m => [m.stateManager, m.socketClient]]
            ];
            
            for (const [name, Class, getDeps] of moduleConfig) {
                console.log(`  ${moduleConfig.indexOf(moduleConfig.find(m => m[0] === name)) + 1}️⃣ ${Class.name}...`);
                const deps = getDeps ? [getDeps(this.modules)].flat() : [];
                this.modules[name] = new Class(...deps);
                await this.modules[name].init();
            }
            
            console.log('✅ All modules initialized successfully');
        } catch (error) {
            console.error('❌ Module initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        console.log('🎧 Setting up global event listeners...');
        
        // Use passive listeners where appropriate
        window.addEventListener('beforeunload', this.handleBeforeUnload, { passive: false });
        window.addEventListener('visibilitychange', this.handleVisibilityChange, { passive: true });
        window.addEventListener('error', this.handleGlobalError, { passive: true });
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection, { passive: true });
        window.addEventListener('keydown', this.handleKeyboardShortcuts, { passive: true });
        window.addEventListener('resize', this.handleResize, { passive: true });
        window.addEventListener('orientationchange', this.handleOrientationChange, { passive: true });
        
        document.addEventListener('visibilitychange', this.handleVisibilityChange, { passive: true });
        
        const { socketClient, stateManager } = this.modules;
        
        socketClient.on('connected', () => {
            console.log('🔌 Application connected to server');
            stateManager.addNotification({ type: 'success', message: 'Connected to server', duration: 3000 });
        });
        
        socketClient.on('disconnected', reason => {
            console.log('🔌 Application disconnected from server:', reason);
            stateManager.addNotification({ type: 'warning', message: 'Disconnected from server', duration: 5000 });
        });
        
        socketClient.on('connection-error', error => {
            console.error('🔌 Connection error:', error);
            stateManager.addNotification({ type: 'error', message: 'Connection error. Attempting to reconnect...', duration: 5000 });
        });
        
        if (this.debugMode) {
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

    start() {
        console.log('🚀 Starting Spectrum Game...');
        const { stateManager, socketClient } = this.modules;
        
        stateManager.setCurrentView('lobby');
        stateManager.updateConnectionState({ status: socketClient.isConnected() ? 'connected' : 'disconnected' });
        stateManager.addNotification({
            type: 'info',
            message: 'Welcome to Spectrum! Create or join a room to start playing.',
            duration: 5000
        });
    }

    handleDOMContentLoaded = () => {
        console.log('📄 DOM loaded, initializing app...');
        this.init();
    }

    handleBeforeUnload = event => {
        const { socketClient, stateManager } = this.modules;
        if (socketClient?.isConnected()) {
            socketClient.disconnect();
            const gameState = stateManager.getGameState();
            if (!['lobby', 'finished'].includes(gameState.phase)) {
                event.preventDefault();
                return event.returnValue = 'You are currently in a game. Are you sure you want to leave?';
            }
        }
    }

    handleVisibilityChange = () => {
        // Clear any pending timeout
        if (this.visibilityTimeout) {
            clearTimeout(this.visibilityTimeout);
        }
        
        const { stateManager, socketClient } = this.modules;
        if (document.hidden) {
            stateManager.emit('app:hidden');
            console.log('📱 App hidden');
        } else {
            stateManager.emit('app:visible');
            console.log('📱 App visible');
            
            // Debounce reconnection attempt
            this.visibilityTimeout = setTimeout(() => {
                if (socketClient && !socketClient.isConnected()) {
                    console.log('🔄 Attempting reconnection after visibility change');
                    socketClient.reconnect();
                }
            }, 500);
        }
    }

    handleGlobalError = event => {
        console.error('❌ Global error:', event.error);
        this.modules.stateManager?.addNotification({
            type: 'error',
            message: 'An unexpected error occurred. Please refresh the page if problems persist.',
            duration: 8000
        });
        this.reportError(event.error);
    }

    handleUnhandledRejection = event => {
        console.error('❌ Unhandled promise rejection:', event.reason);
        event.preventDefault();
        this.modules.stateManager?.addNotification({
            type: 'error',
            message: 'A network error occurred. Please check your connection.',
            duration: 5000
        });
        this.reportError(event.reason);
    }
    
    handleKeyboardShortcuts = event => {
        if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
        
        const shortcuts = {
            Escape: () => this.modules.stateManager?.hideModal(),
            Enter: () => event.ctrlKey || event.metaKey ? this.handleFormSubmit() : null,
            c: () => (event.ctrlKey || event.metaKey) && this.handleChatToggle(),
            h: () => (event.ctrlKey || event.metaKey) && this.showHelp(event),
            r: () => (event.ctrlKey || event.metaKey) && this.handleReconnect(event),
            d: () => (event.ctrlKey || event.metaKey) && event.shiftKey && this.toggleDebugMode(event)
        };
        
        shortcuts[event.key]?.();
    }
    handleFormSubmit() {
        const submitButton = document.activeElement?.form?.querySelector('button[type="submit"]');
        submitButton?.click();
    }

    handleChatToggle() {
        const gameState = this.modules.stateManager?.getGameState();
        if (gameState?.phase !== 'lobby') this.modules.chatManager?.toggleChat();
    }

    handleReconnect(event) {
        event.preventDefault();
        if (!this.modules.socketClient?.isConnected()) {
            console.log('🔄 Manual reconnection triggered');
            this.modules.socketClient?.reconnect();
        }
    }

    showHelp(event) {
        event?.preventDefault();
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

    toggleDebugMode(event) {
        event?.preventDefault();
        this.debugMode = !this.debugMode;
        if (this.modules.spectrumRenderer) this.modules.spectrumRenderer.debugMode = this.debugMode;
        console.log(`🔧 Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
        this.modules.stateManager?.addNotification({
            type: 'info',
            message: `Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`,
            duration: 3000
        });
    }

    handleResize = () => {
        // Cancel any pending resize
        if (this.resizeRAF) {
            cancelAnimationFrame(this.resizeRAF);
        }
        
        // Batch resize handlers
        this.resizeRAF = requestAnimationFrame(() => {
            this.modules.spectrumRenderer?.handleResize();
            this.modules.uiManager?.handleResize();
            this.modules.stateManager?.emit('app:resize', {
                width: window.innerWidth,
                height: window.innerHeight
            });
        });
    }

    handleOrientationChange = () => {
        // Delay resize to allow for orientation change to complete
        setTimeout(this.handleResize, 100);
    }

    handleInitializationError(error) {
        console.error('💥 Initialization error:', error);
        
        // Use template element for better performance
        const template = document.createElement('template');
        template.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:Arial,sans-serif;text-align:center;padding:20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;">
                <div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:20px;padding:40px;max-width:500px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
                    <h1 style="color:#ff6b6b;margin-bottom:20px;font-size:2.5em;">⚠️ Failed to Load Game</h1>
                    <p style="margin-bottom:20px;font-size:1.2em;line-height:1.6;">Sorry, we couldn't load the Spectrum Game. This might be due to:</p>
                    <ul style="text-align:left;margin-bottom:30px;font-size:1.1em;">
                        <li>Network connectivity issues</li>
                        <li>Server maintenance</li>
                        <li>Browser compatibility problems</li>
                    </ul>
                    <button onclick="window.location.reload()" style="padding:15px 30px;background:linear-gradient(45deg,#4ecdc4,#44a08d);color:white;border:none;border-radius:25px;cursor:pointer;font-size:16px;font-weight:bold;transition:transform 0.2s;margin-right:10px;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🔄 Refresh Page</button>
                    <button onclick="this.nextElementSibling.style.display='block'" style="padding:15px 30px;background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:25px;cursor:pointer;font-size:16px;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">🔍 Technical Details</button>
                    <details style="margin-top:20px;text-align:left;display:none;">
                        <summary style="cursor:pointer;color:#ffd93d;margin-bottom:10px;">Error Information</summary>
                        <pre style="background:rgba(0,0,0,0.3);padding:15px;border-radius:10px;overflow:auto;font-size:12px;color:#f8f8f2;white-space:pre-wrap;word-break:break-word;">${error.stack || error.message}</pre>
                    </details>
                </div>
            </div>
        `;
        
        document.body.innerHTML = '';
        document.body.appendChild(template.content.cloneNode(true));
    }

    reportError(error) {
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
        if (['localhost', '127.0.0.1'].includes(window.location.hostname)) console.table(errorReport);
    }

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

    destroy() {
        console.log('🧹 Cleaning up Spectrum Game...');
        
        // Clean up event listeners
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('error', this.handleGlobalError);
        window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
        window.removeEventListener('keydown', this.handleKeyboardShortcuts);
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleOrientationChange);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Cancel any pending operations
        if (this.resizeRAF) cancelAnimationFrame(this.resizeRAF);
        if (this.visibilityTimeout) clearTimeout(this.visibilityTimeout);
        
        // Disconnect socket first
        this.modules.socketClient?.disconnect();
        
        // Destroy modules in reverse order
        ['chatManager', 'spectrumRenderer', 'uiManager', 'gameClient', 'socketClient', 'stateManager']
            .forEach(moduleName => {
                const module = this.modules[moduleName];
                if (module && typeof module.destroy === 'function') {
                    try { 
                        module.destroy(); 
                    } catch (error) { 
                        console.error(`Error destroying ${moduleName}:`, error); 
                    }
                }
            });
        
        this.isInitialized = false;
        this.modules = {};
        console.log('✅ Spectrum Game cleaned up');
    }
}

// Initialize app
const app = new SpectrumApp();

// Use DOMContentLoaded for initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.handleDOMContentLoaded, { once: true });
} else {
    app.handleDOMContentLoaded();
}

// Export for debugging
window.SpectrumApp = app;
export default app;