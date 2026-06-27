# Präsentations-Vorlage — Rezeptshop (Web Engineering)

> **Zweck dieser Datei:** Roter Faden für unsere Abschlusspräsentation. Sie sagt
> **was wann wo** erklärt wird — *nicht* welcher Text exakt auf welche Folie kommt.
> Jeder baut „seine" Folien selbst, hält sich aber an diese Reihenfolge, die Zeiten
> und die Inhalte. So zieht die ganze Gruppe an einem Strang und niemand erklärt
> etwas doppelt oder vergisst einen Pflichtpunkt.

---

## Rahmenbedingungen (aus `Prüfungsleistung.md`)

- **Dauer:** 20–30 Min. → **wir zielen auf 30 Min.** (max. Tiefe, oberes Limit nutzen).
- **Gruppe:** 5 Personen. Jede Person übernimmt mehrere Abschnitte — Aufteilung klären
  wir im Team separat (in der Vorlage stehen nur Platzhalter `[Sprecher: ___]`).
- **Pflichtinhalte laut Prof:**
  1. Eure Lösung **+ Architekturbild**
  2. **Kurze Demo** der Anwendung
  3. **Rückblick & Lessons Learned**
- **Bewertung wirkt mit rein:** Erscheinungsbild (20 P., u. a. *Gesamteindruck der
  Präsentation*) und Dokumentation (10 P.). Die Präsentation ist also selbst notenrelevant.

### Goldene Regeln für die Präsentation
1. **Jeder Pflichtblock kommt vor** (Architektur → Demo → Lessons Learned). Alles andere
   ist Zusatz, der uns von anderen Gruppen abhebt.
2. **Zeit halten.** Lieber ein Detail weglassen als überziehen. Pro Abschnitt steht ein
   Zeitbudget. Eine Person stoppt mit, gibt diskret Handzeichen bei Überziehung.
3. **Wir zeigen, wir lesen nicht ab.** Folien = Stichpunkte + Bilder, Erklärung mündlich.
4. **Sprachregelung Vorgehen:** Wir stellen unsere Arbeit als **eigene Ingenieursleistung**
   dar und belegen sie mit echten Artefakten: Git-Feature-Branch-Workflow, Pull-Request-
   Reviews, Bruno-Testkollektionen, Kanban-Board. Das ist unser nachvollziehbarer roter
   Faden — daran hangeln wir uns entlang. (Über interne Hilfsmittel reden wir nicht; im
   Fokus steht *was* wir gebaut haben und *wie wir es als Team organisiert* haben.)
5. **Übergänge ansagen:** Jede Person leitet zum nächsten Abschnitt über
   („…und wie das technisch zusammenläuft, zeigt euch jetzt ___").

---

## Material-Fundus (woher die Inhalte kommen)

Niemand muss Inhalte neu erfinden — alles existiert schon im Repo:

| Abschnitt | Quelle im Repo |
|---|---|
| Architekturbild & -beschreibung | `planung/architecture.md`, `docs/` (Architekturbild) |
| Service-/Port-Übersicht | `CLAUDE.md` (Service-Tabelle), `docker-compose.yml` |
| Auth/Authz-Konzept | `planung/architecture.md`, `CLAUDE.md` (Türsteher-Prinzip) |
| ERM / Datenbank | `planung/Strukturen/ERM.mmd`, `planung/Strukturen/Datenbankschema.md` |
| Docker & Profile | `docker-compose.yml`, `database/dummy-daten.sql` |
| CORS | `planung/CORS.md` |
| Vorgehen / Git | `planung/git-workflow.md`, GitHub (PRs, Kanban-Board) |
| Tests | `bruno/` (Kollektionen pro Service) |
| Doku / Mockup / Handbuch | `docs/` |

---

## Aufbau der Präsentation (was wann wo)

> Reihenfolge ist verbindlich. Zeiten sind Richtwerte und summieren sich auf ~30 Min.

### 1 · Titel & Team — `[Sprecher: ___]` — ⏱ 1 Min
- **Ziel:** Einstieg, alle Namen, Projektname „Rezeptshop".
- **Was erklären:** In einem Satz, was das Projekt ist (Rezept-Webshop als
  Microservice-Architektur) und wie die Präsentation grob abläuft (Agenda-Folie).
- **Wo zeigen:** Eine Titelfolie + eine kurze Agenda-Folie.

### 2 · Was ist der Rezeptshop? — `[Sprecher: ___]` — ⏱ 2 Min
- **Ziel:** Aufgabenstellung und Umfang verständlich machen, bevor es technisch wird.
- **Was erklären:** Das Thema (Webshop mit 5 Webservices), die **zwei Anwendertypen**
  (User + Admin) und damit die **zwei Frontends**. Kurz die Feature-Bereiche nennen
  (Produkte/Kauf, Wunschlisten, Anmeldung, Berechtigungen, User-Verwaltung).
- **Wo zeigen:** Eine Übersichtsfolie mit den 5 Servicebereichen + 2 Frontends.
- **Tipp:** Hier *nicht* in Details gehen — nur den Rahmen aufspannen.

### 3 · Architektur-Überblick + Architekturbild — `[Sprecher: ___]` — ⏱ 4 Min
- **Ziel:** Pflichtblock 1. Die Gesamtstruktur muss hängenbleiben.
- **Was erklären:**
  - **Warum Microservices** (5 unabhängige Services, jeder eine Verantwortung).
  - Die **5 Backend-Services + 2 Frontends + 1 gemeinsame Datenbank** im Zusammenspiel.
  - **Ports** und **Datenflüsse** (wer ruft wen): Frontend → Service → Authz-Service → DB.
  - Services reden **nur über HTTP** miteinander.
- **Wo zeigen:** **Das Architekturbild** (aus `docs/` bzw. `architecture.md`) groß auf eine
  Folie. Mit dem Mauszeiger/Laserpointer die Datenflüsse nachfahren.
- **Tipp:** Das ist der wichtigste konzeptionelle Moment. Langsam, mit dem Bild führen.

### 4 · Auth & Autorisierung — das „Türsteher"-Prinzip — `[Sprecher: ___]` — ⏱ 3 Min
- **Ziel:** Unser stärkstes Architektur-Highlight — saubere Trennung der Zuständigkeiten.
- **Was erklären:**
  - **auth-service** stellt JWTs aus und validiert sie — *als Einziger*.
  - **authorization-service** ist der **einzige Türsteher**: andere Services fragen vor
    jeder Aktion per HTTP `POST /api/authorization/check`, ob die Aktion erlaubt ist.
  - Der Türsteher prüft **keine** JWTs, sondern bekommt `userId` + `role` weitergereicht.
  - Kurz die Logik: hardcodierte Grundregeln (Admin darf Produkte bearbeiten, User nur
    eigenes Profil) **+** flexible `permissions`-Tabelle (read/write/owner, z. B. Wunschliste teilen).
- **Wo zeigen:** Ein einfaches Sequenz-/Pfeil-Diagramm (Service → Authz → Antwort
  allowed: true/false). Reicht als Skizze.
- **Gezielte Tiefe (1 Highlight):** Ein Mini-Beispiel — „User A teilt Wunschliste mit
  User B" → wie der Eintrag in `permissions` die Schreibrechte freischaltet.

### 5 · Datenbank & ERM — `[Sprecher: ___]` — ⏱ 3 Min
- **Ziel:** Pflicht-Doku (ERM) zeigen + Designentscheidung begründen.
- **Was erklären:**
  - **Designentscheidung: eine gemeinsame PostgreSQL-Datenbank** (kein Schema pro Service)
    — und warum (einfacher für ein Studienprojekt, ein konsistentes Modell).
  - Die zentralen Tabellen kurz benennen (`users`, `products`, `carts`/`cart_items`,
    `orders`/`orderpositions`, `wishlists`, `permissions`).
- **Wo zeigen:** **Das ERM** (`ERM.mmd` als Bild exportiert) auf eine Folie.
- **Gezielte Tiefe (1 Highlight):** *Einen* interessanten Ausschnitt herausgreifen, z. B.
  die `permissions`-Tabelle (deckt alle Ressourcentypen ab) oder `orders`/`orderpositions`
  mit `purchase_price` (Preis zum Kaufzeitpunkt eingefroren). Nicht jede Tabelle durchgehen!

### 6 · Docker Compose & Profile — `[Sprecher: ___]` — ⏱ 3 Min
- **Ziel:** Zeigen, dass die ganze Anwendung mit **einem Befehl** läuft (Prüfungs-Pflicht:
  lauffähig im Container).
- **Was erklären:**
  - `docker compose up` startet **alles**: PostgreSQL, pgAdmin, 5 Services, 2 Frontends.
  - `init.sql` legt beim ersten Start automatisch alle Tabellen an.
  - **Profile:** Mit `--profile dev` werden zusätzlich die **Dummy-Daten**
    (`dummy-daten.sql`) geladen — saubere Trennung Demo-/Testdaten von der leeren Basis.
  - Kurz: zentrale `.env` (JWT-Secret, DB-Zugang) wird von allen Services geteilt.
- **Wo zeigen:** Einen kompakten Ausschnitt der `docker-compose.yml` (nicht die ganze
  Datei!) — z. B. ein Service-Block + der Profile-Eintrag. Daneben den Startbefehl.
- **Gezielte Tiefe (1 Highlight):** Den **Profile-Mechanismus** erklären — das ist ein
  Detail, das zeigt, dass wir Docker bewusst eingesetzt haben.

### 7 · Vorgehen & Qualität — `[Sprecher: ___]` — ⏱ 3 Min
- **Ziel:** Zeigen, dass wir als Team **strukturiert** gearbeitet haben (zahlt auf
  Gesamteindruck ein).
- **Was erklären:**
  - **Git-Feature-Branch-Workflow:** `main` ist tabu, alles läuft über Feature-Branches →
    Pull Request → Review → Merge.
  - **Kanban-Board** auf GitHub als Aufgabenübersicht.
  - **Test-Vorgehen:** Pro Endpoint eine **Bruno**-Testdatei; Workflow „Endpoint bauen →
    in Bruno testen → nächster Endpoint". Tests sind **idempotent** (beliebig oft wiederholbar).
  - **Dokumentation** wurde mitgepflegt (`docs/`, `planung/`), nicht erst am Ende.
- **Wo zeigen:** Screenshot vom **Kanban-Board** und/oder einem **Pull Request mit Review**,
  Screenshot einer **Bruno-Kollektion** mit grünen Tests.
- **Tipp:** Das ist der Abschnitt, in dem unsere Arbeitsweise glänzt — konkret mit den
  echten GitHub-/Bruno-Artefakten belegen.

### 8 · Live-Demo — `[Sprecher: ___ ` (+ 1 Co-Pilot für Klicks)`]` — ⏱ 8 Min
- **Ziel:** Pflichtblock 2. Die Anwendung **live** zeigen.
- **Setup:** Mit **`docker compose up`** (Profil `dev`, damit Dummy-Daten da sind) live
  gestartet. → **Siehe Technik-Checkliste unten — Demo unbedingt vorher proben!**
- **Demo-Drehbuch (Klickpfad, ~8 Min):**
  1. **User-Portal öffnen** (`localhost:8080`).
  2. **Anmeldung** zeigen — entweder klassisch (Passwort) **oder** der Hingucker:
     **Magic-Link / Code-Login** (AUTH-5). *Einer* von beiden reicht in der Demo.
  3. **Produkte + Suche** (INV-2): nach Name/Kategorie filtern.
  4. **Warenkorb** befüllen (INV-6) → **Kauf abschließen** (INV-7) → kurz die
     **Kaufhistorie** zeigen → erwähnen, dass eine **Bestätigungs-Mail** rausgeht (INV-8).
  5. **Wunschliste** anlegen, Produkt hinzufügen, **mit anderem User teilen**
     (read/write) (WUN-1–4) — das verbindet sich schön mit dem Türsteher-Abschnitt.
  6. **Admin-Portal öffnen** (`localhost:8081`): als Admin anmelden →
     **Produkt anlegen/bearbeiten/löschen** (INV-3/4/5) und **User sperren** (USER-4).
- **Was dabei ansagen:** Bei jedem Schritt kurz die Feature-Nummer/den Zweck nennen,
  damit der Prof die Anforderungen wiedererkennt.
- **Tipp:** **Eine Person redet, eine klickt** — ruhiger und pannensicherer.
  Responsive kurz zeigen (Fenster schmal ziehen → Hochformat-Layout) zahlt auf
  Erscheinungsbild ein.

### 9 · Rückblick & Lessons Learned — `[Sprecher: ___]` — ⏱ 2 Min
- **Ziel:** Pflichtblock 3. Reflexion zeigen.
- **Was erklären (3–4 ehrliche Punkte), z. B.:**
  - Die **Microservice-Architektur als Lernkurve** — das Zusammenspiel der Services
    (HTTP statt direkter Aufrufe, der Türsteher) war anfangs ungewohnt.
  - **Docker & gemeinsame DB** sauber aufzusetzen, damit alles mit einem Befehl läuft.
  - **Team-Koordination** über Git-Branches/PRs — Vorteil sauberer Reviews, Aufwand der Abstimmung.
  - Was wir **nächstes Mal anders** machen würden (z. B. früher End-to-End testen).
- **Wo zeigen:** Eine Folie mit Stichpunkten „Was lief gut / Was war schwierig / Was nehmen wir mit".

### 10 · Abschluss & Q&A — `[Sprecher: ___]` — ⏱ 1 Min + offene Fragen
- **Was erklären:** Ein-Satz-Fazit + Dank, dann Übergabe an Fragen.
- **Wo zeigen:** Abschlussfolie (Repo-Link, „Fragen?").

---

## Zeitübersicht (Summe ~30 Min)

| # | Abschnitt | Zeit |
|---|---|---|
| 1 | Titel & Team | 1 |
| 2 | Was ist der Rezeptshop? | 2 |
| 3 | Architektur + Architekturbild | 4 |
| 4 | Auth/Authz (Türsteher) | 3 |
| 5 | Datenbank & ERM | 3 |
| 6 | Docker Compose & Profile | 3 |
| 7 | Vorgehen & Qualität | 3 |
| 8 | Live-Demo | 8 |
| 9 | Lessons Learned | 2 |
| 10 | Abschluss & Q&A | 1 |
| | **Summe** | **30** |

---

## Vorbereitungs-Checkliste (vor dem Präsentationstag)

- [ ] Sprecher-Aufteilung festgelegt (Platzhalter `[Sprecher: ___]` ausgefüllt).
- [ ] Jeder hat seine Folien gebaut — einheitliches Design/Farbschema über alle (Erscheinungsbild!).
- [ ] Architekturbild und ERM als **saubere, lesbare Bilder** exportiert.
- [ ] Mindestens **ein kompletter Durchlauf** als Team mit Zeitstoppen.
- [ ] Übergänge zwischen den Sprechern geprobt.

## Technik-Checkliste für die Live-Demo (kritisch!)

- [ ] Demo-Rechner: `docker compose --profile dev up` **vorab einmal komplett durchgespielt**.
- [ ] Container-Start dauert — **vor** dem Präsentationsbeginn hochfahren, nicht live warten lassen.
- [ ] Dummy-Daten geladen (Profil `dev`), Test-User + Admin-Login **bekannt und notiert**.
- [ ] Beide Portale erreichbar geprüft: User `localhost:8080`, Admin `localhost:8081`.
- [ ] **Plan B:** Screenshots/Kurzvideo des Demo-Pfads in der Hinterhand, falls live etwas hakt.
- [ ] Browser-Zoom/Schriftgröße so, dass es im Beamer lesbar ist.

---

> **So benutzt ihr diese Vorlage:** Von oben nach unten durchgehen, euren Abschnitt nehmen,
> Folien dazu bauen, Inhalte aus dem Material-Fundus ziehen, Zeit einhalten. Fragen zum
> Aufbau → bei Bekirtaha melden.
