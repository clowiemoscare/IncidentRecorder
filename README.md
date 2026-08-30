# IncidentRecorder v2.2

IncidentRecorder is a focused support-call documentation tool that runs as a static GitHub Pages site.

## Runtime architecture

1. Before recording, the user must explicitly choose **Browser speech (no Deepgram)** or **Deepgram Nova-3**. There is no Auto transcription mode.
2. Browser speech mode never requests a Deepgram token or opens a Deepgram transcription connection. Deepgram mode never silently switches to browser speech.
3. Final transcript segments are appended to Rough Notes. Rough Notes are never rewritten by ticket generation.
4. Before Generate, IncidentRecorder checks the Cloudflare Worker `/health` route. The UI clearly shows whether Workers AI is ready, missing, or could not be confirmed.
5. If Cloudflare AI is not configured, the user is told that the local fallback analyzer will be used and must confirm before generation continues.
6. Cloudflare Workers AI returns structured issue/troubleshooting/resolution data when available.
7. IncidentRecorder applies deterministic local ticket templates based on Category/Subcategory and builds the final ticket.
8. If Workers AI becomes unavailable during generation, the local action analyzer remains the fallback.

Permanent Deepgram credentials are never stored in GitHub or browser JavaScript.

## v2.2 routing fixes

The Gen2 category/subcategory matrix now matches the supplied category source:

- `Keepstock Gen2 - Onsite Mobile App` - Check-In/Check-Out, Digital Storage Connect, Go-Live Install, OKTA Access/Login, On-Hand Balance, Open Stock, Order Viewer, Organize Shipment, RPO options, Storages, Task Plan, Training, User Management, Other.
- `Keepstock Gen2 - Web Customer` - Access/Log-in, Customer Training, Insights, System, Vend History, Other.
- `Keepstock Gen2 - Workstation` - Access/Login, Billing Group, Item Update, Site Status, Storage Unit, User Management, Other.
- `Keepstock Gen2 - GVEND 3` - the supplied hardware issue categories, Machine Replacement, Physical Damage, Product Sizing, and Other.

The source file's `-- None --` choices are intentionally not added as selectable values because IncidentRecorder requires a real Subcategory. The UI's blank `-- Select Subcategory --` option represents the required/unselected state.

Reset Workspace now clears the current call data but **preserves the current Category and Subcategory**. Transcription selection is cleared so every new recording requires an explicit choice.

## Existing template behavior

- Category and Subcategory are required for Generate and Reset Template.
- Reset Template asks whether to restore the full **Standard** or full **KeepStock Gen2** master template.
- Verify extracted details only shows fields used by the selected Category.
- `Keepstock - Onsite` and `Keepstock Canada - Onsite` use identity fields only.
- `Keepstock - Seaga / CM` uses identity + machine fields.
- `Keepstock - GCOM App` uses identity + phone/application fields.
- `Keepstock - CM - PC/Data` and `Keepstock - Seaga - PC/Data` use identity + machine + Cradlepoint/network + badge reader fields.
- Gen2 generated templates insert AI-derived Issue, Troubleshooting, and Resolution into the Gen2 closing section while leaving Root Cause, Issue Type, and data-change reason under user control.

## Project structure

- `index.html` - focused Recorder / History / Settings shell.
- `deepgram.js` - Nova-3 streaming integration.
- `styles/` - base, recorder, and settings styles.
- `src/config/ticket-routing.js` - stable routing IDs, labels, template mapping, Verify-field mapping, and legacy route migration.
- `src/state/storage.js` - versioned browser settings/drafts/history with quota handling and migration.
- `src/recorder/voice.js` - explicit Deepgram or browser-speech recording orchestration.
- `src/ticket/extractor.js` - pure field extraction from Rough Notes, including Standard and Gen2 fields.
- `src/ticket/local-analyzer.js` - local high-recall fallback analysis.
- `src/ticket/templates.js` - deterministic Standard and Gen2 Detailed Description templates.
- `src/ticket/ai-client.js` - Cloudflare `/analyze` client plus `/health` readiness check.
- `src/ticket/generator.js` - pure ticket generation with no DOM access.
- `src/ui/app.js` - browser UI orchestration only.
- `tests/` - regression tests built from real support-call scenarios and UI contracts.
- `cloudflare/worker.mjs` - Deepgram temporary tokens + Workers AI analysis.

## Tests

Requires Node.js 20+.

```bash
npm test
```

## Browser data

v2.2 continues using the v2 versioned local-storage keys, so current v2/v2.1 settings, drafts, and history remain compatible. Old persisted Auto-transcription preferences are ignored; transcription must be selected for each recording session.

- `docs/Gen2-Categories-source.txt` - source-of-truth category/subcategory list supplied for the Gen2 routing update.
