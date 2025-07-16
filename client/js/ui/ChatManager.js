/**
 * Chat Manager - Real-time chat interface management
 * Handles message display, formatting, timestamps, scroll management, and input validation
 * FIXED: Fixed TypeError by using correct StateManager methods
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
            debugMode: false
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
        const els = ['chatContainer:.chat-panel', 'messagesContainer:#chat-messages', 
                     'inputElement:#chat-input', 'sendButton:#send-chat', 'toggleButton:#toggle-chat'];
        els.forEach(el => {
            const [prop, selector] = el.split(':');
            this[prop] = document.querySelector(selector);
        });
        
        if (!this.messagesContainer || !this.inputElement) {
            console.error('Required chat elements not found');
        }
    }

    setupEventListeners() {
        const listeners = [
            [this.sendButton, 'click', this.handleSendMessage],
            [this.inputElement, 'keypress', this.handleInputKeyPress],
            [this.inputElement, 'keydown', e => this.handleInputKeyDown(e)],
            [this.inputElement, 'input', () => this.handleInputChange()],
            [this.inputElement, 'focus', () => this.handleInputFocus()],
            [this.inputElement, 'blur', () => this.handleInputBlur()],
            [this.toggleButton, 'click', () => this.handleToggleChat()],
            [this.messagesContainer, 'scroll', this.handleScroll]
        ];
        
        listeners.forEach(([el, event, handler]) => 
            el?.addEventListener(event, handler.bind ? handler.bind(this) : handler));
        
        if (window.ResizeObserver && this.messagesContainer) {
            this.resizeObserver = new ResizeObserver(() => {
                if (this.isScrolledToBottom) this.scrollToBottom(false);
            });
            this.resizeObserver.observe(this.messagesContainer);
        }
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

    handleInputKeyDown(e) {
        const actions = {
            ArrowUp: () => { e.preventDefault(); this.navigateHistory('up'); },
            ArrowDown: () => { e.preventDefault(); this.navigateHistory('down'); },
            Escape: () => this.inputElement.blur()
        };
        actions[e.key]?.();
    }

    handleInputChange() {
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
        
        this.stateManager.addChatMessage({
            id: Date.now() + Math.random(),
            content,
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            timestamp: Date.now(),
            type: 'message'
        });
        
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
        this.messagesContainer.innerHTML = '';
        
        this.groupMessages(messages).forEach(group => 
            this.messagesContainer.appendChild(this.createMessageGroup(group)));
        
        if (wasAtBottom || messages.length === 1) this.scrollToBottom(true);
        
        if (!this.isVisible || !this.isScrolledToBottom) {
            this.updateUnreadCount(this.stateManager.getChatMessages().length);
        }
    }

    groupMessages(messages) {
        const groups = [];
        let currentGroup = null;
        
        messages.forEach(message => {
            const shouldGroup = currentGroup && 
                currentGroup.playerId === message.playerId &&
                currentGroup.type === message.type &&
                (message.timestamp - currentGroup.lastTimestamp) < 60000;
            
            if (shouldGroup) {
                currentGroup.messages.push(message);
                currentGroup.lastTimestamp = message.timestamp;
            } else {
                groups.push(currentGroup = {
                    playerId: message.playerId,
                    playerName: message.playerName,
                    type: message.type,
                    messages: [message],
                    firstTimestamp: message.timestamp,
                    lastTimestamp: message.timestamp
                });
            }
        });
        
        return groups;
    }

    createMessageGroup(group) {
        const div = document.createElement('div');
        div.className = 'message-group';
        
        if (group.type === 'system') div.classList.add('system-group');
        
        const currentPlayerId = this.stateManager.getConnectionState().playerId;
        const isOwnMessage = group.playerId === currentPlayerId;
        if (isOwnMessage) div.classList.add('own-group');
        
        if (group.type !== 'system') {
            div.appendChild(this.createMessageHeader(group, isOwnMessage));
        }
        
        group.messages.forEach((message, index) => 
            div.appendChild(this.createMessageElement(message, index === 0)));
        
        return div;
    }

    createMessageHeader(group, isOwnMessage) {
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const sender = document.createElement('span');
        sender.className = 'message-sender';
        sender.textContent = group.playerName || 'Unknown';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = this.formatTimestamp(group.firstTimestamp);
        
        header.append(...(isOwnMessage ? [time, sender] : [sender, time]));
        return header;
    }

    createMessageElement(message, isFirst) {
        const div = document.createElement('div');
        div.className = 'chat-message';
        div.dataset.messageId = message.id;
        
        if (message.type === 'system') div.classList.add('system');
        
        const currentPlayerId = this.stateManager.getConnectionState().playerId;
        if (message.playerId === currentPlayerId) div.classList.add('own');
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = this.formatMessageContent(message.content);
        div.appendChild(content);
        
        if (!isFirst) {
            const timestamp = document.createElement('div');
            timestamp.className = 'message-timestamp';
            timestamp.textContent = this.formatTimestamp(message.timestamp, true);
            div.appendChild(timestamp);
        }
        
        div.classList.add('animate-message-slide-in');
        return div;
    }

    formatMessageContent(content) {
        if (!content || typeof content !== 'string') {
            if (this.debugMode) console.warn('💬 Invalid message content:', content);
            return '';
        }
        
        return content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
            .replace(/\n/g, '<br>');
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
        
        const { scrollHeight, clientHeight, scrollTop } = this.messagesContainer;
        const targetScroll = scrollHeight - clientHeight;
        
        if (!animate) {
            this.messagesContainer.scrollTop = targetScroll;
            return;
        }
        
        const startTime = performance.now();
        const distance = targetScroll - scrollTop;
        
        const animateScroll = currentTime => {
            const progress = Math.min((currentTime - startTime) / this.scrollAnimationDuration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            this.messagesContainer.scrollTop = scrollTop + distance * easeOut;
            if (progress < 1) requestAnimationFrame(animateScroll);
        };
        
        requestAnimationFrame(animateScroll);
    }

    updateVisibility(visible) {
        this.isVisible = visible;
        if (!this.chatContainer) return;
        
        this.chatContainer.classList.toggle('collapsed', !visible);
        this.messagesContainer.style.display = visible ? 'flex' : 'none';
        this.toggleButton.textContent = visible ? '−' : '+';
        
        if (visible) {
            setTimeout(() => {
                this.inputElement?.focus();
                this.markAsRead();
                this.scrollToBottom(false);
            }, 100);
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
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        if (this.resizeObserver) this.resizeObserver.disconnect();
        this.messageHistory = [];
        this.typingUsers.clear();
        console.log('🧹 ChatManager destroyed');
    }
}