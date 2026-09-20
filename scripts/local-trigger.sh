#!/bin/bash
# Started by launchd (see install-launchd.sh) at login and every few hours.
# Asks the F1 calendar whether a round has run without its data being on disk
# and, only then, dispatches the "Update race data" workflow to the self-hosted
# runner. Cheap when nothing is due; a failed fetch leaves the round missing, so
# the next check retries it.
set -u
export PATH=/opt/anaconda3/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

REPO="Aayush0987/tenths"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$HOME/.tenths-last-dispatch"
COOLDOWN=$((6 * 3600))   # don't re-dispatch a round that just failed

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

cd "$ROOT" || exit 1

# Bring the local clone up to date so "already on disk" reflects what the
# runner has pushed. Fast-forward only; never touches local edits.
git pull --ff-only --quiet 2>/dev/null

DUE=$(python scripts/check_due.py 2>/dev/null | tail -n1)
if [ -z "$DUE" ]; then
  log "nothing due"
  exit 0
fi

ACTIVE=$(gh run list -R "$REPO" --workflow update-data.yml --json status \
  --jq '[.[] | select(.status=="in_progress" or .status=="queued")] | length' 2>/dev/null)
if [ "${ACTIVE:-0}" != "0" ]; then
  log "rounds due ($DUE) but a run is already active"
  exit 0
fi

NOW=$(date +%s)
LAST=$(cat "$STATE" 2>/dev/null || echo 0)
if [ $((NOW - LAST)) -lt $COOLDOWN ]; then
  log "rounds due ($DUE) but last dispatch was recent; waiting"
  exit 0
fi

log "rounds due: $DUE — dispatching"
if gh workflow run update-data.yml -R "$REPO"; then
  echo "$NOW" > "$STATE"
else
  log "dispatch failed"
fi
