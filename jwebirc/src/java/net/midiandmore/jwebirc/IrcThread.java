/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package net.midiandmore.jwebirc;

import jakarta.websocket.Session;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.lang.System.Logger;
import java.lang.System.Logger.Level;
import java.net.Socket;

/**
 *
 * @author windo
 */
public class IrcThread implements Runnable {

    /**
     * @return the thread
     */
    public Thread getThread() {
        return thread;
    }

    /**
     * @param thread the thread to set
     */
    public void setThread(Thread thread) {
        this.thread = thread;
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

    private Thread thread;
    private Socket socket;
    private PrintWriter pw;
    private BufferedReader br;
    private boolean runs;
    private IrcParser parser;
    private Session session;
    private String nick;

    public IrcThread(IrcParser parser, String nick, Session session) {
        setParser(parser);
        setSession(session);
        setNick(nick);
        (thread = new Thread(this)).start();
    }

    @Override
    public void run() {
        setRuns(true);
        var p = getParser();
        try {
            // Perform DNS resolution
            p.sendText("NOTICE AUTH *** (jwebirc) Looking up your hostname...", getSession(), "chat", "");
            performDnsResolution(p);
            
            String line = null;
            p.handshake(getNick());
            while ((line = getParser().getIn().readLine()) != null) {
                java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.FINE, "IRC << {0}", line);
                p.parseCommands(line, getSession());
            }
        } catch (IOException ex) {
            p.sendText("NOTICE AUTH *** (jwebirc) Connection to IRC server lost: %s".formatted(ex.getMessage()), getSession(), "chat", "");
            java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.SEVERE, "IRC connection error", ex);
        } catch (Exception ex) {
            p.sendText("NOTICE AUTH *** (jwebirc) Unexpected error: %s".formatted(ex.getMessage()), getSession(), "chat", "");
            java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.SEVERE, "Unexpected error in IRC thread", ex);
        } finally {
            // Ensure session is closed properly
            if (getSession() != null && getSession().isOpen()) {
                try {
                    getSession().close();
                } catch (IOException ex) {
                    java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.WARNING, "Error closing session", ex);
                }
            }
            // Ensure parser resources are cleaned up
            if (p != null) {
                try {
                    p.closeConnection();
                } catch (Exception ex) {
                    java.util.logging.Logger.getLogger(IrcThread.class.getName()).log(java.util.logging.Level.WARNING, "Error closing parser connection", ex);
                }
            }
            p.sendText("NOTICE AUTH *** (jwebirc) Connection closed.", getSession(), "chat", "");
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
            
            // Only perform reverse DNS lookup if hostname equals IP
            // (meaning no hostname was provided or detected yet)
            if (ip != null && !ip.isBlank() && ip.equalsIgnoreCase(currentHostname)) {
                try {
                    // Perform reverse DNS lookup
                    java.net.InetAddress addr = java.net.InetAddress.getByName(ip);
                    String resolvedHostname = addr.getCanonicalHostName();
                    
                    // Verify the resolved hostname doesn't just return the IP
                    if (!resolvedHostname.equalsIgnoreCase(ip)) {
                        // Perform forward DNS lookup to verify
                        java.net.InetAddress verifyAddr = java.net.InetAddress.getByName(resolvedHostname);
                        String verifyIp = verifyAddr.getHostAddress();
                        
                        // If forward lookup matches the original IP, accept the hostname
                        if (verifyIp.equalsIgnoreCase(ip) || normalizeIp(verifyIp).equalsIgnoreCase(normalizeIp(ip))) {
                            p.setHostname(resolvedHostname);
                            p.sendText("NOTICE AUTH *** (jwebirc) Found your hostname: " + resolvedHostname, getSession(), "chat", "");
                        } else {
                            p.sendText("NOTICE AUTH *** (jwebirc) No hostname found (verification failed).", getSession(), "chat", "");
                        }
                    } else {
                        p.sendText("NOTICE AUTH *** (jwebirc) No hostname found.", getSession(), "chat", "");
                    }
                } catch (java.net.UnknownHostException ex) {
                    p.sendText("NOTICE AUTH *** (jwebirc) No hostname found.", getSession(), "chat", "");
                }
            } else if (!ip.equalsIgnoreCase(currentHostname)) {
                // Hostname was already resolved/provided
                p.sendText("NOTICE AUTH *** (jwebirc) Found your hostname: " + currentHostname, getSession(), "chat", "");
            } else {
                p.sendText("NOTICE AUTH *** (jwebirc) No hostname found.", getSession(), "chat", "");
            }
        } catch (Exception ex) {
            p.sendText("NOTICE AUTH *** (jwebirc) DNS lookup error: " + ex.getMessage(), getSession(), "chat", "");
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
