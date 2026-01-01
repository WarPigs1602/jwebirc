# CTCP Funktionalität - Testanleitung

## Überblick

Die CTCP (Client-To-Client Protocol) Funktionalität wurde erweitert und verbessert. Diese Anleitung beschreibt, wie die CTCP-Befehle getestet werden können.

## Implementierte CTCP-Befehle

### Server-seitige Antworten (IrcParser.java)

Der Server antwortet automatisch auf folgende CTCP-Anfragen:

1. **VERSION** - Gibt die Client-Version zurück
   - Antwort: `jwebirc 2.0 - Java WebSocket IRC Client`

2. **TIME** - Gibt die aktuelle Serverzeit zurück
   - Format: `EEE MMM dd HH:mm:ss yyyy` (z.B. `Wed Jan 01 15:30:45 2026`)

3. **PING** - Echo-Antwort für RTT-Messung
   - Gibt den empfangenen Timestamp zurück

4. **CLIENTINFO** - Liste aller unterstützten CTCP-Befehle
   - Antwort: `VERSION TIME PING CLIENTINFO FINGER USERINFO SOURCE ACTION`

5. **FINGER** - Benutzerinformationen
   - Antwort: `<nickname> - Idle: 0 seconds`

6. **USERINFO** - Zusätzliche Benutzerinformationen
   - Antwort: Realname des Benutzers oder `jwebirc user`

7. **SOURCE** - Quelle des Clients
   - Antwort: `https://github.com/WarPigs1602/jwebirc`

8. **ACTION** - Keine automatische Antwort (wird vom Client behandelt)

9. **Unbekannte Befehle** - ERRMSG wird zurückgesendet
   - Format: `ERRMSG <command> :Unknown CTCP command`

### Client-seitige Anzeige (irc.js)

Der Client zeigt CTCP-Antworten formatiert an:

- **Farbkodierung**: Blaue Farbe (`#00aaff`) für normale Antworten
- **Fehlermeldungen**: Orange Farbe (`#ff6600`) für ERRMSG
- **RTT-Berechnung**: Bei PING wird die Rundlaufzeit in Millisekunden angezeigt

## Test-Szenarien

### 1. CTCP VERSION Anfrage senden

**Im Chat-Fenster eingeben:**
```
/ctcp <nickname> VERSION
```

**Erwartete Ausgabe:**
```
== CTCP VERSION request sent to <nickname>
```

**Erwartete Antwort:**
```
== CTCP VERSION reply from <nickname>: jwebirc 2.0 - Java WebSocket IRC Client
```

### 2. CTCP TIME Anfrage senden

**Im Chat-Fenster eingeben:**
```
/ctcp <nickname> TIME
```

**Erwartete Antwort:**
```
== CTCP TIME reply from <nickname>: Wed Jan 01 15:30:45 2026
```

### 3. CTCP PING Anfrage senden

**Im Chat-Fenster eingeben:**
```
/ctcp <nickname> PING
```

**Erwartete Antwort:**
```
== CTCP PING reply from <nickname>: 123ms
```
(Die Millisekunden-Zahl variiert je nach Netzwerklatenz)

### 4. CTCP CLIENTINFO Anfrage senden

**Im Chat-Fenster eingeben:**
```
/ctcp <nickname> CLIENTINFO
```

**Erwartete Antwort:**
```
== CTCP CLIENTINFO reply from <nickname>: VERSION TIME PING CLIENTINFO FINGER USERINFO SOURCE ACTION
```

### 5. CTCP FINGER Anfrage senden

**Im Chat-Fenster eingeben:**
```
/ctcp <nickname> FINGER
```

**Erwartete Antwort:**
```
== CTCP FINGER reply from <nickname>: <username> - Idle: 0 seconds
```

### 6. CTCP USERINFO Anfrage senden

**Im Chat-Fenster eingeben:**
```
/ctcp <nickname> USERINFO
```

**Erwartete Antwort:**
```
== CTCP USERINFO reply from <nickname>: <realname>
```

### 7. CTCP SOURCE Anfrage senden

**Im Chat-Fenster eingeben:**
```
/ctcp <nickname> SOURCE
```

**Erwartete Antwort:**
```
== CTCP SOURCE reply from <nickname>: https://github.com/WarPigs1602/jwebirc
```

### 8. Unbekannten CTCP-Befehl senden

**Im Chat-Fenster eingeben:**
```
/ctcp <nickname> UNKNOWN
```

**Erwartete Antwort:**
```
== CTCP ERROR from <nickname>: UNKNOWN :Unknown CTCP command
```

## Technische Details

### CTCP-Format

CTCP-Nachrichten werden mit dem ASCII-Zeichen `\001` (SOH - Start of Header) umschlossen:

**Anfrage (PRIVMSG):**
```
PRIVMSG <target> :\001<COMMAND> [args]\001
```

**Antwort (NOTICE):**
```
NOTICE <sender> :\001<COMMAND> <response>\001
```

### Code-Änderungen

#### IrcParser.java
- Erweiterte `handleCtcpRequest()` Methode mit zusätzlichen Befehlen
- FINGER, USERINFO, SOURCE Unterstützung hinzugefügt
- ERRMSG für unbekannte Befehle implementiert
- CLIENTINFO-Antwort aktualisiert

#### irc.js
- Erweiterte `handleCtcpReply()` Methode mit zusätzlichen Formatierungen
- Unterstützung für FINGER, USERINFO, SOURCE, ERRMSG hinzugefügt
- Farbcodierung für verschiedene Antworttypen

#### README.md
- CTCP-Befehlsübersicht hinzugefügt
- Feature-Liste aktualisiert
- Dokumentation der unterstützten CTCP-Befehle

## Debugging

### Server-seitig (Java-Konsole)
```
CTCP <COMMAND> received from <sender> (args: <arguments>)
Sent CTCP <COMMAND> reply to <sender>
Unknown CTCP command: <COMMAND>
```

### Client-seitig (Browser-Konsole)
Überprüfen Sie die WebSocket-Nachrichten im Browser Developer Tools (Netzwerk-Tab).

## Bekannte Einschränkungen

1. **Idle-Zeit**: Die FINGER-Antwort gibt aktuell immer "Idle: 0 seconds" zurück. Eine vollständige Idle-Zeit-Implementierung würde zusätzliche Session-Tracking-Logik erfordern.

2. **ERRMSG-Unterstützung**: Nicht alle IRC-Clients unterstützen ERRMSG. Einige Clients zeigen möglicherweise keine Fehlermeldung für unbekannte CTCP-Befehle an.

3. **CTCP-Flooding**: Derzeit gibt es keine Rate-Limiting-Mechanismen für CTCP-Anfragen. In Produktionsumgebungen sollte ein Throttling implementiert werden.

## Weiterentwicklung

Mögliche zukünftige Erweiterungen:

- [ ] DCC (Direct Client-to-Client) Unterstützung für Dateiübertragungen
- [ ] Idle-Zeit-Tracking für FINGER
- [ ] CTCP Rate-Limiting / Flood-Schutz
- [ ] Benutzerdefinierte CTCP-Antworten konfigurierbar machen
- [ ] CTCP-Statistiken und Logging

## Support

Bei Problemen oder Fragen zur CTCP-Funktionalität öffnen Sie bitte ein Issue auf GitHub:
https://github.com/WarPigs1602/jwebirc/issues

