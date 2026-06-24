# Archiv: alte auth-service-Tests (vor dem re-runnable-Umbau)

Diese 16 `.bru`-Dateien sind die **ursprüngliche, einfachere Version** der auth-service-Tests,
gesichert „für den Fall der Fälle". Sie verwenden statische Seed-Tokens und feste E-Mails.

**Unterschied zur aktuellen Version** (eine Ebene höher in `bruno/auth-service/`):
- `register-01` nutzt hier die feste Adresse `neu@test.de` → beim 2. Lauf **409** (DB-Reset nötig).
- `confirm-01` nutzt hier den Seed-Token `confirm-verify-valid` → nach einmaligem Bestätigen **400**.
- Es gibt **kein** `confirm-00` (das in der neuen Version den frischen Token aus Mailpit zieht).

Die neue Version ist beliebig oft ohne `docker compose down -v` wiederholbar.

## Hinweis zu Bruno
Bruno scannt Unterordner mit. Dieser `old`-Ordner taucht daher als eigener Unterordner in der
Kollektion auf. Ein normaler **„Run"** auf `auth-service` führt ihn **nicht** mit aus — nur ein
**„Recursive Run"** würde auch diese alten Tests starten. Zum reinen Archivieren kann der Ordner
ignoriert werden; wer ihn ganz aus Bruno fernhalten will, kann ihn in `bruno.json` unter `ignore`
eintragen oder außerhalb der Kollektion ablegen.
