/**
 * Chat Manager - Real-time chat interface management
 * Handles message display, formatting, timestamps, scroll management, and input validation
 * FIXED: Fixed TypeError by using correct StateManager methods
 */

export class ChatManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        
        // DOM elements
        this.chatContainer = null;
        this.messagesContainer = null;
        this.inputElement = null;
        this.sendButton = null;
        this.toggleButton = null;
        
        // Chat state
        this.isVisible = true;
        this.isScrolledToBottom = true;
        this.unreadCount = 0;
        this.lastMessageTime = 0;
        this.messageQueue = [];
        
        // Auto-scroll settings
        this.autoScrollThreshold = 100; // pixels from bottom
        this.scrollAnimationDuration = 300;
        
        // Message formatting
        this.maxMessageLength = 200;
        this.messageHistory = [];
        this.historyIndex = -1;
        
        // Typing indicators
        this.typingUsers = new Set();
        this.typingTimeout = null;
        
        // Debug mode
        this.debugMode = false; // Changed to false by default
        
        // Bind methods
        this.init = this.init.bind(this);
        this.handleSendMessage = this.handleSendMessage.bind(this);
        this.handleInputKeyPress = this.handleInputKeyPress.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
    }

    /**
     * Initialize the chat manager
     */
    async init() {
        console.log('💬 Initializing ChatManager...');
        
        // Cache DOM elements
        this.cacheElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up state listeners
        this.setupStateListeners();
        
        // Initialize chat state
        this.initializeChatState();
        
        console.log('✅ ChatManager initialized');
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.chatContainer = document.querySelector('.chat-panel');
        this.messagesContainer = document.getElementById('chat-messages');
        this.inputElement = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-chat');
        this.toggleButton = document.getElementById('toggle-chat');
        
        if (!this.messagesContainer || !this.inputElement) {
            console.error('Required chat elements not found');
            return;
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Send button click
        this.sendButton?.addEventListener('click', this.handleSendMessage);
        
        // Input events
        this.inputElement?.addEventListener('keypress', this.handleInputKeyPress);
        this.inputElement?.addEventListener('keydown', this.handleInputKeyDown.bind(this));
        this.inputElement?.addEventListener('input', this.handleInputChange.bind(this));
        this.inputElement?.addEventListener('focus', this.handleInputFocus.bind(this));
        this.inputElement?.addEventListener('blur', this.handleInputBlur.bind(this));
        
        // Toggle button
        this.toggleButton?.addEventListener('click', this.handleToggleChat.bind(this));
        
        // Scroll events
        this.messagesContainer?.addEventListener('scroll', this.handleScroll);
        
        // Resize observer for responsive behavior
        if (window.ResizeObserver && this.messagesContainer) {
            this.resizeObserver = new ResizeObserver(() => {
                if (this.isScrolledToBottom) {
                    this.scrollToBottom(false);
                }
            });
            this.resizeObserver.observe(this.messagesContainer);
        }
    }

    /**
     * Set up state listeners
     */
    setupStateListeners() {
        // Chat messages updates
        this.stateManager.on('state:chat.messages', (data) => {
            this.updateMessages(data.newValue);
        });
        
        // Chat visibility updates
        this.stateManager.on('state:ui.chatVisible', (data) => {
            this.updateVisibility(data.newValue);
        });
        
        // Unread count updates
        this.stateManager.on('state:chat.unreadCount', (data) => {
            this.updateUnreadCount(data.newValue);
        });
        
        // Player updates (for typing indicators)
        this.stateManager.on('state:players', (data) => {
            this.updatePlayerList(data.newValue);
        });
        
        // Game phase changes (for system messages) - REMOVED to reduce chat clutter
        // this.stateManager.on('state:game.phase', (data) => {
        //     this.handlePhaseChange(data.newValue);
        // });
    }

    /**
     * Initialize chat state
     */
    initializeChatState() {
        // Set initial visibility
        this.isVisible = this.stateManager.getUIState().chatVisible;
        this.updateVisibility(this.isVisible);
        
        // Load existing messages
        const messages = this.stateManager.getChatMessages();
        this.updateMessages(messages);
        
        // Focus input if chat is visible
        if (this.isVisible && this.inputElement) {
            this.inputElement.focus();
        }
    }

    /**
     * Handle send message
     */
    handleSendMessage() {
        const message = this.inputElement.value.trim();
        
        if (!message) return;
        
        // Validate message
        if (!this.validateMessage(message)) {
            return;
        }
        
        // Add to history
        this.addToHistory(message);
        
        // Clear input
        this.inputElement.value = '';
        this.historyIndex = -1;
        
        // Send message through state manager
        this.sendMessage(message);
        
        // Update UI
        this.updateSendButton();
        this.inputElement.focus();
    }

    /**
     * Handle input key press
     */
    handleInputKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendMessage();
        }
    }

    /**
     * Handle input key down (for history navigation)
     */
    handleInputKeyDown(e) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateHistory('up');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateHistory('down');
        } else if (e.key === 'Escape') {
            this.inputElement.blur();
        }
    }

    /**
     * Handle input change
     */
    handleInputChange() {
        this.updateSendButton();
        this.handleTypingIndicator();
    }

    /**
     * Handle input focus
     */
    handleInputFocus() {
        // Mark chat as read when focused
        this.markAsRead();
    }

    /**
     * Handle input blur
     */
    handleInputBlur() {
        // Clear typing indicator
        this.clearTypingIndicator();
    }

    /**
     * Handle toggle chat
     */
    handleToggleChat() {
        this.isVisible = !this.isVisible;
        this.stateManager.updateUIState({ chatVisible: this.isVisible });
    }

    /**
     * Handle scroll
     */
    handleScroll() {
        const container = this.messagesContainer;
        const threshold = this.autoScrollThreshold;
        
        // Check if scrolled to bottom
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        
        if (isAtBottom !== this.isScrolledToBottom) {
            this.isScrolledToBottom = isAtBottom;
            
            // Mark as read if scrolled to bottom
            if (isAtBottom) {
                this.markAsRead();
            }
        }
    }

    /**
     * Send message
     */
    sendMessage(content) {
        const currentPlayer = this.stateManager.getCurrentPlayer();
        if (!currentPlayer) return;
        
        const message = {
            id: Date.now() + Math.random(),
            content,
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            timestamp: Date.now(),
            type: 'message'
        };
        
        // Add to state
        this.stateManager.addChatMessage(message);
        
        // Emit to network layer
        this.stateManager.emit('ui:send-chat', { message: content });
    }

    /**
     * Add system message - REDUCED: Only for critical messages
     */
    addSystemMessage(content, type = 'system') {
        // Only add system messages in debug mode
        if (!this.debugMode) {
            return;
        }
        
        const message = {
            id: Date.now() + Math.random(),
            content,
            timestamp: Date.now(),
            type
        };
        
        this.stateManager.addChatMessage(message);
    }

    /**
     * Update messages display - FIXED: Use correct method name
     */
    updateMessages(messages) {
        if (!this.messagesContainer) return;
        
        // Store scroll position
        const wasAtBottom = this.isScrolledToBottom;
        
        // Clear container
        this.messagesContainer.innerHTML = '';
        
        // Group messages by time proximity
        const groupedMessages = this.groupMessages(messages);
        
        // Render message groups
        groupedMessages.forEach(group => {
            const groupElement = this.createMessageGroup(group);
            this.messagesContainer.appendChild(groupElement);
        });
        
        // Handle scrolling
        if (wasAtBottom || messages.length === 1) {
            this.scrollToBottom(true);
        }
        
        // Update unread count - FIXED: Use getUIState instead of getState
        const uiState = this.stateManager.getUIState();
        if (!this.isVisible || !this.isScrolledToBottom) {
            this.updateUnreadCount(this.stateManager.getChatMessages().length);
        }
    }

    /**
     * Group messages by time and sender
     */
    groupMessages(messages) {
        const groups = [];
        let currentGroup = null;
        
        messages.forEach(message => {
            const shouldGroup = currentGroup && 
                currentGroup.playerId === message.playerId &&
                currentGroup.type === message.type &&
                (message.timestamp - currentGroup.lastTimestamp) < 60000; // 1 minute
            
            if (shouldGroup) {
                currentGroup.messages.push(message);
                currentGroup.lastTimestamp = message.timestamp;
            } else {
                currentGroup = {
                    playerId: message.playerId,
                    playerName: message.playerName,
                    type: message.type,
                    messages: [message],
                    firstTimestamp: message.timestamp,
                    lastTimestamp: message.timestamp
                };
                groups.push(currentGroup);
            }
        });
        
        return groups;
    }

    /**
     * Create message group element
     */
    createMessageGroup(group) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'message-group';
        
        if (group.type === 'system') {
            groupDiv.classList.add('system-group');
        }
        
        // Check if this is current player's message
        const currentPlayerId = this.stateManager.getConnectionState().playerId;
        const isOwnMessage = group.playerId === currentPlayerId;
        
        if (isOwnMessage) {
            groupDiv.classList.add('own-group');
        }
        
        // Create header (for non-system messages)
        if (group.type !== 'system') {
            const header = this.createMessageHeader(group, isOwnMessage);
            groupDiv.appendChild(header);
        }
        
        // Create messages
        group.messages.forEach((message, index) => {
            const messageElement = this.createMessageElement(message, index === 0);
            groupDiv.appendChild(messageElement);
        });
        
        return groupDiv;
    }

    /**
     * Create message header
     */
    createMessageHeader(group, isOwnMessage) {
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const sender = document.createElement('span');
        sender.className = 'message-sender';
        sender.textContent = group.playerName || 'Unknown';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = this.formatTimestamp(group.firstTimestamp);
        
        if (isOwnMessage) {
            header.appendChild(time);
            header.appendChild(sender);
        } else {
            header.appendChild(sender);
            header.appendChild(time);
        }
        
        return header;
    }

    /**
     * Create message element
     */
    createMessageElement(message, isFirst) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.dataset.messageId = message.id;
        
        // Add type classes
        if (message.type === 'system') {
            messageDiv.classList.add('system');
        }
        
        // Check if own message
        const currentPlayerId = this.stateManager.getConnectionState().playerId;
        if (message.playerId === currentPlayerId) {
            messageDiv.classList.add('own');
        }
        
        // Create content
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Format message content
        content.innerHTML = this.formatMessageContent(message.content);
        
        messageDiv.appendChild(content);
        
        // Add timestamp for individual messages if needed
        if (!isFirst) {
            const timestamp = document.createElement('div');
            timestamp.className = 'message-timestamp';
            timestamp.textContent = this.formatTimestamp(message.timestamp, true);
            messageDiv.appendChild(timestamp);
        }
        
        // Add animation
        messageDiv.classList.add('animate-message-slide-in');
        
        return messageDiv;
    }

    /**
     * Format message content
     */
    formatMessageContent(content) {
        // Handle null/undefined content
        if (!content || typeof content !== 'string') {
            if (this.debugMode) {
                console.warn('💬 Invalid message content:', content);
            }
            return '';
        }
        
        // Escape HTML
        const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        
        // Format URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const withUrls = escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        
        // Format mentions (if needed)
        // const mentionRegex = /@(\w+)/g;
        // const withMentions = withUrls.replace(mentionRegex, '<span class="mention">@$1</span>');
        
        // Format line breaks
        return withUrls.replace(/\n/g, '<br>');
    }

    /**
     * Format timestamp
     */
    formatTimestamp(timestamp, shortFormat = false) {
        const date = new Date(timestamp);
        const now = new Date();
        
        if (shortFormat) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Check if today
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Check if yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Older dates
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Scroll to bottom
     */
    scrollToBottom(animate = true) {
        if (!this.messagesContainer) return;
        
        const container = this.messagesContainer;
        const targetScroll = container.scrollHeight - container.clientHeight;
        
        if (!animate) {
            container.scrollTop = targetScroll;
            return;
        }
        
        // Smooth scroll animation
        const startScroll = container.scrollTop;
        const distance = targetScroll - startScroll;
        const startTime = performance.now();
        
        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / this.scrollAnimationDuration, 1);
            
            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            container.scrollTop = startScroll + distance * easeOut;
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        };
        
        requestAnimationFrame(animateScroll);
    }

    /**
     * Update visibility
     */
    updateVisibility(visible) {
        this.isVisible = visible;
        
        if (!this.chatContainer) return;
        
        if (visible) {
            this.chatContainer.classList.remove('collapsed');
            this.messagesContainer.style.display = 'flex';
            this.toggleButton.textContent = '−';
            
            // Focus input and mark as read
            setTimeout(() => {
                this.inputElement?.focus();
                this.markAsRead();
                this.scrollToBottom(false);
            }, 100);
        } else {
            this.chatContainer.classList.add('collapsed');
            this.messagesContainer.style.display = 'none';
            this.toggleButton.textContent = '+';
        }
    }

    /**
     * Update unread count
     */
    updateUnreadCount(count) {
        this.unreadCount = count;
        
        // Update toggle button with unread indicator
        if (this.toggleButton) {
            if (count > 0 && !this.isVisible) {
                this.toggleButton.textContent = `+ (${count})`;
                this.toggleButton.classList.add('has-unread');
            } else {
                this.toggleButton.textContent = this.isVisible ? '−' : '+';
                this.toggleButton.classList.remove('has-unread');
            }
        }
    }

    /**
     * Mark chat as read
     */
    markAsRead() {
        if (this.unreadCount > 0) {
            this.stateManager.markChatAsRead();
        }
    }

    /**
     * Message validation
     */
    validateMessage(message) {
        if (!message || message.length === 0) {
            return false;
        }
        
        if (message.length > this.maxMessageLength) {
            this.showError(`Message too long (max ${this.maxMessageLength} characters)`);
            return false;
        }
        
        // Check for spam (same message repeated quickly)
        const now = Date.now();
        if (this.lastMessage === message && now - this.lastMessageTime < 2000) {
            this.showError('Please wait before sending the same message again');
            return false;
        }
        
        this.lastMessage = message;
        this.lastMessageTime = now;
        
        return true;
    }

    /**
     * Show error message
     */
    showError(message) {
        // Could integrate with notification system
        console.warn('Chat error:', message);
    }

    /**
     * Update send button state
     */
    updateSendButton() {
        if (!this.sendButton || !this.inputElement) return;
        
        const hasContent = this.inputElement.value.trim().length > 0;
        this.sendButton.disabled = !hasContent;
        
        if (hasContent) {
            this.sendButton.classList.add('active');
        } else {
            this.sendButton.classList.remove('active');
        }
    }

    /**
     * Message history navigation
     */
    addToHistory(message) {
        this.messageHistory.unshift(message);
        
        // Limit history size
        if (this.messageHistory.length > 50) {
            this.messageHistory.pop();
        }
    }

    navigateHistory(direction) {
        if (this.messageHistory.length === 0) return;
        
        if (direction === 'up') {
            this.historyIndex = Math.min(this.historyIndex + 1, this.messageHistory.length - 1);
        } else {
            this.historyIndex = Math.max(this.historyIndex - 1, -1);
        }
        
        if (this.historyIndex >= 0) {
            this.inputElement.value = this.messageHistory[this.historyIndex];
        } else {
            this.inputElement.value = '';
        }
        
        this.updateSendButton();
    }

    /**
     * Typing indicator handling
     */
    handleTypingIndicator() {
        // Clear existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        // Emit typing start
        this.stateManager.emit('ui:typing-start');
        
        // Set timeout to stop typing
        this.typingTimeout = setTimeout(() => {
            this.clearTypingIndicator();
        }, 3000);
    }

    clearTypingIndicator() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
        
        this.stateManager.emit('ui:typing-stop');
    }

    /**
     * Update player list (for typing indicators)
     */
    updatePlayerList(players) {
        // This could be used to show typing indicators
        // Implementation depends on whether typing indicators are needed
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Clear timeouts
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        // Remove resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Clear state
        this.messageHistory = [];
        this.typingUsers.clear();
        
        console.log('🧹 ChatManager destroyed');
    }
}