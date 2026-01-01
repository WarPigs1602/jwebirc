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
        
        // DOM elements
        this.navWindow = null;
        this.right = null;
        this.chatWindow = null;
        this.topicWindow = null;
        this.navElement = document.createElement("nv");
        this.eventBar = null;
        this.eventBarTimeout = null;
        this.typingBar = null;
        this.typingUsers = new Map(); // Map<channel, Map<user, timeout>>
        this.typingTimeout = 5000; // 5 seconds until typing indicator disappears
        this.awayStatus = new Map(); // Map<nick, boolean> - track away status for all nicks
        this.joinedChannels = new Set(); // Set of channels to rejoin on next login
        this.capabilities = {
            requested: [],
            available: [],
            enabled: []
        };
        this.capNegotiationActive = false;
        
        // Server PREFIX mapping: modes -> symbols (e.g., 'qaohv' -> '~&@%+')
        this.serverPrefixes = {
            modes: 'ov',
            symbols: '@+'
        };
    }
    
    /**
     * Requests IRC capabilities
     * Note: Server initiates CAP LS 302 if SASL is enabled
     * Client only responds to CAP messages from server
     */
    requestCapabilities() {
        this.capNegotiationActive = true;
        
        // List of desired capabilities
        const desiredCaps = [
            'message-tags',
            'away-notify'
        ];
        
        this.capabilities.requested = [...desiredCaps];
        // Server will send CAP LS 302, we respond to it
    }
    
    /**
     * Processes CAP LS response (available capabilities)
     * @param {Array} caps - Array of available capabilities
     */
    handleCapLS(caps) {
        console.log('[CAP] Server capabilities:', caps);
        this.capabilities.available = caps;
        
        // Request only desired capabilities that are actually available
        const toRequest = this.capabilities.requested.filter(cap => caps.includes(cap));
        console.log('[CAP] Requested caps that are available:', toRequest);
        
        // Also request SASL if it's available (backend may require it)
        if (caps.includes('sasl') && !toRequest.includes('sasl')) {
            toRequest.unshift('sasl');
            console.log('[CAP] Added SASL to request');
        }
        
        if (toRequest.length > 0) {
            // Request the available desired capabilities
            if (window.postManager) {
                // Send with / prefix as required by server
                const reqCommand = '/CAP REQ :' + toRequest.join(' ');
                console.log('[CAP] Sending:', reqCommand);
                window.postManager.sendRawMessage(reqCommand);
            }
        } else {
            // No capabilities available, end negotiation
            console.log('[CAP] No desired capabilities available, ending negotiation');
            this.endCapNegotiation();
        }
    }
    
    /**
     * Processes CAP ACK response (confirmed capabilities)
     * @param {Array} caps - Array of activated capabilities
     */
    handleCapACK(caps) {
        console.log('[CAP] ACK received for:', caps);
        // Replace capabilities list (not push, to avoid duplicates)
        this.capabilities.enabled = [...new Set([...this.capabilities.enabled, ...caps])];
        
        // Don't show message here - will be shown when negotiation ends
        
        // End CAP negotiation
        console.log('[CAP] Ending negotiation after ACK');
        this.endCapNegotiation();
    }
    
    /**
     * Processes CAP NAK response (rejected capabilities)
     * @param {Array} caps - Array of rejected capabilities
     */
    handleCapNAK(caps) {
        console.log('[CAP] NAK received for:', caps);
        this.parsePage(this.getTimestamp() + " <span style='color: #ffaa00'>==</span> Capabilities rejected: " + caps.join(', ') + "\n");
        this.addWindow();
        
        // End CAP negotiation even on rejection
        console.log('[CAP] Ending negotiation after NAK');
        this.endCapNegotiation();
    }
    
    /**
     * Ends CAP negotiation
     */
    endCapNegotiation() {
        console.log('[CAP] endCapNegotiation called, active:', this.capNegotiationActive);
        if (this.capNegotiationActive) {
            if (window.postManager) {
                console.log('[CAP] Sending CAP END');
                window.postManager.sendRawMessage('/CAP END');
            }
            this.capNegotiationActive = false;
            
            // Show all enabled capabilities once at the end
            if (this.capabilities.enabled.length > 0) {
                console.log('[CAP] Enabled capabilities:', this.capabilities.enabled);
                this.parsePage(this.getTimestamp() + " <span style='color: #00aaff'>==</span> Capabilities enabled: " + this.capabilities.enabled.join(', ') + "\n");
                this.addWindow();
            } else {
                console.log('[CAP] No capabilities were enabled');
            }
        } else {
            console.log('[CAP] Negotiation already ended, skipping');
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
        this.right = document.getElementById("right");
        this.chatWindow = document.getElementById("chat_window");
        this.topicWindow = document.getElementById("topic_window");
        this.eventBar = document.getElementById("eventBar");
        this.typingBar = document.getElementById("typingBar");
        
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
            console.log('[WebSocket] Connection opened');
            // Request IRCv3 capabilities
            this.requestCapabilities();
        };
        
        this.socket.onerror = (errorEvent) => {
            console.error('[WebSocket] Error:', errorEvent);
            const errorMsg = errorEvent.message || errorEvent.type || 'Unknown WebSocket error';
            this.parsePage(this.getTimestamp() + " <span style='color: #ff0000'>==</span> Connection error: " + errorMsg + "\n");
            this.addWindow();
            this.scrollToEnd("#chat_window", 100);
        };
        
        this.socket.onclose = (closeEvent) => {
            console.log('[WebSocket] Connection closed. Code:', closeEvent.code, 'Reason:', closeEvent.reason);
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
                        if (window.ircParser) {
                            // If target is "active", force output to active window
                            if (target === "active") {
                                const activeWindow = this.getActiveWindow();
                                if (activeWindow) {
                                    window.ircParser.output = activeWindow;
                                }
                            }
                            window.ircParser.parseOutput(message);
                        }
                        this.addWindow();
                    }
                } else {
                    console.warn('[WebSocket] Unknown category:', category);
                    this.parsePage(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Unknown category: " + category + "\n");
                    this.addWindow();
                }
            } catch (error) {
                console.error('[WebSocket] Error parsing message:', error);
                this.parsePage(this.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Error parsing server message: " + error.message + "\n");
                this.addWindow();
            }
        };
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
        
        return result.join('').trim();
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
    
    escapeHtml(text) {
        // Don't escape HTML - allow existing HTML tags to pass through
        // This preserves link formatting and other HTML from parsePages
        return text;
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
                    let awayStatus = isAway || this.awayStatus.get(nick.toLowerCase()) || false;
                    elem.nicks.push({ nick: fullNick, host, color, away: awayStatus });
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
    
    setAwayStatus(nick, isAway) {
        // Store away status in global map (for WHO queries before nicks are added)
        this.awayStatus.set(nick.toLowerCase(), isAway);
        
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
    
    parseUrl(url) {
        try {
            const link = new URL(url);
            return `<a href="${link.href}" target="_blank">${link.href}</a>`;
        } catch (err) {
            return url;
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
                    
                    // Add away indicator - only show as transparent and italic
                    const awayClass = nick.away ? ' away' : '';
                    
                    doc.innerHTML += `<span class="nick-entry${awayClass}" data-nick="${displayNick}" style="color: ${nick.color};">${statusHtml}<span class="nick-name">${displayNick}</span></span>\n`;
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
            for (const elem of this.channels) {
                if (elem.page.toLowerCase().startsWith(prefixLower)) {
                    completions.push(elem.page);
                }
            }
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
                let parsed = "";
                
                const arr = text.includes(" ") ? text.split(" ") : [text];
                for (const part of arr) {
                    if (part.startsWith("http://") || part.startsWith("https://")) {
                        parsed += this.parseUrl(part);
                        if (part.endsWith("\n")) parsed += "\n";
                    } else {
                        parsed += part;
                    }
                    if (arr.length > 1) parsed += " ";
                }
                
                const topic = this.parseControl(parsed.trim());
                const wrapper = document.createElement("div");
                wrapper.className = "topic-wrapper";
                wrapper.innerHTML = topic && topic.length !== 0 
                    ? channel + ":&nbsp;" + topic 
                    : channel + ":&nbsp;(No topic set)";
                
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
            
            if (i === 0) {
                this.navElement.innerHTML = `<nv class="${isActive}" onclick="chatManager.setWindow('${this.channels[i].page}');">${this.channels[i].page}</nv> `;
            } else {
                if (this.channels[i].page.startsWith("#") || this.channels[i].page.startsWith("&")) {
                    this.navElement.innerHTML += `<nv class="${isActive}"><span class="tab-label" onclick="chatManager.setWindow('${this.channels[i].page}');">${this.channels[i].page}</span><span class="tab-close" onclick="event.stopPropagation(); postManager.submitTextMessage('/part ${this.channels[i].page} Closed tab!');">✕</span></nv> `;
                } else {
                    this.navElement.innerHTML += `<nv class="${isActive}"><span class="tab-label" onclick="chatManager.setWindow('${this.channels[i].page}');">${this.channels[i].page}</span><span class="tab-close" onclick="event.stopPropagation(); chatManager.delPage('${this.channels[i].page}');">✕</span></nv> `;
                }
            }
        }
        
        while (this.navWindow.firstChild) {
            this.navWindow.removeChild(this.navWindow.firstChild);
        }
        this.navWindow.appendChild(this.navElement);
    }
    
    parsePages(text, pg) {
        for (const elem of this.channels) {
            if (elem.page.toLowerCase() === pg.toLowerCase()) {
                // Don't apply highlight in query windows (private messages)
                const isQuery = elem.type === 'query';
                if (this.highlight && !isQuery) {
                    text = `<span style="color: #ff6b6b; font-weight: 600;">${text}`;
                }
                
                const arr = text.includes(" ") ? text.split(" ") : [text];
                let parsed = "";
                
                for (const part of arr) {
                    if (part.startsWith("http://") || part.startsWith("https://")) {
                        parsed += this.parseUrl(part);
                        if (part.endsWith("\n")) parsed += "\n";
                    } else {
                        parsed += part;
                    }
                    if (arr.length > 1) parsed += " ";
                }
                
                parsed = this.parseControl(parsed.trim());
                
                if (this.highlight && !isQuery) {
                    parsed += "</span>";
                    this.highlight = false;
                } else if (this.highlight && isQuery) {
                    // Reset highlight flag for queries without applying styling
                    this.highlight = false;
                }
                
                elem.elem.innerHTML += parsed.trim() + "\n";
                return;
            }
        }
    }
    
    parsePage(text) {
        if (this.highlight) {
            text = `<span style="color: #ff6b6b; font-weight: 600;">${text}`;
        }
        
        for (const elem of this.channels) {
            const arr = text.includes(" ") ? text.split(" ") : [text];
            let parsed = "";
            
            for (const part of arr) {
                if (part.startsWith("http://") || part.startsWith("https://")) {
                    const cleanPart = part.endsWith("\n") ? part.substring(0, part.length - 1) : part;
                    parsed += this.parseUrl(cleanPart);
                    if (part.endsWith("\n")) parsed += "\n";
                } else {
                    parsed += part;
                }
                if (arr.length > 1) parsed += " ";
            }
            
            parsed = this.parseControl(parsed.trim());
            
            if (this.highlight) {
                parsed += "</span>";
                this.highlight = false;
            }
            
            elem.elem.innerHTML += parsed.trim() + "\n";
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
        
        // Build menu dynamically based on permissions
        const menuItems = [];
        
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
            } else {
                html += `<div class="nick-context-menu-item" data-action="${item.action}" data-mode="${item.mode || ''}">
                    <span class="menu-icon">${item.icon}</span>
                    <span>${item.label}</span>
                </div>`;
            }
        });
        
        menu.innerHTML = html;
        
        // Re-attach event handlers
        menu.querySelectorAll('.nick-context-menu-item').forEach(item => {
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
                        console.log(`[handleNickAction] Sending command: /kick ${channel} ${nick} ${reason}`);
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
}

// Initialize ChatManager
const chatManager = new ChatManager();

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => chatManager.initialize());
} else {
    chatManager.initialize();
}

// Legacy function exports for compatibility
function set_window(win) { chatManager.setWindow(win); }
function get_user() { return window.user; }
function submitTextMessage(text) { if (window.postManager) window.postManager.submitTextMessage(text); }
function del_page(page) { chatManager.delPage(page); }
function parse_output(text) { if (window.ircParser) window.ircParser.parseOutput(text); }
function add_nick(channel, nick, host, color) { chatManager.addNick(channel, nick, host, color); }
function getRandomColor() { return chatManager.getRandomColor(); }
