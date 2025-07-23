/**
 * ===================================
 * SPECTRUM GAME - SOCKET CLIENT
 * ===================================
 *
 * WebSocket client that:
 * - Manages WebSocket connection lifecycle
 * - Handles message serialization/deserialization
 * - Implements connection retry logic
 * - Routes events to appropriate handlers
 *
 * ================================= */

import { NETWORK } from '../../shared/constants.js';
import {
    CONNECTION_EVENTS,
    ROOM_EVENTS,
    GAME_EVENTS,
    CHAT_EVENTS,
    TIMER_EVENTS,
    ERROR_EVENTS
} from '../../shared/events.js';
import { NetworkError, convertToGameError } from '../../shared/errors.js';

export class SocketClient {
    constructor(stateManager) {
        Object.assign(this, {
            stateManager,
            socket: null,
            connected: false,
            isConnecting: false,
            reconnectAttempts: 0,
            maxReconnectAttempts: NETWORK.RECONNECT_ATTEMPTS,
            reconnectDelay: NETWORK.INITIAL_RECONNECT_DELAY,
            maxReconnectDelay: NETWORK.MAX_RECONNECT_DELAY,
            eventListeners: new Map(),
            connectionOptions: {
                transports: NETWORK.TRANSPORTS,
                timeout: NETWORK.CONNECTION_TIMEOUT,
                forceNew: true,
                reconnection: false
            }
        });
    }

    async init() {
        console.log('🔌 Initializing SocketClient...');
        if (typeof io === 'undefined') throw new NetworkError(
            'CONNECTION_FAILED',
            'Socket.io client library not loaded'
        );
        await this.connect();
        console.log('✅ SocketClient initialized');
    }

    async connect() {
        if (this.isConnecting || this.connected) return;
        
        try {
            console.log('🔌 Connecting to server...');
            this.isConnecting = true;
            this.stateManager.updateConnectionState({ status: 'connecting' });
            
            const serverUrl = this.getServerUrl();
            console.log('🔌 Server URL:', serverUrl);
            
            this.socket = io(serverUrl, this.connectionOptions);
            this.setupSocketEventHandlers();
            await this.waitForConnection();
        } catch (error) {
            console.error('❌ Failed to connect:', error);
            this.handleConnectionError(error);
        } finally {
            this.isConnecting = false;
        }
    }

    getServerUrl() {
        return ['localhost', '127.0.0.1'].includes(window.location.hostname)
            ? NETWORK.LOCAL_SERVER_URL
            : window.location.origin;
    }

    setupSocketEventHandlers() {
        if (!this.socket) return;
        
        const handlers = {
            [CONNECTION_EVENTS.CONNECT]: () => this.handleConnectionChange(true),
            [CONNECTION_EVENTS.DISCONNECT]: reason => this.handleConnectionChange(false, reason),
            [CONNECTION_EVENTS.CONNECT_ERROR]: this.handleConnectionError,
            [CONNECTION_EVENTS.RECONNECT]: () => this.handleConnectionChange(true),
            [CONNECTION_EVENTS.RECONNECT_ERROR]: this.handleConnectionError
        };
        
        Object.entries(handlers).forEach(([event, handler]) => 
            this.socket.on(event, handler.bind(this)));
        
        // Game events - forward to listeners
        [
            // Room events
            ROOM_EVENTS.CREATED, ROOM_EVENTS.JOINED, ROOM_EVENTS.PLAYER_JOINED,
            ROOM_EVENTS.PLAYER_LEFT, ROOM_EVENTS.HOST_CHANGED,
            
            // Game events
            GAME_EVENTS.STATE_UPDATE, GAME_EVENTS.ROUND_START, GAME_EVENTS.CLUE_SUBMITTED,
            GAME_EVENTS.GUESS_SUBMITTED, GAME_EVENTS.ROUND_END, GAME_EVENTS.FINISHED,
            GAME_EVENTS.PHASE_CHANGE,
            
            // Other events
            CHAT_EVENTS.MESSAGE, TIMER_EVENTS.UPDATE, ERROR_EVENTS.GENERAL
        ].forEach(event => this.socket.on(event, data => this.emitToListeners(event, data)));
        
        this.socket.on(CONNECTION_EVENTS.PONG, timestamp => this.emitToListeners('latency', Date.now() - timestamp));
    }

    waitForConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(
                new NetworkError('CONNECTION_TIMEOUT', 'Connection timeout')
            ), this.connectionOptions.timeout);
            const cleanup = () => clearTimeout(timeout);
            
            this.socket.once(CONNECTION_EVENTS.CONNECT, () => { cleanup(); resolve(); });
            this.socket.once(CONNECTION_EVENTS.CONNECT_ERROR, error => { cleanup(); reject(error); });
        });
    }

    handleConnectionChange(connected, reason = null) {
        console.log(`${connected ? '✅' : '🔌'} ${connected ? 'Connected to' : 'Disconnected from'} server${reason ? `: ${reason}` : ''}`);
        
        this.connected = connected;
        this.stateManager.updateConnectionState({ 
            status: connected ? 'connected' : 'disconnected',
            error: connected ? null : undefined
        });
        
        this.emitToListeners(connected ? CONNECTION_EVENTS.CONNECT : CONNECTION_EVENTS.DISCONNECT, reason);
        
        if (!connected) {
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            reason !== 'io client disconnect' && this.scheduleReconnect();
        }
    }

    handleConnectionError = error => {
        console.error('❌ Connection error:', error);
        Object.assign(this, { connected: false, isConnecting: false });
        
        // Convert to NetworkError if it's not already
        const networkError = error instanceof NetworkError
            ? error
            : new NetworkError(
                'CONNECTION_FAILED',
                error.message || 'Connection failed',
                { originalError: error }
            );
        
        this.stateManager.updateConnectionState({
            status: 'error',
            error: networkError.message
        });
        
        this.emitToListeners(ERROR_EVENTS.CONNECTION, networkError);
        this.scheduleReconnect();
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            const maxAttemptsError = new NetworkError(
                'CONNECTION_FAILED',
                'Unable to connect to server. Please refresh the page.',
                { attempts: this.maxReconnectAttempts }
            );
            
            this.stateManager.updateConnectionState({
                status: 'error',
                error: maxAttemptsError.message
            });
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
        this.stateManager.updateConnectionState({ status: 'reconnecting' });
        
        setTimeout(() => this.reconnect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }

    async reconnect() {
        if (this.connected || this.isConnecting) return;
        console.log('🔄 Attempting to reconnect...');
        this.socket?.disconnect();
        this.socket = null;
        await this.connect();
    }

    disconnect() {
        console.log('🔌 Disconnecting from server...');
        this.socket?.disconnect();
        this.socket = null;
        Object.assign(this, { connected: false, isConnecting: false });
        this.stateManager.updateConnectionState({ status: 'disconnected' });
    }

    emit(event, data = null) {
        if (!this.connected || !this.socket) {
            console.warn(`Cannot emit ${event}: not connected`);
            // Don't change connection state for game events if we're already connected
            if (!['game:', 'chat:'].some(prefix => event.startsWith(prefix))) {
                return false;
            }
        }
        
        try {
            console.log(`📤 Emitting ${event}:`, data);
            this.socket.emit(event, data);
            return true;
        } catch (error) {
            console.error(`Failed to emit ${event}:`, error);
            
            // Only trigger reconnection for critical connection errors
            if (error.message?.includes('transport') || error.message?.includes('disconnected')) {
                const networkError = new NetworkError(
                    'CONNECTION_LOST',
                    `Failed to emit ${event}: ${error.message}`,
                    { event, data }
                );
                this.handleConnectionError(networkError);
            }
            
            return false;
        }
    }

    on(event, callback) {
        (this.eventListeners.get(event) || this.eventListeners.set(event, new Set()).get(event)).add(callback);
    }

    off(event, callback) { this.eventListeners.get(event)?.delete(callback); }

    emitToListeners(event, data = null) {
        this.eventListeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                const handledError = convertToGameError(error, 'EVENT_HANDLER_ERROR');
                console.error(`Error in event listener for ${event}:`, handledError);
            }
        });
    }

    removeAllListeners = () => this.eventListeners.clear();
    isConnected = () => this.connected && this.socket?.connected;
    getConnectionStatus = () => this.connected ? 'connected' : this.isConnecting ? 'connecting' : this.reconnectAttempts > 0 ? 'reconnecting' : 'disconnected';
    getSocketId = () => this.socket?.id || null;
    getLatency = () => this.socket?.ping || null;
    ping = () => this.connected && this.socket && this.socket.emit(CONNECTION_EVENTS.PING, Date.now());

    getDebugInfo = () => ({
        connected: this.connected,
        connecting: this.isConnecting,
        socketId: this.getSocketId(),
        reconnectAttempts: this.reconnectAttempts,
        latency: this.getLatency(),
        transport: this.socket?.io?.engine?.transport?.name || null
    });

    destroy() {
        this.removeAllListeners();
        this.disconnect();
        Object.assign(this, { connected: false, isConnecting: false, reconnectAttempts: 0 });
        console.log('🧹 SocketClient destroyed');
    }
}