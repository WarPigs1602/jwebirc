# jWebIRC

A modern web-based IRC (Internet Relay Chat) client built with Jakarta EE, WebSockets, and Bootstrap. This application provides a user-friendly interface for connecting to IRC servers directly from your web browser.

## Example Web-based IRC

See a live example at https://chat.midiandmore.net/?channels=dev.

## Quick Navigation

- [Features](#features)
- [Recent Changes & Bug Fixes](#recent-changes--bug-fixes)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Jakarta EE Integration & Correct Version](#jakarta-ee-integration--correct-version)
- [Installation](#installation)
- [Configuration (Server-Side)](#configuration-server-side)
- [Asset Minification](#asset-minification)
- [Usage (Client-Side)](#usage-client-side)
- [Nick Prefixes & Emoji Mapping](#nick-prefixes--emoji-mapping)
- [Plugin System](#plugin-system)
- [IRCv3 Feature Support](#ircv3-feature-support)
- [IRC Command Reference](#irc-command-reference)
- [Troubleshooting](#troubleshooting)
- [Building from Source](#building-from-source)

## Quick Start (3 Commands)

```bash
cd jwebirc
mvn -f web/WEB-INF/pom.xml clean package
# deploy target/jwebirc.war to your Jakarta EE server
```

Then open: `http://localhost:8080/jwebirc/`

## Quick Start (Ant)

Requires local dependency JARs in `jwebirc/lib/` (see [Configuration (Server-Side)](#configuration-server-side)).

```bash
cd jwebirc
ant clean
ant dist
# deploy dist/jwebirc.war to your Jakarta EE server
```

## Features

- **WebSocket-based Communication**: Real-time IRC communication using modern WebSocket technology
- **WEBIRC/CGIIRC Support**: Supports WEBIRC (RFC 7194) and CGIIRC protocols for proper IP forwarding with optional `:secure` flag for encrypted connections
- **SASL Authentication**: Optional SASL authentication support for secure login
- **IRCv3 Support**: Supports IRCv3 capability negotiation (CAP 302), SASL, message tags, and modern server capabilities such as account-notify, away-notify, batch, cap-notify, chghost, extended-join, invite-notify, labeled-response, multi-prefix, server-time, and userhost-in-names when offered by the server
- **CTCP Support**: Full CTCP (Client-To-Client Protocol) support including VERSION, TIME, PING, FINGER, USERINFO, SOURCE, and CLIENTINFO
- **Customizable UI Preferences**: 
  - Adjustable font size (12-18px) per user session
  - Hue rotation filter for color theme customization (0-360 degrees)
  - Hide topic and nicklist options
  - Sidebar navigation mode
  - All preferences persisted in browser localStorage
- **Cookie Consent**: Transparent cookie disclosure on login page
- **Independent Plugin System**: Load optional frontend extensions independently from themes and core UI logic
- **Chatnapping**: Embed the webchat on external websites via iframe with configurable domain restrictions
- **Bot Protection**: Multiple CAPTCHA options to prevent automated abuse
  - Cloudflare Turnstile
  - Google reCAPTCHA v2
  - Google reCAPTCHA v3
  - Google reCAPTCHA Enterprise
- **Emoji Picker**: Built-in emoji support for modern chat experience
- **Nick Status Emojis**: Nicklist shows role emojis (owner/admin/op/halfop/voice) based on IRC prefix modes
- **Responsive Design**: Bootstrap-based responsive UI that works on desktop and mobile devices
- **Session Management**: Automatic session handling with configurable timeouts
- **SSL/TLS Support**: Connect to IRC servers using secure connections with full certificate validation
- **Multi-channel Support**: Join and manage multiple IRC channels simultaneously
- **Private Messages**: Support for private messaging between users

## Recent Changes & Bug Fixes

### SSL/TLS Connection Robustness (May 2026)
- **Fixed**: SSL flag parsing in Webchat.java now uses case-insensitive comparison with null-safety
  - Old behavior: Strict `equals("true")` could cause silent fallback to plaintext
  - New behavior: Accepts `"true"`, `"1"`, `"yes"` (case-insensitive), safely handles null and whitespace
  - Impact: TLS connections now reliably establish without unexpected fallback
  - Affected servers: UnrealIRCD, InspIRCd, and other servers requiring encrypted gateway connections

### RFC 7194 WEBIRC :secure Flag Support (May 2026)
- **Added**: Optional `:secure` flag in WEBIRC protocol command to signal encrypted connections
  - Configuration: `jwebirc.webircIncludeSecure` (default: `true`)
  - Behavior: Appends `:secure` to WEBIRC command when TLS is active
  - Protocol example: `WEBIRC password user hostname ip :secure`
  - Server support: Recognized by modern IRC daemons (UnrealIRCD, InspIRCd, etc.)
  - Benefit: Proper encryption status reporting in server logs and user visibility

## Technology Stack

- **Backend**: Jakarta EE
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

- Java Development Kit (JDK) 21 or higher
- Jakarta EE 11 compatible application server
- Apache Ant (for building from source) or Maven 3.9+

## Jakarta EE Integration & Correct Version

This project integrates Jakarta EE via Maven in `jwebirc/web/WEB-INF/pom.xml`:

```xml
<dependency>
  <groupId>jakarta.platform</groupId>
  <artifactId>jakarta.jakartaee-web-api</artifactId>
  <version>${jakarta.ee.version}</version>
  <scope>provided</scope>
</dependency>
```

Important notes:

- `scope` is `provided` because Jakarta EE APIs are supplied by the application server (do not package them into the WAR).
- The project is currently configured with `jakarta.ee.version=11.0.0`, which matches Java 21.
- For runtime, use a Jakarta EE 11 (Web Profile) compatible server.
- The Maven build uses the shared Java sources from `jwebirc/src/java` and the web root from `jwebirc/web`, even though the POM itself lives in `jwebirc/web/WEB-INF`.
- The generated Maven artifact is written to `jwebirc/target/jwebirc.war` and includes JSPs, static files, compiled classes, and resolved runtime libraries.
- If you need to deploy specifically to Jakarta EE 10, change `jakarta.ee.version` (and, if needed, server/IDE configuration) consistently to 10.x and re-test.

## Installation

### Option A: Use Precompiled WAR (Quick Start)

Download the precompiled package:

- https://github.com/WarPigs1602/jwebirc/releases/download/260529/jwebirc.war

Deploy `jwebirc.war` to your Jakarta EE application server:

- **GlassFish/Payara**: Copy to `domains/domain1/autodeploy/`
- **TomEE**: Copy to `webapps/`
- Or use the admin console of your application server

#### Configuration for Precompiled WAR

You have two ways to configure parameters such as IRC host, port, SASL, CAPTCHA, and chatnapping:

1. **Recommended (server-managed config):**
  - Create or edit your server's context configuration for `/jwebirc`
  - Add the same `<Parameter ... />` values shown in this README
  - This keeps your settings outside the WAR and survives WAR replacement

   In practice, this means the WAR stays unchanged and all environment-specific values live in the application server configuration. That is usually the better deployment model because you can replace or upgrade `jwebirc.war` without re-editing files inside the archive.

   Typical use cases for server-managed config:

   - different IRC hostnames or ports between development, staging, and production
   - secret values such as CAPTCHA keys that should not be baked into the WAR
   - reverse-proxy settings that depend on the target server environment
   - safer upgrades, because replacing the WAR does not overwrite your local settings

   Example locations for server-managed context files:

   - **Tomcat**: `conf/Catalina/localhost/jwebirc.xml`
   - **Payara/GlassFish**: define the same context/application parameters through the server configuration or admin console for the deployed `jwebirc` application

   Example Tomcat context file (`conf/Catalina/localhost/jwebirc.xml`):

   ```xml
   <Context path="/jwebirc" reloadable="false">
       <Parameter name="jwebirc.webchatReconnectGraceMs" value="30000" override="false" />
       <Parameter name="jwebirc.webchatHost" value="irc.example.com" override="false" />
       <Parameter name="jwebirc.webchatPort" value="6697" override="false" />
       <Parameter name="jwebirc.webchatSsl" value="true" override="false" />
       <Parameter name="jwebirc.webircIncludeSecure" value="true" override="false" />
       <Parameter name="jwebirc.webchatName" value="ExampleNet WebChat" override="false" />
       <Parameter name="jwebirc.ircNetworkName" value="ExampleNet" override="false" />
       <Parameter name="jwebirc.forwardedForHeader" value="X-Forwarded-For" override="false" />
       <Parameter name="jwebirc.forwardedForIps" value="127.0.0.1,10.0.0.0/8" override="false" />
       <Parameter name="jwebirc.saslEnabled" value="true" override="false" />
       <Parameter name="jwebirc.saslMechanism" value="SCRAM-SHA-256" override="false" />
       <Parameter name="jwebirc.captchaEnabled" value="true" override="false" />
       <Parameter name="jwebirc.captchaType" value="TURNSTILE" override="false" />
       <Parameter name="jwebirc.turnstileSiteKey" value="your-site-key" override="false" />
       <Parameter name="jwebirc.turnstileSecretKey" value="your-secret-key" override="false" />
   </Context>
   ```

   Workflow example:

   1. Deploy `jwebirc.war` unchanged.
   2. Create `jwebirc.xml` in the server configuration.
   3. Put your local `<Parameter ... />` values into that file.
   4. Restart or redeploy the application so the server reloads the context.

   If both the server-managed context and the WAR contain the same parameter name, the effective value depends on the application server and deployment model. For predictable behavior, keep production values in one place only and prefer the server-managed file.

2. **Alternative (edit WAR directly):**
  - Unpack `jwebirc.war`
  - Edit `META-INF/context.xml`
  - Repack and deploy the WAR again

After deployment and configuration, open:

```
http://localhost:8080/jwebirc/
```

### Option B: Build from Source

#### 1. Clone the Repository

```bash
git clone https://github.com/WarPigs1602/jwebirc.git
cd jwebirc
```

#### 2. Configure the Application

Edit the configuration file at `jwebirc/web/META-INF/context.xml`:

```xml
<Context path="/jwebirc" reloadable="false">
    <!-- Session Configuration -->
    <Parameter name="jwebirc.webchatSessionTimeout" value="300000" override="false" />
    <Parameter name="jwebirc.webchatReconnectGraceMs" value="30000" override="false" />
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
    <Parameter name="jwebirc.webchatNickLength" value="12" override="false" />
    
    <!-- WEBIRC/CGIIRC Configuration -->
    <Parameter name="jwebirc.webircMode" value="WEBIRC" override="false" />
    <Parameter name="jwebirc.webircCgi" value="CGIIRC" override="false" />
    <Parameter name="jwebirc.hmacTemporal" value="1337" override="false" />
    <Parameter name="jwebirc.webircIncludeSecure" value="true" override="false" />
    
    <!-- Authentication Configuration -->
    <Parameter name="jwebirc.saslEnabled" value="true" override="false" />
    <Parameter name="jwebirc.saslMechanism" value="SCRAM-SHA-256" override="false" />
    
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
    <Parameter name="jwebirc.debugAssets" value="false" override="false" />
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

    <!-- Plugin System -->
    <Parameter name="jwebirc.pluginEnabled" value="false" override="false" />
    <Parameter name="jwebirc.pluginAvailable" value="welcome-banner" override="false" />
    <Parameter name="jwebirc.pluginAutoLoad" value="" override="false" />
    <Parameter name="jwebirc.pluginPath" value="plugins/" override="false" />
</Context>
```

For detailed CAPTCHA configuration, see the **[CAPTCHA Protection](#captcha-protection)** section below.

#### 3. Resolve Build Dependencies

Choose one build path:

**A) Maven (recommended, resolves dependencies automatically):**
```bash
cd jwebirc
mvn -f web/WEB-INF/pom.xml clean package
```

This reads dependencies from `web/WEB-INF/pom.xml`, compiles sources from `src/java`, packages the web root from `web/`, and builds `target/jwebirc.war`.

**B) Ant / NetBeans build:**

Ant uses JARs from `jwebirc/lib/` plus the Jakarta EE API from your application server/IDE.
Ensure these files exist in `jwebirc/lib/` before running Ant:

- `commons-codec-1.17.2.jar`
- `ipaddress-5.5.1.jar`
- `parsson-1.1.7.jar`
- `jakarta.json-api-2.1.2.jar`
- `jakarta.websocket-api-2.2.0.jar`

Then run:
```bash
cd jwebirc
ant clean
ant dist
```

The WAR file will be generated in `dist/`.

The Ant and Maven build paths are aligned and produce equivalent deployable WAR contents: the same JSPs, static assets, compiled classes, and runtime libraries. The main difference is the output path (`dist/jwebirc.war` for Ant, `target/jwebirc.war` for Maven).

For Ant, `jakarta.websocket-api` and the Jakarta EE server API remain compile-time dependencies from the local IDE/server setup and are not packaged into the WAR.

#### 4. Deploy

Deploy the generated WAR file to your Jakarta EE application server:

For the Maven build, deploy `jwebirc/target/jwebirc.war`.
For the Ant build, deploy `jwebirc/dist/jwebirc.war`.

- **GlassFish/Payara**: Copy to `domains/domain1/autodeploy/`
- **TomEE**: Copy to `webapps/`
- Or use the admin console of your application server

#### 5. Access the Application

Open your web browser and navigate to:
```
http://localhost:8080/jwebirc/
```

## Configuration (Server-Side)

Quick navigation:
- [IRC Server Settings](#irc-server-settings)
- [Session Configuration](#session-configuration)
- [WEBIRC/CGIIRC Configuration](#webirccgiirc-configuration)
- [Authentication Configuration](#authentication-configuration)
- [IP Forwarding Configuration](#ip-forwarding-configuration)
- [Application Display Configuration](#application-display-configuration)
- [Error Page Configuration](#error-page-configuration)
- [Chatnapping (Website Embedding)](#chatnapping-website-embedding)
- [CAPTCHA Protection](#captcha-protection)
- [Security Configuration](#security-configuration)

### IRC Server Settings

```xml
<!-- IRC Server Hostname -->
<Parameter name="jwebirc.webchatHost" value="irc.example.com" override="false" />

<!-- IRC Server Port (default: 6667 for plain, 6697 for SSL/TLS) -->
<Parameter name="jwebirc.webchatPort" value="6667" override="false" />

<!-- Enable SSL/TLS Encryption (true/false) - connects securely to IRC server -->
<Parameter name="jwebirc.webchatSsl" value="false" override="false" />

<!-- Server Password (if required by IRC server) -->
<Parameter name="jwebirc.webchatServerPassword" value="" override="false" />

<!-- Optional Server Binding Address -->
<Parameter name="jwebirc.webchatBind" value="127.0.0.1" override="false" />
```

**SSL/TLS Connection Details:**
- When `jwebirc.webchatSsl` is `true`, all connections use SSL/TLS encryption (TLSv1.3, TLSv1.2, TLSv1.1, TLSv1)
- SSL flag is case-insensitive and supports: `"true"`, `"1"`, `"yes"` (also handles null/whitespace safely)
- Self-signed certificates are automatically accepted for development/private IRC servers
- Use port `6697` (standard) when enabling SSL, or `6667` for plaintext connections
- For production UnrealIRCD and similar servers: use port `6697` with `jwebirc.webchatSsl=true`

### Session Configuration

```xml
<!-- WebSocket Session Timeout (milliseconds) -->
<Parameter name="jwebirc.webchatSessionTimeout" value="300000" override="false" />

<!-- Grace period for reconnect before IRC session cleanup (milliseconds) -->
<Parameter name="jwebirc.webchatReconnectGraceMs" value="30000" override="false" />

<!-- HTTP Session Timeout (seconds) -->
<Parameter name="jwebirc.sessionTimeout" value="500" override="false" />
```

- `jwebirc.webchatReconnectGraceMs` controls how long an existing IRC connection is kept alive after a WebSocket disconnect to allow session re-entry.

### WEBIRC/CGIIRC Configuration

For proper IP forwarding to IRC servers using WEBIRC gateway protocol (RFC 7194):

```xml
<!-- WEBIRC or CGIIRC mode -->
<Parameter name="jwebirc.webircMode" value="WEBIRC" override="false" />

<!-- CGIIRC gateway setting -->
<Parameter name="jwebirc.webircCgi" value="CGIIRC" override="false" />

<!-- HMAC temporal value for WEBIRC authentication -->
<Parameter name="jwebirc.hmacTemporal" value="1337" override="false" />

<!-- Include :secure flag in WEBIRC command when TLS/SSL is active (RFC 7194) -->
<!-- This signals to the IRC server that the connection is encrypted -->
<Parameter name="jwebirc.webircIncludeSecure" value="true" override="false" />
```

**WEBIRC :secure Flag Details:**
- When `jwebirc.webircIncludeSecure` is `true` and SSL/TLS is enabled (`jwebirc.webchatSsl=true`), the WEBIRC command will include the `:secure` suffix
- Example with secure flag: `WEBIRC password user 10.0.0.100 10.0.0.100 :secure`
- Example without secure flag: `WEBIRC password user 10.0.0.100 10.0.0.100`
- The `:secure` flag is recognized by modern IRC servers (UnrealIRCD, Inspircd, etc.) to properly classify encrypted gateway connections
- Disable this flag only if your IRC server does not support RFC 7194 or if you want to hide the encryption status
- This parameter is configurable per deployment and defaults to `true` for security

### Authentication Configuration

The SASL mechanism is configured server-side only via `jwebirc.saslMechanism`.
It is not selectable in the login form.

```xml
<!-- Enable/disable SASL authentication -->
<Parameter name="jwebirc.saslEnabled" value="true" override="false" />

<!-- SASL Mechanism: PLAIN, SCRAM-SHA-256, SCRAM-SHA-512 -->
<!-- Default: PLAIN (basic) -->
<!-- Recommended: SCRAM-SHA-256 or SCRAM-SHA-512 (more secure) -->
<Parameter name="jwebirc.saslMechanism" value="PLAIN" override="false" />

<!-- User credentials (optional) -->
<Parameter name="jwebirc.webchatUser" value="jwebirc" override="false" />
<Parameter name="jwebirc.webchatPassword" value="password" override="false" />
```

**SASL Mechanisms:**

- **PLAIN**: Basic authentication (username\0username\0password). Fast but less secure - uses base64 encoding only.
- **SCRAM-SHA-256**: Salted Challenge Response Authentication Mechanism with SHA-256. Good balance of security and compatibility.
- **SCRAM-SHA-512**: Salted Challenge Response Authentication Mechanism with SHA-512. Maximum security - requires server support.

**How to Choose:**
- Use **SCRAM-SHA-256** or **SCRAM-SHA-512** if your IRC server supports them (recommended)
- Fall back to **PLAIN** if the server doesn't support SCRAM mechanisms

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

### Optimized Nginx Reverse Proxy Example

For production deployments, use an upstream block plus explicit WebSocket handling. This keeps the configuration stable for both normal HTTP requests and the `/jwebirc/Webchat` endpoint:

```nginx
upstream jwebirc_backend {
    server 127.0.0.1:8080;
    keepalive 32;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name chat.example.com;

    location /jwebirc/ {
        proxy_pass http://jwebirc_backend/jwebirc/;
        proxy_http_version 1.1;
        proxy_buffering off;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Recommended matching application settings:

```xml
<Parameter name="jwebirc.forwardedForHeader" value="X-Forwarded-For" override="false" />
<Parameter name="jwebirc.forwardedForIps" value="127.0.0.1" override="false" />
```

Notes:

- The WebSocket endpoint is exposed below the application path as `/jwebirc/Webchat`, so WebSocket upgrade headers must be passed through by Nginx.
- `map $http_upgrade $connection_upgrade` avoids forcing `Connection: upgrade` on normal HTTP requests.
- `proxy_buffering off` and longer read/send timeouts help prevent idle WebSocket sessions from being interrupted too aggressively.
- Set `jwebirc.forwardedForIps` to the IP address or CIDR range of your trusted proxy, not to arbitrary client networks.
- If Nginx runs on another host, replace `127.0.0.1:8080` and `127.0.0.1` with the actual application server address and the trusted proxy address or subnet.
- For HTTPS deployments, keep the same proxy headers and switch the listener to `443 ssl` or `443 ssl http2` with your TLS certificate configuration.

### Application Display Configuration

```xml
<!-- Maximum nickname length used by login validation and fallback nick generation -->
<Parameter name="jwebirc.webchatNickLength" value="12" override="false" />

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

`jwebirc.webchatNickLength` defines the maximum nickname length accepted in the login form, applied by the backend before connect, and used as the fallback limit for automatic alternative nicknames when the IRC server rejects the requested nick before advertising its own `NICKLEN` value.

### Error Page Configuration

```xml
<!-- Show detailed stack traces on error pages (development) -->
<Parameter name="jwebirc.showStackTrace" value="true" override="false" />

<!-- Load unminified files instead of bundled minified assets -->
<Parameter name="jwebirc.debugAssets" value="false" override="false" />

<!-- Error page style: "simple" or "detailed" -->
<Parameter name="jwebirc.errorPageStyle" value="detailed" override="false" />
```

Set `jwebirc.debugAssets` to `true` only for explicit debugging. In normal operation, jWebIRC now always loads the generated minified bundles and no longer falls back automatically just because a bundle file is missing.

### Asset Minification

Minification reduces CSS/JS file size by removing comments, whitespace, and other non-essential characters. In jWebIRC this is used to improve page load time and reduce HTTP requests in production.

The behavior is controlled by the server parameter `jwebirc.debugAssets`.

How it works:

- With `jwebirc.debugAssets=false` (default), pages load bundled minified files from `file/bundles/` (for example `login.bundle.min.js`, `chat-head.bundle.min.js`, `chat-app.bundle.min.js`, `login.bundle.min.css`, `chat.bundle.min.css`).
- With `jwebirc.debugAssets=true`, pages load the original individual files from `file/` to simplify debugging in browser dev tools.
- Bundle versioning is read from `file/bundles/asset-bundles.properties` and appended as `?v=...` for cache busting.

When to use which mode:

- Production: keep `jwebirc.debugAssets=false`.
- Local debugging: temporarily set `jwebirc.debugAssets=true`.

Configuration example (`META-INF/context.xml` or server-managed context file):

```xml
<!-- Production (recommended) -->
<Parameter name="jwebirc.debugAssets" value="false" override="false" />

<!-- Optional while debugging: load unminified single files -->
<!-- <Parameter name="jwebirc.debugAssets" value="true" override="false" /> -->
```

Example Tomcat server-managed file (`conf/Catalina/localhost/jwebirc.xml`):

```xml
<Parameter name="jwebirc.debugAssets" value="false" override="false" />
```

Notes:

- Change the value only in one active config source (WAR internal `context.xml` or server-managed file) to avoid confusion.
- After changing `jwebirc.debugAssets`, restart or redeploy the application.

If bundled files are missing or outdated, rebuild the WAR with Maven so fresh bundles are generated:

```bash
cd jwebirc
mvn -f web/WEB-INF/pom.xml clean package
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

**Embed Example (iframe):**
```html
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

## Usage (Client-Side)

For command syntax and CTCP query examples, see [IRC Command Reference](#irc-command-reference).

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
1. **Connect**: Enter your nickname and optional SASL credentials
  The nickname field is limited by the server-side `jwebirc.webchatNickLength` setting.
2. **SASL Mechanism**: Uses the server-side configured value (`jwebirc.saslMechanism`)
3. **Join Channels**: Use `/join #channelname`
4. **Send Messages**: Type message and press Enter
5. **Private Messages**: Click on a username
6. **Emojis**: Click emoji button to insert emojis
7. **Standard IRC Commands**: `/nick`, `/msg`, `/quit`, `/topic`, etc.
8. **CTCP Queries**: `/ctcp user VERSION`, `/ctcp user PING`, etc.

## Nick Prefixes & Emoji Mapping

jWebIRC maps IRC channel status prefixes to role emojis in the nicklist and keeps chat rendering consistent with the highest known status.

### Prefix-to-Emoji Mapping

| Mode | Prefix | Nicklist Emoji | Meaning |
|------|--------|----------------|---------|
| `q` | `~` | 👑 | Owner / Founder |
| `a` | `&` | 🛡️ | Admin / Protected |
| `o` | `@` | ⭐ | Operator |
| `h` | `%` | ⚡ | Half-Op |
| `v` | `+` | 💬 | Voice |

### What Is Shown Where

- **Nicklist**: shows emoji + nickname (example: `👑WarPigs`).
- **Chat line nicks**: show the highest matching IRC prefix symbol (example: `@Nick`), not the full prefix chain.
- If a user has multiple statuses (for example with `multi-prefix`), jWebIRC keeps all known symbols internally and uses the highest-priority one for compact display in chat.

### Automatic Prefix Detection From Server Welcome

jWebIRC automatically reads the server prefix definition from the IRC welcome/login phase, specifically from numeric `005` (`ISUPPORT`) with `PREFIX=(modes)symbols`.

Example advertised by servers:

- `PREFIX=(qaohv)~&@%+`

This means jWebIRC does not use hardcoded role symbols only. It adapts to what the IRC server reports during welcome and applies the matching prefixes/roles in nicklist and chat automatically.

Note:

- The plugin named `welcome-banner` is unrelated to IRC prefix detection. Prefix mapping comes from IRC protocol messages (`005 ISUPPORT`), not from frontend plugins.

## Plugin System

The frontend now includes an independent plugin system that is separate from the template/theme mechanism. Plugins live under `jwebirc/web/plugins/<plugin-id>/` and are loaded only when explicitly enabled in server configuration.

### Configuration

Use these context parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `jwebirc.pluginEnabled` | `false` | Enables the plugin system globally |
| `jwebirc.pluginAvailable` | `welcome-banner` | Comma-separated allowlist of plugin directory names |
| `jwebirc.pluginAutoLoad` | empty | Comma-separated subset of `pluginAvailable` to inject automatically; empty loads all available plugins |
| `jwebirc.pluginPath` | `plugins/` | Base path for plugin assets |

### Plugin Structure

Each plugin gets its own directory:

```text
jwebirc/web/plugins/
  welcome-banner/
    plugin.js
    style.css
```

- `plugin.js` is required and must call `window.jwebircRegisterPlugin(...)`
- `style.css` is optional and is injected automatically when present

### Minimal Plugin Example

```javascript
window.jwebircRegisterPlugin({
  id: 'my-plugin',
  initialize(context) {
    console.log('Plugin started on page:', context.page);
  }
});
```

### Activation Example

```xml
<Parameter name="jwebirc.pluginEnabled" value="true" override="false" />
<Parameter name="jwebirc.pluginAvailable" value="welcome-banner,my-plugin" override="false" />
<Parameter name="jwebirc.pluginAutoLoad" value="welcome-banner,my-plugin" override="false" />
```

If `jwebirc.pluginAutoLoad` is left empty, jWebIRC automatically loads all plugins listed in `jwebirc.pluginAvailable`.

The shipped `welcome-banner` plugin is an example scaffold and can be activated either by listing it explicitly in `jwebirc.pluginAutoLoad` or by leaving `jwebirc.pluginAutoLoad` empty while `jwebirc.pluginEnabled=true`.

For a focused quick start, see `PLUGIN_SYSTEM.md`.

## IRCv3 Feature Support

jWebIRC negotiates IRCv3 capabilities with `CAP LS 302` and requests supported features only when the IRC server advertises them.

Supported IRCv3 features:

- **capability-negotiation**: CAP LS 302 with handling for `LS`, `ACK`, `NAK`, `NEW`, and `DEL`
- **sasl**: Authentication via `PLAIN`, `SCRAM-SHA-256`, and `SCRAM-SHA-512`
- **message-tags**: Preserves and forwards IRCv3 message tags to the web client
- **account-notify**: Receives account login/logout changes for users
- **away-notify**: Receives away status changes without polling
- **batch**: Supports grouped server message delivery
- **cap-notify**: Handles capability changes announced during an active session
- **chghost**: Receives host or ident changes without requiring a reconnect
- **extended-join**: Receives extended JOIN metadata such as account information
- **invite-notify**: Receives invitation-related notifications where supported by the server
- **labeled-response**: Supports correlating responses to tagged client requests
- **multi-prefix**: Receives multiple channel status prefixes per user when available
- **server-time**: Receives authoritative server timestamps via message tags
- **userhost-in-names**: Receives extended NAMES replies with userhost information

Availability depends on the IRC server. jWebIRC requests these capabilities automatically when they are advertised during login or later via `CAP NEW`.

## IRC Command Reference

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

Use the quick sections at the top of this README:

- [Quick Start (3 Commands)](#quick-start-3-commands) for Maven (recommended)
- [Quick Start (Ant)](#quick-start-ant) for Ant/NetBeans with local `lib/` dependencies

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
