/**
 * Spectrum Renderer - Interactive 2D spectrum grid visualization
 * OPTIMIZED: Reduced computational overhead while maintaining functionality
 * 
 * @class SpectrumRenderer
 * @description Handles the rendering of the 2D spectrum grid, player guesses, target positions,
 * and interactive elements. Implements optimized partial rendering with dirty region tracking.
 */

import { gameLogic } from '../game/GameLogic.js';

export class SpectrumRenderer {
    /**
     * @constructor
     * @param {Object} stateManager - The state management instance
     */
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
            dirtyRegions: [],
            lastRenderState: {
                guesses: {},
                particles: [],
                hoverCoordinate: null,
                previewGuess: null,
                targetCoordinate: null,
                showTarget: false
            },
            renderThrottleTime: 33, // ~30fps
            lastRenderTime: 0,
            renderRequested: false,
            maxParticles: 50,
            particlePoolSize: 100,
            particlePool: [],
            lastInteractionTime: 0,
            interactionThrottle: 50,
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
        
        // Pre-create particle pool for performance
        this.particlePool = Array(this.particlePoolSize).fill().map(() => ({
            x: 0, y: 0, vx: 0, vy: 0, size: 0, alpha: 0, decay: 0,
            shrink: 0, color: '', active: false
        }));
    }

    /**
     * Initialize the spectrum renderer
     * @async
     * @returns {Promise<void>}
     */
    async init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupStateListeners();
        this.startRenderLoop();
        this.markDirty();
        this.requestRender();
    }

    /**
     * Set up the canvas element and context
     * @private
     */
    setupCanvas() {
        this.gridContainer = document.getElementById('spectrum-grid');
        if (!this.gridContainer) return;
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'spectrum-canvas';
        this.ctx = this.canvas.getContext('2d', { 
            alpha: false, // No transparency for better performance
            desynchronized: true // Reduce latency
        });
        
        this.gridContainer.appendChild(this.canvas);
        this.updateCanvasSize();
    }

    /**
     * Set up event listeners for canvas interaction and window events
     * @private
     */
    setupEventListeners() {
        // Resize observer for responsive canvas
        this.resizeObserver = new ResizeObserver(() => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.handleResize(), 250);
        });
        this.resizeObserver.observe(this.gridContainer);
        
        // IMPORTANT: Monitor DPR changes to handle browser zoom
        // This fixes the issue where elements weren't scaling properly with zoom
        let lastDPR = window.devicePixelRatio;
        const checkDPR = () => {
            if (window.devicePixelRatio !== lastDPR) {
                lastDPR = window.devicePixelRatio;
                this.handleResize();
            }
        };
        this.dprCheckInterval = setInterval(checkDPR, 500);
        
        window.addEventListener('resize', this.handleResize);
        
        // Pointer events for interaction
        const events = {
            pointerenter: this.handlePointerEnter,
            pointerleave: this.handlePointerLeave,
            pointermove: this.handlePointerMove,
            pointerdown: this.handlePointerDown,
            pointerup: this.handlePointerUp
        };
        
        Object.entries(events).forEach(([event, handler]) => 
            this.canvas.addEventListener(event, handler.bind(this), { passive: true }));
    }

    /**
     * Set up state change listeners
     * @private
     */
    setupStateListeners() {
        const listeners = {
            'game.spectrumX': d => this.updateSpectrum('spectrumX', d.newValue),
            'game.spectrumY': d => this.updateSpectrum('spectrumY', d.newValue),
            'game.targetCoordinate': d => this.updateTargetCoordinate(d.newValue),
            'game.guesses': d => this.updateGuesses(d.newValue),
            'ui.spectrumInteractionEnabled': d => this.setInteractionEnabled(d.newValue),
            'ui.showTargetCoordinate': d => this.setShowTarget(d.newValue),
            'game.phase': d => this.handlePhaseChange(d.newValue),
            'game.clueGiverId': () => this.updateTargetVisibility()
        };
        
        Object.entries(listeners).forEach(([state, handler]) => 
            this.stateManager.on(`state:${state}`, handler));
    }

    /**
     * Update canvas size and handle DPR changes
     * @private
     */
    updateCanvasSize() {
        if (!this.canvas || !this.gridContainer) return;
        
        const rect = this.gridContainer.getBoundingClientRect();
        const {width, height} = rect;
        
        // Always check DPR to handle zoom changes
        const currentDPR = Math.min(window.devicePixelRatio || 1, 2);
        
        // Only update if something changed
        if (this.canvasSize.width === width && 
            this.canvasSize.height === height && 
            this.devicePixelRatio === currentDPR) return;
        
        this.containerRect = rect;
        this.canvasSize = {width, height};
        this.devicePixelRatio = currentDPR;
        
        // Scale both physical and CSS sizes
        const scale = (canvas, ctx, w, h) => {
            canvas.width = w * this.devicePixelRatio;
            canvas.height = h * this.devicePixelRatio;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
        };
        
        scale(this.canvas, this.ctx, width, height);
        
        this.markDirty();
        this.render();
    }

    /**
     * Handle window resize events
     * @private
     */
    handleResize = () => {
        this.updateCanvasSize();
        this.requestRender();
    }

    /**
     * Start the render loop
     * @private
     */
    startRenderLoop() {
        let isFirstRender = true;
        
        const renderFrame = (timestamp) => {
            if (isFirstRender) {
                this.markDirty();
                this.render();
                isFirstRender = false;
            } else if (this.renderRequested && timestamp - this.lastRenderTime >= this.renderThrottleTime) {
                if (!this.dirtyRegions.length) this.checkStateChanges();
                if (this.dirtyRegions.length) this.render();
                this.lastRenderTime = timestamp;
                this.renderRequested = false;
            }
            this.animationFrame = requestAnimationFrame(renderFrame);
        };
        this.animationFrame = requestAnimationFrame(renderFrame);
    }

    /**
     * Request a render on the next frame
     * @public
     */
    requestRender() {
        this.renderRequested = true;
    }
    
    /**
     * Mark a specific region as needing redraw
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Region width
     * @param {number} height - Region height
     * @private
     */
    markRegionDirty(x, y, width, height) {
        this.dirtyRegions.push({
            x: Math.max(0, x - 2),
            y: Math.max(0, y - 2),
            width: width + 4,
            height: height + 4
        });
        this.requestRender();
    }
    
    /**
     * Mark the entire canvas as needing redraw
     * @public
     */
    markDirty() {
        this.dirtyRegions = [{
            x: 0, y: 0,
            width: this.canvasSize.width,
            height: this.canvasSize.height
        }];
        this.requestRender();
    }
    
    /**
     * Check for state changes and mark dirty regions
     * @private
     */
    checkStateChanges() {
        // IMPORTANT: Force full redraw when hovering to prevent artifacts
        // This fixes the semi-transparent square issue during hover
        if (this.isHovering && this.interactionEnabled && this.hoverCoordinate) {
            this.markDirty();
            return;
        }
        
        const state = {
            guesses: this.guesses,
            particles: this.particles,
            hoverCoordinate: this.hoverCoordinate,
            previewGuess: this.previewGuess,
            targetCoordinate: this.targetCoordinate,
            showTarget: this.showTarget
        };
        
        const markCoords = (coords, size = 20) => {
            coords?.forEach(coord => {
                if (coord) {
                    const pos = this.coordToCanvas(coord);
                    this.markRegionDirty(pos.x - size, pos.y - size, size * 2, size * 2);
                }
            });
        };
        
        // Ensure target is always marked if visible
        if (this.shouldRenderTarget() && this.targetCoordinate) {
            markCoords([this.targetCoordinate], 20);
        }
        
        // Check for guess changes
        if (JSON.stringify(Object.keys(state.guesses)) !== JSON.stringify(Object.keys(this.lastRenderState.guesses))) {
            markCoords(Object.values(this.lastRenderState.guesses));
            markCoords(Object.values(state.guesses));
        }
        
        // Check for other state changes
        ['targetCoordinate', 'hoverCoordinate', 'previewGuess'].forEach(key => {
            if (JSON.stringify(state[key]) !== JSON.stringify(this.lastRenderState[key])) {
                markCoords([state[key], this.lastRenderState[key]], key === 'targetCoordinate' ? 20 : 15);
            }
        });
        
        // Check particles
        if (this.particles.length || this.lastRenderState.particles.length) {
            [...this.particles, ...this.lastRenderState.particles]
                .filter(p => p.active)
                .forEach(p => this.markRegionDirty(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2));
        }
        
        this.lastRenderState = JSON.parse(JSON.stringify(state));
    }

    /**
     * Main render method with dirty region optimization
     * @private
     */
    render() {
        if (!this.ctx || !this.canvasSize.width || !this.canvasSize.height || !this.dirtyRegions.length) return;
        
        const {width, height} = this.canvasSize;
        
        // Merge overlapping regions for efficiency
        this.mergeOverlappingRegions();
        
        // Check if we should do a full redraw
        const totalDirtyArea = this.dirtyRegions.reduce((sum, r) => sum + r.width * r.height, 0);
        const isFullRedraw = totalDirtyArea > width * height * 0.6;
        
        if (isFullRedraw) {
            this.dirtyRegions = [{x: 0, y: 0, width, height}];
        }
        
        this.updateParticles();
        
        // Render function for all elements
        const renderAll = () => {
            this.ctx.fillStyle = this.colors.darkBg;
            this.ctx.fillRect(0, 0, width, height);
            this.render2DGradient();
            this.renderGridLines();
            if (this.particles.length) this.renderParticles();
            if (this.shouldRenderTarget()) this.renderTarget();
            this.renderGuesses();
            if (this.isHovering && this.interactionEnabled && this.hoverCoordinate) this.renderHoverPreview();
            if (this.previewGuess) this.renderPreviewGuess();
        };
        
        // Full redraw or partial redraw
        if (this.dirtyRegions.length === 1 && isFullRedraw) {
            renderAll();
        } else {
            // Partial redraw for each dirty region
            this.dirtyRegions.forEach(region => {
                this.ctx.save();
                this.ctx.fillStyle = this.colors.darkBg;
                this.ctx.fillRect(region.x, region.y, region.width, region.height);
                this.ctx.beginPath();
                this.ctx.rect(region.x, region.y, region.width, region.height);
                this.ctx.clip();
                
                this.render2DGradient();
                this.renderGridLines();
                
                const inRegion = (x, y, radius) => 
                    x + radius >= region.x && x - radius <= region.x + region.width &&
                    y + radius >= region.y && y - radius <= region.y + region.height;
                
                if (this.particles.length) this.renderParticlesInRegion(region);
                
                if (this.shouldRenderTarget()) {
                    const pos = this.coordToCanvas(this.targetCoordinate);
                    if (inRegion(pos.x, pos.y, 15)) this.renderTarget();
                }
                
                this.renderGuessesInRegion(region);
                
                if (this.isHovering && this.interactionEnabled && this.hoverCoordinate) {
                    const pos = this.coordToCanvas(this.hoverCoordinate);
                    if (inRegion(pos.x, pos.y, 10)) this.renderHoverPreview();
                }
                
                if (this.previewGuess) {
                    const pos = this.coordToCanvas(this.previewGuess);
                    if (inRegion(pos.x, pos.y, 10)) this.renderPreviewGuess();
                }
                
                this.ctx.restore();
            });
        }
        
        this.dirtyRegions = [];
    }

    /**
     * Merge overlapping dirty regions to reduce draw calls
     * @private
     */
    mergeOverlappingRegions() {
        if (this.dirtyRegions.length <= 1) return;
        
        let i = 0;
        while (i < this.dirtyRegions.length) {
            let j = i + 1;
            while (j < this.dirtyRegions.length) {
                const r1 = this.dirtyRegions[i], r2 = this.dirtyRegions[j];
                if (r1.x <= r2.x + r2.width && r1.x + r1.width >= r2.x &&
                    r1.y <= r2.y + r2.height && r1.y + r1.height >= r2.y) {
                    r1.x = Math.min(r1.x, r2.x);
                    r1.y = Math.min(r1.y, r2.y);
                    r1.width = Math.max(r1.x + r1.width, r2.x + r2.width) - r1.x;
                    r1.height = Math.max(r1.y + r1.height, r2.y + r2.height) - r1.y;
                    this.dirtyRegions.splice(j, 1);
                } else j++;
            }
            i++;
        }
    }

    /**
     * Render the 2D gradient background
     * @private
     */
    render2DGradient() {
        const {width, height} = this.canvasSize;
        this.ctx.save();

        if (!this.spectrumX || !this.spectrumY) {
            this.ctx.fillStyle = this.colors.glassBg;
            this.ctx.fillRect(0, 0, width, height);
        } else {
            const createGradient = (isX, spec) => {
                const grad = isX 
                    ? this.ctx.createLinearGradient(0, 0, width, 0)
                    : this.ctx.createLinearGradient(0, height, 0, 0);
                if (spec.gradient) {
                    grad.addColorStop(0, spec.gradient.start + '40');
                    if (spec.gradient.middle) grad.addColorStop(0.5, spec.gradient.middle + '40');
                    grad.addColorStop(1, spec.gradient.end + '40');
                }
                return grad;
            };
            
            this.ctx.fillStyle = createGradient(true, this.spectrumX);
            this.ctx.fillRect(0, 0, width, height);
            
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.fillStyle = createGradient(false, this.spectrumY);
            this.ctx.fillRect(0, 0, width, height);
            
            this.ctx.globalCompositeOperation = 'source-over';
        }

        this.ctx.restore();
    }

    /**
     * Render grid lines
     * @private
     */
    renderGridLines() {
        const {width, height} = this.canvasSize;
        this.ctx.save();
        this.ctx.strokeStyle = this.colors.gridLineMajor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(width / 2, 0);
        this.ctx.lineTo(width / 2, height);
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
        this.ctx.strokeRect(0, 0, width, height);
        this.ctx.restore();
    }

    /**
     * Convert game coordinates (0-100) to canvas pixels
     * @param {Object} coord - Game coordinate {x, y}
     * @returns {Object} Canvas position {x, y}
     * @private
     */
    coordToCanvas(coord) {
        return {
            x: (coord.x / 100) * this.canvasSize.width,
            y: this.canvasSize.height - (coord.y / 100) * this.canvasSize.height
        };
    }

    /**
     * Convert canvas pixels to game coordinates (0-100)
     * @param {number} x - Canvas X position
     * @param {number} y - Canvas Y position
     * @returns {Object} Game coordinate {x, y}
     * @private
     */
    canvasToCoord(x, y) {
        const {width, height} = this.canvasSize;
        return {
            x: Math.max(0, Math.min(100, Math.round((x / width) * 100))),
            y: Math.max(0, Math.min(100, Math.round((1 - y / height) * 100)))
        };
    }

    /**
     * Check if target should be rendered
     * @returns {boolean}
     * @private
     */
    shouldRenderTarget() {
        return this.targetCoordinate && 
            typeof this.targetCoordinate.x === 'number' && 
            typeof this.targetCoordinate.y === 'number' && 
            this.showTarget;
    }
    
    /**
     * Render the target marker
     * @private
     */
    renderTarget() {
        const pos = this.coordToCanvas(this.targetCoordinate);
        
        this.ctx.save();
        
        // Concentric circles for target
        [15, 10, 4].forEach((radius, i) => {
            this.ctx.fillStyle = i % 2 ? this.colors.darkBg : this.colors.red;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.restore();
    }

    /**
     * Render all player guesses
     * IMPORTANT: Renders directly to main context to ensure proper grid locking
     * @private
     */
    renderGuesses() {
        const players = this.stateManager.getPlayers();
        const playerColors = [this.colors.teal, this.colors.green, this.colors.orange, this.colors.lilac];
        
        Object.entries(this.guesses).forEach(([playerId, coordinate], index) => {
            const player = players[playerId];
            if (!player || !coordinate) return;
            
            // IMPORTANT: Round coordinates to ensure consistency with target
            const roundedCoord = {
                x: Math.round(coordinate.x),
                y: Math.round(coordinate.y)
            };
            
            const pos = this.coordToCanvas(roundedCoord);
            this.renderGuessMarker(this.ctx, pos.x, pos.y,
                playerColors[index % playerColors.length], 
                player.name.charAt(0).toUpperCase());
        });
    }
    
    /**
     * Render guesses within a specific region
     * @param {Object} region - Dirty region to render within
     * @private
     */
    renderGuessesInRegion(region) {
        const players = this.stateManager.getPlayers();
        const playerColors = [this.colors.teal, this.colors.green, this.colors.orange, this.colors.lilac];
        
        Object.entries(this.guesses).forEach(([playerId, coordinate], index) => {
            const player = players[playerId];
            if (!player || !coordinate) return;
            
            const roundedCoord = {
                x: Math.round(coordinate.x),
                y: Math.round(coordinate.y)
            };
            
            const pos = this.coordToCanvas(roundedCoord);
            
            if (pos.x + 12 >= region.x && pos.x - 12 <= region.x + region.width &&
                pos.y + 12 >= region.y && pos.y - 12 <= region.y + region.height) {
                this.renderGuessMarker(this.ctx, pos.x, pos.y,
                    playerColors[index % playerColors.length],
                    player.name.charAt(0).toUpperCase());
            }
        });
    }

    /**
     * Render a single guess marker
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} color - Marker color
     * @param {string} initial - Player initial
     * @private
     */
    renderGuessMarker(ctx, x, y, color, initial) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.colors.darkBg;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.colors.darkBg;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, x, y);
        ctx.restore();
    }

    /**
     * Render hover preview
     * @private
     */
    renderHoverPreview() {
        const pos = this.coordToCanvas(this.hoverCoordinate);
        this.ctx.save();
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillStyle = this.colors.lilac;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    /**
     * Render preview of placed guess
     * @private
     */
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

    /**
     * Render all particles
     * @private
     */
    renderParticles() {
        this.particles.forEach(p => {
            if (p.alpha > 0) {
                this.ctx.globalAlpha = p.alpha;
                this.ctx.fillStyle = p.color;
                this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            }
        });
        
        this.ctx.globalAlpha = 1;
    }

    /**
     * Render particles within a specific region
     * @param {Object} region - Dirty region to render within
     * @private
     */
    renderParticlesInRegion(region) {
        this.particles.forEach(p => {
            if (p.alpha > 0 && 
                p.x + p.size/2 >= region.x && p.x - p.size/2 <= region.x + region.width &&
                p.y + p.size/2 >= region.y && p.y - p.size/2 <= region.y + region.height) {
                this.ctx.globalAlpha = p.alpha;
                this.ctx.fillStyle = p.color;
                this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            }
        });
        
        this.ctx.globalAlpha = 1;
    }

    /**
     * Update particle positions and states
     * @private
     */
    updateParticles() {
        let hasActive = false;
        
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.active) continue;
            
            this.markRegionDirty(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            p.size *= p.shrink;
            
            if (p.alpha <= 0 || p.size < 0.5) {
                p.active = false;
            } else {
                hasActive = true;
                this.markRegionDirty(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            }
        }
        
        if (!hasActive && this.particles.length) this.particles = [];
        if (hasActive) this.requestRender();
    }

    /**
     * Handle pointer enter event
     * @private
     */
    handlePointerEnter = () => {
        this.isHovering = true;
        if (this.interactionEnabled) this.gridContainer.classList.add('interactive');
        this.requestRender();
    }

    /**
     * Handle pointer leave event
     * @private
     */
    handlePointerLeave = () => {
        this.isHovering = false;
        this.hoverCoordinate = null;
        this.gridContainer.classList.remove('interactive');
        this.requestRender();
    }

    /**
     * Handle pointer move event with throttling
     * @param {PointerEvent} e - Pointer event
     * @private
     */
    handlePointerMove = (e) => {
        if (!this.interactionEnabled || !this.isHovering) return;
        
        const now = Date.now();
        if (now - this.lastInteractionTime < this.interactionThrottle) return;
        this.lastInteractionTime = now;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * this.canvasSize.width / rect.width;
        const y = (e.clientY - rect.top) * this.canvasSize.height / rect.height;
        
        this.hoverCoordinate = this.canvasToCoord(x, y);
        this.requestRender();
    }

    /**
     * Handle pointer down event
     * @param {PointerEvent} e - Pointer event
     * @private
     */
    handlePointerDown = (e) => {
        if (this.interactionEnabled && e.button === 0) this.isDragging = true;
    }

    /**
     * Handle pointer up event
     * @param {PointerEvent} e - Pointer event
     * @private
     */
    handlePointerUp = (e) => {
        if (!this.interactionEnabled || !this.isDragging || e.button !== 0) return;
        
        this.isDragging = false;
        if (this.hoverCoordinate) this.handleGuessPlacement(this.hoverCoordinate);
    }

    /**
     * Handle guess placement
     * @param {Object} coordinate - Coordinate where guess was placed
     * @private
     */
    handleGuessPlacement(coordinate) {
        const roundedCoordinate = {
            x: Math.round(coordinate.x),
            y: Math.round(coordinate.y)
        };
        
        this.previewGuess = roundedCoordinate;
        const pos = this.coordToCanvas(roundedCoordinate);
        this.createPlacementParticles(pos.x, pos.y);
        
        // IMPORTANT: Store guess locally immediately to ensure correct positioning
        // This prevents mismatch between preview and actual guess position
        const playerId = this.stateManager.state.connection.playerId;
        if (playerId) {
            this.guesses[playerId] = roundedCoordinate;
            this.requestRender();
        }
        
        this.stateManager.emit('spectrum:guess-placed', { coordinate: roundedCoordinate });
    }

    /**
     * Create particle effects for guess placement
     * @param {number} x - X position
     * @param {number} y - Y position
     * @private
     */
    createPlacementParticles(x, y) {
        const count = Math.min(8, this.maxParticles - this.particles.length);
        
        for (let i = 0; i < count; i++) {
            const particle = this.particlePool.find(p => !p.active) || this.particlePool[0];
            const angle = (Math.PI * 2 * i) / count;
            const speed = 2 + Math.random() * 2;
            
            Object.assign(particle, {
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3,
                alpha: 1,
                decay: 0.05,
                shrink: 0.95,
                color: this.colors.lilac,
                active: true
            });
            
            if (!this.particles.includes(particle)) this.particles.push(particle);
        }
        
        this.requestRender();
    }

    /**
     * Update spectrum data
     * @param {string} axis - 'spectrumX' or 'spectrumY'
     * @param {Object} spectrum - Spectrum data
     * @public
     */
    updateSpectrum(axis, spectrum) {
        this[axis] = spectrum;
        this.markDirty();
        this.requestRender();
    }

    /**
     * Update target coordinate
     * @param {Object} coordinate - Target coordinate
     * @public
     */
    updateTargetCoordinate(coordinate) {
        this.targetCoordinate = coordinate;
        this.updateTargetVisibility();
        this.requestRender();
    }

    /**
     * Update guesses from state
     * @param {Object} guesses - Object mapping player IDs to coordinates
     * @public
     */
    updateGuesses(guesses) {
        // Clear preview if our guess is confirmed
        const myPlayerId = this.stateManager.state.connection.playerId;
        if (myPlayerId && guesses?.[myPlayerId]) {
            this.previewGuess = null;
        }
        
        this.guesses = guesses || {};
        this.requestRender();
    }

    /**
     * Enable or disable interaction
     * @param {boolean} enabled - Whether interaction is enabled
     * @public
     */
    setInteractionEnabled(enabled) {
        this.interactionEnabled = enabled;
        this.gridContainer.classList.toggle('interactive', enabled);
        if (!enabled) {
            this.isHovering = false;
            this.hoverCoordinate = null;
        }
        this.requestRender();
    }

    /**
     * Set target visibility
     * @param {boolean} show - Whether to show target
     * @public
     */
    setShowTarget(show) {
        this.showTarget = show;
        this.requestRender();
    }

    /**
     * Update target visibility based on game state
     * IMPORTANT: Phase name must match exactly ('results' not 'scoring')
     * @private
     */
    updateTargetVisibility() {
        const isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        const phase = this.stateManager.getGameState().phase;
        this.showTarget = (isClueGiver && ['giving-clue', 'guessing'].includes(phase)) || phase === 'results';
        this.requestRender();
    }

    /**
     * Handle game phase changes
     * @param {string} phase - New game phase
     * @public
     */
    handlePhaseChange(phase) {
        const actions = {
            'giving-clue': () => { 
                this.guesses = {}; 
                this.previewGuess = null; 
            },
            'guessing': () => { 
                this.previewGuess = null; 
            },
            'results': () => {
                this.previewGuess = null;
            },
            'scoring': () => {
                this.previewGuess = null;
            },
            'lobby': () => this.clearRoundData(),
            'waiting': () => this.clearRoundData()
        };
        
        actions[phase]?.();
        this.markDirty();
        this.requestRender();
    }
    
    /**
     * Clear all round-specific data
     * @private
     */
    clearRoundData() {
        Object.assign(this, {
            targetCoordinate: null,
            guesses: {},
            previewGuess: null,
            showTarget: false,
            particles: []
        });
        this.requestRender();
    }

    /**
     * Clean up and destroy the renderer
     * @public
     */
    destroy() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        if (this.dprCheckInterval) clearInterval(this.dprCheckInterval);
        clearTimeout(this.resizeTimeout);
        
        window.removeEventListener('resize', this.handleResize);
        
        ['pointerenter', 'pointerleave', 'pointermove', 'pointerdown', 'pointerup'].forEach(event => 
            this.canvas?.removeEventListener(event, this[`handle${event.charAt(0).toUpperCase() + event.slice(1)}`]));
        
        this.canvas?.parentNode?.removeChild(this.canvas);
        
        Object.assign(this, {
            canvas: null,
            ctx: null,
            particles: [],
            particlePool: []
        });
        
        this.clearRoundData();
    }
}