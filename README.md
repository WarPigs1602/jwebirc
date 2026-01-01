# jWebIRC

A modern web-based IRC (Internet Relay Chat) client built with Java EE, WebSockets, and Bootstrap. This application provides a user-friendly interface for connecting to IRC servers directly from your web browser.

## Features

- **WebSocket-based Communication**: Real-time IRC communication using modern WebSocket technology
- **WEBIRC/CGIIRC Support**: Supports WEBIRC and CGIIRC protocols for proper IP forwarding
- **SASL Authentication**: Optional SASL authentication support for secure login
- **CTCP Support**: Full CTCP (Client-To-Client Protocol) support including VERSION, TIME, PING, FINGER, USERINFO, SOURCE, and CLIENTINFO
- **Customizable UI Preferences**: 
  - Adjustable font size (12-18px) per user session
  - Hue rotation filter for color theme customization (0-360 degrees)
  - Hide topic and nicklist options
  - Sidebar navigation mode
  - All preferences persisted in browser localStorage
- **Cookie Consent**: Transparent cookie disclosure on login page
- **Chatnapping**: Embed the webchat on external websites via iframe with configurable domain restrictions
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

Edit the configuration file at `jwebirc/web/META-INF/context.xml`:

```xml
<Context path="/jwebirc" reloadable="false">
    <!-- Session Configuration -->
    <Parameter name="jwebirc.webchatSessionTimeout" value="300000" override="false" />
    <Parameter name="jwebirc.sessionTimeout" value="500" override="false" />
    
    <!-- IRC Server Configuration -->
    <Parameter name="jwebirc.webchatHost" value="localhost" override="false" />
    <Parameter name="jwebirc.webchatPort" value="6669" override="false" />
    <Parameter name="jwebirc.webchatSsl" value="false" override="false" />
    <Parameter name="jwebirc.webchatServerPassword" value="" override="false" />
    <Parameter name="jwebirc.webchatIdent" value="webchat" override="false" />
    <Parameter name="jwebirc.webchatUser" value="jwebirc" override="false" />
    <Parameter name="jwebirc.webchatPassword" value="password" override="false" />
    <Parameter name="jwebirc.webchatRealname" value="https://irc.example.com/" override="false" />
    
    <!-- WEBIRC/CGIIRC Configuration -->
    <Parameter name="jwebirc.webircMode" value="WEBIRC" override="false" />
    <Parameter name="jwebirc.webircCgi" value="CGIIRC" override="false" />
    <Parameter name="jwebirc.hmacTemporal" value="1337" override="false" />
    
    <!-- Authentication Configuration -->
    <Parameter name="jwebirc.saslEnabled" value="true" override="false" />
    
    <!-- Proxy/IP Configuration -->
    <Parameter name="jwebirc.forwardedForHeader" value="X-Forwarded-For" override="false" />
    <Parameter name="jwebirc.forwardedForIps" value="127.0.0.1" override="false" />
    
    <!-- Application Display Configuration -->
    <Parameter name="jwebirc.webchatName" value="jWebIRC" override="false" />
    <Parameter name="jwebirc.webchatTitle" value="jWebIRC - IRC Web Client" override="false" />
    <Parameter name="jwebirc.ircNetworkName" value="jWebIRC" override="false" />
    <Parameter name="jwebirc.ircNetworkDescription" value="Modern web-based IRC client" override="false" />
    <Parameter name="jwebirc.ircNetworkKeywords" value="IRC, WebChat, Chat" override="false" />
    
    <!-- Error Page Configuration -->
    <Parameter name="jwebirc.showStackTrace" value="true" override="false" />
    <Parameter name="jwebirc.errorPageStyle" value="detailed" override="false" />
    
    <!-- CAPTCHA Configuration (see CAPTCHA section below) -->
    <Parameter name="jwebirc.captchaEnabled" value="false" override="false" />
    <Parameter name="jwebirc.captchaType" value="TURNSTILE" override="false" />
    <!-- ... CAPTCHA keys ... -->
    
    <!-- Chatnapping Configuration -->
    <Parameter name="jwebirc.chatnappingEnabled" value="true" override="false" />
    <Parameter name="jwebirc.chatnappingAllowedDomains" value="*" override="false" />
    <Parameter name="jwebirc.chatnappingDefaultNick" value="Guest*" override="false" />
    <Parameter name="jwebirc.chatnappingDefaultChannel" value="#lobby" override="false" />
</Context>
```

For detailed CAPTCHA configuration, see the **[CAPTCHA Protection](#captcha-protection)** section below.

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

### IRC Server Settings
```xml
<!-- IRC Server Hostname -->
<Parameter name="jwebirc.webchatHost" value="irc.example.com" override="false" />

<!-- IRC Server Port (default: 6667 for plain, 6697 for SSL) -->
<Parameter name="jwebirc.webchatPort" value="6667" override="false" />

<!-- Enable SSL/TLS Encryption (true/false) -->
<Parameter name="jwebirc.webchatSsl" value="false" override="false" />

<!-- Server Password (if required by IRC server) -->
<Parameter name="jwebirc.webchatServerPassword" value="" override="false" />

<!-- Optional Server Binding Address -->
<Parameter name="jwebirc.webchatBind" value="127.0.0.1" override="false" />
```

### Session Configuration

```xml
<!-- WebSocket Session Timeout (milliseconds) -->
<Parameter name="jwebirc.webchatSessionTimeout" value="300000" override="false" />

<!-- HTTP Session Timeout (seconds) -->
<Parameter name="jwebirc.sessionTimeout" value="500" override="false" />
```

### WEBIRC/CGIIRC Configuration

For proper IP forwarding to IRC servers:
```xml
<!-- WEBIRC or CGIIRC mode -->
<Parameter name="jwebirc.webircMode" value="WEBIRC" override="false" />

<!-- CGIIRC gateway setting -->
<Parameter name="jwebirc.webircCgi" value="CGIIRC" override="false" />

<!-- HMAC temporal value for WEBIRC -->
<Parameter name="jwebirc.hmacTemporal" value="1337" override="false" />
```

### Authentication Configuration

```xml
<!-- Enable/disable SASL authentication -->
<Parameter name="jwebirc.saslEnabled" value="true" override="false" />

<!-- User credentials (optional) -->
<Parameter name="jwebirc.webchatUser" value="jwebirc" override="false" />
<Parameter name="jwebirc.webchatPassword" value="password" override="false" />
```

### UI Preferences & Display Options

**User Customizable Options (Stored in Browser localStorage):**
- **Font Size**: 12-18 pixels (default: 14px)
- **Hue Rotation**: 0-360 degrees (default: 0°)
- **Hide Topic**: Toggle channel topic visibility
- **Hide Nicklist**: Toggle user list visibility
- **Sidebar Mode**: Alternative navigation layout

These preferences are automatically applied across all pages:
- Login page
- Chat interface
- About page
- Error pages (404, 500, exception)

Users access display options via the **⚙️ Settings** button on the login page and chat interface.

### IP Forwarding Configuration

When running behind a reverse proxy or load balancer:
```xml
<!-- Header name containing forwarded IP -->
<Parameter name="jwebirc.forwardedForHeader" value="X-Forwarded-For" override="false" />

<!-- Comma-separated list of trusted proxy IPs -->
<Parameter name="jwebirc.forwardedForIps" value="127.0.0.1,10.0.0.0/8" override="false" />
```

### Application Display Configuration

```xml
<!-- Application Name -->
<Parameter name="jwebirc.webchatName" value="jWebIRC" override="false" />

<!-- Page Title -->
<Parameter name="jwebirc.webchatTitle" value="jWebIRC - IRC Web Client" override="false" />

<!-- IRC Network Display Name -->
<Parameter name="jwebirc.ircNetworkName" value="jWebIRC" override="false" />

<!-- Network Description (for About page and meta tags) -->
<Parameter name="jwebirc.ircNetworkDescription" value="Modern web-based IRC client" override="false" />

<!-- SEO Keywords -->
<Parameter name="jwebirc.ircNetworkKeywords" value="IRC, WebChat, Chat, Internet Relay Chat" override="false" />
```

### Error Page Configuration

```xml
<!-- Show detailed stack traces on error pages (development) -->
<Parameter name="jwebirc.showStackTrace" value="true" override="false" />

<!-- Error page style: "simple" or "detailed" -->
<Parameter name="jwebirc.errorPageStyle" value="detailed" override="false" />
```

### Chatnapping (Website Embedding)

Enable embedding the webchat on external websites:
```xml
<!-- Enable/disable chatnapping functionality -->
<Parameter name="jwebirc.chatnappingEnabled" value="true" override="false" />

<!-- Allowed domains: "*" for all, or comma-separated list -->
<Parameter name="jwebirc.chatnappingAllowedDomains" value="example.com,test.org" override="false" />

<!-- Default nickname for embedded chat (use * for random digit) -->
<Parameter name="jwebirc.chatnappingDefaultNick" value="Guest*" override="false" />

<!-- Default channel to join -->
<Parameter name="jwebirc.chatnappingDefaultChannel" value="#lobby" override="false" />
```

### Display Options & UI Preferences

Access customization options via the **⚙️ Settings** button:

**On Login Page:**
- Font Size adjustment
- Navigation layout preference
- Theme customization (hue rotation)

**In Chat Interface:**
- Font Size: 12-18 pixels
- Hue: 0-360 degrees color rotation
- Hide Topic: Toggle channel topic display
- Hide Nicklist: Toggle user list display
- Sidebar Mode: Alternative navigation layout

**Settings Persistence:**
- All preferences saved in browser localStorage
- Automatically applied across all pages
- Each browser/device maintains separate preferences

### Chat Features
1. **Connect**: Enter your nickname and optional password (for SASL)
2. **Join Channels**: Use `/join #channelname`
3. **Send Messages**: Type message and press Enter
4. **Private Messages**: Click on a username
5. **Emojis**: Click emoji button to insert emojis
6. **Standard IRC Commands**: `/nick`, `/msg`, `/quit`, `/topic`, etc.
7. **CTCP Queries**: `/ctcp user VERSION`, `/ctcp user PING`, etc.
<iframe src="https://your-irc-server.com/jwebirc/?connect=1&name=Guest&channels=#main" 
        width="800" 
        height="600" 
        frameborder="0">
</iframe>
```

### CAPTCHA Protection

Configure bot protection to prevent unauthorized access. Edit `context.xml` with your CAPTCHA provider credentials.

#### Cloudflare Turnstile (Recommended)

Easiest to set up with flexible bot detection:
```xml
<Parameter name="jwebirc.captchaEnabled" value="true" override="false" />
<Parameter name="jwebirc.captchaType" value="TURNSTILE" override="false" />
<Parameter name="jwebirc.turnstileSiteKey" value="your-site-key-here" override="false" />
<Parameter name="jwebirc.turnstileSecretKey" value="your-secret-key-here" override="false" />
```

**Setup:**
1. Visit [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Create a new site
3. Copy Site Key and Secret Key to `context.xml`

#### Google reCAPTCHA v2 (Checkbox)

Traditional checkbox CAPTCHA:
```xml
<Parameter name="jwebirc.captchaEnabled" value="true" override="false" />
<Parameter name="jwebirc.captchaType" value="RECAPTCHA_V2" override="false" />
<Parameter name="jwebirc.recaptchaV2SiteKey" value="your-site-key-here" override="false" />
<Parameter name="jwebirc.recaptchaV2SecretKey" value="your-secret-key-here" override="false" />
```

**Setup:**
1. Visit [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Register a new site
3. Select **reCAPTCHA v2 → I'm not a robot Checkbox**
4. Copy credentials to `context.xml`

#### Google reCAPTCHA v3 (Invisible, Score-Based)

Invisible verification based on user behavior scoring:
```xml
<Parameter name="jwebirc.captchaEnabled" value="true" override="false" />
<Parameter name="jwebirc.captchaType" value="RECAPTCHA_V3" override="false" />
<Parameter name="jwebirc.recaptchaV3SiteKey" value="your-site-key-here" override="false" />
<Parameter name="jwebirc.recaptchaV3SecretKey" value="your-secret-key-here" override="false" />

<!-- Score threshold: 0.0-1.0 (higher = stricter) -->
<Parameter name="jwebirc.recaptchaV3MinScore" value="0.5" override="false" />
```

**Setup:**
1. Visit [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Register a new site
3. Select **reCAPTCHA v3**
4. Copy credentials to `context.xml`
5. Adjust `recaptchaV3MinScore` based on desired strictness:
   - 0.9+ = Very strict (only obvious humans)
   - 0.5 = Balanced (recommended)
   - 0.0 = Permissive (most requests allowed)

#### Google reCAPTCHA Enterprise

Advanced version for high-traffic applications:
```xml
<Parameter name="jwebirc.recaptchaEnterpriseEnabled" value="true" override="false" />
<Parameter name="jwebirc.recaptchaEnterpriseProjectId" value="your-project-id" override="false" />
<Parameter name="jwebirc.recaptchaEnterpriseSiteKey" value="your-site-key" override="false" />
<Parameter name="jwebirc.recaptchaEnterpriseApiKey" value="your-api-key" override="false" />

<!-- Score threshold: 0.0-1.0 (higher = stricter) -->
<Parameter name="jwebirc.recaptchaEnterpriseMinScore" value="0.5" override="false" />
```

**Setup:**
1. Set up a Google Cloud project with reCAPTCHA Enterprise API enabled
2. Create enterprise keys in reCAPTCHA console
3. Configure as shown above

**Recommended Configuration by Use Case:**
- **Low traffic/Testing**: TURNSTILE or reCAPTCHA v2
- **Standard Deployment**: TURNSTILE (easiest) or reCAPTCHA v3
- **High Traffic/Enterprise**: reCAPTCHA Enterprise

### Security Configuration

```xml
<!-- HTTPS Enforcement (see web.xml) -->
<!-- Set secure cookie flags for production -->
<!-- Configure CORS if serving from different domains -->
```

**For Production:**
- Use HTTPS only
- Set CAPTCHA enabled to prevent abuse
- Specify allowed domains for chatnapping
- Use strong WEBIRC HMAC temporal values
- Disable stack trace display (`showStackTrace = false`)
- Set `errorPageStyle = "simple"`

## Usage

### Display Options & UI Preferences

Access customization options via the **⚙️ Settings** button:

**Available Options:**
- **Font Size**: 12-18 pixels (default: 14px)
- **Hue Rotation**: 0-360 degrees (default: 0°)
- **Hide Topic**: Toggle channel topic visibility
- **Hide Nicklist**: Toggle user list visibility
- **Sidebar Mode**: Alternative navigation layout

**Settings Persistence:**
- All preferences saved in browser localStorage
- Automatically applied across all pages (login, chat, about, error pages)
- Each browser/device maintains separate preferences

### Chat Features
1. **Connect**: Enter your nickname and optional password (for SASL)
2. **Join Channels**: Use `/join #channelname`
3. **Send Messages**: Type message and press Enter
4. **Private Messages**: Click on a username
5. **Emojis**: Click emoji button to insert emojis
6. **Standard IRC Commands**: `/nick`, `/msg`, `/quit`, `/topic`, etc.
7. **CTCP Queries**: `/ctcp user VERSION`, `/ctcp user PING`, etc.

## IRC Commands

Common IRC commands supported:

- `/join #channel` - Join a channel
- `/part #channel` - Leave a channel
- `/nick newnick` - Change your nickname
- `/msg user message` - Send a private message
- `/quit [message]` - Disconnect from the server
- `/topic #channel new topic` - Change channel topic
- `/me action` - Send an action message

### CTCP Commands

CTCP (Client-To-Client Protocol) commands for querying client information:

- `/ctcp user VERSION` - Query client version
- `/ctcp user TIME` - Query user's current time
- `/ctcp user PING` - Measure round-trip time
- `/ctcp user CLIENTINFO` - Query supported commands
- `/ctcp user FINGER` - Query user information
- `/ctcp user USERINFO` - Query additional user info
- `/ctcp user SOURCE` - Query client source

## Troubleshooting

### Connection Issues
- Verify IRC server hostname and port in `context.xml`
- Check firewall rules and port access
- Ensure WebSocket support is enabled in application server

### Authentication Problems
- Verify SASL configuration if using authentication
- Check server password settings
- Review WEBIRC/CGIIRC configuration with IRC server admin

### Configuration Issues
- Check `context.xml` for syntax errors
- Verify all parameter names match expected format
- Ensure CAPTCHA keys are correctly copied
- Review application server logs for detailed error messages

## Building from Source

```bash
# Clean build
ant clean

# Compile
ant compile

# Create WAR file
ant dist
```

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
