#!/usr/bin/env bash
# Take theme .env files out of every copy the push-service hands back out.
#
# Until the push-service kept them apart (see ENV_FILES in push-service.mjs), a
# theme's root .env files were stored inside its retained source (served by
# `theme pull` and the dashboard download), copied into marketplace listings
# (cloned by buyers, installed into their stores) and saved in `theme dev`
# checkpoints. This moves them to where the service now keeps them:
#
#   _sources/<store>/<v>.tgz       → the .env files move to <v>.env.tar.gz
#                                    (owner-only), which a rebuild of <v> reads
#   _market/<theme>/<ver>/.env*    → deleted (they belong to the creator's store)
#   _checkpoints/<store>.tgz       → the .env files are dropped
#
# Live and recent build directories are NOT touched: the running stores need
# their own .env files.
#
#   sudo bash ops/strip-env-from-stored-themes.sh            # report only
#   sudo bash ops/strip-env-from-stored-themes.sh --apply    # make the changes
set -euo pipefail
ROOT=${KURUMERA_PUSH_ROOT:-/home/ubuntu/theme-pushes}
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
ENV_RE='^\./\.env(\.local|\.production|\.production\.local|\.development|\.development\.local|\.test|\.test\.local)?$'
ENV_NAMES='^\.env(\.local|\.production|\.production\.local|\.development|\.development\.local|\.test|\.test\.local)?$'

srcs=0; markets=0; checkpoints=0; failed=0

# Rewrite archive $1 without its root .env members; if $2 is set, save those
# members there first. Verifies the result before swapping it in.
strip_archive() {
  local tgz=$1 keep=${2:-} work members
  members=$(tar -tzf "$tgz" | grep -E "$ENV_RE" || true)
  [ -z "$members" ] && return 1
  [ "$APPLY" = 1 ] || { echo "  would strip $(echo $members | tr '\n' ' ')from $tgz"; return 0; }
  work=$(mktemp -d)
  tar -xzf "$tgz" -C "$work"
  if [ -n "$keep" ] && [ ! -e "$keep" ]; then
    (umask 077; tar -czf "$keep" -C "$work" $members)
    chmod 600 "$keep"
  fi
  local excludes=() m
  for m in $members; do excludes+=("--exclude=$m"); done
  tar -czf "$tgz.new" "${excludes[@]}" -C "$work" .
  # The new archive must be exactly the old one minus the .env members.
  if diff <(tar -tzf "$tgz" | grep -vE "$ENV_RE" | sort) <(tar -tzf "$tgz.new" | sort) >/dev/null; then
    mv "$tgz.new" "$tgz"
    echo "  stripped $(echo $members | tr '\n' ' ')from $tgz"
  else
    rm -f "$tgz.new"; echo "  FAILED to verify $tgz — left unchanged"; failed=$((failed + 1))
  fi
  rm -rf "$work"
}

echo "== retained sources"
for tgz in "$ROOT"/_sources/*/*.tgz; do
  [ -e "$tgz" ] || continue
  strip_archive "$tgz" "${tgz%.tgz}.env.tar.gz" && srcs=$((srcs + 1)) || true
done

echo "== marketplace copies"
for d in "$ROOT"/_market/*/*/; do
  [ -d "$d" ] || continue
  for f in $(ls -a "$d" | grep -E "$ENV_NAMES" || true); do
    if [ "$APPLY" = 1 ]; then rm -f "$d$f"; echo "  deleted $d$f"; else echo "  would delete $d$f"; fi
    markets=$((markets + 1))
  done
done

echo "== checkpoints"
for tgz in "$ROOT"/_checkpoints/*.tgz; do
  [ -e "$tgz" ] || continue
  strip_archive "$tgz" && checkpoints=$((checkpoints + 1)) || true
done

echo
echo "sources: $srcs, marketplace files: $markets, checkpoints: $checkpoints, failed: $failed$([ "$APPLY" = 1 ] || echo ' (report only — re-run with --apply)')"
[ "$failed" = 0 ]
