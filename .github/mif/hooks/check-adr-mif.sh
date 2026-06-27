#!/usr/bin/env bash
# PostToolUse(Write|Edit) advisory hook: when an ADR under the configured adrPath
# is written/edited, validate just that file against the MIF level in
# .github/mif/config.yml and surface any non-conformance as a reminder.
#
# Advisory by default (warns, never blocks). Set MIF_HOOK_STRICT=1 to block.

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // ""')
[ -z "$file" ] && exit 0

# Resolve repo root (the dir holding .github/mif/config.yml), walking up from the file.
dir=$(cd "$(dirname "$file")" 2>/dev/null && pwd || echo "")
root=""
d="$dir"
while [ -n "$d" ] && [ "$d" != "/" ]; do
  if [ -f "$d/.github/mif/config.yml" ]; then root="$d"; break; fi
  d=$(dirname "$d")
done
[ -z "$root" ] && exit 0

adrPath=$(grep -E '^adrPath:' "$root/.github/mif/config.yml" 2>/dev/null | sed 's/^adrPath:[[:space:]]*//; s/[[:space:]]*#.*$//; s/[[:space:]]*$//' | tr -d '"' )
adrPath="${adrPath:-docs/decisions}"
case "$file" in
  *"$adrPath"/*.md) : ;;   # an ADR under the configured path
  *) exit 0 ;;
esac

base=$(basename "$file")
out=$(cd "$root" && node .github/mif/bin/mif-validate.js --path "$adrPath" --pattern "$base" 2>&1)
rc=$?
if [ "$rc" != "0" ]; then
  details=$(printf '%s' "$out" | grep -F '::error' | sed 's/.*:://' | head -3 | paste -sd'; ' -)
  reason="MIF conformance: ${base} does not yet project clean at the configured level — ${details}"
  # Build JSON with jq so quotes/newlines/backslashes in $reason are escaped.
  if [ "${MIF_HOOK_STRICT:-0}" = "1" ]; then
    jq -nc --arg r "$reason" '{decision:"block",reason:$r}'
  else
    jq -nc --arg r "$reason" '{systemMessage:$r}'
  fi
fi
exit 0
