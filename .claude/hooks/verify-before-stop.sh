#!/usr/bin/env bash
# Stop: before Claude ends its turn, lint every changed file, then typecheck and test
# every workspace with uncommitted changes. Exit 2 blocks the stop and feeds failures back to Claude.
# Claude Code overrides a Stop hook after 8 consecutive blocks, so this cannot loop forever.
# A passing run records a fingerprint of the working tree; turns that change no files
# (questions, reviews) match it and skip the suite.
set -uo pipefail
cat > /dev/null   # consume hook input

cd "$CLAUDE_PROJECT_DIR" || exit 0
git rev-parse --is-inside-work-tree > /dev/null 2>&1 || exit 0

CHANGED=$(git status --porcelain --untracked-files=all | awk '{print $NF}')
[ -z "$CHANGED" ] && exit 0

# Hash of staged, unstaged, and untracked content; any file change produces a new value.
working_tree_fingerprint() {
  {
    git diff --cached --binary
    git diff --binary
    git ls-files --others --exclude-standard
    git ls-files --others --exclude-standard -z | xargs -0 git hash-object --
  } | git hash-object --stdin
}

VERIFIED_FILE=$(git rev-parse --git-path claude-verified-tree)
[ "$(working_tree_fingerprint)" = "$(cat "$VERIFIED_FILE" 2>/dev/null)" ] && exit 0

# Lint every changed .ts/.tsx file: the PostToolUse hook only sees Edit and Write, so files
# changed through Bash (sed, heredocs) reach this point unlinted.
TS_FILES=()
while IFS= read -r -d '' ENTRY; do
  STATUS=${ENTRY:0:2}
  FILE=${ENTRY:3}
  case "$STATUS" in R*|C*) IFS= read -r -d '' _RENAMED_FROM ;; esac   # renames emit the old path as a second record
  case "$STATUS" in *D*) continue ;; esac
  case "$FILE" in
    *.ts|*.tsx) [ -f "$FILE" ] && TS_FILES+=("$FILE") ;;
  esac
done < <(git status --porcelain=v1 -z --untracked-files=all)

if [ ${#TS_FILES[@]} -gt 0 ]; then
  if ! OUTPUT=$(yarn eslint --fix "${TS_FILES[@]}" 2>&1); then
    echo "ESLint errors remain after --fix. Fix the cause; do not disable the rule:" >&2
    echo "$OUTPUT" | tail -n 40 >&2
    exit 2
  fi
fi

WORKSPACES=()
if grep -q '^packages/' <<<"$CHANGED"; then
  WORKSPACES=(packages/*/ apps/webapp apps/backend)   # shared code affects both apps
else
  grep -q '^apps/webapp/' <<<"$CHANGED" && WORKSPACES+=(apps/webapp)
  grep -q '^apps/backend/' <<<"$CHANGED" && WORKSPACES+=(apps/backend)
fi
if [ ${#WORKSPACES[@]} -eq 0 ]; then
  working_tree_fingerprint > "$VERIFIED_FILE"   # linted and nothing to typecheck or test
  exit 0
fi

# Prints the workspace's package name if its package.json defines the script; nothing otherwise.
# Uses only `yarn workspace <name> run`, which Yarn 1 and Yarn 4 both support.
name_if_script_defined() {
  node -e 'const p = require(require("path").resolve(process.argv[1], "package.json"));
    if (p.scripts?.[process.argv[2]]) console.log(p.name)' "$1" "$2" 2>/dev/null
}

for SCRIPT in typecheck test; do
  for DIR in "${WORKSPACES[@]}"; do
    NAME=$(name_if_script_defined "$DIR" "$SCRIPT")
    [ -z "$NAME" ] && continue
    if ! OUTPUT=$(yarn workspace "$NAME" run "$SCRIPT" 2>&1); then
      echo "'$SCRIPT' is failing in $NAME. Fix it before finishing (never by weakening tests):" >&2
      echo "$OUTPUT" | tail -n 60 >&2
      exit 2
    fi
  done
done

# Fingerprint after the run so files the suite itself writes don't force a rerun next turn.
working_tree_fingerprint > "$VERIFIED_FILE"
exit 0
