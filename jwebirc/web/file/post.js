/**
 * jwebirc 2.0 - Message Post Manager Class
 * @author Andreas Pschorn
 * @license MIT
 */

class PostManager {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.messageHistory = [];
        this.messageCounter = 0;
        this.browser = navigator.appName;
        this.messageInput = null;
        this.typingTimer = null;
        this.isTyping = false;
        this.typingTimeout = 4000; // 4 seconds between typing notifications
        
        // Tab completion state
        this.tabState = {
            active: false,
            prefix: '',
            matches: [],
            currentIndex: 0,
            wordStart: 0,
            lastTabTime: 0
        };
    }
    
    initialize() {
        this.messageInput = document.getElementById("message");
    }
    
    clearMessageHistory() {
        this.messageHistory = [];
    }
    
    addMessageHistory(message) {
        this.messageHistory.unshift(message);
    }
    
    submitChatInput(keyEvent) {
        const key = keyEvent.key;
        
        // Send typing notification if message-tags capability is enabled
        if (!['Enter', 'ArrowUp', 'ArrowDown', 'Tab', 'Escape'].includes(key) && 
            !keyEvent.ctrlKey && !keyEvent.altKey && !keyEvent.metaKey) {
            this.sendTypingNotification();
        }
        
        // Navigation keys
        if (key === 'ArrowUp') {
            this.messageUp();
            return true;
        }
        if (key === 'ArrowDown') {
            this.messageDown();
            return true;
        }
        
        // Control keys for IRC formatting
        if (keyEvent.ctrlKey) {
            switch (key) {
                case 'k': this.control(3); return false;   // Color \x03
                case 'b': this.control(2); return false;   // Bold \x02
                case 'i': this.control(29); return false;  // Italic \x1D
                case 'l': this.control(30); return false;  // Strikethrough \x1E
                case 'u': this.control(31); return false;  // Underline \x1F
                case 'm': this.control(17); return false;  // Monospace \x11
                case 'r': this.control(22); return false;  // Reverse \x16
                case 'o': this.control(15); return false;  // Reset \x0F
            }
        }
        
        // Special keys
        if (key === 'Enter') {
            this.sendText();
            return false;
        }
        if (key === 'Tab') {
            this.tab();
            return false;
        }
        
        return true;
    }
    
    focusText() {
        this.clearMessage();
    }
    
    control(code) {
        // Insert control code at cursor position
        const start = this.messageInput.selectionStart;
        const end = this.messageInput.selectionEnd;
        const text = this.messageInput.value;
        const controlChar = String.fromCharCode(code);
        
        this.messageInput.value = text.substring(0, start) + controlChar + text.substring(end);
        
        // Move cursor after inserted control code
        const newPos = start + 1;
        this.messageInput.setSelectionRange(newPos, newPos);
        this.messageInput.focus();
    }
    
    sendText() {
        this.addMessageHistory(this.messageInput.value);
        this.messageCounter = -1;
        
        if (this.messageInput.value !== "") {
            // Send typing=done notification before sending message
            this.sendTypingDone();
            this.submitText();
        }
        this.clearMessage();
    }
    
    submitText() {
        const text = this.parseText(this.messageInput.value);
        if (text) {
            const msg = {
                category: "chat",
                message: text,
                target: ""
            };
            this.chatManager.socket.send(JSON.stringify(msg));
        }
    }
    
    submitTextMessage(text) {
        const parsed = this.parseText(text);
        if (parsed) {
            const msg = {
                category: "chat",
                message: parsed,
                target: ""
            };
            this.chatManager.socket.send(JSON.stringify(msg));
        }
    }
    
    setTextMessage(text) {
        this.messageInput.value = text;
        this.messageInput.focus();
    }
    
    /**
     * Sends typing notification via TAGMSG
     */
    sendTypingNotification() {
        // Check if message-tags capability is enabled
        if (!this.chatManager.hasCapability('message-tags')) {
            return;
        }
        
        const activeWindow = this.chatManager.getActiveWindow();
        
        // Only send for channels and query windows, not for Status
        if (!activeWindow || activeWindow.toLowerCase() === 'status') {
            return;
        }
        
        // Prevent too frequent sending
        if (this.isTyping) {
            return;
        }
        
        this.isTyping = true;
        
        // Send TAGMSG with typing=active tag (IRCv3 client-only-tags)
        const tagmsgCommand = '/@+typing=active TAGMSG ' + activeWindow;
        this.sendRawMessage(tagmsgCommand);
        
        // Reset typing flag after timeout
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }
        
        this.typingTimer = setTimeout(() => {
            this.isTyping = false;
        }, this.typingTimeout);
    }
    
    /**
     * Sends typing=done notification
     */
    sendTypingDone() {
        if (!this.chatManager.hasCapability('message-tags')) {
            return;
        }
        
        const activeWindow = this.chatManager.getActiveWindow();
        
        // Only send for channels and query windows, not for Status
        if (!activeWindow || activeWindow.toLowerCase() === 'status') {
            return;
        }
        
        // Clear typing state
        this.isTyping = false;
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        
        // Send TAGMSG with typing=done tag
        const tagmsgCommand = '/@+typing=done TAGMSG ' + activeWindow;
        this.sendRawMessage(tagmsgCommand);
    }
    
    /**
     * Sends a RAW IRC message without parsing
     * @param {string} rawMessage - The raw IRC message
     */
    sendRawMessage(rawMessage) {
        if (rawMessage && this.chatManager.socket) {
            const msg = {
                category: "chat",
                message: rawMessage,
                target: ""
            };
            this.chatManager.socket.send(JSON.stringify(msg));
        }
    }
    
    parseText(text) {
        const activeWindow = this.chatManager.getActiveWindow();
        
        // Not a command - send as message to current channel
        if (!text.startsWith("/")) {
            if (activeWindow.toLowerCase() !== "status") {
                this.chatManager.setOutput(activeWindow);
                
                if (window.ircParser) {
                    // Set output to the active window before parsing
                    window.ircParser.output = activeWindow;
                    window.ircParser.parseOutput("&lt;<span style=\"color: " + this.chatManager.getColor(activeWindow, window.user) + ";\">" + this.chatManager.getStatus(activeWindow, window.user) + window.user + "</span>&gt; " + this.escapeHtml(text));
                }
                
                this.chatManager.addWindow();
                // Build proper IRC message through ircText to handle special cases
                return this.ircText("/privmsg " + activeWindow + " " + text);
            } else {
                this.chatManager.parsePage(this.chatManager.getTimestamp() + " *** You must start with / in the status window\n");
                this.chatManager.addWindow();
                return null;
            }
        }
        
        // Parse IRC commands
        return this.parseCommand(text, activeWindow);
    }
    
    parseCommand(text, activeWindow) {
        this.chatManager.setOutput(activeWindow);
        
        // CAP commands - send as raw without parsing
        if (text.toUpperCase().startsWith("/CAP ")) {
            const capCommand = text.substring(1); // Remove leading /
            return capCommand;
        }
        
        // Block /LIST command
        if (text.toLowerCase().startsWith("/list")) {
            this.chatManager.parsePage(this.chatManager.getTimestamp() + " <span style=\"color: #ff0000\">==</span> The /LIST command is disabled\n");
            this.chatManager.addWindow();
            return null;
        }
        
        // /QUERY command - open private chat
        if (text.startsWith("/query ")) {
            const nick = text.substring(7).trim().split(" ")[0];
            if (nick && nick.length > 0) {
                if (!this.chatManager.isPage(nick)) {
                    this.chatManager.addPage(nick, "query", true);
                } else {
                    this.chatManager.setWindow(nick);
                }
                // Display message in the query window itself
                this.chatManager.setOutput(nick);
                this.chatManager.parsePages(this.chatManager.getTimestamp() + " <span style=\"color: #00ff00\">==</span> Query window opened for " + nick + "\n", nick);
                this.chatManager.addWindow();
            } else {
                this.chatManager.parsePage(this.chatManager.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Usage: /query <nick>\n");
                this.chatManager.addWindow();
            }
            return null;
        }
        
        if (text.startsWith("/names ") || text.startsWith("/who ")) {
            return this.ircText(text);
        }
        
        if (text.startsWith("/kick ")) {
            const content = text.substring(6).trim();
            this.chatManager.addWindow();
            
            // Parse the content to check if channel is already specified
            const parts = content.split(' ');
            
            let finalCommand;
            // If first part starts with # or &, it's already a full command
            if (parts.length > 0 && (parts[0].startsWith('#') || parts[0].startsWith('&'))) {
                // Already has channel: /kick #channel nick [reason]
                finalCommand = "/kick " + content;
            } else {
                // No channel, add current window: /kick nick [reason]
                finalCommand = "/kick " + activeWindow + " " + content;
            }
            
            return this.ircText(finalCommand);
        }
        
        if (text.startsWith("/away ")) {
            const content = text.substring(6);
            this.chatManager.addWindow();
            return this.ircText("/away " + this.escapeHtml(content));
        }
        
        if (text.startsWith("/me ")) {
            const content = text.substring(4);
            if (window.ircParser) {
                window.ircParser.output = activeWindow;
                window.ircParser.parseOutput("* <span style=\"color: " + this.chatManager.getColor(activeWindow, window.user) + ";\">" + this.chatManager.getStatus(activeWindow, window.user) + window.user + "</span> " + content);
            }
            this.chatManager.addWindow();
            return this.ircText("/privmsg " + activeWindow + " " + String.fromCharCode(1) + "ACTION " + this.escapeHtml(content) + String.fromCharCode(1));
        }
        
        if (text.startsWith("/msg ")) {
            const content = text.substring(5);
            const target = content.split(" ", 1)[0];
            const message = content.substring(target.length + 1);
            if (window.ircParser) {
                window.ircParser.output = activeWindow;
                window.ircParser.parseOutput("&raquo; " + target + " " + message);
            }
            this.chatManager.addWindow();
            return this.ircText("/privmsg " + target + " " + this.escapeHtml(message));
        }
        
        if (text.startsWith("/notice ")) {
            const content = text.substring(8);
            const target = content.split(" ", 1)[0];
            const message = content.substring(target.length + 1);
            if (window.ircParser) {
                window.ircParser.output = activeWindow;
                window.ircParser.parseOutput("-" + target + "- " + message);
            }
            this.chatManager.addWindow();
            return this.ircText("/notice " + target + " " + this.escapeHtml(message));
        }
        
        if (text.startsWith("/part ")) {
            const content = text.substring(6);
            const target = content.split(" ", 1)[0];
            const reason = content.substring(target.length);
            this.chatManager.setWindow(target);
            if (window.ircParser) {
                window.ircParser.output = target;
                window.ircParser.parseOutput("*** " + window.user + " has left " + target);
            }
            this.chatManager.addWindow();
            return this.ircText("/part " + target + " " + this.escapeHtml(reason));
        }
        
        if (text.startsWith("/hop")) {
            // /hop command - leave and rejoin channel
            const args = text.substring(4).trim();
            let channel = args;
            
            if (!channel || channel.length === 0) {
                // No channel specified, use active window
                channel = activeWindow;
            }
            
            // Check if it's a valid channel
            if (!this.chatManager.isChannel(channel)) {
                this.chatManager.parsePage(this.chatManager.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Invalid channel: " + channel + "\n");
                this.chatManager.addWindow();
                return null;
            }
            
            this.chatManager.setWindow(channel);
            this.chatManager.addWindow();
            
            // Send PART followed by JOIN
            const partCommand = this.ircText("/part " + channel);
            const joinCommand = this.ircText("/join " + channel);
            
            // Send both commands
            if (partCommand) {
                const msg = {
                    category: "chat",
                    message: partCommand,
                    target: ""
                };
                this.chatManager.socket.send(JSON.stringify(msg));
            }
            
            // Delay JOIN to ensure PART completes first
            setTimeout(() => {
                if (joinCommand) {
                    const msg = {
                        category: "chat",
                        message: joinCommand,
                        target: ""
                    };
                    this.chatManager.socket.send(JSON.stringify(msg));
                }
            }, 500);
            
            return null;
        }
        
        if (text.startsWith("/quit ")) {
            const content = text.substring(6);
            if (window.ircParser) {
                window.ircParser.output = activeWindow;
                window.ircParser.parseOutput("*** " + window.user + " has quit IRC (Quit: " + this.escapeHtml(content) + ")");
            }
            this.chatManager.addWindow();
            return this.ircText("/quit " + this.escapeHtml(content));
        }
        
        // CTCP commands
        if (text.toLowerCase().startsWith("/ctcp ")) {
            return this.handleCtcpCommand(text, activeWindow);
        }
        
        // Shortcut CTCP commands
        if (text.toLowerCase().startsWith("/version ")) {
            const target = text.substring(9).trim();
            return this.sendCtcp(target, "VERSION");
        }
        
        if (text.toLowerCase().startsWith("/time ")) {
            const target = text.substring(6).trim();
            return this.sendCtcp(target, "TIME");
        }
        
        if (text.toLowerCase().startsWith("/ping ")) {
            const target = text.substring(6).trim();
            const timestamp = Date.now().toString();
            return this.sendCtcp(target, "PING", timestamp);
        }
        
        if (text.toLowerCase().startsWith("/clientinfo ")) {
            const target = text.substring(12).trim();
            return this.sendCtcp(target, "CLIENTINFO");
        }
        
        return this.ircText(text);
    }
    
    /**
     * Handles generic /ctcp command
     * @param {string} text - The full command text
     * @param {string} activeWindow - The active window
     * @returns {string} The IRC command to send
     */
    handleCtcpCommand(text, activeWindow) {
        const parts = text.substring(6).trim().split(" ");
        if (parts.length < 2) {
            this.chatManager.parsePage(this.chatManager.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Usage: /ctcp <target> <command> [args]\n");
            this.chatManager.addWindow();
            return null;
        }
        
        const target = parts[0];
        const command = parts[1].toUpperCase();
        const args = parts.slice(2).join(" ");
        
        return this.sendCtcp(target, command, args);
    }
    
    /**
     * Sends a CTCP request
     * @param {string} target - The target nick or channel
     * @param {string} command - The CTCP command
     * @param {string} args - Optional arguments
     * @returns {string} The IRC command to send
     */
    sendCtcp(target, command, args = "") {
        if (!target || target.length === 0) {
            this.chatManager.parsePage(this.chatManager.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Error: No target specified\n");
            this.chatManager.addWindow();
            return null;
        }
        
        const ctcpMessage = args ? `${command} ${args}` : command;
        
        // Display sent CTCP request
        if (window.ircParser) {
            window.ircParser.output = this.chatManager.getActiveWindow();
            window.ircParser.parseOutput(` <span style="color: #00aaff">==</span> CTCP ${command} request sent to <span style="font-weight: bold;">${target}</span>${args ? ': ' + args : ''}`);
        }
        this.chatManager.addWindow();
        
        // Send as PRIVMSG with \001 delimiters
        return `/privmsg ${target} :${String.fromCharCode(1)}${ctcpMessage}${String.fromCharCode(1)}`;
    }
    
    ircText(text) {
        const content = text.split(" ");
        let result = "";
        
        for (let i = 0; i < content.length; i++) {
            // Add colon (:) before message content
            if (i === 1 && (text.toLowerCase().startsWith("/quit") || text.toLowerCase().startsWith("/away"))) {
                result += " :";
            } else if (i === 2 && text.toLowerCase().startsWith("/privmsg")) {
                result += " :";
            } else if (i === 2 && text.toLowerCase().startsWith("/notice")) {
                result += " :";
            } else if (i === 3 && text.toLowerCase().startsWith("/kick")) {
                // For kick: /kick #channel nick :reason
                // Add colon before the reason (4th element onwards)
                result += " :";
            } else if (i === 2 && content.length !== 3 && 
                       !text.toLowerCase().startsWith("/mode") && 
                       !text.toLowerCase().startsWith("/away") && 
                       !text.toLowerCase().startsWith("/quit") && 
                       !text.toLowerCase().startsWith("/kick")) {
                result += " :";
            } else {
                result += " ";
            }
            result += content[i];
        }
        
        return result.trim();
    }
    
    clearMessage() {
        this.messageInput.value = "";
        this.messageInput.focus();
    }
    
    emoticon(text) {
        this.messageInput.value += text;
        this.messageInput.focus();
    }
    
    messageUp() {
        this.resetTabCompletion();
        this.messageCounter++;
        if (this.messageCounter < this.messageHistory.length) {
            this.messageInput.value = this.messageHistory[this.messageCounter];
            this.messageInput.selectionStart = this.messageInput.value.length;
            this.messageInput.selectionEnd = this.messageInput.value.length;
            this.messageInput.focus();
        } else {
            this.messageCounter = this.messageHistory.length - 1;
        }
    }
    
    messageDown() {
        this.resetTabCompletion();
        if (this.messageCounter <= 0) {
            this.messageInput.value = "";
            this.messageCounter = -1;
        } else {
            this.messageCounter--;
            this.messageInput.value = this.messageHistory[this.messageCounter];
            this.messageInput.selectionStart = this.messageInput.value.length;
            this.messageInput.selectionEnd = this.messageInput.value.length;
        }
        this.messageInput.focus();
    }
    
    tab() {
        const text = this.messageInput.value;
        let cursorPos = this.messageInput.selectionStart;
        const now = Date.now();
        
        // Special case: If cursor is right after ": " (from previous tab completion)
        // move cursor back before the ": " to enable cycling
        if (cursorPos >= 2 && text.substring(cursorPos - 2, cursorPos) === ': ') {
            cursorPos -= 2;
        }
        
        // Find start of current word
        let wordStart = cursorPos;
        while (wordStart > 0 && text[wordStart - 1] !== ' ') {
            wordStart--;
        }
        
        // Extract current word and check for suffix
        const currentWord = text.substring(wordStart, cursorPos);
        const hasSuffix = text.substring(cursorPos, cursorPos + 2) === ': ';
        
        // Determine if this is a continuation (cycling) or new completion
        const timeDiff = now - this.tabState.lastTabTime;
        const isSamePosition = this.tabState.wordStart === wordStart;
        const isRecent = timeDiff < 2000; // 2 seconds window for cycling
        
        if (this.tabState.active && isSamePosition && isRecent) {
            // Cycle to next match
            this.tabState.currentIndex = (this.tabState.currentIndex + 1) % this.tabState.matches.length;
        } else {
            // Start new completion
            this.tabState.prefix = currentWord;
            this.tabState.matches = this.chatManager.getTabCompletions(currentWord);
            this.tabState.wordStart = wordStart;
            this.tabState.currentIndex = 0;
            this.tabState.active = true;
            
            if (this.tabState.matches.length === 0) {
                this.tabState.active = false;
                this.tabState.lastTabTime = now;
                return;
            }
        }
        
        // Get completion
        const completion = this.tabState.matches[this.tabState.currentIndex];
        
        // Build replacement
        const isLineStart = wordStart === 0;
        const replacement = isLineStart ? completion + ': ' : completion;
        
        // Determine end position (include suffix if present)
        const endPos = hasSuffix ? cursorPos + 2 : cursorPos;
        
        // Replace text
        const newText = text.substring(0, wordStart) + replacement + text.substring(endPos);
        this.messageInput.value = newText;
        
        // Position cursor right after the completion (before ": " if at line start)
        const newCursorPos = wordStart + (isLineStart ? completion.length : replacement.length);
        this.messageInput.setSelectionRange(newCursorPos, newCursorPos);
        
        this.tabState.lastTabTime = now;
    }
    
    resetTabCompletion() {
        this.tabState = {
            active: false,
            prefix: '',
            matches: [],
            currentIndex: 0,
            wordStart: 0,
            lastTabTime: 0
        };
    }
    
    escapeHtml(text) {
        // Preserve IRC control codes while escaping HTML
        const controlCodes = [0x02, 0x03, 0x0F, 0x11, 0x16, 0x1D, 0x1E, 0x1F];
        let result = '';
        
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            if (controlCodes.includes(charCode)) {
                // Keep control codes as-is
                result += text[i];
                // If it's a color code, preserve following digits and comma
                if (charCode === 0x03) {
                    i++;
                    while (i < text.length) {
                        const nextChar = text[i];
                        if (nextChar >= '0' && nextChar <= '9') {
                            result += nextChar;
                            i++;
                        } else if (nextChar === ',' && i + 1 < text.length && 
                                 text[i + 1] >= '0' && text[i + 1] <= '9') {
                            result += nextChar;
                            i++;
                        } else {
                            i--;
                            break;
                        }
                    }
                }
            } else {
                // Escape HTML special characters
                switch (text[i]) {
                    case '<': result += '&lt;'; break;
                    case '>': result += '&gt;'; break;
                    case '&': result += '&amp;'; break;
                    case '"': result += '&quot;'; break;
                    case "'": result += '&#39;'; break;
                    default: result += text[i];
                }
            }
        }
        
        return result;
    }
    
    unescapeHtml(text) {
        const element = document.createElement("p");
        element.innerHTML = text;
        return element.childNodes.length === 0 ? "" : element.childNodes[0].nodeValue;
    }
}

// Initialize Post Manager after DOM is ready and chatManager is defined
let postManager = null;
function initializePostManager() {
    if (typeof chatManager !== 'undefined' && postManager === null) {
        postManager = new PostManager(chatManager);
        postManager.initialize();
        window.postManager = postManager;
    }
}

// Ensure postManager is initialized when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePostManager);
} else {
    initializePostManager();
}

// Initialize IRC Parser (after irc.js has been loaded)
if (window.IRCParser) {
    const ircParser = new window.IRCParser(chatManager);
    window.ircParser = ircParser;
} else {
    console.warn('[IRC Parser] IRCParser class not found - IRC message parsing will not work');
}

// Legacy functions for compatibility
let message = document.getElementById("message");
function clearMessageHistory() { postManager.clearMessageHistory(); }
function addMessageHistory(msg) { postManager.addMessageHistory(msg); }
function submitChatInput(keyEvent) { return postManager.submitChatInput(keyEvent); }
function focusText() { postManager.focusText(); }
function control(code) { postManager.control(code); }
function sendText() { postManager.sendText(); }
function submitText() { postManager.submitText(); }
function submitTextMessage(text) { postManager.submitTextMessage(text); }
function setTextMessage(text) { postManager.setTextMessage(text); }
function parseText(text) { return postManager.parseText(text); }
function ircText(text) { return postManager.ircText(text); }
function clearMessage() { postManager.clearMessage(); }
function emoticon(text) { postManager.emoticon(text); }
function messageUp() { postManager.messageUp(); }
function messageDown() { postManager.messageDown(); }
function tab() { postManager.tab(); }
function escapeHtml(text) { return postManager.escapeHtml(text); }
function unescapeHtml(text) { return postManager.unescapeHtml(text); }
