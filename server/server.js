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

// Import game modules
const { GameManager } = require('./game/GameManager');
const RoomManager = require('./game/RoomManager');
const { SocketHandler } = require('./network/SocketHandler');

/**
 * SpectrumServer Class
 * Main server application
 */
class SpectrumServer {
    constructor() {
        // Server configuration
        this.port = process.env.PORT || 3000;
        this.isDevelopment = process.env.NODE_ENV !== 'production';
        
        // Express app
        this.app = express();
        this.server = http.createServer(this.app);
        
        // Socket.io
        this.io = socketIo(this.server, {
            cors: {
                origin: this.isDevelopment ? ["http://localhost:3001", "http://127.0.0.1:3001"] : false,
                methods: ["GET", "POST"]
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });
        
        // Game managers
        this.roomManager = null;
        this.gameManager = null;
        this.socketHandler = null;
        
        // Spectrum configurations
        this.spectrums = null;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
    }

    /**
     * Initialize the server
     */
    async init() {
        try {
            console.log('🚀 Initializing Spectrum Server...');
            
            // Load spectrum configurations
            await this.loadSpectrums();
            
            // Initialize game managers
            this.initializeGameManagers();
            
            // Configure Express middleware
            this.configureMiddleware();
            
            // Set up routes
            this.setupRoutes();
            
            // Set up Socket.io
            this.setupSocketIO();
            
            console.log('✅ Server initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize server:', error);
            throw error;
        }
    }

    /**
     * Load spectrum configurations
     */
    async loadSpectrums() {
        try {
            const spectrumsPath = path.join(__dirname, 'config', 'spectrums.json');
            const spectrumsData = fs.readFileSync(spectrumsPath, 'utf8');
            this.spectrums = JSON.parse(spectrumsData);
            
            console.log(`📊 Loaded ${this.spectrums.spectrums.length} spectrum configurations`);
            
        } catch (error) {
            console.error('❌ Failed to load spectrums:', error);
            throw new Error('Could not load spectrum configurations');
        }
    }

    /**
     * Initialize game managers
     */
    initializeGameManagers() {
        // Initialize room manager
        this.roomManager = new RoomManager();
        
        // Initialize game manager with spectrums
        this.gameManager = new GameManager(this.spectrums);
        
        // Initialize socket handler
        this.socketHandler = new SocketHandler(this.io, this.roomManager, this.gameManager);
        
        console.log('🎮 Game managers initialized');
    }

    /**
     * Configure Express middleware
     */
    configureMiddleware() {
        // Security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            
            if (!this.isDevelopment) {
                res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            }
            
            next();
        });
        
        // CORS for development
        if (this.isDevelopment) {
            this.app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
                next();
            });
        }
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Static file serving
        const clientPath = path.join(__dirname, '..', 'client');
        this.app.use(express.static(clientPath));
        
        // Request logging in development
        if (this.isDevelopment) {
            this.app.use((req, res, next) => {
                console.log(`${req.method} ${req.path}`);
                next();
            });
        }
    }

    /**
     * Set up Express routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                activeRooms: this.roomManager ? this.roomManager.getActiveRoomCount() : 0,
                connectedPlayers: this.socketHandler ? this.socketHandler.getConnectedPlayerCount() : 0,
                version: '1.0.0'
            };
            
            res.json(health);
        });
        
        // API endpoints
        this.app.get('/api/spectrums', (req, res) => {
            // Return available spectrum categories (not full spectrum data for security)
            const categories = this.spectrums ? this.spectrums.categories : {};
            res.json({ categories });
        });
        
        this.app.get('/api/stats', (req, res) => {
            const stats = {
                activeRooms: this.roomManager ? this.roomManager.getActiveRoomCount() : 0,
                connectedPlayers: this.socketHandler ? this.socketHandler.getConnectedPlayerCount() : 0,
                totalSpectrums: this.spectrums ? this.spectrums.spectrums.length : 0
            };
            
            res.json(stats);
        });
        
        // Serve client application for all other routes (SPA)
        this.app.get('*', (req, res) => {
            const indexPath = path.join(__dirname, '..', 'client', 'index.html');
            res.sendFile(indexPath);
        });
        
        console.log('🛣️ Routes configured');
    }

    /**
     * Set up Socket.io
     */
    setupSocketIO() {
        // Initialize socket handler
        this.socketHandler.init();
        
        // Global socket events
        this.io.on('connection', (socket) => {
            console.log(`🔌 Client connected: ${socket.id}`);
            
            // Handle disconnection
            socket.on('disconnect', (reason) => {
                console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
                this.socketHandler.handleDisconnection(socket, reason);
            });
            
            // Handle errors
            socket.on('error', (error) => {
                console.error(`🔌 Socket error for ${socket.id}:`, error);
            });
        });
        
        console.log('🔌 Socket.io configured');
    }

    /**
     * Start the server
     */
    async start() {
        try {
            await this.init();
            
            this.server.listen(this.port, () => {
                console.log('');
                console.log('🌈 ================================');
                console.log('🌈   SPECTRUM GAME SERVER');
                console.log('🌈 ================================');
                console.log(`🌈 Server running on port ${this.port}`);
                console.log(`🌈 Environment: ${this.isDevelopment ? 'development' : 'production'}`);
                console.log(`🌈 Health check: http://localhost:${this.port}/health`);
                console.log('🌈 ================================');
                console.log('');
            });
            
            // Graceful shutdown handling
            this.setupGracefulShutdown();
            
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }

    /**
     * Set up graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            
            this.stop().then(() => {
                console.log('✅ Server stopped gracefully');
                process.exit(0);
            }).catch((error) => {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            });
        };
        
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            this.stop().then(() => process.exit(1));
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            this.stop().then(() => process.exit(1));
        });
    }

    /**
     * Stop the server
     */
    async stop() {
        return new Promise((resolve) => {
            console.log('🛑 Stopping server...');
            
            // Close Socket.io connections
            if (this.io) {
                this.io.close();
            }
            
            // Close HTTP server
            if (this.server) {
                this.server.close(() => {
                    console.log('🛑 HTTP server closed');
                    resolve();
                });
            } else {
                resolve();
            }
            
            // Cleanup game managers
            if (this.roomManager) {
                this.roomManager.cleanup();
            }
            
            if (this.gameManager) {
                this.gameManager.cleanup();
            }
        });
    }

    /**
     * Get server statistics
     */
    getStats() {
        return {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            activeRooms: this.roomManager ? this.roomManager.getActiveRoomCount() : 0,
            connectedPlayers: this.socketHandler ? this.socketHandler.getConnectedPlayerCount() : 0,
            port: this.port,
            environment: this.isDevelopment ? 'development' : 'production'
        };
    }
}

// Create and start server if this file is run directly
if (require.main === module) {
    const server = new SpectrumServer();
    server.start().catch((error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = { SpectrumServer };