# IncidentRecorder - Local AI build

This build keeps the existing static HTML/CSS/JavaScript IncidentRecorder and adds an optional **free local AI ticket generator** using WebLLM.

## Files to upload to GitHub

Upload these files to the root of the repository:

- `index.html`
- `styles.css`
- `app.js`
- `ai.js`
- `README.md`

## Local AI behavior

- Local AI is optional and is enabled from the New Incident screen.
- The selected WebLLM model runs inside the browser with WebGPU.
- No OpenAI/Deepgram/API key is required.
- Rough call notes are processed locally by the model after it is downloaded.
- The first AI use downloads the selected model and the browser caches the model files.
- **Fast model:** Llama 3.2 1B.
- **More accurate model:** Llama 3.2 3B.
- If WebGPU/model loading/AI generation fails, the existing rule-based generator is used automatically.

The AI is instructed that the microphone contains **only Chloe's side of the support call**. It should document every meaningful check, finding, instruction, diagnosis, training step, and retest instruction in chronological order while removing greetings and filler.

## Ticket rules retained

- Manual fields are never overwritten by AI suggestions.
- Unknown fields remain blank.
- Leading zeros in exact IDs/account numbers are preserved when possible.
- The selected Subcategory remains the Issue value in Work Notes.
- `Keepstock - Onsite` and `Keepstock Canada - Onsite` Detailed Description contains only:

```text
Crib/Program id:
Program name:
Company name:
Site ID (If Applicable):
Acct #:
```

- Rough Notes remain intact when generating a ticket.
- Voice recognition continues/reconnects until Stop is clicked, except for fatal browser microphone permission/device errors.

## Hosting

Use GitHub Pages or another HTTPS host. Voice microphone access and WebGPU/browser model loading are not reliable from a `file://` URL.

Recommended browser: current Chrome or Edge with WebGPU enabled.
