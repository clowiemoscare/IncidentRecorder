# IncidentRecorder v2.1

IncidentRecorder is a focused support-call documentation tool that runs as a static GitHub Pages site.

## Runtime architecture

1. The Recorder can transcribe with **Deepgram Nova-3** or **Browser speech (no Deepgram)**. Auto mode keeps the original fallback behavior.
2. Final transcript segments are appended to Rough Notes. Rough Notes are never rewritten by ticket generation.
3. When Generate is clicked, the browser sends the completed Rough Notes to the Cloudflare Worker when a Worker endpoint is configured.
4. Cloudflare Workers AI returns structured issue/troubleshooting/resolution data.
5. IncidentRecorder applies deterministic local ticket templates based on Category/Subcategory and builds the final ticket.
6. If Workers AI is unavailable, the local action analyzer is used automatically.

Permanent Deepgram credentials are never stored in GitHub or browser JavaScript. In Browser speech mode, the Recorder does not request a Deepgram token or open a Deepgram transcription connection.

## v2.1 routing and templates

- Category and Subcategory are explicit required routing fields for Generate and Reset Template.
- Reset Template asks whether to restore the full **Standard** or full **KeepStock Gen2** master template.
- Verify extracted details only shows fields used by the selected Category.
- `Keepstock - Onsite` and `Keepstock Canada - Onsite` use identity fields only.
- `Keepstock - Seaga / CM` uses identity + machine fields.
- `Keepstock - GCOM App` uses identity + phone/application fields.
- `Keepstock - CM - PC/Data` and `Keepstock - Seaga - PC/Data` use identity + machine + Cradlepoint/network + badge reader fields.
- Added `Keepstock Gen2 - Onsite Mobile App`.
- Added `Keepstock Gen2 - Web Customer`.
- Added `Keepstock Gen2 - GVEND 3`.
- Gen2 generated templates insert AI-derived Issue, Troubleshooting, and Resolution into the Gen2 closing section while leaving Root Cause, Issue Type, and data-change reason under user control.

## Project structure

- `index.html` - focused Recorder / History / Settings shell.
- `deepgram.js` - Nova-3 streaming integration.
- `styles/` - base, recorder, and settings styles.
- `src/config/ticket-routing.js` - stable routing IDs, labels, template mapping, Verify-field mapping, and legacy route migration.
- `src/state/storage.js` - versioned browser settings/drafts/history with quota handling and migration.
- `src/recorder/voice.js` - Deepgram, explicit browser-speech mode, and automatic fallback orchestration.
- `src/ticket/extractor.js` - pure field extraction from Rough Notes, including Standard and Gen2 fields.
- `src/ticket/local-analyzer.js` - local high-recall fallback analysis.
- `src/ticket/templates.js` - deterministic Standard and Gen2 Detailed Description templates.
- `src/ticket/ai-client.js` - Cloudflare `/analyze` client.
- `src/ticket/generator.js` - pure ticket generation with no DOM access.
- `src/ui/app.js` - browser UI orchestration only.
- `tests/` - regression tests built from real support-call scenarios and UI contracts.
- `cloudflare/worker.mjs` - Deepgram temporary tokens + Workers AI analysis.

## Tests

Requires Node.js 20+.

```bash
npm test
```

The v2.1 regression suite covers legacy workflows plus category/template routing, Gen2 templates, dynamic Verify fields, required routing, Rough Notes sizing, and explicit Browser speech mode that bypasses Deepgram.

## Browser data

v2.1 continues using the v2 versioned local-storage keys, so current v2 settings, drafts, and history remain compatible. The new transcription-provider preference defaults to Auto when it does not already exist.
