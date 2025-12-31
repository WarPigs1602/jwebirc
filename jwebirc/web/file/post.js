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
            const content = text.substring(6);
            this.chatManager.addWindow();
            return this.ircText("/kick " + activeWindow + " " + this.escapeHtml(content));
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
        
        if (text.startsWith("/quit ")) {
            const content = text.substring(6);
            if (window.ircParser) {
                window.ircParser.output = activeWindow;
                window.ircParser.parseOutput("*** " + window.user + " has quit IRC (Quit: " + this.escapeHtml(content) + ")");
            }
            this.chatManager.addWindow();
            return this.ircText("/quit " + this.escapeHtml(content));
        }
        
        return this.ircText(text);
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
            } else if (i === 2 && content.length !== 3 && 
                       !text.toLowerCase().startsWith("/mode") && 
                       !text.toLowerCase().startsWith("/away") && 
                       !text.toLowerCase().startsWith("/quit") && 
                       !text.toLowerCase().startsWith("/kick")) {
                result += " :";
            } else if (i === 3 && text.toLowerCase().startsWith("/kick")) {
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
        this.messageCounter++;
        if (this.messageCounter < this.messageHistory.length) {
            this.messageInput.value = this.messageHistory[this.messageCounter];
            this.messageInput.focus();
        }
    }
    
    messageDown() {
        if (this.messageCounter <= 0) {
            this.messageInput.value = "";
        } else {
            this.messageCounter--;
            this.messageInput.value = this.messageHistory[this.messageCounter];
            this.messageInput.focus();
        }
    }
    
    tab() {
        const msg = this.messageInput.value;
        let content = "";
        
        if (msg.includes(" ")) {
            const arr = msg.split(" ");
            const parse = arr[arr.length - 1];
            arr[arr.length - 1] = this.chatManager.parseTab(parse, false);
            content = arr.join(" ");
        } else {
            content = this.chatManager.parseTab(msg, true);
        }
        
        this.messageInput.value = content;
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

// Initialize Post Manager
const postManager = new PostManager(chatManager);
postManager.initialize();
window.postManager = postManager;

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
