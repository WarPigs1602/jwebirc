/**
 * jwebirc 2.0 - Modern IRC Web Client
 * Main Chat Manager Class
 * @author Andreas Pschorn
 * @license MIT
 */

class ChatManager {
    constructor() {
        // IRC color definitions
        this.colors = [
            'white', 'black', 'navy', 'green', 'red', 'brown',
            'purple', 'olive', 'yellow', 'lightgreen', 'teal',
            'cyan', 'blue', 'pink', 'gray', 'lightgray'
        ];
        
        // State variables
        this.win = document.defaultView;
        this.channels = [];
        this.activeWindow = 'Status';
        this.output = 'Status';
        this.userColor = null;
        this.activeTemplate = null;
        this.socket = null;
        this.login = true;
        this.highlight = false;
        this.keepAliveInterval = null; // Keep-alive timer
        this.keepAliveTimeout = 240000; // Send keep-alive every 4 minutes (240 seconds)
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 8;
        this.reconnectBaseDelay = 1500;
        this.reconnectMaxDelay = 20000;
        this.reconnectInProgress = false;
        this.intentionalDisconnect = false;
        
        // DOM elements
        this.navWindow = null;
        this.navTabs = null;
        this.chatContainer = null;
        this.right = null;
        this.chatWindow = null;
        this.topicWindow = null;
        this.navElement = document.createElement("div");
        this.navElement.className = "nav-tab-strip";
        this.eventBar = null;
        this.eventBarTimeout = null;
        this.typingBar = null;
        this.typingUsers = new Map(); // Map<channel, Map<user, timeout>>
        this.typingTimeout = 5000; // 5 seconds until typing indicator disappears
        this.awayStatus = new Map(); // Map<nick, {away: boolean, reason: string}> - track away status and reason for all nicks
        this.joinedChannels = new Set(); // Set of channels to rejoin on next login
        this.capabilities = {
            requested: [],
            available: [],
            enabled: []
        };
        this.capNegotiationActive = false;

        // Nick color palettes (theme-aware)
        this.lightNickColors = [
            '#7c3aed', '#9333ea', '#a855f7', '#c026d3', '#db2777',
            '#e11d48', '#dc2626', '#ea580c', '#d97706', '#ca8a04',
            '#65a30d', '#16a34a', '#059669', '#0d9488', '#0891b2',
            '#0284c7', '#2563eb', '#4f46e5', '#6366f1', '#7c3aed'
        ];
        this.darkNickColors = [
            '#a78bfa', '#c084fc', '#e879f9', '#f0abfc', '#fb7185',
            '#fda4af', '#fdba74', '#fcd34d', '#fde047', '#bef264',
            '#86efac', '#6ee7b7', '#5eead4', '#7dd3fc', '#93c5fd',
            '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f9a8d4', '#fbcfe8'
        ];

        // UI preferences
        this.uiPrefs = {
            hideTopic: false,
            hideNicklist: false,
            fontSize: 14,
            hue: 0,
            enableSidebar: false
        };
        this.optionsMenu = null;
        this.optionsToggle = null;
        
        // Notification system
        this.unreadCounts = new Map(); // Map<tabName, unreadCount>
        this.highlightedTabs = new Set(); // Set of tabs with incoming messages (visual highlight)
        this.notificationBadge = null;
        this.notificationButton = null;
        
        // Browser notification manager
        this.notificationManager = null;
        
        // Server PREFIX mapping: modes -> symbols (e.g., 'qaohv' -> '~&@%+')
        this.serverPrefixes = {
            modes: 'ov',
            symbols: '@+'
        };
        
        // CAP negotiation timeout handler
        this.capEndTimer = null;

        // i18n helper
        this.t = (key, fallback, replacements) => {
            const format = (text) => {
                if (!text || !replacements) return text;
                return Object.keys(replacements).reduce((acc, rKey) => acc.replace(`{${rKey}}`, replacements[rKey]), text);
            };

            if (typeof window.jwebircTranslate === 'function') {
                const translated = window.jwebircTranslate(key, replacements);
                if (translated && translated !== key) {
                    return translated;
                }
            }
            const base = fallback || key;
            return format(base);
        };

        // React to runtime language switches
        window.addEventListener('jwebirc:languageChanged', () => {
            if (typeof window.jwebircApplyTranslations === 'function') {
                window.jwebircApplyTranslations();
            }
            // Refresh dynamic UI text such as typing bar in current language
            this.updateTypingBar(this.activeWindow);
            // Refresh already-rendered system lines without reload
            this.refreshLogTranslations();
        });
    }

    buildI18nSpan(key, fallback, replacements) {
        const attrs = [
            'data-i18n-log="true"',
            `data-i18n-key="${this.escapeAttr(key)}"`,
        ];

        if (fallback) {
            attrs.push(`data-i18n-fallback="${encodeURIComponent(fallback)}"`);
        }

        if (replacements) {
            try {
                attrs.push(`data-i18n-repl="${encodeURIComponent(JSON.stringify(replacements))}"`);
            } catch (e) {
                // Ignore serialization issues; message will still render in current language
            }
        }

        const translated = this.t(key, fallback, replacements);
        return `<span ${attrs.join(' ')}>${translated}</span>`;
    }

    refreshLogTranslations(root = document) {
        if (!root || typeof window.jwebircTranslate !== 'function') return;

        root.querySelectorAll('[data-i18n-log="true"]').forEach((span) => {
            const key = span.getAttribute('data-i18n-key');
            const fallbackRaw = span.getAttribute('data-i18n-fallback');
            const replRaw = span.getAttribute('data-i18n-repl');

            let replacements = null;
            if (replRaw) {
                try {
                    replacements = JSON.parse(decodeURIComponent(replRaw));
                } catch (e) {
                    // Leave replacements null if parsing fails
                }
            }

            const fallback = fallbackRaw ? decodeURIComponent(fallbackRaw) : key;
            const translated = window.jwebircTranslate(key, replacements);
            span.textContent = translated && translated !== key ? translated : fallback;
        });
    }
    
    /**
     * Requests IRC capabilities
     * Note: Backend initiates CAP LS 302 during connection
     * Client tracks requested capabilities and responds to server's CAP messages
     */
    requestCapabilities() {
        this.capNegotiationActive = false;
        
        // List of desired capabilities
        const desiredCaps = [
            'message-tags',
            'away-notify',
            'batch',
            'server-time'
        ];
        
        this.capabilities.requested = [...desiredCaps];
    }
    
    /**
     * Processes CAP LS response (available capabilities)
     * @param {Array} caps - Array of available capabilities
     */
    handleCapLS(caps) {
        this.capabilities.available = caps;
    }
    
    /**
     * Processes CAP ACK response (confirmed capabilities)
     * @param {Array} caps - Array of activated capabilities
     */
    handleCapACK(caps) {
        // Add confirmed capabilities to the enabled list
        this.capabilities.enabled = [...new Set([...this.capabilities.enabled, ...caps])];
    }
    
    /**
     * Processes CAP NAK response (rejected capabilities)
     * @param {Array} caps - Array of rejected capabilities
     */
    handleCapNAK(caps) {
        // CAP NAK is rendered by IRCParser; keep method for compatibility
        return caps;
    }
    
    /**
     * Ends CAP negotiation
     */
    endCapNegotiation() {
        if (this.capNegotiationActive) {
            // Clear any pending timeout
            if (this.capEndTimer) {
                clearTimeout(this.capEndTimer);
                this.capEndTimer = null;
            }
            
            if (window.postManager) {
                window.postManager.sendRawMessage('/CAP END');
            }
            this.capNegotiationActive = false;
            
            // Show all enabled capabilities once at the end
            if (this.capabilities.enabled.length > 0) {
                const capsEnabled = this.buildI18nSpan('chat.capabilitiesEnabled', 'Capabilities enabled');
                this.parsePage(this.getTimestamp() + " <span style='color: #00aaff'>==</span> " + capsEnabled + ": " + this.capabilities.enabled.join(', ') + "\n");
                this.addWindow();
            }
        }
    }
    
    /**
     * Checks if a capability is enabled
     * @param {string} cap - The capability to check
     * @returns {boolean}
     */
    hasCapability(cap) {
        return this.capabilities.enabled.includes(cap);
    }
    
    /**
     * Parses PREFIX from IRC 005 (ISUPPORT) message
     * Example: PREFIX=(qaohv)~&@%+ -> modes: qaohv, symbols: ~&@%+
     * @param {string} prefixString - The PREFIX value from 005
     */
    parseServerPrefix(prefixString) {
        // Expected format: PREFIX=(modes)symbols
        const match = prefixString.match(/^PREFIX=\(([a-z]+)\)(\S+)/i);
        if (match) {
            const modes = match[1];
            const decodedSymbols = this.decodeNickToken(match[2]);
            const candidateSymbols = decodedSymbols.substring(0, modes.length);
            const knownFallbackSymbols = {
                q: '~',
                a: '&',
                o: '@',
                h: '%',
                v: '+'
            };
            const existingSymbolsByMode = new Map();

            for (let i = 0; i < this.serverPrefixes.modes.length; i++) {
                existingSymbolsByMode.set(this.serverPrefixes.modes[i], this.serverPrefixes.symbols[i]);
            }

            const hasInvalidCandidate = candidateSymbols.length !== modes.length || /[A-Za-z0-9]/.test(candidateSymbols);
            const symbols = hasInvalidCandidate
                ? modes.split('').map((mode, index) => {
                    const candidate = candidateSymbols[index];
                    if (candidate && !/[A-Za-z0-9]/.test(candidate)) {
                        return candidate;
                    }
                    return knownFallbackSymbols[mode] || existingSymbolsByMode.get(mode) || '';
                }).join('')
                : candidateSymbols;

            if (symbols.length !== modes.length || /[A-Za-z0-9]/.test(symbols)) {
                return;
            }

            this.serverPrefixes.modes = modes;
            this.serverPrefixes.symbols = symbols;
        }
    }
    
    /**
     * Gets the symbol for a given mode
     * @param {string} mode - The mode letter (e.g., 'o', 'v')
     * @returns {string} The corresponding symbol (e.g., '@', '+')
     */
    getModeSymbol(mode) {
        const index = this.serverPrefixes.modes.indexOf(mode);
        return index >= 0 ? this.serverPrefixes.symbols[index] : '';
    }
    
    /**
     * Gets the mode for a given symbol
     * @param {string} symbol - The symbol (e.g., '@', '+')
     * @returns {string} The corresponding mode letter (e.g., 'o', 'v')
     */
    getSymbolMode(symbol) {
        const index = this.serverPrefixes.symbols.indexOf(symbol);
        return index >= 0 ? this.serverPrefixes.modes[index] : '';
    }
    
    /**
     * Checks if a character is a status symbol
     * @param {string} char - The character to check
     * @returns {boolean}
     */
    isStatusSymbol(char) {
        return this.serverPrefixes.symbols.includes(char);
    }

    decodeNickToken(value = '') {
        const text = String(value || '');
        if (text.indexOf('&') === -1) {
            return text;
        }

        return text
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'");
    }

    extractNickParts(rawNick = '') {
        let status = '';
        let nick = this.decodeNickToken(rawNick);

        while (nick.length > 0 && this.isStatusSymbol(nick[0])) {
            status += nick[0];
            nick = nick.substring(1);
        }

        return { status, nick };
    }

    normalizeStatusSymbols(status = '') {
        const uniqueSymbols = [];

        for (const symbol of String(status || '')) {
            if (!this.isStatusSymbol(symbol) || uniqueSymbols.includes(symbol)) continue;
            uniqueSymbols.push(symbol);
        }

        uniqueSymbols.sort((left, right) => this.serverPrefixes.symbols.indexOf(left) - this.serverPrefixes.symbols.indexOf(right));
        return uniqueSymbols.join('');
    }

    getStoredStatusSymbols(entry) {
        if (entry && typeof entry === 'object' && typeof entry.statusModes === 'string') {
            return this.normalizeStatusSymbols(entry.statusModes);
        }

        const rawNick = entry && typeof entry === 'object' ? entry.nick : entry;
        return this.normalizeStatusSymbols(this.extractNickParts(rawNick).status);
    }

    getPrimaryStatusSymbol(status = '') {
        let primaryStatus = '';
        let primaryPriority = Number.MAX_SAFE_INTEGER;

        for (const symbol of this.normalizeStatusSymbols(status)) {
            if (!this.isStatusSymbol(symbol)) continue;

            const priority = this.serverPrefixes.symbols.indexOf(symbol);
            if (priority >= 0 && priority < primaryPriority) {
                primaryStatus = symbol;
                primaryPriority = priority;
            }
        }

        return primaryStatus;
    }

    buildNickWithStatus(status = '', nick = '') {
        return `${this.normalizeStatusSymbols(status)}${String(nick || '')}`;
    }
    
    /**
     * Gets a visual emoji/icon for a status symbol
     * @param {string} symbol - The status symbol (e.g., '@', '+')
     * @returns {string} The corresponding emoji/icon
     */
    getStatusEmoji(symbol) {
        const mode = this.getSymbolMode(symbol);
        const emojiMap = {
            'q': '👑', // Owner/Founder - Crown
            'a': '🛡️', // Admin/Protected - Shield
            'o': '⭐', // Operator - Star
            'h': '⚡', // Half-op - Lightning
            'v': '💬'  // Voice - Speech bubble
        };
        return emojiMap[mode] || symbol;
    }
    
    getStatusLabel(symbol) {
        const mode = this.getSymbolMode(symbol);
        const labelMap = {
            'q': this.t('nicklist.role.owner', 'Owner'),
            'a': this.t('nicklist.role.admin', 'Admin'),
            'o': this.t('nicklist.role.op', 'Operator'),
            'h': this.t('nicklist.role.halfop', 'Half-op'),
            'v': this.t('nicklist.role.voice', 'Voice')
        };
        return labelMap[mode] || symbol;
    }
    
    /**
     * Processes typing notification (tagmsg)
     * @param {string} channel - The channel
     * @param {string} user - The user who is typing
     */
    handleTypingNotification(channel, user, state = 'active') {
        
        // Create map for this channel if not present
        if (!this.typingUsers.has(channel)) {
            this.typingUsers.set(channel, new Map());
        }
        
        const channelTyping = this.typingUsers.get(channel); 
        
        if (state === 'active') {
            if (channelTyping.has(user)) {
                clearTimeout(channelTyping.get(user));
            }
            const timeout = setTimeout(() => {
                this.removeTypingUser(channel, user);
            }, this.typingTimeout);
            channelTyping.set(user, timeout);
            this.updateTypingBar(channel);
        } else if (state === 'paused' || state === 'done') {
            this.removeTypingUser(channel, user);
            // Instantly hide typing bar for done/paused without transition
            if (this.typingBar && channel.toLowerCase() === this.activeWindow.toLowerCase()) {
                this.typingBar.classList.add('hide');
                this.typingBar.classList.remove('visible');
                // Remove hide class after a moment to restore transition for next show
                setTimeout(() => {
                    if (this.typingBar) {
                        this.typingBar.classList.remove('hide');
                    }
                }, 50);
            }
        } else {
            this.removeTypingUser(channel, user);
        }
    }
    
    /**
     * Removes a user from the typing list
     * @param {string} channel - The channel
     * @param {string} user - The user
     */
    removeTypingUser(channel, user) {
        if (this.typingUsers.has(channel)) {
            const channelTyping = this.typingUsers.get(channel);
            if (channelTyping.has(user)) {
                clearTimeout(channelTyping.get(user));
                channelTyping.delete(user);
                this.updateTypingBar(channel);
            }
        }
    }
    
    /**
     * Updates the typing bar display
     * @param {string} channel - The channel
     */
    updateTypingBar(channel) {
        // Only for the active channel
        if (channel.toLowerCase() !== this.activeWindow.toLowerCase()) {
            if (this.typingBar) {
                this.typingBar.classList.remove('visible');
            }
            return;
        }
        
        if (!this.typingBar) {
            this.typingBar = document.getElementById('typingBar');
        }
        
        if (!this.typingBar) return;
        
        const channelTyping = this.typingUsers.get(channel);
        if (!channelTyping || channelTyping.size === 0) {
            this.typingBar.classList.remove('visible');
            return;
        }
        
        const typingUsersList = Array.from(channelTyping.keys());
        const typingText = document.getElementById('typingText');
        
        if (typingText) {
            let text = '';
            if (typingUsersList.length === 1) {
                text = this.t('chat.typing.one', `${typingUsersList[0]} is typing`, { user: typingUsersList[0] });
            } else if (typingUsersList.length === 2) {
                text = this.t(
                    'chat.typing.two',
                    `${typingUsersList[0]} and ${typingUsersList[1]} are typing`,
                    { user1: typingUsersList[0], user2: typingUsersList[1] }
                );
            } else if (typingUsersList.length === 3) {
                text = this.t(
                    'chat.typing.three',
                    `${typingUsersList[0]}, ${typingUsersList[1]} and ${typingUsersList[2]} are typing`,
                    { user1: typingUsersList[0], user2: typingUsersList[1], user3: typingUsersList[2] }
                );
            } else {
                text = this.t('chat.typing.many', `${typingUsersList.length} users are typing`, { count: typingUsersList.length });
            }
            typingText.textContent = text;
        }
        
        this.typingBar.classList.add('visible');
    }
    
    /**
     * Clears all typing indicators for a channel
     * @param {string} channel - The channel
     */
    clearTypingForChannel(channel) {
        if (this.typingUsers.has(channel)) {
            const channelTyping = this.typingUsers.get(channel);
            channelTyping.forEach(timeout => clearTimeout(timeout));
            channelTyping.clear();
            this.updateTypingBar(channel);
        }
    }
    
    initialize() {
        // Get DOM elements
        this.navWindow = document.getElementById("nav_window");
        this.navTabs = document.getElementById("nav_tabs");
        this.chatContainer = document.querySelector(".chat-container");
        this.right = document.getElementById("right");
        this.chatWindow = document.getElementById("chat_window");
        this.topicWindow = document.getElementById("topic_window");
        this.eventBar = document.getElementById("eventBar");
        this.typingBar = document.getElementById("typingBar");
        this.optionsMenu = document.getElementById("navOptionsMenu");
        this.optionsToggle = document.getElementById("navOptionsToggle");
        
        // Notification system
        this.notificationBadge = document.getElementById("notificationBadge");
        this.notificationButton = document.getElementById("navNotifications");
        
        // Initialize browser notification manager
        this.notificationManager = new NotificationManager(this);

        // Restore and apply UI preferences
        this.loadUiPreferences();
        this.bindUiControls();
        this.applyLayoutPreferences();

        // Track current template for color recalculation
        this.activeTemplate = this.detectActiveTemplate();
        document.addEventListener('templateChanged', (event) => {
            this.activeTemplate = (event && event.detail && event.detail.template) ? event.detail.template : this.detectActiveTemplate();
            this.reapplyNickColorsForTheme();
        });
        
        // Setup notification button
        if (this.notificationButton) {
            this.notificationButton.addEventListener('click', () => this.toggleNotifications());
        }
        
        // Initialize WebSocket
        this.connectWebSocket();
        this.initializePages();
        this.setupUnloadDisconnect();
        this.initNickContextMenu(); // Initialize context menu once
        
        // Add click handler to focus on message input when user clicks on chat window
        if (this.chatWindow) {
            this.chatWindow.addEventListener('click', () => {
                if (window.postManager && window.postManager.messageInput) {
                    window.postManager.messageInput.focus();
                }
            });
        }
    }

    connectWebSocket() {
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = new URL('Webchat', window.location.href);
        wsUrl.protocol = wsProtocol;

        this.socket = new WebSocket(wsUrl.toString());
        this.setupWebSocket();
    }
    
    setupWebSocket() {
        this.socket.onopen = (event) => {
            this.intentionalDisconnect = false;
            // Request IRCv3 capabilities
            this.requestCapabilities();
            // Start keep-alive mechanism
            this.startKeepAlive();

            const wasReconnect = this.reconnectInProgress || this.reconnectAttempts > 0;
            this.reconnectInProgress = false;
            this.reconnectAttempts = 0;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

            if (wasReconnect) {
                const reconnected = this.buildI18nSpan('chat.reconnected', 'Reconnected. Restoring previous channels...');
                this.parsePage(this.getTimestamp() + " <span style='color: #00aa00'>==</span> " + reconnected + "\n");
                this.addWindow();
                setTimeout(() => this.rejoinSavedChannels(), 1500);
            }
        };
        
        this.socket.onerror = (errorEvent) => {
            console.error('[WebSocket] Error:', errorEvent);
            const errorMsg = errorEvent.message || errorEvent.type || 'Unknown WebSocket error';
            const connError = this.buildI18nSpan('chat.connectionError', 'Connection error');
            this.parsePage(this.getTimestamp() + " <span style='color: #ff0000'>==</span> " + connError + ": " + errorMsg + "\n");
            this.addWindow();
            this.scrollToEnd("#chat_window", 100);
        };
        
        this.socket.onclose = (closeEvent) => {
            // Stop keep-alive
            this.stopKeepAlive();

            if (this.intentionalDisconnect) {
                return;
            }
            
            // Hide loading screen on disconnect
            if (window.ircParser && window.ircParser.hideLoadingScreen) {
                try {
                    window.ircParser.hideLoadingScreen();
                } catch (e) {
                    console.warn('[WebSocket] Error hiding loading screen:', e);
                }
            }
            
            let closeMsg = this.buildI18nSpan('chat.connectionClosed', 'Connection to server closed');
            if (closeEvent.code) {
                closeMsg += " (Code: " + closeEvent.code + ")";
            }
            if (closeEvent.reason) {
                closeMsg += " - " + closeEvent.reason;
            }
            // Provide more helpful messages based on close code
            if (closeEvent.code === 1006) {
                closeMsg += " - Abnormal connection closure. Check server connectivity.";
            } else if (closeEvent.code === 1002) {
                closeMsg += " - Protocol error";
            } else if (closeEvent.code === 1003) {
                closeMsg += " - Unsupported data";
            }
            
            this.parsePage(this.getTimestamp() + " <span style='color: #ff0000'>==</span> " + closeMsg + "\n");
            this.addWindow();
            this.scrollToEnd("#chat_window", 100);
            
            // Attempt automatic reconnection on unexpected disconnects.
            if (!closeEvent.wasClean && closeEvent.code !== 1000) {
                this.scheduleReconnect();
            }
        };
        
        this.socket.onmessage = (messageEvent) => {
            try {
                const msg = JSON.parse(messageEvent.data);
                const { message, category, target } = msg;
                
                if (category === "error") {
                    console.error('[WebSocket] Server error:', message);
                    const connErr = this.buildI18nSpan('chat.connectionError', 'Error');
                    this.parsePage(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> " + connErr + ": " + message + "\n");
                    this.addWindow();
                } else if (category === "chat") {
                    if (message !== "Ping? Pong!") {
                        // Filter out PING/PONG messages (keep-alive) - process silently
                        if (this.isKeepAliveMessage(message)) {
                            this.handleKeepAliveMessage(message);
                            return; // Don't display to user
                        }
                        
                        if (window.ircParser) {
                            // If target is "active", force output to active window
                            if (target === "active") {
                                const activeWindow = this.getActiveWindow();
                                if (activeWindow) {
                                    window.ircParser.output = activeWindow;
                                }
                            }
                            window.ircParser.parseOutput(message);
                        } else {
                            console.warn('[WebSocket] IRC Parser not initialized, displaying raw message');
                            this.parsePage(this.getTimestamp() + " " + message + "\n");
                        }
                        this.addWindow();
                    }
                } else {
                    console.warn('[WebSocket] Unknown category:', category);
                    const unknownCat = this.buildI18nSpan('chat.unknownCategory', 'Unknown category');
                    this.parsePage(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> " + unknownCat + ": " + category + "\n");
                    this.addWindow();
                }
            } catch (error) {
                console.error('[WebSocket] Error parsing message:', error, messageEvent.data);
                const parseErr = this.buildI18nSpan('chat.errorParsing', 'Error parsing server message');
                this.parsePage(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> " + parseErr + ": " + error.message + "\n");
                this.addWindow();
            }
        };
    }

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            const reconnectFailed = this.buildI18nSpan('chat.reconnectFailed', 'Automatic reconnect failed. Please reload the page.');
            this.parsePage(this.getTimestamp() + " <span style='color: #ff0000'>==</span> " + reconnectFailed + "\n");
            this.addWindow();
            return;
        }

        this.reconnectInProgress = true;
        this.reconnectAttempts += 1;

        const expDelay = this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1);
        const delay = Math.min(expDelay, this.reconnectMaxDelay);
        const reconnectMsg = this.buildI18nSpan(
            'chat.reconnecting',
            'Connection lost. Reconnect attempt {attempt}/{max} in {seconds}s...',
            {
                attempt: this.reconnectAttempts,
                max: this.maxReconnectAttempts,
                seconds: Math.round(delay / 1000)
            }
        );

        this.parsePage(this.getTimestamp() + " <span style='color: #ffaa00'>==</span> " + reconnectMsg + "\n");
        this.addWindow();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectTimer = setTimeout(() => {
            try {
                this.connectWebSocket();
            } catch (error) {
                console.error('[WebSocket] Reconnect attempt failed:', error);
                this.scheduleReconnect();
            }
        }, delay);
    }
    
    /**
     * Start keep-alive mechanism to prevent WebSocket idle timeout
     */
    startKeepAlive() {
        // Clear any existing interval
        this.stopKeepAlive();
        
        // Send a ping message every 4 minutes to keep connection alive
        this.keepAliveInterval = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                try {
                    // Send a PING command to the IRC server through WebSocket
                    if (window.postManager) {
                        window.postManager.sendRawMessage('/PING :keepalive');
                    }
                } catch (e) {
                    console.error('[WebSocket] Error sending keep-alive:', e);
                }
            }
        }, this.keepAliveTimeout);
    }
    
    /**
     * Stop keep-alive mechanism
     */
    stopKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }

    setupUnloadDisconnect() {
        const closeConnection = () => {
            this.gracefulDisconnect('Client closed');
        };

        window.addEventListener('beforeunload', closeConnection);
        window.addEventListener('pagehide', closeConnection);
    }

    gracefulDisconnect(reason = 'Client closed') {
        if (this.intentionalDisconnect) {
            return;
        }

        this.intentionalDisconnect = true;
        this.reconnectInProgress = false;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.stopKeepAlive();

        if (!this.socket) {
            return;
        }

        try {
            if (this.socket.readyState === WebSocket.OPEN && window.postManager) {
                window.postManager.sendRawMessage('/QUIT :' + reason);
            }
        } catch (e) {
            console.warn('[WebSocket] Error sending QUIT during disconnect:', e);
        }

        try {
            if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
                this.socket.close(1000, reason);
            }
        } catch (e) {
            console.warn('[WebSocket] Error closing socket during disconnect:', e);
        }
    }
    
    /**
     * Check if a message is a PING or PONG keep-alive message
     * @param {string} message - The IRC message
     * @returns {boolean} True if it's a keep-alive message
     */
    isKeepAliveMessage(message) {
        const withoutTags = this.stripMessageTags(message);
        if (!withoutTags) return false;

        // Check for PING/PONG commands at start (with optional prefix, optional payload)
        if (/^(:\S+\s+)?PING(?:\s+.*)?$/i.test(withoutTags)) {
            return true;
        }
        if (/^(:\S+\s+)?PONG(?:\s+.*)?$/i.test(withoutTags)) {
            return true;
        }
        return false;
    }
    
    /**
     * Handle keep-alive messages (PING/PONG) silently
     * Responds to PING with PONG in the same format as received
     * @param {string} message - The IRC message
     */
    handleKeepAliveMessage(message) {
        const withoutTags = this.stripMessageTags(message);
        if (!withoutTags) return;

        // PING handling - capture everything after the PING command and echo it back in PONG
        const pingMatch = withoutTags.match(/^(:\S+\s+)?PING(?:\s+(.*))?$/i);
        if (pingMatch) {
            const payload = (pingMatch[2] || '').trim();
            if (window.postManager) {
                try {
                    // Echo payload as-is to honor IRC PING/PONG rules (preserve colon/trailing)
                    if (payload) {
                        window.postManager.sendRawMessage('/PONG ' + payload);
                    } else {
                        window.postManager.sendRawMessage('/PONG');
                    }
                } catch (e) {
                    console.error('[IRC Keep-Alive] Error sending PONG:', e);
                }
            }
            return;
        }

        // PONG handling - informational only
        const pongMatch = withoutTags.match(/^(:\S+\s+)?PONG(?:\s+(.*))?$/i);
        if (pongMatch) {
        }
    }

    /**
     * Strip IRCv3 message tags (start with @) and return the remaining message.
     * @param {string} message - The raw IRC message
     * @returns {string} Message without tags
     */
    stripMessageTags(message) {
        const trimmed = (message || '').trim();
        if (!trimmed) return '';
        if (!trimmed.startsWith('@')) return trimmed;

        const spaceIdx = trimmed.indexOf(' ');
        if (spaceIdx === -1) {
            return trimmed;
        }

        return trimmed.slice(spaceIdx + 1).trimStart();
    }
    
    initializePages() {
        this.navElement.innerHTML = '';
        window.onbeforeunload = () => "WarnOnClose";
        
        this.addPage('Status', 'status', true);
        this.parsePage(this.getTimestamp() + " jwebirc 2.0\n");
        this.parsePage(this.getTimestamp() + " &copy; 2024-2026 by Andreas Pschorn\n");
        this.parsePage(this.getTimestamp() + " <a href=\"https://github.com/WarPigs1602/jwebirc\" target=\"_blank\">https://github.com/WarPigs1602/jwebirc</a>\n");
        const mitLicense = this.buildI18nSpan('chat.license', 'Licensed under the MIT License');
        this.parsePage(this.getTimestamp() + " " + mitLicense + "\n");
        const connecting = this.buildI18nSpan('chat.connecting', 'Connecting to server, please wait...');
        this.parsePage(this.getTimestamp() + " <span style=\"color: #ffaa00\">==</span> " + connecting + "\n");
        
        // Load saved channels for rejoin
        this.loadSavedChannels();
    }
    
    saveChannelList() {
        // Save the list of channels to localStorage for persistent storage
        try {
            const channelList = Array.from(this.joinedChannels);
            localStorage.setItem('jwebirc_channels', JSON.stringify(channelList));
        } catch (e) {
            console.error('Could not save channels to localStorage:', e);
        }
    }
    
    loadSavedChannels() {
        // Load saved channels from localStorage (persistent storage)
        try {
            const saved = localStorage.getItem('jwebirc_channels');
            if (saved) {
                const parsed = JSON.parse(saved);
                const normalized = Array.isArray(parsed)
                    ? parsed
                        .map(ch => (typeof ch === 'string' ? ch.trim() : ''))
                        .filter(Boolean)
                        .map(ch => (this.isChannel(ch) ? ch.toLowerCase() : `#${ch.toLowerCase()}`))
                    : [];
                this.joinedChannels = new Set(normalized);
                // Persist normalized values back to storage to keep format consistent
                this.saveChannelList();
            } else {
            }
        } catch (e) {
            console.error('Could not load saved channels:', e);
        }
    }

    loadUiPreferences() {
        try {
            const saved = localStorage.getItem('jwebirc_ui');
            const hasSavedPreferences = !!saved;
            if (saved) {
                const parsed = JSON.parse(saved);
                this.uiPrefs = {
                    ...this.uiPrefs,
                    ...parsed
                };
            }

            if (!hasSavedPreferences) {
                const params = new URLSearchParams(window.location.search);
                const hasNicklistOverride = params.has('hidenicklist');
                if (!hasNicklistOverride && window.matchMedia('(max-width: 1024px)').matches) {
                    this.uiPrefs.hideNicklist = true;
                }
            }
        } catch (e) {
            console.warn('Could not load UI preferences:', e);
        }
        
        // Load URL parameters (overrides saved preferences)
        this.loadUrlParameters();
        
        return this.uiPrefs;
    }
    
    loadUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        
        // Map URL parameters to uiPrefs
        const paramMap = {
            'hidetopic': 'hideTopic',
            'hidenicklist': 'hideNicklist',
            'fontsize': 'fontSize',
            'hue': 'hue',
            'enablesidebar': 'enableSidebar'
        };
        
        for (const [urlParam, prefKey] of Object.entries(paramMap)) {
            if (params.has(urlParam)) {
                const value = params.get(urlParam);
                
                // Parse boolean parameters
                if (['hidetopic', 'hidenicklist', 'enablesidebar'].includes(urlParam)) {
                    this.uiPrefs[prefKey] = value === 'true' || value === '1' || value === 'yes';
                } else if (['fontsize', 'hue'].includes(urlParam)) {
                    // Parse numeric parameters
                    const num = parseInt(value, 10);
                    if (!isNaN(num)) {
                        this.uiPrefs[prefKey] = num;
                    }
                }
            }
        }
    }

    saveUiPreferences() {
        try {
            localStorage.setItem('jwebirc_ui', JSON.stringify(this.uiPrefs));
        } catch (e) {
            console.warn('Could not save UI preferences:', e);
        }
    }

    bindUiControls() {
        const hideTopicToggle = document.getElementById('optHideTopic');
        const hideNicklistToggle = document.getElementById('optHideNicklist');
        const fontSizeControl = document.getElementById('optFontSize');
        const fontSizeValue = document.getElementById('fontSizeValue');
        const menu = this.optionsMenu;
        const toggle = this.optionsToggle;
        const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;

        if (hideTopicToggle) {
            hideTopicToggle.checked = this.uiPrefs.hideTopic;
            hideTopicToggle.addEventListener('change', () => {
                this.uiPrefs.hideTopic = hideTopicToggle.checked;
                this.applyLayoutPreferences();
            });
        }

        if (hideNicklistToggle) {
            hideNicklistToggle.checked = this.uiPrefs.hideNicklist;
            hideNicklistToggle.addEventListener('change', () => {
                this.uiPrefs.hideNicklist = hideNicklistToggle.checked;
                this.applyLayoutPreferences();
            });
        }

        if (fontSizeControl) {
            fontSizeControl.value = this.uiPrefs.fontSize;
            fontSizeControl.addEventListener('input', () => {
                const parsed = parseInt(fontSizeControl.value, 10);
                this.uiPrefs.fontSize = isNaN(parsed) ? 14 : parsed;
                this.applyLayoutPreferences();
            });
        }

        if (fontSizeValue) {
            fontSizeValue.textContent = `${this.uiPrefs.fontSize}px`;
        }

        const hueControl = document.getElementById('optHue');
        const hueValue = document.getElementById('hueValue');

        if (hueControl) {
            hueControl.value = this.uiPrefs.hue;
            hueControl.addEventListener('input', () => {
                const parsed = parseInt(hueControl.value, 10);
                this.uiPrefs.hue = isNaN(parsed) ? 0 : parsed;
                if (hueValue) {
                    hueValue.textContent = `${this.uiPrefs.hue}°`;
                }
                this.applyLayoutPreferences();
            });
            if (hueValue) {
                hueValue.textContent = `${this.uiPrefs.hue}°`;
            }
        }

        const sidebarToggle = document.getElementById('optEnableSidebar');
        if (sidebarToggle) {
            sidebarToggle.checked = this.uiPrefs.enableSidebar;
            sidebarToggle.addEventListener('change', () => {
                this.uiPrefs.enableSidebar = sidebarToggle.checked;
                this.applyLayoutPreferences();
            });
        }

        if (toggle && menu) {
            const closeMenu = () => {
                menu.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
                window.jwebircResetNavDropdown(menu);
            };

            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !menu.classList.contains('open');
                menu.classList.toggle('open', willOpen);
                toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                if (willOpen) {
                    window.jwebircPositionNavDropdown(toggle, menu);
                } else {
                    window.jwebircResetNavDropdown(menu);
                }
            });

            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && !toggle.contains(e.target)) {
                    closeMenu();
                }
            });

            // Close on Escape for accessibility
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeMenu();
                }
            });
        }
        
        // Browser notification controls
        const notificationToggle = document.getElementById('optNotifications');
        const notificationSoundToggle = document.getElementById('optNotificationSound');
        
        if (notificationToggle && this.notificationManager) {
            // Load saved notification preferences from login page
            const savedPrefs = this.loadUiPreferences() || {};
            
            notificationToggle.addEventListener('change', async () => {
                if (notificationToggle.checked) {
                    const enabled = await this.notificationManager.enable();
                    if (!enabled) {
                        notificationToggle.checked = false;
                        this.showEventBar(this.t('chat.notificationsDenied', 'Browser notifications were denied'), 'error');
                    } else {
                        this.showEventBar(this.t('chat.notificationsEnabled', 'Browser notifications enabled'), 'success');
                        this.saveUiPreference('notificationsEnabled', true);
                    }
                } else {
                    this.notificationManager.disable();
                    this.showEventBar(this.t('chat.notificationsDisabled', 'Browser notifications disabled'), 'info');
                    this.saveUiPreference('notificationsEnabled', false);
                }
            });
            
            // Apply saved preference or default (non-blocking)
            const notificationsEnabled = savedPrefs.notificationsEnabled !== false; // default true
            if (notificationsEnabled) {
                // Automatically enable notifications on first load
                if (this.notificationManager.getPermission() === 'granted') {
                    notificationToggle.checked = true;
                    this.notificationManager.enabled = true;
                } else if (this.notificationManager.getPermission() === 'default') {
                    // Request permission automatically (non-blocking)
                    this.notificationManager.enable().then(enabled => {
                        notificationToggle.checked = enabled;
                    });
                }
            } else {
                notificationToggle.checked = false;
                this.notificationManager.enabled = false;
            }
        }
        
        if (notificationSoundToggle && this.notificationManager) {
            // Load saved sound preference from login page
            const savedPrefs = this.loadUiPreferences() || {};
            const soundEnabled = savedPrefs.notificationSound !== false; // default true
            
            this.notificationManager.soundEnabled = soundEnabled;
            notificationSoundToggle.checked = soundEnabled;
            
            notificationSoundToggle.addEventListener('change', () => {
                this.notificationManager.toggleSound(notificationSoundToggle.checked);
                this.saveUiPreference('notificationSound', notificationSoundToggle.checked);
            });
        }
    }

    applyLayoutPreferences() {
        const container = this.chatContainer;
        const showTopic = !this.uiPrefs.hideTopic;
        const showNicklist = !this.uiPrefs.hideNicklist;
        const isPhoneViewport = window.matchMedia('(max-width: 480px)').matches;
        const isCompactViewport = window.matchMedia('(max-width: 600px)').matches;
        const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
        const fontSize = Math.min(Math.max(this.uiPrefs.fontSize, 12), 18);

        if (container) {
            // Toggle helper classes
            container.classList.toggle('hide-topic', !showTopic);
            container.classList.toggle('hide-nicklist', !showNicklist);

            // Adjust grid layout based on active view
            const mobileNicklistWidth = isCompactViewport
                ? 'clamp(92px, 28vw, 132px)'
                : 'clamp(108px, 30vw, 180px)';
            const mobileRowsWithTopic = isPhoneViewport ? '26px 22px 1fr 50px' : '32px 28px 1fr 56px';
            const mobileRowsWithoutTopic = isPhoneViewport ? '26px 1fr 50px' : '32px 1fr 56px';

            if (!this.uiPrefs.enableSidebar || isMobileViewport) {
                const currentChannel = this.channels.find(ch => ch.page === this.activeWindow);
                const isStatusOrQuery = currentChannel && (currentChannel.type === 'status' || currentChannel.type === 'query');

                if (isStatusOrQuery) {
                    container.style.gridTemplateColumns = '1fr';
                    container.style.gridTemplateRows = isMobileViewport ? mobileRowsWithoutTopic : '36px 1fr 60px';
                    container.style.gridTemplateAreas = '"nav" "chat" "input"';
                } else if (showTopic && showNicklist) {
                    container.style.gridTemplateColumns = isMobileViewport ? `minmax(0, 1fr) ${mobileNicklistWidth}` : '1fr 220px';
                    container.style.gridTemplateRows = isMobileViewport ? mobileRowsWithTopic : '36px auto 1fr 60px';
                    container.style.gridTemplateAreas = '"nav nav" "topic topic" "chat users" "input input"';
                } else if (!showTopic && showNicklist) {
                    container.style.gridTemplateColumns = isMobileViewport ? `minmax(0, 1fr) ${mobileNicklistWidth}` : '1fr 220px';
                    container.style.gridTemplateRows = isMobileViewport ? mobileRowsWithoutTopic : '36px 1fr 60px';
                    container.style.gridTemplateAreas = '"nav nav" "chat users" "input input"';
                } else if (showTopic && !showNicklist) {
                    container.style.gridTemplateColumns = '1fr';
                    container.style.gridTemplateRows = isMobileViewport ? mobileRowsWithTopic : '36px auto 1fr 60px';
                    container.style.gridTemplateAreas = '"nav" "topic" "chat" "input"';
                } else {
                    container.style.gridTemplateColumns = '1fr';
                    container.style.gridTemplateRows = isMobileViewport ? mobileRowsWithoutTopic : '36px 1fr 60px';
                    container.style.gridTemplateAreas = '"nav" "chat" "input"';
                }
            } else {
                container.style.gridTemplateColumns = '';
                container.style.gridTemplateRows = '';
                container.style.gridTemplateAreas = '';
            }
        }

        // Toggle element visibility
        if (this.topicWindow) {
            // Hide topic for Status and Query windows
            const currentChannel = this.channels.find(ch => ch.page === this.activeWindow);
            const hideTopicForWindow = currentChannel && (currentChannel.type === 'status' || currentChannel.type === 'query');
            const topicHidden = (showTopic && !hideTopicForWindow) ? '' : 'none';
            this.topicWindow.style.display = topicHidden;
            if (this.chatContainer) {
                this.chatContainer.classList.toggle('hide-topic', topicHidden === 'none');
            }
        }
        if (this.right) {
            // Hide nicklist for Status and Query windows
            const currentChannel = this.channels.find(ch => ch.page === this.activeWindow);
            const hideNicklistForWindow = currentChannel && (currentChannel.type === 'status' || currentChannel.type === 'query');
            const nicklistHidden = (showNicklist && !hideNicklistForWindow) ? '' : 'none';
            this.right.style.display = nicklistHidden;
            if (this.chatContainer) {
                this.chatContainer.classList.toggle('hide-nicklist', nicklistHidden === 'none');
            }
        }

        // Apply font size to CSS variable
        document.documentElement.style.setProperty('--font-size-base', fontSize + 'px');
        const fontSizeValue = document.getElementById('fontSizeValue');
        if (fontSizeValue) {
            fontSizeValue.textContent = `${fontSize}px`;
        }
        const fontSizeControl = document.getElementById('optFontSize');
        if (fontSizeControl) {
            fontSizeControl.value = fontSize;
        }

        // Apply hue filter
        const hue = this.uiPrefs.hue || 0;
        document.documentElement.style.setProperty('--hue-rotate', hue + 'deg');

        // Sidebar mode
        if (this.uiPrefs.enableSidebar && !isMobileViewport) {
            this.enableSidebarMode();
        } else {
            this.disableSidebarMode();
        }

        this.saveUiPreferences();
    }

    enableSidebarMode() {
        const container = this.chatContainer;
        const sidebar = document.getElementById('sidebar_window');
        const topFrame = document.getElementById('nav_window');
        if (!container || !sidebar || !topFrame) return;

        container.classList.add('sidebar-mode');

        const brand = topFrame.querySelector('.nav-brand');
        const tabsWrapper = topFrame.querySelector('.nav-tabs-wrapper');
        const actions = topFrame.querySelector('.nav-actions');
        const sidebarBrand = sidebar.querySelector('.sidebar-brand');
        const sidebarTabs = sidebar.querySelector('.sidebar-tabs');
        const sidebarActions = sidebar.querySelector('.sidebar-actions');

        if (brand && sidebarBrand) sidebarBrand.appendChild(brand);
        if (tabsWrapper && sidebarTabs) sidebarTabs.appendChild(tabsWrapper);
        if (actions && sidebarActions) sidebarActions.appendChild(actions);
    }

    disableSidebarMode() {
        const container = this.chatContainer;
        const sidebar = document.getElementById('sidebar_window');
        const topFrame = document.getElementById('nav_window');
        if (!container || !sidebar || !topFrame) return;

        container.classList.remove('sidebar-mode');

        const brand = sidebar.querySelector('.nav-brand');
        const tabsWrapper = sidebar.querySelector('.nav-tabs-wrapper');
        const actions = sidebar.querySelector('.nav-actions');
        const navContainer = topFrame.querySelector('.nav-container');

        if (brand && navContainer) navContainer.insertBefore(brand, navContainer.firstChild);
        if (tabsWrapper && navContainer) {
            const existingTabs = navContainer.querySelector('.nav-tabs-wrapper');
            if (existingTabs) navContainer.replaceChild(tabsWrapper, existingTabs);
            else navContainer.appendChild(tabsWrapper);
        }
        if (actions && navContainer) navContainer.appendChild(actions);
    }
    
    addToChannelMemory(channel) {
        // Persist channel so it can be rejoined after reconnect/browser restart
        const normalized = this.isChannel(channel) ? channel.toLowerCase() : `#${channel.toLowerCase()}`;
        this.joinedChannels.add(normalized);
        this.saveChannelList();
    }
    
    removeFromChannelMemory(channel) {
        // Remove channel from memory
        const normalized = this.isChannel(channel) ? channel.toLowerCase() : `#${channel.toLowerCase()}`;
        this.joinedChannels.delete(normalized);
        this.saveChannelList();
    }
    
    rejoinSavedChannels() {
        // Rejoin all saved channels
        if (this.joinedChannels.size > 0 && window.postManager) {
            for (const channel of this.joinedChannels) {
                window.postManager.submitTextMessage("/join " + channel);
            }
        }
    }
    
    parseControl(text, options = {}) {
        // State-based parser for proper IRC formatting
        const result = [];
        let pos = 0;
        
        // Active formatting state
        const state = {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            monospace: false,
            reverse: false,
            color: null,
            bgcolor: null
        };
        
        const openTags = [];
        
        const applyState = () => {
            // Close all open tags
            while (openTags.length > 0) {
                result.push('</span>');
                openTags.pop();
            }
            
            // Apply current state
            const styles = [];
            if (state.bold) styles.push('font-weight: bold');
            if (state.italic) styles.push('font-style: italic');
            if (state.underline && state.strikethrough) {
                styles.push('text-decoration: underline line-through');
            } else if (state.underline) {
                styles.push('text-decoration: underline');
            } else if (state.strikethrough) {
                styles.push('text-decoration: line-through');
            }
            if (state.monospace) styles.push('font-family: monospace');
            if (state.reverse) {
                if (state.bgcolor) styles.push(`color: ${state.bgcolor}`);
                if (state.color) styles.push(`background-color: ${state.color}`);
                // Fallback when no explicit colors are active.
                if (!state.color && !state.bgcolor) styles.push('filter: invert(1)');
            } else {
                if (state.color) styles.push(`color: ${state.color}`);
                if (state.bgcolor) styles.push(`background-color: ${state.bgcolor}`);
            }
            
            if (styles.length > 0) {
                result.push(`<span style="${styles.join('; ')};">`);
                openTags.push(true);
            }
        };
        
        while (pos < text.length) {
            const char = text.charCodeAt(pos);
            
            switch (char) {
                case 0x02: // Bold
                    state.bold = !state.bold;
                    applyState();
                    pos++;
                    break;
                    
                case 0x1D: // Italic
                    state.italic = !state.italic;
                    applyState();
                    pos++;
                    break;
                    
                case 0x1F: // Underline
                    state.underline = !state.underline;
                    applyState();
                    pos++;
                    break;
                    
                case 0x1E: // Strikethrough
                    state.strikethrough = !state.strikethrough;
                    applyState();
                    pos++;
                    break;
                    
                case 0x11: // Monospace
                    state.monospace = !state.monospace;
                    applyState();
                    pos++;
                    break;
                    
                case 0x16: // Reverse
                    state.reverse = !state.reverse;
                    applyState();
                    pos++;
                    break;
                    
                case 0x0F: // Reset all formatting
                    state.bold = false;
                    state.italic = false;
                    state.underline = false;
                    state.strikethrough = false;
                    state.monospace = false;
                    state.reverse = false;
                    state.color = null;
                    state.bgcolor = null;
                    applyState();
                    pos++;
                    break;
                    
                case 0x03: // Color
                    pos++;
                    let colorStr = '';
                    // Read foreground color (max 2 digits)
                    while (pos < text.length && text[pos] >= '0' && text[pos] <= '9' && colorStr.length < 2) {
                        colorStr += text[pos];
                        pos++;
                    }
                    
                    if (colorStr.length > 0) {
                        const colorIndex = parseInt(colorStr);
                        state.color = (colorIndex >= 0 && colorIndex < this.colors.length)
                            ? this.colors[colorIndex]
                            : null;
                        
                        // Check for background color
                        if (pos < text.length && text[pos] === ',') {
                            pos++;
                            let bgColorStr = '';
                            while (pos < text.length && text[pos] >= '0' && text[pos] <= '9' && bgColorStr.length < 2) {
                                bgColorStr += text[pos];
                                pos++;
                            }
                            if (bgColorStr.length > 0) {
                                const bgColorIndex = parseInt(bgColorStr);
                                state.bgcolor = (bgColorIndex >= 0 && bgColorIndex < this.colors.length)
                                    ? this.colors[bgColorIndex]
                                    : null;
                            } else {
                                state.bgcolor = null;
                            }
                        } else {
                            // \x03NN sets foreground only and clears previous background.
                            state.bgcolor = null;
                        }
                        applyState();
                    } else {
                        // Color reset (no digits after \x03)
                        state.color = null;
                        state.bgcolor = null;
                        applyState();
                    }
                    break;
                    
                default:
                    // Regular character
                    const nextSpecial = this.findNextControlCode(text, pos);
                    const chunk = text.substring(pos, nextSpecial);
                    result.push(this.escapeHtml(chunk));
                    pos = nextSpecial;
                    break;
            }
        }
        
        // Close remaining tags
        while (openTags.length > 0) {
            result.push('</span>');
            openTags.pop();
        }
        
        // Return result and trim according to caller options.
        const output = result.join('');
        // Allow callers (e.g. input preview) to preserve trailing whitespace for accurate cursor position
        return options && options.trim === false ? output : output.trim();
    }
    
    findNextControlCode(text, start) {
        const controlCodes = [0x02, 0x03, 0x0F, 0x11, 0x16, 0x1D, 0x1E, 0x1F];
        let nearest = text.length;
        
        for (const code of controlCodes) {
            const pos = text.indexOf(String.fromCharCode(code), start);
            if (pos !== -1 && pos < nearest) {
                nearest = pos;
            }
        }
        
        return nearest;
    }
    
    /**
     * Extract the current control-code formatting state from text.
     * @param {string} text - The text to parse for formatting state.
     * @param {object} previousState - The prior state to update while parsing.
     * @returns {object} State object with the active formatting flags.
     */
    extractControlCodeState(text, previousState = null) {
        const state = previousState ? { ...previousState } : {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            monospace: false,
            reverse: false,
            color: null,
            bgcolor: null
        };
        
        let pos = 0;
        while (pos < text.length) {
            const char = text.charCodeAt(pos);
            
            switch (char) {
                case 0x02: // Bold
                    state.bold = !state.bold;
                    pos++;
                    break;
                    
                case 0x1D: // Italic
                    state.italic = !state.italic;
                    pos++;
                    break;
                    
                case 0x1F: // Underline
                    state.underline = !state.underline;
                    pos++;
                    break;
                    
                case 0x1E: // Strikethrough
                    state.strikethrough = !state.strikethrough;
                    pos++;
                    break;
                    
                case 0x11: // Monospace
                    state.monospace = !state.monospace;
                    pos++;
                    break;
                    
                case 0x16: // Reverse
                    state.reverse = !state.reverse;
                    pos++;
                    break;
                    
                case 0x0F: // Reset all formatting
                    state.bold = false;
                    state.italic = false;
                    state.underline = false;
                    state.strikethrough = false;
                    state.monospace = false;
                    state.reverse = false;
                    state.color = null;
                    state.bgcolor = null;
                    pos++;
                    break;
                    
                case 0x03: // Color
                    pos++;
                    let colorStr = '';
                    while (pos < text.length && text[pos] >= '0' && text[pos] <= '9' && colorStr.length < 2) {
                        colorStr += text[pos];
                        pos++;
                    }
                    
                    if (colorStr.length > 0) {
                        const colorIndex = parseInt(colorStr);
                        state.color = (colorIndex >= 0 && colorIndex < this.colors.length)
                            ? this.colors[colorIndex]
                            : null;
                        
                        if (pos < text.length && text[pos] === ',') {
                            pos++;
                            let bgColorStr = '';
                            while (pos < text.length && text[pos] >= '0' && text[pos] <= '9' && bgColorStr.length < 2) {
                                bgColorStr += text[pos];
                                pos++;
                            }
                            if (bgColorStr.length > 0) {
                                const bgColorIndex = parseInt(bgColorStr);
                                state.bgcolor = (bgColorIndex >= 0 && bgColorIndex < this.colors.length)
                                    ? this.colors[bgColorIndex]
                                    : null;
                            } else {
                                state.bgcolor = null;
                            }
                        } else {
                            // \x03NN sets foreground only and clears previous background.
                            state.bgcolor = null;
                        }
                    } else {
                        state.color = null;
                        state.bgcolor = null;
                    }
                    break;
                    
                default:
                    pos++;
                    break;
            }
        }
        
        return state;
    }
    
    /**
     * Wendet einen Control Code State auf einen Text an
     * @param {string} text - Der Text, auf den der State angewendet werden soll
     * @param {object} state - Der anzuwendende State
     * @returns {string} Text mit vorangestellten Control Codes
     */
    applyControlCodeState(text, state) {
        let prefix = '';
        
        // Bold
        if (state.bold) {
            prefix += String.fromCharCode(0x02);
        }
        
        // Italic
        if (state.italic) {
            prefix += String.fromCharCode(0x1D);
        }
        
        // Underline
        if (state.underline) {
            prefix += String.fromCharCode(0x1F);
        }
        
        // Strikethrough
        if (state.strikethrough) {
            prefix += String.fromCharCode(0x1E);
        }
        
        // Monospace
        if (state.monospace) {
            prefix += String.fromCharCode(0x11);
        }
        
        // Reverse
        if (state.reverse) {
            prefix += String.fromCharCode(0x16);
        }
        
        // Color
        if (state.color !== null) {
            const colorIndex = this.colors.indexOf(state.color);
            if (colorIndex >= 0) {
                prefix += String.fromCharCode(0x03) + colorIndex.toString().padStart(2, '0');
                
                if (state.bgcolor !== null) {
                    const bgColorIndex = this.colors.indexOf(state.bgcolor);
                    if (bgColorIndex >= 0) {
                        prefix += ',' + bgColorIndex.toString().padStart(2, '0');
                    }
                }
            }
        }
        
        return prefix + text;
    }
    
    escapeHtml(text) {
        // Don't escape HTML - allow existing HTML tags to pass through
        // This preserves link formatting and other HTML from parsePages
        return text;
    }

    escapeAttr(value) {
        return String(value).replace(/"/g, '&quot;');
    }
    
    /**
     * Checks if HTML string contains visible text (not just tags)
     * @param {string} html - HTML string to check
     * @returns {boolean} True if visible text exists
     */
    hasVisibleText(html) {
        // Remove all HTML tags and check if anything remains
        const stripped = html.replace(/<[^>]*>/g, '');
        // Also remove common HTML entities
        const cleaned = stripped.replace(/&nbsp;|&lt;|&gt;|&amp;/gi, ' ');
        return cleaned.trim().length > 0;
    }
    
    /**
     * Converts URLs in already HTML-formatted text to clickable links
     * Preserves all surrounding HTML formatting (spans with styles)
     * @param {string} html - HTML text with potential URLs
     * @param {boolean} isTopicContext - If true, applies topic-specific link styling
     * @returns {string} HTML with URLs converted to links
     */
    parseUrls(html, isTopicContext = false, currentChannel = null) {
        // Match URLs that are NOT already inside <a> tags
        // This regex looks for http:// or https:// URLs
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        
        // Split by existing <a> tags to avoid double-wrapping
        const parts = html.split(/(<a\s[^>]*>.*?<\/a>)/gi);
        
        const withUrls = parts.map(part => {
            // If this part is already a link, don't process it
            if (part.match(/^<a\s/i)) {
                return part;
            }
            
            // Replace URLs with links in this part
            return part.replace(urlRegex, (match, url, offset) => {
                try {
                    // Clean up URL
                    let cleanUrl = match;
                    cleanUrl = cleanUrl.replace(/&lt;[^&]*&gt;/gi, '');
                    cleanUrl = cleanUrl.replace(/%3C[^%]*%3E/gi, '');
                    cleanUrl = cleanUrl.replace(/<[^>]*>/gi, '');
                    cleanUrl = cleanUrl.trim();
                    
                    const urlObj = new URL(cleanUrl);
                    
                    // Check if the link is inside a span with text-decoration: underline
                    const beforeMatch = part.substring(0, offset);
                    const hasUnderline = /text-decoration:\s*underline/i.test(beforeMatch);
                    
                    // Build link style
                    let linkStyle = '';
                    if (!hasUnderline) {
                        // Remove default underline if no explicit underline control code
                        linkStyle = 'text-decoration: none;';
                    }
                    
                    if (isTopicContext) {
                        // In topic: inherit color, no default color override
                        linkStyle += ' color: inherit;';
                    }
                    
                    const styleAttr = linkStyle ? ` style="${linkStyle}"` : '';
                    return `<a href="${urlObj.href}" target="_blank"${styleAttr}>${match}</a>`;
                } catch (err) {
                    // If URL parsing fails, return as-is
                    return match;
                }
            });
        }).join('');

        // Also convert channel and nick references into interactive links
        return this.parseChannelsAndNicks(withUrls, currentChannel);
    }

    parseChannelsAndNicks(html, currentChannel = null) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const channelRegex = /([\s>]|^)([#&][A-Za-z0-9_\-\[\]\\`{|}^]{1,50})([.,:;!?)]?)/g;
        const nickRegex = /([\s><]|^)([A-Za-z0-9_\-\[\]\\`{|}^]{1,30})([.,:;!?)]?)/g;
        
        const wrapTextNode = (node) => {
            if (!node || !node.parentNode) return;

            // Avoid relinking text that is already inside a nick span/link.
            if (node.parentNode.nodeType === Node.ELEMENT_NODE) {
                const parentElem = node.parentNode;
                if (parentElem.closest('a') || parentElem.closest('.message-nick')) {
                    return;
                }
            }

            const text = node.textContent;
            if (!text) return;
            let changed = false;
            const underlined = this.isUnderlined(node.parentNode);
            const linkStyle = underlined ? '' : ' style="text-decoration: none;"';
            let replaced = text.replace(channelRegex, (full, prefix, channel, trailing) => {
                // Only wrap valid channel names
                if (!this.isChannel(channel)) return full;
                changed = true;
                const safeChannel = this.escapeAttribute(channel);
                return `${prefix}<a href="#" class="channel-link" data-channel="${safeChannel}" onclick="return chatManager.handleChannelClick('${safeChannel}');"${linkStyle}>${channel}</a>${trailing || ''}`;
            });

            // Link nick mentions when the nick exists in the current channel
            replaced = replaced.replace(nickRegex, (full, prefix, nick, trailing) => {
                if (!currentChannel || !this.hasNick(currentChannel, nick)) return full;
                changed = true;
                const safeNick = this.escapeAttribute(nick);
                const nickColor = this.getColor(currentChannel, nick) || this.getNickColor(nick);
                const nickStyle = underlined
                    ? ` style="color: ${nickColor}; font-weight: 600;"`
                    : ` style="text-decoration: none; color: ${nickColor}; font-weight: 600;"`;
                return `${prefix}<a href="#" class="nick-link" data-nick="${safeNick}" onclick="return chatManager.handleNickClick('${safeNick}');"${nickStyle}>${nick}</a>${trailing || ''}`;
            });
            
            if (changed) {
                const wrapper = document.createElement('span');
                wrapper.innerHTML = replaced;
                const frag = document.createDocumentFragment();
                while (wrapper.firstChild) {
                    frag.appendChild(wrapper.firstChild);
                }
                node.parentNode.replaceChild(frag, node);
            }
        };
        
        const wrapNickElement = (elem) => {
            if (!elem || elem.closest('a')) return;
            const nick = elem.dataset && elem.dataset.nick ? elem.dataset.nick : (elem.textContent || '').trim();
            if (!nick) return;
            const safeNick = this.escapeAttribute(nick);
            const underlined = this.isUnderlined(elem);
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'nick-link';
            link.dataset.nick = safeNick;
            if (!underlined) {
                link.style.textDecoration = 'none';
            }
            link.setAttribute('onclick', `return chatManager.handleNickClick('${safeNick}');`);
            elem.parentNode.insertBefore(link, elem);
            link.appendChild(elem);
        };
        
        const traverse = (node) => {
            node.childNodes.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    wrapTextNode(child);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const tag = child.tagName ? child.tagName.toLowerCase() : '';
                    if (tag === 'a') return; // Skip existing links
                    if (child.classList && child.classList.contains('message-nick')) {
                        wrapNickElement(child);
                    }
                    traverse(child);
                }
            });
        };
        
        traverse(temp);
        return temp.innerHTML;
    }

    escapeAttribute(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    isUnderlined(node) {
        let current = node;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            const style = current.getAttribute('style') || '';
            if (/text-decoration\s*:\s*underline/i.test(style)) {
                return true;
            }
            current = current.parentNode;
        }
        return false;
    }

    hasNick(channel, nick) {
        const target = nick.toLowerCase();
        for (const ch of this.channels) {
            if (ch.page.toLowerCase() !== channel.toLowerCase()) continue;
            for (const entry of ch.nicks) {
                const { nick: baseNick } = this.extractNickParts(entry.nick);
                if (baseNick.toLowerCase() === target) return true;
            }
        }
        return false;
    }
    
    addNick(channel, nick, host, color, isAway = false) {
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                if (elem.nicks.length === 0) color = this.userColor;

                const parts = this.extractNickParts(nick);
                const statusModes = this.normalizeStatusSymbols(parts.status);
                nick = parts.nick;
                
                const maxNickLength = Math.max(1, parseInt(window.nickMaxLength, 10) || 15);
                if (nick.length > maxNickLength) nick = nick.substring(0, maxNickLength);
                
                const fullNick = this.buildNickWithStatus(statusModes, nick);
                const existingIndex = elem.nicks.findIndex((entry) => this.extractNickParts(entry.nick).nick.toLowerCase() === nick.toLowerCase());

                // Check global away status if not explicitly provided
                let awayInfo = isAway ? { away: true, reason: '' } : this.awayStatus.get(nick.toLowerCase()) || { away: false, reason: '' };

                if (existingIndex >= 0) {
                    const existingEntry = elem.nicks[existingIndex];
                    const mergedStatusModes = this.normalizeStatusSymbols(this.getStoredStatusSymbols(existingEntry) + statusModes);
                    elem.nicks[existingIndex] = {
                        nick: this.buildNickWithStatus(mergedStatusModes, nick),
                        host: host || existingEntry.host,
                        color: existingEntry.color || color,
                        away: awayInfo.away,
                        awayReason: awayInfo.reason,
                        account: existingEntry.account || '',
                        statusModes: mergedStatusModes
                    };
                    return;
                }

                elem.nicks.push({ nick: fullNick, host, color, away: awayInfo.away, awayReason: awayInfo.reason, account: '', statusModes });
            }
        });
        
        this.sortStatus(channel);
        this.renderUserlist(channel);
    }
    
    getNickColor(nick) {
        const palette = this.isLightTheme() ? this.lightNickColors : this.darkNickColors;
        const key = (nick || '').toLowerCase();
        if (palette.length === 0) return '#5865f2';

        // Simple deterministic hash for stable color assignment per nick
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash |= 0; // Keep in 32-bit space
        }
        const index = Math.abs(hash) % palette.length;
        return palette[index];
    }

    // Backwards compatible wrapper
    getRandomColor(nick = '') {
        return this.getNickColor(nick || window.user || '');
    }

    detectActiveTemplate() {
        // Prefer template system config if available
        if (window.templateSystemConfig && window.templateSystemConfig.current) {
            return window.templateSystemConfig.current;
        }

        // Check current template link element
        const templateLink = document.querySelector('link[data-template="custom"]');
        if (templateLink) {
            const href = templateLink.getAttribute('href') || '';
            const match = href.match(/templates\/([^/]+)\//);
            if (match && match[1]) {
                return match[1];
            }
        }

        // Fallback to cookie
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'jwebirc_template') {
                return value;
            }
        }

        return null;
    }
    
    /**
     * Check if light theme is currently active
     * @returns {boolean}
     */
    isLightTheme() {
        // Use cached template name when available (updated on template change event)
        if (this.activeTemplate) {
            return this.activeTemplate.includes('light');
        }

        // Check template system
        if (window.templateSystemConfig && window.templateSystemConfig.current) {
            return window.templateSystemConfig.current.includes('light');
        }
        
        // Check link element
        const templateLink = document.querySelector('link[data-template="custom"]');
        if (templateLink) {
            const href = templateLink.getAttribute('href');
            return href && href.includes('light-theme');
        }
        
        // Check cookie as fallback
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'jwebirc_template') {
                return value.includes('light');
            }
        }
        
        // Default to dark theme
        return false;
    }

    reapplyNickColorsForTheme() {
        // Recompute stored nick colors
        const activeWindow = this.getActiveWindow();

        this.channels.forEach(channel => {
            channel.nicks = channel.nicks.map(entry => {
                const { nick: baseNick } = this.extractNickParts(entry.nick);
                return {
                    ...entry,
                    color: this.getNickColor(baseNick)
                };
            });

            this.updateNickColorElements(channel.elem);
        });

        if (window.user) {
            this.userColor = this.getNickColor(window.user);
        }

        if (activeWindow) {
            this.renderUserlist(activeWindow);
        }

        // Update already-rendered message nick colors in chat log
        this.updateNickColorElements(document);
    }

    updateNickColorElements(root) {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return;
        }

        const nickElements = root.querySelectorAll('.message-nick[data-nick], .nick-link[data-nick], .nick-entry[data-nick]');
        nickElements.forEach(element => {
            const nick = element.getAttribute('data-nick') || element.textContent.trim();
            if (!nick) {
                return;
            }

            element.style.color = this.getNickColor(nick);
        });
    }
    
    parseChannels(channel) {
        if (!channel.includes(",")) {
            return this.isChannel(channel) ? channel : "#" + channel;
        }
        
        const channels = channel.split(",");
        return channels.map(ch => this.isChannel(ch) ? ch : "#" + ch).join(",");
    }
    
    setHost(channel, nick, host) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                const normalizedNick = (nick || '').toLowerCase();

                for (let i = 0; i < elem.nicks.length; i++) {
                    const name = elem.nicks[i];
                    const { nick: baseNick } = this.extractNickParts(name.nick);
                    if (baseNick.toLowerCase() === normalizedNick) {
                        const statusModes = this.getStoredStatusSymbols(name);
                        elem.nicks.splice(i, 1, {
                            nick: this.buildNickWithStatus(statusModes, nick),
                            host: host,
                            color: name.color,
                            away: !!name.away,
                            awayReason: name.awayReason || '',
                            account: name.account || '',
                            statusModes
                        });
                        return;
                    }
                }
            }
        }
    }

    setAccount(nick, account = '') {
        const normalizedNick = (nick || '').toLowerCase();
        const normalizedAccount = account || '';
        this.channels.forEach(elem => {
            if (elem.type !== 'channel') return;
            let changed = false;
            elem.nicks.forEach(nickData => {
                const { nick: displayNick } = this.extractNickParts(nickData.nick);
                if (displayNick.toLowerCase() === normalizedNick) {
                    if ((nickData.account || '') !== normalizedAccount) {
                        nickData.account = normalizedAccount;
                        changed = true;
                    }
                }
            });
            if (changed) {
                this.renderUserlist(elem.page);
            }
        });
    }
    
    setMode(channel, line) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() !== channel.toLowerCase()) continue;
            
            for (let i = 0; i < elem.nicks.length; i++) {
                const name = elem.nicks[i];
                const { nick, host, color, away, awayReason, account } = name;
                
                if (!line.includes(" ")) continue;
                
                const modes = line.split(" ");
                if (!modes[0].includes("-") && !modes[0].includes("+")) continue;
                
                const mode = modes[0].split("");
                let add = false;
                let remove = false;
                let flag = 0;
                const nickname = this.getNick(channel, nick);
                let currentStatusSymbols = this.getStoredStatusSymbols(name);
                let changed = false;
                
                for (let j = 0; j < mode.length; j++) {
                    if (mode[j] === "-") {
                        remove = true;
                        add = false;
                        flag++;
                        continue;
                    } else if (mode[j] === "+") {
                        add = true;
                        remove = false;
                        flag++;
                        continue;
                    }
                    
                    // Check if this mode is a channel user mode
                    const modeChar = mode[j];
                    if (!this.serverPrefixes.modes.includes(modeChar)) {
                        flag++;
                        continue;
                    }
                    
                    // Check if this mode change applies to this user
                    if (modes[j - flag + 1] !== nickname) {
                        continue;
                    }
                    
                    const modeSymbol = this.getModeSymbol(modeChar);
                    if (!modeSymbol) {
                        continue;
                    }

                    if (add) {
                        const nextStatusSymbols = this.normalizeStatusSymbols(currentStatusSymbols + modeSymbol);
                        if (nextStatusSymbols !== currentStatusSymbols) {
                            currentStatusSymbols = nextStatusSymbols;
                            changed = true;
                        }
                    } else if (remove) {
                        const nextStatusSymbols = this.normalizeStatusSymbols(
                            currentStatusSymbols
                                .split('')
                                .filter((symbol) => symbol !== modeSymbol)
                                .join('')
                        );
                        if (nextStatusSymbols !== currentStatusSymbols) {
                            currentStatusSymbols = nextStatusSymbols;
                            changed = true;
                        }
                    }

                    if (changed) {
                        elem.nicks[i] = {
                            nick: this.buildNickWithStatus(currentStatusSymbols, nickname),
                            host,
                            color,
                            away: !!away,
                            awayReason: awayReason || '',
                            account: account || '',
                            statusModes: currentStatusSymbols
                        };
                    }
                }
            }
        }
        
        this.sortStatus(channel);
        this.renderUserlist(channel);
    }
    
    delNick(channel, nick) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                const normalizedNick = (nick || '').toLowerCase();
                const i = elem.nicks.findIndex((data) => this.extractNickParts(data.nick).nick.toLowerCase() === normalizedNick);
                if (i === -1) {
                    continue;
                }
                elem.nicks.splice(i, 1);
            }
        }
        
        this.sortStatus(channel);
        this.renderUserlist(channel);
    }
    
    isNick(channel, nick) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                if (elem.nicks.length === 0) return false;

                const normalizedNick = (nick || '').toLowerCase();
                if (elem.nicks.some(name => this.extractNickParts(name.nick).nick.toLowerCase() === normalizedNick)) return true;
            }
        }
        return false;
    }
    
    clearNicks(channel) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                elem.nicks.splice(0, elem.nicks.length);
                return;
            }
        }
    }
    
    setAwayStatus(nick, isAway, reason = '') {
        // Store away status in global map (for WHO queries before nicks are added)
        this.awayStatus.set(nick.toLowerCase(), { away: isAway, reason: reason || '' });
        
        // Also update in channel nick lists if they exist
        this.channels.forEach(elem => {
            if (elem.type === 'channel') {
                elem.nicks.forEach(nickData => {
                    const { nick: displayNick } = this.extractNickParts(nickData.nick);
                    
                    if (displayNick.toLowerCase() === nick.toLowerCase()) {
                        nickData.away = isAway;
                        nickData.awayReason = reason || '';
                    }
                });
                // Only re-render if we actually updated a nick in this channel
                if (elem.nicks.some(n => {
                    let dn = this.extractNickParts(n.nick).nick;
                    return dn.toLowerCase() === nick.toLowerCase();
                })) {
                    this.renderUserlist(elem.page);
                }
            }
        });
    }
    
    quit(nick, reason) {
        if (nick.toLowerCase() === window.user.toLowerCase()) {
            window.user = nick;
        }
        
        for (const elem of this.channels) {
            for (const name of elem.nicks) {
                const channel = elem.page;
                const status = this.getStatus(channel, nick);
                const color = this.getColor(channel, nick);
                const parsed = this.buildNickWithStatus(this.getStoredStatusSymbols(name), nick);
                
                if (this.extractNickParts(name.nick).nick.toLowerCase() === nick.toLowerCase()) {
                    if (this.isChannel(channel)) {
                        const i = elem.nicks.findIndex((data) => this.extractNickParts(data.nick).nick.toLowerCase() === nick.toLowerCase());
                        elem.nicks.splice(i, 1);
                        this.sortStatus(channel);
                        this.renderUserlist(channel);
                    }
                    
                    const reasonText = reason.length !== 0 ? " (" + reason + ")" : "";
                    const quitText = this.buildI18nSpan('chat.userLeft', '{nick} has left IRC{reason}', { nick: parsed, reason: reasonText });
                    this.parsePages(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> <span style=\"color: " + color + ";\">" + quitText + "</span>\n", channel);
                }
            }
        }
    }
    
    changeNick(oldnick, newnick) {
        // Ignore no-op nick changes to avoid misleading "nick changed" messages.
        if (oldnick && newnick && oldnick.toLowerCase() === newnick.toLowerCase()) {
            if (window.user && oldnick.toLowerCase() === window.user.toLowerCase()) {
                window.user = newnick;
                this.userColor = this.getNickColor(newnick);
            }
            return;
        }

        if (oldnick.toLowerCase() === window.user.toLowerCase()) {
            window.user = newnick;
            this.userColor = this.getNickColor(newnick);
        }
        
        for (const elem of this.channels) {
            for (const name of elem.nicks) {
                const channel = elem.page;
                const statusModes = this.getStoredStatusSymbols(name);
                const parsed = this.buildNickWithStatus(statusModes, oldnick);
                const parsed2 = this.buildNickWithStatus(statusModes, newnick);
                
                if (this.extractNickParts(name.nick).nick.toLowerCase() === oldnick.toLowerCase()) {
                    const { host, away, awayReason, account } = name;
                    const color = this.getNickColor(newnick);
                    
                    if (this.isChannel(channel)) {
                        const i = elem.nicks.findIndex((data) => this.extractNickParts(data.nick).nick.toLowerCase() === oldnick.toLowerCase());
                        elem.nicks.splice(i, 1, { nick: parsed2, host, color, away: !!away, awayReason: awayReason || '', account: account || '', statusModes });
                        this.sortStatus(channel);
                        this.renderUserlist(channel);
                    }
                    
                    const nickChange = this.buildI18nSpan('chat.nickChange', '{oldnick} has changed their nick to {newnick}', { oldnick: parsed, newnick });
                    this.parsePages(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> <span style=\"color: " + color + ";\">" + nickChange + "</span>\n", channel);
                    break;
                }
            }
        }
    }
    
    isChannel(channel) {
        return channel.startsWith("#") || channel.startsWith("&");
    }
    
    sortStatus(channel) {
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                elem.nicks.sort((x, y) => {
                    const xParts = this.extractNickParts(x.nick);
                    const yParts = this.extractNickParts(y.nick);
                    const xStatus = this.getPrimaryStatusSymbol(xParts.status);
                    const yStatus = this.getPrimaryStatusSymbol(yParts.status);
                    
                    // Get status priority (lower index = higher priority)
                    const xPriority = xStatus ? this.serverPrefixes.symbols.indexOf(xStatus) : 999;
                    const yPriority = yStatus ? this.serverPrefixes.symbols.indexOf(yStatus) : 999;
                    
                    // Sort by status priority first
                    if (xPriority !== yPriority) {
                        return xPriority - yPriority;
                    }
                    
                    // Then sort alphabetically by nickname (without status)
                    const xName = xParts.nick;
                    const yName = yParts.nick;
                    return xName.localeCompare(yName);
                });
            }
        });
    }
    
    parseUrl(url, originalText = null, inheritedState = null) {
        try {
            // Clean up the URL by removing HTML entities and encoded tags at the end
            // These can appear when IRC servers include formatting in their messages
            let cleanUrl = url;
            
            // Remove &lt;...&gt; (HTML entity encoded tags)
            cleanUrl = cleanUrl.replace(/&lt;[^&]*&gt;/gi, '');
            
            // Remove %3C...%3E (URL encoded tags) - must be done before creating URL object
            cleanUrl = cleanUrl.replace(/%3C[^%]*%3E/gi, '');
            
            // Remove any trailing HTML-like tags
            cleanUrl = cleanUrl.replace(/<[^>]*>/gi, '');
            
            // Trim whitespace
            cleanUrl = cleanUrl.trim();
            
            const link = new URL(cleanUrl);
            
            // Use original text with IRC formatting if provided, otherwise use cleaned URL
            let displayText = originalText !== null ? originalText : link.href;
            
            // Always apply inherited state if provided - control codes should always affect following text
            if (inheritedState) {
                displayText = this.applyControlCodeState(displayText, inheritedState);
            }
            
            displayText = this.parseControl(displayText);
            return `<a href="${link.href}" target="_blank">${displayText}</a>`;
        } catch (err) {
            // If URL parsing fails, try to clean and return as plain text
            let cleaned = url.replace(/(&lt;[^&]*&gt;|%3C[^%]*%3E|<[^>]*>)/gi, '').trim();
            return cleaned || url;
        }
    }
    
    renderUserlist(channel) {
        const content = this.parseChannel(channel);
        
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                const doc = document.createElement("ulist_" + content);
                doc.innerHTML = "";
                
                elem.nicks.forEach(nick => {
                    const nickParts = this.extractNickParts(nick.nick);
                    const statusSymbol = this.getPrimaryStatusSymbol(nickParts.status);
                    const displayNick = nickParts.nick;
                    
                    // Create colored status emoji/icon combined with nick
                    let statusHtml = '';
                    if (statusSymbol) {
                        const emoji = this.getStatusEmoji(statusSymbol);
                        const statusLabel = this.getStatusLabel(statusSymbol);
                        const statusTitle = this.escapeAttribute(statusLabel);
                        statusHtml = `<span class="status-symbol status-${this.getSymbolMode(statusSymbol)}" title="${statusTitle}">${emoji}</span>`;
                    }
                    
                    // Add away/account indicator via tooltip metadata
                    const awayClass = nick.away ? ' away' : '';
                    let tooltipParts = [];
                    if (nick.account && nick.account.length > 0) {
                        tooltipParts.push(this.t('nicklist.account', 'Account: {account}', { account: nick.account }));
                    }
                    if (nick.away) {
                        const reason = nick.awayReason ? nick.awayReason : '';
                        const awayText = reason
                            ? this.t('nicklist.awayWithReason', 'Away: {reason}', { reason })
                            : this.t('nicklist.away', 'Away');
                        tooltipParts.push(awayText);
                    }
                    const tooltip = tooltipParts.length > 0 ? ` title="${this.escapeAttribute(tooltipParts.join(' | '))}"` : '';
                    
                    doc.innerHTML += `<span class="nick-entry${awayClass}" data-nick="${displayNick}" style="color: ${nick.color};"${tooltip}>${statusHtml}<span class="nick-name">${displayNick}</span></span>\n`;
                });
                
                while (this.right.firstChild) {
                    this.right.removeChild(this.right.firstChild);
                }
                
                this.parseFrame(channel, elem.type);
                this.right.appendChild(doc);
            }
        });
    }
    
    parseFrame(channel, type) {
        const right = document.querySelectorAll(".right_frame");
        const cf = document.querySelectorAll(".chat_frame");
        const tf = document.querySelectorAll(".topic_frame");
        const container = document.querySelector(".chat-container");
        const isChannelView = type === "channel";
        const shouldShowNicklist = isChannelView && !this.uiPrefs.hideNicklist;
        
        if (!isChannelView) {
            // Status and query windows use the simplified full-width layout.
            if (container) container.classList.add('status-view');
            right.forEach(frame => {
                frame.style.display = 'none';
            });
            tf.forEach(frame => {
                frame.style.display = 'none';
            });
        } else {
            // Channel windows keep the topic visible and only show the nicklist
            // when the user has explicitly enabled it.
            if (container) container.classList.remove('status-view');
            right.forEach(frame => {
                frame.style.display = shouldShowNicklist ? '' : 'none';
            });
            tf.forEach(frame => {
                frame.style.display = '';
            });
        }
    }
    
    getStatus(channel, nickname) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                for (const nick of elem.nicks) {
                    const parts = this.extractNickParts(nick.nick);
                    if (parts.nick.toLowerCase() === nickname.toLowerCase()) {
                        return this.getPrimaryStatusSymbol(this.getStoredStatusSymbols(nick));
                    } else if (nick.nick.toLowerCase() === nickname.toLowerCase()) {
                        return "";
                    }
                }
            }
        }
        return "";
    }

    getStatusModes(channel, nickname) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                for (const nick of elem.nicks) {
                    const parts = this.extractNickParts(nick.nick);
                    if (parts.nick.toLowerCase() === nickname.toLowerCase()) {
                        return this.getStoredStatusSymbols(nick);
                    }
                }
            }
        }
        return "";
    }
    
    getColor(channel, nickname) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                for (const nick of elem.nicks) {
                    const parts = this.extractNickParts(nick.nick);
                    if (parts.nick.toLowerCase() === nickname.toLowerCase()) {
                        return nick.color;
                    } else if (nick.nick.toLowerCase() === nickname.toLowerCase()) {
                        return nick.color;
                    }
                }
            }
        }
        return this.getNickColor(nickname);
    }
    
    parseTab(nickname, start) {
        if (!this.isChannel(this.activeWindow)) return nickname;
        
        if (nickname.startsWith("#") || nickname.startsWith("&")) {
            for (const elem of this.channels) {
                if (elem.page.toLowerCase().startsWith(nickname.toLowerCase())) {
                    return start ? elem.page + ": " : elem.page;
                }
            }
        } else {
            for (const elem of this.channels) {
                if (elem.page.toLowerCase() === this.activeWindow.toLowerCase()) {
                    for (const nick of elem.nicks) {
                        const name = this.getNick(this.activeWindow, nick.nick);
                        if (name.toLowerCase().startsWith(nickname.toLowerCase())) {
                            return start ? name + ": " : name;
                        }
                    }
                }
            }
        }
        
        return nickname;
    }
    
    getTabCompletions(prefix) {
        const completions = [];
        const prefixLower = prefix.toLowerCase();
        
        // Channel completion
        if (prefix.startsWith("#") || prefix.startsWith("&")) {
            const currentChannel = this.activeWindow;
            let currentChannelMatch = null;
            const otherMatches = [];
            
            for (const elem of this.channels) {
                if (elem.page.toLowerCase().startsWith(prefixLower)) {
                    // Prioritize current channel
                    if (elem.page === currentChannel) {
                        currentChannelMatch = elem.page;
                    } else {
                        otherMatches.push(elem.page);
                    }
                }
            }
            
            // Current channel first, then others alphabetically
            if (currentChannelMatch) {
                completions.push(currentChannelMatch);
            }
            completions.push(...otherMatches.sort(
                (a, b) => a.toLowerCase().localeCompare(b.toLowerCase())
            ));
        } else if (this.isChannel(this.activeWindow)) {
            // Nick completion in current channel - optimized with direct access
            const activeWindowLower = this.activeWindow.toLowerCase();
            for (const elem of this.channels) {
                if (elem.page.toLowerCase() === activeWindowLower) {
                    // Use Map for faster deduplication and lookup
                    const nicksMap = new Map();
                    
                    for (const nick of elem.nicks) {
                        const name = this.getNick(this.activeWindow, nick.nick);
                        // Match if prefix is empty or if nick starts with prefix
                        if (!prefix || name.toLowerCase().startsWith(prefixLower)) {
                            // Use Map to track: allows fast deduplication and priority handling
                            nicksMap.set(name.toLowerCase(), name);
                        }
                    }
                    
                    // Convert to array and sort only if we have results
                    if (nicksMap.size > 0) {
                        completions.push(...Array.from(nicksMap.values()).sort(
                            (a, b) => a.toLowerCase().localeCompare(b.toLowerCase())
                        ));
                    }
                    break;
                }
            }
        }
        
        return completions;
    }
    
    getNick(channel, nickname) {
        let status = null;
        
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                elem.nicks.forEach(nick => {
                    const parts = this.extractNickParts(nick.nick);
                    if (nick.nick.toLowerCase() === nickname.toLowerCase()) {
                        status = parts.nick;
                    } else if (parts.nick.toLowerCase() === nickname.toLowerCase()) {
                        status = parts.nick;
                    }
                });
            }
        });
        
        return status;
    }
    
    parseChannel(channel) {
        return channel.replace(/[^a-zA-Z0-9]/g, "_");
    }
    
    addPage(page, type, open) {
        const content = this.parseChannel(page);
        if (content.length === 0) return;
        
        this.channels.push({
            type: type.toLowerCase(),
            page: page,
            elem: document.createElement(content),
            topic: "",
            setted: 0,
            by: "",
            nicks: []
        });
        
        if (open) this.setWindow(page);
        this.refreshNav();
        this.addWindow();
    }
    
    renderTopic(channel) {
        if (!channel) return;
        
        const content = this.parseChannel(channel);
        
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === channel.toLowerCase() && channel.toLowerCase() === this.activeWindow.toLowerCase()) {
                let text = elem.topic;
                let topicContent = "";
                
                if (text && text.trim().length > 0) {
                    // Parse control codes first, then convert URLs to links (with topic context)
                    let parsed = this.parseControl(text);
                    parsed = this.parseUrls(parsed, true, channel);
                    topicContent = `<span class="topic-prefix">${channel}:&nbsp;</span><span class="topic-content">${parsed.trim()}</span>`;
                } else {
                    topicContent = `<span class="topic-prefix">${channel}:&nbsp;</span><span class="topic-empty">(No topic set)</span>`;
                }
                
                const wrapper = document.createElement("div");
                wrapper.className = "topic-wrapper";
                wrapper.innerHTML = topicContent;
                
                while (this.topicWindow.firstChild) {
                    this.topicWindow.removeChild(this.topicWindow.firstChild);
                }
                this.topicWindow.appendChild(wrapper);
            }
        });
    }
    
    setTopic(channel, topic) {
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                elem.topic = topic;
            }
        });
        this.renderTopic(channel);
    }
    
    getTopic(channel) {
        let topic = null;
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                topic = elem.topic;
            }
        });
        return topic;
    }
    
    updateTopic(channel, by, time) {
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                elem.by = by;
                elem.setted = time;
            }
        });
    }
    
    delPage(page) {
        if (this.channels.length === 0) return;

        this.clearTabAlerts(page);
        
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === page.toLowerCase() && elem.type.toLowerCase() !== "status") {
                const i = this.channels.findIndex(data => data.page === page);
                this.channels.splice(i, 1);
            }
        });
        
        this.refreshNav();
        this.setWindow("Status");
    }

    clearTabAlerts(tabName) {
        if (!tabName) return;

        const lowerTabName = tabName.toLowerCase();

        for (const key of this.unreadCounts.keys()) {
            if (key.toLowerCase() === lowerTabName) {
                this.unreadCounts.delete(key);
            }
        }

        for (const key of this.highlightedTabs) {
            if (key.toLowerCase() === lowerTabName) {
                this.highlightedTabs.delete(key);
            }
        }

        this.updateNotificationBadge();
    }

    sortChannelsForNav() {
        const priority = { status: 0, channel: 1, query: 2 };
        return [...this.channels].sort((a, b) => {
            const pa = priority[a.type] ?? 3;
            const pb = priority[b.type] ?? 3;
            if (pa !== pb) return pa - pb;
            return a.page.toLowerCase().localeCompare(b.page.toLowerCase());
        });
    }
    
    refreshNav() {
        const sortedChannels = this.sortChannelsForNav();
        for (let i = 0; i < sortedChannels.length; i++) {
            const isActive = sortedChannels[i].page === this.activeWindow ? ' active' : '';
            const isUnread = this.unreadCounts.has(sortedChannels[i].page) ? ' unread' : '';
            const isHighlighted = this.highlightedTabs.has(sortedChannels[i].page) ? ' highlighted' : '';
            const classes = isActive + isUnread + isHighlighted;
            const safePage = sortedChannels[i].page.replace(/'/g, "\\'");
            
            if (i === 0) {
                this.navElement.innerHTML = `<nv class="${classes}" onclick="chatManager.setWindow('${safePage}');" style="cursor: pointer;">${sortedChannels[i].page}</nv> `;
            } else {
                if (sortedChannels[i].page.startsWith("#") || sortedChannels[i].page.startsWith("&")) {
                    this.navElement.innerHTML += `<nv class="${classes}" onclick="chatManager.setWindow('${safePage}');" style="cursor: pointer;"><span class="tab-label">${sortedChannels[i].page}</span><span class="tab-close" onclick="event.stopPropagation(); postManager.submitTextMessage('/part ${safePage} Closed tab!');">✕</span></nv> `;
                } else {
                    this.navElement.innerHTML += `<nv class="${classes}" onclick="chatManager.setWindow('${safePage}');" style="cursor: pointer;"><span class="tab-label">${sortedChannels[i].page}</span><span class="tab-close" onclick="event.stopPropagation(); chatManager.delPage('${safePage}');">✕</span></nv> `;
                }
            }
        }
        
        if (this.navTabs) {
            while (this.navTabs.firstChild) {
                this.navTabs.removeChild(this.navTabs.firstChild);
            }
            this.navTabs.appendChild(this.navElement);
        }
    }
    
    stripSystemMessageMarker(text) {
        return (text || '')
            .replace(/^(\[[0-9]{2}:[0-9]{2}:[0-9]{2}\])\s*<span style=(['"])\s*color\s*:\s*[^'"]*\2>\s*==\s*<\/span>\s*/i, '$1 ')
            .replace(/^<span style=(['"])\s*color\s*:\s*[^'"]*\1>\s*==\s*<\/span>\s*/i, '');
    }

    parsePages(text, pg) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === pg.toLowerCase()) {
                // Don't apply highlight in query windows (private messages)
                const isQuery = elem.type === 'query';
                const shouldLineHighlight = this.highlight && !isQuery;
                
                // Parse control codes first, then convert URLs to links
                let parsed = this.parseControl(text);
                parsed = this.parseUrls(parsed, false, pg);
                parsed = this.stripSystemMessageMarker(parsed);
                
                // Filter empty output (only control codes, no visible text)
                if (!this.hasVisibleText(parsed)) {
                    return;
                }
                
                // Update unread count for notifications and highlight tabs
                if (pg.toLowerCase() !== this.activeWindow.toLowerCase()) {
                    // Determine if notification will be shown
                    const willShowNotification = isQuery || this.highlight;
                    
                    if (willShowNotification) {
                        // Notification takes priority - remove any tab highlight
                        this.clearTabHighlight(pg);
                        
                        const currentCount = this.unreadCounts.get(pg) || 0;
                        this.updateUnreadCount(pg, currentCount + 1);
                        
                        // Trigger browser notification
                        if (this.notificationManager) {
                            // Extract clean text from parsed HTML for notification
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = parsed;
                            const cleanText = tempDiv.textContent || tempDiv.innerText || '';
                            
                            if (isQuery) {
                                // Private message notification
                                this.notificationManager.notifyPrivateMessage(pg, cleanText);
                            } else if (this.highlight) {
                                // Highlight/mention notification
                                // Try to extract nick from message if possible
                                const nickMatch = cleanText.match(/<([^>]+)>/);
                                const nick = nickMatch ? nickMatch[1] : 'Jemand';
                                this.notificationManager.notifyHighlight(pg, nick, cleanText);
                            }
                        }
                    } else {
                        // No notification - just highlight the tab visually
                        this.highlightTab(pg);
                    }
                }
                
                if (shouldLineHighlight) {
                    parsed = `<span class="irc-highlight-line">${parsed}</span>`;
                }

                if (this.highlight) {
                    this.highlight = false;
                }
                
                // Add line break
                elem.elem.innerHTML += parsed.trimEnd() + "<br>";
                return;
            }
        }
    }
    
    parsePage(text) {
        const shouldLineHighlight = this.highlight;
        
        for (const elem of this.channels) {
            // Parse control codes first, then convert URLs to links
            let parsed = this.parseControl(text);
            parsed = this.parseUrls(parsed, false, elem.page);
            parsed = this.stripSystemMessageMarker(parsed);
            
            if (shouldLineHighlight) {
                parsed = `<span class="irc-highlight-line">${parsed}</span>`;
            }

            if (this.highlight) {
                this.highlight = false;
            }
            
            // Only add to innerHTML if there's actual visible content
            if (this.hasVisibleText(parsed)) {
                elem.elem.innerHTML += parsed.trimEnd() + "<br>";
            }
        }
    }
    
    isPage(page) {
        return this.channels.some(channel => channel.page.toLowerCase() === page.toLowerCase());
    }
    
    scrollToEnd(block, duration = 100) {
        block = block || $("html, body");
        if (typeof block === 'string') block = $(block);
        
        if (block.length) {
            block.animate({ scrollTop: block.get(0).scrollHeight }, duration);
        }
    }
    
    redirect(url) {
        this.win.top.location.href = url;
    }
    
    redirectChat(url) {
        this.win.location.href = url;
    }
    
    getPage(page) {
        for (const channel of this.channels) {
            if (channel.page.toLowerCase() === page.toLowerCase()) {
                return channel.elem;
            }
        }
        return null;
    }
    
    addWindow() {
        if (this.activeWindow) {
            let targetWindow = this.activeWindow.toString();
            let content = this.getPage(targetWindow);

            // Active tab can become stale (e.g. closed query with remaining unread key).
            // Resolve to a safe existing tab before rendering.
            if (!content) {
                if (this.isPage('Status')) {
                    targetWindow = 'Status';
                } else if (this.channels.length > 0) {
                    targetWindow = this.channels[0].page;
                } else {
                    if (this.chatWindow) {
                        this.chatWindow.innerHTML = '';
                    }
                    return;
                }

                this.activeWindow = targetWindow;
                content = this.getPage(targetWindow);
            }

            if (!content) {
                return;
            }

            this.chatWindow.innerHTML = content.innerHTML;
            
            this.channels.forEach(elem => {
                if (elem.page.toLowerCase() === targetWindow.toLowerCase()) {
                    this.parseFrame(elem.page, elem.type);
                }
            });
            
            this.sortStatus(targetWindow);
            this.renderUserlist(targetWindow);
            this.renderTopic(targetWindow);
            this.scrollToEnd("#chat_window", 1);
        } else {
            this.channels.forEach(elem => {
                this.chatWindow.innerHTML = elem.elem.innerHTML;
                this.parseFrame(elem.page, elem.type);
                this.scrollToEnd("#chat_window", 1);
            });
        }
    }
    
    getDate(date) {
        return new Date(date).toLocaleString();
    }
    
    getTimestamp(sourceTime) {
        // If server-time tag is provided (IRCv3), prefer that for display
        const time = sourceTime ? new Date(sourceTime) : new Date();
        const hour = (time.getHours() < 10 ? '0' + time.getHours() : time.getHours());
        const minute = (time.getMinutes() < 10 ? '0' + time.getMinutes() : time.getMinutes());
        const second = (time.getSeconds() < 10 ? '0' + time.getSeconds() : time.getSeconds());
        return `[${hour}:${minute}:${second}]`;
    }
    
    setWindow(win) {
        // Ignore invalid windows and use a safe fallback.
        if (!this.isPage(win)) {
            if (this.isPage('Status')) {
                win = 'Status';
            } else if (this.channels.length > 0) {
                win = this.channels[0].page;
            } else {
                return;
            }
        }

        this.activeWindow = win;
        this.clearTabHighlight(win); // Remove highlight when tab is activated
        this.addWindow();
        this.renderTopic(win); // Update topic for new channel
        this.refreshNav(); // Update navigation to show active tab
        this.updateTypingBar(win); // Update typing indicator for new channel
        
        // Recompute layout (grid + visibility) for the new window type
        this.applyLayoutPreferences();
        
        // Set focus to the message input field
        if (window.postManager && window.postManager.messageInput) {
            window.postManager.messageInput.focus();
        }
    }
    
    getActiveWindow() {
        return this.activeWindow;
    }
    
    setOutput(output) {
        this.output = output;
    }
    
    getOutput() {
        return this.output;
    }
    
    setHighlight(highlight) {
        this.highlight = highlight;
    }

    handleChannelClick(channel) {
        const target = this.isChannel(channel) ? channel : `#${channel}`;
        if (window.postManager) {
            window.postManager.submitTextMessage(`/join ${target}`);
        }
        if (!this.isPage(target)) {
            this.addPage(target, 'channel', true);
        } else {
            this.setWindow(target);
        }
        return false;
    }

    handleNickClick(nick) {
        if (!nick) return false;
        if (window.postManager) {
            window.postManager.submitTextMessage(`/query ${nick}`);
        }
        if (!this.isPage(nick)) {
            this.addPage(nick, 'query', true);
        } else {
            this.setWindow(nick);
        }
        
        // Set focus to the message input field
        if (window.postManager && window.postManager.messageInput) {
            window.postManager.messageInput.focus();
        }
        
        return false;
    }
    
    /**
     * Initialize nick context menu (called once on startup)
     */
    initNickContextMenu() {
        // Create context menu
        const menu = document.createElement('div');
        menu.id = 'nick-context-menu';
        menu.className = 'nick-context-menu';
        // Menu content will be populated dynamically when shown
        document.body.appendChild(menu);
        
        // Use event delegation on right frame for nick clicks
        document.addEventListener('click', (e) => {
            const nickEntry = e.target.closest('.nick-entry');
            if (nickEntry) {
                e.preventDefault();
                e.stopPropagation();
                const nick = nickEntry.dataset.nick;
                if (nick) {
                    this.showNickContextMenu(e.clientX, e.clientY, nick, this.activeWindow);
                }
            } else if (!e.target.closest('.nick-context-menu')) {
                // Close menu when clicking outside
                this.hideNickContextMenu();
            }
        });
    }
    
    /**
     * Show nick context menu at position
     */
    showNickContextMenu(x, y, nick, channel) {
        const menu = document.getElementById('nick-context-menu');
        if (!menu) return;
        
        menu.dataset.currentNick = nick;
        menu.dataset.currentChannel = channel;
        
        // Get user's own status in channel
        const myStatus = this.getStatus(channel, window.user);
        const targetStatusModes = this.getStatusModes(channel, nick);
        
        // Get away status and reason
        const awayInfo = this.awayStatus.get(nick.toLowerCase()) || { away: false, reason: '' };
        
        // Build menu dynamically based on permissions
        const menuItems = [];
        
        // Show away status if user is away
        if (awayInfo.away) {
            menuItems.push({
                icon: '⏸️',
                label: awayInfo.reason
                    ? this.t('nicklist.awayWithReason', 'Away: {reason}', { reason: awayInfo.reason })
                    : this.t('nicklist.away', 'Away'),
                action: 'none',
                isInfo: true
            });
            menuItems.push({ separator: true });
        }
        
        // Always available: Query, WHOIS, Version
        menuItems.push(
            { icon: '💬', label: this.t('nickmenu.query', 'Private Message'), action: 'query' },
            { icon: 'ℹ️', label: this.t('nickmenu.whois', 'WHOIS'), action: 'whois' },
            { icon: '🔍', label: this.t('nickmenu.version', 'Version'), action: 'version' }
        );
        
        // Channel operations (only if in a channel)
        if (channel.startsWith('#') || channel.startsWith('&')) {
            const isOwnNick = nick.toLowerCase() === window.user.toLowerCase();
            
            if (!isOwnNick) {
                menuItems.push({ separator: true });
                
                // Get mode info
                const modeEmojis = {
                    'q': '👑', // Owner - Crown
                    'a': '🛡️', // Admin - Shield
                    'o': '⭐', // Op - Star
                    'h': '⚡', // Half-op - Lightning
                    'v': '💬'  // Voice - Speech
                };
                
                const modeLabels = {
                    'q': this.t('nickmenu.role.owner', 'Owner'),
                    'a': this.t('nickmenu.role.admin', 'Admin'),
                    'o': this.t('nickmenu.role.op', 'Op'),
                    'h': this.t('nickmenu.role.halfop', 'Half-Op'),
                    'v': this.t('nickmenu.role.voice', 'Voice')
                };
                
                // Add give/take mode options for each available mode
                // Only show if user has permission (higher or equal status)
                for (let i = 0; i < this.serverPrefixes.modes.length; i++) {
                    const mode = this.serverPrefixes.modes[i];
                    const symbol = this.serverPrefixes.symbols[i];
                    const emoji = modeEmojis[mode] || '🔸';
                    const label = modeLabels[mode] || mode.toUpperCase();
                    
                    // User needs at least the same level to manage this mode
                    const myModeIndex = myStatus ? this.serverPrefixes.symbols.indexOf(myStatus) : -1;
                    const canManage = myModeIndex >= 0 && myModeIndex <= i;
                    
                    if (canManage) {
                        // Check if target has this mode
                        const hasMode = targetStatusModes.includes(symbol);
                        
                        if (hasMode) {
                            menuItems.push({
                                icon: '⚫',
                                label: this.t('nickmenu.remove', 'Remove {role}', { role: label }),
                                action: 'mode',
                                mode: `-${mode}`,
                                emoji: emoji
                            });
                        } else {
                            menuItems.push({
                                icon: emoji,
                                label: this.t('nickmenu.give', 'Give {role}', { role: label }),
                                action: 'mode',
                                mode: `+${mode}`,
                                emoji: emoji
                            });
                        }
                    }
                }
                
                // Kick/Ban options (needs op or higher)
                const myModeIndex = myStatus ? this.serverPrefixes.symbols.indexOf(myStatus) : -1;
                const opIndex = this.serverPrefixes.modes.indexOf('o');
                const hasOpOrHigher = myModeIndex >= 0 && (opIndex === -1 || myModeIndex <= opIndex);
                
                if (hasOpOrHigher) {
                    menuItems.push({ separator: true });
                    menuItems.push(
                        { icon: '👢', label: this.t('nickmenu.kick', 'Kick'), action: 'kick' },
                        { icon: '🚫', label: this.t('nickmenu.ban', 'Ban'), action: 'ban' },
                        { icon: '⛔', label: this.t('nickmenu.kickban', 'Kick + Ban'), action: 'kickban' }
                    );
                }
            }
        }
        
        // Build HTML
        const safeNick = this.escapeHtml(nick);
        let html = `<div class="nick-context-menu-header">${safeNick}</div>`;

        menuItems.forEach(item => {
            if (item.separator) {
                html += '<div class="nick-context-menu-separator"></div>';
            } else if (item.isInfo) {
                html += `<div class="nick-context-menu-item info-item">
                    <span class="menu-icon">${item.icon}</span>
                    <span>${item.label}</span>
                </div>`;
            } else {
                html += `<div class="nick-context-menu-item" data-action="${item.action}" data-mode="${item.mode || ''}">
                    <span class="menu-icon">${item.icon}</span>
                    <span>${item.label}</span>
                </div>`;
            }
        });
        
        menu.innerHTML = html;
        
        // Re-attach event handlers (skip info items)
        menu.querySelectorAll('.nick-context-menu-item:not(.info-item)').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = item.dataset.action;
                const mode = item.dataset.mode;
                const nick = menu.dataset.currentNick;
                const channel = menu.dataset.currentChannel;
                this.handleNickAction(action, nick, channel, mode);
                this.hideNickContextMenu();
            });
        });
        
        // Position menu
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.add('show');
        
        // Adjust if menu would go off screen
        setTimeout(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = (x - rect.width) + 'px';
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = (y - rect.height) + 'px';
            }
        }, 0);
    }
    
    /**
     * Hide nick context menu
     */
    hideNickContextMenu() {
        const menu = document.getElementById('nick-context-menu');
        if (menu) {
            menu.classList.remove('show');
        }
    }
    
    /**
     * Handle nick context menu action
     */
    handleNickAction(action, nick, channel, mode) {
        if (!window.postManager || !nick) return;
        
        switch (action) {
            case 'query':
                // Open private chat
                window.postManager.submitTextMessage(`/query ${nick}`);
                break;
                
            case 'whois':
                window.postManager.submitTextMessage(`/whois ${nick}`);
                break;
                
            case 'version':
                window.postManager.submitTextMessage(`/ctcp ${nick} VERSION`);
                break;
                
            case 'mode':
                if (mode && (channel.startsWith('#') || channel.startsWith('&'))) {
                    window.postManager.submitTextMessage(`/mode ${channel} ${mode} ${nick}`);
                }
                break;
                
            case 'kick':
                if (channel.startsWith('#') || channel.startsWith('&')) {
                    const reason = prompt(`Kick reason for ${nick}:`, 'Kicked');
                    if (reason !== null) {
                        window.postManager.submitTextMessage(`/kick ${channel} ${nick} ${reason}`);
                    }
                }
                break;
                
            case 'ban':
                if (channel.startsWith('#') || channel.startsWith('&')) {
                    window.postManager.submitTextMessage(`/mode ${channel} +b ${nick}!*@*`);
                }
                break;
                
            case 'kickban':
                if (channel.startsWith('#') || channel.startsWith('&')) {
                    const reason = prompt(`Kickban reason for ${nick}:`, 'Banned');
                    if (reason !== null) {
                        window.postManager.submitTextMessage(`/mode ${channel} +b ${nick}!*@*`);
                        setTimeout(() => {
                        }, 100);
                    }
                }
                break;
        }
        
        // Set focus to the message input field after action
        if (window.postManager && window.postManager.messageInput) {
            window.postManager.messageInput.focus();
        }
    }
    
    /**
     * Highlight a tab when an incoming message arrives (no notification)
     * @param {string} tabName - Name of the tab to highlight
     */
    highlightTab(tabName) {
        if (!this.highlightedTabs.has(tabName)) {
            this.highlightedTabs.add(tabName);
            this.refreshNav();
        }
    }

    /**
     * Clear highlight from a tab
     * @param {string} tabName - Name of the tab
     */
    clearTabHighlight(tabName) {
        if (this.highlightedTabs.has(tabName)) {
            this.highlightedTabs.delete(tabName);
            this.refreshNav();
        }
    }

    /**
     * Update unread count for a tab
     * @param {string} tabName - Name of the tab
     * @param {number} count - Unread message count
     */
    updateUnreadCount(tabName, count) {
        if (count > 0) {
            this.unreadCounts.set(tabName, count);
        } else {
            this.unreadCounts.delete(tabName);
        }
        this.updateNotificationBadge();
        this.refreshNav();
    }

    /**
     * Register a notify event for the bell/badge system.
     * @param {string} tabName - Preferred tab to associate with this event.
     */
    addNotificationEvent(tabName = 'Status') {
        const targetTab = this.isPage(tabName)
            ? tabName
            : (this.isPage('Status') ? 'Status' : this.getActiveWindow());

        if (!targetTab) {
            return;
        }

        const currentCount = this.unreadCounts.get(targetTab) || 0;
        this.updateUnreadCount(targetTab, currentCount + 1);
    }
    
    /**
     * Update the notification badge display
     */
    updateNotificationBadge() {
        if (!this.notificationBadge) return;
        
        const totalCount = Array.from(this.unreadCounts.values()).reduce((sum, count) => sum + count, 0);
        
        if (totalCount > 0) {
            this.notificationBadge.textContent = totalCount;
            this.notificationBadge.style.display = 'flex';
        } else {
            this.notificationBadge.style.display = 'none';
        }
    }
    
    /**
     * Toggle notification dropdown menu
     */
    toggleNotifications() {
        // Switch to first unread tab that still exists; drop stale entries.
        let firstUnread = null;
        for (const tabName of this.unreadCounts.keys()) {
            if (this.isPage(tabName)) {
                firstUnread = tabName;
                break;
            }
            this.unreadCounts.delete(tabName);
        }

        this.updateNotificationBadge();

        if (firstUnread) {
            this.setWindow(firstUnread);
            this.updateUnreadCount(firstUnread, 0);
            this.refreshNav();
        }
    }
}

// Initialize ChatManager and make it globally available
const chatManager = new ChatManager();
window.chatManager = chatManager;

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        chatManager.initialize();
        // Initialize PostManager after ChatManager
        if (typeof initializePostManager === 'function') {
            initializePostManager();
        }
    });
} else {
    chatManager.initialize();
    // Initialize PostManager after ChatManager
    if (typeof initializePostManager === 'function') {
        initializePostManager();
    }
}

// Legacy function exports for compatibility
function set_window(win) { chatManager.setWindow(win); }
function get_user() { return window.user; }
function submitTextMessage(text) { if (window.postManager) window.postManager.submitTextMessage(text); }
function del_page(page) { chatManager.delPage(page); }
function parse_output(text) { if (window.ircParser) window.ircParser.parseOutput(text); }
function add_nick(channel, nick, host, color) { chatManager.addNick(channel, nick, host, color); }
function getRandomColor() { return chatManager.getRandomColor(); }

// Position a nav dropdown so it always opens downward and stays fully within
// the viewport. Flips upward only when there is not enough space below, and
// clamps to the viewport edges so it is never clipped at the top or bottom.
window.jwebircPositionNavDropdown = function (toggle, menu) {
    if (!toggle || !menu) return;

    const rect = toggle.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    menu.style.position = 'fixed';
    menu.style.left = 'auto';
    menu.style.bottom = 'auto';
    menu.style.transform = 'none';
    menu.style.transition = 'opacity 0.2s ease, visibility 0.2s ease';

    // Right-align the menu with the toggle's right edge, kept inside the viewport.
    const menuWidth = menu.offsetWidth || menu.getBoundingClientRect().width;
    let right = vw - rect.right;
    if (right < margin) right = margin;
    if (right + menuWidth > vw - margin) right = Math.max(margin, vw - menuWidth - margin);
    menu.style.right = right + 'px';

    const menuHeight = menu.offsetHeight || menu.getBoundingClientRect().height;
    let top = rect.bottom + margin;
    if (top + menuHeight > vh - margin) {
        const aboveTop = rect.top - margin - menuHeight;
        top = aboveTop >= margin ? aboveTop : Math.max(margin, Math.min(top, vh - margin - menuHeight));
    }
    menu.style.top = top + 'px';
};

window.jwebircResetNavDropdown = function (menu) {
    if (!menu) return;
    menu.style.position = '';
    menu.style.top = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.style.bottom = '';
    menu.style.transform = '';
    menu.style.transition = '';
};

// Keep any open, JS-positioned dropdown correctly placed while scrolling/resizing.
(function () {
    let repositioning = false;
    function repositionOpenMenus() {
        if (repositioning) return;
        repositioning = true;
        document.querySelectorAll('.nav-dropdown.open').forEach((menu) => {
            if (menu.style.position === 'fixed') {
                const toggle = document.querySelector('[aria-haspopup="true"][aria-controls="' + menu.id + '"]')
                    || menu.previousElementSibling;
                window.jwebircPositionNavDropdown(toggle, menu);
            }
        });
        repositioning = false;
    }
    window.addEventListener('resize', repositionOpenMenus);
    window.addEventListener('scroll', repositionOpenMenus, true);
})();
