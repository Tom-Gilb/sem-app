#!/usr/bin/env bash
# backup-code.sh — Create a timestamped ZIP of the full sem-app source on your Desktop.
#
# Usage (from Terminal):
#   bash ~/Developer/sem-app/scripts/backup-code.sh
#
# What it does:
#   1. Runs `git archive HEAD` to capture the last committed state of the repo
#   2. Saves the ZIP to ~/Desktop/sem-app-YYYYMMDD-HHMM.zip
#   3. Prints a confirmation with the file size
#
# Why git archive (not cp -r):
#   - Does NOT include the node_modules directory (would be 300 MB+ of build artefacts)
#   - Does NOT include uncommitted junk (.DS_Store, .env, etc.)
#   - Is fast and repeatable
#
# IMPORTANT: only archives COMMITTED changes. Run `git commit` first if you
# want the very latest uncommitted work included.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd .. && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M)"
OUTFILE="$HOME/Desktop/sem-app-${TIMESTAMP}.zip"

echo "📦  Archiving sem-app source from: $REPO_DIR"
echo "📂  Destination:                   $OUTFILE"
echo ""

cd "$REPO_DIR"
git archive HEAD --format=zip --output="$OUTFILE"

SIZE=$(du -sh "$OUTFILE" | awk '{print $1}')
echo "✅  Done! ZIP saved to Desktop — ${SIZE}"
echo ""
echo "💡  Tip: this archive reflects the last GIT COMMIT."
echo "    Run 'git commit' first if you want your latest work included."
