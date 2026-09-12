#!/usr/bin/env bash
#
# Run the pipeline over several seasons, in fresh processes.
#
#   scripts/backfill.sh 2022 2021 2020 2019 2018
#
# precompute loads reliably for a dozen or so races and then starts failing on
# everything, while a brand new process loads the very round that just failed,
# immediately. Whatever degrades does not recover by waiting — an earlier run
# backed off for three, four, then five minutes and never wrote another file.
#
# So precompute now stops after a few consecutive failures, and this restarts
# it. Rounds already on disk are skipped, so each process resumes where the
# last stopped and the work accumulates. It gives up only when a whole pass
# adds nothing, which means what is left is genuinely unavailable rather than
# a tired process.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SEASONS=("$@")
if [ ${#SEASONS[@]} -eq 0 ]; then
  echo "usage: scripts/backfill.sh <season> [season...]" >&2
  exit 2
fi

PYTHON="$ROOT/.venv/bin/python"
[ -x "$PYTHON" ] || PYTHON="python3"

count_races () {
  find data -name '[0-9]*.json.gz' ! -name '*.tel.*' 2>/dev/null | wc -l | tr -d ' '
}

# A pass that adds nothing means there is no more to get; two in a row is the
# stopping condition, so one unlucky pass does not end the run.
MAX_PASSES=40
barren=0
pass=1
start_total=$(count_races)

while [ $pass -le $MAX_PASSES ]; do
  before=$(count_races)
  echo
  echo "=== pass $pass · $before races on disk ==="

  "$PYTHON" scripts/precompute.py --seasons "${SEASONS[@]}" 2>&1 \
    | grep -viE "^(core|req|api|_api|utils|logger) +(INFO|WARNING)"

  after=$(count_races)
  gained=$((after - before))
  echo "--- pass $pass added $gained race(s) ---"

  if [ "$gained" -eq 0 ]; then
    barren=$((barren + 1))
    if [ $barren -ge 2 ]; then
      echo
      echo "Two passes in a row added nothing; stopping."
      break
    fi
    # A short rest before the confirming pass, in case something upstream was
    # briefly unavailable.
    echo "Nothing gained; resting 60s before one more attempt."
    sleep 60
  else
    barren=0
  fi

  pass=$((pass + 1))
done

echo
echo "Added $(( $(count_races) - start_total )) race(s) over $pass pass(es)."
echo "Now verifying."
"$PYTHON" scripts/verify.py
