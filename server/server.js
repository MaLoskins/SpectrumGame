/**
 * ===================================
 * SPECTRUM GAME - SERVER
 * ===================================
 * 
 * Main server entry point that:
 * - Sets up Express server
 * - Configures Socket.io
 * - Initializes game managers
 * - Handles static file serving
 * 
 * ================================= */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { NETWORK } = require('../shared/constants.js');
const { GameError } = require('../shared/errors.js');
const { GameManager } = require('./game/GameManager');
const RoomManager = require('./game/RoomManager');
const { SocketHandler } = require('./network/SocketHandler');

class SpectrumServer {
    constructor() {
        Object.assign(this, {
            port: process.env.PORT || process.env.RAILWAY_TCP_PROXY_PORT || 3000,
            isDevelopment: process.env.NODE_ENV !== 'production',
            app: express(),
            roomManager: null,
            gameManager: null,
            socketHandler: null,
            spectrums: null
        });
        
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: this.isDevelopment ? ["http://localhost:3001", "http://127.0.0.1:3001"] : false,
                methods: ["GET", "POST"]
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: NETWORK.TRANSPORTS
        });
    }

    async init() {
        try {
            console.log('🚀 Initializing Spectrum Server...');
            await this.loadSpectrums();
            this.initializeManagers();
            this.setupMiddleware();
            this.setupRoutes();
            this.setupSocketIO();
            console.log('✅ Server initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize server:', error);
            throw error;
        }
    }

    async loadSpectrums() {
        try {
            this.spectrums = JSON.parse(
                fs.readFileSync(path.join(__dirname, 'config', 'spectrums.json'), 'utf8')
            );
            console.log(`📊 Loaded ${this.spectrums.spectrums.length} spectrum configurations`);
        } catch (error) {
            throw new GameError(
                'CONFIG_LOAD_FAILED',
                'Could not load spectrum configurations',
                { path: path.join(__dirname, 'config', 'spectrums.json') }
            );
        }
    }

    initializeManagers() {
        this.roomManager = new RoomManager();
        this.gameManager = new GameManager(this.spectrums);
        this.socketHandler = new SocketHandler(this.io, this.roomManager, this.gameManager);
        console.log('🎮 Game managers initialized');
    }

    setupMiddleware() {
        const securityHeaders = (req, res, next) => {
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                ...(!this.isDevelopment && { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' })
            });
            next();
        };
        
        this.app.use(securityHeaders);
        
        if (this.isDevelopment) {
            this.app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
                console.log(`${req.method} ${req.path}`);
                next();
            });
        }
        
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use(express.static(path.join(__dirname, '..', 'client')));
    }
    
    setupRoutes() {
        const getStats = () => ({
            activeRooms: this.roomManager?.getActiveRoomCount() || 0,
            connectedPlayers: this.socketHandler?.getConnectedPlayerCount() || 0,
            totalSpectrums: this.spectrums?.spectrums.length || 0
        });
        
        this.app.get('/health', (req, res) => res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            ...getStats(),
            version: '1.0.0'
        }));
        
        this.app.get('/api/spectrums', (req, res) => res.json({ categories: this.spectrums?.categories || {} }));
        this.app.get('/api/stats', (req, res) => res.json(getStats()));
        
        // ADD THIS: Serve shared directory for client-side imports
        this.app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
        
        // This MUST come last - it's the catch-all route
        this.app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'client', 'index.html')));
        
        console.log('🛣️ Routes configured');
    }
    setupSocketIO() {
        this.socketHandler.init();
        
        this.io.on('connection', socket => {
            console.log(`🔌 Client connected: ${socket.id}`);
            socket.on('disconnect', reason => {
                console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
                this.socketHandler.handleDisconnection(socket, reason);
            });
            socket.on('error', error => console.error(`🔌 Socket error for ${socket.id}:`, error));
        });
        
        console.log('🔌 Socket.io configured');
    }

    async start() {
        try {
            await this.init();
            
            this.server.listen(this.port, () => {
                console.log('\n🌈 ================================');
                console.log('🌈   SPECTRUM GAME SERVER');
                console.log('🌈 ================================');
                console.log(`🌈 Server running on port ${this.port}`);
                console.log(`🌈 Environment: ${this.isDevelopment ? 'development' : 'production'}`);
                console.log(`🌈 Health check: http://localhost:${this.port}/health`);
                console.log('🌈 ================================\n');
            });
            
            this.setupGracefulShutdown();
        } catch (error) {
            const serverError = error instanceof GameError
                ? error
                : new GameError('SERVER_START_FAILED', error.message, { originalError: error });
            console.error('❌ Failed to start server:', serverError);
            process.exit(1);
        }
    }

    setupGracefulShutdown() {
        const shutdown = signal => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            this.stop()
                .then(() => { console.log('✅ Server stopped gracefully'); process.exit(0); })
                .catch(error => { console.error('❌ Error during shutdown:', error); process.exit(1); });
        };
        
        ['SIGTERM', 'SIGINT'].forEach(signal => process.on(signal, () => shutdown(signal)));
        
        process.on('uncaughtException', error => {
            const uncaughtError = error instanceof GameError
                ? error
                : new GameError('UNCAUGHT_EXCEPTION', error.message, { stack: error.stack });
            console.error('❌ Uncaught Exception:', uncaughtError);
            this.stop().then(() => process.exit(1));
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            const rejectionError = reason instanceof GameError
                ? reason
                : new GameError('UNHANDLED_REJECTION', reason?.message || String(reason));
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', rejectionError);
            this.stop().then(() => process.exit(1));
        });
    }

    async stop() {
        return new Promise(resolve => {
            console.log('🛑 Stopping server...');
            this.io?.close();
            this.server?.close(() => {
                console.log('🛑 HTTP server closed');
                resolve();
            }) || resolve();
            this.roomManager?.cleanup();
            this.gameManager?.cleanup();
        });
    }

    getStats = () => ({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeRooms: this.roomManager?.getActiveRoomCount() || 0,
        connectedPlayers: this.socketHandler?.getConnectedPlayerCount() || 0,
        port: this.port,
        environment: this.isDevelopment ? 'development' : 'production'
    });
}

if (require.main === module) {
    new SpectrumServer().start().catch(error => {
        const startupError = error instanceof GameError
            ? error
            : new GameError('SERVER_START_FAILED', error.message, { originalError: error });
        console.error('❌ Failed to start server:', startupError);
        process.exit(1);
    });
}

module.exports = { SpectrumServer };