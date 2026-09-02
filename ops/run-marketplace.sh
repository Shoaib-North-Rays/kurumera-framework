#!/usr/bin/env bash
#
# Build and deploy the marketplace container on the host.
#
# Exists for the same reason ops/run-push-service.sh does: this container was
# only ever created by hand, so its image tag, network, environment and
# healthcheck lived in shell history. Reconstructing that from memory is how
# the push-service was taken down, and the marketplace was one mistake away
# from the same thing.
#
# What this protects against, specifically:
#   · Building with the wrong origins. next.config.mjs bakes them at BUILD
#     time, so `docker run -e` cannot correct a bad build — they are passed as
#     build args here, taken from the container already running.
#   · Losing the healthcheck. It is set at run time, not in the Dockerfile, so
#     recreating by hand silently drops it.
#   · Replacing a working site with a broken one. The old container is only
#     removed after the image builds, and if the new one does not become
#     healthy the previous image is put back.
#
# Safe to re-run. Takes no arguments.
set -euo pipefail

NAME=kurumera-marketplace
REPO=/home/ubuntu/kurumera-framework
APP="$REPO/apps/marketplace"
NETWORK=website-builder_web
PORT=4400
HEALTH_CMD="wget -qO- http://127.0.0.1:${PORT}/api/health >/dev/null 2>&1 || exit 1"
# How long the new container gets to answer before it is judged a failure.
HEALTH_START=20s
# How long the new container gets before it is judged a failure.
#
# Measured, not guessed: a container that stays up but serves nothing is
# reported unhealthy after 91s with the interval and retries below, and the
# start period adds its 20s on top -- about 110s to a definite verdict. 120
# left 29s of margin, close enough that a loaded host would trip the timeout
# instead, rolling back for the right reason but reporting the wrong one. 180
# makes "unhealthy" the branch that actually fires.
HEALTH_WAIT=180

# ── What is running now, so we can both copy it and fall back to it ─────────
PREV_IMAGE=""
if docker inspect "$NAME" >/dev/null 2>&1; then
  PREV_IMAGE=$(docker inspect "$NAME" --format '{{.Config.Image}}')
  echo "currently running: $PREV_IMAGE"
fi

# ── Environment: carry the running container's forward ──────────────────────
# These are the values the image is BUILT with, so they must be read before the
# build, not after. Defaults are the production origins, matching
# next.config.mjs, so a first-ever run on a clean box still produces a correct
# image rather than a subtly wrong one.
get_env() {
  local key="$1" fallback="$2" val=""
  if [ -n "$PREV_IMAGE" ]; then
    val=$(docker inspect "$NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' \
          | sed -n "s/^${key}=//p" | head -1)
  fi
  echo "${val:-$fallback}"
}
MARKET_ORIGIN=$(get_env KURUMERA_MARKET_ORIGIN  "https://themekit.kurumera.com")
AUTH_ORIGIN=$(get_env   KURUMERA_AUTH_ORIGIN    "https://kurumera.com")
BUILDER_ORIGIN=$(get_env KURUMERA_BUILDER_ORIGIN "https://builder.kurumera.com")
echo "  market origin : $MARKET_ORIGIN"
echo "  auth origin   : $AUTH_ORIGIN"
echo "  builder origin: $BUILDER_ORIGIN"

# ── Next tag in the pNN series. Old images are kept, deliberately: they are
#    the rollback targets, here and for a human later. ────────────────────────
LAST=$(docker images "$NAME" --format '{{.Tag}}' | sed -n 's/^p\([0-9]\{1,\}\)$/\1/p' | sort -n | tail -1)
TAG="p$(( ${LAST:-0} + 1 ))"
IMAGE="$NAME:$TAG"

# ── Build FIRST. A failed build must never take the site down. ──────────────
echo "building $IMAGE …"
docker build \
  --build-arg "KURUMERA_MARKET_ORIGIN=$MARKET_ORIGIN" \
  --build-arg "KURUMERA_AUTH_ORIGIN=$AUTH_ORIGIN" \
  --build-arg "KURUMERA_BUILDER_ORIGIN=$BUILDER_ORIGIN" \
  -q -t "$IMAGE" "$APP" >/dev/null
echo "built $IMAGE"

start_container() {
  local image="$1"
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" --restart unless-stopped \
    --network "$NETWORK" \
    -e "PORT=$PORT" \
    -e "KURUMERA_MARKET_ORIGIN=$MARKET_ORIGIN" \
    -e "KURUMERA_AUTH_ORIGIN=$AUTH_ORIGIN" \
    -e "KURUMERA_BUILDER_ORIGIN=$BUILDER_ORIGIN" \
    --health-cmd "$HEALTH_CMD" \
    --health-interval 30s --health-timeout 5s --health-retries 3 --health-start-period "$HEALTH_START" \
    "$image" >/dev/null
}

# Poll rather than sleep a fixed amount: a good deploy should not be slowed to
# the speed of the worst one.
wait_healthy() {
  local waited=0
  while [ "$waited" -lt "$HEALTH_WAIT" ]; do
    case "$(docker inspect "$NAME" --format '{{.State.Health.Status}}' 2>/dev/null || echo gone)" in
      healthy) return 0 ;;
      unhealthy) return 1 ;;
    esac
    sleep 3; waited=$(( waited + 3 ))
  done
  return 1
}

echo "starting $IMAGE …"
start_container "$IMAGE"

if wait_healthy; then
  # Healthy is necessary, not sufficient — ask the app itself, and report the
  # upstream registry, which /api/health answers separately by design.
  echo "healthy. /api/health says:"
  docker exec "$NAME" wget -qO- "http://127.0.0.1:${PORT}/api/health" | head -c 300; echo
  echo "deployed $IMAGE"
  exit 0
fi

echo "FAILED: $IMAGE did not become healthy within ${HEALTH_WAIT}s" >&2
docker logs --tail 40 "$NAME" >&2 || true

if [ -n "$PREV_IMAGE" ]; then
  echo "rolling back to $PREV_IMAGE" >&2
  start_container "$PREV_IMAGE"
  if wait_healthy; then
    echo "rolled back to $PREV_IMAGE — the site is up on the previous build" >&2
  else
    echo "ROLLBACK ALSO UNHEALTHY — the site is down, needs a human" >&2
  fi
else
  echo "no previous image to roll back to" >&2
fi
exit 1
