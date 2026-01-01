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
        
        // WHO command queue to avoid flooding the server
        this.whoQueue = [];
        this.whoTimer = null;
        this.whoDelay = 2000; // 2 seconds delay between WHO commands
    }
    
    /**
     * Parse IRC message according to RFC 1459
     * Format: [:prefix] <command> [params...] [:trailing]
     * Returns: { prefix, command, params }
     */
    parseIrcMessage(text) {
        let prefix = null;
        let trailing = null;
        let idx = 0;
        
        // Parse prefix
        if (text[0] === ':') {
            const spaceIdx = text.indexOf(' ');
            if (spaceIdx > 0) {
                prefix = text.substring(1, spaceIdx);
                idx = spaceIdx + 1;
            }
        }
        
        // Find trailing (everything after " :")
        const trailingIdx = text.indexOf(' :', idx);
        if (trailingIdx !== -1) {
            trailing = text.substring(trailingIdx + 2);
            text = text.substring(idx, trailingIdx);
        } else {
            text = text.substring(idx);
        }
        
        // Parse command and middle params
        const parts = text.trim().split(' ');
        const command = parts[0];
        const params = parts.slice(1);
        
        // Add trailing as last param if it exists
        if (trailing !== null) {
            params.push(trailing);
        }
        
        return { prefix, command, params };
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
        
        // Parse IRC message properly
        const ircMsg = this.parseIrcMessage(text);
        
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
        if (arr[1] && arr[1].match(regex)) {
            return this.handleNumericReply(arr, text, ircMsg);
        }

        // Command handling
        return this.handleCommand(arr, text);
    }

    handleNumericReply(arr, text, ircMsg) {
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
                return this.handleGenericNumeric(arr, code, text, ircMsg);
                
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
                // :server 352 client-nick channel username host server nick flags :hopcount realname
                const whoNick = arr[7];
                const whoFlags = arr[8] || '';
                this.chatManager.setHost(arr[3], whoNick, arr[4] + "@" + arr[5]);
                const isAway = whoFlags.includes('G');
                this.chatManager.setAwayStatus(whoNick, isAway);
                return null;
                
            case "311": // WHOIS user
                this.output = this.chatManager.getActiveWindow();
                return this.formatWhoisUser(arr);
                
            case "319": // WHOIS channels
                this.output = this.chatManager.getActiveWindow();
                return this.formatWhoisChannels(arr);

            case "312": { // WHOIS server
                this.output = this.chatManager.getActiveWindow();
                const server = arr[4];
                const info = arr.slice(5).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">server</span> : ${server}${info ? ' (' + info + ')' : ''}`;
            }

            case "313": { // WHOIS operator
                this.output = this.chatManager.getActiveWindow();
                const info = arr.slice(4).join(" ").replace(/^:/, '').trim();
                const suffix = info ? ` (${info})` : '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">operator</span> : ${arr[3]}${suffix}`;
            }

            case "317": { // WHOIS idle / signon
                this.output = this.chatManager.getActiveWindow();
                const idleSeconds = parseInt(arr[4] || '0', 10);
                const signonTs = parseInt(arr[5] || '0', 10) * 1000;
                const idleText = isNaN(idleSeconds) ? '-' : `${idleSeconds}s`;
                const signonText = signonTs > 0 ? new Date(signonTs).toLocaleString() : '-';
                const timestamp = this.chatManager ? this.chatManager.getTimestamp() : '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">idle</span> : ${idleText}\n${timestamp} <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">signon</span> : ${signonText}`;
            }

            case "330": { // WHOIS logged in as (authname)
                this.output = this.chatManager.getActiveWindow();
                const authAs = arr[4];
                const info = arr.slice(5).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">auth</span> : ${arr[3]} is logged in as ${authAs}${info ? ' (' + info + ')' : ''}`;
            }

            case "307": { // WHOIS registered nick (often 307)
                this.output = this.chatManager.getActiveWindow();
                const info = arr.slice(4).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">registered</span> : ${arr[3]}${info ? ' (' + info + ')' : ''}`;
            }

            case "320": { // WHOIS additional info (identified, etc.)
                this.output = this.chatManager.getActiveWindow();
                // Format: :server 320 nick target :info message
                const nick = arr[3];
                const info = arr.slice(4).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">info</span> : ${nick} ${info}`;
            }

            case "343": { // WHOIS oper type (RPL_WHOISOPERNAME)
                this.output = this.chatManager.getActiveWindow();
                // Format: :server 343 nick target :is opered as opertype
                const nick = arr[3];
                const info = arr.slice(4).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">operator</span> : ${nick}`;
            }

            case "327": { // WHOIS real host/vhost
                this.output = this.chatManager.getActiveWindow();
                const info = arr.slice(3).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">vhost</span> : ${info}`;
            }

            case "275": // Certificate fingerprint
            case "276": { // Client certificate
                this.output = this.chatManager.getActiveWindow();
                const info = arr.slice(3).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">certificate</span> : ${info}`;
            }

            case "318": { // End of WHOIS
                this.output = this.chatManager.getActiveWindow();
                const info = arr.slice(3).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> ${info}`;
            }

            case "301": { // WHOIS away
                this.output = this.chatManager.getActiveWindow();
                const nick = arr[3];
                const awayMsg = arr.slice(4).join(" ").replace(/^:/, '').trim();
                if (this.chatManager) {
                    this.chatManager.setAwayStatus(nick, true, awayMsg);
                }
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">away</span> : ${nick}${awayMsg ? ' (' + awayMsg + ')' : ''}`;
            }

            case "338": { // WHOIS actual host/IP
                this.output = this.chatManager.getActiveWindow();
                const info = arr.slice(4).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">actual host</span> : ${info}`;
            }

            case "378": { // WHOIS connecting from
                this.output = this.chatManager.getActiveWindow();
                const info = arr.slice(3).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">connecting</span> : ${info}`;
            }

            case "379": { // WHOIS modes
                this.output = this.chatManager.getActiveWindow();
                const info = arr.slice(3).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">modes</span> : ${info}`;
            }

            case "671": { // WHOIS secure connection (SSL/TLS)
                this.output = this.chatManager.getActiveWindow();
                const info = arr.slice(3).join(" ").replace(/^:/, '').trim();
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">secure</span> : ${info}`;
            }
                
            case "001": // Welcome
                this.output = "Status";
                return " <span style=\"color: #ff0000\">==</span> Signed on!";
                
            case "375": // MOTD start
                this.output = "Status";
                parsed = arr.slice(3).join(" ");
                return " <span style=\"color: #00aaff\">==</span> " + parsed.trim();
                
            case "372": // MOTD line - preserve formatting
                this.output = "Status";
                // Get the full MOTD line after the nickname
                const motdLine = text.substring(text.indexOf(arr[3]));
                const cleanedMotd = motdLine.replace(/^:\s*-?\s*/, '');
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
                return this.handleGenericNumeric(arr, code, text, ircMsg);
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
            case "away":
                this.handleAway(arr);
                return null;
            case "chghost":
                return this.handleChghost(arr);
            case "privmsg":
                return this.handlePrivmsg(arr, text);
            default:
                return text;
        }
    }

    handleNotice(arr) {
        const nick = this.parseNick(arr[0]);
        let message = arr.slice(3).join(" ");

        // Remove leading : if present (IRC protocol format)
        if (message.startsWith(':')) {
            message = message.substring(1);
        }

        // Debug log - show full message
        const firstChar = message.length > 0 ? message.charCodeAt(0) : -1;
        const lastChar = message.length > 0 ? message.charCodeAt(message.length - 1) : -1;
        console.log('NOTICE from', nick);
        console.log('  Message:', message);
        console.log('  Length:', message.length);
        console.log('  First char code:', firstChar, 'Last char code:', lastChar);
        console.log('  Starts with \\001?', firstChar === 1, 'Ends with \\001?', lastChar === 1);

        // Check for CTCP reply (NOTICE with \001 delimiters)
        // Note: The ending \001 might be lost due to split(" ") parsing
        if (message.startsWith(String.fromCharCode(1))) {
            console.log('✓ Detected CTCP reply - calling handleCtcpReply');
            // Add ending \001 if missing
            if (!message.endsWith(String.fromCharCode(1))) {
                message = message + String.fromCharCode(1);
                console.log('  Added missing ending \\001');
            }
            return this.handleCtcpReply(nick, message);
        }

        // Server notices should go to Status window, not create new query windows
        if (nick.includes('.') || nick === 'Server' || arr[0] === nick) {
            this.output = "Status";
        } else {
            this.output = nick;
            if (!this.chatManager.isPage(this.output)) {
                this.chatManager.addPage(this.output, "query", false);
            }
        }

        // Display normal NOTICE message
        return `-${nick}- ${message}`;
    }
    
    autoJoinAfterLogin() {
        if (this.login) {
            
            if (this.channel.length !== 0 && window.postManager) {
                const channelsToJoin = this.chatManager.parseChannels(this.channel);
                window.postManager.submitTextMessage("/join " + channelsToJoin);
            }
            
            // Rejoin previously saved channels
            if (this.chatManager && window.postManager) {
                this.chatManager.rejoinSavedChannels();
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
            
            // Save channel to memory for next login
            this.chatManager.addToChannelMemory(channel);
            
            // Queue WHO command with delay to avoid flooding the server
            if (window.postManager) {
                this.queueWhoCommand(channel);
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
            this.chatManager.delPage(arr[2]);
            // Remove channel from memory when leaving
            this.chatManager.removeFromChannelMemory(arr[2]);
            this.output = this.chatManager.getActiveWindow();
            // Refresh the active window display after closing the channel
            this.chatManager.addWindow();
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
        
        // If our user was kicked, remove from channel memory
        if (window.user.toLowerCase() === arr[3].toLowerCase()) {
            this.chatManager.delPage(arr[2]);
            this.chatManager.removeFromChannelMemory(arr[2]);
            this.output = this.chatManager.getActiveWindow();
            // Refresh the active window display after closing the channel
            this.chatManager.addWindow();
        } else {
            this.output = arr[2];
        }
        this.chatManager.delNick(arr[2], arr[3]);
        
        const reasonText = reason.trim().length !== 0 ? " (" + reason.trim() + ")" : "";
        return ` <span style="color: #ff0000">==</span> <span style="color: ${this.chatManager.getColor(arr[2], nick)};">${this.chatManager.getStatus(arr[2], nick)}${nick}</span> [${host}] has kicked <span style="color: ${color};">${status}${arr[3]}</span>${reasonText}`;
    }
    
    handleAway(arr) {
        // AWAY command format: :nick!user@host AWAY :away message
        // or: :nick!user@host AWAY (when coming back)
        const nick = this.parseNick(arr[0]);
        const isAway = arr.length > 2 && arr[2] !== '';
        const awayMsg = isAway ? arr.slice(2).join(" ").replace(/^:/, '').trim() : '';
        
        // Update away status for this nick in all channels
        if (this.chatManager) {
            this.chatManager.setAwayStatus(nick, isAway, awayMsg);
        }
    }
    
    handleChghost(arr) {
        // CHGHOST command format: :nick!user@host CHGHOST new-user new-host
        // arr[0] = :nick!user@host
        // arr[1] = CHGHOST
        // arr[2] = new-user
        // arr[3] = new-host
        const nick = this.parseNick(arr[0]);
        const newUser = arr[2] || '';
        const newHost = arr[3] || '';
        const newHostMask = newUser + "@" + newHost;
        
        // Update host in all channels where the nick appears and announce in each common channel
        if (this.chatManager) {
            const channelsWithNick = [];
            for (const channel of this.chatManager.channels) {
                if (channel.type !== 'channel') continue;
                let found = false;
                for (const nickData of channel.nicks) {
                    let displayNick = nickData.nick;
                    if (displayNick.length > 0 && this.chatManager.isStatusSymbol(displayNick[0])) {
                        displayNick = displayNick.substring(1);
                    }
                    
                    if (displayNick.toLowerCase() === nick.toLowerCase()) {
                        nickData.host = newHostMask;
                        found = true;
                    }
                }
                if (found) {
                    channelsWithNick.push(channel.page);
                    this.chatManager.renderUserlist(channel.page);
                }
            }
            
            // Announce in all common channels
            const stamp = this.chatManager.getTimestamp();
            for (const channelName of channelsWithNick) {
                const nickColor = this.chatManager.getColor(channelName, nick);
                const msg = ` <span style=\"color: #ff0000\">==</span> <span style=\"color: ${nickColor};\">${nick}</span> has changed host to ${newUser}@${newHost}`;
                this.chatManager.parsePages(`${stamp} ${msg}\n`, channelName);
            }
        }
        
        // Handled manually above
        return null;
    }
    
    handlePrivmsg(arr, text) {
        const nick = this.parseNick(arr[0]);
        
        let message = arr.slice(3).join(" ").trim();
        
        // Remove leading : if present (IRC protocol format)
        if (message.startsWith(':')) {
            message = message.substring(1).trim();
        }
        
        // Debug log - show full message
        const firstChar = message.length > 0 ? message.charCodeAt(0) : -1;
        const lastChar = message.length > 0 ? message.charCodeAt(message.length - 1) : -1;
        console.log('PRIVMSG from', nick);
        console.log('  Message:', message);
        console.log('  Length:', message.length);
        console.log('  First char code:', firstChar, 'Last char code:', lastChar);
        console.log('  Starts with \\001?', firstChar === 1, 'Ends with \\001?', lastChar === 1);
        
        // Check for CTCP request BEFORE creating query window
        // Note: The ending \001 might be lost due to split(" ") parsing
        if (message.startsWith(String.fromCharCode(1))) {
            console.log('✓ Detected CTCP request');
            // Add ending \001 if missing
            if (!message.endsWith(String.fromCharCode(1))) {
                message = message + String.fromCharCode(1);
                console.log('  Added missing ending \\001');
            }
            const ctcpContent = message.substring(1, message.length - 1);
            
            // ACTION is displayed differently - needs proper output
            if (ctcpContent.startsWith("ACTION ")) {
                this.output = (arr[2].startsWith("#") || arr[2].startsWith("&")) ? arr[2] : nick;
                if (!this.chatManager.isPage(this.output)) {
                    this.chatManager.addPage(this.output, "query", true);
                }
                return `* <span style="color: ${this.chatManager.getColor(this.output, nick)};">${this.chatManager.getStatus(this.output, nick)}${nick}</span> ${ctcpContent.substring(7)}`;
            }
            
            // Other CTCP requests - display in active window (no query window)
            const ctcpParts = ctcpContent.split(" ");
            const ctcpCommand = ctcpParts[0];
            const ctcpArgs = ctcpParts.slice(1).join(" ");
            
            // Display CTCP requests in active window
            this.output = this.chatManager.getActiveWindow();
            
            return ` <span style="color: #ff0000">==</span> CTCP ${ctcpCommand} request from <span style="color: ${this.chatManager.getColor(this.output, nick)};">${nick}</span>${ctcpArgs ? ': ' + ctcpArgs : ''}`;
        }
        
        // Normal message - set output and create page if needed
        this.output = (arr[2].startsWith("#") || arr[2].startsWith("&")) ? arr[2] : nick;
        
        if (!this.chatManager.isPage(this.output)) {
            this.chatManager.addPage(this.output, "query", true);
        }
        
        // Highlight in channels when user is mentioned, or for private messages
        if (arr[2].startsWith("#") || arr[2].startsWith("&")) {
            // Channel message - highlight if user is mentioned
            if (text.toLowerCase().includes(window.user.toLowerCase())) {
                this.chatManager.setHighlight(true);
            }
        } else {
            // Private message - always highlight
            this.chatManager.setHighlight(true);
        }
        
        return `&lt;<span style="color: ${this.chatManager.getColor(arr[2], nick)};">${this.chatManager.getStatus(arr[2], nick)}${nick}</span>&gt; ${message}`;
    }
    
    handleGenericNumeric(arr, code, text, ircMsg) {
        this.output = this.chatManager.getActiveWindow();
        
        const numCode = parseInt(code);
        
        // For error codes (4xx, 5xx), use arr array
        // Format: ["server", "CODE", "nickname", ...params]
        if (numCode >= 400 && numCode <= 599) {
            // Join everything from index 3 onwards (skip server, code, nickname)
            if (arr.length > 3) {
                const params = arr.slice(3);
                
                // Remove consecutive duplicates (e.g., "#channel #channel" -> "#channel")
                const filtered = params.filter((item, index) => {
                    return index === 0 || item !== params[index - 1];
                });
                
                // Remove leading ':' from first param if present
                if (filtered.length > 0 && filtered[0].startsWith(':')) {
                    filtered[0] = filtered[0].substring(1);
                }
                
                const message = filtered.join(' ');
                return " <span style=\"color: #ff0000\">==</span> " + message;
            }
        }
        
        // For other numerics
        if (arr.length > 3) {
            let message = arr.slice(3).join(' ');
            // Remove leading ':' from message if present
            if (message.startsWith(':')) {
                message = message.substring(1);
            }
            return " <span style=\"color: #ff0000\">==</span> " + message;
        }
        
        return " <span style=\"color: #ff0000\">==</span> " + text;
    }
    
    formatError(message) {
        return `<span style="color: #ff0000"> <span style="color: #ff0000">==</span> Error: ${message.trim()}</span>`;
    }
    
    formatWhoisUser(arr) {
        const nick = arr[3];
        const user = arr[4];
        const host = arr[5];
        const realname = arr.slice(7).join(" ").replace(/^:/, '').trim();
        const stamp = this.chatManager ? this.chatManager.getTimestamp() : '';

        const lines = [
            ` <span style="color: #ff0000">==</span> <span style="width: 90px; display: inline-block; font-weight: bold;">whois</span> : ${nick} [${user}@${host}]`,
            `${stamp} <span style="color: #ff0000">==</span> <span style="width: 90px; display: inline-block;">realname</span> : ${realname || '(none)'} `
        ];
        return lines.join("\n");
    }
    
    formatWhoisChannels(arr) {
        const channels = arr.slice(4).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        return ` <span style="color: #ff0000">==</span> <span style="width: 90px; display: inline-block;">channels</span> : ${channels.join(" ")}`;
    }
    
    isHostnameLookupMessage(message) {
        return message === "*** (jwebirc) Found your hostname." || 
               message === "*** (jwebirc) No hostname found." ||
               message === "*** (mwebirc) Found your hostname." || 
               message === "*** (mwebirc) No hostname found.";
    }
    
    parseNick(nick) {
        // Remove leading : if present
        if (nick.startsWith(':')) {
            nick = nick.substring(1);
        }
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
     * Handles CTCP replies (NOTICE with \001 delimiters)
     * @param {string} nick - The sender's nickname
     * @param {string} message - The CTCP reply message with \001 delimiters
     * @returns {string} Formatted CTCP reply message
     */
    handleCtcpReply(nick, message) {
        // Remove \001 delimiters
        const ctcpContent = message.substring(1, message.length - 1);
        const ctcpParts = ctcpContent.split(" ");
        const ctcpCommand = ctcpParts[0];
        const ctcpResponse = ctcpParts.slice(1).join(" ");
        
        this.output = this.chatManager.getActiveWindow();
        
        // Format based on CTCP command type
        switch (ctcpCommand.toUpperCase()) {
            case "VERSION":
                return ` <span style="color: #00aaff">==</span> CTCP VERSION reply from <span style="font-weight: bold;">${nick}</span>: ${ctcpResponse}`;
                
            case "TIME":
                return ` <span style="color: #00aaff">==</span> CTCP TIME reply from <span style="font-weight: bold;">${nick}</span>: ${ctcpResponse}`;
                
            case "PING":
                // Calculate round-trip time if it's a timestamp
                const timestamp = parseInt(ctcpResponse);
                if (!isNaN(timestamp)) {
                    const rtt = Date.now() - timestamp;
                    return ` <span style="color: #00aaff">==</span> CTCP PING reply from <span style="font-weight: bold;">${nick}</span>: ${rtt}ms`;
                }
                return ` <span style="color: #00aaff">==</span> CTCP PING reply from <span style="font-weight: bold;">${nick}</span>: ${ctcpResponse}`;
                
            case "CLIENTINFO":
                return ` <span style="color: #00aaff">==</span> CTCP CLIENTINFO reply from <span style="font-weight: bold;">${nick}</span>: ${ctcpResponse}`;
                
            case "FINGER":
                return ` <span style="color: #00aaff">==</span> CTCP FINGER reply from <span style="font-weight: bold;">${nick}</span>: ${ctcpResponse}`;
                
            case "USERINFO":
                return ` <span style="color: #00aaff">==</span> CTCP USERINFO reply from <span style="font-weight: bold;">${nick}</span>: ${ctcpResponse}`;
                
            case "SOURCE":
                return ` <span style="color: #00aaff">==</span> CTCP SOURCE reply from <span style="font-weight: bold;">${nick}</span>: ${ctcpResponse}`;
                
            case "ERRMSG":
                return ` <span style="color: #ff6600">==</span> CTCP ERROR from <span style="font-weight: bold;">${nick}</span>: ${ctcpResponse}`;
                
            default:
                return ` <span style="color: #00aaff">==</span> CTCP ${ctcpCommand} reply from <span style="font-weight: bold;">${nick}</span>: ${ctcpResponse}`;
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
    
    /**
     * Queue a WHO command to be executed with delay
     * This prevents flooding the server with multiple WHO commands at once
     */
    queueWhoCommand(target) {
        // Add to queue if not already queued
        if (!this.whoQueue.includes(target)) {
            this.whoQueue.push(target);
            console.log(`WHO command queued for ${target}. Queue length: ${this.whoQueue.length}`);
        }
        
        // Start processing if not already running
        if (!this.whoTimer) {
            this.processWhoQueue();
        }
    }
    
    /**
     * Process the WHO command queue with delays
     */
    processWhoQueue() {
        if (this.whoQueue.length === 0) {
            this.whoTimer = null;
            console.log('WHO queue empty, timer stopped');
            return;
        }
        
        // Get and send the next WHO command
        const target = this.whoQueue.shift();
        console.log(`Sending WHO command for ${target}. Remaining in queue: ${this.whoQueue.length}`);
        window.postManager.submitTextMessage("/who " + target);
        
        // Schedule next WHO command if queue is not empty
        if (this.whoQueue.length > 0) {
            this.whoTimer = setTimeout(() => {
                this.processWhoQueue();
            }, this.whoDelay);
        } else {
            this.whoTimer = null;
        }
    }
}

// IRC Parser will be initialized after chatManager is created
// See chat.js for initialization
window.IRCParser = IRCParser;

// Legacy functions for compatibility
function parse_output(text) { if (window.ircParser) window.ircParser.parseOutput(text); }
function get_numerics(text) { return window.ircParser ? window.ircParser.getNumerics(text) : null; }
function parse_nick(nick) { return window.ircParser ? window.ircParser.parseNick(nick) : nick; }
function parse_host(nick) { return window.ircParser ? window.ircParser.parseHost(nick) : ''; }
