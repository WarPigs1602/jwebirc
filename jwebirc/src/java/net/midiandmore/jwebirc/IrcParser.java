/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package net.midiandmore.jwebirc;

import jakarta.json.Json;
import jakarta.websocket.Session;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.StringReader;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.security.cert.X509Certificate;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import static org.apache.commons.codec.digest.HmacAlgorithms.HMAC_SHA_256;
import org.apache.commons.codec.digest.HmacUtils;

/**
 * The irc parser
 *
 * @author Andreas Pschorn
 */
public class IrcParser {

    /**
     * @return the hmacTemporal
     */
    public long getHmacTemporal() {
        return hmacTemporal;
    }

    /**
     * @param hmacTemporal the hmacTemporal to set
     */
    public void setHmacTemporal(long hmacTemporal) {
        this.hmacTemporal = hmacTemporal;
    }

    /**
     * @return the mode
     */
    public String getMode() {
        return mode;
    }

    /**
     * @param mode the mode to set
     */
    public void setMode(String mode) {
        this.mode = mode;
    }

    /**
     * @return the cgi
     */
    public String getCgi() {
        return cgi;
    }

    /**
     * @param cgi the cgi to set
     */
    public void setCgi(String cgi) {
        this.cgi = cgi;
    }

    /**
     * @return the hostname
     */
    public String getHostname() {
        return hostname;
    }

    /**
     * @param hostname the hostname to set
     */
    public void setHostname(String hostname) {
        this.hostname = hostname;
    }

    /**
     * @return the ip
     */
    public String getIp() {
        return ip;
    }

    /**
     * @param ip the ip to set
     */
    public void setIp(String ip) {
        this.ip = ip;
    }

    public int getServerNickLength() {
        return serverNickLength;
    }

    public void setServerNickLength(int serverNickLength) {
        this.serverNickLength = Math.max(1, serverNickLength);
    }

    /**
     * @return the realname
     */
    public String getRealname() {
        return realname;
    }

    /**
     * @param realname the realname to set
     */
    public void setRealname(String realname) {
        this.realname = realname;
    }

    /**
     * @return the out
     */
    public PrintWriter getOut() {
        return out;
    }

    /**
     * @param out the out to set
     */
    public void setOut(PrintWriter out) {
        this.out = out;
    }

    /**
     * @return the in
     */
    public BufferedReader getIn() {
        return in;
    }

    /**
     * @param in the in to set
     */
    public void setIn(BufferedReader in) {
        this.in = in;
    }

    /**
     * @return the host
     */
    public String getHost() {
        return host;
    }

    /**
     * @param host the host to set
     */
    public void setHost(String host) {
        this.host = host;
    }

    /**
     * @return the port
     */
    public int getPort() {
        return port;
    }

    /**
     * @param port the port to set
     */
    public void setPort(int port) {
        this.port = port;
    }

    /**
     * @return the ssl
     */
    public boolean isSsl() {
        return ssl;
    }

    /**
     * @param ssl the ssl to set
     */
    public void setSsl(boolean ssl) {
        this.ssl = ssl;
    }

    /**
     * @return the serverPassword
     */
    public String getServerPassword() {
        return serverPassword;
    }

    /**
     * @param serverPassword the serverPassword to set
     */
    public void setServerPassword(String serverPassword) {
        this.serverPassword = serverPassword;
    }

    /**
     * @return the ident
     */
    public String getIdent() {
        return ident;
    }

    /**
     * @param ident the ident to set
     */
    public void setIdent(String ident) {
        this.ident = ident;
    }

    /**
     * @return the user
     */
    public String getUser() {
        return user;
    }

    /**
     * @param user the user to set
     */
    public void setUser(String user) {
        this.user = user;
    }

    /**
     * @return the password
     */
    public String getPassword() {
        return password;
    }

    /**
     * @param password the password to set
     */
    public void setPassword(String password) {
        this.password = password;
    }

    /**
     * @return the useSasl
     */
    public boolean isUseSasl() {
        return useSasl;
    }

    /**
     * @param useSasl the useSasl to set
     */
    public void setUseSasl(boolean useSasl) {
        this.useSasl = useSasl;
    }

    /**
     * @return the saslUsername
     */
    public String getSaslUsername() {
        return saslUsername;
    }

    /**
     * @param saslUsername the saslUsername to set
     */
    public void setSaslUsername(String saslUsername) {
        this.saslUsername = saslUsername;
    }

    /**
     * @return the saslPassword
     */
    public String getSaslPassword() {
        return saslPassword;
    }

    /**
     * @param saslPassword the saslPassword to set
     */
    public void setSaslPassword(String saslPassword) {
        this.saslPassword = saslPassword;
    }

    /**
     * @return the saslMechanism
     */
    public String getSaslMechanism() {
        return saslMechanism;
    }

    /**
     * @param saslMechanism the saslMechanism to set (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512)
     */
    public void setSaslMechanism(String saslMechanism) {
        this.saslMechanism = saslMechanism != null ? saslMechanism : SASL_MECHANISM_PLAIN;
    }

    private String host;
    private int port;
    private boolean ssl;
    private String serverPassword;
    private String ident;
    private String user;
    private String password;
    private PrintWriter out;
    private BufferedReader in;
    private String loginChannels;
    private String hostname;
    private String ip;
    private String realname;
    private String mode;
    private String cgi;
    private String bind;
    private long hmacTemporal;
    private boolean useSasl = false;
    private String saslUsername;
    private String saslPassword;
    private String saslMechanism = SASL_MECHANISM_PLAIN;  // Values: PLAIN, SCRAM-SHA-256, SCRAM-SHA-512
    
    // SCRAM-SHA authentication state variables
    private int scramPhase = 0;  // 0: init, 1: client-first sent, 2: processing server-first, 3: client-final sent
    private String scramClientNonce;
    private String scramServerNonce;
    private String scramServerFirstMessage;
    private String scramClientFirstMessageBare;
    private byte[] scramSaltedPassword;
    private byte[] scramStoredKey;
    private boolean capNegotiating = false;
    private boolean capEnded = false;
    private boolean loginComplete = false;
    private String pendingNick;
    private int serverNickLength = 15;
    private final java.util.Set<String> requestedCaps = new java.util.HashSet<>();
    private final java.util.List<String> capLsParts = new java.util.ArrayList<>();
    private static final java.util.Set<String> PREFERRED_CAPABILITIES = java.util.Set.of(
            "account-notify",
            "away-notify",
            "batch",
            "cap-notify",
            "chghost",
            "extended-join",
            "invite-notify",
            "labeled-response",
            "message-tags",
            "multi-prefix",
            "server-time",
            "userhost-in-names"
    );
    
    // Constants for repeated strings
    private static final String USER_COMMAND = "USER %s 0 * :%s";
    private static final String CTCP_MARKER = "\u0001";
    private static final String SASL_MECHANISM_PLAIN = "PLAIN";
    private static final String CAP_END = "CAP END";
    private static final String AUTHENTICATE_ABORT = "AUTHENTICATE *";

    protected IrcParser(String host, int port, boolean ssl, String serverPassword, String ident, String user, String password, String mode, String cgi, String hmacTemporal) throws IOException {
        setHmacTemporal(Long.parseLong(hmacTemporal));
        setMode(mode);
        setCgi(cgi);
        setHost(host);
        setPort(port);
        setSsl(ssl);
        setServerPassword(serverPassword);
        setIdent(ident);
        setUser(user);
        setPassword(password);
        
        // Create socket with SSL/TLS support if enabled
        Socket connectedSocket = null;
        try {
            if (ssl) {
                connectedSocket = createSSLSocket(host, port);
            } else {
                // Create regular socket for unencrypted connection
                connectedSocket = new Socket();
                connectedSocket.connect(new InetSocketAddress(InetAddress.getByName(host).getHostAddress(), port), 10000);
            }
            
            setSocket(connectedSocket);
            setOut(new PrintWriter(new OutputStreamWriter(connectedSocket.getOutputStream()), true)); // Auto-flush enabled
            setIn(new BufferedReader(new InputStreamReader(connectedSocket.getInputStream())));
        } catch (IOException e) {
            // Cleanup on error
            closeSocketSafely(connectedSocket);
            throw e;
        }
    }
    
    /**
     * Safely closes a socket, ignoring any exceptions
     * @param socket The socket to close
     */
    private void closeSocketSafely(Socket socket) {
        if (socket != null && !socket.isClosed()) {
            try {
                socket.close();
            } catch (IOException ignored) {
                // Socket cleanup - ignore exceptions
            }
        }
    }
    
    /**
     * Creates an SSL socket with custom trust manager for self-signed certificates
     * @param host The host to connect to
     * @param port The port to connect to
     * @return Connected SSL socket
     * @throws IOException If connection fails
     */
    @SuppressWarnings("java:S4830") // Suppress warning about disabled certificate validation
    private Socket createSSLSocket(String host, int port) throws IOException {
        Socket plainSocket = null;
        try {
            // Create a trust manager that accepts all certificates (for self-signed certs)
            TrustManager[] trustAllCerts = new TrustManager[] {
                new X509TrustManager() {
                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                    @Override
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {
                        // Trust all clients - intentionally disabled for self-signed certs
                    }
                    @Override
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {
                        // Trust all servers - intentionally disabled for self-signed certs
                    }
                }
            };
            
            // Create SSL context with custom trust manager
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
            SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();
            
            // First create a plain socket and connect
            plainSocket = new Socket();
            plainSocket.connect(new InetSocketAddress(host, port), 10000); // 10 second timeout
            
            // Wrap the connected socket with SSL
            SSLSocket sslSocket = (SSLSocket) sslSocketFactory.createSocket(
                plainSocket,
                host,
                port,
                true // autoClose
            );
            
            // Enable all available TLS/SSL protocols for maximum compatibility
            String[] supportedProtocols = sslSocket.getSupportedProtocols();
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Supported protocols: {0}", String.join(", ", supportedProtocols));
            sslSocket.setEnabledProtocols(supportedProtocols);
            
            // Use all available cipher suites
            sslSocket.setUseClientMode(true);
            
            // Start SSL handshake
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Starting SSL handshake with {0}:{1}", new Object[]{host, port});
            sslSocket.startHandshake();
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "SSL/TLS connection established successfully");
            return sslSocket;
        } catch (Exception e) {
            // Exception is logged with full stack trace and context, then rethrown with additional information
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "SSL Error Details: " + e.getClass().getName() + ": " + e.getMessage(), e);
            // Clean up partial connection
            closeSocketSafely(plainSocket);
            throw new IOException("SSL connection failed: " + e.getMessage(), e);
        }
    }

    /**
     * IRC Message holder class to avoid array allocations
     */
    protected static class IrcMessage {
        public final String prefix;      // Everything before " :"
        public final String trailing;    // Everything after " :"
        public final String command;     // The IRC command (extracted from prefix)
        
        public IrcMessage(String prefix, String trailing, String command) {
            this.prefix = prefix;
            this.trailing = trailing;
            this.command = command;
        }
    }
    
    /**
     * Parses IRC message without array splitting
     *
     * @param text The text to parse
     * @return IrcMessage object
     */
    protected IrcMessage parseString(String text) {
        // Remove leading colon if present
        if (text.startsWith(":")) {
            text = text.substring(1);
        }
        
        // Find the separator " :"
        int separatorIndex = text.indexOf(" :");
        String prefix;
        String trailing;
        
        if (separatorIndex >= 0) {
            prefix = text.substring(0, separatorIndex);
            trailing = text.substring(separatorIndex + 2); // Skip " :"
        } else {
            prefix = text;
            trailing = "";
        }
        
        // Extract command from prefix (second token after first space)
        String command = "";
        int firstSpace = prefix.indexOf(' ');
        if (firstSpace >= 0 && firstSpace + 1 < prefix.length()) {
            int secondSpace = prefix.indexOf(' ', firstSpace + 1);
            if (secondSpace >= 0) {
                command = prefix.substring(firstSpace + 1, secondSpace);
            } else {
                command = prefix.substring(firstSpace + 1);
            }
        }
        
        return new IrcMessage(prefix, trailing, command);
    }

    protected void handshake(String nick) {
        // Save nick for later use
        this.pendingNick = nick;
        this.loginComplete = false;
        this.capNegotiating = false;
        this.capEnded = false;
        this.requestedCaps.clear();
        this.capLsParts.clear();
        
        // IRCv3 registration flow: PASS (optional), WEBIRC (if enabled), CAP LS, NICK/USER.
        
        // 1. Send PASS first if server password is set (but NOT in cgiirc mode)
        if (!getServerPassword().isBlank() && !(getMode() != null && getMode().equalsIgnoreCase("cgiirc"))) {
            submitMessage("PASS :%s", getServerPassword());
            doSleep();
        }

        // 2. WEBIRC must be sent before CAP/SASL and before NICK/USER on many IRC servers.
        if (getMode() != null && getMode().equalsIgnoreCase("webirc")) {
            try {
                sendWebircCommand();
                doSleep();
            } catch (IOException e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE,
                        "Error sending WEBIRC before CAP negotiation", e);
                return;
            }
        }
        
        // 3. Start capability negotiation (for IRCv3 features and optionally SASL)
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Starting CAP negotiation...");
        capNegotiating = true;
        submitMessage("CAP LS 302");
        doSleep();

        // 4. Send registration commands now; server finalizes registration after CAP END.
        try {
            completeLogin();
        } catch (IOException e) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error sending registration during CAP negotiation", e);
        }
    }
    
    private void completeLogin() throws IOException {
        if (loginComplete) {
            return; // Already logged in
        }
        
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Completing login with NICK/USER...");

        // Send NICK
        submitMessage("NICK %s", pendingNick);
        doSleep();
        
        // Send USER command with appropriate mode
        if (getMode() == null || getMode().isBlank()) {
            // Default mode: simple USER command
            submitMessage(USER_COMMAND, getIdent(), getRealname());
        } else if (getMode().equalsIgnoreCase("webirc")) {
            submitMessage(USER_COMMAND, getIdent(), getRealname());
        } else if (getMode().equalsIgnoreCase("cgiirc")) {
            // CGI:IRC mode: send special PASS before USER
            submitMessage("PASS %s_%s_%s", getCgi(), getIp(), getHostname());
            doSleep();
            submitMessage(USER_COMMAND, getIdent(), getRealname());
        } else if (getMode().equalsIgnoreCase("hmac")) {
            // HMAC mode: include HMAC token in USER command
            var hmac = new HmacUtils(HMAC_SHA_256, String.valueOf((System.currentTimeMillis() / 1000) / getHmacTemporal())).hmacHex("%s%s".formatted(ident, ip));
            submitMessage("USER %s 0 * :%s %s", getIdent(), getRealname(), hmac);
        } else {
            // Fallback for any other mode: include hostname in realname
            String dispip;
            if (getIp().equalsIgnoreCase(getHostname())) {
                dispip = getIp();
            } else {
                dispip = "%s/%s".formatted(getHostname(), getIp());
            }
            submitMessage("USER %s 0 * :%s - %s", getIdent(), dispip, getRealname());
        }
        doSleep();
        loginComplete = true;
    }

    private void sendWebircCommand() throws IOException {
        if (getPassword() == null || getPassword().isBlank()
                || getUser() == null || getUser().isBlank()
                || getHostname() == null || getHostname().isBlank()
                || getIp() == null || getIp().isBlank()) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE,
                    "WEBIRC Error - Missing parameters: Password={0}, User={1}, Hostname={2}, IP={3}",
                    new Object[]{getPassword(), getUser(), getHostname(), getIp()});
            throw new IOException("WEBIRC requires password, user, hostname and IP");
        }
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO,
                "WEBIRC Debug - Password={0}, User={1}, Hostname={2}, IP={3}",
                new Object[]{getPassword(), getUser(), getHostname(), getIp()});
        submitMessage("WEBIRC %s %s %s %s", getPassword(), getUser(), getHostname(), getIp());
    }

    protected void parseCommands(String line, Session session) {
        // Keep original line with tags for forwarding to client
        String originalLine = line;
        
        // Strip IRCv3 message tags for backend parsing only
        String lineForParsing = line;
        if (lineForParsing != null && lineForParsing.startsWith("@")) {
            int firstSpace = lineForParsing.indexOf(' ');
            if (firstSpace > 0 && firstSpace + 1 < lineForParsing.length()) {
                lineForParsing = lineForParsing.substring(firstSpace + 1);
            }
        }

        // Parse only to check for special commands that need backend handling
        IrcMessage msg = parseString(lineForParsing);
        String command = msg.command;
        
        // Handle nickname rejection numerics with an automatic fallback nick.
        if (isNicknameRetryNumeric(command)) {
            handleNicknameRetry(msg);
            // Forward to client for display
            sendText(originalLine + "\n", session, "chat", "");
            return;
        }

        if ("005".equals(command)) {
            updateServerNickLength(msg);
        }
        
        // Handle CAP responses - format: server CAP * LS/ACK ...
        if ("CAP".equals(command)) {
            handleCap(msg.prefix, msg.trailing, session);
            // Forward CAP messages to client so it can track enabled capabilities
            sendText(originalLine + "\n", session, "chat", "");
            return;
        }
        
        // Handle AUTHENTICATE responses - format: :server AUTHENTICATE +
        if ("AUTHENTICATE".equals(command)) {
            handleAuthenticate(msg.prefix);
            return;
        }
        
        // Handle SASL result numerics
        if ("902".equals(command) || "903".equals(command) || "904".equals(command)
            || "905".equals(command) || "906".equals(command) || "907".equals(command)
            || "908".equals(command)) {
            handleSaslEnd(command);
            // Forward SASL messages to client for display
            sendText(originalLine + "\n", session, "chat", "");
            return;
        }
        
        // Handle CTCP requests - format: :nick!user@host PRIVMSG target :\001COMMAND args\001
        if ("PRIVMSG".equals(command) && msg.trailing.startsWith(CTCP_MARKER)) {
            // Answer the CTCP request
            handleCtcpRequest(msg.prefix, msg.trailing);
            // Forward original line to client for display
            sendText(originalLine + "\n", session, "chat", "");
            return;
        }
        
        // Handle CTCP replies - format: :nick!user@host NOTICE target :\001COMMAND response\001
        if ("NOTICE".equals(command) && msg.trailing.startsWith(CTCP_MARKER)) {
            // Forward original line to client for display in active window
            sendText(originalLine + "\n", session, "chat", "active");
            return;
        }
        
        // Forward original IRC line unmodified to client (with tags intact)
        sendText(originalLine + "\n", session, "chat", "");
    }

    private void handleCap(String prefix, String trailing, Session session) {
        // CAP * LS :multi-prefix sasl...
        // Format: server CAP <target> <subcommand> [:caps]
        // Extract subcommand (LS, ACK, NAK) and capabilities from either
        // trailing or inline parameters (servers may omit ':' for single caps).
        int capPos = prefix.indexOf("CAP");
        if (capPos < 0) return;
        
        int afterCap = capPos + 3; // Position after "CAP"
        String afterCapStr = prefix.substring(afterCap).trim();
        String[] capTokens = afterCapStr.split("\\s+", 3);
        if (capTokens.length < 2) {
            return;
        }

        String subCommand = capTokens[1];
        String inlineParams = capTokens.length >= 3 ? capTokens[2] : "";
        String capParams = (trailing != null && !trailing.isBlank()) ? trailing.trim() : inlineParams.trim();
        
        if ("LS".equals(subCommand)) {
            boolean hasContinuationMarker = "*".equals(inlineParams.trim()) || inlineParams.trim().startsWith("* ");
            handleCapLs(capParams, hasContinuationMarker, session);
        } else if ("ACK".equals(subCommand)) {
            handleCapAck(capParams);
        } else if ("NAK".equals(subCommand)) {
            handleCapNak(capParams, session);
        } else if ("NEW".equals(subCommand)) {
            handleCapNew(capParams);
        } else if ("DEL".equals(subCommand)) {
            handleCapDel(capParams);
        }
    }
    
    private void handleCapLs(String trailing, boolean hasContinuationMarker, Session session) {
        String capsString = trailing == null ? "" : trailing.trim();

        if (!capsString.isEmpty()) {
            capLsParts.add(capsString);
        }

        // Multi-line CAP LS: wait until final line before evaluating capabilities.
        if (hasContinuationMarker) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "CAP LS continuation received, buffering capabilities");
            return;
        }

        String allCapsString = String.join(" ", capLsParts).trim();
        capLsParts.clear();

        if (allCapsString.isEmpty()) {
            endCapNegotiationAndLogin("CAP LS had no capabilities, ending negotiation");
            return;
        }

        String capsStringForLog = allCapsString;
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "CAP LS received: {0}", capsStringForLog);

        // Parse available capabilities into a set for fast lookup
        java.util.Set<String> availableCaps = parseAvailableCapabilities(allCapsString);
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Available capabilities: {0}", availableCaps);
        
        // Build list of capabilities to request
        java.util.List<String> capsToRequest = buildCapabilitiesRequest(availableCaps, session);
        java.util.List<String> newCapsToRequest = filterNotYetRequested(capsToRequest);
        
        // Request capabilities or end negotiation
        if (!newCapsToRequest.isEmpty()) {
            String capReq = String.join(" ", newCapsToRequest);
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Requesting capabilities: {0}", capReq);
            submitMessage("CAP REQ :%s", capReq);
            doSleep();
        } else if (requestedCaps.isEmpty()) {
            endCapNegotiationAndLogin("No capabilities to request, ending negotiation");
        } else {
            Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "Ignoring duplicate CAP LS entries (already requested capabilities)");
        }
    }
    
    private java.util.Set<String> parseAvailableCapabilities(String capsString) {
        java.util.Set<String> availableCaps = new java.util.HashSet<>();
        for (String cap : capsString.split("\\s+")) {
            if (!cap.isEmpty()) {
                // Remove any capability modifiers (=, ~, etc.) for comparison
                String cleanCap = cap.split("=")[0];
                availableCaps.add(cleanCap.toLowerCase());
            }
        }
        return availableCaps;
    }
    
    private java.util.List<String> buildCapabilitiesRequest(java.util.Set<String> availableCaps, Session session) {
        java.util.List<String> capsToRequest = new java.util.ArrayList<>();
        
        // Add SASL if required and available
        if (isUseSasl()) {
            if (availableCaps.contains("sasl")) {
                capsToRequest.add("sasl");
            } else {
                sendText(":Server NOTICE * :SASL not supported by server\n", session, "chat", "");
                // SASL not available – continue without it and still request other capabilities
            }
        }
        
        // Add only essential capabilities
        addEssentialCapabilities(availableCaps, capsToRequest);
        return capsToRequest;
    }

    private java.util.List<String> filterNotYetRequested(java.util.List<String> capsToRequest) {
        java.util.List<String> newCapsToRequest = new java.util.ArrayList<>();
        for (String cap : capsToRequest) {
            String normalized = cap.toLowerCase();
            if (!requestedCaps.contains(normalized)) {
                newCapsToRequest.add(cap);
                requestedCaps.add(normalized);
            }
        }
        return newCapsToRequest;
    }
    
    private void addEssentialCapabilities(java.util.Set<String> availableCaps, java.util.List<String> capsToRequest) {
        for (String preferredCap : PREFERRED_CAPABILITIES) {
            if (availableCaps.contains(preferredCap)) {
                capsToRequest.add(preferredCap);
            }
        }
    }

    private void handleCapNew(String trailing) {
        String newCaps = trailing == null ? "" : trailing.trim();
        if (newCaps.isEmpty()) {
            return;
        }

        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "CAP NEW received: {0}", newCaps);
        java.util.Set<String> availableCaps = parseAvailableCapabilities(newCaps);
        java.util.List<String> capsToRequest = new java.util.ArrayList<>();
        addEssentialCapabilities(availableCaps, capsToRequest);
        java.util.List<String> newCapsToRequest = filterNotYetRequested(capsToRequest);

        if (!newCapsToRequest.isEmpty()) {
            String capReq = String.join(" ", newCapsToRequest);
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Requesting newly announced capabilities: {0}", capReq);
            submitMessage("CAP REQ :%s", capReq);
            doSleep();
        }
    }

    private void handleCapDel(String trailing) {
        String delCaps = trailing == null ? "" : trailing.trim();
        if (delCaps.isEmpty()) {
            return;
        }

        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "CAP DEL received: {0}", delCaps);
        for (String cap : delCaps.split("\\s+")) {
            if (cap.isEmpty()) {
                continue;
            }
            String normalized = cap.toLowerCase().split("=")[0];
            requestedCaps.remove(normalized);
        }
    }
    
    private void handleCapAck(String trailing) {
        String ackedCaps = trailing.trim();
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "CAP ACK received: {0}", ackedCaps);
        
        // Parse ACKed capabilities
        java.util.Set<String> ackedCapSet = new java.util.HashSet<>();
        for (String cap : ackedCaps.split("\\s+")) {
            if (!cap.isEmpty()) {
                String normalized = cap.toLowerCase();
                while (!normalized.isEmpty() && (normalized.startsWith("-") || normalized.startsWith("~"))) {
                    normalized = normalized.substring(1);
                }
                normalized = normalized.split("=")[0];
                if (!normalized.isEmpty()) {
                    ackedCapSet.add(normalized);
                }
            }
        }
        
        // Check if SASL was ACKed and we need to authenticate
        if (ackedCapSet.contains("sasl") && isUseSasl()) {
            startSaslAuthentication();
        } else {
            endCapNegotiationAndLogin("Ending CAP negotiation (no SASL or SASL not needed)");
        }
    }
    
    private void startSaslAuthentication() {
        try {
            String mechanism = getSaslMechanism();
            if (mechanism == null || mechanism.isEmpty()) {
                mechanism = SASL_MECHANISM_PLAIN;
            }
            
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "SASL capability ACKed, starting authentication with mechanism: {0}", mechanism);
            
            submitMessage("AUTHENTICATE %s", mechanism);
            doSleep();
            // Don't end CAP negotiation yet, wait for SASL to complete
        } catch (Exception e) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error starting AUTHENTICATE", e);
            submitMessage(AUTHENTICATE_ABORT);
            endCapNegotiationAndLogin("Error during SASL authentication");
        }
    }
    
    private void handleCapNak(String trailing, Session session) {
        String nakedCaps = trailing.trim();
        Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "CAP NAK received: {0}", nakedCaps);
        
        // Check if SASL was rejected and is required
        if (nakedCaps.toLowerCase().contains("sasl") && isUseSasl()) {
            sendText(":Server NOTICE * :SASL capability rejected by server\n", session, "chat", "");
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "SASL required but rejected by server");
        } else {
            sendText(":Server NOTICE * :Some capabilities rejected: " + nakedCaps + "\n", session, "chat", "");
        }
        
        endCapNegotiationAndLogin("Ending CAP negotiation after NAK");
    }
    
    private void endCapNegotiation(String logMessage) {
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "{0}; ending CAP negotiation", logMessage);
        if (!capNegotiating || capEnded) {
            return;
        }
        submitMessage(CAP_END);
        doSleep();
        capNegotiating = false;
        capEnded = true;
    }

    private void endCapNegotiationAndLogin(String logMessage) {
        endCapNegotiation(logMessage);
    }
    
    private boolean isNicknameRetryNumeric(String command) {
        return "432".equals(command) || "433".equals(command) || "437".equals(command);
    }

    private void handleNicknameRetry(IrcMessage msg) {
        String attemptedNick = extractAttemptedNick(msg);
        
        if (attemptedNick == null || attemptedNick.isEmpty()) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING,
                    "{0} received but no nickname to retry", msg.command);
            return;
        }
        
        String newNick = buildAlternativeNickname(attemptedNick);
        
        // Update pending nick and retry
        pendingNick = newNick;
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, 
            "Nickname rejected via {0}; retrying {1} with {2}",
            new Object[]{msg.command, attemptedNick, newNick});
        
        try {
            submitMessage("NICK %s", newNick);
            doSleep();
        } catch (Exception e) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error sending alternative NICK", e);
        }
    }

    private String extractAttemptedNick(IrcMessage msg) {
        if (pendingNick != null && !pendingNick.isBlank()) {
            return pendingNick;
        }

        if (msg.prefix == null || msg.prefix.isBlank()) {
            return pendingNick;
        }

        String[] parts = msg.prefix.split("\\s+");
        if (parts.length == 0) {
            return pendingNick;
        }

        String lastToken = parts[parts.length - 1];
        if (lastToken == null || lastToken.isBlank() || "*".equals(lastToken)) {
            return pendingNick;
        }
        return lastToken;
    }

    private String buildAlternativeNickname(String attemptedNick) {
        final int maxNickLength = Math.max(1, serverNickLength);
        String base = attemptedNick;
        String suffix = "_" + java.util.concurrent.ThreadLocalRandom.current().nextInt(100, 1000);

        java.util.regex.Matcher numberedNickMatcher = java.util.regex.Pattern
                .compile("^(.*?)(?:_(\\d+)|(_))$")
                .matcher(attemptedNick);

        if (numberedNickMatcher.matches()) {
            base = numberedNickMatcher.group(1);
        }

        int maxBaseLength = Math.max(1, maxNickLength - suffix.length());
        if (base.length() > maxBaseLength) {
            base = base.substring(0, maxBaseLength);
        }

        return base + suffix;
    }

    private void updateServerNickLength(IrcMessage msg) {
        String featureLine = msg.prefix;
        if (msg.trailing != null && !msg.trailing.isBlank()) {
            featureLine += " " + msg.trailing;
        }

        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("(?:^|\\s)NICKLEN=(\\d+)(?:\\s|$)")
                .matcher(featureLine);

        if (matcher.find()) {
            try {
                serverNickLength = Math.max(1, Integer.parseInt(matcher.group(1)));
            } catch (NumberFormatException ex) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.FINE,
                        "Ignoring invalid NICKLEN value: {0}", matcher.group(1));
            }
        }
    }
    
    private void handleAuthenticate(String prefix) {
        // Format: server AUTHENTICATE [+|base64data]
        int authPos = prefix.indexOf("AUTHENTICATE");
        if (authPos < 0) return;
        
    
    String afterAuth = prefix.substring(authPos + 12).trim(); // 12 = length of "AUTHENTICATE"
        
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "AUTHENTICATE received with parameter: [{0}]", afterAuth);
        
        String mechanism = getSaslMechanism();
        if (mechanism == null || mechanism.isEmpty()) {
            mechanism = SASL_MECHANISM_PLAIN;
        }
        
        try {
            if (SASL_MECHANISM_PLAIN.equalsIgnoreCase(mechanism)) {
                handleAuthenticatePlain(afterAuth);
            } else if ("SCRAM-SHA-256".equalsIgnoreCase(mechanism)) {
                handleAuthenticateScramSha(afterAuth, "SHA-256", 32);  // 32 bytes = 256 bits
            } else if ("SCRAM-SHA-512".equalsIgnoreCase(mechanism)) {
                handleAuthenticateScramSha(afterAuth, "SHA-512", 64);  // 64 bytes = 512 bits
            } else {
                Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Unknown SASL mechanism: {0}", mechanism);
                submitMessage(AUTHENTICATE_ABORT);
            }
        } catch (Exception e) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error handling AUTHENTICATE", e);
            submitMessage(AUTHENTICATE_ABORT);
            doSleep();
        }
    }

    private void handleAuthenticatePlain(String afterAuth) {
        if ("+".equals(afterAuth)) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "AUTHENTICATE + received, sending PLAIN credentials...");
            
            if (getSaslUsername() == null || getSaslUsername().isEmpty()) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "SASL username is null or empty!");
                submitMessage(AUTHENTICATE_ABORT);
                return;
            }
            if (getSaslPassword() == null) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "SASL password is null!");
                submitMessage(AUTHENTICATE_ABORT);
                return;
            }
            
            // Send SASL PLAIN authentication: base64(username\0username\0password)
            String authString = getSaslUsername() + "\0" + getSaslUsername() + "\0" + getSaslPassword();
            String base64Auth = java.util.Base64.getEncoder().encodeToString(authString.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            
            Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "Sending AUTHENTICATE with base64 length: {0}", base64Auth.length());
            sendSaslAuthenticateData(base64Auth);
            
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "SASL PLAIN credentials sent, waiting for server response (903/904/905)...");
        } else {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Unexpected AUTHENTICATE parameter for PLAIN: {0}", afterAuth);
        }
    }

    private void handleAuthenticateScramSha(String afterAuth, String hashAlgorithm, int digestLength) throws java.security.NoSuchAlgorithmException, java.security.spec.InvalidKeySpecException {
        if ("+".equals(afterAuth) && scramPhase == 0) {
            // Phase 1: Send ClientFirstMessage
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "AUTHENTICATE + received, sending SCRAM-SHA-256 ClientFirstMessage...");
            
            if (getSaslUsername() == null || getSaslUsername().isEmpty()) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "SASL username is null or empty!");
                submitMessage(AUTHENTICATE_ABORT);
                return;
            }
            
            String clientFirstMessage = generateScramClientFirstMessage();
            sendSaslAuthenticateData(clientFirstMessage);
            scramPhase = 1;
            
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "SCRAM-SHA ClientFirstMessage sent, waiting for ServerFirstMessage...");
        } else if (!"+".equals(afterAuth) && scramPhase == 1) {
            // Phase 2: Process ServerFirstMessage and send ClientFinalMessage
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Received ServerFirstMessage, processing...");
            
            try {
                String serverFirstMessage = new String(java.util.Base64.getDecoder().decode(afterAuth), java.nio.charset.StandardCharsets.UTF_8);
                processScramServerFirstMessage(serverFirstMessage, hashAlgorithm, digestLength);
                
                String clientFinalMessage = generateScramClientFinalMessage();
                sendSaslAuthenticateData(clientFinalMessage);
                scramPhase = 2;
                
                Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "SCRAM-SHA ClientFinalMessage sent, waiting for ServerFinalMessage...");
            } catch (Exception e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error processing ServerFirstMessage", e);
                submitMessage(AUTHENTICATE_ABORT);
                doSleep();
            }
        } else {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Unexpected AUTHENTICATE state: phase={0}, parameter={1}", new Object[]{scramPhase, afterAuth});
        }
    }

    private String generateScramClientFirstMessage() {
        // Generate random client nonce (avoid ',', '=', and control characters)
        scramClientNonce = java.util.UUID.randomUUID().toString().replaceAll("[^a-zA-Z0-9]", "");
        
        // ClientFirstMessage: [GS2-header] ClientFirstMessageBare
        // GS2-header: "n,," (no channel binding, no authzid)
        scramClientFirstMessageBare = "n=" + 
            percentEncode(getSaslUsername()) + 
            ",r=" + scramClientNonce;
        
        String clientFirstMessage = "n,," + scramClientFirstMessageBare;
        
        String base64ClientFirstMessage = java.util.Base64.getEncoder().encodeToString(
            clientFirstMessage.getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
        
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "SCRAM ClientFirstMessage generated: {0}", clientFirstMessage);
        
        return base64ClientFirstMessage;
    }

    private void processScramServerFirstMessage(String serverFirstMessage, String hashAlgorithm, int digestLength) throws java.security.NoSuchAlgorithmException, java.security.spec.InvalidKeySpecException, java.security.InvalidKeyException {
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "ServerFirstMessage: {0}", serverFirstMessage);
        
        scramServerFirstMessage = serverFirstMessage;
        
        // Parse ServerFirstMessage: r=<nonce>,s=<base64-salt>,i=<iteration-count>
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("r=([^,]+),s=([^,]+),i=(\\d+)");
        java.util.regex.Matcher matcher = pattern.matcher(serverFirstMessage);
        
        if (!matcher.find()) {
            throw new IllegalArgumentException("Invalid ServerFirstMessage format");
        }
        
        String serverNonce = matcher.group(1);
        String base64Salt = matcher.group(2);
        int iterationCount = Integer.parseInt(matcher.group(3));
        
        // Verify nonce starts with our client nonce
        if (!serverNonce.startsWith(scramClientNonce)) {
            throw new IllegalArgumentException("Server nonce does not contain client nonce");
        }
        
        scramServerNonce = serverNonce;
        int effectiveIterationCount = Math.max(iterationCount, 4096);  // Security: use at least 4096
        
        // Decode salt
        byte[] salt = java.util.Base64.getDecoder().decode(base64Salt);
        
        // Calculate SaltedPassword using PBKDF2
        scramSaltedPassword = pbkdf2(
            getSaslPassword().getBytes(java.nio.charset.StandardCharsets.UTF_8),
            salt,
            effectiveIterationCount,
            digestLength,
            hashAlgorithm
        );
        
        // Calculate StoredKey = Hash(ClientKey)
        byte[] clientKey = hmac(scramSaltedPassword, "Client Key".getBytes(java.nio.charset.StandardCharsets.UTF_8), hashAlgorithm);
        scramStoredKey = digest(clientKey, hashAlgorithm);
        
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "SCRAM parameters parsed: iterations={0}, nonce={1}", 
            new Object[]{iterationCount, serverNonce});
    }

    private String generateScramClientFinalMessage() throws java.security.NoSuchAlgorithmException, java.security.InvalidKeyException {
        // ClientFinalMessage: ChannelBinding "," Nonce "," ProofData
        String channelBinding = "c=" + java.util.Base64.getEncoder().encodeToString("n,,".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String nonce = "r=" + scramServerNonce;
        
        // AuthMessage = ClientFirstMessageBare "," ServerFirstMessage "," ClientFinalMessageWithoutProof
        String clientFinalMessageWithoutProof = channelBinding + "," + nonce;
        String authMessage = scramClientFirstMessageBare + "," + scramServerFirstMessage + "," + clientFinalMessageWithoutProof;
        
        // Calculate ClientSignature = HMAC(StoredKey, AuthMessage)
        byte[] authMessageBytes = authMessage.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String hashAlgorithm = getSaslMechanism().contains("512") ? "SHA-512" : "SHA-256";
        byte[] clientSignature = hmac(scramStoredKey, authMessageBytes, hashAlgorithm);
        
        // Calculate ClientProof = ClientKey XOR ClientSignature
        // But we need ClientKey, so we recalculate it from password
        byte[] clientKey = hmac(scramSaltedPassword, "Client Key".getBytes(java.nio.charset.StandardCharsets.UTF_8), hashAlgorithm);
        byte[] clientProof = xor(clientKey, clientSignature);
        
        String proof = "p=" + java.util.Base64.getEncoder().encodeToString(clientProof);
        
        String clientFinalMessage = clientFinalMessageWithoutProof + "," + proof;
        
        String base64ClientFinalMessage = java.util.Base64.getEncoder().encodeToString(
            clientFinalMessage.getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
        
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "SCRAM ClientFinalMessage generated");
        
        return base64ClientFinalMessage;
    }

    // Cryptographic helper methods
    private byte[] pbkdf2(byte[] password, byte[] salt, int iterations, int keyLength, String algorithm) throws java.security.NoSuchAlgorithmException, java.security.spec.InvalidKeySpecException {
        javax.crypto.spec.PBEKeySpec spec = new javax.crypto.spec.PBEKeySpec(
            new String(password, java.nio.charset.StandardCharsets.UTF_8).toCharArray(),
            salt,
            iterations,
            keyLength * 8
        );
        javax.crypto.SecretKeyFactory factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmac" + algorithm.replace("-", ""));
        return factory.generateSecret(spec).getEncoded();
    }

    private byte[] hmac(byte[] key, byte[] data, String algorithm) throws java.security.InvalidKeyException, java.security.NoSuchAlgorithmException {
        javax.crypto.Mac mac = javax.crypto.Mac.getInstance("Hmac" + algorithm.replace("-", ""));
        mac.init(new javax.crypto.spec.SecretKeySpec(key, 0, key.length, mac.getAlgorithm()));
        return mac.doFinal(data);
    }

    private byte[] digest(byte[] data, String algorithm) throws java.security.NoSuchAlgorithmException {
        java.security.MessageDigest md = java.security.MessageDigest.getInstance(algorithm);
        return md.digest(data);
    }

    private byte[] xor(byte[] a, byte[] b) {
        byte[] result = new byte[a.length];
        for (int i = 0; i < a.length; i++) {
            result[i] = (byte) (a[i] ^ b[i]);
        }
        return result;
    }

    private String percentEncode(String s) {
        // RFC 5802 percent-encoding of username
        return s.replace("=", "=3D").replace(",", "=2C");
    }

    private void sendSaslAuthenticateData(String base64Auth) {
        final int chunkSize = 400;
        int offset = 0;

        while (offset < base64Auth.length()) {
            int end = Math.min(offset + chunkSize, base64Auth.length());
            submitMessage("AUTHENTICATE %s", base64Auth.substring(offset, end));
            doSleep();
            offset = end;
        }

        // Per IRCv3 SASL: if payload length is an exact multiple of 400,
        // send an empty chunk to terminate the payload.
        if (base64Auth.length() % chunkSize == 0) {
            submitMessage("AUTHENTICATE +");
            doSleep();
        }
    }
    
    private void handleSaslEnd(String numeric) {
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "handleSaslEnd called with numeric {0}, capNegotiating={1}, loginComplete={2}", 
            new Object[]{numeric, capNegotiating, loginComplete});
        
        // SASL response received - don't send duplicate notices, parseCommands already forwards the line
        if (numeric.equals("902")) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "✗ SASL authentication failed (902 - mechanism/message error)");
        } else if (numeric.equals("903")) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "✓ SASL authentication successful (903)");
        } else if (numeric.equals("904")) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "✗ SASL authentication failed (904 - bad auth)");
        } else if (numeric.equals("905")) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "✗ SASL authentication failed (905 - too long)");
        } else if (numeric.equals("906")) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "✗ SASL authentication aborted (906)");
        } else if (numeric.equals("907")) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "SASL: Already authenticated (907)");
        } else if (numeric.equals("908")) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "✗ SASL authentication failed (908 - mechanisms too weak)");
        }
        
        // End capability negotiation after SASL completes (success or failure)
        if (capNegotiating) {
            endCapNegotiationAndLogin("SASL exchange finished");
        } else {
            Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "SASL numeric received outside CAP negotiation, ignoring CAP END");
        }
    }
    
    /**
     * Handles CTCP (Client-To-Client Protocol) requests
     * @param prefix The command prefix containing sender and target
     * @param trailing The CTCP command with \001 delimiters
     * @param session The WebSocket session
     */
    private void handleCtcpRequest(String prefix, String trailing) {
        // Add ending \001 if missing (can happen due to parsing)
        if (!trailing.endsWith(CTCP_MARKER)) {
            trailing = trailing + CTCP_MARKER;
        }
        
        // Remove \001 delimiters
        String ctcpContent = trailing.substring(1, trailing.length() - 1);
        
        // Extract CTCP command and args
        CtcpRequest request = parseCtcpRequest(ctcpContent, prefix);
        
        // Only respond to CTCP requests directed at us
        if (!isCtcpForUs(request)) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "  -> Ignoring CTCP (not for us)");
            return;
        }
        
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "  -> Processing and sending CTCP reply");
        sendCtcpResponse(request);
    }
    
    private static class CtcpRequest {
        String command;
        String args;
        String sender;
        String senderNick;
        String target;
    }
    
    private CtcpRequest parseCtcpRequest(String ctcpContent, String prefix) {
        CtcpRequest request = new CtcpRequest();
        
        // Extract CTCP command and args
        int spacePos = ctcpContent.indexOf(' ');
        if (spacePos >= 0) {
            request.command = ctcpContent.substring(0, spacePos).toUpperCase();
            request.args = ctcpContent.substring(spacePos + 1);
        } else {
            request.command = ctcpContent.toUpperCase();
            request.args = "";
        }
        
        // Extract sender and target from prefix
        extractSenderAndTarget(prefix, request);
        
        // Extract sender nick
        int exclPos = request.sender.indexOf('!');
        request.senderNick = exclPos >= 0 ? request.sender.substring(0, exclPos) : request.sender;
        
        logCtcpRequestDebug(request);
        return request;
    }
    
    private void extractSenderAndTarget(String prefix, CtcpRequest request) {
        int firstSpace = prefix.indexOf(' ');
        if (firstSpace < 0) {
            request.sender = "";
            request.target = "";
            return;
        }
        
        request.sender = prefix.substring(0, firstSpace);
        if (request.sender.startsWith(":")) {
            request.sender = request.sender.substring(1);
        }
        
        // Find target (skip "PRIVMSG" and get next token)
        int privmsgPos = prefix.indexOf("PRIVMSG");
        if (privmsgPos >= 0) {
            String afterPrivmsg = prefix.substring(privmsgPos + 7).trim();
            int targetSpace = afterPrivmsg.indexOf(' ');
            request.target = targetSpace >= 0 ? afterPrivmsg.substring(0, targetSpace) : afterPrivmsg;
        } else {
            request.target = "";
        }
    }
    
    private void logCtcpRequestDebug(CtcpRequest request) {
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "=== CTCP Request Debug ===");
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "  Command: {0}", request.command);
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "  From: {0} (full: {1})", new Object[]{request.senderNick, request.sender});
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "  To: {0}", request.target);
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "  Our nick: {0}", pendingNick);
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "  Args: {0}", request.args);
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "  Match? {0}", (pendingNick != null && request.target.equalsIgnoreCase(pendingNick)));
    }
    
    private boolean isCtcpForUs(CtcpRequest request) {
        return pendingNick != null && request.target.equalsIgnoreCase(pendingNick);
    }
    
    private void sendCtcpResponse(CtcpRequest request) {
        try {
            String response = generateCtcpResponse(request);
            
            if (response != null) {
                submitMessage("NOTICE %s :\u0001%s %s\u0001", request.senderNick, request.command, response);
                Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "Sent CTCP {0} reply to {1}", new Object[]{request.command, request.senderNick});
            }
        } catch (Exception e) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error handling CTCP request", e);
        }
    }
    
    private String generateCtcpResponse(CtcpRequest request) {
        switch (request.command) {
            case "VERSION":
                return "jwebirc 2.0 - Java WebSocket IRC Client";
                
            case "TIME":
                return new java.text.SimpleDateFormat("EEE MMM dd HH:mm:ss yyyy", java.util.Locale.ENGLISH)
                        .format(new java.util.Date());
                
            case "PING":
                return request.args;
                
            case "CLIENTINFO":
                return "VERSION TIME PING CLIENTINFO FINGER USERINFO SOURCE ACTION";
                
            case "FINGER":
                return (pendingNick != null ? pendingNick : getUser()) + " - Idle: 0 seconds";
                
            case "USERINFO":
                return getRealname() != null ? getRealname() : "jwebirc user";
                
            case "SOURCE":
                return "https://github.com/WarPigs1602/jwebirc";
                
            case "ACTION":
                // ACTION is handled by the client, don't send automatic reply
                return null;
                
            default:
                // Unknown CTCP command - send ERRMSG
                Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "Unknown CTCP command: {0}", request.command);
                submitMessage("NOTICE %s :\u0001ERRMSG %s :Unknown CTCP command\u0001", request.senderNick, request.command);
                Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "Sent CTCP ERRMSG reply to {0}", request.senderNick);
                return null;
        }
    }

    private void doSleep() {
        try {
            Thread.sleep(100);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Thread was interrupted during sleep", ex);
        }
    }

    protected void submitMessage(String text, Object... args) {
        text = text.formatted(args);
        var o = getOut();
        if (o == null) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "ERROR: PrintWriter is null, cannot send: {0}", text);
            return;
        }
        o.println(text);
        Logger.getLogger(IrcParser.class.getName()).log(Level.FINE, "IRC >> {0}", text);
    }

    protected String escapeHtml(String text) {
        text = text.replace("&", "&amp;");
        text = text.replace("<", "&lt;");
        text = text.replace(">", "&gt;");
        return text;
    }

    protected void logout(String reason) {
        if (getOut() != null) {
            try {
                submitMessage("QUIT :%s", reason);
                getOut().flush();
            } catch (Exception e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Error sending QUIT message", e);
            }
        }
        closeConnection();
    }
    
    /**
     * Close the IRC connection and cleanup resources
     * This method is synchronized to prevent multiple threads from cleaning up simultaneously
     */
    public synchronized void closeConnection() {
        // Close output stream first (stop sending)
        if (out != null) {
            try {
                out.close();
            } catch (Exception e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Error closing output stream", e);
            } finally {
                out = null;
            }
        }
        
        // Close input stream (stop receiving)
        if (in != null) {
            try {
                in.close();
            } catch (Exception e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Error closing input stream", e);
            } finally {
                in = null;
            }
        }
        
        // Close socket last
        if (socket != null && !socket.isClosed()) {
            try {
                socket.close();
            } catch (IOException ex) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error closing socket", ex);
            } finally {
                socket = null;
            }
        }
    }

    /**
     * Thread-safe method to send text via WebSocket
     * @param text
     * @param session
     * @param category
     * @param target
     */
    protected synchronized void sendText(String text, Session session, String category, String target) {
        if (session == null) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Cannot send message: WebSocket session is null");
            return;
        }
        
        if (!session.isOpen()) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Cannot send message: WebSocket session is closed");
            return;
        }
        
        var br = new BufferedReader(new StringReader(text));

        try {
            String tok = null;
            while ((tok = br.readLine()) != null) {
                if (tok.isEmpty()) {
                    continue;
                }
                if (session.isOpen()) {
                    session.getBasicRemote().sendText(Json.createObjectBuilder()
                            .add("category", category)
                            .add("target", target)
                            .add("message", escapeHtml(tok))
                            .build().toString());
                }
            }
        } catch (Exception ioe) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error sending WebSocket message: " + ioe.getMessage(), ioe);
            try {
                if (session.isOpen()) {
                    session.getBasicRemote().sendText(Json.createObjectBuilder()
                            .add("category", category)
                            .add("target", target)
                            .add("message", "Error: %s".formatted(ioe.getMessage()))
                            .build().toString());
                }
            } catch (IOException io) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Failed to send error message", io);
            }
        }
    }

    /**
     * @return the socket
     */
    public Socket getSocket() {
        return socket;
    }

    /**
     * @param socket the socket to set
     */
    public void setSocket(Socket socket) {
        this.socket = socket;
    }

    private Socket socket;

    /**
     * @return the loginChannels
     */
    public String getLoginChannels() {
        return loginChannels;
    }

    /**
     * @param loginChannels the loginChannels to set
     */
    public void setLoginChannels(String loginChannels) {
        this.loginChannels = loginChannels;
    }

    /**
     * @return the bind
     */
    public String getBind() {
        return bind;
    }

    /**
     * @param bind the bind to set
     */
    public void setBind(String bind) {
        this.bind = bind;
    }
}
