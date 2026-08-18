# IncidentRecorder - Deepgram build

This build keeps the existing static IncidentRecorder ticket workflow and replaces
the primary voice transcription path with **Deepgram Nova-3**. The existing browser
speech recognizer remains available as a fallback when Deepgram is not configured.

## Files to upload to the GitHub repository root

- `index.html`
- `styles.css`
- `app.js`
- `deepgram.js`
- `README.md`

You may also keep the `deepgram-worker` folder in the repository for deployment
instructions. It contains no API key.

## Important: never put the Deepgram API key in GitHub

A public GitHub Pages site cannot safely contain a permanent API key. This project
therefore includes a small Cloudflare Worker in `deepgram-worker/`.

The Worker stores the permanent key as a Cloudflare secret and returns a temporary
Deepgram access token to the browser. See `deepgram-worker/README.md` for setup.

After the Worker is deployed:

1. Open IncidentRecorder.
2. Go to **Settings > Deepgram Voice Transcription**.
3. Paste the Worker URL ending in `/token`.
4. Click **Save Endpoint**.
5. Click **Test Connection**.
6. Open New Incident and click **Start voice notes**.

## Voice behavior

- Deepgram Nova-3 is the primary transcription provider when the token endpoint is configured.
- Domain keyterms are sent for KeepStock/Grainger terminology.
- Interim text is shown while you speak; final text is appended to Rough Notes.
- Rough Notes are never rewritten by the voice layer.
- The Deepgram connection automatically reconnects until **Stop** is clicked.
- A fresh temporary token is requested for a reconnect.
- The microphone is released on Pause/Stop.
- If Deepgram is not configured, the existing browser SpeechRecognition fallback is used.

## Ticket rules retained

- Ticket generation still uses the refined IncidentRecorder rules; Deepgram improves the transcript, not the business-rule template.
- Unknown values stay blank.
- Manually entered details are preserved.
- Leading zeros in account numbers/IDs are preserved when entered or recognized.
- Issue remains the selected Subcategory.
- Rough Notes remain intact after generating a ticket.
- For `Keepstock - Onsite` and `Keepstock Canada - Onsite`, Detailed Description contains only:

```text
Crib/Program id:
Program name:
Company name:
Site ID (If Applicable):
Acct #:
```

## Privacy

While voice notes are active, microphone audio is sent to Deepgram for transcription.
Rough Notes, generated tickets, drafts, and saved incidents remain in browser storage
unless you explicitly export or copy them.

## Hosting

Use GitHub Pages or another HTTPS host. Microphone access is not reliable from a
`file://` URL. Current Chrome or Edge is recommended.
