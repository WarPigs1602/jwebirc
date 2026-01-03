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
        this.socket = null;
        this.login = true;
        this.highlight = false;
        this.keepAliveInterval = null; // Keep-alive timer
        this.keepAliveTimeout = 240000; // Send keep-alive every 4 minutes (240 seconds)
        
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

        // UI preferences
        this.uiPrefs = {
            hideTopic: false,
            hideNicklist: false,
            navLeft: false,
            fontSize: 14,
            hue: 0
        };
        this.optionsMenu = null;
        this.optionsToggle = null;
        
        // Notification system
        this.unreadCounts = new Map(); // Map<tabName, unreadCount>
        this.notificationBadge = null;
        this.notificationButton = null;
        
        // Browser notification manager
        this.notificationManager = null;
        
        // Server PREFIX mapping: modes -> symbols (e.g., 'qaohv' -> '~&@%+')
        this.serverPrefixes = {
            modes: 'ov',
            symbols: '@+'
        };
    }
    
    /**
     * Requests IRC capabilities
     * Note: Backend initiates CAP LS 302 during connection
     * Client tracks requested capabilities and responds to server's CAP messages
     */
    requestCapabilities() {
        this.capNegotiationActive = true;
        
        // List of desired capabilities
        const desiredCaps = [
            'message-tags',
            'away-notify'
        ];
        
        this.capabilities.requested = [...desiredCaps];
    }
    
    /**
     * Processes CAP LS response (available capabilities)
     * @param {Array} caps - Array of available capabilities
     */
    handleCapLS(caps) {
        this.capabilities.available = caps;
        
        // Request only desired capabilities that are actually available
        const toRequest = this.capabilities.requested.filter(cap => caps.includes(cap));
        
        // Also request SASL if it's available (backend may require it)
        if (caps.includes('sasl') && !toRequest.includes('sasl')) {
            toRequest.unshift('sasl');
        }
        
        if (toRequest.length > 0) {
            // Request the available desired capabilities
            if (window.postManager) {
                // Send with / prefix as required by server
                const reqCommand = '/CAP REQ :' + toRequest.join(' ');
                window.postManager.sendRawMessage(reqCommand);
            }
        } else {
            // No capabilities available, end negotiation
            this.endCapNegotiation();
        }
    }
    
    /**
     * Processes CAP ACK response (confirmed capabilities)
     * @param {Array} caps - Array of activated capabilities
     */
    handleCapACK(caps) {
        // Replace capabilities list (not push, to avoid duplicates)
        this.capabilities.enabled = [...new Set([...this.capabilities.enabled, ...caps])];
        
        // Don't show message here - will be shown when negotiation ends
        
        // End CAP negotiation
        this.endCapNegotiation();
    }
    
    /**
     * Processes CAP NAK response (rejected capabilities)
     * @param {Array} caps - Array of rejected capabilities
     */
    handleCapNAK(caps) {
        this.parsePage(this.getTimestamp() + " <span style='color: #ffaa00'>==</span> Capabilities rejected: " + caps.join(', ') + "\n");
        this.addWindow();
        
        // End CAP negotiation even on rejection
        this.endCapNegotiation();
    }
    
    /**
     * Ends CAP negotiation
     */
    endCapNegotiation() {
        if (this.capNegotiationActive) {
            if (window.postManager) {
                window.postManager.sendRawMessage('/CAP END');
            }
            this.capNegotiationActive = false;
            
            // Show all enabled capabilities once at the end
            if (this.capabilities.enabled.length > 0) {
                this.parsePage(this.getTimestamp() + " <span style='color: #00aaff'>==</span> Capabilities enabled: " + this.capabilities.enabled.join(', ') + "\n");
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
        const match = prefixString.match(/^PREFIX=\(([a-z]+)\)(.+)$/i);
        if (match) {
            this.serverPrefixes.modes = match[1];
            this.serverPrefixes.symbols = match[2];
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
                text = `${typingUsersList[0]} is typing`;
            } else if (typingUsersList.length === 2) {
                text = `${typingUsersList[0]} and ${typingUsersList[1]} are typing`;
            } else if (typingUsersList.length === 3) {
                text = `${typingUsersList[0]}, ${typingUsersList[1]} and ${typingUsersList[2]} are typing`;
            } else {
                text = `${typingUsersList.length} users are typing`;
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
        
        // Setup notification button
        if (this.notificationButton) {
            this.notificationButton.addEventListener('click', () => this.toggleNotifications());
        }
        
        // Initialize WebSocket
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsPath = location.pathname.split('/')[1];
        this.socket = new WebSocket(wsProtocol + '//' + location.host + '/' + wsPath + '/Webchat');
        
        this.setupWebSocket();
        this.initializePages();
        this.initNickContextMenu(); // Initialize context menu once
    }
    
    setupWebSocket() {
        this.socket.onopen = (event) => {
            // Request IRCv3 capabilities
            this.requestCapabilities();
            // Start keep-alive mechanism
            this.startKeepAlive();
        };
        
        this.socket.onerror = (errorEvent) => {
            console.error('[WebSocket] Error:', errorEvent);
            const errorMsg = errorEvent.message || errorEvent.type || 'Unknown WebSocket error';
            this.parsePage(this.getTimestamp() + " <span style='color: #ff0000'>==</span> Connection error: " + errorMsg + "\n");
            this.addWindow();
            this.scrollToEnd("#chat_window", 100);
        };
        
        this.socket.onclose = (closeEvent) => {
            // Stop keep-alive
            this.stopKeepAlive();
            
            // Hide loading screen on disconnect
            if (window.ircParser && window.ircParser.hideLoadingScreen) {
                try {
                    window.ircParser.hideLoadingScreen();
                } catch (e) {
                    console.warn('[WebSocket] Error hiding loading screen:', e);
                }
            }
            
            let closeMsg = "Connection to server closed";
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
            
            // Optional: Attempt reconnection
            if (!closeEvent.wasClean && closeEvent.code !== 1000) {
                this.parsePage(this.getTimestamp() + " <span style='color: #ffaa00'>==</span> Connection lost unexpectedly. Please reload the page to reconnect.\n");
                this.addWindow();
            }
        };
        
        this.socket.onmessage = (messageEvent) => {
            try {
                const msg = JSON.parse(messageEvent.data);
                const { message, category, target } = msg;
                
                if (category === "error") {
                    console.error('[WebSocket] Server error:', message);
                    this.parsePage(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Error: " + message + "\n");
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
                    this.parsePage(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Unknown category: " + category + "\n");
                    this.addWindow();
                }
            } catch (error) {
                console.error('[WebSocket] Error parsing message:', error, messageEvent.data);
                this.parsePage(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Error parsing server message: " + error.message + "\n");
                this.addWindow();
            }
        };
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
    
    /**
     * Check if a message is a PING or PONG keep-alive message
     * @param {string} message - The IRC message
     * @returns {boolean} True if it's a keep-alive message
     */
    isKeepAliveMessage(message) {
        const trimmed = (message || '').trim();
        if (!trimmed) {
            return false;
        }

        // Strip IRCv3 message tags (start with @)
        const withoutTags = trimmed.startsWith('@') ? trimmed.slice(trimmed.indexOf(' ') + 1) : trimmed;

        // Check for PING/PONG commands at start (with optional prefix)
        if (/^(:\S+\s+)?PING\s+/i.test(withoutTags)) {
            return true;
        }
        if (/^(:\S+\s+)?PONG\s+/i.test(withoutTags)) {
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
        const trimmed = message.trim();
        // Ignore IRCv3 message tags if present (start with @)
        const withoutTags = trimmed.startsWith('@') ? trimmed.slice(trimmed.indexOf(' ') + 1) : trimmed;

        // PING handling - capture everything after the PING command and echo it back in PONG
        const pingMatch = withoutTags.match(/^(:\S+\s+)?PING\s+(.+)$/i);
        if (pingMatch) {
            const payload = pingMatch[2].trim();
            if (window.postManager) {
                try {
                    // Echo payload as-is to honor IRC PING/PONG rules (preserve colon/trailing)
                    window.postManager.sendRawMessage('/PONG ' + payload);
                } catch (e) {
                    console.error('[IRC Keep-Alive] Error sending PONG:', e);
                }
            }
            return;
        }

        // PONG handling - informational only
        const pongMatch = withoutTags.match(/^(:\S+\s+)?PONG\s+(.+)$/i);
        if (pongMatch) {
        }
    }
    
    initializePages() {
        this.navElement.innerHTML = '';
        window.onbeforeunload = () => "WarnOnClose";
        
        this.addPage('Status', 'status', true);
        this.parsePage(this.getTimestamp() + " jwebirc 2.0\n");
        this.parsePage(this.getTimestamp() + " &copy; 2024-2025 by Andreas Pschorn\n");
        this.parsePage(this.getTimestamp() + " <a href=\"https://github.com/WarPigs1602/jwebirc\" target=\"_blank\">https://github.com/WarPigs1602/jwebirc</a>\n");
        this.parsePage(this.getTimestamp() + " Licensed under the MIT License\n");
        this.parsePage(this.getTimestamp() + " <span style=\"color: #ffaa00\">==</span> Connecting to server, please wait...\n");
        
        // Load saved channels for rejoin
        this.loadSavedChannels();
    }
    
    saveChannelList() {
        // Save the list of channels to localStorage
        const channelList = Array.from(this.joinedChannels);
        sessionStorage.setItem('jwebirc_channels', JSON.stringify(channelList));
    }
    
    loadSavedChannels() {
        // Load saved channels from localStorage
        try {
            const saved = sessionStorage.getItem('jwebirc_channels');
            if (saved) {
                this.joinedChannels = new Set(JSON.parse(saved));
            }
        } catch (e) {
            console.warn('Could not load saved channels:', e);
        }
    }

    loadUiPreferences() {
        try {
            const saved = localStorage.getItem('jwebirc_ui');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.uiPrefs = {
                    ...this.uiPrefs,
                    ...parsed
                };
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
            'navleft': 'navLeft',
            'fontsize': 'fontSize',
            'hue': 'hue'
        };
        
        for (const [urlParam, prefKey] of Object.entries(paramMap)) {
            if (params.has(urlParam)) {
                const value = params.get(urlParam);
                
                // Parse boolean parameters
                if (['hidetopic', 'hidenicklist', 'navleft'].includes(urlParam)) {
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
        const navLeftToggle = document.getElementById('optNavLeft');
        const fontSizeControl = document.getElementById('optFontSize');
        const fontSizeValue = document.getElementById('fontSizeValue');
        const menu = this.optionsMenu;
        const toggle = this.optionsToggle;

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

        if (navLeftToggle) {
            navLeftToggle.checked = this.uiPrefs.navLeft;
            navLeftToggle.addEventListener('change', () => {
                this.uiPrefs.navLeft = navLeftToggle.checked;
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

        if (toggle && menu) {
            const closeMenu = () => {
                menu.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            };

            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !menu.classList.contains('open');
                menu.classList.toggle('open', willOpen);
                toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
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
                        this.showEventBar('Browser notifications were denied', 'error');
                    } else {
                        this.showEventBar('Browser notifications enabled', 'success');
                        this.saveUiPreference('notificationsEnabled', true);
                    }
                } else {
                    this.notificationManager.disable();
                    this.showEventBar('Browser notifications disabled', 'info');
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
        const navLeft = this.uiPrefs.navLeft;
        const fontSize = Math.min(Math.max(this.uiPrefs.fontSize, 12), 18);

        if (container) {
            // Toggle helper classes
            container.classList.toggle('hide-topic', !showTopic);
            container.classList.toggle('hide-nicklist', !showNicklist);
            container.classList.toggle('nav-left', navLeft);

            // Adjust grid layout based on active view
            if (navLeft) {
                if (showTopic && showNicklist) {
                    container.style.gridTemplateColumns = '200px 1fr 220px';
                    container.style.gridTemplateRows = '48px 1fr 64px';
                    container.style.gridTemplateAreas = '"nav topic users" "nav chat users" "nav input users"';
                } else if (!showTopic && showNicklist) {
                    container.style.gridTemplateColumns = '200px 1fr 220px';
                    container.style.gridTemplateRows = '1fr 64px';
                    container.style.gridTemplateAreas = '"nav chat users" "nav input users"';
                } else if (showTopic && !showNicklist) {
                    container.style.gridTemplateColumns = '200px 1fr';
                    container.style.gridTemplateRows = '48px 1fr 64px';
                    container.style.gridTemplateAreas = '"nav topic" "nav chat" "nav input"';
                } else {
                    container.style.gridTemplateColumns = '200px 1fr';
                    container.style.gridTemplateRows = '1fr 64px';
                    container.style.gridTemplateAreas = '"nav chat" "nav input"';
                }
            } else {
                if (showTopic && showNicklist) {
                    container.style.gridTemplateColumns = '1fr 220px';
                    container.style.gridTemplateRows = '36px auto 1fr 60px';
                    container.style.gridTemplateAreas = '"nav nav" "topic topic" "chat users" "input input"';
                } else if (!showTopic && showNicklist) {
                    container.style.gridTemplateColumns = '1fr 220px';
                    container.style.gridTemplateRows = '36px 1fr 60px';
                    container.style.gridTemplateAreas = '"nav nav" "chat users" "input input"';
                } else if (showTopic && !showNicklist) {
                    container.style.gridTemplateColumns = '1fr';
                    container.style.gridTemplateRows = '36px auto 1fr 60px';
                    container.style.gridTemplateAreas = '"nav" "topic" "chat" "input"';
                } else {
                    container.style.gridTemplateColumns = '1fr';
                    container.style.gridTemplateRows = '36px 1fr 60px';
                    container.style.gridTemplateAreas = '"nav" "chat" "input"';
                }
            }
        }

        // Toggle element visibility
        if (this.topicWindow) {
            // Hide topic for Status and Query windows
            const currentChannel = this.channels.find(ch => ch.page === this.activeWindow);
            const hideTopicForWindow = currentChannel && (currentChannel.type === 'status' || currentChannel.type === 'query');
            this.topicWindow.style.display = (showTopic && !hideTopicForWindow) ? '' : 'none';
        }
        if (this.right) {
            // Hide nicklist for Status and Query windows
            const currentChannel = this.channels.find(ch => ch.page === this.activeWindow);
            const hideNicklistForWindow = currentChannel && (currentChannel.type === 'status' || currentChannel.type === 'query');
            this.right.style.display = (showNicklist && !hideNicklistForWindow) ? '' : 'none';
        }

        // Navbar orientation
        if (this.navWindow) {
            this.navWindow.classList.toggle('vertical', navLeft);
        }
        if (this.navTabs) {
            this.navTabs.classList.toggle('vertical', navLeft);
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

        this.saveUiPreferences();
    }
    
    addToChannelMemory(channel) {
        // Add channel to memory
        if (this.isChannel(channel)) {
            this.joinedChannels.add(channel.toLowerCase());
            this.saveChannelList();
        }
    }
    
    removeFromChannelMemory(channel) {
        // Remove channel from memory
        if (this.isChannel(channel)) {
            this.joinedChannels.delete(channel.toLowerCase());
            this.saveChannelList();
        }
    }
    
    rejoinSavedChannels() {
        // Rejoin all saved channels
        if (this.joinedChannels.size > 0 && window.postManager) {
            for (const channel of this.joinedChannels) {
                window.postManager.submitTextMessage("/join " + channel);
            }
        }
    }
    
    parseControl(text) {
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
            if (state.reverse) styles.push('filter: invert(1)');
            if (state.color) styles.push(`color: ${state.color}`);
            if (state.bgcolor) styles.push(`background-color: ${state.bgcolor}`);
            
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
                        if (colorIndex >= 0 && colorIndex < this.colors.length) {
                            state.color = this.colors[colorIndex];
                        }
                        
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
                                if (bgColorIndex >= 0 && bgColorIndex < this.colors.length) {
                                    state.bgcolor = this.colors[bgColorIndex];
                                }
                            }
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
        
        // Return result and trim trailing whitespace/newlines
        const output = result.join('');
        // Remove trailing whitespace including newlines before closing tags
        return output.replace(/\s+(<\/span>)/g, '$1').trim();
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
     * Extrahiert den aktuellen Control Code State aus einem Text
     * @param {string} text - Der Text, aus dem der State extrahiert werden soll
     * @param {object} previousState - Der vorherige State, der aktualisiert werden soll
     * @returns {object} State-Objekt mit aktuellen Formatierungen
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
                        if (colorIndex >= 0 && colorIndex < this.colors.length) {
                            state.color = this.colors[colorIndex];
                        }
                        
                        if (pos < text.length && text[pos] === ',') {
                            pos++;
                            let bgColorStr = '';
                            while (pos < text.length && text[pos] >= '0' && text[pos] <= '9' && bgColorStr.length < 2) {
                                bgColorStr += text[pos];
                                pos++;
                            }
                            if (bgColorStr.length > 0) {
                                const bgColorIndex = parseInt(bgColorStr);
                                if (bgColorIndex >= 0 && bgColorIndex < this.colors.length) {
                                    state.bgcolor = this.colors[bgColorIndex];
                                }
                            }
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
        const nickRegex = /([\s>]|^)([A-Za-z0-9_\-\[\]\\`{|}^]{1,30})([.,:;!?)]?)/g;
        
        const wrapTextNode = (node) => {
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
                return `${prefix}<a href="#" class="nick-link" data-nick="${safeNick}" onclick="return chatManager.handleNickClick('${safeNick}');"${linkStyle}>${nick}</a>${trailing || ''}`;
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
                const raw = entry.nick || '';
                const first = raw.length > 0 ? raw[0] : '';
                const withoutStatus = this.isStatusSymbol(first) ? raw.substring(1) : raw;
                if (withoutStatus.toLowerCase() === target) return true;
            }
        }
        return false;
    }
    
    addNick(channel, nick, host, color, isAway = false) {
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                if (elem.nicks.length === 0) color = this.userColor;
                
                // Extract all status symbols from the beginning of nick
                let status = '';
                while (nick.length > 0 && this.isStatusSymbol(nick[0])) {
                    status += nick[0];
                    nick = nick.substring(1);
                }
                
                // Keep only the highest status (first symbol)
                if (status.length > 0) {
                    status = status[0];
                }
                
                if (nick.length > 15) nick = nick.substring(0, 14);
                
                const fullNick = status + nick;
                if (!elem.nicks.some(e => e.nick === fullNick)) {
                    // Check global away status if not explicitly provided
                    let awayInfo = isAway ? { away: true, reason: '' } : this.awayStatus.get(nick.toLowerCase()) || { away: false, reason: '' };
                    elem.nicks.push({ nick: fullNick, host, color, away: awayInfo.away, awayReason: awayInfo.reason });
                }
            }
        });
        
        this.sortStatus(channel);
        this.renderUserlist(channel);
    }
    
    getRandomColor() {
        const pastelColors = [
            '#a78bfa', '#c084fc', '#e879f9', '#f0abfc', '#fb7185',
            '#fda4af', '#fdba74', '#fcd34d', '#fde047', '#bef264',
            '#86efac', '#6ee7b7', '#5eead4', '#7dd3fc', '#93c5fd',
            '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f9a8d4', '#fbcfe8'
        ];
        return pastelColors[Math.floor(Math.random() * pastelColors.length)];
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
                const status = this.getStatus(channel, nick);
                const parsed = status.length === 1 ? status + nick : nick;
                
                for (const name of elem.nicks) {
                    if (name.nick.toLowerCase() === parsed.toLowerCase()) {
                        const i = elem.nicks.findIndex(data => data.nick === parsed);
                        elem.nicks.splice(i, 1, {
                            nick: parsed,
                            host: host,
                            color: name.color
                        });
                        return;
                    }
                }
            }
        }
    }
    
    setMode(channel, line) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() !== channel.toLowerCase()) continue;
            
            for (const name of elem.nicks) {
                const { nick, host, color } = name;
                let parsed = null;
                
                if (!line.includes(" ")) continue;
                
                const modes = line.split(" ");
                if (!modes[0].includes("-") && !modes[0].includes("+")) continue;
                
                const mode = modes[0].split("");
                let add = false;
                let remove = false;
                let flag = 0;
                let nickname = this.getNick(channel, nick);
                let currentStatus = this.getStatus(channel, nickname);
                let currentStatusMode = currentStatus ? this.getSymbolMode(currentStatus) : '';
                
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
                    
                    if (add) {
                        // Add mode: use new mode if it's higher priority than current
                        const newModeIndex = this.serverPrefixes.modes.indexOf(modeChar);
                        const currentModeIndex = currentStatusMode ? this.serverPrefixes.modes.indexOf(currentStatusMode) : -1;
                        
                        if (currentModeIndex === -1 || newModeIndex < currentModeIndex) {
                            currentStatusMode = modeChar;
                            currentStatus = this.getModeSymbol(modeChar);
                        }
                    } else if (remove) {
                        // Remove mode
                        if (currentStatusMode === modeChar) {
                            // Find next highest mode for this user (check all modes)
                            let nextHighestMode = '';
                            for (let k = 0; k < this.serverPrefixes.modes.length; k++) {
                                const checkMode = this.serverPrefixes.modes[k];
                                if (checkMode !== modeChar) {
                                    // Would need to track all user modes, for now just clear status
                                    nextHighestMode = '';
                                    break;
                                }
                            }
                            currentStatusMode = nextHighestMode;
                            currentStatus = nextHighestMode ? this.getModeSymbol(nextHighestMode) : '';
                        }
                    }
                    
                    parsed = currentStatus + nickname;
                    const i = elem.nicks.findIndex(data => data.nick === nick);
                    elem.nicks.splice(i, 1, { nick: parsed, host, color });
                }
            }
        }
        
        this.sortStatus(channel);
        this.renderUserlist(channel);
    }
    
    delNick(channel, nick) {
        for (const elem of this.channels) {
            const status = this.getStatus(channel, nick);
            const parsed = status && status.length === 1 ? status + nick : nick;
            
            if (elem.page.toLowerCase() === channel.toLowerCase() && elem.nicks.some(e => e.nick === parsed)) {
                const i = elem.nicks.findIndex(data => data.nick === parsed);
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
                
                const nickname = this.getStatus(channel, nick) + nick;
                if (elem.nicks.some(name => name.nick === nickname)) return true;
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
                    // Extract status symbol and nickname
                    let displayNick = nickData.nick;
                    if (displayNick.length > 0 && this.isStatusSymbol(displayNick[0])) {
                        displayNick = displayNick.substring(1);
                    }
                    
                    if (displayNick.toLowerCase() === nick.toLowerCase()) {
                        nickData.away = isAway;
                        nickData.awayReason = reason || '';
                    }
                });
                // Only re-render if we actually updated a nick in this channel
                if (elem.nicks.some(n => {
                    let dn = n.nick;
                    if (dn.length > 0 && this.isStatusSymbol(dn[0])) dn = dn.substring(1);
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
                const parsed = status && status.length === 1 ? status + nick : nick;
                
                if (name.nick.toLowerCase() === parsed.toLowerCase()) {
                    if (this.isChannel(channel)) {
                        const i = elem.nicks.findIndex(data => data.nick === parsed);
                        elem.nicks.splice(i, 1);
                        this.sortStatus(channel);
                        this.renderUserlist(channel);
                    }
                    
                    const reasonText = reason.length !== 0 ? " (" + reason + ")" : "";
                    this.parsePages(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> <span style=\"color: " + color + ";\">" + parsed + "</span> has left IRC" + reasonText + "\n", channel);
                }
            }
        }
    }
    
    changeNick(oldnick, newnick) {
        if (oldnick.toLowerCase() === window.user.toLowerCase()) {
            window.user = newnick;
        }
        
        for (const elem of this.channels) {
            for (const name of elem.nicks) {
                const channel = elem.page;
                const status = this.getStatus(channel, oldnick);
                const parsed = status && status.length === 1 ? status + oldnick : oldnick;
                const parsed2 = status && status.length === 1 ? status + newnick : newnick;
                
                if (name.nick.toLowerCase() === parsed.toLowerCase()) {
                    const { host, color } = name;
                    
                    if (this.isChannel(channel)) {
                        const i = elem.nicks.findIndex(data => data.nick === parsed);
                        elem.nicks.splice(i, 1, { nick: parsed2, host, color });
                        this.sortStatus(channel);
                        this.renderUserlist(channel);
                    }
                    
                    this.parsePages(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> <span style=\"color: " + color + ";\">" + parsed + "</span> has changed his nick to <span style=\"color: " + color + ";\">" + newnick + "</span>\n", channel);
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
                    // Get status symbols
                    const xStatus = x.nick.length > 0 && this.isStatusSymbol(x.nick[0]) ? x.nick[0] : '';
                    const yStatus = y.nick.length > 0 && this.isStatusSymbol(y.nick[0]) ? y.nick[0] : '';
                    
                    // Get status priority (lower index = higher priority)
                    const xPriority = xStatus ? this.serverPrefixes.symbols.indexOf(xStatus) : 999;
                    const yPriority = yStatus ? this.serverPrefixes.symbols.indexOf(yStatus) : 999;
                    
                    // Sort by status priority first
                    if (xPriority !== yPriority) {
                        return xPriority - yPriority;
                    }
                    
                    // Then sort alphabetically by nickname (without status)
                    const xName = xStatus ? x.nick.substring(1) : x.nick;
                    const yName = yStatus ? y.nick.substring(1) : y.nick;
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
                    // Extract status symbol and nickname
                    let statusSymbol = '';
                    let displayNick = nick.nick;
                    
                    if (nick.nick.length > 0 && this.isStatusSymbol(nick.nick[0])) {
                        statusSymbol = nick.nick[0];
                        displayNick = nick.nick.substring(1);
                    }
                    
                    // Create colored status emoji/icon combined with nick
                    let statusHtml = '';
                    if (statusSymbol) {
                        const emoji = this.getStatusEmoji(statusSymbol);
                        statusHtml = `<span class="status-symbol status-${this.getSymbolMode(statusSymbol)}" title="${statusSymbol}">${emoji}</span>`;
                    }
                    
                    // Add away indicator - show as transparent and italic, with away reason in title
                    const awayClass = nick.away ? ' away' : '';
                    const awayTitle = nick.away && nick.awayReason ? ` title="Away: ${nick.awayReason}"` : '';
                    
                    doc.innerHTML += `<span class="nick-entry${awayClass}" data-nick="${displayNick}" style="color: ${nick.color};"${awayTitle}>${statusHtml}<span class="nick-name">${displayNick}</span></span>\n`;
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
        
        if (type !== "channel" || !window.matchMedia("(min-width: 600px)").matches) {
            // Status window or non-channel: use full width
            if (container) container.classList.add('status-view');
            right.forEach(frame => frame.style.cssText = 'display: none;');
            cf.forEach(frame => frame.style.cssText = "right: 3px; top: 25px;");
            tf.forEach(frame => frame.style.cssText = 'display: none;');
        } else {
            // Channel window: show nicklist
            if (container) container.classList.remove('status-view');
            right.forEach(frame => frame.style.cssText = "display: initial;");
            cf.forEach(frame => frame.style.cssText = "right: 200px; top: 47px;");
            tf.forEach(frame => frame.style.cssText = 'display: initial;');
        }
    }
    
    getStatus(channel, nickname) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === channel.toLowerCase()) {
                for (const nick of elem.nicks) {
                    // Check if nick has a status symbol
                    if (nick.nick.length > 0 && this.isStatusSymbol(nick.nick[0])) {
                        const status = nick.nick[0];
                        const name = nick.nick.substring(1);
                        if (name.toLowerCase() === nickname.toLowerCase()) {
                            return status;
                        }
                    } else if (nick.nick.toLowerCase() === nickname.toLowerCase()) {
                        return "";
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
                    // Check with status symbol
                    if (nick.nick.length > 0 && this.isStatusSymbol(nick.nick[0])) {
                        const name = nick.nick.substring(1);
                        if (name.toLowerCase() === nickname.toLowerCase()) {
                            return nick.color;
                        }
                    } else if (nick.nick.toLowerCase() === nickname.toLowerCase()) {
                        return nick.color;
                    }
                }
            }
        }
        return "";
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
                    if (nick.nick.length > 0 && this.isStatusSymbol(nick.nick[0])) {
                        if (nick.nick.toLowerCase() === nickname.toLowerCase()) {
                            status = nick.nick.substring(1);
                        }
                    } else if (nick.nick.toLowerCase() === nickname.toLowerCase()) {
                        status = nick.nick;
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
        
        this.channels.forEach(elem => {
            if (elem.page.toLowerCase() === page.toLowerCase() && elem.type.toLowerCase() !== "status") {
                const i = this.channels.findIndex(data => data.page === page);
                this.channels.splice(i, 1);
            }
        });
        
        this.refreshNav();
        this.setWindow("Status");
    }
    
    refreshNav() {
        for (let i = 0; i < this.channels.length; i++) {
            const isActive = this.channels[i].page === this.activeWindow ? ' active' : '';
            const isUnread = this.unreadCounts.has(this.channels[i].page) ? ' unread' : '';
            
            if (i === 0) {
                this.navElement.innerHTML = `<nv class="${isActive}${isUnread}" onclick="chatManager.setWindow('${this.channels[i].page}');">${this.channels[i].page}</nv> `;
            } else {
                if (this.channels[i].page.startsWith("#") || this.channels[i].page.startsWith("&")) {
                    this.navElement.innerHTML += `<nv class="${isActive}${isUnread}"><span class="tab-label" onclick="chatManager.setWindow('${this.channels[i].page}');">${this.channels[i].page}</span><span class="tab-close" onclick="event.stopPropagation(); postManager.submitTextMessage('/part ${this.channels[i].page} Closed tab!');">✕</span></nv> `;
                } else {
                    this.navElement.innerHTML += `<nv class="${isActive}${isUnread}"><span class="tab-label" onclick="chatManager.setWindow('${this.channels[i].page}');">${this.channels[i].page}</span><span class="tab-close" onclick="event.stopPropagation(); chatManager.delPage('${this.channels[i].page}');">✕</span></nv> `;
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
    
    parsePages(text, pg) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === pg.toLowerCase()) {
                // Don't apply highlight in query windows (private messages)
                const isQuery = elem.type === 'query';
                if (this.highlight && !isQuery) {
                    text = `<span style="color: #ff6b6b; font-weight: 600;">${text}`;
                }
                
                // Parse control codes first, then convert URLs to links
                let parsed = this.parseControl(text);
                parsed = this.parseUrls(parsed, false, pg);
                
                // Filter empty output (only control codes, no visible text)
                if (!this.hasVisibleText(parsed)) {
                    return;
                }
                
                // Update unread count for notifications
                if (pg.toLowerCase() !== this.activeWindow.toLowerCase()) {
                    // Add notification for query (private message) or highlight
                    if (isQuery || this.highlight) {
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
                    }
                }
                
                if (this.highlight && !isQuery) {
                    parsed += "</span>";
                    this.highlight = false;
                } else if (this.highlight && isQuery) {
                    // Reset highlight flag for queries without applying styling
                    this.highlight = false;
                }
                
                // Add line break
                elem.elem.innerHTML += parsed.trimEnd() + "<br>";
                return;
            }
        }
    }
    
    parsePage(text) {
        if (this.highlight) {
            text = `<span style="color: #ff6b6b; font-weight: 600;">${text}`;
        }
        
        for (const elem of this.channels) {
            // Parse control codes first, then convert URLs to links
            let parsed = this.parseControl(text);
            parsed = this.parseUrls(parsed, false, elem.page);
            
            if (this.highlight) {
                parsed += "</span>";
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
            const content = this.getPage(this.activeWindow.toString());
            this.chatWindow.innerHTML = content.innerHTML;
            
            this.channels.forEach(elem => {
                if (elem.page.toLowerCase() === this.activeWindow.toLowerCase()) {
                    this.parseFrame(elem.page, elem.type);
                }
            });
            
            this.sortStatus(this.activeWindow);
            this.renderUserlist(this.activeWindow);
            this.renderTopic(this.activeWindow);
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
    
    getTimestamp() {
        const time = new Date();
        const hour = time.getHours();
        const minute = (time.getMinutes() < 10 ? '0' + time.getMinutes() : time.getMinutes());
        const second = (time.getSeconds() < 10 ? '0' + time.getSeconds() : time.getSeconds());
        return `[${hour}:${minute}:${second}]`;
    }
    
    setWindow(win) {
        this.activeWindow = win;
        this.addWindow();
        this.renderTopic(win); // Update topic for new channel
        this.refreshNav(); // Update navigation to show active tab
        this.updateTypingBar(win); // Update typing indicator for new channel
        
        // Hide topic and nicklist for Status and Query windows
        if (this.chatContainer) {
            const currentChannel = this.channels.find(ch => ch.page === win);
            const isNoUserListWindow = currentChannel && (currentChannel.type === 'status' || currentChannel.type === 'query');
            
            if (isNoUserListWindow) {
                this.chatContainer.classList.add('status-view');
            } else {
                this.chatContainer.classList.remove('status-view');
            }
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
        const targetStatus = this.getStatus(channel, nick);
        
        // Get away status and reason
        const awayInfo = this.awayStatus.get(nick.toLowerCase()) || { away: false, reason: '' };
        
        // Build menu dynamically based on permissions
        const menuItems = [];
        
        // Show away status if user is away
        if (awayInfo.away) {
            menuItems.push({
                icon: '⏸️',
                label: awayInfo.reason || 'Away',
                action: 'none',
                isInfo: true
            });
            menuItems.push({ separator: true });
        }
        
        // Always available: Query, WHOIS, Version
        menuItems.push(
            { icon: '💬', label: 'Private Message', action: 'query' },
            { icon: 'ℹ️', label: 'WHOIS', action: 'whois' },
            { icon: '🔍', label: 'Version', action: 'version' }
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
                    'q': 'Owner',
                    'a': 'Admin',
                    'o': 'Op',
                    'h': 'Half-Op',
                    'v': 'Voice'
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
                        const hasMode = targetStatus === symbol;
                        
                        if (hasMode) {
                            menuItems.push({
                                icon: '⚫',
                                label: `Remove ${label}`,
                                action: 'mode',
                                mode: `-${mode}`,
                                emoji: emoji
                            });
                        } else {
                            menuItems.push({
                                icon: emoji,
                                label: `Give ${label}`,
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
                        { icon: '👢', label: 'Kick', action: 'kick' },
                        { icon: '🚫', label: 'Ban', action: 'ban' },
                        { icon: '⛔', label: 'Kick + Ban', action: 'kickban' }
                    );
                }
            }
        }
        
        // Build HTML
        let html = '';
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
        // Switch to first unread tab
        const firstUnread = this.unreadCounts.keys().next().value;
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
