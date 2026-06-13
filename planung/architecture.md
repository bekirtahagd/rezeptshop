# Architektur-Übersicht: Microservices & Tech-Stack

## Was sind Microservices?
Anstatt unsere gesamte Anwendung in einem einzigen, riesigen Code-Block (einem sogenannten "Monolithen") zu schreiben, teilen wir sie in **viele kleine, unabhängige Programme** auf – die Microservices. 

* **Der Vorteil:** Jeder Service ist nur für eine einzige, spezifische Aufgabe zuständig (z. B. kümmert sich der Auth-Service nur um Logins, der Wunschlisten-Service nur um Listen). 
* **Ausfallsicherheit:** Wenn ein Service abstürzt oder aktualisiert wird, laufen die anderen ungestört weiter. 
* **Kommunikation:** Da sie getrennt sind, sprechen sie über das Netzwerk (REST-APIs) miteinander, indem sie sich gegenseitig JSON-Datenpäckchen schicken.

---

## Unser Tech-Stack (Wie wir das bauen)

### 1. Frontend (Die Oberfläche)
* **Technologie:** Pures HTML, CSS und Vanilla JavaScript. Es sind **keine** Frameworks (wie React, Vue oder Angular) erlaubt.
* **Aufbau:** Wir bauen zwei völlig getrennte Portale – eins für die normalen Endanwender (Shop, Warenkorb) und eins für Admins (User- und Produktverwaltung).

### 2. Backend (Die Logik)
* **Technologie:** Node.js in Kombination mit dem Web-Framework Express.
* **Aufbau:** 5 unabhängige Webservices. Jeder Service läuft in seinem eigenen Ordner, hat einen eigenen Port und verwaltet seine eigenen Abhängigkeiten (`package.json`).

### 3. Infrastruktur & Betrieb
* **Versionskontrolle:** GitHub (Wir arbeiten streng nach dem Feature-Branch-Prinzip).
* **Containerisierung:** **Docker**. Jeder Service und jedes Frontend wird am Ende in einen eigenen, isolierten Container (einen Mini-Computer) verpackt.
* **Orchestrierung:** **Docker Compose**. Der Dirigent, der dafür sorgt, dass wir später alle 7 Container (2x Frontend, 5x Backend) mit nur einem einzigen Befehl gleichzeitig starten und miteinander vernetzen können.