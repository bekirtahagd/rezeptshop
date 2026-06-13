**Das Dokument ist nur für den Anfang. Das wird mit der Zeit noch komplett überarbeitet**

# Lokales Projekt-Setup für das Team

Da wir den extrem großen `node_modules`-Ordner über die `.gitignore` von GitHub ausgeschlossen haben, müsst ihr nach dem ersten Herunterladen des Projekts (oder wenn jemand neue Pakete hinzugefügt hat) die Abhängigkeiten auf eurem eigenen PC installieren. 

Die Konfigurationsdateien (`package.json`) sind bereits für alle Services vorhanden. Ihr müsst sie nur noch ausführen.

## Der schnelle Weg (Für Windows / PowerShell)
Anstatt in jeden der fünf Backend-Ordner einzeln zu navigieren, öffnet ihr einfach ein PowerShell-Terminal direkt in unserem Hauptordner (`rezeptshop-webengineering`) und kopiert diesen Block hinein:

```powershell
Get-ChildItem -Path "backend" -Directory | ForEach-Object {
    Push-Location $_.FullName
    Write-Host "Installiere Node-Pakete in: $($_.Name)" -ForegroundColor Green
    npm install
    Pop-Location
}
```
*Dieses Skript geht automatisch in jeden Backend-Service, führt `npm install` aus und springt wieder zurück. Danach seid ihr sofort startklar!*

## Der manuelle Weg (Für Git Bash / Mac / Linux)
Falls das Skript bei euch nicht funktioniert oder ihr kein Windows nutzt, müsst ihr die Installation manuell für jeden Service durchführen. 

Öffnet das Terminal im Hauptordner und tippt nacheinander:

```bash
cd backend/auth-service && npm install && cd ../..
cd backend/authorization-service && npm install && cd ../..
cd backend/inventory-service && npm install && cd ../..
cd backend/wishlist-service && npm install && cd ../..
cd backend/user-service && npm install && cd ../..
```

## Wie geht es danach weiter?
Sobald die `node_modules`-Ordner auf eurem PC generiert wurden, könnt ihr in den jeweiligen Service-Ordner wechseln und euren Code schreiben.