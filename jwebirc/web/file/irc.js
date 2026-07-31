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
        this.serverNickLength = Math.max(1, parseInt(window.nickMaxLength, 10) || 15);
        this.rawLineDebug = window.ircRawDebug === true || window.ircRawDebug === 'true';
        
        // Shared delay (ms) for WHO and history commands to avoid flooding
        this.commandDelay = parseInt(window.commandDelayOnJoin) || 300;

        // WHO command queue to avoid flooding the server
        this.whoQueue = [];

        // History command queue to avoid flooding the server
        this.historyQueue = [];
        this.historyDelay = this.commandDelay;
        this.historyCommandEnabled = window.historyCommandEnabled === true || window.historyCommandEnabled === 'true';
        this.historyCommand = window.historyCommand || '/msg HistServ HISTORY %CHANNEL% 50';

        // MODE command queue to avoid flooding the server
        this.modeQueue = [];
        this.modeDelay = this.commandDelay;

        // Shared send queue so every command uses the same delay and is not bundled
        this.commandQueue = [];
        this.commandTimer = null;

        // Track channels we have already processed as joined to ignore duplicate self JOIN events.
        this.selfJoinedChannels = new Set();

        // Cache last shown capabilities to avoid duplicate CAP lines
        this.capDisplayLast = { ls: null, ack: null, nak: null };

        // Track capabilities (as reported by backend negotiation)
        this.availableCaps = new Set();
        this.enabledCaps = new Set();

        // Width used to align WHOIS labels when a colon is present
        this.whoisPadWidth = 14;
        // Minimum label width (ch) used for localized WHOIS labels so they align cleanly
        this.whoisLabelWidth = 16;

        // Normalize WHOIS text so localized labels keep a consistent column
        this.normalizeWhoisText = (text) => {
            if (typeof text !== 'string') return text;
            // Skip HTML-containing strings to avoid breaking markup
            if (text.includes('<')) return text;
            const colonIdx = text.indexOf(':');
            if (colonIdx === -1) return text;
            const label = text.slice(0, colonIdx).trim();
            const value = text.slice(colonIdx + 1).trimStart();
            const padded = `${label}:`.padEnd(this.whoisPadWidth, ' ');
            return `${padded}${value}`;
        };

        // Split a WHOIS string into label/value parts if possible
        this.splitWhoisLabelValue = (text) => {
            if (typeof text !== 'string') return null;
            if (text.includes('<')) return null; // avoid touching HTML markup
            const colonIdx = text.indexOf(':');
            if (colonIdx === -1) return null;
            const label = text.slice(0, colonIdx).trim();
            const value = text.slice(colonIdx + 1).trimStart();
            return { label, value };
        };

        // i18n helper
        this.t = (key, fallback, replacements) => {
            if (this.chatManager && typeof this.chatManager.t === 'function') {
                return this.chatManager.t(key, fallback, replacements);
            }
            if (replacements && fallback) {
                return Object.keys(replacements).reduce((acc, rKey) => acc.replace(`{${rKey}}`, replacements[rKey]), fallback);
            }
            return fallback || key;
        };

        this.i18nSpan = (key, fallback, replacements) => {
            if (this.chatManager && typeof this.chatManager.buildI18nSpan === 'function') {
                return this.chatManager.buildI18nSpan(key, fallback, replacements);
            }
            return this.t(key, fallback, replacements);
        };

        // Unified WHOIS line formatter to keep spacing consistent across locales
        this.whoisLine = (key, fallback, replacements, options = {}) => {
            const translated = this.i18nSpan(key, fallback, replacements);
            const labelValue = this.splitWhoisLabelValue(translated);
            const ts = options.timestamp && this.chatManager ? `${this.chatManager.getTimestamp()} ` : '';
            if (labelValue) {
                const label = `${labelValue.label}:`;
                const labelSpan = `<span class="whois-label" style="display: inline-block; min-width: ${this.whoisLabelWidth}ch; font-weight: 600;">${label}</span>`;
                const valueSpan = `<span class="whois-value" style="white-space: pre-wrap;">${labelValue.value}</span>`;
                return `${ts}<span class="whois-line" style="font-family: monospace;">&nbsp;${labelSpan} ${valueSpan}</span>`;
            }

            const span = this.normalizeWhoisText(translated);
            return `${ts}<span class="whois-line" style="font-family: monospace; white-space: pre;">&nbsp;${span}</span>`;
        };
    }

    stripSystemMessageMarker(text) {
        return (text || '')
            .replace(/^(\[[0-9]{2}:[0-9]{2}:[0-9]{2}\])\s*<span style=(['"])\s*color\s*:\s*[^'"]*\2>\s*==\s*<\/span>\s*/i, '$1 ')
            .replace(/^<span style=(['"])\s*color\s*:\s*[^'"]*\1>\s*==\s*<\/span>\s*/i, '')
            .replace(/^\s+/, '');
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
        const middle = text.trim();
        const parts = middle.length > 0 ? middle.split(/\s+/) : [];
        const command = parts.length > 0 ? parts[0] : '';
        const params = parts.length > 1 ? parts.slice(1) : [];
        
        // Add trailing as last param if it exists
        if (trailing !== null) {
            params.push(trailing);
        }
        
        return { prefix, command, params };
    }
    
    parseOutput(text) {
        this.logRawLine('IN', text);

        // Check for message tags (IRCv3)
        let tags = null;
        if (text.startsWith('@')) {
            const spaceIndex = text.indexOf(' ');
            if (spaceIndex > 0) {
                tags = this.parseMessageTags(text.substring(1, spaceIndex));
                text = text.substring(spaceIndex + 1);
                
                // Handle typing notification only if message-tags capability is enabled
                if (this.enabledCaps.has('message-tags') && (tags.has('typing') || tags.has('+typing'))) {
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
        
        const output = this.stripSystemMessageMarker(this.getNumerics(text.toString()));
        if (!output) {
            if (this.isRawDebugEnabled()) {
                this.output = 'Status';
                const ts = this.chatManager.getTimestamp();
                const escapedRaw = this.escapeRawForDisplay(text);
                this.chatManager.parsePage(`${ts} <span style="color: #888;">[RAW]</span> <span style="font-family: monospace;">${escapedRaw}</span>\n`);
            }
            return;
        }

        // Use server-provided timestamp if available and server-time is enabled
        const ts = (tags && tags.has('time') && this.enabledCaps.has('server-time'))
            ? this.chatManager.getTimestamp(tags.get('time'))
            : this.chatManager.getTimestamp();
        
        if (this.chatManager.getActiveWindow()) {
            for (const channel of this.chatManager.channels) {
                if (this.output.toLowerCase() === channel.page.toLowerCase()) {
                    this.chatManager.parsePages(ts + " " + output.trim() + "\n", channel.page);
                }
            }
        } else {
            this.chatManager.parsePage(ts + " " + output.trim() + "\n");
        }
    }

    escapeRawForDisplay(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    getNumerics(text) {
        const regex = /^[\d]+$/;
        
        // Parse IRC message properly
        const ircMsg = this.parseIrcMessage(text);
        const { prefix, command, params } = ircMsg;
        
        // Show CAP capability info (backend still negotiates)
        if (command === 'CAP') {
            return this.handleCapDisplay(ircMsg);
        }

        // BATCH handling (IRCv3 batch messages) - ignore control lines
        if (command === 'BATCH') {
            // We currently do not need to render batch start/end markers
            return null;
        }
        
        // TAGMSG handling (IRCv3 message tags)
        if (command === 'TAGMSG') {
            // TAGMSG is handled in parseOutput before getNumerics is called
            return null;
        }
        
        // PING handling (respond in frontend, preserve payload format)
        if (command.toLowerCase() === "ping") {
            if (window.postManager) {
                const pingMatch = text.match(/(?:^|\s)PING\s+(.+)$/i);
                const payload = pingMatch ? pingMatch[1].trim() : '';
                if (payload.length > 0) {
                    window.postManager.sendRawMessage('/PONG ' + payload);
                } else {
                    window.postManager.sendRawMessage('/PONG');
                }
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
                const msg = this.formatHostnameMessage(parsed.trim());
                this.chatManager.parsePage(this.chatManager.getTimestamp() + " " + msg + "\n");
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
        const channelTarget = this.findKnownChannel(params);
        let parsed = "";

        switch (code) {
            case "903": { // SASL authentication successful
                this.output = channelTarget || "Status";
                this.hideLoadingScreen();
                const span = this.i18nSpan('chat.sasl.success', 'SASL authentication successful.');
                return " <span style=\"color: #00aa00\">==</span> " + span;
            }

            case "904": { // SASL authentication failed (bad credentials)
                this.output = channelTarget || "Status";
                this.hideLoadingScreen();
                const span = this.i18nSpan('chat.sasl.failed', 'SASL authentication failed: invalid username or password.');
                return " <span style=\"color: #ff0000\">==</span> " + span;
            }

            case "905": { // SASL authentication failed (message too long)
                this.output = channelTarget || "Status";
                this.hideLoadingScreen();
                const span = this.i18nSpan('chat.sasl.toolong', 'SASL authentication failed: authentication data too long.');
                return " <span style=\"color: #ff0000\">==</span> " + span;
            }
            case "251": { // LUSERCLIENT
                this.output = channelTarget || "Status";
                const text = (params.slice(1).join(' ') || '').replace(/^:/, '').trim();
                const match = text.match(/there are (\d+) users and (\d+) invisible on (\d+) servers/i);
                const span = match
                    ? this.i18nSpan('chat.rpl.luserClient', 'There are {users} users and {invisible} invisible on {servers} servers', { users: match[1], invisible: match[2], servers: match[3] })
                    : this.i18nSpan('chat.rpl.generic', '{text}', { text });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "252": { // LUSEROP
                this.output = channelTarget || "Status";
                const count = params[1] || '0';
                const span = this.i18nSpan('chat.rpl.luserOp', 'Operators online: {count}', { count });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "253": { // LUSERUNKNOWN
                this.output = channelTarget || "Status";
                const count = params[1] || '0';
                const span = this.i18nSpan('chat.rpl.luserUnknown', 'Unknown connections: {count}', { count });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "254": { // LUSERCHANNELS
                this.output = channelTarget || "Status";
                const count = params[1] || '0';
                const span = this.i18nSpan('chat.rpl.luserChannels', 'Channels formed: {count}', { count });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "255": { // LUSERME
                this.output = channelTarget || "Status";
                const clients = params[1] || '0';
                const servers = params[2] || '0';
                const tail = (params.slice(3).join(' ') || '').replace(/^:/, '').trim();
                const extra = tail ? ` (${tail})` : '';
                const span = this.i18nSpan('chat.rpl.luserMe', 'I have {clients} clients and {servers} servers', { clients, servers });
                return ` <span style="color: #00aaff">==</span> ${span}${extra}`;
            }

            case "265": { // LOCALUSERS
                this.output = channelTarget || "Status";
                const current = params[1] || '0';
                const max = params[2] || '0';
                const span = this.i18nSpan('chat.rpl.localUsers', 'Local users: {current} (max {max})', { current, max });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "266": { // GLOBALUSERS
                this.output = channelTarget || "Status";
                const current = params[1] || '0';
                const max = params[2] || '0';
                const span = this.i18nSpan('chat.rpl.globalUsers', 'Global users: {current} (max {max})', { current, max });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "321": { // LIST start
                if (window.listCommandEnabled === true) {
                    this.output = "Channel List";
                    this.chatManager.ensureListTab();
                    const span = this.i18nSpan('chat.rpl.listStart', 'Channel list:');
                    this.chatManager.setListHeader(span);
                    return null;
                }
                this.output = channelTarget || "Status";
                const span = this.i18nSpan('chat.rpl.listStart', 'Channel list:');
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "322": { // LIST entry
                if (window.listCommandEnabled === true) {
                    this.output = "Channel List";
                    const channel = params[1] || '';
                    const users = params[2] || '0';
                    const topic = (params.slice(3).join(' ') || '').replace(/^:/, '').trim();
                    this.chatManager.addListEntry(channel, users, topic);
                    return null;
                }
                this.output = channelTarget || "Status";
                const channel = params[1] || '';
                const users = params[2] || '0';
                const topic = (params.slice(3).join(' ') || '').replace(/^:/, '').trim();
                const span = this.i18nSpan('chat.rpl.listEntry', '{channel} ({users}) {topic}', { channel, users, topic });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "323": { // LIST end
                if (window.listCommandEnabled === true) {
                    this.output = "Channel List";
                    const span = this.i18nSpan('chat.rpl.listEnd', 'End of channel list');
                    this.chatManager.setListFooter(span);
                    return null;
                }
                this.output = channelTarget || "Status";
                const span = this.i18nSpan('chat.rpl.listEnd', 'End of channel list');
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "324": { // CHANNELMODEIS
                this.output = params[1] || "Status";
                const channel = params[1] || '';
                const modes = params[2] || '';
                const args = params.slice(3).join(' ');
                const span = this.i18nSpan('chat.rpl.channelMode', 'Channel modes for {channel}: {modes} {args}', { channel, modes, args });
                return ` <span style="color: #ff0000">==</span> ${span}`;
            }

            case "329": { // Channel creation time
                this.output = params[1] || "Status";
                const channel = params[1] || '';
                const ts = parseInt(params[2] || '0', 10) * 1000;
                const date = ts > 0 ? new Date(ts).toLocaleString() : params[2] || '';
                const span = this.i18nSpan('chat.rpl.channelCreated', '{channel} created on {date}', { channel, date });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "331": { // No topic set
                this.output = params[1] || "Status";
                const channel = params[1] || '';
                const span = this.i18nSpan('chat.rpl.noTopic', 'No topic is set for {channel}', { channel });
                return ` <span style="color: #ff0000">==</span> ${span}`;
            }

            case "906": { // SASL authentication aborted
                this.output = channelTarget || "Status";
                this.hideLoadingScreen();
                const span = this.i18nSpan('chat.sasl.aborted', 'SASL authentication aborted by server.');
                return " <span style=\"color: #ff0000\">==</span> " + span;
            }

            case "907": { // Already authenticated
                this.output = channelTarget || "Status";
                this.hideLoadingScreen();
                return " <span style=\"color: #00aa00\">==</span> " + this.t('chat.sasl.already', 'SASL already authenticated.');
            }

            case "005": // Server features (ISUPPORT)
                // Parse PREFIX parameter
                for (const param of params) {
                    if (param.startsWith('PREFIX=')) {
                        this.chatManager.parseServerPrefix(param);
                    }
                    if (param.startsWith('NICKLEN=')) {
                        const nickLength = parseInt(param.substring(8), 10);
                        if (!Number.isNaN(nickLength) && nickLength > 0) {
                            this.serverNickLength = nickLength;
                        }
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
                for (const rawNick of nicks) {
                    if (rawNick.length > 0) {
                        let nickToken = rawNick;
                        let hostMask = "";

                        let statusPrefix = "";
                        while (nickToken.length > 0 && this.chatManager.isStatusSymbol(nickToken[0])) {
                            statusPrefix += nickToken[0];
                            nickToken = nickToken.substring(1);
                        }

                        const hostSeparator = nickToken.indexOf('!');
                        if (hostSeparator > 0) {
                            hostMask = nickToken.substring(hostSeparator + 1);
                            nickToken = nickToken.substring(0, hostSeparator);
                        }

                        const displayNick = statusPrefix + nickToken;
                        this.chatManager.addNick(channel, displayNick, hostMask, this.chatManager.getNickColor(nickToken));
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
            case "341": { // RPL_INVITING
                this.output = channelTarget || "Status";
                const nick = params[1] || '';
                const channel = params[2] || '';
                const span = this.i18nSpan('chat.rpl.inviting', 'Inviting {nick} to {channel}', { nick, channel });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }
                
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
                const infoSuffix = info ? ' (' + info + ')' : '';
                return this.whoisLine('chat.whois.server', 'server: {server}{info}', { server, info: infoSuffix });
            }

            case "313": { // WHOIS operator
                this.output = this.chatManager.getActiveWindow();
                const info = params[2] || '';
                const suffix = info ? ` (${info})` : '';
                return this.whoisLine('chat.whois.operator', 'operator: {nick}{info}', { nick: params[1], info: suffix });
            }

            case "317": { // WHOIS idle / signon
                this.output = this.chatManager.getActiveWindow();
                const idleSeconds = parseInt(params[2] || '0', 10);
                const signonTs = parseInt(params[3] || '0', 10) * 1000;
                const idleText = isNaN(idleSeconds) ? '-' : `${idleSeconds}s`;
                const signonText = signonTs > 0 ? new Date(signonTs).toLocaleString() : '-';
                const idleLine = this.whoisLine('chat.whois.idle', 'idle: {idle}', { idle: idleText });
                const signonLine = this.whoisLine('chat.whois.signon', 'signon: {signon}', { signon: signonText }, { timestamp: true });
                return `${idleLine}\n${signonLine}`;
            }

            case "330": { // WHOIS logged in as (authname)
                this.output = this.chatManager.getActiveWindow();
                const authAs = params[2];
                const info = params[3] || '';
                const infoSuffix = info ? ' (' + info + ')' : '';
                return this.whoisLine('chat.whois.auth', 'account: {auth}{info}', { nick: params[1], auth: authAs, info: infoSuffix });
            }

            case "307": { // WHOIS registered nick (often 307)
                this.output = this.chatManager.getActiveWindow();
                const info = params[2] || '';
                const suffix = info ? ' (' + info + ')' : '';
                return this.whoisLine('chat.whois.registered', 'registered: {nick}{info}', { nick: params[1], info: suffix });
            }

            case "320": { // WHOIS additional info (identified, etc.)
                this.output = this.chatManager.getActiveWindow();
                const nick = params[1];
                const info = params[2] || '';
                return this.whoisLine('chat.whois.info', 'info: {nick} {info}', { nick, info });
            }

            case "343": { // WHOIS oper type (RPL_WHOISOPERNAME)
                this.output = this.chatManager.getActiveWindow();
                const nick = params[1];
                return this.whoisLine('chat.whois.operType', 'operator: {nick}', { nick });
            }

            case "327": { // WHOIS real host/vhost
                this.output = this.chatManager.getActiveWindow();
                const info = params[1] || '';
                return this.whoisLine('chat.whois.vhost', 'vhost: {host}', { host: info });
            }

            case "275": // Certificate fingerprint
            case "276": { // Client certificate
                this.output = this.chatManager.getActiveWindow();
                const info = params[1] || '';
                return this.whoisLine('chat.whois.certificate', 'certificate: {info}', { info });
            }

            case "318": { // End of WHOIS
                this.output = this.chatManager.getActiveWindow();
                const nick = params[1] || '';
                return this.whoisLine('chat.whois.end', 'End of /WHOIS for {nick}', { nick });
            }

            case "301": { // WHOIS away
                this.output = this.chatManager.getActiveWindow();
                const nick = params[1];
                const awayMsg = params[2] || '';
                if (this.chatManager) {
                    this.chatManager.setAwayStatus(nick, true, awayMsg);
                }
                const reasonSuffix = awayMsg ? ` (${awayMsg})` : '';
                return this.whoisLine('chat.whois.away', 'away: {nick}{reason}', { nick, reason: reasonSuffix });
            }

            case "335": { // WHOIS bot (UnrealIRCd)
                this.output = this.chatManager.getActiveWindow();
                const nick = params[1] || '';
                const rawInfo = (params.slice(2).join(' ') || '').replace(/^:/, '').trim();
                const networkMatch = rawInfo.match(/^(?:\S+\s+)?is\s+a\s+bot\s+on\s+(.+)$/i);
                const network = networkMatch
                    ? networkMatch[1].trim()
                    : rawInfo.replace(/^(?:\S+\s+)?is\s+a\s+bot(?:\s+on)?\s*/i, '').trim();
                const networkSuffix = network ? ` (${network})` : '';
                return this.whoisLine('chat.whois.bot', 'Bot: {nick}{network}', { nick, network: networkSuffix });
            }

            case "338": { // WHOIS actual host/IP
                this.output = this.chatManager.getActiveWindow();
                const info = params[2] || '';
                return this.whoisLine('chat.whois.actualHost', 'actual host: {host}', { host: info });
            }
            case "351": { // RPL_VERSION
                this.output = channelTarget || "Status";
                const version = params[1] || '';
                const server = params[2] || '';
                const info = (params.slice(3).join(' ') || '').replace(/^:/, '').trim();
                const infoSuffix = info ? ` (${info})` : '';
                const span = this.i18nSpan('chat.rpl.version', 'Server version {version} on {server}{info}', { version, server, info: infoSuffix });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "391": { // RPL_TIME
                 this.output = channelTarget || "Status";
                const server = params[1] || '';
                const time = (params.slice(2).join(' ') || '').replace(/^:/, '').trim();
                const span = this.i18nSpan('chat.rpl.time', 'Server time for {server}: {time}', { server, time });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "396": { // RPL_HOSTHIDDEN
                 this.output = channelTarget || "Status";
                const host = params[1] || '';
                const span = this.i18nSpan('chat.rpl.hostHidden', 'Your hostname is now hidden as {host}', { host });
                return ` <span style="color: #00aaff">==</span> ${span}`;
            }

            case "378": { // WHOIS connecting from
                this.output = this.chatManager.getActiveWindow();
                const rawInfo = (params.slice(2).join(' ') || params[2] || '').replace(/^:/, '').trim();
                const info = rawInfo.replace(/^(?:\S+\s+)?is\s+connecting\s+from\s+/i, '').trim();
                return this.whoisLine('chat.whois.connectingFrom', '{info}', { info });
            }

            case "379": { // WHOIS modes
                this.output = this.chatManager.getActiveWindow();
                const rawInfo = (params.slice(2).join(' ') || params[2] || '').replace(/^:/, '').trim();
                const info = rawInfo.replace(/^(?:\S+\s+)?is\s+using\s+modes\s+/i, '').trim();
                return this.whoisLine('chat.whois.modes', '{info}', { info });
            }

            case "671": { // WHOIS secure connection (SSL/TLS)
                this.output = this.chatManager.getActiveWindow();
                const info = params[1] || '';
                return this.whoisLine('chat.whois.secure', 'secure: {info}', { info });
            }
            
            case "710": { // KNOCK - notification / acknowledgement
                // Two shapes observed:
                // 1) For channel operators: :server 710 <you> <#channel> <knocker> :has knocked on channel
                // 2) For the knocker:      :server 710 <you> <#channel> :Your knock has been delivered
                this.output = channelTarget || "Status";
                const channel = params[1] || '';
                const trailing = (params.slice(2).join(' ') || '').replace(/^:/, '').trim();

                // Channel notification (has knocker + trailing reason)
                if (params.length >= 4) {
                    const knocker = params[2] || '';
                    const message = params[3] ? trailing : '';

                    if (this.chatManager && typeof this.chatManager.addNotificationEvent === 'function') {
                        this.chatManager.addNotificationEvent(channel || 'Status');
                    }

                    if (this.chatManager.notificationManager) {
                        this.chatManager.notificationManager.notifyKnock(channel, knocker, message);
                    }

                    const knockMsg = this.i18nSpan('chat.knock', '{nick} has knocked on {channel}{message}', {
                        nick: knocker,
                        channel,
                        message: message ? ` (${message})` : ''
                    });
                    return ` <span style=\"color: #ff0000\">==</span> ${knockMsg}`;
                }

                // Acknowledgement to knocker
                const info = trailing;
                const span = this.i18nSpan('chat.rpl.knockDelivered', 'Your knock to {channel} was delivered{extra}', {
                    channel,
                    extra: info ? ` (${info})` : ''
                });
                return ` <span style=\"color: #00aaff\">==</span> ${span}`;
            }

            case "711": { // KNOCK delivered or forwarded
                this.output = channelTarget || "Status";
                const channel = params[1] || '';
                const maybeNick = params[2] || '';
                const message = (params.slice(3).join(' ') || '').replace(/^:/, '').trim();

                // If a nick is present, treat as incoming knock info for operators
                if (maybeNick) {
                    const isDefault = /has knocked on channel/i.test(message);
                    const msg = !isDefault && message ? ` (${message})` : '';

                    if (this.chatManager && typeof this.chatManager.addNotificationEvent === 'function') {
                        this.chatManager.addNotificationEvent(channel || 'Status');
                    }

                    if (this.chatManager.notificationManager) {
                        this.chatManager.notificationManager.notifyKnock(channel, maybeNick, msg);
                    }

                    const knockMsg = this.i18nSpan('chat.knock', '{nick} has knocked on {channel}{message}', { nick: maybeNick, channel, message: msg });
                    return ` <span style=\"color: #ff0000\">==</span> ${knockMsg}`;
                }

                // Otherwise it's the knocker acknowledgement
                const isDefaultPhrase = /has knocked on channel/i.test(message);
                const extra = message && !isDefaultPhrase ? ` (${message})` : '';
                const span = this.i18nSpan('chat.rpl.knockDelivered', 'Your knock to {channel} was delivered{extra}', { channel, extra: extra ? extra : '' });
                return ` <span style=\"color: #00aaff\">==</span> ${span}`;
            }

            case "401":
            case "402":
            case "403":
            case "404":
            case "405":
            case "407":
            case "409":
            case "410":
            case "421":
            case "423":
            case "431":
            case "432":
            case "441":
            case "442":
            case "443":
            case "451":
            case "461":
            case "462":
            case "464":
            case "471":
            case "473":
            case "474":
            case "475":
            case "476":
            case "477":
            case "481":
            case "482":
            case "484":
            case "490":
            case "492":
            case "502":
            case "512":
            case "712":
            case "713":
            case "714": {
                const formatted = this.formatErrorNumeric(code, params);
                if (formatted) return formatted;
                break;
            }
                
            case "001": // Welcome
                if (params[0]) {
                    window.user = params[0];
                    this.chatManager.userColor = this.chatManager.getNickColor(window.user);
                }
                this.output = "Status";
                return " <span style=\"color: #ff0000\">==</span> " + this.i18nSpan('chat.signedOn', 'Signed on!');
                
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
                
            case "432":
            case "433":
            case "437":
                return this.handleRejectedNickname(code, params);
                
            default:
                return this.handleGenericNumeric(ircMsg, code, text);
        }
    }

    /**
     * Display CAP (capabilities) information in Status
     */
    handleCapDisplay(ircMsg) {
        const { params } = ircMsg;
        if (!params || params.length < 2) return null;

        const target = params[0];
        const sub = params[1].toUpperCase();
        const capsString = params.length > 2 ? params[params.length - 1] : "";
        const rawCaps = capsString.split(" ").filter(Boolean);
        const normalizeCap = (cap) => {
            const stripped = (cap || '').replace(/^[-+~=]/, '').toLowerCase();
            return stripped.split('=')[0];
        };
        const caps = rawCaps.map(normalizeCap).filter(Boolean);

        // Deduplicate identical CAP announcements
        const joined = caps.join(", ");
        const lastKey = sub === "LS" ? "ls" : sub === "ACK" ? "ack" : sub === "NAK" ? "nak" : null;
        if (lastKey && this.capDisplayLast[lastKey] === joined) {
            return null;
        }
        if (lastKey) {
            this.capDisplayLast[lastKey] = joined;
        }

        // Persist caps state for UI/feature toggles
        if (sub === "LS" || sub === "NEW") {
            for (const cap of caps) {
                this.availableCaps.add(cap);
            }
            if (this.chatManager && typeof this.chatManager.handleCapLS === 'function') {
                this.chatManager.handleCapLS(caps);
            }
        } else if (sub === "ACK") {
            for (const rawCap of rawCaps) {
                const normalized = normalizeCap(rawCap);
                if (!normalized) {
                    continue;
                }
                if (rawCap.startsWith('-')) {
                    this.enabledCaps.delete(normalized);
                } else {
                    this.enabledCaps.add(normalized);
                }
            }
            if (this.chatManager && typeof this.chatManager.handleCapACK === 'function') {
                const ackedCaps = rawCaps
                    .filter(cap => !cap.startsWith('-'))
                    .map(normalizeCap)
                    .filter(Boolean);
                if (ackedCaps.length > 0) {
                    this.chatManager.handleCapACK(ackedCaps);
                }
            }
        } else if (sub === "NAK") {
            if (this.chatManager && typeof this.chatManager.handleCapNAK === 'function') {
                this.chatManager.handleCapNAK(caps);
            }
        } else if (sub === "DEL") {
            for (const cap of caps) {
                this.availableCaps.delete(cap);
                this.enabledCaps.delete(cap);
            }
        }

        this.output = "Status";

        if (sub === "LS") {
            const span = this.i18nSpan('chat.capabilitiesAvailable', 'Available capabilities');
            return " <span style=\"color: #00aaff\">==</span> " + span + ": " + joined;
        }
        if (sub === "NEW") {
            const span = this.i18nSpan('chat.capabilitiesNew', 'New capabilities');
            return " <span style=\"color: #00aaff\">==</span> " + span + ": " + joined;
        }
        if (sub === "ACK") {
            const span = this.i18nSpan('chat.capabilitiesEnabled', 'Enabled capabilities');
            return " <span style=\"color: #00aaff\">==</span> " + span + ": " + joined;
        }
        if (sub === "NAK") {
            const span = this.i18nSpan('chat.capabilitiesRejected', 'Rejected capabilities');
            return " <span style=\"color: #ff6600\">==</span> " + span + ": " + joined;
        }
        if (sub === "DEL") {
            const span = this.i18nSpan('chat.capabilitiesRemoved', 'Removed capabilities');
            return " <span style=\"color: #ff6600\">==</span> " + span + ": " + joined;
        }

        return null;
    }

    handleRejectedNickname(code, params) {
        this.output = "Status";
        const fallbackMessages = {
            '432': 'Nickname is invalid',
            '433': 'Nickname is already in use',
            '437': 'Nickname is temporarily unavailable'
        };
        const message = params[2] || fallbackMessages[code] || 'Nickname rejected';

        return ` <span style=\"color: #ff0000\">==</span> ${message}`;
    }

    buildAlternativeNickname(currentNick) {
        const maxNickLength = Math.max(1, this.serverNickLength || 15);
        const attemptedNick = currentNick || window.user || '';
        let base = attemptedNick;
        let suffix = `_${Math.floor(Math.random() * 900) + 100}`;

        const match = attemptedNick.match(/^(.*?)(?:_(\d+)|(_))$/);
        if (match) {
            base = match[1];
        }

        const maxBaseLength = Math.max(1, maxNickLength - suffix.length);
        if (base.length > maxBaseLength) {
            base = base.substring(0, maxBaseLength);
        }

        return `${base}${suffix}`;
    }
    
    handleCommand(ircMsg, text) {
        const { prefix, command, params } = ircMsg;
        const cmd = command.toLowerCase();

        switch (cmd) {
            case "batch":
                // Ignore BATCH control messages (IRCv3)
                return null;
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
            case "account":
                this.handleAccount(ircMsg);
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
        const rawTarget = params[0] || '';
        let message = params[1] || ''; // Target is params[0], message is params[1]

        // Some networks deliver knock notices with a single NOTICE parameter.
        // In that case the full knock payload can arrive in params[0].
        if (!message && typeof rawTarget === 'string') {
            const targetLooksLikeKnock = /(?:\[Knock\]|\bhas\s+knocked\b|\bhat\s+(?:bei\s+\S+\s+)?(?:an)?geklopft\b)/i.test(rawTarget);
            if (targetLooksLikeKnock) {
                message = rawTarget;
            }
        }

        // Check for CTCP reply (NOTICE with \001 delimiters)
        if (message.startsWith(String.fromCharCode(1))) {
            // Add ending \001 if missing
            if (!message.endsWith(String.fromCharCode(1))) {
                message = message + String.fromCharCode(1);
            }
            return this.handleCtcpReply(nick, message);
        }

        // Normalize server-style knock notice, e.g.:
        // [Knock] by Nick!user@host (no reason specified)
        // @#channel- [Knock] by Nick!user@host (no reason specified)
        // [Knock] by Nick!user@host on #channel (reason)
        const knockNoticeByMatch = message.match(/^(?:@?(#[^\s-]+)-\s+)?\[Knock\]\s+by\s+([^!\s]+)!\S+(?:\s+(?:on|to)\s+(#[^\s]+))?\s*\((.*)\)\s*$/i);
        const knockNoticeTextMatch = message.match(/^(?:@?(#[^\s-]+)-\s+)?([^!\s]+)(?:!\S+)?\s+(?:has\s+knocked(?:\s+(?:on|to)\s+(#[^\s]+))?|hat\s+(?:bei\s+(#[^\s]+)\s+)?(?:an)?geklopft)\s*(?:\((.*)\))?\s*$/i);
        const knockNoticeMatch = knockNoticeByMatch || knockNoticeTextMatch;

        if (knockNoticeMatch) {
            const isByFormat = !!knockNoticeByMatch;
            const knocker = (isByFormat ? knockNoticeMatch[2] : knockNoticeMatch[2]) || '';
            const noticeTarget = (params[0] || '').toLowerCase();
            // Strip IRC status prefixes (@, +, %, ~, !) that precede the channel name
            const noticeTargetStripped = noticeTarget.replace(/^[@+%~!]+/, '');
            const targetChannel = (noticeTargetStripped.startsWith('#') || noticeTargetStripped.startsWith('&')) ? noticeTargetStripped : '';
            const targetPrefixedMatch = noticeTarget.match(/^[@+%~!]*(#[^\s-]+)-$/i);
            const targetPrefixedChannel = targetPrefixedMatch ? (targetPrefixedMatch[1] || '').toLowerCase() : '';
            const inferredChannel = this.chatManager ? (this.chatManager.lastKnockChannel || '') : '';
            const prefixedChannel = (knockNoticeMatch[1] || '').toLowerCase();
            const inlineChannel = (
                isByFormat
                    ? (knockNoticeMatch[3] || '')
                    : (knockNoticeMatch[3] || knockNoticeMatch[4] || '')
            ).toLowerCase();
            const knockChannel = (inlineChannel || prefixedChannel || targetChannel || targetPrefixedChannel || inferredChannel || '').toLowerCase();
            const rawReason = (
                isByFormat
                    ? (knockNoticeMatch[4] || '')
                    : (knockNoticeMatch[5] || '')
            ).trim();
            const hasReason = rawReason && !/no reason specified/i.test(rawReason);
            const reason = hasReason ? rawReason : '';
            const reasonText = reason ? ` (${reason})` : '';
            const hasKnockChannelTab = !!(this.chatManager && knockChannel && this.chatManager.isPage(knockChannel));

            if (this.chatManager && knockChannel && !hasKnockChannelTab) {
                this.chatManager.addPage(knockChannel, 'channel', false);
            }

            this.output = (this.chatManager && knockChannel && this.chatManager.isPage(knockChannel))
                ? knockChannel
                : 'Status';

            if (this.chatManager && this.chatManager.notificationManager) {
                const notifyChannel = (this.chatManager && knockChannel && this.chatManager.isPage(knockChannel)) ? knockChannel : 'Status';
                this.chatManager.notificationManager.notifyKnock(notifyChannel, knocker, reason);
            }

            if (this.chatManager && typeof this.chatManager.addNotificationEvent === 'function') {
                const eventTab = (this.chatManager && knockChannel && this.chatManager.isPage(knockChannel)) ? knockChannel : 'Status';
                this.chatManager.addNotificationEvent(eventTab);
            }

            if (this.chatManager && this.chatManager.lastKnockChannel && (!inlineChannel || inlineChannel === '')) {
                this.chatManager.lastKnockChannel = '';
            }

            const knockMessage = knockChannel
                ? this.i18nSpan('chat.knock', '{nick} has knocked on {channel}{message}', { nick: knocker, channel: knockChannel, message: reasonText })
                : this.i18nSpan('chat.knock.notice', '{nick} has knocked{message}', { nick: knocker, message: reasonText });

            return ` <span style="color: #ff0000">==</span> ${knockMessage}`;
        }

        // Try to find a channel to route this notice to
        let targetChannel = null;
        const hasChatManager = !!this.chatManager;

        // 1) Prefer explicit NOTICE target if it is a joined channel
        const noticeTarget = (params[0] || '').toLowerCase();
        // Strip IRC status prefixes (@, +, %, ~, !) that can precede channel names (e.g. @#channel)
        const noticeTargetStripped = noticeTarget.replace(/^[@+%~!]+/, '');
        if (hasChatManager && (noticeTargetStripped.startsWith('#') || noticeTargetStripped.startsWith('&')) && this.chatManager.isPage(noticeTargetStripped)) {
            targetChannel = noticeTargetStripped;
        }

        // 2) Otherwise look for any mentioned channel names inside the message text
        if (!targetChannel && hasChatManager) {
            const mentioned = message.match(/#[a-zA-Z0-9_-]+/g) || [];
            for (const candidate of mentioned) {
                const normalized = candidate.toLowerCase();
                if (this.chatManager.isPage(normalized)) {
                    targetChannel = normalized;
                    break;
                }
            }
        }

        // Determine output window
        if (targetChannel) {
            // Display in the channel window if channel name was found in message
            this.output = targetChannel;
        } else if (nick.includes('.') || nick === 'Server' || prefix === nick) {
            // Server notices go to Status window
            this.output = "Status";
        } else {
            // User notices create/use query window
            this.output = nick;
            if (!this.chatManager.isPage(this.output)) {
                this.chatManager.addPage(this.output, "query", false);
            }
        }

        // Display normal NOTICE message
        const trustMatch = message.match(/TrustCheck OK - Open Connections: (\d+) - Max Connections: (\d+)/i);
        if (trustMatch) {
            message = this.i18nSpan('chat.trustCheck', 'TrustCheck OK - Open Connections: {open} - Max Connections: {max}', { open: trustMatch[1], max: trustMatch[2] });
        }

        const historyNoneMatch = message.match(/No message history available for (#[^\s]+)/i);
        if (historyNoneMatch) {
            message = this.i18nSpan('chat.history.none', 'No message history available for {channel}', { channel: historyNoneMatch[1] });
        }

        const historyEndMatch = message.match(/End of HISTORY for (#[^\s]+) \((\d+) messages\)/i);
        if (historyEndMatch) {
            message = this.i18nSpan('chat.history.end', 'End of history for {channel} ({count} messages)', { channel: historyEndMatch[1], count: historyEndMatch[2] });
        }
        return `-${nick}- ${message}`;
    }

    formatHostnameMessage(message) {
        const lower = message.toLowerCase();
        if (lower.includes('looking up your hostname')) {
            return this.i18nSpan('chat.hostname.lookup', '*** Looking up your hostname...');
        }
        if (lower.includes('found your hostname')) {
            const match = message.match(/found your hostname:\s*(.+)$/i);
            const host = match ? match[1].trim() : '';
            return this.i18nSpan('chat.hostname.found', '*** Found your hostname: {host}', { host });
        }
        if (lower.includes('no hostname found')) {
            return this.i18nSpan('chat.hostname.notfound', '*** No hostname found.');
        }
        return message;
    }
    
    autoJoinAfterLogin() {
        if (this.login) {
            
            // Collect all channels to join, prioritizing saved channels
            const channelsToJoin = new Set();
            
            // First, add previously saved channels (priority)
            if (this.chatManager && this.chatManager.joinedChannels) {
                for (const channel of this.chatManager.joinedChannels) {
                    channelsToJoin.add(channel.toLowerCase());
                }
            }
            
            // Then add URL-parameter channels (if not already in saved list)
            if (this.channel.length !== 0) {
                const urlChannels = this.chatManager.parseChannels(this.channel).split(',');
                for (const channel of urlChannels) {
                    const normalized = channel.trim().toLowerCase();
                    if (normalized) {
                        channelsToJoin.add(normalized);
                    }
                }
            }
            
            // Join all channels (saved channels first, then new ones)
            if (channelsToJoin.size > 0 && window.postManager) {
                const channelList = Array.from(channelsToJoin).join(',');
                window.postManager.submitTextMessage("/join " + channelList);
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
            const modeMsg = this.i18nSpan('chat.mode.user', 'Usermode change: {modes}', { modes: message.trim() });
            return " <span style=\"color: #ff0000\">==</span> " + modeMsg;
        } else {
            this.output = target;
            const status = this.chatManager.getStatus(target, nick);
            const color = this.chatManager.getColor(target, nick);
            this.chatManager.setMode(target, message.trim());
            const modeMsg = this.i18nSpan('chat.mode.set', 'sets mode: {modes}', { modes: message.trim() });
            return ` <span style=\"color: #ff0000\">==</span> <span style=\"color: ${color};\">${status}${nick}</span> ${modeMsg}`;
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
        const topicMsg = this.i18nSpan('chat.topicSet', 'sets topic: {topic}', { topic: message.trim() });
        return ` <span style="color: #ff0000">==</span> <span style="color: ${color};">${status}${nick}</span> ${topicMsg}`;
    }
    
    handleQuit(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const rawReason = params[0] || '';
        const reason = rawReason.trim();
        const normalizedReason = /^(?:error:\s*)?(?:null|undefined)$/i.test(reason) ? '' : reason;
        this.chatManager.quit(nick, normalizedReason);
    }
    
    handleNick(ircMsg) {
        const { prefix, params } = ircMsg;
        const oldnick = this.parseNick(prefix);
        const newnick = params[0];

        if (oldnick && newnick && typeof window.user === 'string' && oldnick.toLowerCase() === window.user.toLowerCase()) {
            window.user = newnick;
            this.chatManager.userColor = this.chatManager.getNickColor(window.user);
        }

        this.chatManager.changeNick(oldnick, newnick);
    }
    
    handleInvite(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const normalizedParams = (params || []).filter(param => typeof param === 'string' && param.length > 0);
        const invitedNick = normalizedParams[0] || '';
        const channel = normalizedParams[1] || '';
        const currentUser = (typeof window.user === 'string' ? window.user : '').toLowerCase();

        if (!invitedNick || !channel) {
            return;
        }

        const hasChatManager = !!this.chatManager;
        const inviteTargetWindow = (hasChatManager && channel && this.chatManager.isPage(channel)) ? channel : 'Status';
        this.output = inviteTargetWindow;
        
        if (currentUser && currentUser === invitedNick.toLowerCase()) {
            const inviteMsg = this.i18nSpan('chat.invite.received', '{nick} has invited you to {channel}', { nick, channel });
            this.chatManager.parsePages(this.chatManager.getTimestamp() + ` ${inviteMsg}\n`, inviteTargetWindow);

            if (this.chatManager && typeof this.chatManager.addNotificationEvent === 'function') {
                this.chatManager.addNotificationEvent(inviteTargetWindow);
            }

            if (this.chatManager.notificationManager) {
                this.chatManager.notificationManager.notifyInvite(nick, channel);
            }
        } else if (currentUser && currentUser === nick.toLowerCase()) {
            const inviteMsg = this.i18nSpan('chat.invite.sent', 'You have invited {nick} to {channel}', { nick: invitedNick, channel });
            this.chatManager.parsePages(this.chatManager.getTimestamp() + ` ${inviteMsg}\n`, inviteTargetWindow);
        } else {
            const inviteMsg = this.i18nSpan('chat.invite.notify', '{invitedNick} has been invited to {channel} by {nick}{host}', {
                invitedNick,
                channel,
                nick,
                host: ''
            });
            this.chatManager.parsePages(this.chatManager.getTimestamp() + ` ${inviteMsg}\n`, inviteTargetWindow);

            if (this.chatManager && typeof this.chatManager.addNotificationEvent === 'function') {
                this.chatManager.addNotificationEvent(inviteTargetWindow);
            }
        }
    }
    
    handleKnock(ircMsg) {
        // KNOCK command format: :nick!user@host KNOCK #channel :message
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const channel = params[0];
        const message = params[1] || '';
        const host = this.parseHost(prefix);
        
        // Set output to the channel being knocked on
        this.output = channel;
        
        // Create channel page if it doesn't exist (for channels we're not in)
        if (!this.chatManager.isPage(channel)) {
            this.chatManager.addPage(channel, 'channel', false);
        }
        this.chatManager.setHighlight(true);
        
        // Trigger browser notification for knock
        if (this.chatManager && typeof this.chatManager.addNotificationEvent === 'function') {
            this.chatManager.addNotificationEvent(channel);
        }

        if (this.chatManager.notificationManager) {
            this.chatManager.notificationManager.notifyKnock(channel, nick, message);
        }
        
        const messageText = message ? ` (${message})` : '';
        const knockMsg = this.i18nSpan('chat.knock', '{nick} has knocked on {channel}{message}', { nick, channel, message: messageText });
        const hostText = host ? `[${host}] ` : '';
        return ` <span style="color: #ff0000">==</span> ${hostText}${knockMsg}`;
    }
    
    handleJoin(ircMsg) {
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const host = this.parseHost(prefix);
        const channel = params[0];
        const account = params.length > 1 && params[1] !== '*' ? params[1] : '';
        const color = this.chatManager.getNickColor(nick);
        
        if (window.user.toLowerCase() === nick.toLowerCase()) {
            const channelKey = channel.toLowerCase();
            const isDuplicateSelfJoin = this.selfJoinedChannels.has(channelKey);

            if (isDuplicateSelfJoin) {
                this.output = channel;
                const joinMsg = this.i18nSpan('chat.join', '[{host}] has joined {channel}', { host, channel });
                return ` <span style="color: #ff0000">==</span> <span class="message-nick" data-nick="${nick}" style="color: ${color};">${nick}</span> ${joinMsg}`;
            }

            this.selfJoinedChannels.add(channelKey);

            // Ensure re-joins (e.g. /hop) can queue WHO/HISTORY/MODE again for this channel.
            this.resetChannelCommandState(channel);

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

                // Queue history command if enabled
                if (this.historyCommandEnabled) {
                    this.queueHistoryCommand(channel);
                }

                // Queue channel mode check to avoid flooding
                this.queueModeCommand(channel);
            }
        } else {
            this.output = channel;
            this.chatManager.addNick(channel, nick, host, color);
            if (account) {
                this.handleAccount({ prefix, params: [account] });
            }
        }
        
        const joinMsg = this.i18nSpan('chat.join', '[{host}] has joined {channel}', { host, channel });
        return ` <span style="color: #ff0000">==</span> <span class="message-nick" data-nick="${nick}" style="color: ${color};">${nick}</span> ${joinMsg}`;
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
            this.resetChannelCommandState(channel);
            this.selfJoinedChannels.delete(channel.toLowerCase());
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
        const partMsg = this.i18nSpan('chat.part', '[{host}] has left {channel}{reason}', { host, channel, reason: reasonText });
        return ` <span style="color: #ff0000">==</span> <span style="color: ${color};">${status}${nick}</span> ${partMsg}`;
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
            this.resetChannelCommandState(channel);
            this.selfJoinedChannels.delete(channel.toLowerCase());
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
        const kickMsg = this.i18nSpan('chat.kick', '[{host}] has kicked {target}{reason}', { host, target: kickedNick, reason: reasonText });
        return ` <span style="color: #ff0000">==</span> <span style="color: ${this.chatManager.getColor(channel, nick)};">${this.chatManager.getStatus(channel, nick)}${nick}</span> ${kickMsg}`;
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

    handleAccount(ircMsg) {
        // ACCOUNT command format: :nick!user@host ACCOUNT account-name|*
        const { prefix, params } = ircMsg;
        const nick = this.parseNick(prefix);
        const account = params[0] || '*';
        const normalizedAccount = account === '*' ? '' : account;

        if (!this.chatManager || typeof this.chatManager.setAccount !== 'function') {
            return;
        }
        this.chatManager.setAccount(nick, normalizedAccount);
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
                const hostChange = this.i18nSpan('chat.hostChange', 'has changed host to {mask}', { mask: newUser + '@' + newHost });
                const msg = `<span style=\"color: ${nickColor};\">${nick}</span> ${hostChange}`;
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

                const actionText = ctcpContent.substring(7);
                const isOwnAction = nick.toLowerCase() === window.user.toLowerCase();
                if (target.startsWith("#") || target.startsWith("&")) {
                    const isMention = this.containsNickMention(actionText, window.user);
                    if (!isOwnAction && isMention) {
                        this.chatManager.setHighlight(true);
                    }
                } else if (!isOwnAction) {
                    this.chatManager.setHighlight(true);
                }

                return `* <span class="message-nick" data-nick="${nick}" style="color: ${this.chatManager.getColor(this.output, nick)};">${this.chatManager.getStatus(this.output, nick)}${nick}</span> ${actionText}`;
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
        
        const isOwnMessage = nick.toLowerCase() === window.user.toLowerCase();

        // Highlight in channels when user is mentioned, or for private messages.
        // Never highlight own messages.
        if (target.startsWith("#") || target.startsWith("&")) {
            // Channel message - highlight if user is mentioned
            const isMention = this.containsNickMention(message, window.user);
            if (!isOwnMessage && isMention) {
                this.chatManager.setHighlight(true);
            }
        } else if (!isOwnMessage) {
            // Private message - always highlight (except own echo)
            this.chatManager.setHighlight(true);
        }
        
        return `&lt;<span class="message-nick" data-nick="${nick}" style="color: ${this.chatManager.getColor(target, nick)};">${this.chatManager.getStatus(target, nick)}${nick}</span>&gt; ${message}`;
    }

    containsNickMention(message, nick) {
        if (!message || !nick) return false;

        // Strip common IRC control/formatting codes before matching mentions.
        const plainMessage = String(message)
            .replace(/<[^>]*>/g, ' ')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/\x03\d{0,2}(?:,\d{0,2})?/g, '')
            .replace(/[\x02\x0F\x11\x16\x1D\x1E\x1F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const targetNick = String(nick)
            .replace(/^[~&@%+]+/, '')
            .trim()
            .toLowerCase();
        if (!targetNick) return false;

        // Token-based exact match avoids partial matches and behaves better with Unicode words.
        const normalizeToken = (value) => String(value || '')
            .replace(/^[~&@%+]+/, '')
            .replace(/^[\s"'“”„‚`´.,:;!?()<>\[\]{}]+/g, '')
            .replace(/[\s"'“”„‚`´.,:;!?()<>\[\]{}]+$/g, '')
            .toLowerCase();

        const tokens = plainMessage.split(/\s+/);
        for (const token of tokens) {
            if (normalizeToken(token) === targetNick) {
                return true;
            }
        }

        return false;
    }

    formatErrorNumeric(code, params) {
        const channelTarget = this.findKnownChannel(params);
        this.output = channelTarget || "Status";
        this.hideLoadingScreen();

        const getParam = (idx) => {
            const value = params[idx] || '';
            return value.startsWith(':') ? value.substring(1) : value;
        };

        let span = null;
        switch (code) {
            case "401":
                span = this.i18nSpan('chat.err.401', 'No such nick: {target}', { target: getParam(1) });
                break;
            case "402":
                span = this.i18nSpan('chat.err.402', 'No such server: {target}', { target: getParam(1) });
                break;
            case "403":
                span = this.i18nSpan('chat.err.403', 'No such channel: {target}', { target: getParam(1) });
                break;
            case "404":
                span = this.i18nSpan('chat.err.404', 'Cannot send to channel: {target}', { target: getParam(1) });
                break;
            case "405":
                span = this.i18nSpan('chat.err.405', 'You have joined too many channels: {target}', { target: getParam(1) });
                break;
            case "407":
                span = this.i18nSpan('chat.err.407', 'Duplicate recipients. No message delivered: {target}', { target: getParam(1) });
                break;
            case "409":
                span = this.i18nSpan('chat.err.409', 'No origin specified');
                break;
            case "410":
                span = this.i18nSpan('chat.err.410', 'Unknown CAP subcommand: {target}', { target: getParam(1) });
                break;
            case "421":
                span = this.i18nSpan('chat.err.421', 'Unknown command: {command}', { command: getParam(1) });
                break;
            case "423":
                span = this.i18nSpan('chat.err.423', 'No administrative info available: {target}', { target: getParam(1) });
                break;
            case "431":
                span = this.i18nSpan('chat.err.431', 'No nickname given');
                break;
            case "432":
                span = this.i18nSpan('chat.err.432', 'Erroneous nickname: {nick}', { nick: getParam(1) });
                break;
            case "441":
                span = this.i18nSpan('chat.err.441', '{nick} is not on channel {channel}', { nick: getParam(1), channel: getParam(2) });
                break;
            case "442":
                span = this.i18nSpan('chat.err.442', 'You are not on that channel: {channel}', { channel: getParam(1) });
                break;
            case "443":
                span = this.i18nSpan('chat.err.443', '{nick} is already on channel {channel}', { nick: getParam(1), channel: getParam(2) });
                break;
            case "451":
                span = this.i18nSpan('chat.err.451', 'You have not registered');
                break;
            case "461":
                span = this.i18nSpan('chat.err.461', 'Not enough parameters for {command}', { command: getParam(1) });
                break;
            case "462":
                span = this.i18nSpan('chat.err.462', 'You may not reregister');
                break;
            case "464":
                span = this.i18nSpan('chat.err.464', 'Password incorrect');
                break;
            case "471":
                span = this.i18nSpan('chat.err.471', 'Channel is full: {channel}', { channel: getParam(1) });
                break;
            case "473":
                span = this.i18nSpan('chat.err.473', 'Cannot join channel; invite only: {channel}', { channel: getParam(1) });
                break;
            case "474":
                span = this.i18nSpan('chat.err.474', 'Cannot join channel; you are banned: {channel}', { channel: getParam(1) });
                break;
            case "475":
                span = this.i18nSpan('chat.err.475', 'Bad channel key for {channel}', { channel: getParam(1) });
                break;
            case "476":
                span = this.i18nSpan('chat.err.476', 'Bad channel mask: {channel}', { channel: getParam(1) });
                break;
            case "477":
                span = this.i18nSpan('chat.err.477', 'Channel requires authentication: {channel}', { channel: getParam(1) });
                break;
            case "481":
                span = this.i18nSpan('chat.err.481', 'Permission denied: insufficient privileges');
                break;
            case "482":
                span = this.i18nSpan('chat.err.482', 'You are not channel operator: {channel}', { channel: getParam(1) });
                break;
            case "484":
                span = this.i18nSpan('chat.err.484', 'Cannot act on an IRC operator');
                break;
            case "490":
                span = this.i18nSpan('chat.err.490', 'Channel requires secure (TLS/SSL) connection: {channel}', { channel: getParam(1) });
                break;
            case "492":
                span = this.i18nSpan('chat.err.492', 'No operator block for your host');
                break;
            case "502":
                span = this.i18nSpan('chat.err.502', 'Cannot change mode for other users');
                break;
            case "512":
                span = this.i18nSpan('chat.err.512', 'No such gline: {target}', { target: getParam(1) });
                break;
            case "712":
                span = this.i18nSpan('chat.err.712', 'Too many knocks');
                break;
            case "713":
                span = this.i18nSpan('chat.err.713', 'Channel is not invite-only or restricted');
                break;
            case "714":
                span = this.i18nSpan('chat.err.714', 'You are already on that channel');
                break;
            default:
                break;
        }

        const text = params.slice(1).join(' ').replace(/^:/, '').trim();
        if (!span && (code.startsWith('4') || code.startsWith('5') || code.startsWith('7'))) {
            span = this.i18nSpan('chat.err.unknown', 'Error {code}: {text}', { code, text });
        }

        return span ? ` <span style="color: #ff0000">==</span> ${span}` : null;
    }
    
    handleGenericNumeric(ircMsg, code, text) {
        const { params } = ircMsg;
        const channelTarget = this.findKnownChannel(params);
        this.output = channelTarget || "Status";
        
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
        return `<span style="color: #ff0000">Error: ${message.trim()}</span>`;
    }
    
    formatWhoisUser(ircMsg) {
        const { params } = ircMsg;
        // params: [nick, target-nick, username, host, *, realname]
        const nick = params[1];
        const user = params[2];
        const host = params[3];
        const realname = params[5] || '';
        const lines = [
            this.whoisLine('chat.whois.header', 'whois: {nick} [{user}@{host}]', { nick, user, host }),
            this.whoisLine('chat.whois.realname', 'realname: {realname}', { realname: realname || '(none)' }, { timestamp: true })
        ];
        return lines.join("\n");
    }
    
    formatWhoisChannels(ircMsg) {
        const { params } = ircMsg;
        // params: [nick, target-nick, channels...]
        const channels = params.slice(2).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        return this.whoisLine('chat.whois.channels', 'channels: {channels}', { channels: channels.join(' ') });
    }
    
    isHostnameLookupMessage(message) {
        const lower = message.toLowerCase();
        return lower.includes('hostname') && (lower.includes('looking up') || lower.includes('found') || lower.includes('no hostname'));
    }
    
    parseNick(nick) {
        if (typeof nick !== 'string' || nick.length === 0) {
            return '';
        }
        // Remove leading : if present
        if (nick.startsWith(':')) {
            nick = nick.substring(1);
        }

        let parsedNick = nick.includes("!") ? nick.split("!", 2)[0] : nick;

        if (this.chatManager && typeof this.chatManager.decodeNickToken === 'function') {
            parsedNick = this.chatManager.decodeNickToken(parsedNick);
        }

        if (this.chatManager && typeof this.chatManager.isStatusSymbol === 'function') {
            while (parsedNick.length > 0 && this.chatManager.isStatusSymbol(parsedNick[0])) {
                parsedNick = parsedNick.substring(1);
            }
        } else {
            parsedNick = parsedNick.replace(/^[~&@%+!]+/, '');
        }

        return parsedNick;
    }
    
    parseHost(nick) {
        if (typeof nick !== 'string' || nick.length === 0) {
            return '';
        }
        if (nick.startsWith(':')) {
            nick = nick.substring(1);
        }
        return nick.includes("!") ? nick.split("!", 2)[1] : nick;
    }

    findKnownChannel(params = []) {
        if (!this.chatManager || !this.chatManager.isPage) return null;
        for (const p of params) {
            if (typeof p === 'string' && p.startsWith('#')) {
                const ch = p.toLowerCase();
                if (this.chatManager.isPage(ch)) {
                    return ch;
                }
            }
        }
        return null;
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
            const k = key ? key.toLowerCase() : '';
            if (!k) continue;
            tags.set(k, value || true);
        }
        
        return tags;
    }

    isRawDebugEnabled() {
        return this.rawLineDebug === true;
    }

    setRawDebug(enabled) {
        this.rawLineDebug = enabled === true;
        window.ircRawDebug = this.rawLineDebug;
    }

    logRawLine(direction, line) {
        if (!this.isRawDebugEnabled()) return;
        if (typeof line !== 'string' || line.length === 0) return;
        const dir = direction === 'OUT' ? 'OUT' : 'IN';
        console.debug(`[IRC RAW ${dir}]`, line);
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
     * Queue a WHO command; each command is sent one-by-one via the shared command queue
     */
    queueWhoCommand(target) {
        if (!this.whoQueue.includes(target)) {
            this.whoQueue.push(target);
            this.enqueueCommand("/who " + target);
        }
    }

    /**
     * Queue a history command; each command is sent one-by-one via the shared command queue
     */
    queueHistoryCommand(channel) {
        if (!this.historyQueue.includes(channel)) {
            this.historyQueue.push(channel);
            const command = this.historyCommand.replace(/%CHANNEL%/g, channel);
            this.enqueueCommand(command);
        }
    }

    /**
     * Queue a MODE command; each command is sent one-by-one via the shared command queue
     */
    queueModeCommand(channel) {
        if (!this.modeQueue.includes(channel)) {
            this.modeQueue.push(channel);
            this.enqueueCommand("/mode " + channel);
        }
    }

    /**
     * Reset dedupe state for channel-related queued commands so they can run again after rejoin.
     */
    resetChannelCommandState(channel) {
        this.whoQueue = this.whoQueue.filter((entry) => entry !== channel);
        this.historyQueue = this.historyQueue.filter((entry) => entry !== channel);
        this.modeQueue = this.modeQueue.filter((entry) => entry !== channel);

        const whoCommand = "/who " + channel;
        const modeCommand = "/mode " + channel;
        const historyCommand = this.historyCommand.replace(/%CHANNEL%/g, channel);
        this.commandQueue = this.commandQueue.filter((queuedCommand) => {
            return queuedCommand !== whoCommand
                && queuedCommand !== modeCommand
                && queuedCommand !== historyCommand;
        });
    }

    /**
     * Add an IRC command to the shared queue; every send is spaced by commandDelay
     */
    enqueueCommand(commandText) {
        this.commandQueue.push(commandText);

        if (!this.commandTimer) {
            this.commandTimer = setTimeout(() => {
                this.processCommandQueue();
            }, this.commandDelay);
        }
    }

    /**
     * Process the shared command queue with a fixed delay between sends
     */
    processCommandQueue() {
        if (this.commandQueue.length === 0) {
            this.commandTimer = null;
            return;
        }

        const command = this.commandQueue.shift();
        window.postManager.submitTextMessage(command);

        if (this.commandQueue.length > 0) {
            this.commandTimer = setTimeout(() => {
                this.processCommandQueue();
            }, this.commandDelay);
        } else {
            this.commandTimer = null;
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
