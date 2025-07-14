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

/**
 * SocketClient Class
 * Manages real-time communication with the server
 */
export class SocketClient {
    constructor(stateManager) {
        this.stateManager = stateManager;
        
        // Socket.io instance
        this.socket = null;
        
        // Connection state
        this.connected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Connection options
        this.connectionOptions = {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            forceNew: true,
            reconnection: false // We'll handle reconnection manually
        };
        
        // Bind methods
        this.init = this.init.bind(this);
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.emit = this.emit.bind(this);
    }

    /**
     * Initialize the socket client
     */
    async init() {
        console.log('🔌 Initializing SocketClient...');
        
        // Check if Socket.io is available
        if (typeof io === 'undefined') {
            throw new Error('Socket.io client library not loaded');
        }
        
        // Set up connection
        await this.connect();
        
        console.log('✅ SocketClient initialized');
    }

    /**
     * Connect to the server
     */
    async connect() {
        if (this.isConnecting || this.connected) {
            return;
        }

        try {
            console.log('🔌 Connecting to server...');
            this.isConnecting = true;
            
            // Update state
            this.stateManager.updateConnectionState({
                status: 'connecting'
            });
            
            // Create socket connection
            this.socket = io(this.getServerUrl(), this.connectionOptions);
            
            // Set up event handlers
            this.setupSocketEventHandlers();
            
            // Wait for connection
            await this.waitForConnection();
            
        } catch (error) {
            console.error('❌ Failed to connect:', error);
            this.handleConnectionError(error);
        } finally {
            this.isConnecting = false;
        }
    }

    /**
     * Get server URL
     */
    getServerUrl() {
        // In development, use localhost with the same port as the current page
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `http://localhost:${window.location.port}`;
        }
        
        // In production, use same origin
        return window.location.origin;
    }

    /**
     * Set up socket event handlers
     */
    setupSocketEventHandlers() {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', this.handleConnect.bind(this));
        this.socket.on('disconnect', this.handleDisconnect.bind(this));
        this.socket.on('connect_error', this.handleConnectError.bind(this));
        this.socket.on('reconnect', this.handleReconnect.bind(this));
        this.socket.on('reconnect_error', this.handleReconnectError.bind(this));
        
        // Game events - forward to listeners
        const gameEvents = [
            'room:created',
            'room:joined',
            'room:player-joined',
            'room:player-left',
            'room:host-changed',
            'game:state-update',
            'game:round-start',
            'game:clue-submitted',
            'game:guess-submitted',
            'game:round-end',
            'game:finished',
            'chat:message',
            'timer:update',
            'error'
        ];
        
        gameEvents.forEach(event => {
            this.socket.on(event, (data) => {
                this.emitToListeners(event, data);
            });
        });
        
        // Pong response for latency measurement
        this.socket.on('pong', (timestamp) => {
            const latency = Date.now() - timestamp;
            this.emitToListeners('latency', latency);
        });
    }

    /**
     * Wait for connection to be established
     */
    waitForConnection() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, this.connectionOptions.timeout);

            this.socket.once('connect', () => {
                clearTimeout(timeout);
                resolve();
            });

            this.socket.once('connect_error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Handle successful connection
     */
    handleConnect() {
        console.log('✅ Connected to server');
        
        this.connected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // Reset delay
        
        // Update state
        this.stateManager.updateConnectionState({
            status: 'connected',
            error: null
        });
        
        // Emit connection event
        this.emitToListeners('connected');
    }

    /**
     * Handle disconnection
     */
    handleDisconnect(reason) {
        console.log('🔌 Disconnected from server:', reason);
        
        this.connected = false;
        
        // Update state
        this.stateManager.updateConnectionState({
            status: 'disconnected'
        });
        
        // Emit disconnection event
        this.emitToListeners('disconnected', reason);
        
        // Attempt reconnection if not intentional
        if (reason !== 'io client disconnect') {
            this.scheduleReconnect();
        }
    }

    /**
     * Handle connection error
     */
    handleConnectError(error) {
        console.error('❌ Connection error:', error);
        this.handleConnectionError(error);
    }

    /**
     * Handle reconnection success
     */
    handleReconnect() {
        console.log('🔄 Reconnected to server');
        this.handleConnect();
    }

    /**
     * Handle reconnection error
     */
    handleReconnectError(error) {
        console.error('❌ Reconnection error:', error);
        this.handleConnectionError(error);
    }

    /**
     * Handle connection errors
     */
    handleConnectionError(error) {
        this.connected = false;
        this.isConnecting = false;
        
        // Update state
        this.stateManager.updateConnectionState({
            status: 'error',
            error: error.message || 'Connection failed'
        });
        
        // Emit error event
        this.emitToListeners('connection-error', error);
        
        // Schedule reconnection
        this.scheduleReconnect();
    }

    /**
     * Schedule reconnection attempt
     */
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
        
        // Update state
        this.stateManager.updateConnectionState({
            status: 'reconnecting'
        });
        
        setTimeout(() => {
            this.reconnect();
        }, this.reconnectDelay);
        
        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }

    /**
     * Manually trigger reconnection
     */
    async reconnect() {
        if (this.connected || this.isConnecting) {
            return;
        }

        console.log('🔄 Attempting to reconnect...');
        
        // Disconnect existing socket
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        // Attempt new connection
        await this.connect();
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        console.log('🔌 Disconnecting from server...');
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.connected = false;
        this.isConnecting = false;
        
        // Update state
        this.stateManager.updateConnectionState({
            status: 'disconnected'
        });
    }

    /**
     * Emit event to server
     */
    emit(event, data = null) {
        if (!this.connected || !this.socket) {
            console.warn(`Cannot emit ${event}: not connected`);
            return false;
        }

        try {
            console.log(`📤 Emitting ${event}:`, data);
            this.socket.emit(event, data);
            return true;
        } catch (error) {
            console.error(`Failed to emit ${event}:`, error);
            return false;
        }
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    /**
     * Emit event to listeners
     */
    emitToListeners(event, data = null) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Remove all event listeners
     */
    removeAllListeners() {
        this.eventListeners.clear();
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        if (this.connected) return 'connected';
        if (this.isConnecting) return 'connecting';
        if (this.reconnectAttempts > 0) return 'reconnecting';
        return 'disconnected';
    }

    /**
     * Get socket ID
     */
    getSocketId() {
        return this.socket ? this.socket.id : null;
    }

    /**
     * Get connection latency
     */
    getLatency() {
        return this.socket ? this.socket.ping : null;
    }

    /**
     * Send ping to measure latency
     */
    ping() {
        if (this.connected && this.socket) {
            const start = Date.now();
            this.socket.emit('ping', start);
        }
    }

    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            connected: this.connected,
            connecting: this.isConnecting,
            socketId: this.getSocketId(),
            reconnectAttempts: this.reconnectAttempts,
            latency: this.getLatency(),
            transport: this.socket ? this.socket.io.engine.transport.name : null
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Remove all listeners
        this.removeAllListeners();
        
        // Disconnect socket
        this.disconnect();
        
        // Reset state
        this.connected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        console.log('🧹 SocketClient destroyed');
    }
}