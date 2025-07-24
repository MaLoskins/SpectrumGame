/**
 * Chat Manager - Real-time chat interface management
 * Handles message display, formatting, timestamps, scroll management, and input validation
 * UPDATED: Enhanced responsive support and mobile optimizations
 */

export class ChatManager {
    constructor(stateManager) {
        Object.assign(this, {
            stateManager,
            chatContainer: null,
            messagesContainer: null,
            inputElement: null,
            sendButton: null,
            toggleButton: null,
            isVisible: true,
            isScrolledToBottom: true,
            unreadCount: 0,
            lastMessageTime: 0,
            messageQueue: [],
            autoScrollThreshold: 100,
            scrollAnimationDuration: 300,
            maxMessageLength: 200,
            messageHistory: [],
            historyIndex: -1,
            typingUsers: new Set(),
            typingTimeout: null,
            debugMode: false,
            // Performance optimizations
            scrollRAF: null,
            resizeObserver: null,
            // Responsive settings
            isMobile: false,
            isTablet: false,
            touchEnabled: false,
            virtualKeyboardOpen: false,
            lastViewportHeight: window.innerHeight,
            // Mobile-specific settings
            swipeStartY: null,
            swipeThreshold: 50,
            compactMode: false,
            maxVisibleMessages: 50,
            messageLoadBatch: 20
        });
    }

    async init() {
        console.log('💬 Initializing ChatManager...');
        this.detectDeviceCapabilities();
        this.cacheElements();
        this.setupEventListeners();
        this.setupStateListeners();
        this.setupResponsiveHandlers();
        this.initializeChatState();
        console.log('✅ ChatManager initialized');
    }

    /**
     * Detect device capabilities
     */
    detectDeviceCapabilities() {
        const width = window.innerWidth;
        this.isMobile = width <= 768;
        this.isTablet = width > 768 && width <= 1200;
        this.touchEnabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Adjust settings based on device
        if (this.isMobile) {
            this.autoScrollThreshold = 50;
            this.scrollAnimationDuration = 0; // Instant scroll on mobile
            this.maxMessageLength = 150; // Shorter messages on mobile
            this.compactMode = true;
            this.maxVisibleMessages = 30; // Fewer messages on mobile
        } else if (this.isTablet) {
            this.autoScrollThreshold = 75;
            this.scrollAnimationDuration = 150;
            this.compactMode = true;
        }
    }

    /**
     * Set up responsive handlers
     */
    setupResponsiveHandlers() {
        // Handle virtual keyboard on mobile
        if (this.isMobile) {
            this.setupVirtualKeyboardHandling();
        }

        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.detectDeviceCapabilities();
                this.adjustChatLayout();
            }, 100);
        });

        // Touch gestures for mobile
        if (this.touchEnabled) {
            this.setupTouchGestures();
        }
    }

    /**
     * Setup virtual keyboard handling for mobile
     */
    setupVirtualKeyboardHandling() {
        // Detect virtual keyboard by viewport height changes
        window.addEventListener('resize', () => {
            const currentHeight = window.innerHeight;
            const heightDifference = this.lastViewportHeight - currentHeight;
            
            // If viewport shrinks by more than 100px, keyboard is likely open
            if (heightDifference > 100) {
                this.handleVirtualKeyboardOpen();
            } else if (heightDifference < -100) {
                this.handleVirtualKeyboardClose();
            }
            
            this.lastViewportHeight = currentHeight;
        });

        // Focus/blur events on input
        if (this.inputElement) {
            this.inputElement.addEventListener('focus', () => {
                if (this.isMobile) {
                    setTimeout(() => this.handleVirtualKeyboardOpen(), 300);
                }
            });

            this.inputElement.addEventListener('blur', () => {
                if (this.isMobile) {
                    setTimeout(() => this.handleVirtualKeyboardClose(), 300);
                }
            });
        }
    }

    /**
     * Handle virtual keyboard opening
     */
    handleVirtualKeyboardOpen() {
        this.virtualKeyboardOpen = true;
        document.body.classList.add('keyboard-open');
        
        // Scroll to bottom to keep input visible
        this.scrollToBottom(false);
        
        // Adjust chat container height
        if (this.chatContainer) {
            this.chatContainer.style.maxHeight = '40vh';
        }
    }

    /**
     * Handle virtual keyboard closing
     */
    handleVirtualKeyboardClose() {
        this.virtualKeyboardOpen = false;
        document.body.classList.remove('keyboard-open');
        
        // Restore chat container height
        if (this.chatContainer) {
            this.chatContainer.style.maxHeight = '';
        }
    }

    /**
     * Setup touch gestures
     */
    setupTouchGestures() {
        if (!this.messagesContainer) return;

        let touchStartY = 0;
        let pullDistance = 0;
        let isPulling = false;

        // Pull-to-load more messages
        this.messagesContainer.addEventListener('touchstart', (e) => {
            if (this.messagesContainer.scrollTop === 0) {
                touchStartY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });

        this.messagesContainer.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            
            pullDistance = e.touches[0].clientY - touchStartY;
            
            if (pullDistance > 0 && this.messagesContainer.scrollTop === 0) {
                // Show loading indicator
                if (pullDistance > 50) {
                    this.showLoadingIndicator();
                }
            }
        }, { passive: true });

        this.messagesContainer.addEventListener('touchend', () => {
            if (isPulling && pullDistance > 50) {
                this.loadMoreMessages();
            }
            
            isPulling = false;
            pullDistance = 0;
            this.hideLoadingIndicator();
        }, { passive: true });
    }

    /**
     * Show loading indicator for pull-to-refresh
     */
    showLoadingIndicator() {
        if (!this.messagesContainer.querySelector('.loading-more')) {
            const loader = document.createElement('div');
            loader.className = 'loading-more';
            loader.innerHTML = '<div class="spinner-small"></div> Loading...';
            this.messagesContainer.insertBefore(loader, this.messagesContainer.firstChild);
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoadingIndicator() {
        const loader = this.messagesContainer.querySelector('.loading-more');
        if (loader) {
            loader.remove();
        }
    }

    /**
     * Load more messages (for infinite scroll)
     */
    loadMoreMessages() {
        // This would typically load older messages from the server
        console.log('Loading more messages...');
        
        // For now, just hide the indicator after a delay
        setTimeout(() => {
            this.hideLoadingIndicator();
        }, 1000);
    }

    /**
     * Adjust chat layout for current device
     */
    adjustChatLayout() {
        if (!this.chatContainer) return;

        if (this.isMobile) {
            // Mobile layout adjustments
            this.enableCompactMode();
            this.limitVisibleMessages();
        } else {
            // Desktop layout
            this.disableCompactMode();
            this.showAllMessages();
        }
    }

    /**
     * Enable compact mode for mobile
     */
    enableCompactMode() {
        this.compactMode = true;
        this.chatContainer.classList.add('compact-mode');
        
        // Reduce message padding and font sizes
        document.querySelectorAll('.chat-message').forEach(msg => {
            msg.classList.add('compact');
        });
    }

    /**
     * Disable compact mode
     */
    disableCompactMode() {
        this.compactMode = false;
        this.chatContainer.classList.remove('compact-mode');
        
        document.querySelectorAll('.chat-message').forEach(msg => {
            msg.classList.remove('compact');
        });
    }

    /**
     * Limit visible messages on mobile for performance
     */
    limitVisibleMessages() {
        const messages = Array.from(this.messagesContainer.children);
        
        if (messages.length > this.maxVisibleMessages) {
            const messagesToHide = messages.length - this.maxVisibleMessages;
            
            for (let i = 0; i < messagesToHide; i++) {
                messages[i].style.display = 'none';
            }
            
            // Add "load more" button if not present
            if (!this.messagesContainer.querySelector('.load-more-btn')) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.textContent = `Load ${messagesToHide} more messages`;
                loadMoreBtn.addEventListener('click', () => this.showAllMessages());
                this.messagesContainer.insertBefore(loadMoreBtn, messages[messagesToHide]);
            }
        }
    }

    /**
     * Show all messages
     */
    showAllMessages() {
        document.querySelectorAll('.chat-message').forEach(msg => {
            msg.style.display = '';
        });
        
        const loadMoreBtn = this.messagesContainer.querySelector('.load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.remove();
        }
    }

    cacheElements() {
        // Batch DOM queries
        const selectors = {
            chatContainer: '.chat-panel',
            messagesContainer: '#chat-messages',
            inputElement: '#chat-input',
            sendButton: '#send-chat',
            toggleButton: '#toggle-chat'
        };
        
        Object.entries(selectors).forEach(([key, selector]) => {
            this[key] = document.querySelector(selector);
        });
        
        if (!this.messagesContainer || !this.inputElement) {
            console.error('Required chat elements not found');
        }
    }

    setupEventListeners() {
        // Use event delegation for better performance
        if (this.messagesContainer) {
            this.messagesContainer.addEventListener('scroll', this.throttledScroll);
        }
        
        if (this.inputElement) {
            this.inputElement.addEventListener('keypress', this.handleInputKeyPress);
            this.inputElement.addEventListener('keydown', this.handleInputKeyDown);
            this.inputElement.addEventListener('input', this.throttledInputChange);
            this.inputElement.addEventListener('focus', this.handleInputFocus);
            this.inputElement.addEventListener('blur', this.handleInputBlur);
            
            // Mobile-specific: adjust input height dynamically
            if (this.isMobile) {
                this.inputElement.addEventListener('input', this.adjustInputHeight);
            }
        }
        
        this.sendButton?.addEventListener('click', this.handleSendMessage);
        this.toggleButton?.addEventListener('click', this.handleToggleChat);
        
        // Optimize resize observer
        if (window.ResizeObserver && this.messagesContainer) {
            this.resizeObserver = new ResizeObserver(this.throttledResize);
            this.resizeObserver.observe(this.messagesContainer);
        }
    }

    /**
     * Adjust input height based on content (mobile)
     */
    adjustInputHeight = () => {
        if (!this.inputElement || !this.isMobile) return;
        
        // Reset height to auto to get the correct scrollHeight
        this.inputElement.style.height = 'auto';
        
        // Set height to scrollHeight, with max of 3 lines
        const lineHeight = parseInt(getComputedStyle(this.inputElement).lineHeight);
        const maxHeight = lineHeight * 3;
        const newHeight = Math.min(this.inputElement.scrollHeight, maxHeight);
        
        this.inputElement.style.height = `${newHeight}px`;
    }

    // Throttled event handlers for performance
    throttledScroll = this.throttle(() => this.handleScroll(), 100);
    throttledInputChange = this.throttle(() => this.handleInputChange(), 300);
    throttledResize = this.throttle(() => {
        if (this.isScrolledToBottom) this.scrollToBottom(false);
    }, 250);

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
            'chat.messages': data => this.updateMessages(data.newValue),
            'ui.chatVisible': data => this.updateVisibility(data.newValue),
            'chat.unreadCount': data => this.updateUnreadCount(data.newValue),
            'players': data => this.updatePlayerList(data.newValue)
        };
        
        Object.entries(listeners).forEach(([state, handler]) => 
            this.stateManager.on(`state:${state}`, handler));
    }

    initializeChatState() {
        this.isVisible = this.stateManager.getUIState().chatVisible;
        this.updateVisibility(this.isVisible);
        this.updateMessages(this.stateManager.getChatMessages());
        if (this.isVisible && this.inputElement && !this.virtualKeyboardOpen) {
            this.inputElement.focus();
        }
    }

    handleSendMessage = () => {
        const message = this.inputElement.value.trim();
        if (!message || !this.validateMessage(message)) return;
        
        this.addToHistory(message);
        this.inputElement.value = '';
        this.historyIndex = -1;
        this.sendMessage(message);
        this.updateSendButton();
        this.inputElement.focus();
    }

    handleInputKeyPress = e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendMessage();
        }
    }

    handleInputKeyDown = e => {
        const actions = {
            ArrowUp: () => { e.preventDefault(); this.navigateHistory('up'); },
            ArrowDown: () => { e.preventDefault(); this.navigateHistory('down'); },
            Escape: () => this.inputElement.blur()
        };
        actions[e.key]?.();
    }

    handleInputChange = () => {
        this.updateSendButton();
        this.handleTypingIndicator();
    }

    handleInputFocus = () => this.markAsRead();
    handleInputBlur = () => this.clearTypingIndicator();
    handleToggleChat = () => {
        this.isVisible = !this.isVisible;
        this.stateManager.updateUIState({ chatVisible: this.isVisible });
    }

    handleScroll = () => {
        const { scrollHeight, scrollTop, clientHeight } = this.messagesContainer;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < this.autoScrollThreshold;
        
        if (isAtBottom !== this.isScrolledToBottom) {
            this.isScrolledToBottom = isAtBottom;
            if (isAtBottom) this.markAsRead();
        }
    }

    sendMessage(content) {
        const currentPlayer = this.stateManager.getCurrentPlayer();
        if (!currentPlayer) return;
        
        // Don't add the message locally - let the server broadcast handle it
        // Just emit the event
        this.stateManager.emit('ui:send-chat', { message: content });
    }

    addSystemMessage(content, type = 'system') {
        if (!this.debugMode) return;
        
        this.stateManager.addChatMessage({
            id: Date.now() + Math.random(),
            content,
            timestamp: Date.now(),
            type
        });
    }

    /**
     * Update messages display with responsive optimizations
     * @param {Array} messages - Array of message objects
     */
    updateMessages(messages) {
        if (!this.messagesContainer) return;
        
        const wasAtBottom = this.isScrolledToBottom;
        
        // Clear and rebuild - simpler and more reliable for grouped messages
        this.messagesContainer.innerHTML = '';
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Limit messages on mobile
        const messagesToShow = this.isMobile 
            ? messages.slice(-this.maxVisibleMessages)
            : messages;
        
        // Don't group messages - display them individually for clarity
        messagesToShow.forEach(message => {
            fragment.appendChild(this.createIndividualMessage(message));
        });
        
        // Add load more button on mobile if there are hidden messages
        if (this.isMobile && messages.length > this.maxVisibleMessages) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.textContent = `Load ${messages.length - this.maxVisibleMessages} older messages`;
            loadMoreBtn.addEventListener('click', () => {
                this.maxVisibleMessages = messages.length;
                this.updateMessages(messages);
            });
            fragment.insertBefore(loadMoreBtn, fragment.firstChild);
        }
        
        // Single DOM update
        this.messagesContainer.appendChild(fragment);
        
        if (wasAtBottom || messages.length === 1) this.scrollToBottom(!this.isMobile);
        
        if (!this.isVisible || !this.isScrolledToBottom) {
            this.updateUnreadCount(this.stateManager.getChatMessages().length);
        }
    }

    /**
     * Create an individual message element with responsive styling
     * @param {Object} message - Message data
     * @returns {HTMLElement} Message element
     */
    createIndividualMessage(message) {
        const div = document.createElement('div');
        div.className = 'chat-message';
        div.dataset.messageId = message.id;
        
        if (this.compactMode) {
            div.classList.add('compact');
        }
        
        if (message.type === 'system') {
            div.classList.add('system');
        } else {
            const currentPlayerId = this.stateManager.getConnectionState().playerId;
            if (message.playerId === currentPlayerId) div.classList.add('own');
        }
        
        // Add header for non-system messages
        if (message.type !== 'system') {
            const header = document.createElement('div');
            header.className = 'message-header';
            
            const sender = document.createElement('span');
            sender.className = 'message-sender';
            sender.textContent = message.playerName || 'Unknown';
            
            const time = document.createElement('span');
            time.className = 'message-time';
            time.textContent = this.formatTimestamp(message.timestamp, this.isMobile);
            
            header.appendChild(sender);
            header.appendChild(time);
            div.appendChild(header);
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = this.formatMessageContent(message.content || message.text);
        div.appendChild(content);
        
        // Add animation only on desktop
        if (!this.isMobile) {
            div.classList.add('animate-message-slide-in');
        }
        
        return div;
    }

    formatMessageContent(content) {
        if (!content || typeof content !== 'string') {
            if (this.debugMode) console.warn('💬 Invalid message content:', content);
            return '';
        }
        
        // Cache formatted messages for better performance
        if (this._formattedContentCache === undefined) {
            this._formattedContentCache = new Map();
        }
        
        // Return cached result if available
        if (this._formattedContentCache.has(content)) {
            return this._formattedContentCache.get(content);
        }
        
        // More efficient escaping
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        
        const formatted = content
            .replace(/[&<>"']/g, m => escapeMap[m])
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
            .replace(/\n/g, '<br>');
        
        // Cache the result (limit cache size to prevent memory leaks)
        if (this._formattedContentCache.size > 100) {
            // Remove oldest entries when cache gets too large
            const oldestKeys = Array.from(this._formattedContentCache.keys()).slice(0, 20);
            oldestKeys.forEach(key => this._formattedContentCache.delete(key));
        }
        
        this._formattedContentCache.set(content, formatted);
        return formatted;
    }

    /**
     * Format timestamp with mobile-friendly format
     * @param {number} timestamp - Message timestamp
     * @param {boolean} shortFormat - Use short format
     * @returns {string} Formatted time string
     */
    formatTimestamp(timestamp, shortFormat = false) {
        const date = new Date(timestamp);
        const now = new Date();
        const timeOptions = this.isMobile 
            ? { hour: 'numeric', minute: '2-digit' }
            : { hour: '2-digit', minute: '2-digit' };
        
        if (shortFormat || this.isMobile) {
            return date.toLocaleTimeString([], timeOptions);
        }
        
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], timeOptions);
        }
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday ' + date.toLocaleTimeString([], timeOptions);
        }
        
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], timeOptions);
    }

    /**
     * Scroll to bottom with performance optimizations
     * @param {boolean} animate - Whether to animate the scroll
     */
    scrollToBottom(animate = true) {
        if (!this.messagesContainer) return;
        
        // Cancel any pending scroll animation
        if (this.scrollRAF) {
            cancelAnimationFrame(this.scrollRAF);
        }
        
        const { scrollHeight, clientHeight } = this.messagesContainer;
        const targetScroll = scrollHeight - clientHeight;
        
        if (!animate || this.isMobile) {
            this.messagesContainer.scrollTop = targetScroll;
            return;
        }
        
        // Use requestAnimationFrame for smooth scrolling on desktop
        const startScroll = this.messagesContainer.scrollTop;
        const distance = targetScroll - startScroll;
        const startTime = performance.now();
        
        const animateScroll = currentTime => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / this.scrollAnimationDuration, 1);
            
            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            this.messagesContainer.scrollTop = startScroll + distance * easeOut;
            
            if (progress < 1) {
                this.scrollRAF = requestAnimationFrame(animateScroll);
            }
        };
        
        this.scrollRAF = requestAnimationFrame(animateScroll);
    }

    /**
     * Update visibility with mobile optimizations
     * @param {boolean} visible - Whether chat is visible
     */
    updateVisibility(visible) {
        this.isVisible = visible;
        if (!this.chatContainer) return;
        
        // Use CSS classes for animations
        this.chatContainer.classList.toggle('collapsed', !visible);
        
        // On mobile, handle differently
        if (this.isMobile) {
            if (visible) {
                this.chatContainer.classList.add('mobile-expanded');
                document.body.classList.add('chat-open');
            } else {
                this.chatContainer.classList.remove('mobile-expanded');
                document.body.classList.remove('chat-open');
            }
        }
        
        this.messagesContainer.style.display = visible ? 'flex' : 'none';
        this.toggleButton.textContent = visible ? '−' : '+';
        
        if (visible) {
            // Use requestAnimationFrame for DOM updates
            requestAnimationFrame(() => {
                if (!this.virtualKeyboardOpen) {
                    this.inputElement?.focus();
                }
                this.markAsRead();
                this.scrollToBottom(false);
            });
        }
    }

    updateUnreadCount(count) {
        this.unreadCount = count;
        
        if (this.toggleButton) {
            this.toggleButton.textContent = count > 0 && !this.isVisible ? `+ (${count})` : (this.isVisible ? '−' : '+');
            this.toggleButton.classList.toggle('has-unread', count > 0 && !this.isVisible);
        }
    }

    markAsRead() {
        if (this.unreadCount > 0) this.stateManager.markChatAsRead();
    }

    /**
     * Validate message with mobile-specific length
     * @param {string} message - Message to validate
     * @returns {boolean} Whether message is valid
     */
    validateMessage(message) {
        if (!message || message.length === 0) return false;
        
        const maxLength = this.isMobile ? 150 : this.maxMessageLength;
        
        if (message.length > maxLength) {
            this.showError(`Message too long (max ${maxLength} characters)`);
            return false;
        }
        
        const now = Date.now();
        if (this.lastMessage === message && now - this.lastMessageTime < 2000) {
            this.showError('Please wait before sending the same message again');
            return false;
        }
        
        this.lastMessage = message;
        this.lastMessageTime = now;
        return true;
    }

    showError(message) {
        console.warn('Chat error:', message);
    }

    updateSendButton() {
        if (!this.sendButton || !this.inputElement) return;
        
        const hasContent = this.inputElement.value.trim().length > 0;
        this.sendButton.disabled = !hasContent;
        this.sendButton.classList.toggle('active', hasContent);
    }

    addToHistory(message) {
        this.messageHistory.unshift(message);
        if (this.messageHistory.length > 50) this.messageHistory.pop();
    }

    navigateHistory(direction) {
        if (this.messageHistory.length === 0) return;
        
        this.historyIndex = direction === 'up' 
            ? Math.min(this.historyIndex + 1, this.messageHistory.length - 1)
            : Math.max(this.historyIndex - 1, -1);
        
        this.inputElement.value = this.historyIndex >= 0 ? this.messageHistory[this.historyIndex] : '';
        this.updateSendButton();
    }

    handleTypingIndicator() {
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        
        this.stateManager.emit('ui:typing-start');
        this.typingTimeout = setTimeout(() => this.clearTypingIndicator(), 3000);
    }

    clearTypingIndicator() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
        this.stateManager.emit('ui:typing-stop');
    }

    updatePlayerList(players) {
        // Placeholder for typing indicators
    }

    destroy() {
        // Clean up event listeners
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        if (this.scrollRAF) cancelAnimationFrame(this.scrollRAF);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        
        // Remove event listeners
        this.messagesContainer?.removeEventListener('scroll', this.throttledScroll);
        this.inputElement?.removeEventListener('keypress', this.handleInputKeyPress);
        this.inputElement?.removeEventListener('keydown', this.handleInputKeyDown);
        this.inputElement?.removeEventListener('input', this.throttledInputChange);
        this.inputElement?.removeEventListener('focus', this.handleInputFocus);
        this.inputElement?.removeEventListener('blur', this.handleInputBlur);
        
        if (this.isMobile) {
            this.inputElement?.removeEventListener('input', this.adjustInputHeight);
        }
        
        this.sendButton?.removeEventListener('click', this.handleSendMessage);
        this.toggleButton?.removeEventListener('click', this.handleToggleChat);
        
        // Clean up notification close buttons
        const notifications = document.querySelectorAll('.notification-close');
        notifications.forEach(btn => {
            const id = btn.parentElement?.dataset.id;
            if (id) btn.removeEventListener('click', () => this.stateManager.removeNotification(id));
        });
        
        // Clear all timeouts
        const timeouts = [];
        for (let i = 0; i < 100; i++) {
            timeouts.push(setTimeout(() => {}, 0));
        }
        timeouts.forEach(id => clearTimeout(id));
        
        // Clear references
        this.messageHistory = [];
        this.typingUsers.clear();
        this._formattedContentCache?.clear();
        this.chatContainer = null;
        this.messagesContainer = null;
        this.inputElement = null;
        this.sendButton = null;
        this.toggleButton = null;
        
        console.log('🧹 ChatManager destroyed');
    }
}