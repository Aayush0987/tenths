#!/usr/bin/env bash
#
# Reclaim the disk this project is using once it is deployed.
#
#   scripts/reclaim.sh              # show what would go, delete nothing
#   scripts/reclaim.sh --yes        # actually delete
#   scripts/reclaim.sh --yes --keep-deps   # leave node_modules and .venv
#
# Everything removed here is regenerable. The source, the committed data and
# the git history are never touched, and the script refuses to run if anything
# is uncommitted — deleting build output is cheap, losing a race file that was
# never pushed is not.
#
# The FastF1 cache is the interesting one. It is several gigabytes and it is
# reached through a symlink, so removing the link frees a few dozen bytes and
# nothing else; the target has to go. It is also purely a download cache: the
# pipeline refills it on demand, and the scheduled workflow keeps its own copy
# in CI, so nothing local depends on it once the site is deployed.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APPLY=false
KEEP_DEPS=false
for arg in "$@"; do
  case "$arg" in
    --yes) APPLY=true ;;
    --keep-deps) KEEP_DEPS=true ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

# --- Safety: nothing unsaved ------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
  echo "There are uncommitted changes. Commit and push before reclaiming:"
  git status --short | sed 's/^/  /'
  exit 1
fi

if [ -n "$(git log --branches --not --remotes --oneline 2>/dev/null)" ]; then
  echo "There are commits that have not been pushed:"
  git log --branches --not --remotes --oneline | sed 's/^/  /'
  echo "Push them first — this machine would be the only copy."
  exit 1
fi

# --- What can go ------------------------------------------------------------
targets=(".next" "scripts/__pycache__")
$KEEP_DEPS || targets+=("node_modules" ".venv")

human () { du -sh -L "$1" 2>/dev/null | cut -f1 || echo "0B"; }

echo "Regenerable, in $ROOT:"
for t in "${targets[@]}"; do
  [ -e "$t" ] && printf "  %-22s %6s\n" "$t" "$(human "$t")"
done

# The cache: resolve the symlink and report the real location, because that is
# what actually holds the bytes.
CACHE_LINK="$ROOT/.fastf1-cache"
CACHE_REAL=""
if [ -e "$CACHE_LINK" ]; then
  CACHE_REAL="$(cd "$(dirname "$CACHE_LINK")" && python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$CACHE_LINK")"
  printf "  %-22s %6s" ".fastf1-cache" "$(human "$CACHE_LINK")"
  if [ "$CACHE_REAL" != "$CACHE_LINK" ]; then
    printf "   -> %s (a symlink; the target is what frees space)" "$CACHE_REAL"
  fi
  printf "\n"
fi

echo
echo "Never touched: data/ ($(human data)), .git/ ($(human .git)), and the source."

if ! $APPLY; then
  echo
  echo "Nothing deleted. Re-run with --yes to apply."
  exit 0
fi

# --- Apply ------------------------------------------------------------------
echo
for t in "${targets[@]}"; do
  if [ -e "$t" ]; then
    echo "removing $t"
    rm -rf "$t"
  fi
done

if [ -n "$CACHE_REAL" ] && [ -d "$CACHE_REAL" ]; then
  echo "removing the FastF1 cache at $CACHE_REAL"
  rm -rf "$CACHE_REAL"
  # Leave the link pointing at a directory that exists, so the next pipeline
  # run caches rather than silently failing to.
  mkdir -p "$CACHE_REAL"
fi

echo
echo "Done. To work on this again:"
echo "  npm ci                                     # dependencies"
echo "  python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt"
echo "  npm run build                              # or npm run dev"
echo
echo "Now using: $(du -sh -L "$ROOT" | cut -f1)"
