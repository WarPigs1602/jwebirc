package net.midiandmore.jwebirc;

import inet.ipaddr.AddressStringException;
import inet.ipaddr.IPAddress;
import inet.ipaddr.IPAddressString;
import jakarta.json.Json;
import java.io.IOException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.websocket.CloseReason;
import jakarta.websocket.EndpointConfig;
import jakarta.websocket.HandshakeResponse;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnMessage;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.PongMessage;
import jakarta.websocket.server.HandshakeRequest;
import jakarta.websocket.server.ServerEndpoint;
import jakarta.websocket.server.ServerEndpointConfig;
import jakarta.enterprise.concurrent.ContextService;
import jakarta.enterprise.concurrent.ManagedExecutorService;
import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import java.io.StringReader;
import java.io.StringWriter;
import java.io.Writer;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Adds a irc webchat function
 *
 * @author Andreas Pschorn
 */
@ServerEndpoint(value = "/Webchat", configurator = Webchat.ChatHandshake.class)
public class Webchat {

    private static final Logger LOGGER = Logger.getLogger(Webchat.class.getName());
    private static final long DEFAULT_RECONNECT_GRACE_MS = 30000L;
    private static final Map<String, ReconnectContext> RECONNECT_CONTEXTS = new ConcurrentHashMap<>();

    /**
     * Jakarta Concurrency managed scheduled executor used for the reconnect grace window.
     * Resolved lazily because WebSocket endpoints are not CDI injection targets.
     */
    private static volatile ManagedScheduledExecutorService reconnectScheduler;

    /**
     * Resolves the managed scheduled executor from CDI. WebSocket endpoints are not
     * injection targets, so the managed bean is looked up programmatically. The
     * Jakarta Concurrency provider manages the thread lifecycle (naming, daemon
     * behaviour, shutdown on undeploy).
     */
    private static ManagedScheduledExecutorService getReconnectScheduler() {
        if (reconnectScheduler == null) {
            synchronized (Webchat.class) {
                if (reconnectScheduler == null) {
                    reconnectScheduler = ConcurrencyResources.reconnectScheduler();
                }
            }
        }
        return reconnectScheduler;
    }

    private static volatile ManagedExecutorService ircExecutor;

    /**
     * Resolves the managed executor for running the IRC read loop. The Jakarta Concurrency
     * provider owns the worker thread lifecycle and applies the container thread context
     * instead of creating a raw {@link java.lang.Thread}.
     */
    private static ManagedExecutorService getManagedExecutor() {
        if (ircExecutor == null) {
            synchronized (Webchat.class) {
                if (ircExecutor == null) {
                    ircExecutor = ConcurrencyResources.ircExecutor();
                }
            }
        }
        return ircExecutor;
    }

    private static final class ReconnectContext {
        private final String key;
        private final IrcParser parser;
        private final IrcThread ircThread;
        private ScheduledFuture<?> cleanupTask;
        private boolean attached;
        private Session attachedSession;

        private ReconnectContext(String key, IrcParser parser, IrcThread ircThread) {
            this.key = key;
            this.parser = parser;
            this.ircThread = ircThread;
        }
    }

    private HttpSession httpSession;
    private Session session;
    private String cat;
    private Map<String, List<String>> map;
    private IrcParser parser;
    private IrcThread ircThread;

    /**
     * Opens a webchat session
     *
     * @param session The session
     * @param config The config
     */
    @OnOpen
    public void onOpen(Session session, EndpointConfig config) {
        setSession(session);
        setMap(session.getRequestParameterMap());
        var hs = (HttpSession) config.getUserProperties()
                .get(HttpSession.class.getName());
        setHttpSession(hs);

        if (hs == null) {
            LOGGER.log(Level.SEVERE, "WebSocket opened without HTTP session; cannot continue");
            closeSessionWithError(session, "No HTTP session available");
            return;
        }

        String reconnectKey = getReconnectKey();
        if (tryResumeReconnectContext(reconnectKey, session)) {
            return;
        }
        
        // Load configuration from HTTP session
        WebchatConfig webchatConfig = loadWebchatConfig();
        if (webchatConfig == null) {
            closeSessionWithError(session, "Failed to load webchat configuration");
            return;
        }
        
        // Process forwarded headers and IP addresses
        processForwardedHeaders(config, webchatConfig);
        
        // Configure session timeout
        configureSessionTimeout(webchatConfig.sessionTimeout);
        
        // Initialize IRC parser
        if (!initializeIrcParser(session, webchatConfig)) {
            return; // Error occurred, session closed
        }
        
        // Setup login parameters
        setupLoginParameters(webchatConfig);
    }

    private void closeSessionWithError(Session session, String message) {
        try {
            if (session != null && session.isOpen()) {
                session.getBasicRemote().sendText(Json.createObjectBuilder()
                        .add("category", "error")
                        .add("target", "")
                        .add("message", message)
                        .build().toString());
                session.close();
            }
        } catch (IOException e) {
            LOGGER.log(Level.WARNING, "Error closing session after null session error", e);
        }
    }
    
    private static class WebchatConfig {
        int sessionTimeout;
        int nickLength;
        String host;
        int port;
        boolean ssl;
        String serverPassword;
        String ident;
        String user;
        String password;
        String hostname;
        String ip;
        String realname;
        String forwardedForHeader;
        String forwardedForIps;
        String webircMode;
        String webircCgi;
        String hmac;
        boolean webircIncludeSecure;
        String useSasl;
        String saslMechanism;
        String saslUsername;
        String saslPassword;
        String nick;
        String channel;
    }
    
    private WebchatConfig loadWebchatConfig() {
        HttpSession hs = getHttpSession();
        if (hs == null) {
            LOGGER.log(Level.SEVERE, "Cannot load webchat config: HTTP session is null");
            return null;
        }
        WebchatConfig config = new WebchatConfig();
        try {
            Object sessionTimeoutAttr = hs.getAttribute("webchat_session_timeout");
            if (sessionTimeoutAttr != null) {
                config.sessionTimeout = Integer.parseInt(sessionTimeoutAttr.toString());
            } else {
                config.sessionTimeout = 300000;
            }
        } catch (IllegalStateException | NumberFormatException ex) {
            LOGGER.log(Level.WARNING, "Invalid webchat session timeout, using default", ex);
            config.sessionTimeout = 300000;
        }
        Object nickLengthAttr = hs.getAttribute("webchat_nick_length");
        config.nickLength = 15;
        if (nickLengthAttr instanceof String nickLengthValue) {
            try {
                config.nickLength = Math.max(1, Integer.parseInt(nickLengthValue));
            } catch (NumberFormatException ex) {
                Logger.getLogger(Webchat.class.getName()).log(Level.FINE, ex,
                        () -> "Ignoring invalid configured nick length: " + nickLengthValue);
            }
        }
        config.host = (String) hs.getAttribute("webchat_host");
        try {
            Object portAttr = hs.getAttribute("webchat_port");
            if (portAttr != null) {
                config.port = Integer.parseInt(portAttr.toString());
            } else {
                config.port = 6669;
            }
        } catch (IllegalStateException | NumberFormatException ex) {
            LOGGER.log(Level.WARNING, "Invalid webchat port, using default 6669", ex);
            config.port = 6669;
        }
        
        // Parse SSL flag robustly: case-insensitive, handle null, trim whitespace, and log debug info
        Object sslAttr = hs.getAttribute("webchat_ssl");
        config.ssl = false;
        if (sslAttr != null) {
            String sslStr = sslAttr.toString().trim();
            config.ssl = sslStr.equalsIgnoreCase("true") || sslStr.equalsIgnoreCase("1") || sslStr.equalsIgnoreCase("yes");
            Logger.getLogger(Webchat.class.getName()).log(Level.FINE, 
                "Parsed SSL flag from session: {0} (type: {1}) -> {2}", 
                new Object[]{sslAttr, sslAttr.getClass().getSimpleName(), config.ssl});
        } else {
            Logger.getLogger(Webchat.class.getName()).log(Level.FINE, "SSL flag not set in session (null)");
        }
        
        config.serverPassword = (String) hs.getAttribute("webchat_server_password");
        config.ident = (String) hs.getAttribute("webchat_ident");
        config.user = (String) hs.getAttribute("webchat_user");
        config.password = (String) hs.getAttribute("webchat_password");
        config.hostname = (String) hs.getAttribute("hostname");
        config.ip = (String) hs.getAttribute("ip");
        config.realname = (String) hs.getAttribute("webchat_realname");
        config.forwardedForHeader = (String) hs.getAttribute("forwarded_for_header");
        config.forwardedForIps = (String) hs.getAttribute("forwarded_for_ips");
        config.webircMode = (String) hs.getAttribute("webchat_mode");
        config.webircCgi = (String) hs.getAttribute("webchat_cgi");
        config.hmac = (String) hs.getAttribute("hmac_temporal");
        
        // Parse WEBIRC :secure flag setting (defaults to true)
        Object webircSecureAttr = hs.getAttribute("webirc_include_secure");
        config.webircIncludeSecure = true;  // Default to true
        if (webircSecureAttr != null) {
            String secureStr = webircSecureAttr.toString().trim();
            config.webircIncludeSecure = secureStr.equalsIgnoreCase("true") || secureStr.equalsIgnoreCase("1") || secureStr.equalsIgnoreCase("yes");
        }
        
        config.useSasl = (String) hs.getAttribute("use_sasl");
        config.saslMechanism = (String) hs.getAttribute("sasl_mechanism");
        config.saslUsername = (String) hs.getAttribute("sasl_username");
        config.saslPassword = (String) hs.getAttribute("sasl_password");
        config.nick = (String) hs.getAttribute("param-nick");
        config.channel = (String) hs.getAttribute("param-channel");
        return config;
    }
    
    private void processForwardedHeaders(EndpointConfig config, WebchatConfig webchatConfig) {
        if (webchatConfig.forwardedForHeader == null || webchatConfig.forwardedForHeader.isBlank()
                || webchatConfig.forwardedForIps == null || webchatConfig.forwardedForIps.isBlank()) {
            return;
        }
        if (config.getUserProperties().containsKey(webchatConfig.forwardedForHeader.toLowerCase()) 
                && webchatConfig.ip != null && webchatConfig.ip.contains(webchatConfig.forwardedForIps)) {
            webchatConfig.hostname = (String) config.getUserProperties().getOrDefault(webchatConfig.forwardedForHeader.toLowerCase(), "127.0.0.1");
            try {
                webchatConfig.ip = InetAddress.getByName(webchatConfig.hostname).getHostAddress();
            } catch (UnknownHostException ex) {
                LOGGER.log(Level.FINE, "Could not resolve forwarded hostname to IP", ex);
            }
            try {
                webchatConfig.hostname = InetAddress.getByName(webchatConfig.ip).getHostName();
            } catch (UnknownHostException ex) {
                LOGGER.log(Level.FINE, "Could not reverse resolve forwarded IP to hostname", ex);
            }
        }
        
        // Parse and normalize IP addresses
        webchatConfig.ip = normalizeIpAddress(webchatConfig.ip);
        webchatConfig.hostname = normalizeIpAddress(webchatConfig.hostname);
    }
    
    private String normalizeIpAddress(String address) {
        if (address == null || !address.contains(":")) {
            return address;
        }
        // Remove zone ID if present (e.g., fe80::1%eth0 -> fe80::1)
        if (address.contains("%")) {
            address = address.substring(0, address.indexOf("%"));
        }
        return parseIpv6(address);
    }
    
    private void configureSessionTimeout(int sessionTimeout) {
        long timeoutMillis = sessionTimeout;
        if (timeoutMillis < 300000) { // Less than 5 minutes
            timeoutMillis = 300000; // Set to 5 minutes minimum
            Logger.getLogger(Webchat.class.getName()).log(Level.INFO, 
                "Session timeout adjusted from {0}ms to {1}ms", new Object[]{sessionTimeout, timeoutMillis});
        }
        Session currentSession = getSession();
        if (currentSession != null && currentSession.isOpen()) {
            currentSession.setMaxIdleTimeout(timeoutMillis);
        }
    }
    
    private boolean initializeIrcParser(Session session, WebchatConfig config) {
        if (config.host == null || config.host.isBlank()) {
            Logger.getLogger(Webchat.class.getName()).log(Level.SEVERE, "IRC host is not configured");
            try {
                session.getBasicRemote().sendText(Json.createObjectBuilder()
                        .add("category", "error")
                        .add("target", "")
                        .add("message", "IRC host is not configured")
                        .build().toString());
                session.close();
            } catch (IOException e) {
                // Ignore
            }
            return false;
        }
        try {
            setParser(new IrcParser(config.host, config.port, config.ssl, config.serverPassword, 
                    config.ident, config.user, config.password, config.webircMode, config.webircCgi, config.hmac));
            
            // Set WEBIRC :secure flag configuration
            getParser().setWebircIncludeSecure(config.webircIncludeSecure);
            
            // Set SASL parameters if enabled
            if (config.useSasl != null && config.useSasl.equals("true")) {
                String effectiveSaslUsername = config.saslUsername;
                if (effectiveSaslUsername == null || effectiveSaslUsername.isBlank()) {
                    if (config.nick != null && !config.nick.isBlank()) {
                        effectiveSaslUsername = config.nick;
                    } else {
                        effectiveSaslUsername = config.user;
                    }
                }
                getParser().setUseSasl(true);
                getParser().setSaslUsername(effectiveSaslUsername != null ? effectiveSaslUsername : "");
                getParser().setSaslPassword(config.saslPassword != null ? config.saslPassword : "");
                
                // Set SASL mechanism (default to PLAIN if not specified)
                String mechanism = config.saslMechanism;
                if (mechanism == null || mechanism.isBlank()) {
                    mechanism = "PLAIN";
                }
                getParser().setSaslMechanism(mechanism);
                Logger.getLogger(Webchat.class.getName()).log(Level.INFO, "SASL enabled with mechanism: {0}", mechanism);
            } else {
                getParser().setUseSasl(false);
            }
            
            getParser().setServerNickLength(config.nickLength);
            getParser().setHostname(config.hostname);
            getParser().setIp(config.ip);
            getParser().setRealname(config.realname);
            return true;
        } catch (IOException ex) {
            Logger.getLogger(Webchat.class.getName()).log(Level.SEVERE, "Failed to connect to IRC server: " + ex.getMessage(), ex);
            try {
                session.getBasicRemote().sendText(Json.createObjectBuilder()
                        .add("category", "error")
                        .add("target", "")
                        .add("message", "Connection failed: " + ex.getMessage())
                        .build().toString());
                session.close();
            } catch (IOException e) {
                // Ignore
            }
            return false;
        }
    }
    
    private void setupLoginParameters(WebchatConfig config) {
        String channel = config.channel;
        if (channel != null) {
            var sb = new StringBuilder();
            if (channel.contains(",")) {
                var arr = channel.split(",");
                for (var elem : arr) {
                    sb.append("#");
                    sb.append(elem);
                    sb.append(",");
                }
                channel = sb.substring(0, sb.length() - 1);
            } else {
                channel = "#" + channel;
            }
        }
        var p = getParser();
        if (p == null) {
            LOGGER.log(Level.SEVERE, "Cannot setup login parameters: parser is null");
            return;
        }
        p.setLoginChannels(channel);
        setIrcThread(new IrcThread(p, config.nick, getSession(), getManagedExecutor()));
        registerReconnectContext();
    }

    private String getReconnectKey() {
        HttpSession hs = getHttpSession();
        if (hs == null) {
            return null;
        }
        try {
            return hs.getId();
        } catch (IllegalStateException ex) {
            LOGGER.log(Level.FINE, "HTTP session already invalidated while getting reconnect key", ex);
            return null;
        }
    }

    private long getReconnectGraceMs() {
        HttpSession hs = getHttpSession();
        if (hs == null) {
            return DEFAULT_RECONNECT_GRACE_MS;
        }

        try {
            Object configured = hs.getAttribute("webchat_reconnect_grace_ms");
            if (configured == null) {
                return DEFAULT_RECONNECT_GRACE_MS;
            }

            long parsed = Long.parseLong(configured.toString().trim());
            return Math.max(1000L, parsed);
        } catch (IllegalStateException ex) {
            LOGGER.log(Level.FINE, "HTTP session already invalidated while getting reconnect grace", ex);
            return DEFAULT_RECONNECT_GRACE_MS;
        } catch (NumberFormatException ex) {
            LOGGER.log(Level.FINE, ex, () -> "Invalid reconnect grace value");
            return DEFAULT_RECONNECT_GRACE_MS;
        }
    }

    private boolean tryResumeReconnectContext(String reconnectKey, Session currentSession) {
        if (reconnectKey == null || reconnectKey.isBlank()) {
            return false;
        }

        ReconnectContext context = RECONNECT_CONTEXTS.get(reconnectKey);
        if (context == null) {
            return false;
        }

        synchronized (context) {
            if (context.attached && context.attachedSession != null && context.attachedSession.isOpen()) {
                LOGGER.log(Level.FINE, "Reconnect context for HTTP session {0} is already attached to an open session, skipping", reconnectKey);
                return false;
            }
            if (context.parser == null || context.ircThread == null) {
                LOGGER.log(Level.WARNING, "Reconnect context for HTTP session {0} is missing parser or thread, discarding", reconnectKey);
                RECONNECT_CONTEXTS.remove(reconnectKey, context);
                return false;
            }

            if (context.cleanupTask != null) {
                context.cleanupTask.cancel(false);
                context.cleanupTask = null;
            }

            context.attached = true;
            context.attachedSession = currentSession;
            context.ircThread.setSession(currentSession);
            setParser(context.parser);
            setIrcThread(context.ircThread);

            context.parser.sendText("NOTICE AUTH *** (jwebirc) WebSocket reconnected. Continuing existing IRC session.\n", currentSession, "chat", "");
        }

        LOGGER.log(Level.INFO, "Reattached existing IRC session for HTTP session {0}", reconnectKey);
        return true;
    }

    private void registerReconnectContext() {
        String reconnectKey = getReconnectKey();
        if (reconnectKey == null || reconnectKey.isBlank() || getParser() == null || getIrcThread() == null) {
            return;
        }

        ReconnectContext existing = RECONNECT_CONTEXTS.get(reconnectKey);
        if (existing != null) {
            synchronized (existing) {
                if (existing.attached && existing.attachedSession != null && existing.attachedSession.isOpen()) {
                    LOGGER.log(Level.FINE, "Reconnect context for HTTP session {0} already attached to an open session, not overwriting", reconnectKey);
                    return;
                }
            }
        }

        ReconnectContext context = new ReconnectContext(reconnectKey, getParser(), getIrcThread());
        RECONNECT_CONTEXTS.put(reconnectKey, context);
    }

    private void scheduleReconnectCleanup(String reasonPrefix) {
        String reconnectKey = getReconnectKey();
        if (reconnectKey == null || reconnectKey.isBlank() || getParser() == null) {
            cleanupResources();
            return;
        }

        Session closingSession = getSession();
        ReconnectContext existing = RECONNECT_CONTEXTS.get(reconnectKey);
        if (existing != null) {
            synchronized (existing) {
                if (existing.attached && existing.attachedSession != null && existing.attachedSession != closingSession) {
                    LOGGER.log(Level.FINE, "Reconnect context for HTTP session {0} is attached to another session, skipping cleanup scheduling", reconnectKey);
                    return;
                }
            }
        }

        registerReconnectContext();
        ReconnectContext context = RECONNECT_CONTEXTS.get(reconnectKey);
        if (context == null) {
            cleanupResources();
            return;
        }

        synchronized (context) {
            if (context.attached && context.attachedSession != null && context.attachedSession != closingSession) {
                LOGGER.log(Level.FINE, "Reconnect context for HTTP session {0} was attached to another session while scheduling cleanup, skipping", reconnectKey);
                return;
            }
            context.attached = false;
            context.attachedSession = null;
            if (context.cleanupTask != null) {
                context.cleanupTask.cancel(false);
            }

            long graceMs = getReconnectGraceMs();
            context.cleanupTask = getReconnectScheduler().schedule(() -> {
                ReconnectContext latest = RECONNECT_CONTEXTS.get(context.key);
                if (latest != context) {
                    return;
                }

                synchronized (context) {
                    if (context.attached && context.attachedSession != null && context.attachedSession.isOpen()) {
                        LOGGER.log(Level.FINE, "Reconnect context for HTTP session {0} is attached to an open session, aborting cleanup", reconnectKey);
                        return;
                    }
                    try {
                        if (context.parser != null) {
                            context.parser.logout(reasonPrefix + "Reconnect timeout");
                        }
                    } catch (Exception ex) {
                        LOGGER.log(Level.WARNING, "Error while closing expired reconnect context", ex);
                    } finally {
                        RECONNECT_CONTEXTS.remove(context.key, context);
                    }
                }
            }, graceMs, TimeUnit.MILLISECONDS);

            LOGGER.log(Level.INFO, "Scheduled reconnect grace window ({0} ms) for HTTP session {1}", new Object[]{graceMs, reconnectKey});
        }
    }

    private String parseIpv6(String ip) {
        try {
            IPAddressString str = new IPAddressString(ip);
            IPAddress addr = str.toAddress();
            // Return full canonical string for IPv6 without compression
            // Example: 2001:0db8:0000:0000:0000:0000:0000:0001
            if (addr.isIPv6()) {
                return addr.toIPv6().toFullString();
            } else {
                return addr.toCanonicalString();
            }
        } catch (AddressStringException e) {
            // If parsing fails, return original string
            Logger.getLogger(Webchat.class.getName()).log(Level.WARNING, "Failed to parse IP address: {0} - {1}", new Object[]{ip, e.getMessage()});
        }
        return ip;
    }

    /**
     * Handle Pong messages (response to Ping)
     *
     * @param pongMessage The pong message
     * @param session The session
     */
    @OnMessage
    public void onPong(PongMessage pongMessage, Session session) {
        Logger.getLogger(Webchat.class.getName()).log(Level.FINE, "Pong received from session: " + session.getId());
    }
    
    /**
     * Parses a mesage
     *
     * @param message The message
     */
    @OnMessage
    public void onMessage(String message) {
        try {
            if (getParser() == null) {
                Logger.getLogger(Webchat.class.getName()).log(Level.WARNING, "Parser is null, cannot process message");
                return;
            }
            
            var json = Json.createReader(new StringReader(message)).readObject();
            var text = json.getString("message");
            if (text.startsWith("/")) {
                text = text.substring(1);
            } else {
                getParser().sendText("Message must starts with /\n", getSession(), "chat", "");
                return;
            }
            var args = new String[2];
            if (text.contains(" ")) {
                args = text.split(" ", 2);
            } else {
                args[0] = text;
                args[1] = "";
            }
            
            // Only convert to uppercase if not a message tag (IRCv3)
            // Message tags start with @ and are case-sensitive
            if (!args[0].startsWith("@")) {
                args[0] = args[0].toUpperCase();
            }
            getParser().submitMessage("%s %s", args[0], args[1]);
        } catch (Exception e) {
            Logger.getLogger(Webchat.class.getName()).log(Level.SEVERE, "Error processing message", e);
        }
    }

    /**
     * Close a session
     *
     * @param session The session
     * @throws IOException
     */
    @OnClose
    public synchronized void onClose(Session session, CloseReason closeReason) {
        if (closeReason != null) {
            CloseReason.CloseCode code = closeReason.getCloseCode();
            if (code == CloseReason.CloseCodes.NORMAL_CLOSURE || code == CloseReason.CloseCodes.GOING_AWAY) {
                cleanupResources();
                return;
            }
        }
        scheduleReconnectCleanup("Page closed: ");
    }

    /**
     * Send an error
     *
     * @param session The session
     * @param throwable The throwable
     */
    @OnError
    public synchronized void onError(Session session, Throwable throwable) {
        LOGGER.log(Level.SEVERE, "WebSocket error occurred", throwable);
        scheduleReconnectCleanup("Error: ");
    }
    
    /**
     * Cleanup all resources (parser, threads, sockets) - thread-safe
     */
    private synchronized void cleanupResources() {
        String reconnectKey = getReconnectKey();
        if (reconnectKey != null && !reconnectKey.isBlank()) {
            Session closingSession = getSession();
            ReconnectContext context = RECONNECT_CONTEXTS.get(reconnectKey);
            if (context != null) {
                synchronized (context) {
                    if (context.attached && context.attachedSession != null && context.attachedSession != closingSession) {
                        LOGGER.log(Level.FINE, "Reconnect context for HTTP session {0} is attached to another session, skipping cleanup", reconnectKey);
                        return;
                    }
                }
            }
            RECONNECT_CONTEXTS.remove(reconnectKey);
        }

        try {
            if (parser != null) {
                try {
                    parser.closeConnection();
                } catch (Exception e) {
                    LOGGER.log(Level.WARNING, "Error closing parser connection", e);
                }
            }
        } finally {
            // Set to null only after closing
            parser = null;
            ircThread = null;
        }
    }

    /**
     * @return the httpSession
     */
    protected HttpSession getHttpSession() {
        return httpSession;
    }

    /**
     * @param httpSession the httpSession to set
     */
    protected void setHttpSession(HttpSession httpSession) {
        this.httpSession = httpSession;
    }

    /**
     * @return the session
     */
    protected Session getSession() {
        return session;
    }

    /**
     * @param session the session to set
     */
    protected void setSession(Session session) {
        this.session = session;
    }

    /**
     * Chat
     */
    public static class ChatHandshake extends ServerEndpointConfig.Configurator {

        /**
         *
         * @param sec
         * @param req
         * @param response
         */
        @Override
        public void modifyHandshake(ServerEndpointConfig sec, HandshakeRequest req, HandshakeResponse response) {
            var request = getField(req, HttpServletRequest.class);
            Enumeration<String> headerNames = request.getHeaderNames();
            while (headerNames.hasMoreElements()) {
                String key = headerNames.nextElement();
                var value = request.getHeader(key);
                sec.getUserProperties().put(key.toLowerCase(), value);
            }
            sec.getUserProperties().put("ip", request.getRemoteAddr()); // lower-case!
            var httpSession = (HttpSession) request.getSession(false);
            sec.getUserProperties().put(HttpSession.class.getName(), httpSession);
        }

        //hacking reflector to expose fields...
        @SuppressWarnings({"unchecked", "deprecation"})
        private static < I, F> F getField(I instance, Class< F> fieldType) {
            try {
                for (var type = instance.getClass(); type != Object.class; type = type.getSuperclass()) {
                    for (var field : type.getDeclaredFields()) {
                        if (fieldType.isAssignableFrom(field.getType())) {
                            F result = tryGetFieldValue(field, instance);
                            if (result != null) {
                                return result;
                            }
                        }
                    }
                }
            } catch (IllegalArgumentException | SecurityException e) {
                // Unable to access fields
            }
            return null;
        }
        
        @SuppressWarnings({"unchecked", "deprecation", "java:S3011"}) // S3011: Reflection should not be used to increase accessibility of classes, methods, or fields - Required for WebSocket handshake access
        private static <I, F> F tryGetFieldValue(java.lang.reflect.Field field, I instance) {
            try {
                field.setAccessible(true);
                return (F) field.get(instance);
            } catch (SecurityException | IllegalAccessException e) {
                // Continue to next field if security manager prevents access
                return null;
            }
        }

    }

    /**
     * @return the cat
     */
    public String getCat() {
        return cat;
    }

    /**
     * @param cat the cat to set
     */
    public void setCat(String cat) {
        this.cat = cat;
    }

    /**
     * @return the map
     */
    public Map<String, List<String>> getMap() {
        return map;
    }

    /**
     * @param map the map to set
     */
    public void setMap(Map<String, List<String>> map) {
        this.map = map;
    }

    /**
     * @return the parser
     */
    public IrcParser getParser() {
        return parser;
    }

    /**
     * @param parser the parser to set
     */
    public void setParser(IrcParser parser) {
        this.parser = parser;
    }

    /**
     * @return the ircThread
     */
    public IrcThread getIrcThread() {
        return ircThread;
    }

    /**
     * @param ircThread the ircThread to set
     */
    public void setIrcThread(IrcThread ircThread) {
        this.ircThread = ircThread;
    }
}
