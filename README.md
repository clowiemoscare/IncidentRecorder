# IncidentRecorder

IncidentRecorder is a local-first surveillance incident management dashboard. The interface is implemented from the SecureWatch Figma design while keeping the repository's lightweight static HTML/CSS/JavaScript architecture.

## What is included

- Dark SecureWatch dashboard shell with collapsible navigation.
- Dashboard metrics and responsive canvas charts.
- Incident management table with severity/status/search filters.
- Incident detail dialog with local status updates.
- **Add New Incident** recorder that cleans rough notes, generates a structured ticket, copies/downloads the result, and saves the incident in `localStorage`.
- Video evidence upload UI with local metadata simulation and playback detail dialog.
- Analytics view with trend, category, resolution-time, and location charts.
- Settings view with local profile preferences and JSON export.
- Responsive mobile navigation and layouts.
- Migration support for older IncidentRecorder browser drafts stored under the previous local-storage keys.

## Privacy

This version remains a static browser application. Incident records, settings, and simulated upload metadata are stored in the current browser's `localStorage`. No incident text or uploaded video bytes are sent to a backend by this repository.

The Lucide icon library is loaded from its pinned CDN build for the interface icons. If the icon CDN is unavailable, the application functionality still loads; only icons may be absent until the CDN becomes reachable.

## Run locally

Open `index.html` in a modern browser. For the most browser-consistent behavior, you can also serve the folder locally:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy to GitHub Pages

This project is static, so the repository root can be deployed directly with GitHub Pages. If you already have a Pages workflow in your GitHub repository, keep using it with these updated root files.

## Main files

```text
index.html   Application shell and all five views
styles.css   Figma-inspired responsive visual system
app.js       Navigation, local data, ticket generation, uploads, dialogs, and charts
```
