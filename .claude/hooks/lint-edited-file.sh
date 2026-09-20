#!/usr/bin/env bash
# PostToolUse (Edit|Write): run ESLint on the file Claude just edited.
# One hook serves both apps; per-app differences live in eslint.config.mjs.
# Exit 2 sends the remaining errors back to Claude so it fixes them immediately.
# Parses the hook input with node (always present in these projects) so there is no jq dependency.
set -uo pipefail

FILE=$(node -e 'let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => console.log(JSON.parse(s).tool_input?.file_path ?? ""))')
case "$FILE" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0

if ! OUTPUT=$(yarn eslint --fix "$FILE" 2>&1); then
  if grep -q 'was not found by the project service' <<<"$OUTPUT"; then
    echo "$FILE is not in any tsconfig, so it is neither typechecked nor linted." >&2
    echo "Add it to the \"include\" of the owning app's tsconfig. Do not add it to allowDefaultProject or disable type-checked rules for it." >&2
    exit 2
  fi
  echo "ESLint errors remain in $FILE after --fix. Fix the cause; do not disable the rule:" >&2
  echo "$OUTPUT" | tail -n 40 >&2
  exit 2
fi
exit 0
