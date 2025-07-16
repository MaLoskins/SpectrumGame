/**
 * Spectrum Renderer - Interactive spectrum visualization with canvas rendering
 * Handles spectrum display, guess placement, target visualization, and animations
 * FIXED: Proper target position handling, visibility control, and round cleanup
 */

import { gameLogic } from '../game/GameLogic.js';

export class SpectrumRenderer {
    constructor(stateManager) {
        Object.assign(this, {
            stateManager,
            canvas: null,
            ctx: null,
            canvasContainer: null,
            devicePixelRatio: window.devicePixelRatio || 1,
            spectrum: null,
            targetPosition: null,
            guesses: {},
            showTarget: false,
            interactionEnabled: false,
            animationFrame: null,
            animations: [],
            particles: [],
            isHovering: false,
            hoverPosition: null,
            isDragging: false,
            previewGuess: null,
            width: 0,
            height: 60,
            padding: 20,
            gradientCache: new Map(),
            debugMode: false,
            frameCount: 0,
            logFrequency: 60,
            _isClueGiver: undefined
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
        this.canvasContainer = document.getElementById('spectrum-line');
        if (!this.canvasContainer) {
            console.error('❌ Spectrum line container not found');
            return;
        }
        
        this.canvas = document.createElement('canvas');
        Object.assign(this.canvas.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '10'
        });
        
        this.ctx = this.canvas.getContext('2d');
        this.canvasContainer.appendChild(this.canvas);
        this.updateCanvasSize();
        console.log('📐 Canvas setup complete');
    }

    setupEventListeners() {
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => this.handleResize());
            this.resizeObserver.observe(this.canvasContainer);
        } else {
            window.addEventListener('resize', this.handleResize);
        }
        
        const events = [
            ['mouseenter', this.handleMouseEnter],
            ['mouseleave', this.handleMouseLeave],
            ['mousemove', this.handleMouseMove],
            ['click', this.handleClick],
            ['mousedown', this.handleMouseDown],
            ['mouseup', this.handleMouseUp],
            ['touchstart', this.handleTouchStart],
            ['touchmove', this.handleTouchMove],
            ['touchend', this.handleTouchEnd],
            ['contextmenu', e => e.preventDefault()]
        ];
        
        events.forEach(([event, handler]) => 
            this.canvasContainer.addEventListener(event, handler.bind(this)));
    }

    setupStateListeners() {
        const listeners = {
            'game.spectrum': data => { console.log('🌈 Spectrum updated:', data.newValue); this.updateSpectrum(data.newValue); },
            'game.targetPosition': data => { console.log('🎯 Target position state changed:', data.newValue); this.updateTargetPosition(data.newValue); },
            'game.guesses': data => { console.log('🎲 Guesses updated:', data.newValue); this.updateGuesses(data.newValue); },
            'ui.spectrumInteractionEnabled': data => { console.log('🖱️ Spectrum interaction enabled:', data.newValue); this.setInteractionEnabled(data.newValue); },
            'ui.showTargetPosition': data => { console.log('👁️ Show target position state changed:', data.newValue); this.setShowTarget(data.newValue); },
            'game.phase': data => { console.log('🎮 Game phase changed:', data.newValue); this.handlePhaseChange(data.newValue); },
            'game.clueGiverId': data => { console.log('👑 Clue giver changed:', data.newValue); this.updateTargetVisibility(); }
        };
        
        Object.entries(listeners).forEach(([state, handler]) => 
            this.stateManager.on(`state:${state}`, handler));
    }

    updateCanvasSize() {
        if (!this.canvas || !this.canvasContainer) return;
        
        const rect = this.canvasContainer.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        
        this.canvas.width = this.width * this.devicePixelRatio;
        this.canvas.height = this.height * this.devicePixelRatio;
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
        
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        
        console.log(`📏 Canvas resized to ${this.width}x${this.height}`);
    }

    handleResize = () => {
        this.updateCanvasSize();
        this.clearGradientCache();
    }

    startRenderLoop() {
        const renderFrame = () => {
            this.render();
            this.animationFrame = requestAnimationFrame(renderFrame);
        };
        renderFrame();
    }

    render() {
        if (!this.ctx || !this.spectrum) return;
        
        this.frameCount++;
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.updateAnimations();
        this.renderSpectrumGradient();
        
        if (this.frameCount % 60 === 0) this._isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        if (this.debugMode && this.frameCount % this.logFrequency === 0) this.renderDebugInfo();
        
        this.renderParticles();
        if (this.shouldRenderTarget()) this.renderTarget();
        this.renderGuesses();
        
        if (this.isHovering && this.interactionEnabled && this.hoverPosition !== null) {
            this.renderHoverPreview();
        }
        
        if (this.previewGuess !== null) this.renderPreviewGuess();
    }

    shouldRenderTarget() {
        const hasValidPosition = this.targetPosition !== null && this.targetPosition !== undefined;
        const shouldShow = this.showTarget === true;
        const isClueGiver = this._isClueGiver ?? this.stateManager.isCurrentPlayerClueGiver();
        return hasValidPosition && shouldShow && isClueGiver;
    }

    updateTargetVisibility() {
        const isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        const gamePhase = this.stateManager.getGameState().phase;
        
        this.showTarget = (isClueGiver && ['giving-clue', 'guessing'].includes(gamePhase)) || gamePhase === 'scoring';
        
        console.log(`👁️ Updated target visibility - IsClueGiver: ${isClueGiver}, Phase: ${gamePhase}, ShowTarget: ${this.showTarget}`);
    }

    renderDebugInfo() {
        if (!this.debugMode || window.location.hostname !== 'localhost') return;
        
        this.ctx.save();
        this.ctx.font = '10px monospace';
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        
        const isClueGiver = this.stateManager.isCurrentPlayerClueGiver();
        const debugText = `Target: ${this.targetPosition} | Show: ${this.showTarget} | ClueGiver: ${isClueGiver} | Enabled: ${this.interactionEnabled}`;
        
        this.ctx.fillText(debugText, 5, 10);
        this.ctx.restore();
    }

    renderSpectrumGradient() {
        if (!this.spectrum?.gradient) return;
        
        const gradient = this.getOrCreateGradient();
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(0.5, 0.5, this.width - 1, this.height - 1);
    }

    getOrCreateGradient() {
        const cacheKey = `${this.spectrum.id}-${this.width}`;
        
        if (this.gradientCache.has(cacheKey)) return this.gradientCache.get(cacheKey);
        
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
        const { start, middle, end } = this.spectrum.gradient;
        
        gradient.addColorStop(0, start);
        if (middle) gradient.addColorStop(0.5, middle);
        gradient.addColorStop(1, end);
        
        this.gradientCache.set(cacheKey, gradient);
        return gradient;
    }

    clearGradientCache = () => this.gradientCache.clear();

    renderTarget() {
        const x = this.positionToPixel(this.targetPosition);
        const y = this.height / 2;
        
        if (this.debugMode && this.frameCount % this.logFrequency === 0) {
            console.log(`🎯 Rendering target at position ${this.targetPosition} (${x}px)`);
        }
        
        this.ctx.save();
        
        const pulse = Math.sin(Date.now() * 0.003) * 0.1 + 1;
        
        this.ctx.shadowColor = '#ff0000';
        this.ctx.shadowBlur = 20;
        
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 12 * pulse, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
        
        this.ctx.save();
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#ef4444';
        this.ctx.fillText(`${this.targetPosition}`, x, y + 25);
        this.ctx.restore();
    }

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

    renderGuessMarker(x, y, color, initial) {
        this.ctx.save();
        
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 8;
        
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(initial, x, y);
        
        this.ctx.restore();
    }

    renderHoverPreview() {
        const x = this.positionToPixel(this.hoverPosition);
        const y = this.height / 2;
        
        this.ctx.save();
        
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillStyle = '#8b5cf6';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.globalAlpha = 1;
        this.ctx.strokeStyle = '#8b5cf6';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([3, 3]);
        this.ctx.beginPath();
        this.ctx.arc(x, y, 12, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.restore();
        
        this.renderPositionIndicator(x, y - 20, this.hoverPosition);
    }

    renderPreviewGuess() {
        const x = this.positionToPixel(this.previewGuess);
        const y = this.height / 2;
        
        this.ctx.save();
        
        const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 0.8;
        this.ctx.globalAlpha = pulse;
        
        this.ctx.fillStyle = '#8b5cf6';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.restore();
    }

    renderPositionIndicator(x, y, position) {
        this.ctx.save();
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(x - 15, y - 10, 30, 20);
        
        this.ctx.fillStyle = '#ffffff';
this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(Math.round(position), x, y);
        
        this.ctx.restore();
    }

    renderParticles() {
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    updateAnimations() {
        const now = Date.now();
        
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            p.size *= p.shrink;
            return p.alpha > 0 && p.size > 0.1;
        });
        
        this.animations = this.animations.filter(a => {
            const progress = (now - a.startTime) / a.duration;
            if (progress >= 1) {
                a.onComplete?.();
                return false;
            }
            a.onUpdate?.(progress);
            return true;
        });
    }

    handleMouseEnter = () => {
        this.isHovering = true;
        if (this.interactionEnabled) this.canvasContainer.style.cursor = 'crosshair';
    }

    handleMouseLeave = () => {
        this.isHovering = false;
        this.hoverPosition = null;
        this.canvasContainer.style.cursor = 'default';
    }

    handleMouseMove = e => {
        if (!this.interactionEnabled) return;
        const rect = this.canvasContainer.getBoundingClientRect();
        this.hoverPosition = this.pixelToPosition(e.clientX - rect.left);
    }

    handleClick = e => {
        if (!this.interactionEnabled) return;
        const rect = this.canvasContainer.getBoundingClientRect();
        this.handleGuessPlacement(this.pixelToPosition(e.clientX - rect.left));
    }

    handleMouseDown = e => {
        if (this.interactionEnabled) this.isDragging = true;
    }

    handleMouseUp = () => this.isDragging = false;

    handleTouchStart = e => {
        e.preventDefault();
        if (!this.interactionEnabled) return;
        
        const touch = e.touches[0];
        const rect = this.canvasContainer.getBoundingClientRect();
        this.hoverPosition = this.pixelToPosition(touch.clientX - rect.left);
        this.isHovering = true;
    }

    handleTouchMove = e => {
        e.preventDefault();
        if (!this.interactionEnabled) return;
        
        const touch = e.touches[0];
        const rect = this.canvasContainer.getBoundingClientRect();
        this.hoverPosition = this.pixelToPosition(touch.clientX - rect.left);
    }

    handleTouchEnd = e => {
        e.preventDefault();
        if (!this.interactionEnabled || this.hoverPosition === null) return;
        
        this.handleGuessPlacement(this.hoverPosition);
        this.isHovering = false;
        this.hoverPosition = null;
    }

    handleGuessPlacement(position) {
        position = Math.max(0, Math.min(100, Math.round(position)));
        
        console.log(`🎲 Guess placed at position ${position}`);
        
        this.previewGuess = position;
        this.createPlacementParticles(this.positionToPixel(position));
        
        this.stateManager.emit('spectrum:guess-placed', { position });
        
        const slider = document.getElementById('guess-slider');
        const valueDisplay = document.getElementById('guess-value');
        if (slider) slider.value = position;
        if (valueDisplay) valueDisplay.textContent = position;
    }

    createPlacementParticles(x) {
        const colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];
        
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = 2 + Math.random() * 3;
            
            this.particles.push({
                x,
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

    createCelebrationParticles(x, color = '#10b981') {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5;
            
            this.particles.push({
                x,
                y: this.height / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 3 + Math.random() * 4,
                alpha: 1,
                decay: 0.015,
                shrink: 0.97,
                color
            });
        }
    }

    positionToPixel = position => (position / 100) * this.width;
    pixelToPosition = pixel => (pixel / this.width) * 100;

    updateSpectrum(spectrum) {
        this.spectrum = spectrum;
        this.clearGradientCache();
        console.log('🌈 Spectrum updated in renderer:', spectrum);
    }

    updateTargetPosition(position) {
        const oldPosition = this.targetPosition;
        this.targetPosition = position;
        
        console.log(`🎯 Target position updated from ${oldPosition} to ${position}`);
        
        this.updateTargetVisibility();
        
        if (this.showTarget && position !== null && position !== undefined && oldPosition !== position) {
            console.log('✨ Animating target reveal');
            this.animateTargetReveal();
        }
    }

    updateGuesses(guesses) {
        const oldGuesses = { ...this.guesses };
        this.guesses = guesses || {};
        
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
        
        this.canvasContainer.style.pointerEvents = enabled ? 'auto' : 'none';
        this.canvasContainer.style.cursor = enabled ? 'crosshair' : 'default';
        
        if (!enabled) {
            this.isHovering = false;
            this.hoverPosition = null;
        }
    }

    setShowTarget(show) {
        const oldShowTarget = this.showTarget;
        this.showTarget = show;
        
        console.log(`👁️ Target visibility changed from ${oldShowTarget} to ${show}`);
        
        if (show && !oldShowTarget && this.targetPosition !== null && this.targetPosition !== undefined) {
            console.log(`✨ Showing target at position ${this.targetPosition}`);
            this.animateTargetReveal();
        }
    }

    handlePhaseChange(phase) {
        console.log(`🎮 Handling phase change to: ${phase}`);
        
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
    }

    clearRoundData() {
        console.log('🧹 Clearing round data');
        Object.assign(this, {
            targetPosition: null,
            guesses: {},
            previewGuess: null,
            showTarget: false,
            particles: []
        });
    }

    animateTargetReveal() {
        if (this.targetPosition === null || this.targetPosition === undefined) return;
        this.createCelebrationParticles(this.positionToPixel(this.targetPosition), '#ef4444');
    }

    animateGuessPlacement(position) {
        this.createPlacementParticles(this.positionToPixel(position));
    }

    animateScoreReveal() {
        Object.values(this.guesses).forEach(position => 
            this.createCelebrationParticles(this.positionToPixel(position)));
        
        if (this.targetPosition !== null && this.targetPosition !== undefined) {
            setTimeout(() => 
                this.createCelebrationParticles(this.positionToPixel(this.targetPosition), '#ffd700'), 500);
        }
    }

    destroy() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        } else {
            window.removeEventListener('resize', this.handleResize);
        }
        
        if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
        
        Object.assign(this, {
            canvas: null,
            ctx: null,
            animations: [],
            particles: [],
            gradientCache: new Map()
        });
        
        this.clearRoundData();
        console.log('🧹 SpectrumRenderer destroyed');
    }
}