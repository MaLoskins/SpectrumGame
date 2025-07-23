/**
 * Chat Manager - Real-time chat interface management
 * Handles message display, formatting, timestamps, scroll management, and input validation
 * FIXED: Fixed TypeError by using correct StateManager methods
 * FIXED: Fixed message grouping display issue
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
            resizeObserver: null
        });
    }

    async init() {
        console.log('💬 Initializing ChatManager...');
        this.cacheElements();
        this.setupEventListeners();
        this.setupStateListeners();
        this.initializeChatState();
        console.log('✅ ChatManager initialized');
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
        }
        
        this.sendButton?.addEventListener('click', this.handleSendMessage);
        this.toggleButton?.addEventListener('click', this.handleToggleChat);
        
        // Optimize resize observer
        if (window.ResizeObserver && this.messagesContainer) {
            this.resizeObserver = new ResizeObserver(this.throttledResize);
            this.resizeObserver.observe(this.messagesContainer);
        }
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
        if (this.isVisible && this.inputElement) this.inputElement.focus();
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

    updateMessages(messages) {
        if (!this.messagesContainer) return;
        
        const wasAtBottom = this.isScrolledToBottom;
        
        // Clear and rebuild - simpler and more reliable for grouped messages
        this.messagesContainer.innerHTML = '';
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Don't group messages - display them individually for clarity
        messages.forEach(message => {
            fragment.appendChild(this.createIndividualMessage(message));
        });
        
        // Single DOM update
        this.messagesContainer.appendChild(fragment);
        
        if (wasAtBottom || messages.length === 1) this.scrollToBottom(true);
        
        if (!this.isVisible || !this.isScrolledToBottom) {
            this.updateUnreadCount(this.stateManager.getChatMessages().length);
        }
    }

    createIndividualMessage(message) {
        const div = document.createElement('div');
        div.className = 'chat-message';
        div.dataset.messageId = message.id;
        
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
            time.textContent = this.formatTimestamp(message.timestamp);
            
            header.appendChild(sender);
            header.appendChild(time);
            div.appendChild(header);
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = this.formatMessageContent(message.content || message.text);
        div.appendChild(content);
        
        // Add animation
        div.classList.add('animate-message-slide-in');
        
        return div;
    }

    // Remove the old grouping methods since we're not using them anymore
    // groupMessages method removed
    // createMessageGroup method removed
    // createMessageHeader method removed
    // createMessageElement method removed

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

    formatTimestamp(timestamp, shortFormat = false) {
        const date = new Date(timestamp);
        const now = new Date();
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        
        if (shortFormat) return date.toLocaleTimeString([], timeOptions);
        
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

    scrollToBottom(animate = true) {
        if (!this.messagesContainer) return;
        
        // Cancel any pending scroll animation
        if (this.scrollRAF) {
            cancelAnimationFrame(this.scrollRAF);
        }
        
        const { scrollHeight, clientHeight } = this.messagesContainer;
        const targetScroll = scrollHeight - clientHeight;
        
        if (!animate) {
            this.messagesContainer.scrollTop = targetScroll;
            return;
        }
        
        // Use requestAnimationFrame for smooth scrolling
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

    updateVisibility(visible) {
        this.isVisible = visible;
        if (!this.chatContainer) return;
        
        // Use CSS classes for animations
        this.chatContainer.classList.toggle('collapsed', !visible);
        this.messagesContainer.style.display = visible ? 'flex' : 'none';
        this.toggleButton.textContent = visible ? '−' : '+';
        
        if (visible) {
            // Use requestAnimationFrame for DOM updates
            requestAnimationFrame(() => {
                this.inputElement?.focus();
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

    validateMessage(message) {
        if (!message || message.length === 0) return false;
        
        if (message.length > this.maxMessageLength) {
            this.showError(`Message too long (max ${this.maxMessageLength} characters)`);
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
        this.sendButton?.removeEventListener('click', this.handleSendMessage);
        this.toggleButton?.removeEventListener('click', this.handleToggleChat);
        
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