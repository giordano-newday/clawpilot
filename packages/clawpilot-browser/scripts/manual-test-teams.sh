#!/bin/sh
set -e

CLI="node $(dirname "$0")/../dist/index.js"
PASS=0
FAIL=0

run_test() {
  NAME="$1"
  shift

  printf '\n=== %s ===\n' "$NAME"
  printf 'Command: %s' "$CLI"
  for arg in "$@"; do
    printf ' "%s"' "$arg"
  done
  printf '\n'

  if $CLI "$@"; then
    PASS=$((PASS + 1))
    printf 'Result: PASS\n'
  else
    FAIL=$((FAIL + 1))
    printf 'Result: FAIL\n'
  fi
}

extract_first_id() {
  node <<'NODE'
const fs = require('fs');
try {
  const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (!payload.ok || !payload.data) {
    process.exit(0);
  }

  const firstChat = payload.data.chats?.[0]?.id;
  const firstChannel = payload.data.channels?.[0]?.id;
  if (firstChat) {
    process.stdout.write(firstChat);
    process.exit(0);
  }
  if (firstChannel) {
    process.stdout.write(firstChannel);
  }
} catch {
  process.exit(0);
}
NODE
}

printf '%s\n' 'Clawpilot Browser — Teams Commands Manual Test'

run_test 'teams list' teams list
run_test 'teams list --json' teams list --json

LIST_JSON="$($CLI teams list --json 2>/dev/null || true)"
FIRST_ID="$(printf '%s' "$LIST_JSON" | extract_first_id)"

if [ -n "$FIRST_ID" ]; then
  run_test "teams read $FIRST_ID" teams read "$FIRST_ID"
  run_test "teams read $FIRST_ID --json" teams read "$FIRST_ID" --json
else
  printf '\nNo chat/channel id was discovered automatically.\n'
  printf 'If listing succeeds manually, copy an id from `teams list --json` and run:\n'
  printf '  %s teams read "<id>"\n' "$CLI"
fi

printf '\nResults: %s passed, %s failed\n' "$PASS" "$FAIL"

[ "$FAIL" -eq 0 ] || exit 1
