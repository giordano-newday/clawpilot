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

printf '%s\n' 'Clawpilot Browser — Web Commands Manual Test'

run_test 'web search "github copilot"' web search 'github copilot'
run_test 'web search "playwright browser automation" --max-results 3' web search 'playwright browser automation' --max-results 3
run_test 'web fetch "https://example.com"' web fetch 'https://example.com'
run_test 'web fetch "https://example.com" --readability' web fetch 'https://example.com' --readability
run_test 'auth status' auth status
run_test 'auth status --validate' auth status --validate
run_test 'health full' health full

printf '\nResults: %s passed, %s failed\n' "$PASS" "$FAIL"

[ "$FAIL" -eq 0 ] || exit 1
