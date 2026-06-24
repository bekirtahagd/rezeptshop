# Basis-Image: schlankes Node.js auf Alpine-Linux (klein & schnell)
FROM node:20-alpine

# Arbeitsverzeichnis im Container
WORKDIR /app

# Zuerst nur die package-Dateien kopieren — so nutzt Docker den Layer-Cache:
# npm install läuft nur neu, wenn sich die Abhängigkeiten ändern, nicht bei jeder Code-Änderung.
COPY package*.json ./

# Nur Produktions-Abhängigkeiten installieren (keine devDependencies)
RUN npm install --omit=dev

# Restlichen Quellcode kopieren
COPY . .

# Service lauscht intern auf Port 3001 (nur Dokumentation/Hinweis)
EXPOSE 3001

# Startbefehl — entspricht "npm start" => node src/index.js
CMD ["npm", "start"]
