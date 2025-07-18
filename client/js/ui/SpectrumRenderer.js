/**
 * Spectrum Renderer - Interactive 2D spectrum grid visualization
 * Handles 2D grid display, coordinate guessing, and animations
 * UPDATED: Optimized for new simplified spectrum area structure
 */

import { gameLogic } from '../game/GameLogic.js';

export class SpectrumRenderer {
    constructor(stateManager) {
        Object.assign(this, {
            stateManager,
            canvas: null,
            ctx: null,
            gridContainer: null,
            devicePixelRatio: window.devicePixelRatio || 1,
            spectrumX: null,
            spectrumY: null,
            targetCoordinate: null,
            guesses: {},
            showTarget: false,
            interactionEnabled: false,
            animationFrame: null,
            animations: [],
            particles: [],
            isHovering: false,
            hoverCoordinate: null,
            isDragging: false,
            previewGuess: null,
            containerRect: null,
            canvasSize: { width: 0, height: 0 },
            gradientCache: new Map(),
            debugMode: false,
            frameCount: 0,
            logFrequency: 60,
            _isClueGiver: undefined,
            // Performance optimizations
            renderThrottleTime: 16, // ~60fps
            lastRenderTime: 0,
            renderRequested: false,
            offscreenCanvas: null,
            offscreenCtx: null,
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
    }

    async init() {
        console.log('🎨 Initializing SpectrumRenderer...');
        this.setupCanvas();
        this.setupEventListeners();
        this.setupStateListeners();
        this.startRenderLoop();
        console.log('✅ SpectrumRenderer initialized');
    }

    setupCanvas() {
        this.gridContainer = document.getElementById('spectrum-grid');
        if (!this.gridContainer) {
            console.error('❌ Spectrum grid container not found');
            return;
        }
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'spectrum-canvas';
        this.ctx = this.canvas.getContext('2d', { 
            alpha: false,
            desynchronized: true,
            willReadFrequently: false
        });
        
        this.gridContainer.appendChild(this.canvas);
        
        // Create offscreen canvas for double buffering
        if (window.OffscreenCanvas) {
            this.offscreenCanvas = new OffscreenCanvas(1, 1);
            this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        }
        
        this.updateCanvasSize();
        console.log('📐 Canvas setup complete');
    }

    setupEventListeners() {
        // Use ResizeObserver for better performance
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    if (entry.target === this.gridContainer) {
                        this.handleResize();
                    }
                }
            });
            this.resizeObserver.observe(this.gridContainer);
        } else {
            window.addEventListener('resize', this.throttledResize);
        }
        
        // Use passive event listeners for better scroll performance
        const events = [
            ['pointerenter', this.handlePointerEnter, { passive: true }],
            ['pointerleave', this.handlePointerLeave, { passive: true }],
            ['pointermove', this.handlePointerMove, { passive: true }],
            ['pointerdown', this.handlePointerDown, { passive: true }],
            ['pointerup', this.handlePointerUp, { passive: true }],
            ['contextmenu', e => e.preventDefault(), { passive: false }]
        ];
        
        events.forEach(([event, handler, options]) => 
            this.canvas.addEventListener(event, handler.bind(this), options));
    }

    // Throttled resize handler
    throttledResize = this.throttle(() => this.handleResize(), 250);
    
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return (...args) => {
            const currentTime = Date.now();
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
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
        const size = Math.min(width, height);
        
        this.canvasSize = { width: size, height: size };
        
        // Set canvas size accounting for device pixel ratio
        this.canvas.width = size * this.devicePixelRatio;
        this.canvas.height = size * this.devicePixelRatio;
        
        // Update offscreen canvas size
        if (this.offscreenCanvas) {
            this.offscreenCanvas.width = this.canvas.width;
            this.offscreenCanvas.height = this.canvas.height;
        }
        
        // Center canvas in container
        this.canvas.style.width = `${size}px`;
        this.canvas.style.height = `${size}px`;
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = `${(width - size) / 2}px`;
        this.canvas.style.top = `${(height - size) / 2}px`;
        
        // Scale context for device pixel ratio
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);

        if (this.offscreenCtx) {
            this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.offscreenCtx.scale(this.devicePixelRatio, this.devicePixelRatio);
        }
        
        // Clear gradient cache when resizing
        this.gradientCache.clear();
        
        console.log(`📏 Canvas resized to ${size}x${size} (DPR: ${this.devicePixelRatio})`);
    }

    handleResize = () => {
        this.updateCanvasSize();
        this.requestRender();
    }

    startRenderLoop() {
        const renderFrame = (timestamp) => {
            // Only render if requested and enough time has passed
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
        if (!this.ctx || !this.canvasSize.width) return;

        const ctx = this.offscreenCtx || this.ctx;
        const size = this.canvasSize.width;
        
        // Clear with solid color (faster than clearRect)
        ctx.fillStyle = this.colors.darkBg;
        ctx.fillRect(0, 0, size, size);

        // Update animations
        this.updateAnimations();

        // Render layers in order
        this.render2DGradient(ctx);
        this.renderGridLines(ctx);
        this.renderParticles(ctx);

        if (this.shouldRenderTarget()) {
            this.renderTarget(ctx);
        }
        
        this.renderGuesses(ctx);

        if (this.isHovering && this.interactionEnabled && this.hoverCoordinate) {
            this.renderHoverPreview(ctx);
        }

        if (this.previewGuess) {
            this.renderPreviewGuess(ctx);
        }

        // Copy offscreen canvas to main canvas if using double buffering
        if (this.offscreenCanvas) {
            this.ctx.drawImage(this.offscreenCanvas, 0, 0, size, size);
        }

        if (this.debugMode && this.frameCount % this.logFrequency === 0) {
            this.renderDebugInfo(ctx);
        }
        
        this.frameCount++;
    }

    render2DGradient(ctx) {
        const size = this.canvasSize.width;
        ctx.save();

        if (!this.spectrumX || !this.spectrumY) {
            ctx.fillStyle = this.colors.glassBg;
            ctx.fillRect(0, 0, size, size);
        } else {
            // Use cached gradients for performance
            const cacheKey = `${this.spectrumX.id}-${this.spectrumY.id}-${size}`;
            let gradientX, gradientY;

            if (this.gradientCache.has(cacheKey)) {
                const cached = this.gradientCache.get(cacheKey);
                gradientX = cached.x;
                gradientY = cached.y;
            } else {
                // Create X gradient
                gradientX = ctx.createLinearGradient(0, 0, size, 0);
                if (this.spectrumX.gradient) {
                    gradientX.addColorStop(0, this.spectrumX.gradient.start + '60');
                    if (this.spectrumX.gradient.middle) {
                        gradientX.addColorStop(0.5, this.spectrumX.gradient.middle + '60');
                    }
                    gradientX.addColorStop(1, this.spectrumX.gradient.end + '60');
                }
                
                // Create Y gradient (inverted for proper display)
                gradientY = ctx.createLinearGradient(0, size, 0, 0);
                if (this.spectrumY.gradient) {
                    gradientY.addColorStop(0, this.spectrumY.gradient.start + '60');
                    if (this.spectrumY.gradient.middle) {
                        gradientY.addColorStop(0.5, this.spectrumY.gradient.middle + '60');
                    }
                    gradientY.addColorStop(1, this.spectrumY.gradient.end + '60');
                }

                this.gradientCache.set(cacheKey, { x: gradientX, y: gradientY });
            }
            
            // Apply gradients with blend mode for 2D effect
            ctx.fillStyle = gradientX;
            ctx.fillRect(0, 0, size, size);
            
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = gradientY;
            ctx.fillRect(0, 0, size, size);
            
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
    }

    renderGridLines(ctx) {
        const size = this.canvasSize.width;
        ctx.save();
        
        // Use a single path for all grid lines
        ctx.beginPath();
        
        // Minor grid lines
        ctx.strokeStyle = this.colors.gridLine;
        ctx.lineWidth = 1;
        
        const step = size / 10;
        for (let i = 1; i < 10; i++) {
            const pos = step * i;
            if (i !== 5) { // Skip center lines
                ctx.moveTo(pos, 0);
                ctx.lineTo(pos, size);
                ctx.moveTo(0, pos);
                ctx.lineTo(size, pos);
            }
        }
        ctx.stroke();
        
        // Major grid lines
        ctx.beginPath();
        ctx.strokeStyle = this.colors.gridLineMajor;
        ctx.lineWidth = 2;
        
        const centerPos = size / 2;
        ctx.moveTo(centerPos, 0);
        ctx.lineTo(centerPos, size);
        ctx.moveTo(0, centerPos);
        ctx.lineTo(size, centerPos);
        ctx.stroke();
        
        // Border
        ctx.strokeRect(0, 0, size, size);
        
        ctx.restore();
    }

    coordToCanvas(coord) {
        const size = this.canvasSize.width;
        return {
            x: (coord.x / 100) * size,
            y: size - (coord.y / 100) * size // Y is inverted
        };
    }

    canvasToCoord(x, y) {
        const size = this.canvasSize.width;
        return {
            x: Math.max(0, Math.min(100, Math.round((x / size) * 100))),
            y: Math.max(0, Math.min(100, Math.round((1 - y / size) * 100))) // Y is inverted
        };
    }

    shouldRenderTarget() {
        const hasValidCoordinate = this.targetCoordinate && 
                                  typeof this.targetCoordinate.x === 'number' &&
                                  typeof this.targetCoordinate.y === 'number';
        const isClueGiver = this._isClueGiver ?? this.stateManager.isCurrentPlayerClueGiver();
        return hasValidCoordinate && this.showTarget && isClueGiver;
    }

    renderTarget(ctx) {
        const pos = this.coordToCanvas(this.targetCoordinate);
        
        ctx.save();
        
        const pulse = Math.sin(Date.now() * 0.003) * 0.1 + 1;
        
        // Use transform for GPU acceleration
        ctx.translate(pos.x, pos.y);
        ctx.scale(pulse, pulse);
        
        // Outer glow
        ctx.shadowColor = this.colors.red;
        ctx.shadowBlur = 30;
        
        // Main target
        ctx.fillStyle = this.colors.red;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner circle
        ctx.shadowBlur = 0;
        ctx.fillStyle = this.colors.darkBg;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Center dot
        ctx.fillStyle = this.colors.red;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        // Position label
        this.renderCoordinateLabel(ctx, pos.x, pos.y + 35, this.targetCoordinate, this.colors.red);
    }

    renderGuesses(ctx) {
        const players = this.stateManager.getPlayers();
        const playerColors = [this.colors.teal, this.colors.green, this.colors.orange, this.colors.lilac];
        
        Object.entries(this.guesses).forEach(([playerId, coordinate], index) => {
            const player = players[playerId];
            if (!player || !coordinate) return;
            
            const pos = this.coordToCanvas(coordinate);
            const color = playerColors[index % playerColors.length];
            
            this.renderGuessMarker(ctx, pos.x, pos.y, color, player.name.charAt(0).toUpperCase());
        });
    }

    renderGuessMarker(ctx, x, y, color, initial) {
        ctx.save();
        ctx.translate(x, y);
        
        // Outer glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        
        // Main marker
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Border
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.colors.darkBg;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Initial
        ctx.fillStyle = this.colors.darkBg;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, 0, 0);
        
        ctx.restore();
    }

    renderHoverPreview(ctx) {
        const pos = this.coordToCanvas(this.hoverCoordinate);
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        
        // Hover marker
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = this.colors.lilac;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Animated ring
        ctx.globalAlpha = 1;
        ctx.strokeStyle = this.colors.lilac;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = Date.now() / 50;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
        
        // Subtle crosshair
        ctx.save();
        ctx.strokeStyle = this.colors.lilac;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.2;
        const size = this.canvasSize.width;
        
        ctx.beginPath();
        ctx.moveTo(pos.x, 0);
        ctx.lineTo(pos.x, size);
        ctx.moveTo(0, pos.y);
        ctx.lineTo(size, pos.y);
        ctx.stroke();
        
        ctx.restore();
        
        // Coordinate indicator
        this.renderCoordinateLabel(ctx, pos.x, pos.y - 30, this.hoverCoordinate);
    }

    renderPreviewGuess(ctx) {
        const pos = this.coordToCanvas(this.previewGuess);
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        
        const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 0.8;
        ctx.globalAlpha = pulse;
        ctx.scale(1, 1);
        
        ctx.fillStyle = this.colors.lilac;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = this.colors.darkBg;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    }

    renderCoordinateLabel(ctx, x, y, coordinate, color = this.colors.textPrimary) {
        ctx.save();
        
        const text = `(${Math.round(coordinate.x)}, ${Math.round(coordinate.y)})`;
        ctx.font = '14px Arial';
        const metrics = ctx.measureText(text);
        const padding = 12;
        const width = metrics.width + padding * 2;
        const height = 28;
        
        // Adjust position to keep within canvas
        const size = this.canvasSize.width;
        const adjustedX = Math.max(width/2, Math.min(size - width/2, x));
        const adjustedY = Math.max(height/2, Math.min(size - height/2, y));
        
        // Background
        ctx.fillStyle = 'rgba(10, 15, 28, 0.95)';
        ctx.fillRect(adjustedX - width/2, adjustedY - height/2, width, height);
        
        // Border
        ctx.strokeStyle = color + '80';
        ctx.lineWidth = 1;
        ctx.strokeRect(adjustedX - width/2, adjustedY - height/2, width, height);
        
        // Text
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, adjustedX, adjustedY);
        
        ctx.restore();
    }

    renderDebugInfo(ctx) {
        if (!this.debugMode) return;
        
        ctx.save();
        ctx.font = '12px monospace';
        ctx.fillStyle = this.colors.textSecondary;
        
        const fps = Math.round(1000 / this.renderThrottleTime);
        const particleCount = this.particles.length;
        const animationCount = this.animations.length;
        
        const debugText = `FPS: ${fps} | Particles: ${particleCount} | Animations: ${animationCount}`;
        
        ctx.fillText(debugText, 10, 20);
        ctx.restore();
    }

    renderParticles(ctx) {
        // Batch render particles for performance
        ctx.save();
        
        this.particles.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }

    updateAnimations() {
        const now = Date.now();
        const deltaTime = 16; // Assume 60fps
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx * deltaTime / 16;
            p.y += p.vy * deltaTime / 16;
            p.alpha -= p.decay * deltaTime / 16;
            p.size *= p.shrink;
            return p.alpha > 0 && p.size > 0.1;
        });
        
        // Update animations
        this.animations = this.animations.filter(a => {
            const progress = (now - a.startTime) / a.duration;
            if (progress >= 1) {
                a.onComplete?.();
                return false;
            }
            a.onUpdate?.(progress);
            return true;
        });
        
        // Request render if animations are active
        if (this.particles.length > 0 || this.animations.length > 0) {
            this.requestRender();
        }
    }

    // Optimized pointer event handlers
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
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
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
        
        console.log(`🎲 Guess placed at coordinate (${roundedCoordinate.x}, ${roundedCoordinate.y})`);
        
        this.previewGuess = roundedCoordinate;
        const pos = this.coordToCanvas(roundedCoordinate);
        this.createPlacementParticles(pos.x, pos.y);
        
        this.stateManager.emit('spectrum:guess-placed', { coordinate: roundedCoordinate });
        this.requestRender();
    }

    createPlacementParticles(x, y) {
        const colors = [this.colors.lilac, this.colors.pink, this.colors.teal, this.colors.green];
        
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 * i) / 16;
            const speed = 2 + Math.random() * 4;
            
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 4,
                alpha: 1,
                decay: 0.025,
                shrink: 0.97,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
        
        this.requestRender();
    }

    createCelebrationParticles(x, y, color = null) {
        const defaultColor = color || this.colors.green;
        for (let i = 0; i < 24; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 6;
            
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 4 + Math.random() * 5,
                alpha: 1,
                decay: 0.02,
                shrink: 0.96,
                color: defaultColor
            });
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
        const oldCoordinate = this.targetCoordinate;
        this.targetCoordinate = coordinate;
        
        this.updateTargetVisibility();
        
        if (this.showTarget && coordinate && 
            (!oldCoordinate || oldCoordinate.x !== coordinate.x || oldCoordinate.y !== coordinate.y)) {
            this.animateTargetReveal();
        }
        
        this.requestRender();
    }

    updateGuesses(guesses) {
        const oldGuesses = { ...this.guesses };
        this.guesses = guesses || {};
        
        Object.entries(this.guesses).forEach(([playerId, coordinate]) => {
            if (!(playerId in oldGuesses)) {
                this.animateGuessPlacement(coordinate);
            }
        });
        
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
        const oldShowTarget = this.showTarget;
        this.showTarget = show;
        
        if (show && !oldShowTarget && this.targetCoordinate) {
            this.animateTargetReveal();
        }
        
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
            'scoring': () => this.animateScoreReveal(),
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

    animateTargetReveal() {
        if (!this.targetCoordinate) return;
        const pos = this.coordToCanvas(this.targetCoordinate);
        this.createCelebrationParticles(pos.x, pos.y, this.colors.red);
    }

    animateGuessPlacement(coordinate) {
        const pos = this.coordToCanvas(coordinate);
        this.createPlacementParticles(pos.x, pos.y);
    }

    animateScoreReveal() {
        Object.values(this.guesses).forEach(coordinate => {
            const pos = this.coordToCanvas(coordinate);
            this.createCelebrationParticles(pos.x, pos.y);
        });
        
        if (this.targetCoordinate) {
            setTimeout(() => {
                const pos = this.coordToCanvas(this.targetCoordinate);
                this.createCelebrationParticles(pos.x, pos.y, this.colors.orange);
            }, 500);
        }
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        } else {
            window.removeEventListener('resize', this.throttledResize);
        }
        
        // Remove event listeners
        const events = ['pointerenter', 'pointerleave', 'pointermove', 'pointerdown', 'pointerup', 'contextmenu'];
        events.forEach(event => this.canvas?.removeEventListener(event, this[`handle${event.charAt(0).toUpperCase() + event.slice(1)}`]));
        
        if (this.canvas?.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        Object.assign(this, {
            canvas: null,
            ctx: null,
            offscreenCanvas: null,
            offscreenCtx: null,
            animations: [],
            particles: [],
            gradientCache: new Map()
        });
        
        this.clearRoundData();
        console.log('🧹 SpectrumRenderer destroyed');
    }
}