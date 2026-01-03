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
        var sessionTimeout = Integer.parseInt((String) getHttpSession().getAttribute("webchat_session_timout"));
        var host = (String) getHttpSession().getAttribute("webchat_host");
        var port = Integer.parseInt((String) getHttpSession().getAttribute("webchat_port"));
        var ssl = getHttpSession().getAttribute("webchat_ssl").equals("true");
        var serverPassword = (String) getHttpSession().getAttribute("webchat_server_password");
        var ident = (String) getHttpSession().getAttribute("webchat_ident");
        var user = (String) getHttpSession().getAttribute("webchat_user");
        var bind = (String) getHttpSession().getAttribute("webchat_bind");
        var password = (String) getHttpSession().getAttribute("webchat_password");
        var hostname = (String) getHttpSession().getAttribute("hostname");
        var ip = (String) getHttpSession().getAttribute("ip");
        var realname = (String) getHttpSession().getAttribute("webchat_realname");
        var forwardedForHeader = (String) getHttpSession().getAttribute("forwarded_for_header");
        var forwardedForIps = (String) getHttpSession().getAttribute("forwarded_for_ips");
        var webircMode = (String) getHttpSession().getAttribute("webchat_mode");
        var webircCgi = (String) getHttpSession().getAttribute("webchat_cgi");
        var hmac = (String) getHttpSession().getAttribute("hmac_temporal");
        var useSasl = (String) getHttpSession().getAttribute("use_sasl");
        var saslUsername = (String) getHttpSession().getAttribute("sasl_username");
        var saslPassword = (String) getHttpSession().getAttribute("sasl_password");
        if (config.getUserProperties().containsKey(forwardedForHeader.toLowerCase()) && ip.contains(forwardedForIps)) {
            hostname = (String) config.getUserProperties().getOrDefault(forwardedForHeader.toLowerCase(), "127.0.0.1");
            try {
                ip = InetAddress.getByName(hostname).getHostAddress();
            } catch (UnknownHostException ex) {
            }
            try {
                hostname = InetAddress.getByName(ip).getHostName();
            } catch (UnknownHostException ex) {
            }

        }
        // Parse IPv6 addresses first to get canonical form
        if (ip.contains(":")) {
            // Remove zone ID if present (e.g., fe80::1%eth0 -> fe80::1)
            if (ip.contains("%")) {
                ip = ip.substring(0, ip.indexOf("%"));
            }
            ip = parseIpv6(ip);
        }
        if (hostname.contains(":")) {
            // Remove zone ID if present
            if (hostname.contains("%")) {
                hostname = hostname.substring(0, hostname.indexOf("%"));
            }
            hostname = parseIpv6(hostname);
        }
        // Set idle timeout (in milliseconds)
        // If sessionTimeout is too low, increase it to prevent disconnections
        long timeoutMillis = (long) sessionTimeout;
        if (timeoutMillis < 300000) { // Less than 5 minutes
            timeoutMillis = 300000; // Set to 5 minutes minimum
            Logger.getLogger(Webchat.class.getName()).log(Level.INFO, 
                "Session timeout adjusted from " + sessionTimeout + "ms to " + timeoutMillis + "ms");
        }
        getSession().setMaxIdleTimeout(timeoutMillis);
        
        // Create IRC parser with proper error handling
        try {
            setParser(new IrcParser(host, port, ssl, serverPassword, ident, user, password, webircMode, webircCgi, hmac));
            
            // Set SASL parameters if enabled
            if (useSasl != null && useSasl.equals("true") && saslUsername != null && !saslUsername.isBlank()) {
                getParser().setUseSasl(true);
                getParser().setSaslUsername(saslUsername);
                getParser().setSaslPassword(saslPassword != null ? saslPassword : "");
            } else {
                getParser().setUseSasl(false);
            }
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
            return;
        }
        
        String dispip = null;
        var nick = (String) getHttpSession().getAttribute("param-nick");
        var channel = (String) getHttpSession().getAttribute("param-channel");
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
        p.setHostname(hostname);
        p.setIp(ip);
        p.setRealname(realname);
        setIrcThread(new IrcThread(p, nick, getSession()));
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
            System.err.println("Failed to parse IP address: " + ip + " - " + e.getMessage());
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
            var category = json.getString("category");
            var text = json.getString("message");
            var target = json.getString("target");
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
    public synchronized void onClose(Session session) throws IOException {
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
            Enumeration headerNames = request.getHeaderNames();
            while (headerNames.hasMoreElements()) {
                var key = (String) headerNames.nextElement();
                var value = request.getHeader(key);
                sec.getUserProperties().put(key.toLowerCase(), value);
            }
            sec.getUserProperties().put("ip", request.getRemoteAddr()); // lower-case!
            var httpSession = (HttpSession) request.getSession(false);
            sec.getUserProperties().put(HttpSession.class.getName(), httpSession);
        }

        //hacking reflector to expose fields...
        @SuppressWarnings("unchecked")
        private static < I, F> F getField(I instance, Class< F> fieldType) {
            try {
                for (var type = instance.getClass(); type != Object.class; type = type.getSuperclass()) {
                    for (var field : type.getDeclaredFields()) {
                        if (fieldType.isAssignableFrom(field.getType())) {
                            field.setAccessible(true);
                            return (F) field.get(instance);
                        }
                    }
                }
            } catch (IllegalAccessException | IllegalArgumentException | SecurityException e) {
                // Handle?
            }
            return null;
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
