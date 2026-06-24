# Bekannte Probleme (Umgebung & Infrastruktur)

Diese Datei sammelt **bekannte Probleme, die beim Betrieb des Projekts auftreten können,
aber nicht durch unseren eigenen Code verursacht werden.** Es geht hier also nicht um Bugs
in unseren Services, sondern um Stolpersteine aus der Umgebung — Betriebssystem, Docker,
Netzwerk, Ports usw.

Der Zweck ist einfach: Wenn ein Teammitglied auf eines dieser Probleme stößt, soll es hier
**Ursache und Lösung** finden, statt erneut lange zu suchen. Bitte neue Einträge im gleichen
Stil ergänzen (Symptom → Ursache → Lösung → optional Hinweise).

---

## 1. pgAdmin startet nicht — Port 5050 ist plötzlich blockiert (Windows)

**Symptom**

`docker compose --profile dev up pgadmin` schlägt fehl mit einer Meldung wie:

```
Error response from daemon: ports are not available:
exposing port TCP 0.0.0.0:5050 -> 127.0.0.1:0:
bind: An attempt was made to access a socket in a way forbidden by its access permissions.
```

Auffällig: pgAdmin lief auf Port `5050` zuvor problemlos, und es läuft **kein** anderes
Programm auf diesem Port. Trotzdem verweigert Windows die Bindung.

**Ursache**

Schuld ist **WinNAT** (Windows NAT Driver) — der Windows-Dienst, über den der Netzwerk-
verkehr von Containern und VMs nach außen übersetzt wird (Network Address Translation).
Docker Desktop nutzt unter der Haube WSL2/Hyper-V, deren Netzwerk über WinNAT läuft.

WinNAT **reserviert sich beim Start dynamische Port-Bereiche** für diese Übersetzung. Diese
Bereiche sind **nicht stabil**: Nach einem Windows-Neustart, einem Windows-Update oder einem
Docker-Update können sie sich verschieben und dabei zufällig auch Port `5050` mitreservieren.
Dann ist der Port für unsere Container gesperrt — obwohl ihn niemand „benutzt". Das erklärt,
warum es vorher lief und jetzt unvermittelt nicht mehr.

**Prüfen, ob das die Ursache ist**

In PowerShell die reservierten Bereiche anzeigen:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

Liegt `5050` innerhalb einer der gelisteten Ranges, ist es genau dieses Problem.

**Lösung (empfohlen): WinNAT neu starten**

PowerShell **als Administrator** öffnen und ausführen:

```powershell
net stop winnat
net start winnat
```

Dabei würfelt Windows die reservierten Bereiche neu aus und gibt `5050` in der Regel wieder
frei. Die Container-/WSL-Netzwerkverbindung wird kurz unterbrochen, kommt aber sofort zurück.
Anschließend pgAdmin nachstarten:

```bash
docker compose -f rezeptshop/docker-compose.yml --profile dev up pgadmin -d
```

**Hinweise**

- Der Eingriff ist auf einem Entwickler-Rechner unbedenklich und ist der gängige Standard-Fix.
- Einziger Haken: Das Problem **kann nach einem erneuten Neustart wiederkehren**, weil WinNAT
  die Bereiche erneut neu vergibt. Tritt es wiederholt auf, kann man pgAdmin alternativ
  dauerhaft auf einen Port außerhalb des kritischen Bereichs legen (z. B. `5051:80` in der
  `docker-compose.yml`) — das ist Komfort, keine Notwendigkeit.
- Wichtig zur Einordnung: Das ist **kein Fehler in unserem `docker-compose.yml`** und auch
  nicht in einem Service, sondern ein bekanntes Verhalten von Windows/Docker.
