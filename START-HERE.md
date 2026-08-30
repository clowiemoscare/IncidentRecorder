# IncidentRecorder v2.4 deployment

## GitHub Pages

Replace the current IncidentRecorder frontend with these items while preserving folders:

- `index.html`
- `deepgram.js`
- `styles/`
- `src/`

Keeping `package.json` and `tests/` in GitHub is recommended so future changes can run the regression suite.

There is no build step. GitHub Pages serves the ES modules directly.

## Cloudflare — required for v2.4

**v2.4 requires the updated Worker** because the structured AI response now includes `root_cause`.

Open the existing `incident-recorder-deepgram` Worker, replace its code with `cloudflare/worker.mjs`, and deploy.

Keep the existing configuration:

- Secret: `DEEPGRAM_API_KEY`
- Variable: `ALLOWED_ORIGIN` = exact GitHub Pages origin
- Workers AI binding: `AI`

No change is required to the Worker URL stored in IncidentRecorder.

## v2.4 behavior

Gen2 Short Descriptions use only:

- `Onsite App: <issue>`
- `GVEND3: <issue>`
- `KS WEB Customer: <issue>`
- `Workstation: <issue>`

Workers AI generates a possible Gen2 Root Cause from documented troubleshooting and resolution evidence in the same analysis request. Manual Root Cause values are never overwritten.

Standard ticket behavior is unchanged.

## Validation

Run:

```bash
npm test
```
