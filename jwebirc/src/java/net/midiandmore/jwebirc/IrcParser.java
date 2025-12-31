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
        Socket socket;
        if (ssl) {
            try {
                // Create a trust manager that accepts all certificates (for self-signed certs)
                TrustManager[] trustAllCerts = new TrustManager[] {
                    new X509TrustManager() {
                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return null;
                        }
                        @Override
                        public void checkClientTrusted(X509Certificate[] certs, String authType) {
                        }
                        @Override
                        public void checkServerTrusted(X509Certificate[] certs, String authType) {
                        }
                    }
                };
                
                // Create SSL context with custom trust manager
                SSLContext sslContext = SSLContext.getInstance("TLS");
                sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
                SSLSocketFactory sslSocketFactory = sslContext.getSocketFactory();
                
                // First create a plain socket and connect
                Socket plainSocket = new Socket();
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
                System.out.println("Supported protocols: " + String.join(", ", supportedProtocols));
                sslSocket.setEnabledProtocols(supportedProtocols);
                
                // Use all available cipher suites
                sslSocket.setUseClientMode(true);
                
                // Start SSL handshake
                System.out.println("Starting SSL handshake with " + host + ":" + port);
                sslSocket.startHandshake();
                socket = sslSocket;
                System.out.println("SSL/TLS connection established successfully");
            } catch (Exception e) {
                System.err.println("SSL Error Details: " + e.getClass().getName() + ": " + e.getMessage());
                e.printStackTrace();
                throw new IOException("SSL connection failed: " + e.getMessage(), e);
            }
        } else {
            // Create regular socket for unencrypted connection
            socket = new Socket(InetAddress.getByName(host).getHostAddress(), port);
        }
        
        setSocket(socket);
        setOut(new PrintWriter(new OutputStreamWriter(socket.getOutputStream()), true)); // Auto-flush enabled
        setIn(new BufferedReader(new InputStreamReader(socket.getInputStream())));
    }

    /**
     * Parsses a string to array
     *
     * @param text The text to parse
     * @return Array
     */
    protected String[] parseString(String text) {
        if (text.startsWith(":")) {
            text = text.substring(1);
        }
        if (text.contains(" :")) {
            return text.split(" \\:", 2);
        }
        var arr = new String[2];
        arr[0] = text;
        arr[1] = "";
        return arr;
    }

    protected void handshake(String nick) throws IOException {
        // Save nick for later use
        this.pendingNick = nick;
        
        // IRC RFC requires: PASS (optional), then CAP (if using SASL), then NICK, then USER
        
        // 1. Send PASS first if server password is set (but NOT in cgiirc mode)
        if (!getServerPassword().isBlank() && !(getMode() != null && getMode().equalsIgnoreCase("cgiirc"))) {
            submitMessage("PASS :%s", getServerPassword());
            doSleep();
        }
        
        // 2. If SASL is enabled, start capability negotiation
        if (isUseSasl()) {
            System.out.println("Starting CAP negotiation for SASL...");
            capNegotiating = true;
            submitMessage("CAP LS 302");
            doSleep();
            // Don't send NICK/USER yet, wait for CAP END
            return;
        }
        
        // 3. If no SASL, send NICK/USER immediately
        completeLogin();
    }
    
    private void completeLogin() throws IOException {
        if (loginComplete) {
            return; // Already logged in
        }
        
        System.out.println("Completing login with NICK/USER...");
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
                System.err.println("WEBIRC Error - Missing parameters: Password=" + getPassword() + 
                    ", User=" + getUser() + ", Hostname=" + getHostname() + ", IP=" + getIp());
                throw new IOException("WEBIRC requires password, user, hostname and IP");
            }
            System.out.println("WEBIRC Debug - Password: " + getPassword() + ", User: " + getUser() + 
                ", Hostname: " + getHostname() + ", IP: " + getIp());
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

    protected void parseCommands(String[] arr, Session session) {
        // arr[0] contains everything before " :", arr[1] contains everything after " :"
        // Split arr[0] by spaces to get individual command parts
        String[] parts = arr[0].trim().split("\\s+");
        
        // Handle CAP responses - format: server CAP * LS/ACK ...
        if (parts.length >= 3 && parts[1].equals("CAP")) {
            handleCap(parts, arr[1], session, arr[0]);
            // Forward CAP messages to client for capability negotiation
            if (parts.length >= 4) {
                if (parts[3].equals("LS") || parts[3].equals("ACK") || parts[3].equals("NAK")) {
                    sendText(":" + arr[0] + " " + arr[1] + "\n", session, "chat", "");
                }
            }
            return;
        }
        
        // Handle AUTHENTICATE responses - format: :server AUTHENTICATE +
        // Format: :server AUTHENTICATE + (parts[0]=:server, parts[1]=AUTHENTICATE, parts[2]=+)
        if (parts.length >= 2 && parts[1].equals("AUTHENTICATE")) {
            handleAuthenticate(parts, session);
            return;
        }
        
        // Handle numeric 903 (SASL success) and 904/905 (SASL failure)
        if (parts.length >= 2 && (parts[1].equals("903") || parts[1].equals("904") || parts[1].equals("905"))) {
            handleSaslEnd(parts, arr[1], session);
            return;
        }
        
        sendText(arr[0] + " " + arr[1] + "\n", session, "chat", "");
    }
    
    private static final String DESIRED_CAPS = "message-tags";

    private void handleCap(String[] parts, String trailing, Session session, String originalMessage) {
        // CAP * LS :multi-prefix sasl...
        // Format: :server CAP * LS :caps (parts[0]=:server, parts[1]=CAP, parts[2]=*, parts[3]=LS)
        if (parts.length >= 4 && parts[3].equals("LS")) {
            String caps = trailing;
            System.out.println("CAP LS received: " + caps);

            // If SASL is required but not offered, abort negotiation early
            if (isUseSasl() && !caps.contains("sasl")) {
                sendText(":Server NOTICE * :SASL not supported by server\n", session, "chat", "");
                submitMessage("CAP END");
                capNegotiating = false;
                return;
            }
            
            // Don't request capabilities here - let the client (JavaScript) decide
            // based on what it sees in CAP LS and what it needs.
            // The client will send CAP REQ with all desired capabilities including SASL.
        }
        // CAP * ACK :sasl ...
        // Format: :server CAP * ACK :sasl multi-prefix ...
        else if (parts.length >= 4 && parts[3].equals("ACK")) {
            // Forward CAP ACK to client for capability tracking
            sendText(":" + originalMessage + " " + trailing + "\n", session, "chat", "");
            
            // Only handle SASL if it's part of the ACK
            if (trailing.contains("sasl")) {
                try {
                    System.out.println("CAP ACK received for SASL, starting authentication...");
                    submitMessage("AUTHENTICATE PLAIN");
                    doSleep();
                } catch (Exception e) {
                    System.err.println("Error starting AUTHENTICATE: " + e.getMessage());
                }
            }
        }
    }
    
    private void handleAuthenticate(String[] parts, Session session) {
        // Format: :server AUTHENTICATE + (parts[0]=:server, parts[1]=AUTHENTICATE, parts[2]=+)
        if (parts.length > 2 && parts[2].equals("+")) {
            try {
                System.out.println("AUTHENTICATE + received, sending credentials...");
                // Send SASL PLAIN authentication: base64(username\0username\0password)
                String authString = getSaslUsername() + "\0" + getSaslUsername() + "\0" + getSaslPassword();
                String base64Auth = java.util.Base64.getEncoder().encodeToString(authString.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                submitMessage("AUTHENTICATE %s", base64Auth);
                doSleep();
            } catch (Exception e) {
                System.err.println("Error sending SASL credentials: " + e.getMessage());
                submitMessage("AUTHENTICATE *");
                submitMessage("CAP END");
                capNegotiating = false;
            }
        }
    }
    
    private void handleSaslEnd(String[] parts, String trailing, Session session) {
        String numeric = parts[1];
        if (numeric.equals("903")) {
            // SASL authentication successful
            System.out.println("SASL authentication successful (903)");
            sendText(":Server NOTICE * :SASL authentication successful\n", session, "chat", "");
        } else if (numeric.equals("904") || numeric.equals("905")) {
            // SASL authentication failed
            System.err.println("SASL authentication failed (" + numeric + "): " + trailing);
            sendText(":Server NOTICE * :SASL authentication failed: " + trailing + "\n", session, "chat", "");
        }
        
        // End capability negotiation
        if (capNegotiating) {
            System.out.println("Ending capability negotiation (CAP END)");
            submitMessage("CAP END");
            capNegotiating = false;
            
            // Now send NICK/USER to complete login
            try {
                completeLogin();
            } catch (IOException e) {
                System.err.println("Error completing login after SASL: " + e.getMessage());
            }
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
            System.err.println("ERROR: PrintWriter is null, cannot send: " + text);
            return;
        }
        o.println(text);
        System.out.println(">>> " + text);
    }

    protected String escapeHtml(String text) {
        text = text.replace("&", "&amp;");
        text = text.replace("<", "&lt;");
        text = text.replace(">", "&gt;");
        return text;
    }

    protected void logout(String reason) {
        if (getOut() != null) {
            submitMessage("QUIT :%s", reason);
        }
        if (getSocket() != null) {
            try {
                getSocket().close();
            } catch (IOException ex) {
                Logger.getLogger(IrcParser.class.getName()).log(Level.SEVERE, null, ex);
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
        if (session == null || !session.isOpen()) {
            System.err.println("WARNING: WebSocket session is null or closed");
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
                    session.getBasicRemote().sendText(Json.createObjectBuilder()
                            .add("category", category)
                            .add("target", target)
                            .add("message", escapeHtml(tok))
                            .build().toString());
                }
            }
        } catch (Exception ioe) {
            System.err.println("ERROR sending WebSocket message: " + ioe.getMessage());
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
