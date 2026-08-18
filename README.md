# IncidentRecorder - Deepgram + Cloudflare Workers AI

This build uses **Deepgram Nova-3** for live voice transcription and **Cloudflare Workers AI** for understanding the completed Rough Notes when you click **Generate clean ticket**.

The AI does not control the ServiceNow template. IncidentRecorder still owns Category/Subcategory, Detailed Description formatting, manual fields, drafts, and the special Onsite five-field template.

## Files to upload to the GitHub repository root

- `index.html`
- `styles.css`
- `app.js`
- `deepgram.js`
- `README.md`

The `deepgram-worker` folder contains the updated Cloudflare Worker and setup instructions. It contains no API keys.

## What happens during a call

```text
Microphone
   -> Deepgram Nova-3
   -> complete Rough Notes
   -> Generate clean ticket
   -> Cloudflare Workers AI
   -> structured issue / troubleshooting / resolution analysis
   -> IncidentRecorder ServiceNow formatting
```

### AI documentation rules

Workers AI is instructed that only Chloe's support-agent voice is recorded. It must:

- scan the entire Rough Notes transcript;
- keep every meaningful check, finding, lookup, instruction, configuration change, restart/reset, test, retest, training step, and verification in chronological order;
- remove greetings, filler, holds, repetition, and closings;
- never invent caller responses or actions;
- keep conditional future guidance separate from actions actually completed;
- never use an `if it still...` fallback as the resolution unless the notes later confirm it happened;
- produce a resolution tied to the actual fix or training outcome;
- return an empty resolution if the call does not confirm an outcome.

IncidentRecorder uses Cloudflare's structured JSON response rather than asking the model to write the final ticket free-form.

## Fallback behavior

If Workers AI cannot be reached, the AI binding is missing, the daily free allocation is exhausted, or the model returns an error, **Generate clean ticket still works**. The app automatically uses the local high-recall troubleshooting action ledger instead.

Rough Notes are never rewritten by either generator.

## Cloudflare setup change required

If Deepgram is already working, keep your existing Worker URL and Deepgram secret. You only need to:

1. replace the Worker code with the new `deepgram-worker/worker.mjs`;
2. add a Workers AI binding named exactly `AI`;
3. redeploy;
4. open IncidentRecorder **Settings > Deepgram + Cloudflare AI** and click **Test Ticket AI**.

See `deepgram-worker/README.md` for the full steps.

## Detailed Description rule retained

For `Keepstock - Onsite` and `Keepstock Canada - Onsite`, Detailed Description remains exactly:

```text
Crib/Program id:
Program name:
Company name:
Site ID (If Applicable):
Acct #:
```

Blank values remain blank and manually entered values are not overwritten by the AI analysis.

## Privacy

- Microphone audio is sent to Deepgram only while voice notes are active.
- Rough Notes are sent to your Cloudflare Worker only when you click Generate (or Test Ticket AI).
- The browser does not contain your permanent Deepgram API key.
- Drafts, manual ticket fields, and saved incident records remain stored in the browser unless you explicitly export/copy them.

## Hosting

Use GitHub Pages or another HTTPS host. Current Chrome or Edge is recommended for microphone access.
