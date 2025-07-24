/**
 * Spectrum Renderer - Interactive 2D spectrum grid visualization
 * ENHANCED: High-performance particle system with advanced visual effects
 * UPDATED: Responsive rendering support for all screen sizes
 * 
 * @class SpectrumRenderer
 * @description Handles the rendering of the 2D spectrum grid, player guesses, target positions,
 * and interactive elements. Features an optimized particle system with dynamic effects.
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
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
            spectrumX: null,
            spectrumY: null,
            targetCoordinate: null,
            guesses: {},
            showTarget: false,
            interactionEnabled: false,
            animationFrame: null,
            
            // Enhanced particle system
            particles: [],
            particleColors: ['#00d4ff', '#b794f4', '#0096ff', '#ff006e', '#00f593', '#ff9500'],
            
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
            renderThrottleTime: 16, // 60fps
            lastRenderTime: 0,
            renderRequested: false,
            lastInteractionTime: 0,
            interactionThrottle: 50,
            centerExclusionRadius: 20,
            
            // Responsive rendering settings
            isMobile: false,
            isTablet: false,
            responsiveScale: 1,
            // Remove these constraints
            // minCanvasSize: 200,
            // maxCanvasSize: 700,
            
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
                gridLineMajor: 'rgba(255, 255, 255, 0.2)',
                exclusionZone: 'rgba(0, 0, 0, 0.3)',
                exclusionBorder: 'rgba(255, 255, 255, 0.15)'
            }
        });
    }

    /**
     * Initialize the spectrum renderer
     * @async
     * @returns {Promise<void>}
     */
    async init() {
        this.detectDeviceType();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupStateListeners();
        this.startRenderLoop();
        this.markDirty();
        this.requestRender();
    }

    /**
     * Detect device type for responsive adjustments
     * @private
     */
    detectDeviceType() {
        const width = window.innerWidth;
        this.isMobile = width <= 768;
        this.isTablet = width > 768 && width <= 1200;
        
        // Adjust settings based on device
        if (this.isMobile) {
            this.interactionThrottle = 100; // Slower interaction updates on mobile
            this.centerExclusionRadius = 15; // Smaller exclusion zone
            this.responsiveScale = 0.8; // Scale down UI elements
        } else if (this.isTablet) {
            this.interactionThrottle = 75;
            this.centerExclusionRadius = 18;
            this.responsiveScale = 0.9;
        } else {
            this.responsiveScale = 1;
        }
    }

    /**
     * Set up the main canvas element and context
     * @private
     */
    setupCanvas() {
        this.gridContainer = document.getElementById('spectrum-grid');
        if (!this.gridContainer) return;
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'spectrum-canvas';
        this.ctx = this.canvas.getContext('2d', { 
            alpha: false,
            desynchronized: true,
            willReadFrequently: false
        });
        
        // Set canvas styles
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.touchAction = 'none';
        
        this.gridContainer.appendChild(this.canvas);
        this.updateCanvasSize();
    }

    /**
     * Set up event listeners for canvas interaction and window events
     * @private
     */
    setupEventListeners() {
        this.resizeObserver = new ResizeObserver(() => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.handleResize(), 250);
        });
        this.resizeObserver.observe(this.gridContainer);
        
        let lastDPR = window.devicePixelRatio;
        const checkDPR = () => {
            if (window.devicePixelRatio !== lastDPR) {
                lastDPR = window.devicePixelRatio;
                this.handleResize();
            }
        };
        this.dprCheckInterval = setInterval(checkDPR, 500);
        
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleOrientationChange);
        
        // Use pointer events for better touch support
        const events = {
            pointerenter: this.handlePointerEnter,
            pointerleave: this.handlePointerLeave,
            pointermove: this.handlePointerMove,
            pointerdown: this.handlePointerDown,
            pointerup: this.handlePointerUp,
            pointercancel: this.handlePointerCancel // Handle touch cancellation
        };
        
        Object.entries(events).forEach(([event, handler]) => 
            this.canvas.addEventListener(event, handler.bind(this), { passive: true }));
    }

    /**
     * Handle orientation change events
     * @private
     */
    handleOrientationChange = () => {
        setTimeout(() => {
            this.detectDeviceType();
            this.handleResize();
        }, 100); // Delay to allow orientation change to complete
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
     * Update canvas size and handle DPR changes with responsive constraints
     * @private
     */
    updateCanvasSize() {
        if (!this.canvas || !this.gridContainer) return;
        
        const rect = this.gridContainer.getBoundingClientRect();
        const {width, height} = rect;
        
        if (width <= 0 || height <= 0) {
            requestAnimationFrame(() => this.updateCanvasSize());
            return;
        }
        
        // Use the actual container dimensions exactly
        const canvasWidth = Math.floor(width);
        const canvasHeight = Math.floor(height);
        
        const currentDPR = Math.min(window.devicePixelRatio || 1, this.isMobile ? 2 : 3);
        
        if (this.canvasSize.width === canvasWidth && 
            this.canvasSize.height === canvasHeight && 
            this.devicePixelRatio === currentDPR) return;
        
        this.containerRect = rect;
        this.canvasSize = {width: canvasWidth, height: canvasHeight};
        this.devicePixelRatio = currentDPR;
        
        // Update main canvas
        this.canvas.width = canvasWidth * this.devicePixelRatio;
        this.canvas.height = canvasHeight * this.devicePixelRatio;
        
        // Force canvas to fill container
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
        
        // Update font sizes based on canvas size
        this.updateResponsiveSizes();
        
        this.markDirty();
        this.render();
    }

    /**
     * Update responsive sizes based on canvas dimensions
     * @private
     */
    updateResponsiveSizes() {
        const baseSize = Math.min(this.canvasSize.width, this.canvasSize.height);
        
        // Scale UI elements based on canvas size
        this.responsiveFontSize = Math.max(10, Math.floor(baseSize / 50));
        this.responsiveMarkerSize = Math.max(8, Math.floor(baseSize / 60));
        this.responsiveLineWidth = Math.max(1, baseSize / 400);
    }

    /**
     * Handle window resize events
     * @private
     */
    handleResize = () => {
        this.detectDeviceType();
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
            } else {
                // Always update particles if any exist
                if (this.particles.length > 0) {
                    this.updateParticles();
                    this.requestRender();
                }
                
                // Adjust render throttle for mobile
                const throttleTime = this.isMobile ? 33 : this.renderThrottleTime; // 30fps on mobile
                
                if (this.renderRequested && timestamp - this.lastRenderTime >= throttleTime) {
                    if (!this.dirtyRegions.length) this.checkStateChanges();
                    if (this.dirtyRegions.length || this.particles.length > 0) this.render();
                    this.lastRenderTime = timestamp;
                    this.renderRequested = false;
                }
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
        
        if (this.shouldRenderTarget() && this.targetCoordinate) {
            markCoords([this.targetCoordinate], 20);
        }
        
        if (JSON.stringify(Object.keys(state.guesses)) !== JSON.stringify(Object.keys(this.lastRenderState.guesses))) {
            markCoords(Object.values(this.lastRenderState.guesses));
            markCoords(Object.values(state.guesses));
        }
        
        ['targetCoordinate', 'hoverCoordinate', 'previewGuess'].forEach(key => {
            if (JSON.stringify(state[key]) !== JSON.stringify(this.lastRenderState[key])) {
                markCoords([state[key], this.lastRenderState[key]], key === 'targetCoordinate' ? 20 : 15);
            }
        });
        
        this.lastRenderState = JSON.parse(JSON.stringify(state));
    }

    /**
     * Main render method with responsive adjustments
     * @private
     */
    render() {
        if (!this.ctx || !this.canvasSize.width || !this.canvasSize.height) return;
        
        const {width, height} = this.canvasSize;
        
        // Always do full redraw for simplicity with particle system
        this.ctx.fillStyle = this.colors.darkBg;
        this.ctx.fillRect(0, 0, width, height);
        
        this.render2DGradient();
        this.renderGridLines();
        this.renderCenterExclusionZone();
        
        if (this.shouldRenderTarget()) this.renderTarget();
        this.renderGuesses();
        if (this.isHovering && this.interactionEnabled && this.hoverCoordinate) this.renderHoverPreview();
        if (this.previewGuess) this.renderPreviewGuess();
        
        // Render particles on top
        if (this.particles.length > 0) {
            this.renderParticles();
        }
        
        this.dirtyRegions = [];
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
     * Render grid lines with responsive line width
     * @private
     */
    renderGridLines() {
        const {width, height} = this.canvasSize;
        this.ctx.save();
        
        // Adjust line width for device
        this.ctx.lineWidth = this.responsiveLineWidth;
        
        // Don't render minor grid lines on mobile
        if (!this.isMobile) {
            this.ctx.strokeStyle = this.colors.gridLine;
            this.ctx.beginPath();
            
            // Minor grid lines
            const gridSpacing = Math.floor(width / 10);
            for (let i = 1; i < 10; i++) {
                if (i !== 5) { // Skip center lines
                    this.ctx.moveTo(i * gridSpacing, 0);
                    this.ctx.lineTo(i * gridSpacing, height);
                    this.ctx.moveTo(0, i * gridSpacing);
                    this.ctx.lineTo(width, i * gridSpacing);
                }
            }
            this.ctx.stroke();
        }
        
        // Major grid lines
        this.ctx.strokeStyle = this.colors.gridLineMajor;
        this.ctx.lineWidth = this.responsiveLineWidth * 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(width / 2, 0);
        this.ctx.lineTo(width / 2, height);
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
        
        // Border
        this.ctx.strokeRect(0, 0, width, height);
        this.ctx.restore();
    }

    /**
     * Render the center exclusion zone with responsive sizing
     * @private
     */
    renderCenterExclusionZone() {
        const {width, height} = this.canvasSize;
        const centerX = width / 2;
        const centerY = height / 2;
        const radiusInPixels = (this.centerExclusionRadius / 100) * Math.min(width, height);
        
        this.ctx.save();
        
        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radiusInPixels);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radiusInPixels, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = this.colors.exclusionBorder;
        this.ctx.lineWidth = this.responsiveLineWidth * 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radiusInPixels, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Don't show text on mobile
        if (!this.isMobile) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([]);
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radiusInPixels - 3, 0, Math.PI * 2);
            this.ctx.stroke();
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.font = `${this.responsiveFontSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('NO TARGET ZONE', centerX, centerY);
        }
        
        this.ctx.restore();
    }

    /**
     * Check if a coordinate is within the center exclusion zone
     * @private
     */
    isInExclusionZone(coord) {
        const centerX = 50;
        const centerY = 50;
        const distance = Math.sqrt(Math.pow(coord.x - centerX, 2) + Math.pow(coord.y - centerY, 2));
        return distance <= this.centerExclusionRadius;
    }
    /**
     * Convert game coordinates to canvas pixels
     * @private
     */
    coordToCanvas(coord) {
        return {
            x: (coord.x / 100) * this.canvasSize.width,
            y: this.canvasSize.height - (coord.y / 100) * this.canvasSize.height
        };
    }

    /**
     * Convert canvas pixels to game coordinates
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
     * @private
     */
    renderGuesses() {
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
            this.renderGuessMarker(this.ctx, pos.x, pos.y,
                playerColors[index % playerColors.length], 
                player.name.charAt(0).toUpperCase());
        });
    }

    /**
     * Render a single guess marker with responsive sizing
     * @private
     */
    renderGuessMarker(ctx, x, y, color, initial) {
        const markerSize = this.responsiveMarkerSize;
        
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, markerSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.colors.darkBg;
        ctx.lineWidth = this.responsiveLineWidth * 2;
        ctx.stroke();
        ctx.fillStyle = this.colors.darkBg;
        ctx.font = `bold ${Math.floor(markerSize * 0.8)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, x, y);
        ctx.restore();
    }

    /**
     * Render hover preview with responsive sizing
     * @private
     */
    renderHoverPreview() {
        const pos = this.coordToCanvas(this.hoverCoordinate);
        const inExclusionZone = this.isInExclusionZone(this.hoverCoordinate);
        const previewSize = this.responsiveMarkerSize * 0.8;
        
        this.ctx.save();
        this.ctx.globalAlpha = inExclusionZone ? 0.3 : 0.6;
        this.ctx.fillStyle = inExclusionZone ? this.colors.red : this.colors.lilac;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, previewSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        if (inExclusionZone) {
            this.ctx.strokeStyle = this.colors.red;
            this.ctx.lineWidth = this.responsiveLineWidth * 2;
            this.ctx.setLineDash([3, 3]);
            this.ctx.stroke();
        }
        
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
     * Simplified particle rendering
     * @private
     */
    renderParticles() {
        this.ctx.save();
        
        // Use additive blending for glow effect
        this.ctx.globalCompositeOperation = 'screen';
        
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            
            if (p.life <= 0) continue;
            
            // Calculate alpha based on life
            let alpha = 1;
            if (p.life < 10) {
                alpha = p.life / 10;
            } else if (p.life > 40) {
                alpha = (50 - p.life) / 10;
            }
            
            // Draw glow first with lower alpha
            this.ctx.globalAlpha = alpha * 0.3;
            const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
            gradient.addColorStop(0, p.color);
            gradient.addColorStop(0.3, p.color);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw bright core
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw inner bright spot
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.shadowBlur = 0;
            this.ctx.beginPath();
            this.ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }

    /**
     * Update particle physics
     * @private
     */
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Update position
            p.x += p.vx;
            p.y += p.vy;
            
            // Apply gravity and friction
            p.vy += 0.15; // Reduced gravity
            p.vx *= 0.97; // Less friction
            p.vy *= 0.97;
            
            // Update life
            p.life--;
            
            // Update size for sparkle effect
            if (p.type === 'sparkle') {
                p.size = p.baseSize * (0.5 + Math.sin(p.life * 0.2) * 0.5);
            }
            
            // Remove dead particles or ones that are way off screen
            if (p.life <= 0 || 
                p.y > this.canvasSize.height + 100 ||
                p.x < -100 || 
                p.x > this.canvasSize.width + 100) {
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * Create particle burst at position with responsive particle count
     * @private
     */
    createPlacementParticles(x, y) {
        console.log(`Creating particles at (${x}, ${y})`); // Debug log
        
        // Reduce particles on mobile for performance
        const particleCount = this.isMobile ? 8 : 15;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.3;
            const speed = (3 + Math.random() * 4) * this.responsiveScale;
            const size = (3 + Math.random() * 3) * this.responsiveScale;
            
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4,
                size,
                baseSize: size,
                life: this.isMobile ? 15 : 20, // Shorter life on mobile
                color: this.particleColors[Math.floor(Math.random() * this.particleColors.length)],
                type: Math.random() < 0.3 ? 'sparkle' : 'normal'
            });
        }
        
        // Fewer sparkles on mobile
        const sparkleCount = this.isMobile ? 3 : 8;
        for (let i = 0; i < sparkleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (5 + Math.random() * 3) * this.responsiveScale;
            
            this.particles.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 3,
                size: 2 * this.responsiveScale,
                baseSize: 2 * this.responsiveScale,
                life: this.isMobile ? 10 : 15,
                color: '#ffffff',
                type: 'sparkle'
            });
        }
        
        console.log('Total particles:', this.particles.length); // Debug log
        this.markDirty();
        this.requestRender();
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
     * @private
     */
    handlePointerDown = (e) => {
        if (this.interactionEnabled && e.button === 0) this.isDragging = true;
    }

    /**
     * Handle pointer up event
     * @private
     */
    handlePointerUp = (e) => {
        if (!this.interactionEnabled || !this.isDragging || e.button !== 0) return;
        
        this.isDragging = false;
        if (this.hoverCoordinate) {
            if (this.isInExclusionZone(this.hoverCoordinate)) {
                this.stateManager.addNotification({
                    type: 'warning',
                    message: 'Cannot place guess in the center exclusion zone!',
                    duration: 3000
                });
                return;
            }
            this.handleGuessPlacement(this.hoverCoordinate);
        }
    }

    /**
     * Handle pointer cancel event (for touch)
     * @private
     */
    handlePointerCancel = () => {
        this.isDragging = false;
        this.isHovering = false;
        this.hoverCoordinate = null;
        this.gridContainer.classList.remove('interactive');
        this.requestRender();
    }

    /**
     * Handle guess placement
     * @private
     */
    handleGuessPlacement(coordinate) {
        console.log('handleGuessPlacement called with coordinate:', coordinate); // Debug
        
        const roundedCoordinate = {
            x: Math.round(coordinate.x),
            y: Math.round(coordinate.y)
        };
        
        this.previewGuess = roundedCoordinate;
        const pos = this.coordToCanvas(roundedCoordinate);
        
        console.log('Canvas position for particles:', pos); // Debug
        
        // Create particles at the click position
        this.createPlacementParticles(pos.x, pos.y);
        
        const playerId = this.stateManager.state.connection.playerId;
        if (playerId) {
            this.guesses[playerId] = roundedCoordinate;
            this.requestRender();
        }
        
        this.stateManager.emit('spectrum:guess-placed', { coordinate: roundedCoordinate });
    }

    /**
     * Update spectrum data
     * @public
     */
    updateSpectrum(axis, spectrum) {
        this[axis] = spectrum;
        this.markDirty();
        this.requestRender();
    }

    /**
     * Update target coordinate
     * @public
     */
    updateTargetCoordinate(coordinate) {
        this.targetCoordinate = coordinate;
        this.updateTargetVisibility();
        this.requestRender();
    }

    /**
     * Update guesses from state
     * @public
     */
    updateGuesses(guesses) {
        const myPlayerId = this.stateManager.state.connection.playerId;
        if (myPlayerId && guesses?.[myPlayerId]) {
            this.previewGuess = null;
        }
        
        this.guesses = guesses || {};
        this.requestRender();
    }

    /**
     * Enable or disable interaction
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
     * @public
     */
    setShowTarget(show) {
        this.showTarget = show;
        this.requestRender();
    }

    /**
     * Update target visibility based on game state
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
     * @public
     */
    handlePhaseChange(phase) {
        const actions = {
            'giving-clue': () => { 
                this.guesses = {}; 
                this.previewGuess = null; 
                this.particles = [];
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
        window.removeEventListener('orientationchange', this.handleOrientationChange);
        
        ['pointerenter', 'pointerleave', 'pointermove', 'pointerdown', 'pointerup', 'pointercancel'].forEach(event => 
            this.canvas?.removeEventListener(event, this[`handle${event.charAt(0).toUpperCase() + event.slice(1)}`]));
        
        this.canvas?.parentNode?.removeChild(this.canvas);
        
        Object.assign(this, {
            canvas: null,
            ctx: null,
            particles: []
        });
        
        this.clearRoundData();
    }
}