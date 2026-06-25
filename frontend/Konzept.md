# Frontend — Setup & Warum hier kein Dockerfile liegt

Dieses Verzeichnis enthält die **zwei Frontends** des Rezeptshops:

| Ordner | Zweck | Erreichbar unter |
|---|---|---|
| `user-portal/` | Shop für Endanwender (Produkte, Warenkorb, Wunschlisten) | http://localhost:8080 |
| `admin-portal/` | Verwaltung für Admins (Produkt- & Userverwaltung) | http://localhost:8081 |

Beide bestehen aus **purem Vanilla JS, HTML und CSS** — kein React, Vue, Angular, kein
Build-Werkzeug, kein TypeScript. Das ist eine bewusste Vorgabe der Prüfungsleistung.

---

## Wichtig: Hier gibt es absichtlich **kein** Dockerfile

Bei den Backend-Services liegt in jedem Ordner ein `Dockerfile`, das Docker erklärt, wie
der Service gebaut wird (Node installieren, `npm install`, starten). **Beim Frontend ist
das nicht nötig** — und genau deshalb wurden die (leeren) Frontend-Dockerfiles entfernt.

Der Grund: Unser Frontend muss nicht „gebaut" oder „kompiliert" werden. Es sind einfach
fertige `.html`-, `.css`- und `.js`-Dateien, die ein Browser direkt lesen kann. Wir
brauchen also nur etwas, das diese Dateien über HTTP **ausliefert** — und dafür nehmen wir
ein fertiges Standard-Image: **nginx**.

---

## Was ist nginx?

**nginx** (gesprochen „Engine-X") ist ein sehr verbreiteter, schneller **Webserver**. Seine
Hauptaufgabe hier: statische Dateien (HTML/CSS/JS) entgegennehmen, wenn ein Browser sie
anfragt, und sie zurückschicken. Mehr braucht ein Vanilla-JS-Frontend nicht.

Wir installieren nginx nicht selbst und schreiben auch keine Konfiguration dafür — wir
benutzen das offizielle, fertige Docker-Image `nginx:alpine` (die `alpine`-Variante ist
eine besonders kleine Version). nginx liefert standardmäßig alles aus, was im Ordner
`/usr/share/nginx/html` im Container liegt.

---

## Wo ist das in der `docker-compose.yml` eingebaut?

In der `docker-compose.yml` (eine Ebene über diesem Ordner) gibt es zwei Service-Blöcke.
Vereinfacht sieht der `user-portal` so aus:

```yaml
user-portal:
  image: nginx:alpine                                  # fertiges nginx-Image, kein Build
  volumes:
    - ./frontend/user-portal/public:/usr/share/nginx/html:ro   # unsere Dateien -> nginx-Webroot
  ports:
    - "8080:80"                                         # localhost:8080 -> Port 80 im Container
```

Drei Dinge passieren hier:

1. **`image: nginx:alpine`** — statt `build:` (wie bei den Backends) wird direkt ein
   fertiges Image benutzt. Es gibt **nichts zu bauen**, also auch kein Dockerfile.
2. **`volumes: ... :ro`** — unser lokaler Ordner `user-portal/public/` wird in den Container
   „hineingespiegelt", genau dorthin, wo nginx seine Dateien sucht
   (`/usr/share/nginx/html`). `:ro` heißt **read-only** — der Container darf unsere Dateien
   nur lesen, nicht verändern.
3. **`ports: "8080:80"`** — nginx lauscht im Container auf Port 80; den machen wir auf dem
   eigenen Rechner unter Port 8080 erreichbar.

Der `admin-portal`-Block ist identisch aufgebaut, nur mit `admin-portal/public` und Port
`8081`.

---

## Wie binde ich meine Dateien ein?

Alles, was ausgeliefert werden soll, kommt in den **`public/`**-Ordner des jeweiligen
Portals:

```
frontend/user-portal/public/
├── index.html        ->  http://localhost:8080/
├── css/style.css     ->  http://localhost:8080/css/style.css
└── js/app.js         ->  http://localhost:8080/js/app.js
```

Der Inhalt von `public/` ist der **Webroot**. `public/index.html` wird automatisch
angezeigt, wenn man `http://localhost:8080/` aufruft.

> Hinweis: Es gibt bewusst **keinen** `src/`-Ordner. Da das Frontend nicht gebaut/kompiliert
> wird, liegen HTML, CSS und JS direkt fertig in `public/` (gegliedert in `css/` und `js/`).
> Ausgeliefert wird **ausschließlich** der Inhalt von `public/`, weil nur dieser Ordner in
> den nginx-Container gemountet wird.

---

## Änderungen sehen

Weil die Dateien per Volume gemountet sind, musst du den Container nach Code-Änderungen
**nicht** neu bauen. Datei speichern → im Browser neu laden (ggf. mit `Strg+F5`, um den
Browser-Cache zu umgehen). Nur wenn der Container noch nicht läuft:

```bash
docker compose up -d user-portal admin-portal
```
