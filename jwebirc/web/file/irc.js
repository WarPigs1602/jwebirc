/**
 * jwebirc 2.0 - IRC Protocol Parser Class
 * @author Andreas Pschorn
 * @license MIT
 */

class IRCParser {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.output = 'Status';
        this.login = true;
        this.channel = window.chan || '';
        this.user = window.user || '';
    }
    
    parseOutput(text) {
        // Check for message tags (IRCv3)
        let tags = null;
        if (text.startsWith('@')) {
            const spaceIndex = text.indexOf(' ');
            if (spaceIndex > 0) {
                tags = this.parseMessageTags(text.substring(1, spaceIndex));
                text = text.substring(spaceIndex + 1);
                
                // Handle typing notification (tagmsg with typing tag)
                if (tags.has('typing') || tags.has('+typing')) {
                    // Check if this is a TAGMSG command
                    const parts = text.split(' ');
                    if (parts.length >= 3 && parts[1] === 'TAGMSG') {
                        const typingState = tags.get('typing') || tags.get('+typing') || 'active';
                        this.handleTypingTag(text, typingState);
                        return;
                    }
                }
            }
        }
        
        const output = this.getNumerics(text.toString());
        if (!output) return;
        
        if (this.chatManager.getActiveWindow()) {
            for (const channel of this.chatManager.channels) {
                if (this.output.toLowerCase() === channel.page.toLowerCase()) {
                    this.chatManager.parsePages(this.chatManager.getTimestamp() + " " + output.trim() + "\n", channel.page);
                }
            }
        } else {
            this.chatManager.parsePage(this.chatManager.getTimestamp() + " " + output.trim() + "\n");
        }
    }
    
    getNumerics(text) {
        const arr = text.split(" ");
        const regex = /^[\d]+$/;
        
        // CAP handling (IRCv3 Capabilities)
        if (arr[0].startsWith(':') && arr[1] === 'CAP') {
            this.handleCap(arr);
            return null;
        }
        
        // TAGMSG handling (IRCv3 message tags)
        if (arr[0].startsWith(':') && arr[1] === 'TAGMSG') {
            // TAGMSG is handled in parseOutput before getNumerics is called
            // But we should still process it here if tags are present
            return null;
        }
        
        // PING handling
        if (arr[0].toLowerCase() === "ping") {
            if (window.postManager) window.postManager.submitTextMessage("/pong " + arr[1]);
            return null;
        }
        
        // ERROR handling
        if (arr[0].toLowerCase() === "error") {
            this.output = this.chatManager.getActiveWindow();
            return this.formatError(arr.slice(1).join(" "));
        }
        
        // NOTICE AUTH handling
        if (arr[0].toLowerCase() === "notice" && arr[1].toLowerCase() === "auth") {
            const parsed = arr.slice(2).join(" ");
            this.output = "Status";
            
            if (this.isHostnameLookupMessage(parsed.trim())) {
                this.chatManager.parsePage(this.chatManager.getTimestamp() + " <span style=\"color: #ff0000\">==</span> " + parsed.trim() + "\n");
                return null;
            }
            return " <span style=\"color: #ff0000\">==</span> " + parsed.trim();
        }
        
        // Numeric replies
        if (arr[1].match(regex)) {
            return this.handleNumericReply(arr, text);
        }
        
        // Command handling
        return this.handleCommand(arr, text);
    }
    
    handleNumericReply(arr, text) {
        const code = arr[1];
        let parsed = "";
        
        switch (code) {
            case "005": // Server features (ISUPPORT)
                // Parse PREFIX parameter
                for (let i = 3; i < arr.length; i++) {
                    if (arr[i].startsWith('PREFIX=')) {
                        this.chatManager.parseServerPrefix(arr[i]);
                    }
                }
                return this.handleGenericNumeric(arr, code, text);
                
            case "353": // Names list
                const channel = arr[4];
                for (let i = 5; i < arr.length; i++) {
                    this.chatManager.addNick(channel, arr[i], "", this.chatManager.getRandomColor());
                }
                return null;
                
            case "332": // Topic
                this.chatManager.setTopic(arr[3], text.substring(text.indexOf(arr[3]) + arr[3].length + 1));
                return null;
                
            case "333": // Topic info
                this.chatManager.updateTopic(arr[3], arr[4], arr[5]);
                return null;
                
            case "366": // End of names
            case "315": // End of WHO
                return null;
                
            case "352": // WHO reply
                this.chatManager.setHost(arr[3], arr[7], arr[4] + "@" + arr[5]);
                return null;
                
            case "311": // WHOIS user
                this.output = this.chatManager.getActiveWindow();
                return this.formatWhoisUser(arr);
                
            case "319": // WHOIS channels
                this.output = this.chatManager.getActiveWindow();
                return this.formatWhoisChannels(arr);
                
            case "001": // Welcome
                this.output = this.chatManager.getActiveWindow();
                this.chatManager.parsePage(this.chatManager.getTimestamp() + " <span style=\"color: #ff0000\">==</span> Signed on!\n");
                return null;
                
            case "375": // MOTD start
                this.output = "Status";
                parsed = arr.slice(3).join(" ");
                return " <span style=\"color: #00aaff\">==</span> " + parsed.trim();
                
            case "372": // MOTD line - preserve formatting
                this.output = "Status";
                // Get the full MOTD line after the nickname
                const motdLine = text.substring(text.indexOf(arr[3]));
                // Remove leading ":" and ":- " or ":" prefix if present
                const cleanedMotd = motdLine.replace(/^:\s*-?\s*/, '');
                // Use <pre> tag to preserve whitespace and formatting
                return " <span style=\"color: #00aaff\">==</span> <span style=\"font-family: monospace; white-space: pre;\">" + cleanedMotd + "</span>";
                
            case "376": // MOTD end
                this.output = "Status";
                parsed = arr.slice(3).join(" ");
                this.autoJoinAfterLogin();
                return " <span style=\"color: #00aaff\">==</span> " + parsed.trim();
                
            case "422": // No MOTD
                this.output = "Status";
                parsed = arr.slice(3).join(" ");
                this.autoJoinAfterLogin();
                return " <span style=\"color: #00aaff\">==</span> " + parsed.trim();
                
            default:
                return this.handleGenericNumeric(arr, code, text);
        }
    }
    
    handleCommand(arr, text) {
        const command = arr[1].toLowerCase();
        
        switch (command) {
            case "notice":
                return this.handleNotice(arr);
            case "mode":
                return this.handleMode(arr);
            case "topic":
                return this.handleTopic(arr);
            case "quit":
                this.handleQuit(arr);
                return null;
            case "kill":
                return null;
            case "nick":
                this.handleNick(arr);
                return null;
            case "invite":
                this.handleInvite(arr);
                return null;
            case "join":
                return this.handleJoin(arr);
            case "part":
                return this.handlePart(arr);
            case "kick":
                return this.handleKick(arr);
            case "privmsg":
                return this.handlePrivmsg(arr, text);
            default:
                return text;
        }
    }
    
    handleNotice(arr) {
        const nick = this.parseNick(arr[0]);
        const message = arr.slice(3).join(" ");
        
        this.output = arr[0] === nick ? "Status" : nick;
        
        if (!this.chatManager.isPage(this.output)) {
            this.chatManager.addPage(this.output, "query", false);
        }
        
        return `-${nick}- ${message}`;
    }
    
    autoJoinAfterLogin() {
        if (this.login) {
            
            if (this.channel.length !== 0 && window.postManager) {
                const channelsToJoin = this.chatManager.parseChannels(this.channel);
                window.postManager.submitTextMessage("/join " + channelsToJoin);
            }
            
            this.login = false;
        }
    }
    
    handleMode(arr) {
        const nick = this.parseNick(arr[0]);
        const message = arr.slice(3).join(" ");
        
        if (arr[2] === nick) {
            this.output = "Status";
            return " <span style=\"color: #ff0000\">==</span> Usermode change: " + message.trim();
        } else {
            this.output = arr[2];
            const status = this.chatManager.getStatus(arr[2], nick);
            const color = this.chatManager.getColor(arr[2], nick);
            this.chatManager.setMode(arr[2], message.trim());
            return ` <span style="color: #ff0000">==</span> <span style="color: ${color};">${status}${nick}</span> sets mode: ${message.trim()}`;
        }
    }
    
    handleTopic(arr) {
        const nick = this.parseNick(arr[0]);
        const message = arr.slice(3).join(" ");
        const color = this.chatManager.getColor(arr[2], nick);
        const status = this.chatManager.getStatus(arr[2], nick);
        
        this.output = arr[2];
        this.chatManager.setTopic(this.output, message);
        return ` <span style="color: #ff0000">==</span> <span style="color: ${color};">${status}${nick}</span> sets topic: ${message.trim()}`;
    }
    
    handleQuit(arr) {
        const nick = this.parseNick(arr[0]);
        const reason = arr.slice(2).join(" ");
        this.chatManager.quit(nick, reason.trim());
    }
    
    handleNick(arr) {
        const oldnick = this.parseNick(arr[0]);
        this.chatManager.changeNick(oldnick, arr[2]);
    }
    
    handleInvite(arr) {
        const nick = this.parseNick(arr[0]);
        this.output = this.chatManager.getActiveWindow();
        
        if (window.user.toLowerCase() === arr[2].toLowerCase()) {
            this.chatManager.parsePage(this.chatManager.getTimestamp() + ` <span style="color: #ff0000">==</span> ${nick} has you invited to: ${arr[3]}\n`);
        } else {
            this.chatManager.parsePage(this.chatManager.getTimestamp() + ` <span style="color: #ff0000">==</span> You have ${arr[2]} invited to: ${arr[3]}\n`);
        }
    }
    
    handleJoin(arr) {
        const nick = this.parseNick(arr[0]);
        const host = this.parseHost(arr[0]);
        const color = this.chatManager.getRandomColor();
        
        if (window.user.toLowerCase() === nick.toLowerCase()) {
            const channel = arr[2];
            if (this.chatManager.isPage(channel)) {
                this.chatManager.delPage(channel);
            }
            this.chatManager.addPage(channel, 'channel', true);
            this.chatManager.userColor = color;
            this.output = channel;
            
            if (window.postManager) {
                window.postManager.submitTextMessage("/who " + channel);
            }
        } else {
            this.output = arr[2];
            this.chatManager.addNick(arr[2], nick, host, color);
        }
        
        return ` <span style="color: #ff0000">==</span> <span style="color: ${color};">${nick}</span> [${host}] has joined ${arr[2]}`;
    }
    
    handlePart(arr) {
        const nick = this.parseNick(arr[0]);
        const color = this.chatManager.getColor(arr[2], nick);
        const status = this.chatManager.getStatus(arr[2], nick);
        const reason = arr.slice(3).join(" ");
        const host = this.parseHost(arr[0]);
        
        if (window.user.toLowerCase() === nick.toLowerCase()) {
            this.output = this.chatManager.getActiveWindow();
            this.chatManager.delPage(arr[2]);
        } else {
            this.output = arr[2];
        }
        
        this.chatManager.delNick(arr[2], nick);
        const reasonText = reason.trim().length !== 0 ? " (" + reason.trim() + ")" : "";
        return ` <span style="color: #ff0000">==</span> <span style="color: ${color};">${status}${nick}</span> [${host}] has left ${arr[2]}${reasonText}`;
    }
    
    handleKick(arr) {
        const nick = this.parseNick(arr[0]);
        const color = this.chatManager.getColor(arr[2], arr[3]);
        const status = this.chatManager.getStatus(arr[2], arr[3]);
        const reason = arr.slice(4).join(" ");
        const host = this.parseHost(arr[0]);
        
        this.output = window.user.toLowerCase() === nick.toLowerCase() ? this.chatManager.getActiveWindow() : arr[2];
        this.chatManager.delNick(arr[2], arr[3]);
        
        const reasonText = reason.trim().length !== 0 ? " (" + reason.trim() + ")" : "";
        return ` <span style="color: #ff0000">==</span> <span style="color: ${this.chatManager.getColor(arr[2], nick)};">${this.chatManager.getStatus(arr[2], nick)}${nick}</span> [${host}] has kicked <span style="color: ${color};">${status}${arr[3]}</span>${reasonText}`;
    }
    
    handlePrivmsg(arr, text) {
        const nick = this.parseNick(arr[0]);
        this.output = (arr[2].startsWith("#") || arr[2].startsWith("&")) ? arr[2] : nick;
        
        if (!this.chatManager.isPage(this.output)) {
            this.chatManager.addPage(this.output, "query", true);
        }
        
        const message = arr.slice(3).join(" ").trim();
        
        // Only highlight in channels, not in private queries
        if (text.toLowerCase().includes(window.user.toLowerCase()) && (arr[2].startsWith("#") || arr[2].startsWith("&"))) {
            this.chatManager.setHighlight(true);
        }
        
        // ACTION message
        if (message.startsWith(String.fromCharCode(1) + "ACTION ") && message.endsWith(String.fromCharCode(1))) {
            return `* <span style="color: ${this.chatManager.getColor(arr[2], nick)};">${this.chatManager.getStatus(arr[2], nick)}${nick}</span> ${message.substring(8, message.length - 1)}`;
        } else {
            return `&lt;<span style="color: ${this.chatManager.getColor(arr[2], nick)};">${this.chatManager.getStatus(arr[2], nick)}${nick}</span>&gt; ${message}`;
        }
    }
    
    handleGenericNumeric(arr, code, text) {
        this.output = this.chatManager.getActiveWindow();
        
        // Parse from original text to preserve the full message
        // Format: :server CODE nickname [params...] [:trailing message]
        // We need to find everything after the third space (after nickname)
        
        let spaceCount = 0;
        let startIndex = 0;
        
        for (let i = 0; i < text.length; i++) {
            if (text[i] === ' ') {
                spaceCount++;
                if (spaceCount === 3) {
                    startIndex = i + 1;
                    break;
                }
            }
        }
        
        if (startIndex > 0 && startIndex < text.length) {
            let parsed = text.substring(startIndex);
            
            // Remove leading : from the trailing parameter if present
            // Example: ":server 396 nick hostname :message" -> "hostname message"
            const colonIndex = parsed.indexOf(':');
            if (colonIndex !== -1) {
                parsed = parsed.substring(0, colonIndex) + parsed.substring(colonIndex + 1);
            }
            
            return " <span style=\"color: #ff0000\">==</span> " + parsed.trim();
        }
        
        // Fallback
        return " <span style=\"color: #ff0000\">==</span> " + text;
    }
    
    formatError(message) {
        return `<span style="color: #ff0000"> <span style="color: #ff0000">==</span> Error: ${message.trim()}</span>`;
    }
    
    formatWhoisUser(arr) {
        const nick = arr[3];
        const host = arr[4] + "@" + arr[5];
        const realname = arr.slice(7).join(" ");
        return ` <span style="color: #ff0000">==</span> <span style="font-weight: bold;">${nick}</span> [${host}]\n${this.chatManager.getTimestamp()} <span style="color: #ff0000">==</span> <p style="width: 80px; display: inline-block;">&nbsp;realname</p> : ${realname.trim()}`;
    }
    
    formatWhoisChannels(arr) {
        const channels = arr.slice(4).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        return ` <span style="color: #ff0000">==</span> <p style="width: 80px; display: inline-block;">&nbsp;channels</p> : ${channels.join(" ")}`;
    }
    
    isHostnameLookupMessage(message) {
        return message === "*** (jwebirc) Found your hostname." || 
               message === "*** (jwebirc) No hostname found." ||
               message === "*** (mwebirc) Found your hostname." || 
               message === "*** (mwebirc) No hostname found.";
    }
    
    parseNick(nick) {
        return nick.includes("!") ? nick.split("!", 2)[0] : nick;
    }
    
    parseHost(nick) {
        return nick.includes("!") ? nick.split("!", 2)[1] : nick;
    }
    
    /**
     * Parses IRC message tags (IRCv3)
     * @param {string} tagsString - The tags string
     * @returns {Map} Map with tag names and values
     */
    parseMessageTags(tagsString) {
        const tags = new Map();
        const pairs = tagsString.split(';');
        
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            tags.set(key, value || true);
        }
        
        return tags;
    }
    
    /**
     * Processes typing notification TAGMSG
     * @param {string} message - The TAGMSG message
     */
    handleTypingTag(message, typingState = 'active') {
        const parts = message.split(' ');
        if (parts.length < 3) {
            return;
        }
        
        const nick = this.parseNick(parts[0]);
        const command = parts[1];
        const target = parts[2];
        
        if (command === 'TAGMSG') {
            // Check if target is a channel or our nickname (private message)
            if (target.startsWith('#') || target.startsWith('&')) {
                // Typing notification for a channel
                this.chatManager.handleTypingNotification(target, nick, typingState);
            } else if (target.toLowerCase() === this.user.toLowerCase()) {
                // Typing notification for a private message (query)
                // The target is our nickname, so the typing indicator should appear in the query window with the sender
                this.chatManager.handleTypingNotification(nick, nick, typingState);
            }
        }
    }
    
    /**
     * Processes CAP (Capability) responses
     * @param {Array} arr - Array with CAP message
     */
    handleCap(arr) {
        // Expected format: :server CAP <target> <subcommand> :cap1 cap2
        if (arr.length < 4) return;
        
        // Support both formats:
        // :server CAP <target> LS :cap1 cap2
        // :server CAP LS :cap1 cap2 (no explicit target)
        let target = arr[2];
        let subcommand = arr[3];
        let capsString = arr.slice(4).join(' ');
        
        const maybeSub = arr[2].toUpperCase();
        if (['LS', 'ACK', 'NAK', 'LIST', 'NEW', 'DEL'].includes(maybeSub)) {
            // No target present; shift indices left
            target = '*';
            subcommand = arr[2];
            capsString = arr.slice(3).join(' ');
        }
        // Remove leading colon from entire string
        const cleanCaps = capsString.startsWith(':') ? capsString.substring(1) : capsString;
        // Split, remove empty parts, leading ':' per cap and continuation marker '*'
        const caps = cleanCaps
            .split(' ')
            .map(cap => cap.startsWith(':') ? cap.substring(1) : cap)
            .filter(cap => cap.length > 0 && cap !== '*');
        
        switch (subcommand) {
            case 'LS':
                // Server lists available capabilities
                this.chatManager.handleCapLS(caps);
                break;
            case 'ACK':
                // Server confirms capabilities
                this.chatManager.handleCapACK(caps);
                break;
            case 'NAK':
                // Server rejects capabilities
                this.chatManager.handleCapNAK(caps);
                break;
            case 'LIST':
                // List of active capabilities
                break;
            case 'NEW':
                // New capabilities available
                break;
            case 'DEL':
                // Capabilities no longer available
                break;
        }
    }
}

// Initialize IRC Parser
const ircParser = new IRCParser(chatManager);
window.ircParser = ircParser;

// Legacy functions for compatibility
function parse_output(text) { ircParser.parseOutput(text); }
function get_numerics(text) { return ircParser.getNumerics(text); }
function parse_nick(nick) { return ircParser.parseNick(nick); }
function parse_host(nick) { return ircParser.parseHost(nick); }
