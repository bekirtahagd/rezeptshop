# Unser Git-Workflow: So arbeiten wir zusammen

Um zu verhindern, dass wir uns gegenseitig den Code überschreiben oder das Projekt unabsichtlich kaputtmachen, arbeiten wir nach dem **Feature-Branch-Prinzip**. 

**Die wichtigste Grundregel:** Es wird **NIEMALS** direkt auf dem `main`-Branch programmiert! Der `main`-Branch enthält immer nur funktionierenden, getesteten Code.

Wenn du an einer neuen Aufgabe oder einem Feature arbeitest, gehst du bitte immer genau nach diesen 5 Schritten vor:

## Schritt 1: Den aktuellsten Stand holen
Bevor du anfängst zu programmieren, sorge dafür, dass dein lokaler PC auf dem neuesten Stand ist. Wechsle in den Hauptbranch und lade die neuesten Änderungen herunter. Gib dazu folgende Befehle in deine Konsole ein:

```bash
git switch main
git pull origin main
```

## Schritt 2: Einen eigenen Branch (Zweig) erstellen
Jetzt erstellst du dir deine eigene Arbeitskopie für dein Feature. Benenne den Branch am besten so, dass jeder sofort weiß, woran du arbeitest (z. B. `feature/login-seite` oder `feature/warenkorb-logik`):

```bash
git switch -c feature/dein-feature-name
```
*(Tipp: Der Zusatz `-c` steht für "create", erstellt den Branch neu und wechselt direkt hinein.)*

## Schritt 3: Programmieren und speichern (Committen)
Jetzt kannst du in Ruhe an deinem Code arbeiten. Dein Branch ist komplett von den anderen isoliert. Speichere deine Fortschritte regelmäßig ab:

```bash
git add .
git commit -m "Kurze Beschreibung, was du gemacht hast"
```

## Schritt 4: Deinen Branch hochladen
Wenn dein Feature fertig ist (oder du deinen Zwischenstand auf GitHub sichern möchtest), lädst du deinen Branch hoch. Da es diesen Branch bisher nur auf deinem PC gibt, lautet der Befehl beim ersten Mal so:

```bash
git push -u origin feature/dein-feature-name
```
*(Wenn du danach an demselben Feature weiterarbeitest und weitere Commits machst, reicht in Zukunft ein einfaches `git push`).*

## Schritt 5: Das Feature zusammenführen (Mergen)
Dein Feature ist fertig und funktioniert? Super! Jetzt muss es zurück in den `main`-Branch. **Bitte mergt nicht selbst lokal über die Konsole!** Das führt oft zu Problemen.

1. Gehe stattdessen auf unsere **GitHub-Seite** im Browser.
2. Dort siehst du meistens schon einen grünen Button: **"Compare & pull request"**. Klick darauf.
3. Erstelle den Pull Request. Das ist quasi eine Anfrage: *"Darf ich meinen Code in den Hauptzweig integrieren?"*
4. Wenn es keine Konflikte gibt (GitHub zeigt das in Grün an), klicke auf **"Merge pull request"**.
5. Geschafft! Dein Code ist nun offiziell im Projekt. Du kannst danach auf deinem PC wieder bei *Schritt 1* anfangen, um das nächste Feature zu bauen.