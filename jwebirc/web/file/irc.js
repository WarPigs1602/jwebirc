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
        const regex = /^[\d]+$/;
        
        // Parse IRC message properly
        const ircMsg = this.parseIrcMessage(text);
        const { prefix, command, params } = ircMsg;
        
        // CAP handling (IRCv3 Capabilities)
        if (command === 'CAP') {
            this.handleCap(ircMsg);
            return null;
        }
        
        // TAGMSG handling (IRCv3 message tags)
        if (command === 'TAGMSG') {
            // TAGMSG is handled in parseOutput before getNumerics is called
            return null;
        }
        
        // PING handling
        if (command.toLowerCase() === "ping") {
            if (window.postManager && params[0]) {
                window.postManager.submitTextMessage("/pong " + params[0]);
            }
            return null;
        }
        
        // ERROR handling
        if (command.toLowerCase() === "error") {
            this.hideLoadingScreen();
            this.output = this.chatManager.getActiveWindow();
            return this.formatError(params.join(" "));
        }
        
        // NOTICE AUTH handling
        if (command.toLowerCase() === "notice" && params[0] && params[0].toLowerCase() === "auth") {
            const parsed = params.slice(1).join(" ");
            this.output = "Status";
            
            if (this.isHostnameLookupMessage(parsed.trim())) {
                this.chatManager.parsePage(this.chatManager.getTimestamp() + " <span style=\"color: #ff0000\">==</span> " + parsed.trim() + "\n");
                return null;
            }
            return " <span style=\"color: #ff0000\">==</span> " + parsed.trim();
        }
        
        // Numeric replies
        if (command && command.match(regex)) {
            return this.handleNumericReply(ircMsg, text);
        }

        // Command handling
        return this.handleCommand(ircMsg, text);
    }

    handleNumericReply(ircMsg, text) {
        const { prefix, command: code, params } = ircMsg;
        let parsed = "";

        switch (code) {
            case "005": // Server features (ISUPPORT)
                // Parse PREFIX parameter
                for (const param of params) {
                    if (param.startsWith('PREFIX=')) {
                        this.chatManager.parseServerPrefix(param);
                    }
                }
                return this.handleGenericNumeric(ircMsg, code, text);
                
            case "353": // Names list
                // Format: :server 353 yournick = #channel :nick1 @nick2 +nick3
                // params: [yournick, =/@/*, #channel, "nick1 @nick2 +nick3"]
                const channel = params[2];
                const nickList = params[3] || '';
                
                // Split the nick list by spaces and add each nick
                const nicks = nickList.trim().split(/\s+/);
                for (const nick of nicks) {
                    if (nick.length > 0) {
                        this.chatManager.addNick(channel, nick, "", this.chatManager.getRandomColor());
                    }
                }
                return null;
                
            case "332": // Topic
                // params: [nick, channel, topic]
                this.chatManager.setTopic(params[1], params[2] || '');
                return null;
                
            case "333": // Topic info
                // params: [nick, channel, setter, timestamp]
                this.chatManager.updateTopic(params[1], params[2], params[3]);
                return null;
                
            case "366": // End of names
            case "315": // End of WHO
                return null;
                
            case "352": // WHO reply
                // params: [nick, channel, username, host, server, nick, flags, hopcount realname]
                const whoNick = params[5];
                const whoFlags = params[6] || '';
                this.chatManager.setHost(params[1], whoNick, params[2] + "@" + params[3]);
                const isAway = whoFlags.includes('G');
                this.chatManager.setAwayStatus(whoNick, isAway);
                return null;
                
            case "311": // WHOIS user
                this.output = this.chatManager.getActiveWindow();
                return this.formatWhoisUser(ircMsg);
                
            case "319": // WHOIS channels
                this.output = this.chatManager.getActiveWindow();
                return this.formatWhoisChannels(ircMsg);

            case "312": { // WHOIS server
                this.output = this.chatManager.getActiveWindow();
                const server = params[2];
                const info = params[3] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">server</span> : ${server}${info ? ' (' + info + ')' : ''}`;
            }

            case "313": { // WHOIS operator
                this.output = this.chatManager.getActiveWindow();
                const info = params[2] || '';
                const suffix = info ? ` (${info})` : '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">operator</span> : ${params[1]}${suffix}`;
            }

            case "317": { // WHOIS idle / signon
                this.output = this.chatManager.getActiveWindow();
                const idleSeconds = parseInt(params[2] || '0', 10);
                const signonTs = parseInt(params[3] || '0', 10) * 1000;
                const idleText = isNaN(idleSeconds) ? '-' : `${idleSeconds}s`;
                const signonText = signonTs > 0 ? new Date(signonTs).toLocaleString() : '-';
                const timestamp = this.chatManager ? this.chatManager.getTimestamp() : '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">idle</span> : ${idleText}\n${timestamp} <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">signon</span> : ${signonText}`;
            }

            case "330": { // WHOIS logged in as (authname)
                this.output = this.chatManager.getActiveWindow();
                const authAs = params[2];
                const info = params[3] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">auth</span> : ${params[1]} is logged in as ${authAs}${info ? ' (' + info + ')' : ''}`;
            }

            case "307": { // WHOIS registered nick (often 307)
                this.output = this.chatManager.getActiveWindow();
                const info = params[2] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">registered</span> : ${params[1]}${info ? ' (' + info + ')' : ''}`;
            }

            case "320": { // WHOIS additional info (identified, etc.)
                this.output = this.chatManager.getActiveWindow();
                const nick = params[1];
                const info = params[2] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">info</span> : ${nick} ${info}`;
            }

            case "343": { // WHOIS oper type (RPL_WHOISOPERNAME)
                this.output = this.chatManager.getActiveWindow();
                const nick = params[1];
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">operator</span> : ${nick}`;
            }

            case "327": { // WHOIS real host/vhost
                this.output = this.chatManager.getActiveWindow();
                const info = params[1] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">vhost</span> : ${info}`;
            }

            case "275": // Certificate fingerprint
            case "276": { // Client certificate
                this.output = this.chatManager.getActiveWindow();
                const info = params[1] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">certificate</span> : ${info}`;
            }

            case "318": { // End of WHOIS
                this.output = this.chatManager.getActiveWindow();
                const info = params[1] || '';
                return ` <span style=\"color: #ff0000\">==</span> ${info}`;
            }

            case "301": { // WHOIS away
                this.output = this.chatManager.getActiveWindow();
                const nick = params[1];
                const awayMsg = params[2] || '';
                if (this.chatManager) {
                    this.chatManager.setAwayStatus(nick, true, awayMsg);
                }
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">away</span> : ${nick}${awayMsg ? ' (' + awayMsg + ')' : ''}`;
            }

            case "338": { // WHOIS actual host/IP
                this.output = this.chatManager.getActiveWindow();
                const info = params[2] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">actual host</span> : ${info}`;
            }

            case "378": { // WHOIS connecting from
                this.output = this.chatManager.getActiveWindow();
                const info = params[1] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">connecting</span> : ${info}`;
            }

            case "379": { // WHOIS modes
                this.output = this.chatManager.getActiveWindow();
                const info = params[1] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">modes</span> : ${info}`;
            }

            case "671": { // WHOIS secure connection (SSL/TLS)
                this.output = this.chatManager.getActiveWindow();
                const info = params[1] || '';
                return ` <span style=\"color: #ff0000\">==</span> <span style=\"width: 90px; display: inline-block;\">secure</span> : ${info}`;
            }
            
            case "710": { // KNOCK - User has knocked on channel
                // Format: :server 710 yournick #channel knocker :has knocked on channel
                // params: [yournick, #channel, knocker, has knocked on channel]
                // Display as: knocker has knocked on channel #channel
                const channel = params[1] || '';
                const knocker = params[2] || '';
                const message = params[3] || 'has knocked on channel';
                this.output = "Status";
                return ` <span style=\"color: #ff0000\">==</span> ${knocker} ${message} ${channel}`;
            }
                
            case "001": // Welcome
                this.output = "Status";
                return " <span style=\"color: #ff0000\">==</span> Signed on!";
                
            case "375": // MOTD start
                this.output = "Status";
                parsed = params[1] || '';
                return " <span style=\"color: #00aaff\">==</span> " + parsed.trim();
                
            case "372": // MOTD line - preserve formatting
                this.output = "Status";
                // MOTD line is in the last param (trailing)
                const motdLine = params[params.length - 1] || '';
                const cleanedMotd = motdLine.replace(/^:\s*-?\s*/, '');
                return " <span style=\"color: #00aaff\">==</span> <span style=\"font-family: monospace; white-space: pre;\">" + cleanedMotd + "</span>";
                
            case "376": // MOTD end
                this.output = "Status";
                parsed = params[1] || '';
                this.autoJoinAfterLogin();
                this.hideLoadingScreen();
                return " <span style=\"color: #00aaff\">==</span> " + parsed.trim();
                
            case "422": // No MOTD
                this.output = "Status";
                parsed = params[1] || '';
                this.autoJoinAfterLogin();
                this.hideLoadingScreen();
                return " <span style=\"color: #00aaff\">==</span> " + parsed.trim();
                
            case "433": // Nickname already in use
                {
                    this.output = "Status";
                    const currentNick = params[1] || window.user;
                    const message = params[2] || 'Nickname is already in use';
                    
                    // Generate alternative nickname by appending underscore or number
                    let newNick = currentNick;
                    if (newNick.endsWith('_')) {
                        // If already has underscore, try adding a number
                        const match = newNick.match(/^(.+?)_*(\d*)$/);
                        if (match) {
                            const base = match[1];
                            const num = match[2] ? parseInt(match[2]) + 1 : 1;
                            newNick = base + '_' + num;
                        }
                    } else {
                        // Add underscore
                        newNick = currentNick + '_';
                    }
                    
                    // Ensure nick doesn't exceed 15 characters
                    if (newNick.length > 15) {
                        newNick = newNick.substring(0, 15);
                    }
                    
                    // Update user and send new NICK command
                    window.user = newNick;
                    if (window.postManager) {
                        window.postManager.submitTextMessage('/nick ' + newNick);
                    }
                    
                    return ` <span style=\"color: #ff0000\">==</span> ${message} - Trying: ${newNick}`;
                }
                
            default:
                return this.handleGenericNumeric(ircMsg, code, text);
        }
    }
    
    handleCommand(ircMsg, text) {
        const { prefix, command, params } = ircMsg;
        const cmd = command.toLowerCase();

        switch (cmd) {
            case "notice":
                return this.handleNotice(ircMsg);
            case "mode":
                return this.handleMode(ircMsg);
            case "topic":
                return this.handleTopic(ircMsg);
            case "quit":
                this.handleQuit(ircMsg);
                return null;
            case "kill":
                return null;
            case "nick":
                this.handleNick(ircMsg);
                return null;
            case "invite":
                this.handleInvite(ircMsg);
                return null;
            case "join":
                return this.handleJoin(ircMsg);
            case "part":
                return this.handlePart(ircMsg);
            case "kick":
                return this.handleKick(ircMsg);
            case "away":
                this.handleAway(ircMsg);
                return null;
            case "chghost":
                return this.handleChghost(ircMsg);
            case "knock":
                return this.handleKnock(ircMsg);
            case "privmsg":
                return this.handlePrivmsg(ircMsg, text);
            default:
                return text;
        }
    }

    handleNotice(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        let message = params[1] || ''; // Target is params[0], message is params[1]

        // Check for CTCP reply (NOTICE with \001 delimiters)
        if (message.startsWith(String.fromCharCode(1))) {
            // Add ending \001 if missing
            if (!message.endsWith(String.fromCharCode(1))) {
                message = message + String.fromCharCode(1);
            }
            return this.handleCtcpReply(nick, message);
        }

        // Server notices should go to Status window, not create new query windows
        if (nick.includes('.') || nick === 'Server' || prefix === nick) {
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
    
    handleMode(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const target = params[0];
        const message = params.slice(1).join(" ");
        
        if (target === nick) {
            this.output = "Status";
            return " <span style=\"color: #ff0000\">==</span> Usermode change: " + message.trim();
        } else {
            this.output = target;
            const status = this.chatManager.getStatus(target, nick);
            const color = this.chatManager.getColor(target, nick);
            this.chatManager.setMode(target, message.trim());
            return ` <span style="color: #ff0000">==</span> <span style="color: ${color};">${status}${nick}</span> sets mode: ${message.trim()}`;
        }
    }
    
    handleTopic(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const channel = params[0];
        const message = params[1] || '';
        const color = this.chatManager.getColor(channel, nick);
        const status = this.chatManager.getStatus(channel, nick);
        
        this.output = channel;
        this.chatManager.setTopic(this.output, message);
        // Return raw message - parsePages will handle control codes and URLs
        return ` <span style="color: #ff0000">==</span> <span style="color: ${color};">${status}${nick}</span> sets topic: ${message.trim()}`;
    }
    
    handleQuit(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const reason = params[0] || '';
        this.chatManager.quit(nick, reason.trim());
    }
    
    handleNick(ircMsg) {
        const { prefix, params } = ircMsg;
        const oldnick = this.parseNick(prefix);
        const newnick = params[0];
        this.chatManager.changeNick(oldnick, newnick);
    }
    
    handleInvite(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const invitedNick = params[0];
        const channel = params[1];
        this.output = this.chatManager.getActiveWindow();
        
        if (window.user.toLowerCase() === invitedNick.toLowerCase()) {
            this.chatManager.parsePage(this.chatManager.getTimestamp() + ` <span style="color: #ff0000">==</span> ${nick} has you invited to: ${channel}\n`);
        } else {
            this.chatManager.parsePage(this.chatManager.getTimestamp() + ` <span style="color: #ff0000">==</span> You have ${invitedNick} invited to: ${channel}\n`);
        }
    }
    
    handleKnock(ircMsg) {
        // KNOCK command format: :nick!user@host KNOCK #channel :message
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const channel = params[0];
        const message = params[1] || '';
        
        // Set output to the channel being knocked on
        this.output = channel;
        
        // Create channel page if it doesn't exist (for channels we're not in)
        if (!this.chatManager.isPage(channel)) {
            this.chatManager.addPage(channel, 'channel', false);
        }
        
        // Trigger notification/highlight
        this.chatManager.setHighlight(true);
        
        // Trigger browser notification for knock
        if (this.chatManager.notificationManager) {
            this.chatManager.notificationManager.notifyKnock(channel, nick, message);
        }
        
        const messageText = message ? ` (${message})` : '';
        return ` <span style="color: #ff0000">==</span> ${nick} has knocked on ${channel}${messageText}`;
    }
    
    handleJoin(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const host = this.parseHost(prefix);
        const channel = params[0];
        const color = this.chatManager.getRandomColor();
        
        if (window.user.toLowerCase() === nick.toLowerCase()) {
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
            this.output = channel;
            this.chatManager.addNick(channel, nick, host, color);
        }
        
        return ` <span style="color: #ff0000">==</span> <span class="message-nick" data-nick="${nick}" style="color: ${color};">${nick}</span> [${host}] has joined ${channel}`;
    }
    
    handlePart(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const channel = params[0];
        const reason = params[1] || '';
        const color = this.chatManager.getColor(channel, nick);
        const status = this.chatManager.getStatus(channel, nick);
        const host = this.parseHost(prefix);
        
        if (window.user.toLowerCase() === nick.toLowerCase()) {
            this.chatManager.delPage(channel);
            // Remove channel from memory when leaving
            this.chatManager.removeFromChannelMemory(channel);
            this.output = this.chatManager.getActiveWindow();
            // Refresh the active window display after closing the channel
            this.chatManager.addWindow();
        } else {
            this.output = channel;
        }
        
        this.chatManager.delNick(channel, nick);
        const reasonText = reason.trim().length !== 0 ? " (" + reason.trim() + ")" : "";
        return ` <span style="color: #ff0000">==</span> <span style="color: ${color};">${status}${nick}</span> [${host}] has left ${channel}${reasonText}`;
    }
    
    handleKick(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const channel = params[0];
        const kickedNick = params[1];
        const reason = params[2] || '';
        const color = this.chatManager.getColor(channel, kickedNick);
        const status = this.chatManager.getStatus(channel, kickedNick);
        const host = this.parseHost(prefix);
        
        // If our user was kicked, remove from channel memory
        if (window.user.toLowerCase() === kickedNick.toLowerCase()) {
            this.chatManager.delPage(channel);
            this.chatManager.removeFromChannelMemory(channel);
            this.output = this.chatManager.getActiveWindow();
            // Refresh the active window display after closing the channel
            this.chatManager.addWindow();
        } else {
            this.output = channel;
        }
        this.chatManager.delNick(channel, kickedNick);
        
        const reasonText = reason.trim().length !== 0 ? " (" + reason.trim() + ")" : "";
        return ` <span style="color: #ff0000">==</span> <span style="color: ${this.chatManager.getColor(channel, nick)};">${this.chatManager.getStatus(channel, nick)}${nick}</span> [${host}] has kicked <span style="color: ${color};">${status}${kickedNick}</span>${reasonText}`;
    }
    
    handleAway(ircMsg) {
        // AWAY command format: :nick!user@host AWAY :away message
        // or: :nick!user@host AWAY (when coming back)
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const isAway = params.length > 0 && params[0] !== '';
        const awayMsg = isAway ? params[0] : '';
        
        // Update away status for this nick in all channels
        if (this.chatManager) {
            this.chatManager.setAwayStatus(nick, isAway, awayMsg);
        }
    }
    
    handleChghost(ircMsg) {
        // CHGHOST command format: :nick!user@host CHGHOST new-user new-host
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const newUser = params[0] || '';
        const newHost = params[1] || '';
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
    
    handlePrivmsg(ircMsg, text) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const target = params[0];
        let message = params[1] || '';
        
        // Check for CTCP request BEFORE creating query window
        if (message.startsWith(String.fromCharCode(1))) {
            // Add ending \001 if missing
            if (!message.endsWith(String.fromCharCode(1))) {
                message = message + String.fromCharCode(1);
            }
            const ctcpContent = message.substring(1, message.length - 1);
            
            // ACTION is displayed differently - needs proper output
            if (ctcpContent.startsWith("ACTION ")) {
                this.output = (target.startsWith("#") || target.startsWith("&")) ? target : nick;
                if (!this.chatManager.isPage(this.output)) {
                    this.chatManager.addPage(this.output, "query", true);
                }
                return `* <span class="message-nick" data-nick="${nick}" style="color: ${this.chatManager.getColor(this.output, nick)};">${this.chatManager.getStatus(this.output, nick)}${nick}</span> ${ctcpContent.substring(7)}`;
            }
            
            // Other CTCP requests - display in active window (no query window)
            const spaceIdx = ctcpContent.indexOf(' ');
            const ctcpCommand = spaceIdx >= 0 ? ctcpContent.substring(0, spaceIdx) : ctcpContent;
            const ctcpArgs = spaceIdx >= 0 ? ctcpContent.substring(spaceIdx + 1) : '';
            
            // Display CTCP requests in active window
            this.output = this.chatManager.getActiveWindow();
            
            return ` <span style="color: #ff0000">==</span> CTCP ${ctcpCommand} request from <span style="color: ${this.chatManager.getColor(this.output, nick)};">${nick}</span>${ctcpArgs ? ': ' + ctcpArgs : ''}`;
        }
        
        // Normal message - set output and create page if needed
        this.output = (target.startsWith("#") || target.startsWith("&")) ? target : nick;
        
        if (!this.chatManager.isPage(this.output)) {
            this.chatManager.addPage(this.output, "query", true);
        }
        
        // Highlight in channels when user is mentioned, or for private messages
        if (target.startsWith("#") || target.startsWith("&")) {
            // Channel message - highlight if user is mentioned
            if (text.toLowerCase().includes(window.user.toLowerCase())) {
                this.chatManager.setHighlight(true);
            }
        } else {
            // Private message - always highlight
            this.chatManager.setHighlight(true);
        }
        
        return `&lt;<span class="message-nick" data-nick="${nick}" style="color: ${this.chatManager.getColor(target, nick)};">${this.chatManager.getStatus(target, nick)}${nick}</span>&gt; ${message}`;
    }
    
    handleGenericNumeric(ircMsg, code, text) {
        const { params } = ircMsg;
        this.output = "Status";
        
        const numCode = parseInt(code);
        
        // For error codes (4xx, 5xx), hide loading screen and use params
        // Format: params[0] = nickname, params[1+] = message parts
        if (numCode >= 400 && numCode <= 599) {
            this.hideLoadingScreen();
            
            // Join everything from index 1 onwards (skip nickname)
            if (params.length > 1) {
                const messageParams = params.slice(1);
                
                // Remove consecutive duplicates (e.g., "#channel #channel" -> "#channel")
                const filtered = messageParams.filter((item, index) => {
                    return index === 0 || item !== messageParams[index - 1];
                });
                
                const message = filtered.join(' ');
                return " <span style=\"color: #ff0000\">==</span> " + message;
            }
        }
        
        // For other numerics
        if (params.length > 1) {
            const message = params.slice(1).join(' ');
            return " <span style=\"color: #ff0000\">==</span> " + message;
        }
        
        return " <span style=\"color: #ff0000\">==</span> " + text;
    }
    
    formatError(message) {
        return `<span style="color: #ff0000"> <span style="color: #ff0000">==</span> Error: ${message.trim()}</span>`;
    }
    
    formatWhoisUser(ircMsg) {
        const { params } = ircMsg;
        // params: [nick, target-nick, username, host, *, realname]
        const nick = params[1];
        const user = params[2];
        const host = params[3];
        const realname = params[5] || '';
        const stamp = this.chatManager ? this.chatManager.getTimestamp() : '';

        const lines = [
            ` <span style="color: #ff0000">==</span> <span style="width: 90px; display: inline-block; font-weight: bold;">whois</span> : ${nick} [${user}@${host}]`,
            `${stamp} <span style="color: #ff0000">==</span> <span style="width: 90px; display: inline-block;">realname</span> : ${realname || '(none)'} `
        ];
        return lines.join("\n");
    }
    
    formatWhoisChannels(ircMsg) {
        const { params } = ircMsg;
        // params: [nick, target-nick, channels...]
        const channels = params.slice(2).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
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
     * @param {Object} ircMsg - Parsed IRC message
     */
    handleCap(ircMsg) {
        const { params } = ircMsg;
        // Expected format: :server CAP nick LS :cap1 cap2 cap3
        // params = [nick, 'LS', 'cap1 cap2 cap3']
        // or: :server CAP * LS :cap1 cap2 cap3
        // params = ['*', 'LS', 'cap1 cap2 cap3']
        
        if (params.length < 2) {
            return;
        }
        
        // First param is target (nick or '*')
        const target = params[0];
        const subcommand = params[1].toUpperCase();
        
        // Capabilities are in the last parameter (trailing), possibly with '*' continuation marker
        const capsString = params.length > 2 ? params[params.length - 1] : '';
        
        // Split by space and filter out empty strings and continuation marker
        const caps = capsString
            .split(' ')
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
            return;
        }
        
        // Get and send the next WHO command
        const target = this.whoQueue.shift();
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
    
    /**
     * Hide the loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            if (!loadingScreen.classList.contains('hidden')) {
                loadingScreen.classList.add('hidden');
            }
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
