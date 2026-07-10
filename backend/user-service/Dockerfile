# Basis-Image: schlankes Node.js auf Alpine-Linux (klein & schnell)
FROM node:20-alpine

# Arbeitsverzeichnis im Container
WORKDIR /app

# Zuerst nur die package-Dateien kopieren — so nutzt Docker den Layer-Cache:
# npm ci läuft nur neu, wenn sich die Abhängigkeiten ändern, nicht bei jeder Code-Änderung.
COPY package*.json ./

# Nur Produktions-Abhängigkeiten installieren (keine devDependencies).
# npm ci ist deterministisch: installiert exakt die in package-lock.json festgelegten
# Versionen und verändert die Lockfile nicht -> reproduzierbare Images.
RUN npm ci --omit=dev

# Restlichen Quellcode kopieren
COPY . .

# Service lauscht intern auf Port 3005 (nur Dokumentation/Hinweis)
EXPOSE 3005

# Startbefehl — entspricht "npm start" => node src/index.js
CMD ["npm", "start"]
