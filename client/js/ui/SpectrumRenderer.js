/**
 * Spectrum Renderer - Interactive 2D spectrum grid visualization
 * OPTIMIZED: Reduced computational overhead while maintaining functionality
 */

import { gameLogic } from '../game/GameLogic.js';

export class SpectrumRenderer {
    constructor(stateManager) {
        Object.assign(this, {
            stateManager,
            canvas: null,
            ctx: null,
            gridContainer: null,
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2), // Cap at 2 for performance
            spectrumX: null,
            spectrumY: null,
            targetCoordinate: null,
            guesses: {},
            showTarget: false,
            interactionEnabled: false,
            animationFrame: null,
            particles: [],
            isHovering: false,
            hoverCoordinate: null,
            isDragging: false,
            previewGuess: null,
            containerRect: null,
            canvasSize: { width: 0, height: 0 },
            gradientCache: new Map(),
            _isClueGiver: undefined,
            // Performance optimizations
            renderThrottleTime: 33, // ~30fps instead of 60fps
            lastRenderTime: 0,
            renderRequested: false,
            maxParticles: 50, // Limit particle count
            particlePoolSize: 100,
            particlePool: [],
            lastInteractionTime: 0,
            interactionThrottle: 50, // Throttle mouse moves
            // Dark mode color palette
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
                textSecondary: '#a8b2c7',
                gridLine: 'rgba(255, 255, 255, 0.1)',
                gridLineMajor: 'rgba(255, 255, 255, 0.2)'
            }
        });
        
        // Pre-create particle pool
        this.initParticlePool();
    }

    async init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupStateListeners();
        this.startRenderLoop();
    }

    initParticlePool() {
        for (let i = 0; i < this.particlePoolSize; i++) {
            this.particlePool.push({
                x: 0, y: 0, vx: 0, vy: 0,
                size: 0, alpha: 0, decay: 0,
                shrink: 0, color: '', active: false
            });
        }
    }

    getPooledParticle() {
        return this.particlePool.find(p => !p.active) || this.particlePool[0];
    }

    setupCanvas() {
        this.gridContainer = document.getElementById('spectrum-grid');
        if (!this.gridContainer) return;
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'spectrum-canvas';
        this.ctx = this.canvas.getContext('2d', { 
            alpha: false,
            desynchronized: true
        });
        
        this.gridContainer.appendChild(this.canvas);
        this.updateCanvasSize();
    }

    setupEventListeners() {
        // Simplified resize handling
        this.resizeObserver = new ResizeObserver(() => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.handleResize(), 250);
        });
        this.resizeObserver.observe(this.gridContainer);
        
        // Simplified event listeners
        const events = [
            ['pointerenter', this.handlePointerEnter],
            ['pointerleave', this.handlePointerLeave],
            ['pointermove', this.handlePointerMove],
            ['pointerdown', this.handlePointerDown],
            ['pointerup', this.handlePointerUp]
        ];
        
        events.forEach(([event, handler]) => 
            this.canvas.addEventListener(event, handler.bind(this), { passive: true }));
    }

    setupStateListeners() {
        const listeners = {
            'game.spectrumX': data => this.updateSpectrumX(data.newValue),
            'game.spectrumY': data => this.updateSpectrumY(data.newValue),
            'game.targetCoordinate': data => this.updateTargetCoordinate(data.newValue),
            'game.guesses': data => this.updateGuesses(data.newValue),
            'ui.spectrumInteractionEnabled': data => this.setInteractionEnabled(data.newValue),
            'ui.showTargetCoordinate': data => this.setShowTarget(data.newValue),
            'game.phase': data => this.handlePhaseChange(data.newValue),
            'game.clueGiverId': () => this.updateTargetVisibility()
        };
        
        Object.entries(listeners).forEach(([state, handler]) => 
            this.stateManager.on(`state:${state}`, handler));
    }

    updateCanvasSize() {
            if (!this.canvas || !this.gridContainer) return;
            
            this.containerRect = this.gridContainer.getBoundingClientRect();
            const width = this.containerRect.width;
            const height = this.containerRect.height;
            
            // Don't resize if dimensions haven't actually changed
            if (this.canvasSize.width === width && this.canvasSize.height === height) {
                return;
            }
            
            this.canvasSize = { width, height };
            
            // Update device pixel ratio in case zoom changed
            this.devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            
            const pixelWidth = width * this.devicePixelRatio;
            const pixelHeight = height * this.devicePixelRatio;
            
            // Store the current image data before resizing
            let imageData = null;
            try {
                if (this.canvas.width > 0 && this.canvas.height > 0) {
                    imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                }
            } catch (e) {
                // Context might be lost, that's okay
            }
            
            this.canvas.width = pixelWidth;
            this.canvas.height = pixelHeight;
            
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            
            // Re-establish context settings
            this.ctx = this.canvas.getContext('2d', { 
                alpha: false,
                desynchronized: true
            });
            
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
            
            // Clear cache on resize
            this.gradientCache.clear();
            
            // Force immediate re-render
            this.render();
        }

    handleResize = () => {
        this.updateCanvasSize();
        this.requestRender();
    }

    startRenderLoop() {
        const renderFrame = (timestamp) => {
            if (this.renderRequested && timestamp - this.lastRenderTime >= this.renderThrottleTime) {
                this.render();
                this.lastRenderTime = timestamp;
                this.renderRequested = false;
            }
            this.animationFrame = requestAnimationFrame(renderFrame);
        };
        this.animationFrame = requestAnimationFrame(renderFrame);
    }

    requestRender() {
        this.renderRequested = true;
    }

    render() {
        if (!this.ctx || !this.canvasSize.width || !this.canvasSize.height) return;

        const { width, height } = this.canvasSize;
        
        // Clear with solid color
        this.ctx.fillStyle = this.colors.darkBg;
        this.ctx.fillRect(0, 0, width, height);

        // Update animations
        this.updateParticles();

        // Render layers
        this.render2DGradient();
        this.renderGridLines();
        
        if (this.particles.length > 0) {
            this.renderParticles();
        }

        if (this.shouldRenderTarget()) {
            this.renderTarget();
        }
        
        this.renderGuesses();

        if (this.isHovering && this.interactionEnabled && this.hoverCoordinate) {
            this.renderHoverPreview();
        }

        if (this.previewGuess) {
            this.renderPreviewGuess();
        }
    }

    render2DGradient() {
        const { width, height } = this.canvasSize;
        this.ctx.save();

        if (!this.spectrumX || !this.spectrumY) {
            this.ctx.fillStyle = this.colors.glassBg;
            this.ctx.fillRect(0, 0, width, height);
        } else {
            // Simplified gradient without caching
            const gradientX = this.ctx.createLinearGradient(0, 0, width, 0);
            gradientX.addColorStop(0, this.colors.teal + '40');
            gradientX.addColorStop(1, this.colors.lilac + '40');
            
            const gradientY = this.ctx.createLinearGradient(0, height, 0, 0);
            gradientY.addColorStop(0, this.colors.electricBlue + '40');
            gradientY.addColorStop(1, this.colors.green + '40');
            
            this.ctx.fillStyle = gradientX;
            this.ctx.fillRect(0, 0, width, height);
            
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.fillStyle = gradientY;
            this.ctx.fillRect(0, 0, width, height);
            
            this.ctx.globalCompositeOperation = 'source-over';
        }

        this.ctx.restore();
    }

    renderGridLines() {
        const { width, height } = this.canvasSize;
        this.ctx.save();
        
        // Simplified grid - only major lines
        this.ctx.strokeStyle = this.colors.gridLineMajor;
        this.ctx.lineWidth = 1;
        
        const centerX = width / 2;
        const centerY = height / 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, height);
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(width, centerY);
        this.ctx.stroke();
        
        // Border
        this.ctx.strokeRect(0, 0, width, height);
        
        this.ctx.restore();
    }

    coordToCanvas(coord) {
        const { width, height } = this.canvasSize;
        return {
            x: (coord.x / 100) * width,
            y: height - (coord.y / 100) * height
        };
    }

    canvasToCoord(x, y) {
        const { width, height } = this.canvasSize;
        return {
            x: Math.max(0, Math.min(100, Math.round((x / width) * 100))),
            y: Math.max(0, Math.min(100, Math.round((1 - y / height) * 100)))
        };
    }

    shouldRenderTarget() {
        const hasValidCoordinate = this.targetCoordinate && 
                                  typeof this.targetCoordinate.x === 'number' &&
                                  typeof this.targetCoordinate.y === 'number';
        const isClueGiver = this._isClueGiver ?? this.stateManager.isCurrentPlayerClueGiver();
        return hasValidCoordinate && this.showTarget && isClueGiver;
    }

    renderTarget() {
        const pos = this.coordToCanvas(this.targetCoordinate);
        
        this.ctx.save();
        
        // Simplified target without pulse animation
        this.ctx.fillStyle = this.colors.red;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = this.colors.darkBg;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = this.colors.red;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    renderGuesses() {
        const players = this.stateManager.getPlayers();
        const playerColors = [this.colors.teal, this.colors.green, this.colors.orange, this.colors.lilac];
        
        Object.entries(this.guesses).forEach(([playerId, coordinate], index) => {
            const player = players[playerId];
            if (!player || !coordinate) return;
            
            const pos = this.coordToCanvas(coordinate);
            const color = playerColors[index % playerColors.length];
            
            this.renderGuessMarker(pos.x, pos.y, color, player.name.charAt(0).toUpperCase());
        });
    }

    renderGuessMarker(x, y, color, initial) {
        this.ctx.save();
        
        // Simplified marker without glow
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 12, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = this.colors.darkBg;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.fillStyle = this.colors.darkBg;
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(initial, x, y);
        
        this.ctx.restore();
    }

    renderHoverPreview() {
        const pos = this.coordToCanvas(this.hoverCoordinate);
        
        this.ctx.save();
        
        // Simplified hover marker
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillStyle = this.colors.lilac;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    renderPreviewGuess() {
        const pos = this.coordToCanvas(this.previewGuess);
        
        this.ctx.save();
        
        this.ctx.globalAlpha = 0.8;
        this.ctx.fillStyle = this.colors.lilac;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = this.colors.darkBg;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    renderParticles() {
        this.ctx.save();
        
        // Batch render active particles
        this.particles.forEach(p => {
            if (p.alpha > 0) {
                this.ctx.globalAlpha = p.alpha;
                this.ctx.fillStyle = p.color;
                this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            }
        });
        
        this.ctx.restore();
    }

    updateParticles() {
        // Update only active particles
        this.particles = this.particles.filter(p => {
            if (!p.active) return false;
            
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            p.size *= p.shrink;
            
            if (p.alpha <= 0 || p.size < 0.5) {
                p.active = false;
                return false;
            }
            return true;
        });
        
        // Request render if particles exist
        if (this.particles.length > 0) {
            this.requestRender();
        }
    }

    // Throttled pointer event handlers
    handlePointerEnter = (e) => {
        this.isHovering = true;
        if (this.interactionEnabled) {
            this.gridContainer.classList.add('interactive');
        }
        this.requestRender();
    }

    handlePointerLeave = (e) => {
        this.isHovering = false;
        this.hoverCoordinate = null;
        this.gridContainer.classList.remove('interactive');
        this.requestRender();
    }

    handlePointerMove = (e) => {
        if (!this.interactionEnabled || !this.isHovering) return;
        
        const now = Date.now();
        if (now - this.lastInteractionTime < this.interactionThrottle) return;
        this.lastInteractionTime = now;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvasSize.width / rect.width;
        const scaleY = this.canvasSize.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        this.hoverCoordinate = this.canvasToCoord(x, y);
        this.requestRender();
    }

    handlePointerDown = (e) => {
        if (!this.interactionEnabled || e.button !== 0) return;
        this.isDragging = true;
    }

    handlePointerUp = (e) => {
        if (!this.interactionEnabled || !this.isDragging || e.button !== 0) return;
        
        this.isDragging = false;
        if (this.hoverCoordinate) {
            this.handleGuessPlacement(this.hoverCoordinate);
        }
    }

    handleGuessPlacement(coordinate) {
        const roundedCoordinate = {
            x: Math.round(coordinate.x),
            y: Math.round(coordinate.y)
        };
        
        this.previewGuess = roundedCoordinate;
        const pos = this.coordToCanvas(roundedCoordinate);
        this.createPlacementParticles(pos.x, pos.y);
        
        this.stateManager.emit('spectrum:guess-placed', { coordinate: roundedCoordinate });
        this.requestRender();
    }

    createPlacementParticles(x, y) {
        // Limit particle creation
        const particleCount = Math.min(8, this.maxParticles - this.particles.length);
        
        for (let i = 0; i < particleCount; i++) {
            const particle = this.getPooledParticle();
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 2;
            
            particle.x = x;
            particle.y = y;
            particle.vx = Math.cos(angle) * speed;
            particle.vy = Math.sin(angle) * speed;
            particle.size = 3;
            particle.alpha = 1;
            particle.decay = 0.05;
            particle.shrink = 0.95;
            particle.color = this.colors.lilac;
            particle.active = true;
            
            if (!this.particles.includes(particle)) {
                this.particles.push(particle);
            }
        }
        
        this.requestRender();
    }

    updateSpectrumX(spectrum) {
        this.spectrumX = spectrum;
        this.gradientCache.clear();
        this.requestRender();
    }

    updateSpectrumY(spectrum) {
        this.spectrumY = spectrum;
        this.gradientCache.clear();
        this.requestRender();
    }

    updateTargetCoordinate(coordinate) {
        this.targetCoordinate = coordinate;
        this.updateTargetVisibility();
        this.requestRender();
    }

    updateGuesses(guesses) {
        this.guesses = guesses || {};
        this.requestRender();
    }

    setInteractionEnabled(enabled) {
        this.interactionEnabled = enabled;
        
        if (enabled) {
            this.gridContainer.classList.add('interactive');
        } else {
            this.gridContainer.classList.remove('interactive');
            this.isHovering = false;
            this.hoverCoordinate = null;
        }
        
        this.requestRender();
    }

    setShowTarget(show) {
        this.showTarget = show;
        this.requestRender();
    }

    updateTargetVisibility() {
        const isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        const gamePhase = this.stateManager.getGameState().phase;
        
        this.showTarget = (isClueGiver && ['giving-clue', 'guessing'].includes(gamePhase)) || gamePhase === 'scoring';
        this.requestRender();
    }

    handlePhaseChange(phase) {
        const actions = {
            'giving-clue': () => {
                this.guesses = {};
                this.previewGuess = null;
            },
            'guessing': () => {
                this.previewGuess = null;
            },
            'lobby': () => this.clearRoundData(),
            'waiting': () => this.clearRoundData()
        };
        
        actions[phase]?.();
        this.requestRender();
    }

    clearRoundData() {
        Object.assign(this, {
            targetCoordinate: null,
            guesses: {},
            previewGuess: null,
            showTarget: false,
            particles: []
        });
        this.gradientCache.clear();
        this.requestRender();
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        clearTimeout(this.resizeTimeout);
        
        const events = ['pointerenter', 'pointerleave', 'pointermove', 'pointerdown', 'pointerup'];
        events.forEach(event => this.canvas?.removeEventListener(event, this[`handle${event.charAt(0).toUpperCase() + event.slice(1)}`]));
        
        if (this.canvas?.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        Object.assign(this, {
            canvas: null,
            ctx: null,
            particles: [],
            particlePool: [],
            gradientCache: new Map()
        });
        
        this.clearRoundData();
    }
}