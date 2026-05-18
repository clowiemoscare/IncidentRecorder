#!/usr/bin/env bash
set -euo pipefail

OWNER="${GITHUB_OWNER:-your-github-username}"
REPO_NAME="${1:-your-repo-name}"
VISIBILITY="${VISIBILITY:-public}"

if [ "$OWNER" = "your-github-username" ] || [ "$REPO_NAME" = "your-repo-name" ]; then
  echo "Usage: GITHUB_OWNER=your-github-username ./deploy-to-github.sh your-repo-name" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it from https://cli.github.com/ and run this script again." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  gh auth login
fi

if [ ! -d .git ]; then
  git init -b main 2>/dev/null || {
    git init
    git checkout -B main
  }
else
  git checkout -B main
fi

git add .
if git diff --cached --quiet; then
  echo "No file changes to commit."
else
  git commit -m "Initial IncidentRecorder web app"
fi

if gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  echo "Repository already exists: $OWNER/$REPO_NAME"
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "https://github.com/$OWNER/$REPO_NAME.git"
  else
    git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"
  fi
  git push -u origin main
else
  if [ "$VISIBILITY" = "private" ]; then
    gh repo create "$OWNER/$REPO_NAME" --private --source=. --remote=origin --push
  else
    gh repo create "$OWNER/$REPO_NAME" --public --source=. --remote=origin --push
  fi
fi

# Enable GitHub Pages with GitHub Actions as the build source.
# If Pages is already enabled, the POST may fail; the PUT updates it instead.
gh api --method POST "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1 || \
  gh api --method PUT "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1 || true

# Start the Pages workflow in case the first push happened before Pages was enabled.
gh workflow run pages.yml --repo "$OWNER/$REPO_NAME" >/dev/null 2>&1 || true

echo "Repository: https://github.com/$OWNER/$REPO_NAME"
echo "GitHub Pages: https://$OWNER.github.io/$REPO_NAME/"
echo "Check deployment status: https://github.com/$OWNER/$REPO_NAME/actions"
