# CORS — warum wir es brauchen und was wir einbauen

Diese Datei erklärt, warum unsere Backend-Services **CORS** brauchen, damit das Frontend
überhaupt mit ihnen reden kann — und was wir konkret im Code gebaut haben.

---

## 1. Das Problem: „Origin" und die Same-Origin-Policy

Eine **Origin** ist die Kombination aus **Protokoll + Host + Port**, z. B.:

```
http://localhost:8080
└┬─┘   └───┬───┘ └┬┘
Protokoll  Host   Port
```

Browser haben eine eingebaute Sicherheitsregel, die **Same-Origin-Policy**: JavaScript auf
einer Seite darf per `fetch` standardmäßig **nur** Daten von der **gleichen Origin** laden.
Unterscheidet sich auch nur der **Port**, ist es für den Browser eine **andere Origin**.

Bei uns:

| Teil | Origin |
|---|---|
| user-portal (nginx) | `http://localhost:8080` |
| admin-portal (nginx) | `http://localhost:8081` |
| auth-service | `http://localhost:3001` |
| inventory-service | `http://localhost:3003` |
| … | `…:3002 / 3004 / 3005` |

Wenn `app.js` im user-portal also `fetch("http://localhost:3001/api/auth/login")` aufruft,
ist das ein **Cross-Origin-Request** (Port 8080 → 3001). Ohne Erlaubnis des Servers
**blockt der Browser die Antwort** — der Request kommt im Backend zwar an, aber das
JavaScript bekommt das Ergebnis nicht zu sehen (Fehler in der Konsole: „blocked by CORS
policy").

---

## 2. Warum es CORS gibt

Die Regel schützt dich: Hättest du nebenbei eine bösartige Seite `evil.com` offen, könnte
deren JavaScript sonst heimlich Requests an `deine-bank.de` schicken — mit deinen dort
eingeloggten Daten. Die Same-Origin-Policy verhindert das. **CORS** (Cross-Origin Resource
Sharing) ist der offizielle Weg, mit dem ein Server sagt: „Anfragen von **dieser** fremden
Origin sind okay."

Der Server tut das über spezielle Antwort-Header, vor allem:

```
Access-Control-Allow-Origin: http://localhost:8080
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

### Der „Preflight"
Bei „nicht-einfachen" Requests (z. B. mit `Authorization`-Header oder Methode `PUT`/`DELETE`)
schickt der Browser **vorab automatisch** eine `OPTIONS`-Anfrage („darf ich das gleich
überhaupt?"). Erst wenn der Server darauf mit den erlaubenden Headern antwortet, folgt der
echte Request. Unsere Endpunkte müssen also auch `OPTIONS` beantworten.

---

## 3. Was wir konkret einbauen

Wir nutzen das fertige npm-Paket **`cors`** und erlauben **nur unsere beiden Frontend-
Origins** (nicht alles offen). In **jeder** `src/index.js` der 5 Services, direkt nach
`const app = express();`:

```js
const cors = require('cors');

// Nur die beiden Frontend-Origins erlauben (Browser-Schutz). Bearer-Tokens, keine Cookies.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080,http://localhost:8081')
  .split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));
```

- Die erlaubten Origins stehen in der zentralen `.env` als `CORS_ORIGINS` (Komma-getrennt).
  Beim lokalen `npm start` wird das gelesen; im Docker-Betrieb greift derselbe Wert als
  **Code-Default** (der Browser läuft immer auf dem Host → Origins sind immer
  `localhost:8080`/`8081`).
- `app.use(cors(...))` **beantwortet den OPTIONS-Preflight automatisch** und setzt bei
  erlaubten Origins die `Access-Control-Allow-*`-Header. Der `Authorization`-Header wird
  dabei automatisch zugelassen.

### Wichtig: Express 5
Wir nutzen **Express 5**. Dort **nicht** `app.options('*', cors())` schreiben — die
Wildcard-Route `'*'` lässt Express 5 abstürzen (geändertes Routing / path-to-regexp).
`app.use(cors(...))` als Middleware reicht völlig und deckt alle Pfade inkl. Preflight ab.

### Warum keine Cookies / kein `credentials`
Unsere Authentifizierung läuft über **JWT im `Authorization: Bearer …`-Header**, nicht über
Cookies. Deshalb brauchen wir `cors({ credentials: true })` **nicht** — die simple
Origin-Allowlist genügt.

---

## 4. Auswirkung auf unsere Tests (Bruno / curl)

**Keine.** CORS ist eine reine **Browser**-Schutzregel. Werkzeuge wie **Bruno** oder **curl**
senden keinen `Origin`-Header und ignorieren `Access-Control-*`-Header → unsere bestehenden
Bruno-Kollektionen laufen unverändert weiter. CORS wird erst relevant, sobald ein echter
Browser (unser Frontend) die Services aufruft.

---

## 5. Schnell selbst prüfen

```bash
# Preflight von einer erlaubten Origin → 204 + Access-Control-Allow-Origin
curl -i -X OPTIONS \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: POST" \
  http://localhost:3001/api/auth/login

# Fremde Origin → Antwort enthält KEIN Access-Control-Allow-Origin (Browser würde blocken)
curl -i -H "Origin: http://evil.com" http://localhost:3001/health
```
