# IncidentRecorder

IncidentRecorder is a simple browser-based app that helps turn rough support-call notes into a cleaner incident ticket draft.

## Current version

This is the first static web app version. It runs fully in the browser and does not require a backend server.

## Features

- Capture caller details, callback number, department/location, device/asset, application/service, category, priority, and status.
- Type rough live call notes while working the issue.
- Generate a structured ticket draft with issue, impact, troubleshooting performed, findings, resolution, and next steps.
- Edit the generated ticket before copying or downloading it.
- Save and reload drafts from the browser's local storage.
- Delete saved drafts from the browser.

## Privacy note

This version does not upload call notes anywhere. Drafts are stored only in the current browser's `localStorage`. Because incident notes can contain names, phone numbers, device names, or internal system information, review your company's data handling and call recording policies before adding cloud storage, AI generation, or audio transcription.

## Run locally

Open `index.html` in a modern browser.

## Deploy to GitHub Pages

This repository includes `.github/workflows/pages.yml`, which deploys the static site using GitHub Actions.

Expected production URL after deployment:

```text
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME/
```

### Option 1: one-command deploy with GitHub CLI

From the `IncidentRecorder/` project folder:

```bash
GITHUB_OWNER=your-github-username ./deploy-to-github.sh your-repo-name
```

The script will:

1. Create or reuse `your-github-username/your-repo-name`.
2. Commit the app files.
3. Push to the `main` branch.
4. Enable GitHub Pages with GitHub Actions as the source.
5. Trigger the Pages workflow.

### Option 2: manual deploy commands

```bash
gh auth login
git init -b main
git add .
git commit -m "Initial IncidentRecorder web app"
gh repo create your-github-username/your-repo-name --public --source=. --remote=origin --push
gh api --method POST repos/your-github-username/your-repo-name/pages -f build_type=workflow || gh api --method PUT repos/your-github-username/your-repo-name/pages -f build_type=workflow
gh workflow run pages.yml --repo your-github-username/your-repo-name
```

Then check:

```text
https://github.com/your-github-username/your-repo-name/actions
```

## Files

```text
index.html
styles.css
app.js
.github/workflows/pages.yml
.nojekyll
README.md
deploy-to-github.sh
```

## Suggested next version

- Add an AI backend to generate better tickets from messy notes.
- Add issue-specific templates.
- Add call duration tracking.
- Add export formats for ServiceNow, Jira, or another ticketing system.
- Add audio transcription only after confirming company recording and privacy requirements.
