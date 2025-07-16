/**
 * Spectrum Renderer - Interactive spectrum visualization with canvas rendering
 * Handles spectrum display, guess placement, target visualization, and animations
 * FIXED: Proper target position handling, visibility control, and round cleanup
 */

import { gameLogic } from '../game/GameLogic.js';

export class SpectrumRenderer {
    constructor(stateManager) {
        this.stateManager = stateManager;
        
        // Canvas and rendering
        this.canvas = null;
        this.ctx = null;
        this.canvasContainer = null;
        this.devicePixelRatio = window.devicePixelRatio || 1;
        
        // Spectrum state
        this.spectrum = null;
        this.targetPosition = null;
        this.guesses = {};
        this.showTarget = false;
        this.interactionEnabled = false;
        
        // Animation state
        this.animationFrame = null;
        this.animations = [];
        this.particles = [];
        
        // Interaction state
        this.isHovering = false;
        this.hoverPosition = null;
        this.isDragging = false;
        this.previewGuess = null;
        
        // Dimensions
        this.width = 0;
        this.height = 60;
        this.padding = 20;
        
        // Colors and gradients
        this.gradientCache = new Map();
        
        // Debug mode with frame counter for reduced logging
        this.debugMode = false;
        this.frameCount = 0;
        this.logFrequency = 60; // Log every 60 frames (once per second at 60fps)
        
        // Bind methods
        this.init = this.init.bind(this);
        this.render = this.render.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    /**
     * Initialize the spectrum renderer
     */
    async init() {
        console.log('🎨 Initializing SpectrumRenderer...');
        
        // Find or create canvas
        this.setupCanvas();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up state listeners
        this.setupStateListeners();
        
        // Start render loop
        this.startRenderLoop();
        
        console.log('✅ SpectrumRenderer initialized');
    }

    /**
     * Set up canvas element
     */
    setupCanvas() {
        // Find the spectrum line container
        this.canvasContainer = document.getElementById('spectrum-line');
        if (!this.canvasContainer) {
            console.error('❌ Spectrum line container not found');
            return;
        }
        
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '10';
        
        // Get 2D context
        this.ctx = this.canvas.getContext('2d');
        
        // Add canvas to container
        this.canvasContainer.appendChild(this.canvas);
        
        // Set initial size
        this.updateCanvasSize();
        
        console.log('📐 Canvas setup complete');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Resize observer for responsive canvas
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this.resizeObserver.observe(this.canvasContainer);
        } else {
            window.addEventListener('resize', this.handleResize);
        }
        
        // Mouse events
        this.canvasContainer.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
        this.canvasContainer.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        this.canvasContainer.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvasContainer.addEventListener('click', this.handleClick.bind(this));
        this.canvasContainer.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvasContainer.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Touch events for mobile
        this.canvasContainer.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvasContainer.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvasContainer.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Prevent context menu
        this.canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Set up state listeners - FIXED: Better state management
     */
    setupStateListeners() {
        // Spectrum changes
        this.stateManager.on('state:game.spectrum', (data) => {
            console.log('🌈 Spectrum updated:', data.newValue);
            this.updateSpectrum(data.newValue);
        });
        
        // Target position changes
        this.stateManager.on('state:game.targetPosition', (data) => {
            console.log('🎯 Target position state changed:', data.newValue);
            this.updateTargetPosition(data.newValue);
        });
        
        // Guess updates
        this.stateManager.on('state:game.guesses', (data) => {
            console.log('🎲 Guesses updated:', data.newValue);
            this.updateGuesses(data.newValue);
        });
        
        // UI state changes
        this.stateManager.on('state:ui.spectrumInteractionEnabled', (data) => {
            console.log('🖱️ Spectrum interaction enabled:', data.newValue);
            this.setInteractionEnabled(data.newValue);
        });
        
        this.stateManager.on('state:ui.showTargetPosition', (data) => {
            console.log('👁️ Show target position state changed:', data.newValue);
            this.setShowTarget(data.newValue);
        });
        
        // Game phase changes
        this.stateManager.on('state:game.phase', (data) => {
            console.log('🎮 Game phase changed:', data.newValue);
            this.handlePhaseChange(data.newValue);
        });
        
        // Listen for clue giver changes to update target visibility
        this.stateManager.on('state:game.clueGiverId', (data) => {
            console.log('👑 Clue giver changed:', data.newValue);
            this.updateTargetVisibility();
        });
    }

    /**
     * Update canvas size
     */
    updateCanvasSize() {
        if (!this.canvas || !this.canvasContainer) return;
        
        const rect = this.canvasContainer.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        
        // Set canvas size with device pixel ratio for crisp rendering
        this.canvas.width = this.width * this.devicePixelRatio;
        this.canvas.height = this.height * this.devicePixelRatio;
        
        // Scale context to match device pixel ratio
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
        
        // Set CSS size
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        
        console.log(`📏 Canvas resized to ${this.width}x${this.height}`);
    }

    /**
     * Handle resize
     */
    handleResize() {
        this.updateCanvasSize();
        this.clearGradientCache();
    }

    /**
     * Start render loop
     */
    startRenderLoop() {
        const renderFrame = () => {
            this.render();
            this.animationFrame = requestAnimationFrame(renderFrame);
        };
        renderFrame();
    }

    /**
     * Main render method - FIXED: Reduced debug logging
     */
    render() {
        if (!this.ctx || !this.spectrum) return;
        
        // Increment frame counter
        this.frameCount++;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Update animations
        this.updateAnimations();
        
        // Render spectrum gradient
        this.renderSpectrumGradient();
        
        // Only check clue giver status once per second instead of every frame
        if (this.frameCount % 60 === 0) {
            this._isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        }
        
        // Render debug info if enabled
        if (this.debugMode && this.frameCount % this.logFrequency === 0) {
            this.renderDebugInfo();
        }
        
        // Render particles
        this.renderParticles();
        
        // Render target (if visible) - use cached value
        if (this.shouldRenderTarget()) {
            this.renderTarget();
        }
        
        // Render guesses
        this.renderGuesses();
        
        // Render hover preview
        if (this.isHovering && this.interactionEnabled && this.hoverPosition !== null) {
            this.renderHoverPreview();
        }
        
        // Render preview guess
        if (this.previewGuess !== null) {
            this.renderPreviewGuess();
        }
    }

    shouldRenderTarget() {
        // Use cached clue giver check
        const hasValidPosition = this.targetPosition !== null && this.targetPosition !== undefined;
        const shouldShow = this.showTarget === true;
        const isClueGiver = this._isClueGiver !== undefined ? this._isClueGiver : this.stateManager.isCurrentPlayerClueGiver();
        
        return hasValidPosition && shouldShow && isClueGiver;
    }

    /**
     * Update target visibility based on current player role - NEW METHOD
     */
    updateTargetVisibility() {
        const isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        const gamePhase = this.stateManager.getGameState().phase;
        
        // Only show target to clue giver during appropriate phases
        if (isClueGiver && (gamePhase === 'giving-clue' || gamePhase === 'guessing')) {
            this.showTarget = true;
        } else if (gamePhase === 'scoring') {
            // Everyone sees target during scoring
            this.showTarget = true;
        } else {
            this.showTarget = false;
        }
        
        console.log(`👁️ Updated target visibility - IsClueGiver: ${isClueGiver}, Phase: ${gamePhase}, ShowTarget: ${this.showTarget}`);
    }

    /**
     * Render debug information
     */
    renderDebugInfo() {
        // Only render debug info if explicitly in development mode
        if (!this.debugMode || window.location.hostname === 'localhost') {
            return;
        }
        
        this.ctx.save();
        this.ctx.font = '10px monospace';
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';  // More transparent
        
        const isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        const debugText = `Target: ${this.targetPosition} | Show: ${this.showTarget} | ClueGiver: ${isClueGiver} | Enabled: ${this.interactionEnabled}`;
        
        // Render in top-left corner instead of on the spectrum
        this.ctx.fillText(debugText, 5, 10);
        this.ctx.restore();
    }

    /**
     * Render spectrum gradient
     */
    renderSpectrumGradient() {
        if (!this.spectrum || !this.spectrum.gradient) return;
        
        const gradient = this.getOrCreateGradient();
        
        // Draw gradient background
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Add subtle border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(0.5, 0.5, this.width - 1, this.height - 1);
    }

    /**
     * Get or create gradient
     */
    getOrCreateGradient() {
        const cacheKey = `${this.spectrum.id}-${this.width}`;
        
        if (this.gradientCache.has(cacheKey)) {
            return this.gradientCache.get(cacheKey);
        }
        
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
        const { start, middle, end } = this.spectrum.gradient;
        
        gradient.addColorStop(0, start);
        if (middle) {
            gradient.addColorStop(0.5, middle);
        }
        gradient.addColorStop(1, end);
        
        this.gradientCache.set(cacheKey, gradient);
        return gradient;
    }

    /**
     * Clear gradient cache
     */
    clearGradientCache() {
        this.gradientCache.clear();
    }

    /**
     * Render target marker - FIXED: Only logs periodically
     */
    renderTarget() {
        const x = this.positionToPixel(this.targetPosition);
        const y = this.height / 2;
        
        // Only log periodically
        if (this.debugMode && this.frameCount % this.logFrequency === 0) {
            console.log(`🎯 Rendering target at position ${this.targetPosition} (${x}px)`);
        }
        
        // Target circle with pulsing effect
        this.ctx.save();
        
        // Pulsing scale
        const pulse = Math.sin(Date.now() * 0.003) * 0.1 + 1;
        
        // Glow effect
        this.ctx.shadowColor = '#ff0000';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        
        // Outer circle (pulsing)
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 12 * pulse, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Inner circle
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Center dot
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
        
        // Target icon above
        this.renderTargetIcon(x, y - 25);
        
        // Position label
        this.ctx.save();
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#ef4444';
        this.ctx.fillText(`${this.targetPosition}`, x, y + 25);
        this.ctx.restore();
    }

    /**
     * Render target icon
     */
    renderTargetIcon(x, y) {
        this.ctx.save();
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Shadow for better visibility
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        // Icon
        this.ctx.fillStyle = '#ef4444';
        
        this.ctx.restore();
    }

    /**
     * Render guess markers
     */
    renderGuesses() {
        const players = this.stateManager.getPlayers();
        const playerColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
        
        Object.entries(this.guesses).forEach(([playerId, position], index) => {
            const player = players[playerId];
            if (!player) return;
            
            const x = this.positionToPixel(position);
            const y = this.height / 2;
            const color = playerColors[index % playerColors.length];
            
            this.renderGuessMarker(x, y, color, player.name.charAt(0).toUpperCase());
        });
    }

    /**
     * Render individual guess marker
     */
    renderGuessMarker(x, y, color, initial) {
        this.ctx.save();
        
        // Glow effect
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        
        // Outer circle
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Border
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Initial letter
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(initial, x, y);
        
        this.ctx.restore();
    }

    /**
     * Render hover preview
     */
    renderHoverPreview() {
        const x = this.positionToPixel(this.hoverPosition);
        const y = this.height / 2;
        
        this.ctx.save();
        
        // Semi-transparent preview
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillStyle = '#8b5cf6';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Dashed border
        this.ctx.globalAlpha = 1;
        this.ctx.strokeStyle = '#8b5cf6';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([3, 3]);
        this.ctx.beginPath();
        this.ctx.arc(x, y, 12, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.restore();
        
        // Position indicator
        this.renderPositionIndicator(x, y - 20, this.hoverPosition);
    }

    /**
     * Render preview guess
     */
    renderPreviewGuess() {
        const x = this.positionToPixel(this.previewGuess);
        const y = this.height / 2;
        
        this.ctx.save();
        
        // Pulsing effect
        const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 0.8;
        this.ctx.globalAlpha = pulse;
        
        // Preview marker
        this.ctx.fillStyle = '#8b5cf6';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    /**
     * Render position indicator
     */
    renderPositionIndicator(x, y, position) {
        this.ctx.save();
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(x - 15, y - 10, 30, 20);
        
        // Text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(Math.round(position), x, y);
        
        this.ctx.restore();
    }

    /**
     * Render particles
     */
    renderParticles() {
        this.particles.forEach(particle => {
            this.ctx.save();
            
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }

    /**
     * Update animations
     */
    updateAnimations() {
        const now = Date.now();
        
        // Update particles
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.alpha -= particle.decay;
            particle.size *= particle.shrink;
            
            return particle.alpha > 0 && particle.size > 0.1;
        });
        
        // Update other animations
        this.animations = this.animations.filter(animation => {
            const progress = (now - animation.startTime) / animation.duration;
            
            if (progress >= 1) {
                animation.onComplete?.();
                return false;
            }
            
            animation.onUpdate?.(progress);
            return true;
        });
    }

    /**
     * Mouse event handlers
     */
    handleMouseEnter() {
        this.isHovering = true;
        if (this.interactionEnabled) {
            this.canvasContainer.style.cursor = 'crosshair';
        }
    }

    handleMouseLeave() {
        this.isHovering = false;
        this.hoverPosition = null;
        this.canvasContainer.style.cursor = 'default';
    }

    handleMouseMove(e) {
        if (!this.interactionEnabled) return;
        
        const rect = this.canvasContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        this.hoverPosition = this.pixelToPosition(x);
    }

    handleClick(e) {
        if (!this.interactionEnabled) return;
        
        const rect = this.canvasContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const position = this.pixelToPosition(x);
        
        this.handleGuessPlacement(position);
    }

    handleMouseDown(e) {
        if (!this.interactionEnabled) return;
        this.isDragging = true;
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    /**
     * Touch event handlers
     */
    handleTouchStart(e) {
        e.preventDefault();
        if (!this.interactionEnabled) return;
        
        const touch = e.touches[0];
        const rect = this.canvasContainer.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        this.hoverPosition = this.pixelToPosition(x);
        this.isHovering = true;
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (!this.interactionEnabled) return;
        
        const touch = e.touches[0];
        const rect = this.canvasContainer.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        this.hoverPosition = this.pixelToPosition(x);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        if (!this.interactionEnabled || this.hoverPosition === null) return;
        
        this.handleGuessPlacement(this.hoverPosition);
        this.isHovering = false;
        this.hoverPosition = null;
    }

    /**
     * Handle guess placement
     */
    handleGuessPlacement(position) {
        // Clamp position
        position = Math.max(0, Math.min(100, Math.round(position)));
        
        console.log(`🎲 Guess placed at position ${position}`);
        
        // Set preview guess
        this.previewGuess = position;
        
        // Create placement particles
        this.createPlacementParticles(this.positionToPixel(position));
        
        // Emit guess event
        this.stateManager.emit('spectrum:guess-placed', { position });
        
        // Update slider if it exists
        const slider = document.getElementById('guess-slider');
        const valueDisplay = document.getElementById('guess-value');
        if (slider) {
            slider.value = position;
        }
        if (valueDisplay) {
            valueDisplay.textContent = position;
        }
    }

    /**
     * Create placement particles
     */
    createPlacementParticles(x) {
        const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];
        
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = 2 + Math.random() * 3;
            
            this.particles.push({
                x: x,
                y: this.height / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 3,
                alpha: 1,
                decay: 0.02,
                shrink: 0.98,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
    }

    /**
     * Create celebration particles
     */
    createCelebrationParticles(x, color = '#10b981') {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5;
            
            this.particles.push({
                x: x,
                y: this.height / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 3 + Math.random() * 4,
                alpha: 1,
                decay: 0.015,
                shrink: 0.97,
                color: color
            });
        }
    }

    /**
     * Position conversion utilities
     */
    positionToPixel(position) {
        return (position / 100) * this.width;
    }

    pixelToPosition(pixel) {
        return (pixel / this.width) * 100;
    }

    /**
     * State update methods
     */
    updateSpectrum(spectrum) {
        this.spectrum = spectrum;
        this.clearGradientCache();
        console.log('🌈 Spectrum updated in renderer:', spectrum);
    }

    /**
     * Update target position - FIXED: Better handling
     */
    updateTargetPosition(position) {
        const oldPosition = this.targetPosition;
        this.targetPosition = position;
        
        console.log(`🎯 Target position updated from ${oldPosition} to ${position}`);
        
        // Update visibility based on role
        this.updateTargetVisibility();
        
        // Animate target reveal if appropriate
        if (this.showTarget && position !== null && position !== undefined && oldPosition !== position) {
            console.log('✨ Animating target reveal');
            this.animateTargetReveal();
        }
    }

    updateGuesses(guesses) {
        const oldGuesses = { ...this.guesses };
        this.guesses = guesses || {};
        
        // Check for new guesses and animate them
        Object.entries(this.guesses).forEach(([playerId, position]) => {
            if (!(playerId in oldGuesses)) {
                console.log(`🎲 New guess from player ${playerId} at position ${position}`);
                this.animateGuessPlacement(position);
            }
        });
    }

    setInteractionEnabled(enabled) {
        this.interactionEnabled = enabled;
        console.log(`🖱️ Interaction ${enabled ? 'enabled' : 'disabled'}`);
        
        if (enabled) {
            this.canvasContainer.style.pointerEvents = 'auto';
            this.canvasContainer.style.cursor = 'crosshair';
        } else {
            this.canvasContainer.style.pointerEvents = 'none';
            this.canvasContainer.style.cursor = 'default';
            this.isHovering = false;
            this.hoverPosition = null;
        }
    }

    /**
     * Set show target - FIXED: Better state management
     */
    setShowTarget(show) {
        const oldShowTarget = this.showTarget;
        this.showTarget = show;
        
        console.log(`👁️ Target visibility changed from ${oldShowTarget} to ${show}`);
        
        // Only animate if we're showing a valid target for the first time
        if (show && !oldShowTarget && this.targetPosition !== null && this.targetPosition !== undefined) {
            console.log(`✨ Showing target at position ${this.targetPosition}`);
            this.animateTargetReveal();
        }
    }

    /**
     * Handle phase change - FIXED: Clear state between rounds
     */
    handlePhaseChange(phase) {
        console.log(`🎮 Handling phase change to: ${phase}`);
        
        switch (phase) {
            case 'giving-clue':
                // Clear previous round data
                this.guesses = {};
                this.previewGuess = null;
                // Target visibility will be handled by state updates
                break;
                
            case 'guessing':
                this.previewGuess = null;
                break;
                
            case 'scoring':
                this.animateScoreReveal();
                break;
                
            case 'lobby':
            case 'waiting':
                // Clear all round data
                this.clearRoundData();
                break;
        }
    }

    /**
     * Clear round data - NEW METHOD
     */
    clearRoundData() {
        console.log('🧹 Clearing round data');
        this.targetPosition = null;
        this.guesses = {};
        this.previewGuess = null;
        this.showTarget = false;
        this.particles = [];
    }

    /**
     * Animation methods
     */
    animateTargetReveal() {
        if (this.targetPosition === null || this.targetPosition === undefined) return;
        
        const x = this.positionToPixel(this.targetPosition);
        this.createCelebrationParticles(x, '#ef4444');
    }

    animateGuessPlacement(position) {
        const x = this.positionToPixel(position);
        this.createPlacementParticles(x);
    }

    animateScoreReveal() {
        // Create celebration particles for all guesses
        Object.values(this.guesses).forEach(position => {
            const x = this.positionToPixel(position);
            this.createCelebrationParticles(x);
        });
        
        // Create extra celebration for target
        if (this.targetPosition !== null && this.targetPosition !== undefined) {
            const x = this.positionToPixel(this.targetPosition);
            setTimeout(() => {
                this.createCelebrationParticles(x, '#ffd700');
            }, 500);
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Stop render loop
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Remove resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        } else {
            window.removeEventListener('resize', this.handleResize);
        }
        
        // Remove canvas
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        // Clear state
        this.canvas = null;
        this.ctx = null;
        this.animations = [];
        this.particles = [];
        this.gradientCache.clear();
        this.clearRoundData();
        
        console.log('🧹 SpectrumRenderer destroyed');
    }
}