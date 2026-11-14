# Wissens-App – verbindliche Bauanleitung

Diese Datei ist die Grundlage für **alle** künftigen Sitzungen. Vor jeder Änderung lesen.
Bei Änderungen am Konzept oder am Importformat diese Datei mit aktualisieren.

## Zusammenarbeit

- Die Nutzerin programmiert nicht selbst. **Alles in einfachem Deutsch erklären, ohne Fachjargon.**
  Wenn ein Fachbegriff unvermeidbar ist, kurz in Alltagssprache übersetzen.
- Oberfläche der App: **komplett Deutsch**.
- Vor dem Abschluss immer testen (`npm test`, `npm run build`, und im Browser durchklicken).
- Am Ende kurz sagen: was ist fertig, was muss die Nutzerin als Nächstes tun.

## Konzept

Persönliche Wissensdatenbank für eine **Sportwissenschaftlerin**: Anatomie, Physiologie &
Biomechanik, Verletzungen & Reha, Training, Ernährung – immer mit Sportbezug.
**Training ist das Zentrum:** Wissen soll immer zu einer Konsequenz fürs Training führen
(darum gibt es den Baustein „Bedeutung fürs Training“, optisch hervorgehoben).
Nutzung auf Laptop, Handy und Tablet.

### Reiter (oberste Ebene, in dieser Reihenfolge)

Training · Anatomie · Physiologie & Biomechanik · Verletzungen & Reha · Übungen ·
Diagnostik & Tests · Ernährung · Sportarten · Quellen · Notizen

### Unterthemen Training

- Grundlagen
- Motorische Fähigkeiten
  - Kraft · Ausdauer · Schnelligkeit & Power · Beweglichkeit · Koordination & Stabilität
- Planung & Periodisierung
  - Krafttrainingspläne erstellen
- Belastungssteuerung
- Zielgruppen
- Prävention & Athletik
- Sportartspezifisch
- Vorlagen

### Wichtige Regeln

- **Struktur jederzeit änderbar:** Reiter und Unterthemen anlegen, umbenennen, verschieben,
  zusammenlegen, löschen – ohne dass Inhalte oder Links verloren gehen. Es ist ein
  verschiebbarer Baum (Daten), **keine fest programmierten Ordner**. Reiter sind einfach
  Baumknoten ohne Elternknoten.
- Eine Seite kann **mehreren Bereichen** zugeordnet sein.
- **Fester Rahmen einer Seite:** Titel, Zuordnung(en), Markierungen (Sportarten,
  Körperregion, freie Tags), Prüfstatus „Entwurf (KI)“ oder „Geprüft“.
- **Rest der Seite = frei wählbare, verschiebbare Bausteine:** Text, Stichpunkte, Tabelle,
  Abbildung, „Bedeutung fürs Training“, Übungen (Verweise), Tests (Verweise),
  Quellen (mit Stand), eigene Notizen.
- **Interne Links** zwischen Seiten; Sportart- bzw. Markierungsansichten zeigen automatisch
  alle zugehörigen Seiten.
- **Reiter „Notizen“** = schnelle Ideen-/Themenliste: Idee mit einem Klick erfassen (💡 oben
  rechts), später abhaken und mit der daraus entstandenen Seite verknüpfen.
- **Inhaltsverzeichnis** und **schnelle Volltextsuche** über alles.
- **Keine Videos.** Bilder: eigene Uploads oder frei lizenzierte Bilder **mit Quellenangabe**.

### Später (noch nicht bauen, aber vorbereitet)

- Abgleich zwischen Geräten mit Login (Supabase)
- Bild-Upload in die Cloud
- Eingebaute KI über die Claude-Schnittstelle
- Teilen

Darum gilt fürs Datenmodell schon jetzt: **eindeutige IDs** (UUID), **Änderungszeitpunkte**
(`createdAt`, `updatedAt`) und **Löschen nur als Markierung** (`deletedAt`), nie endgültig.

## Etappen

- **Etappe 1 (fertig):** installierbare Web-App (PWA), komplett offline, Daten lokal im
  Browser (IndexedDB). Navigation + bearbeitbarer Baum (Ziehen oder Menü), Seiten mit Rahmen
  und Bausteinen, Markierungen, interne Links, Markierungsansichten, Prüfstatus + Filter
  „nur Entwürfe“, Ideenliste, Volltextsuche, Bilder lokal, Export/Import, Startinhalte.
- **Etappe 2 (geplant):** Supabase-Abgleich mit Login, Bilder in die Cloud.
- **Etappe 3 (geplant):** KI-Funktionen über die Claude-Schnittstelle, Teilen.

## Technik

- React 18 + TypeScript + Vite 5, PWA über `vite-plugin-pwa` (Offline-Zwischenspeicher)
- Datenbank im Browser: IndexedDB über **Dexie** (`src/db.ts`), Live-Aktualisierung mit `dexie-react-hooks`
- Suche: **MiniSearch** (`src/search.ts`), Umlaute/ß werden vereinheitlicht, Tippfehler-tolerant
- Ziehen & Ablegen: **dnd-kit** (Baum und Bausteine; funktioniert auch per Touch)
- Navigation: `HashRouter` (Adressen wie `#/seite/<id>`), damit die App in jedem Unterordner
  und offline läuft; `base: './'` in `vite.config.ts`
- Veröffentlichung: GitHub Pages über `.github/workflows/deploy.yml` (bei jedem Push auf `main`)

### Befehle

```bash
npm install        # einmalig: Bausteine installieren
npm run dev        # Entwicklungsserver starten
npm test           # automatische Tests (Datenlogik, Import/Export)
npm run build      # fertige App nach dist/ bauen
```

### Dateien

| Datei | Inhalt |
|---|---|
| `src/types.ts` | Datenmodell (Knoten, Seite, Bausteine, Idee, Bild) |
| `src/db.ts` | Datenbank, ID- und Zeit-Helfer |
| `src/tree.ts` | Baum: anlegen, umbenennen, verschieben, zusammenlegen, löschen, Pfade |
| `src/pages.ts` | Seiten & Bausteine, Text für Suche, Link-Erkennung |
| `src/seed.ts` | Startinhalte (nur beim allerersten Start) |
| `src/importExport.ts` | Sicherung & Import |
| `src/search.ts` | Volltextsuche |
| `src/images.ts` | Bilder lokal speichern (große Fotos werden auf max. 1600 px verkleinert) |
| `src/components/Tree.tsx` | Themenbaum in der Seitenleiste |
| `src/components/Blocks.tsx` | Anzeige & Bearbeitung der Bausteine |
| `src/components/ui.tsx` | Dialoge, Auswahllisten, Chips, Text mit Links |
| `src/screens/*` | Ansichten (Start, Bereich, Seite, Suche, Notizen, Markierungen, Inhaltsverzeichnis, Sicherung) |
| `src/logic.test.ts` | automatische Tests |

## Datenmodell (Kurzfassung)

Jeder Datensatz hat `id`, `createdAt`, `updatedAt` (Millisekunden), `deletedAt` (`null` = aktiv).

- **TreeNode** (Bereich/Reiter): `title`, `parentId` (`null` = Reiter), `order`,
  optional `special`: `"notes"` (Reiter zeigt Ideenliste) oder `"sports"` (zeigt zusätzlich
  alle Sportarten-Markierungen). Die Sonderfunktion hängt an der ID, nicht am Namen –
  Umbenennen ist also gefahrlos.
- **Page**: `title`, `nodeIds[]` (Zuordnungen), `sports[]`, `bodyRegions[]`, `tags[]`,
  `status` (`"draft"` = Entwurf (KI) | `"reviewed"` = Geprüft), `blocks[]`
- **Idea**: `text`, `done`, `pageId` (verknüpfte Seite oder `null`)
- **ImageRecord**: `name`, `mime`, `blob`, `credit`

Seiten verweisen per **ID** auf Bereiche → Umbenennen/Verschieben bricht nichts.
Löschen eines Bereichs: Unterthemen rutschen eine Ebene höher, Seiten bleiben erhalten.
Gelöschte Seiten liegen im Papierkorb (Ansicht „Sicherung & Daten“) und sind wiederherstellbar.

### Interne Links im Text

- `[[<Seiten-ID>|Titel]]` – so fügt die App Links ein (bleibt gültig, auch wenn die Seite umbenannt wird)
- `[[Titel]]` – einfache Form, z. B. für Seiten aus dem Chat; wird über den Titel gefunden
- Außerdem: `**fett**`, `*kursiv*`, Web-Adressen werden klickbar. Leerzeile = neuer Absatz.

## Importformat (für Sicherungen und für Seiten aus dem Chat)

Import über **„Sicherung & Daten“ → „Datei auswählen“** oder **„Text aus dem Chat einfügen“**.

Regeln:
- Pflicht: `"format": "wissens-app"` und `"version": 1`.
- Es wird **nie etwas gelöscht**. Neue Einträge kommen dazu. Einträge mit gleicher `id` werden
  nur ersetzt, wenn `updatedAt` neuer ist.
- `id`, `createdAt`, `updatedAt` dürfen fehlen (werden dann erzeugt).
- Zuordnung entweder über `nodeIds` (IDs) **oder** einfacher über `areas`: Pfade mit `>` getrennt,
  z. B. `"Training > Motorische Fähigkeiten > Kraft"`. Fehlende Bereiche werden automatisch angelegt.
  Groß-/Kleinschreibung egal.
- `status` fehlt → `"draft"` (Entwurf (KI)). **Von Claude erstellte Seiten immer als `"draft"`.**
- Bei `exercises`/`tests` kann statt `pageId` ein `title` stehen; die Seite wird über den Titel
  gesucht (auch unter den gleichzeitig importierten Seiten).
- `bullets.items` und `sources.items` dürfen auch einfache Textlisten sein.
- Unbekannte Baustein-Typen werden übersprungen (mit Hinweis).

Baustein-Typen: `text`, `bullets`, `table`, `image`, `training`, `exercises`, `tests`, `sources`, `notes`.

### Beispiel: Seiten, die Claude im Chat erstellt

```json
{
  "format": "wissens-app",
  "version": 1,
  "pages": [
    {
      "title": "Nordic Hamstring Curl",
      "areas": ["Übungen", "Training > Prävention & Athletik"],
      "sports": ["Fußball"],
      "bodyRegions": ["Oberschenkel"],
      "tags": ["Prävention", "exzentrisch"],
      "status": "draft",
      "blocks": [
        { "type": "text", "text": "Exzentrische Übung für die **hintere Oberschenkelmuskulatur**. Siehe auch [[Kniebeuge (Back Squat)]]." },
        { "type": "bullets", "items": ["Kniend, Füße fixiert", "Oberkörper langsam nach vorne absenken", "Hüfte bleibt gestreckt"] },
        { "type": "table", "header": true, "rows": [["Phase", "Sätze × Wdh."], ["Woche 1–2", "2 × 5"], ["Woche 3–4", "3 × 6"]] },
        { "type": "training", "text": "1–2× pro Woche, langsam steigern; nicht direkt vor Sprint-Einheiten." },
        { "type": "exercises", "items": [{ "title": "Kniebeuge (Back Squat)", "comment": "ergänzend" }] },
        { "type": "tests", "items": [] },
        { "type": "sources", "items": [{ "text": "Autor:in (Jahr). Titel. Zeitschrift.", "url": "https://doi.org/…", "stand": "2025-03" }] },
        { "type": "notes", "text": "Eigene Erfahrung: …" }
      ]
    }
  ]
}
```

Abbildungen (`image`) aus dem Chat: `{ "type": "image", "imageId": null, "caption": "…", "credit": "…" }`
– das Bild selbst wird danach in der App ausgewählt.

### Vollständige Sicherung

Die Sicherungsdatei hat dasselbe Format und enthält zusätzlich `nodes`, `ideas` und `images`
(Bilder als `dataUrl`), sowie alle Einträge inklusive der als gelöscht markierten:

```json
{
  "format": "wissens-app",
  "version": 1,
  "exportedAt": "2026-11-14T12:00:00.000Z",
  "nodes": [{ "id": "…", "title": "Training", "parentId": null, "order": 0, "createdAt": 0, "updatedAt": 0, "deletedAt": null }],
  "pages": [{ "id": "…", "title": "…", "nodeIds": ["…"], "sports": [], "bodyRegions": [], "tags": [], "status": "draft", "blocks": [], "createdAt": 0, "updatedAt": 0, "deletedAt": null }],
  "ideas": [{ "id": "…", "text": "…", "done": false, "pageId": null, "createdAt": 0, "updatedAt": 0, "deletedAt": null }],
  "images": [{ "id": "…", "name": "foto.jpg", "mime": "image/jpeg", "credit": "eigenes Foto", "dataUrl": "data:image/jpeg;base64,…", "createdAt": 0, "updatedAt": 0, "deletedAt": null }]
}
```
