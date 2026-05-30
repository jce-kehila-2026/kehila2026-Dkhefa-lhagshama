#!/usr/bin/env bash
# Claude Code PostToolUse hook.
# Guards the exact footgun that broke this project's dev server: a CSS comment
# block losing its opening `/*` (or an unbalanced `*/`) makes Turbopack/PostCSS
# fail with "Invalid dangling combinator" and a 500. We catch it at edit time.
#
# Reads the tool payload as JSON on stdin; only acts on .css writes/edits.
set -euo pipefail

payload="$(cat)"
file="$(printf '%s' "$payload" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//; s/"$//')"

[ -z "${file:-}" ] && exit 0
case "$file" in
  *.css) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

# `|| true` so a zero-match grep (exit 1) doesn't trip `set -e`/pipefail.
opens="$( { grep -o '/\*' "$file" || true; } | wc -l | tr -d ' ')"
closes="$( { grep -o '\*/' "$file" || true; } | wc -l | tr -d ' ')"

if [ "$opens" != "$closes" ]; then
  echo "⚠️  CSS comment imbalance in $file: ${opens} '/*' vs ${closes} '*/'. A block likely lost its opening or closing delimiter — this crashes the Turbopack dev server (500, 'Invalid dangling combinator'). Fix before relying on dev." >&2
  # Exit 2 surfaces this back to Claude as actionable feedback without hard-failing the edit.
  exit 2
fi
exit 0
