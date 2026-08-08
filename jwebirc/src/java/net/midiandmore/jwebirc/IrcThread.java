/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package net.midiandmore.jwebirc;

import jakarta.enterprise.concurrent.ManagedExecutorService;
import jakarta.websocket.Session;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.lang.System.Logger;
import java.lang.System.Logger.Level;
import java.net.Socket;
import java.util.concurrent.Future;

/**
 *
 * @author windo
 */
public class IrcThread implements Runnable {

    /**
     * @return the task
     */
    public Future<?> getTask() {
        return task;
    }

    /**
     * @param task the task to set
     */
    public void setTask(Future<?> task) {
        this.task = task;
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

    /**
     * @return the pw
     */
    public PrintWriter getPw() {
        return pw;
    }

    /**
     * @param pw the pw to set
     */
    public void setPw(PrintWriter pw) {
        this.pw = pw;
    }

    /**
     * @return the br
     */
    public BufferedReader getBr() {
        return br;
    }

    /**
     * @param br the br to set
     */
    public void setBr(BufferedReader br) {
        this.br = br;
    }

    /**
     * @return the runs
     */
    public boolean isRuns() {
        return runs;
    }

    /**
     * @param runs the runs to set
     */
    public void setRuns(boolean runs) {
        this.runs = runs;
    }

    private static final String HOSTNAME_NOT_FOUND = "NOTICE AUTH *** (jwebirc) No hostname found.";
    
    private Future<?> task;
    private Socket socket;
    private PrintWriter pw;
    private BufferedReader br;
    private boolean runs;
    private IrcParser parser;
    private Session session;
    private String nick;
    
    public IrcThread(IrcParser parser, String nick, Session session, ManagedExecutorService executor) {
        setParser(parser);
        setSession(session);
        setNick(nick);
        task = executor.submit(this);
    }

    @Override
    public void run() {
        setRuns(true);
        var p = getParser();
        try {
            executeIrcMainLoop(p);
        } catch (IOException ex) {
            handleIoException(p, ex);
        } catch (Exception ex) {
            handleUnexpectedException(p, ex);
        } finally {
            cleanupResources(p);
        }
    }
    
    private void executeIrcMainLoop(IrcParser p) throws IOException {
        // Perform DNS resolution
        p.sendText("NOTICE AUTH *** (jwebirc) Looking up your hostname...", getSession(), "chat", "");
        performDnsResolution(p);
        
        String line;
        p.handshake(getNick());
        while ((line = getParser().getIn().readLine()) != null) {
            java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.FINE, "IRC << {0}", line);
            p.parseCommands(line, getSession());
        }
    }
    
    private void handleIoException(IrcParser p, IOException ex) {
        java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.SEVERE, "IRC connection error: " + ex.getClass().getName(), ex);
        sendErrorToClient(p, "Connection to IRC server lost: %s".formatted(ex.getMessage()));
    }
    
    private void handleUnexpectedException(IrcParser p, Exception ex) {
        java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.SEVERE, "Unexpected error in IRC thread", ex);
        String errorMsg = ex.getMessage() != null ? ex.getMessage() : "Unknown error";
        sendErrorToClient(p, "Unexpected error: %s".formatted(errorMsg));
    }
    
    private void sendErrorToClient(IrcParser p, String message) {
        try {
            if (getSession() != null && getSession().isOpen()) {
                p.sendText("NOTICE AUTH *** (jwebirc) " + message, getSession(), "chat", "");
            }
        } catch (Exception sendEx) {
            java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.WARNING, "Failed to send error message to client", sendEx);
        }
    }
    
    private void cleanupResources(IrcParser p) {
        // Ensure parser resources are cleaned up BEFORE closing session
        closeParserConnection(p);
        
        // Ensure session is closed properly
        closeSession();
        
        // Send final message only if session is still open
        sendFinalMessage(p);
    }
    
    private void closeParserConnection(IrcParser p) {
        if (p != null) {
            try {
                p.closeConnection();
            } catch (Exception ex) {
                java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.WARNING, "Error closing parser connection", ex);
            }
        }
    }
    
    private void closeSession() {
        if (getSession() != null && getSession().isOpen()) {
            try {
                getSession().close();
            } catch (IOException ex) {
                java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.WARNING, "Error closing session", ex);
            }
        }
    }
    
    private void sendFinalMessage(IrcParser p) {
        if (getSession() != null && getSession().isOpen() && p != null) {
            try {
                p.sendText("NOTICE AUTH *** (jwebirc) Connection closed.", getSession(), "chat", "");
            } catch (Exception ex) {
                java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.WARNING, "Error sending final message", ex);
            }
        }
    }
    
    /**
     * Performs DNS resolution for the client's IP address
     * @param p The IrcParser instance
     */
    private void performDnsResolution(IrcParser p) {
        try {
            String ip = p.getIp();
            String currentHostname = p.getHostname();
            
            if (ip == null || ip.isBlank()) {
                p.sendText(HOSTNAME_NOT_FOUND, getSession(), "chat", "");
            } else if (currentHostname == null || currentHostname.isBlank()) {
                p.sendText(HOSTNAME_NOT_FOUND, getSession(), "chat", "");
            } else if (ip.equalsIgnoreCase(currentHostname)) {
                performReverseDnsLookup(p, ip);
            } else {
                // Hostname was already resolved/provided
                p.sendText("NOTICE AUTH *** (jwebirc) Found your hostname: " + currentHostname, getSession(), "chat", "");
            }
        } catch (Exception ex) {
            p.sendText("NOTICE AUTH *** (jwebirc) DNS lookup error: " + ex.getMessage(), getSession(), "chat", "");
        }
    }
    
    /**
     * Performs reverse DNS lookup for the given IP
     * @param p The IrcParser instance
     * @param ip The IP address to look up
     */
    private void performReverseDnsLookup(IrcParser p, String ip) {
        try {
            // Perform reverse DNS lookup
            java.net.InetAddress addr = java.net.InetAddress.getByName(ip);
            String resolvedHostname = addr.getCanonicalHostName();
            
            // Verify the resolved hostname doesn't just return the IP
            if (!resolvedHostname.equalsIgnoreCase(ip)) {
                verifyAndSetHostname(p, ip, resolvedHostname);
            } else {
                p.sendText(HOSTNAME_NOT_FOUND, getSession(), "chat", "");
            }
        } catch (java.net.UnknownHostException ex) {
            p.sendText(HOSTNAME_NOT_FOUND, getSession(), "chat", "");
        }
    }
    
    /**
     * Verifies hostname through forward DNS lookup and sets it if valid
     * @param p The IrcParser instance
     * @param originalIp The original IP address
     * @param resolvedHostname The hostname resolved from reverse DNS
     */
    private void verifyAndSetHostname(IrcParser p, String originalIp, String resolvedHostname) {
        try {
            // Perform forward DNS lookup to verify
            java.net.InetAddress verifyAddr = java.net.InetAddress.getByName(resolvedHostname);
            String verifyIp = verifyAddr.getHostAddress();
            
            // If forward lookup matches the original IP, accept the hostname
            if (verifyIp.equalsIgnoreCase(originalIp) || normalizeIp(verifyIp).equalsIgnoreCase(normalizeIp(originalIp))) {
                p.setHostname(resolvedHostname);
                p.sendText("NOTICE AUTH *** (jwebirc) Found your hostname: " + resolvedHostname, getSession(), "chat", "");
            } else {
                p.sendText("NOTICE AUTH *** (jwebirc) No hostname found (verification failed).", getSession(), "chat", "");
            }
        } catch (java.net.UnknownHostException ex) {
            p.sendText("NOTICE AUTH *** (jwebirc) No hostname found (verification failed).", getSession(), "chat", "");
        }
    }
    
    /**
     * Normalizes IP addresses for comparison (handles IPv6 variations)
     * @param ip The IP address to normalize
     * @return Normalized IP address
     */
    private String normalizeIp(String ip) {
        try {
            java.net.InetAddress addr = java.net.InetAddress.getByName(ip);
            if (addr instanceof java.net.Inet6Address) {
                // For IPv6, return canonical form
                return addr.getHostAddress().toLowerCase().replaceAll("%(\\w+)$", "");
            }
            return addr.getHostAddress();
        } catch (java.net.UnknownHostException ex) {
            return ip;
        }
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
     * @return the session
     */
    public Session getSession() {
        return session;
    }

    /**
     * @param session the session to set
     */
    public void setSession(Session session) {
        this.session = session;
    }

    /**
     * @return the nick
     */
    public String getNick() {
        return nick;
    }

    /**
     * @param nick the nick to set
     */
    public void setNick(String nick) {
        this.nick = nick;
    }

}
