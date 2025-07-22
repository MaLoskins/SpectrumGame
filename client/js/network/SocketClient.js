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

export class SocketClient {
    constructor(stateManager) {
        Object.assign(this, {
            stateManager,
            socket: null,
            connected: false,
            isConnecting: false,
            reconnectAttempts: 0,
            maxReconnectAttempts: 5,
            reconnectDelay: 1000,
            maxReconnectDelay: 30000,
            eventListeners: new Map(),
            connectionOptions: {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true,
                reconnection: false
            }
        });
    }

    async init() {
        console.log('🔌 Initializing SocketClient...');
        if (typeof io === 'undefined') throw new Error('Socket.io client library not loaded');
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
            ? 'http://localhost:3000' 
            : window.location.origin;
    }

    setupSocketEventHandlers() {
        if (!this.socket) return;
        
        const handlers = {
            connect: () => this.handleConnectionChange(true),
            disconnect: reason => this.handleConnectionChange(false, reason),
            connect_error: this.handleConnectionError,
            reconnect: () => this.handleConnectionChange(true),
            reconnect_error: this.handleConnectionError
        };
        
        Object.entries(handlers).forEach(([event, handler]) => 
            this.socket.on(event, handler.bind(this)));
        
        // Game events - forward to listeners
        ['room:created', 'room:joined', 'room:player-joined', 'room:player-left',
         'room:host-changed', 'game:state-update', 'game:round-start', 'game:clue-submitted',
         'game:guess-submitted', 'game:round-end', 'game:finished', 'chat:message',
         'timer:update', 'error', 'game:phase-change'
        ].forEach(event => this.socket.on(event, data => this.emitToListeners(event, data)));
        
        this.socket.on('pong', timestamp => this.emitToListeners('latency', Date.now() - timestamp));
    }

    waitForConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), this.connectionOptions.timeout);
            const cleanup = () => clearTimeout(timeout);
            
            this.socket.once('connect', () => { cleanup(); resolve(); });
            this.socket.once('connect_error', error => { cleanup(); reject(error); });
        });
    }

    handleConnectionChange(connected, reason = null) {
        console.log(`${connected ? '✅' : '🔌'} ${connected ? 'Connected to' : 'Disconnected from'} server${reason ? `: ${reason}` : ''}`);
        
        this.connected = connected;
        this.stateManager.updateConnectionState({ 
            status: connected ? 'connected' : 'disconnected',
            error: connected ? null : undefined
        });
        
        this.emitToListeners(connected ? 'connected' : 'disconnected', reason);
        
        if (!connected) {
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            reason !== 'io client disconnect' && this.scheduleReconnect();
        }
    }

    handleConnectionError = error => {
        console.error('❌ Connection error:', error);
        Object.assign(this, { connected: false, isConnecting: false });
        this.stateManager.updateConnectionState({ 
            status: 'error', 
            error: error.message || 'Connection failed' 
        });
        this.emitToListeners('connection-error', error);
        this.scheduleReconnect();
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            this.stateManager.updateConnectionState({
                status: 'error',
                error: 'Unable to connect to server. Please refresh the page.'
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
                this.handleConnectionError(error);
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
            try { callback(data); } catch (error) { console.error(`Error in event listener for ${event}:`, error); }
        });
    }

    removeAllListeners = () => this.eventListeners.clear();
    isConnected = () => this.connected && this.socket?.connected;
    getConnectionStatus = () => this.connected ? 'connected' : this.isConnecting ? 'connecting' : this.reconnectAttempts > 0 ? 'reconnecting' : 'disconnected';
    getSocketId = () => this.socket?.id || null;
    getLatency = () => this.socket?.ping || null;
    ping = () => this.connected && this.socket && this.socket.emit('ping', Date.now());

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