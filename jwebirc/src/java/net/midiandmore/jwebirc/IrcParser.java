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
     * @return the serverPasssword
     */
    public String getServerPassword() {
        return serverPassword;
    }

    /**
     * @param serverPasssword the serverPasssword to set
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
    private boolean capNegotiating = false;
    private boolean loginComplete = false;
    private String pendingNick;

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
        Socket plainSocket = null;
        Socket connectedSocket = null;
        try {
            if (ssl) {
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
                                // Trust all clients
                            }
                            @Override
                            public void checkServerTrusted(X509Certificate[] certs, String authType) {
                                // Trust all servers (for self-signed certificates)
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
                    connectedSocket = sslSocket;
                    Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "SSL/TLS connection established successfully");
                } catch (Exception e) {
                    Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "SSL Error Details: " + e.getClass().getName() + ": " + e.getMessage(), e);
                    // Clean up partial connection
                    if (plainSocket != null && !plainSocket.isClosed()) {
                        try {
                            plainSocket.close();
                        } catch (IOException ignored) {
                        }
                    }
                    throw new IOException("SSL connection failed: " + e.getMessage(), e);
                }
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
            if (connectedSocket != null && !connectedSocket.isClosed()) {
                try {
                    connectedSocket.close();
                } catch (IOException ignored) {
                }
            }
            throw e;
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

    protected void handshake(String nick) throws IOException {
        // Save nick for later use
        this.pendingNick = nick;
        
        // IRC RFC requires: PASS (optional), then CAP, then NICK, then USER
        
        // 1. Send PASS first if server password is set (but NOT in cgiirc mode)
        if (!getServerPassword().isBlank() && !(getMode() != null && getMode().equalsIgnoreCase("cgiirc"))) {
            submitMessage("PASS :%s", getServerPassword());
            doSleep();
        }
        
        // 2. Always start capability negotiation (for IRCv3 features and optionally SASL)
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Starting CAP negotiation...");
        capNegotiating = true;
        submitMessage("CAP LS 302");
        doSleep();
        // Don't send NICK/USER yet, wait for CAP END
    }
    
    private void completeLogin() throws IOException {
        if (loginComplete) {
            return; // Already logged in
        }
        
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Completing login with NICK/USER...");
        loginComplete = true;
        
        // Send NICK
        submitMessage("NICK %s", pendingNick);
        doSleep();
        
        // 4. Send USER command with appropriate mode
        if (getMode() == null || getMode().isBlank()) {
            // Default mode: simple USER command
            submitMessage("USER %s 0 * :%s", getIdent(), getRealname());
        } else if (getMode().equalsIgnoreCase("webirc")) {
            // WEBIRC mode: send WEBIRC command before USER
            // Validate WEBIRC parameters
            if (getPassword() == null || getPassword().isBlank() ||
                getUser() == null || getUser().isBlank() ||
                getHostname() == null || getHostname().isBlank() ||
                getIp() == null || getIp().isBlank()) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "WEBIRC Error - Missing parameters: Password={0}, User={1}, Hostname={2}, IP={3}", 
                    new Object[]{getPassword(), getUser(), getHostname(), getIp()});
                throw new IOException("WEBIRC requires password, user, hostname and IP");
            }
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "WEBIRC Debug - Password={0}, User={1}, Hostname={2}, IP={3}", 
                new Object[]{getPassword(), getUser(), getHostname(), getIp()});
            submitMessage("WEBIRC %s %s %s %s", getPassword(), getUser(), getHostname(), getIp());
            doSleep();
            submitMessage("USER %s 0 * :%s", getIdent(), getRealname());
        } else if (getMode().equalsIgnoreCase("cgiirc")) {
            // CGI:IRC mode: send special PASS before USER
            submitMessage("PASS %s_%s_%s", getCgi(), getIp(), getHostname());
            doSleep();
            submitMessage("USER %s 0 * :%s", getIdent(), getRealname());
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
    }

    protected void parseCommands(String line, Session session) {
        // Parse only to check for special commands that need backend handling
        IrcMessage msg = parseString(line);
        String command = msg.command;
        
        // Handle 433 (Nickname already in use) - auto-retry with alternative
        if ("433".equals(command)) {
            handleNicknameInUse(msg, session);
            // Forward to client for display
            sendText(line + "\n", session, "chat", "");
            return;
        }
        
        // Handle CAP responses - format: server CAP * LS/ACK ...
        if ("CAP".equals(command)) {
            handleCap(msg.prefix, msg.trailing, session);
            // Forward CAP messages to client so it can track enabled capabilities
            sendText(line + "\n", session, "chat", "");
            return;
        }
        
        // Handle AUTHENTICATE responses - format: :server AUTHENTICATE +
        if ("AUTHENTICATE".equals(command)) {
            handleAuthenticate(msg.prefix, session);
            return;
        }
        
        // Handle numeric 903 (SASL success) and 904/905 (SASL failure)
        if ("903".equals(command) || "904".equals(command) || "905".equals(command)) {
            handleSaslEnd(command, msg.trailing, session);
            // Don't return here - forward SASL messages to client
        }
        
        // Handle CTCP requests - format: :nick!user@host PRIVMSG target :\001COMMAND args\001
        if ("PRIVMSG".equals(command) && msg.trailing.startsWith("\u0001")) {
            // Answer the CTCP request
            handleCtcpRequest(msg.prefix, msg.trailing, session);
            // Forward original line to client for display
            sendText(line + "\n", session, "chat", "");
            return;
        }
        
        // Handle CTCP replies - format: :nick!user@host NOTICE target :\001COMMAND response\001
        if ("NOTICE".equals(command) && msg.trailing.startsWith("\u0001")) {
            // Forward original line to client for display in active window
            sendText(line + "\n", session, "chat", "active");
            return;
        }
        
        // Forward original IRC line unmodified to client
        sendText(line + "\n", session, "chat", "");
    }
    
    private static final String DESIRED_CAPS = "message-tags";

    private void handleCap(String prefix, String trailing, Session session) {
        // CAP * LS :multi-prefix sasl...
        // Format: server CAP * LS
        // Extract the subcommand (LS, ACK, NAK)
        int capPos = prefix.indexOf("CAP");
        if (capPos < 0) return;
        
        int afterCap = capPos + 3; // Position after "CAP"
        String afterCapStr = prefix.substring(afterCap).trim();
        
        // Skip the asterisk if present
        if (afterCapStr.startsWith("*")) {
            afterCapStr = afterCapStr.substring(1).trim();
        }
        
        // Extract subcommand (first token)
        int spacePos = afterCapStr.indexOf(' ');
        String subCommand = spacePos >= 0 ? afterCapStr.substring(0, spacePos) : afterCapStr;
        
        if ("LS".equals(subCommand)) {
            String capsString = trailing.trim();
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "CAP LS received: {0}", capsString);

            // Parse available capabilities into a set for fast lookup
            java.util.Set<String> availableCaps = new java.util.HashSet<>();
            for (String cap : capsString.split("\\s+")) {
                if (!cap.isEmpty()) {
                    // Remove any capability modifiers (=, ~, etc.) for comparison
                    String cleanCap = cap.split("=")[0];
                    availableCaps.add(cleanCap.toLowerCase());
                }
            }
            
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Available capabilities: {0}", availableCaps);
            
            // Build list of capabilities to request
            java.util.List<String> capsToRequest = new java.util.ArrayList<>();
            
            // Add SASL if required and available
            if (isUseSasl()) {
                if (availableCaps.contains("sasl")) {
                    capsToRequest.add("sasl");
                } else {
                    sendText(":Server NOTICE * :SASL not supported by server\n", session, "chat", "");
                    submitMessage("CAP END");
                    capNegotiating = false;
                    try {
                        completeLogin();
                    } catch (IOException e) {
                        Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error completing login after SASL unavailable", e);
                    }
                    return;
                }
            }
            
            // Add only essential capabilities
            if (availableCaps.contains("away-notify")) {
                capsToRequest.add("away-notify");
            }
            if (availableCaps.contains("message-tags")) {
                capsToRequest.add("message-tags");
            }
            if (availableCaps.contains("chghost")) {
                capsToRequest.add("chghost");
            }
            
            // Request capabilities
            if (!capsToRequest.isEmpty()) {
                String capReq = String.join(" ", capsToRequest);
                Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Requesting capabilities: {0}", capReq);
                submitMessage("CAP REQ :%s", capReq);
                doSleep();
            } else {
                // No capabilities to request, end negotiation
                Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "No capabilities to request, ending negotiation");
                submitMessage("CAP END");
                capNegotiating = false;
                try {
                    completeLogin();
                } catch (IOException e) {
                    Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error completing login after CAP END", e);
                }
            }
        }
        // CAP * ACK :sasl ...
        // Format: server CAP * ACK :sasl multi-prefix ...
        else if ("ACK".equals(subCommand)) {
            String ackedCaps = trailing.trim();
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "CAP ACK received: {0}", ackedCaps);
            
            // Forward CAP ACK to client for capability tracking
            sendText(":" + prefix + " :" + trailing + "\n", session, "chat", "");
            
            // Parse ACKed capabilities
            java.util.Set<String> ackedCapSet = new java.util.HashSet<>();
            for (String cap : ackedCaps.split("\\s+")) {
                if (!cap.isEmpty()) {
                    ackedCapSet.add(cap.toLowerCase());
                }
            }
            
            // Check if SASL was ACKed and we need to authenticate
            if (ackedCapSet.contains("sasl") && isUseSasl()) {
                try {
                    Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "SASL capability ACKed, starting authentication...");
                    submitMessage("AUTHENTICATE PLAIN");
                    doSleep();
                    // Don't end CAP negotiation yet, wait for SASL to complete
                } catch (Exception e) {
                    Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error starting AUTHENTICATE", e);
                    submitMessage("AUTHENTICATE *");
                    submitMessage("CAP END");
                    capNegotiating = false;
                    try {
                        completeLogin();
                    } catch (IOException ex) {
                        Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error completing login after SASL error", ex);
                    }
                }
            } else {
                // No SASL or SASL not ACKed, end CAP negotiation immediately
                Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Ending CAP negotiation (no SASL or SASL not needed)");
                submitMessage("CAP END");
                capNegotiating = false;
                try {
                    completeLogin();
                } catch (IOException e) {
                    Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error completing login after CAP END", e);
                }
            }
        }
        // CAP * NAK :sasl ...
        else if ("NAK".equals(subCommand)) {
            String nakedCaps = trailing.trim();
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "CAP NAK received: {0}", nakedCaps);
            
            // Check if SASL was rejected and is required
            if (nakedCaps.toLowerCase().contains("sasl") && isUseSasl()) {
                sendText(":Server NOTICE * :SASL capability rejected by server\n", session, "chat", "");
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "SASL required but rejected by server");
            } else {
                sendText(":Server NOTICE * :Some capabilities rejected: " + nakedCaps + "\n", session, "chat", "");
            }
            
            // End CAP negotiation - continue without rejected capabilities
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Ending CAP negotiation after NAK");
            submitMessage("CAP END");
            capNegotiating = false;
            try {
                completeLogin();
            } catch (IOException e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error completing login after CAP NAK", e);
            }
        }
    }
    
    private void handleNicknameInUse(IrcMessage msg, Session session) {
        // Format: :server 433 * nickname :Nickname is already in use
        // msg.prefix contains: "server 433 * nickname"
        // Extract the nickname from the prefix (last token before the trailing message)
        String[] parts = msg.prefix.split("\\s+");
        String attemptedNick = parts.length > 2 ? parts[2] : pendingNick;
        
        if (attemptedNick == null || attemptedNick.isEmpty()) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "433 received but no nickname to retry");
            return;
        }
        
        // Generate alternative nickname
        String newNick = attemptedNick;
        if (newNick.endsWith("_")) {
            // If already has underscore, try adding a number
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("^(.+?)_*(\\d*)$");
            java.util.regex.Matcher matcher = pattern.matcher(newNick);
            if (matcher.matches()) {
                String base = matcher.group(1);
                String numStr = matcher.group(2);
                int num = numStr.isEmpty() ? 1 : Integer.parseInt(numStr) + 1;
                newNick = base + "_" + num;
            }
        } else {
            // Add underscore
            newNick = attemptedNick + "_";
        }
        
        // Ensure nick doesn't exceed 15 characters
        if (newNick.length() > 15) {
            newNick = newNick.substring(0, 15);
        }
        
        // Update pending nick and retry
        pendingNick = newNick;
        Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, 
            "Nickname {0} already in use, retrying with {1}", new Object[]{attemptedNick, newNick});
        
        try {
            submitMessage("NICK %s", newNick);
            doSleep();
        } catch (Exception e) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error sending alternative NICK", e);
        }
    }
    
    private void handleAuthenticate(String prefix, Session session) {
        // Format: server AUTHENTICATE +
        // Extract the parameter after AUTHENTICATE
        int authPos = prefix.indexOf("AUTHENTICATE");
        if (authPos < 0) return;
        
        String afterAuth = prefix.substring(authPos + 12).trim(); // 12 = length of "AUTHENTICATE"
        
        if ("+".equals(afterAuth)) {
            try {
                Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "AUTHENTICATE + received, sending credentials...");
                // Send SASL PLAIN authentication: base64(username\0username\0password)
                String authString = getSaslUsername() + "\0" + getSaslUsername() + "\0" + getSaslPassword();
                String base64Auth = java.util.Base64.getEncoder().encodeToString(authString.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                submitMessage("AUTHENTICATE %s", base64Auth);
                doSleep();
            } catch (Exception e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error sending SASL credentials", e);
                submitMessage("AUTHENTICATE *");
                submitMessage("CAP END");
                capNegotiating = false;
                try {
                    completeLogin();
                } catch (IOException ex) {
                    Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error completing login after SASL error", ex);
                }
            }
        }
    }
    
    private void handleSaslEnd(String numeric, String trailing, Session session) {
        if (numeric.equals("903")) {
            // SASL authentication successful
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "SASL authentication successful (903)");
            sendText(":Server NOTICE * :SASL authentication successful\n", session, "chat", "");
        } else if (numeric.equals("904") || numeric.equals("905")) {
            // SASL authentication failed
            Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "SASL authentication failed ({0}): {1}", new Object[]{numeric, trailing});
            sendText(":Server NOTICE * :SASL authentication failed: " + trailing + "\n", session, "chat", "");
        }
        
        // End capability negotiation
        if (capNegotiating) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.INFO, "Ending capability negotiation (CAP END)");
            submitMessage("CAP END");
            capNegotiating = false;
            
            // Now send NICK/USER to complete login
            try {
                completeLogin();
            } catch (IOException e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error completing login after SASL", e);
            }
        }
    }
    
    /**
     * Handles CTCP (Client-To-Client Protocol) requests
     * @param prefix The command prefix containing sender and target
     * @param trailing The CTCP command with \001 delimiters
     * @param session The WebSocket session
     */
    private void handleCtcpRequest(String prefix, String trailing, Session session) {
        // Add ending \001 if missing (can happen due to parsing)
        if (!trailing.endsWith("\u0001")) {
            trailing = trailing + "\u0001";
        }
        
        // Remove \001 delimiters
        String ctcpContent = trailing.substring(1, trailing.length() - 1);
        
        // Extract CTCP command and args without splitting
        int spacePos = ctcpContent.indexOf(' ');
        String ctcpCommand;
        String ctcpArgs;
        if (spacePos >= 0) {
            ctcpCommand = ctcpContent.substring(0, spacePos).toUpperCase();
            ctcpArgs = ctcpContent.substring(spacePos + 1);
        } else {
            ctcpCommand = ctcpContent.toUpperCase();
            ctcpArgs = "";
        }
        
        // Extract sender and target from prefix
        // Format: sender PRIVMSG target
        String sender = "";
        String target = "";
        
        // Find sender (everything before first space)
        int firstSpace = prefix.indexOf(' ');
        if (firstSpace >= 0) {
            sender = prefix.substring(0, firstSpace);
            if (sender.startsWith(":")) {
                sender = sender.substring(1);
            }
            
            // Find target (skip "PRIVMSG" and get next token)
            int privmsgPos = prefix.indexOf("PRIVMSG");
            if (privmsgPos >= 0) {
                String afterPrivmsg = prefix.substring(privmsgPos + 7).trim(); // 7 = length of "PRIVMSG"
                int targetSpace = afterPrivmsg.indexOf(' ');
                target = targetSpace >= 0 ? afterPrivmsg.substring(0, targetSpace) : afterPrivmsg;
            }
        }
        
        // Extract sender nick (everything before '!' or the whole sender)
        int exclPos = sender.indexOf('!');
        String senderNick = exclPos >= 0 ? sender.substring(0, exclPos) : sender;
        
        System.out.println("=== CTCP Request Debug ===");
        System.out.println("  Command: " + ctcpCommand);
        System.out.println("  From: " + senderNick + " (full: " + sender + ")");
        System.out.println("  To: " + target);
        System.out.println("  Our nick: " + pendingNick);
        System.out.println("  Args: " + ctcpArgs);
        System.out.println("  Match? " + (pendingNick != null && target.equalsIgnoreCase(pendingNick)));
        
        // Only respond to CTCP requests directed at us (not channel CTCPs)
        if (pendingNick == null || !target.equalsIgnoreCase(pendingNick)) {
            System.out.println("  -> Ignoring (not for us)");
            return;
        }
        
        System.out.println("  -> Processing and sending reply");
        
        try {
            String response = null;
            
            switch (ctcpCommand) {
                case "VERSION":
                    response = "jwebirc 2.0 - Java WebSocket IRC Client";
                    break;
                    
                case "TIME":
                    response = new java.text.SimpleDateFormat("EEE MMM dd HH:mm:ss yyyy", java.util.Locale.ENGLISH)
                            .format(new java.util.Date());
                    break;
                    
                case "PING":
                    // Echo back the ping argument
                    response = ctcpArgs;
                    break;
                    
                case "CLIENTINFO":
                    response = "VERSION TIME PING CLIENTINFO FINGER USERINFO SOURCE ACTION";
                    break;
                    
                case "FINGER":
                    // Provide user information (nickname, idle time, etc.)
                    response = (pendingNick != null ? pendingNick : getUser()) + " - Idle: 0 seconds";
                    break;
                    
                case "USERINFO":
                    // Provide user information (typically same as realname)
                    response = getRealname() != null ? getRealname() : "jwebirc user";
                    break;
                    
                case "SOURCE":
                    // Provide information about where to get the client
                    response = "https://github.com/WarPigs1602/jwebirc";
                    break;
                    
                case "ACTION":
                    // ACTION is handled by the client, don't send automatic reply
                    return;
                    
                default:
                    // Unknown CTCP command - send ERRMSG
                    System.out.println("Unknown CTCP command: " + ctcpCommand);
                    // Send ERRMSG response for unknown commands
                    submitMessage("NOTICE %s :\u0001ERRMSG %s :Unknown CTCP command\u0001", senderNick, ctcpCommand);
                    System.out.println("Sent CTCP ERRMSG reply to " + senderNick);
                    return;
            }
            
            if (response != null) {
                // Send CTCP reply back to sender
                // Format: NOTICE sender :\001COMMAND response\001
                submitMessage("NOTICE %s :\u0001%s %s\u0001", senderNick, ctcpCommand, response);
                System.out.println("Sent CTCP " + ctcpCommand + " reply to " + senderNick);
            }
        } catch (Exception e) {
            System.err.println("Error handling CTCP request: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void doSleep() {
        try {
            Thread.sleep(100);
        } catch (InterruptedException ex) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, null, ex);
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
     */
    public void closeConnection() {
        // Close output stream
        if (out != null) {
            try {
                out.close();
            } catch (Exception e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Error closing output stream", e);
            }
            out = null;
        }
        
        // Close input stream
        if (in != null) {
            try {
                in.close();
            } catch (Exception e) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.WARNING, "Error closing input stream", e);
            }
            in = null;
        }
        
        // Close socket
        if (socket != null && !socket.isClosed()) {
            try {
                socket.close();
            } catch (IOException ex) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error closing socket", ex);
            }
            socket = null;
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
                synchronized (session) {
                    if (session.isOpen()) {
                        session.getBasicRemote().sendText(Json.createObjectBuilder()
                                .add("category", category)
                                .add("target", target)
                                .add("message", escapeHtml(tok))
                                .build().toString());
                    }
                }
            }
        } catch (Exception ioe) {
            Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, "Error sending WebSocket message: " + ioe.getMessage(), ioe);
            try {
                synchronized (session) {
                    if (session.isOpen()) {
                        session.getBasicRemote().sendText(Json.createObjectBuilder()
                                .add("category", category)
                                .add("target", target)
                                .add("message", "Error: %s".formatted(ioe.getMessage()))
                                .build().toString());
                    }
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
