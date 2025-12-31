# jWebIRC

A modern web-based IRC (Internet Relay Chat) client built with Java EE, WebSockets, and Bootstrap. This application provides a user-friendly interface for connecting to IRC servers directly from your web browser.

## Features

- **WebSocket-based Communication**: Real-time IRC communication using modern WebSocket technology
- **WEBIRC/CGIIRC Support**: Supports WEBIRC and CGIIRC protocols for proper IP forwarding
- **SASL Authentication**: Optional SASL authentication support for secure login
- **Bot Protection**: Multiple CAPTCHA options to prevent automated abuse
  - Cloudflare Turnstile
  - Google reCAPTCHA v2
  - Google reCAPTCHA v3
  - Google reCAPTCHA Enterprise
- **Emoji Picker**: Built-in emoji support for modern chat experience
- **Responsive Design**: Bootstrap-based responsive UI that works on desktop and mobile devices
- **Session Management**: Automatic session handling with configurable timeouts
- **SSL/TLS Support**: Connect to IRC servers using secure connections
- **Multi-channel Support**: Join and manage multiple IRC channels simultaneously
- **Private Messages**: Support for private messaging between users

## Technology Stack

- **Backend**: Java EE (Jakarta EE)
  - WebSocket API for real-time communication
  - Servlets for HTTP handling
  - JSP for dynamic pages
- **Frontend**: 
  - JavaScript (ES6+)
  - jQuery
  - Bootstrap 5
  - Custom CSS
- **Build Tool**: Apache Ant / Maven
- **Server**: Compatible with Jakarta EE application servers (e.g., GlassFish, Payara, TomEE)

## Prerequisites

- Java Development Kit (JDK) 17 or higher
- Jakarta EE 10 compatible application server
- Apache Ant (for building) or Maven

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/WarPigs1602/jwebirc.git
cd jwebirc
```

### 2. Configure the Application

Edit the configuration file at `jwebirc/web/config.jsp`:

```jsp
String webchatHost = "irc.example.com";           // IRC server hostname
String webchatPort = "6667";                       // IRC server port
String webchatSsl = "false";                       // Use SSL/TLS (true/false)
String webchatServerPassword = "";                 // Server password (if required)
String webchatIdent = "webchat";                   // Ident string
String webchatUser = "jwebirc";                    // Default username
String webchatRealname = "https://your-site.com/"; // Realname field
String webircMode = "WEBIRC";                      // WEBIRC or CGIIRC
String saslEnabled = "true";                       // Enable SASL authentication

// CAPTCHA Configuration
String captchaEnabled = "false";                   // Enable CAPTCHA protection
String captchaType = "TURNSTILE";                  // TURNSTILE, RECAPTCHA_V2, RECAPTCHA_V3, RECAPTCHA_ENTERPRISE
```

For detailed CAPTCHA configuration, see [CAPTCHA_SETUP.md](CAPTCHA_SETUP.md).

### 3. Build the Project

Using Apache Ant:
```bash
cd jwebirc
ant clean
ant dist
```

The WAR file will be generated in the `dist/` directory.

### 4. Deploy

Deploy the generated WAR file to your Jakarta EE application server:

- **GlassFish/Payara**: Copy to `domains/domain1/autodeploy/`
- **TomEE**: Copy to `webapps/`
- Or use the admin console of your application server

### 5. Access the Application

Open your web browser and navigate to:
```
http://localhost:8080/jwebirc/
```

## Configuration Options

### Session Timeout
```jsp
String webchatSessionTimeout = "300000";  // WebSocket session timeout in milliseconds
String sessionTimeout = "500";            // HTTP session timeout in seconds
```

### IP Forwarding
When running behind a reverse proxy:
```jsp
String forwardedForHeader = "X-Forwarded-For";  // Header name for forwarded IP
String forwardedForIps = "127.0.0.1";           // Trusted proxy IPs
```

### CAPTCHA Protection
Configure bot protection in `web/config.jsp`:
```jsp
String captchaEnabled = "true";                    // Enable CAPTCHA
String captchaType = "TURNSTILE";                  // CAPTCHA provider
String turnstileSiteKey = "your-site-key";         // Provider site key
String turnstileSecretKey = "your-secret-key";     // Provider secret key
```

Supported CAPTCHA types:
- **TURNSTILE**: Cloudflare Turnstile (recommended)
- **RECAPTCHA_V2**: Google reCAPTCHA v2 (checkbox)
- **RECAPTCHA_V3**: Google reCAPTCHA v3 (invisible, score-based)
- **RECAPTCHA_ENTERPRISE**: Google reCAPTCHA Enterprise

See [CAPTCHA_SETUP.md](CAPTCHA_SETUP.md) for detailed setup instructions.

### Security
- Configure HTTPS enforcement in `web/WEB-INF/web.xml`
- Set secure cookie flags for production environments
- Review CORS settings if needed

## Project Structure

```
jwebirc/
├── src/java/                    # Java source files
│   └── net/midiandmore/jwebirc/
│       ├── Webchat.java        # WebSocket endpoint
│       ├── IrcParser.java      # IRC protocol parser
│       ├── IrcThread.java      # IRC connection handler
│       └── CaptchaValidator.java # CAPTCHA validation
├── web/                         # Web application files
│   ├── *.jsp                   # JSP pages
│   ├── file/                   # Static resources
│   │   ├── chat.js            # Main chat logic
│   │   ├── irc.js             # IRC protocol handling
│   │   ├── emoji-picker.js    # Emoji functionality
│   │   └── style.css          # Custom styles
│   ├── META-INF/
│   │   └── context.xml        # Context configuration
│   └── WEB-INF/
│       ├── web.xml            # Web application descriptor
│       └── pom.xml            # Maven dependencies
├── build.xml                   # Ant build script
└── CAPTCHA_SETUP.md           # CAPTCHA configuration guide
```

## Usage

1. **Connect**: Enter your nickname and optionally a password (for SASL authentication)
2. **Join Channels**: Use `/join #channelname` to join IRC channels
3. **Send Messages**: Type your message and press Enter
4. **Private Messages**: Click on a username to start a private conversation
5. **Emojis**: Click the emoji button to insert emojis into your messages
6. **Commands**: Standard IRC commands are supported (e.g., `/nick`, `/msg`, `/quit`)

## IRC Commands

Common IRC commands supported:

- `/join #channel` - Join a channel
- `/part #channel` - Leave a channel
- `/nick newnick` - Change your nickname
- `/msg user message` - Send a private message
- `/quit [message]` - Disconnect from the server
- `/topic #channel new topic` - Change channel topic
- `/me action` - Send an action message

## Development

### Building from Source

```bash
# Clean build
ant clean

# Compile
ant compile

# Create WAR file
ant dist

# Run tests (if available)
ant test
```

### Adding Dependencies

Edit `web/WEB-INF/pom.xml` to add Maven dependencies, then copy required JARs to `web/WEB-INF/lib/`.

## Troubleshooting

### Connection Issues
- Verify IRC server hostname and port in `config.jsp`
- Check firewall rules
- Ensure WebSocket support is enabled in your application server

### Authentication Problems
- Verify SASL configuration if using authentication
- Check server password settings
- Review WEBIRC/CGIIRC configuration with your IRC server admin

### WebSocket Errors
- Ensure your browser supports WebSockets
- Check application server WebSocket configuration
- Review server logs for detailed error messages

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Andreas Pschorn**

## Acknowledgments

- Bootstrap team for the UI framework
- The IRC community for protocol specifications
- Jakarta EE community for excellent documentation

## Support

For issues, questions, or contributions, please open an issue on GitHub or contact the maintainer.

---

**Note**: This is a web-based IRC client intended for use with your own IRC network or with permission from the IRC network operators. Please ensure you comply with the terms of service of any IRC network you connect to.
