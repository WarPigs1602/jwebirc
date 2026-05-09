package net.midiandmore.jwebirc;

import inet.ipaddr.AddressStringException;
import inet.ipaddr.IPAddress;
import inet.ipaddr.IPAddressString;
import jakarta.json.Json;
import java.io.IOException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
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
import java.io.StringReader;
import java.io.StringWriter;
import java.io.Writer;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Adds a irc webchat function
 *
 * @author Andreas Pschorn
 */
@ServerEndpoint(value = "/Webchat", configurator = Webchat.ChatHandshake.class)
public class Webchat {

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
        
        // Load configuration from HTTP session
        WebchatConfig webchatConfig = loadWebchatConfig();
        
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
        String useSasl;
        String saslMechanism;
        String saslUsername;
        String saslPassword;
        String nick;
        String channel;
    }
    
    private WebchatConfig loadWebchatConfig() {
        WebchatConfig config = new WebchatConfig();
        config.sessionTimeout = Integer.parseInt((String) getHttpSession().getAttribute("webchat_session_timout"));
        Object nickLengthAttr = getHttpSession().getAttribute("webchat_nick_length");
        config.nickLength = 15;
        if (nickLengthAttr instanceof String nickLengthValue) {
            try {
                config.nickLength = Math.max(1, Integer.parseInt(nickLengthValue));
            } catch (NumberFormatException ex) {
                Logger.getLogger(Webchat.class.getName()).log(Level.FINE,
                        "Ignoring invalid configured nick length: {0}", nickLengthValue);
            }
        }
        config.host = (String) getHttpSession().getAttribute("webchat_host");
        config.port = Integer.parseInt((String) getHttpSession().getAttribute("webchat_port"));
        config.ssl = getHttpSession().getAttribute("webchat_ssl").equals("true");
        config.serverPassword = (String) getHttpSession().getAttribute("webchat_server_password");
        config.ident = (String) getHttpSession().getAttribute("webchat_ident");
        config.user = (String) getHttpSession().getAttribute("webchat_user");
        config.password = (String) getHttpSession().getAttribute("webchat_password");
        config.hostname = (String) getHttpSession().getAttribute("hostname");
        config.ip = (String) getHttpSession().getAttribute("ip");
        config.realname = (String) getHttpSession().getAttribute("webchat_realname");
        config.forwardedForHeader = (String) getHttpSession().getAttribute("forwarded_for_header");
        config.forwardedForIps = (String) getHttpSession().getAttribute("forwarded_for_ips");
        config.webircMode = (String) getHttpSession().getAttribute("webchat_mode");
        config.webircCgi = (String) getHttpSession().getAttribute("webchat_cgi");
        config.hmac = (String) getHttpSession().getAttribute("hmac_temporal");
        config.useSasl = (String) getHttpSession().getAttribute("use_sasl");
        config.saslMechanism = (String) getHttpSession().getAttribute("sasl_mechanism");
        config.saslUsername = (String) getHttpSession().getAttribute("sasl_username");
        config.saslPassword = (String) getHttpSession().getAttribute("sasl_password");
        config.nick = (String) getHttpSession().getAttribute("param-nick");
        config.channel = (String) getHttpSession().getAttribute("param-channel");
        return config;
    }
    
    private void processForwardedHeaders(EndpointConfig config, WebchatConfig webchatConfig) {
        if (config.getUserProperties().containsKey(webchatConfig.forwardedForHeader.toLowerCase()) 
                && webchatConfig.ip.contains(webchatConfig.forwardedForIps)) {
            webchatConfig.hostname = (String) config.getUserProperties().getOrDefault(webchatConfig.forwardedForHeader.toLowerCase(), "127.0.0.1");
            try {
                webchatConfig.ip = InetAddress.getByName(webchatConfig.hostname).getHostAddress();
            } catch (UnknownHostException ex) {
                // Ignore - use original hostname
            }
            try {
                webchatConfig.hostname = InetAddress.getByName(webchatConfig.ip).getHostName();
            } catch (UnknownHostException ex) {
                // Ignore - use IP as hostname
            }
        }
        
        // Parse and normalize IP addresses
        webchatConfig.ip = normalizeIpAddress(webchatConfig.ip);
        webchatConfig.hostname = normalizeIpAddress(webchatConfig.hostname);
    }
    
    private String normalizeIpAddress(String address) {
        if (address.contains(":")) {
            // Remove zone ID if present (e.g., fe80::1%eth0 -> fe80::1)
            if (address.contains("%")) {
                address = address.substring(0, address.indexOf("%"));
            }
            address = parseIpv6(address);
        }
        return address;
    }
    
    private void configureSessionTimeout(int sessionTimeout) {
        long timeoutMillis = sessionTimeout;
        if (timeoutMillis < 300000) { // Less than 5 minutes
            timeoutMillis = 300000; // Set to 5 minutes minimum
            Logger.getLogger(Webchat.class.getName()).log(Level.INFO, 
                "Session timeout adjusted from {0}ms to {1}ms", new Object[]{sessionTimeout, timeoutMillis});
        }
        getSession().setMaxIdleTimeout(timeoutMillis);
    }
    
    private boolean initializeIrcParser(Session session, WebchatConfig config) {
        try {
            setParser(new IrcParser(config.host, config.port, config.ssl, config.serverPassword, 
                    config.ident, config.user, config.password, config.webircMode, config.webircCgi, config.hmac));
            
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
        p.setLoginChannels(channel);
        setIrcThread(new IrcThread(p, config.nick, getSession()));
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
    public synchronized void onClose(Session session) {
        try {
            if (parser != null) {
                try {
                    parser.logout("Page closed!");
                } catch (Exception e) {
                    Logger.getLogger(Webchat.class.getName()).log(Level.WARNING, "Error during logout", e);
                }
            }
        } finally {
            cleanupResources();
        }
    }

    /**
     * Send an error
     *
     * @param session The session
     * @param throwable The throwable
     */
    @OnError
    public synchronized void onError(Session session, Throwable throwable) {
        Logger.getLogger(Webchat.class.getName()).log(Level.SEVERE, "WebSocket error occurred", throwable);
        try {
            if (parser != null) {
                try {
                    parser.logout("Error: " + (throwable != null ? throwable.getMessage() : "Unknown error"));
                } catch (Exception e) {
                    Logger.getLogger(Webchat.class.getName()).log(Level.WARNING, "Error during error handling logout", e);
                }
            }
        } finally {
            cleanupResources();
        }
    }
    
    /**
     * Cleanup all resources (parser, threads, sockets) - thread-safe
     */
    private synchronized void cleanupResources() {
        try {
            if (parser != null) {
                try {
                    parser.closeConnection();
                } catch (Exception e) {
                    Logger.getLogger(Webchat.class.getName()).log(Level.WARNING, "Error closing parser connection", e);
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
