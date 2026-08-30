# IncidentRecorder v2.4

IncidentRecorder is a focused support-call documentation tool that runs as a static GitHub Pages site.

## v2.4 Gen2 Short Description + AI Root Cause

Gen2 Short Descriptions use only the operational system prefix plus the issue:

- Keepstock Gen2 - Onsite Mobile App -> `Onsite App: <issue>`
- Keepstock Gen2 - GVEND 3 -> `GVEND3: <issue>`
- Keepstock Gen2 - Web Customer -> `KS WEB Customer: <issue>`
- Keepstock Gen2 - Workstation -> `Workstation: <issue>`

The Short Description generator defensively removes leading `Keepstock Gen2`, full Gen2 category labels, and duplicate system prefixes if Workers AI includes them in `issue_summary`.

### Gen2 Root Cause

Workers AI now returns `root_cause` in the same structured `/analyze` response. For Gen2 tickets it is instructed to infer one concise possible root cause from the documented troubleshooting findings and completed resolution only.

Safety rules:

- Category/Subcategory alone are not evidence for a root cause.
- The model must not invent an error, component failure, configuration state, or customer action.
- When the evidence supports only an inference, the model qualifies it with `Likely`.
- If the evidence is insufficient, Root Cause remains blank.
- A Root Cause manually entered by the user always takes precedence over the AI suggestion.

The AI suggestion is copied into the visible Gen2 Root Cause verification field only when that field is blank. It is then used consistently in Gen2 Work Notes and the Gen2 Detailed Description closing section.

## Gen2 Work Notes

Gen2 Work Notes remain:

```text
Issue:
Troubleshooting:
Resolution:
Root Cause:
Issue Type: (Data Load Failure, Data Maintenance, Knowledge Gap, System, Hardware)
Why are we making changes to the data:
```

Standard ticket Short Description and Work Notes behavior is unchanged.

## Runtime architecture

1. The user explicitly selects Browser speech or Deepgram Nova-3 before recording.
2. Voice transcription appends the support representative's spoken notes to Rough Notes.
3. The browser checks Cloudflare AI readiness before Generate.
4. If configured, Rough Notes are sent to the Cloudflare Worker `/analyze` endpoint.
5. Workers AI returns structured issue, troubleshooting, resolution, conditional-next-step, account, and possible Gen2 root-cause data.
6. IncidentRecorder applies deterministic category/template rules and builds the final ticket.
7. If Workers AI is unavailable and the user confirms, the local analyzer is used. The local fallback does not invent a Root Cause.

Permanent Deepgram credentials are never stored in GitHub or browser JavaScript.

## Project structure

- `index.html` - Recorder / History / Settings shell.
- `deepgram.js` - Deepgram Nova-3 streaming integration.
- `styles/` - shared and recorder styles.
- `src/config/ticket-routing.js` - stable routing IDs, labels, template mapping, Gen2 prefixes, and legacy migration.
- `src/state/storage.js` - versioned browser settings/drafts/history.
- `src/recorder/voice.js` - explicit Deepgram or browser-speech orchestration.
- `src/ticket/extractor.js` - pure field extraction.
- `src/ticket/local-analyzer.js` - local fallback analysis.
- `src/ticket/templates.js` - deterministic Detailed Description templates.
- `src/ticket/ai-client.js` - Cloudflare `/health` and `/analyze` client + structured analysis normalization.
- `src/ticket/generator.js` - pure Standard/Gen2 Short Description and Work Notes generation.
- `src/ui/app.js` - browser UI orchestration.
- `tests/` - regression tests built from real support-call scenarios.
- `cloudflare/worker.mjs` - Deepgram temporary tokens + Workers AI structured analysis.

## Tests

Requires Node.js 20+.

```bash
npm test
```

v2.4 passes the regression suite covering Gen2 prefix cleanup, AI Root Cause flow/manual precedence, Standard ticket preservation, routing, transcription selection, Cloudflare AI readiness, templates, extraction, and prior support-call scenarios.

## Browser data

v2.4 keeps the existing v2 storage keys. Existing v2/v2.1/v2.2/v2.3 settings, drafts, and history remain compatible.
