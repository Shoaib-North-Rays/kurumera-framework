#!/usr/bin/env bash
#
# (Re)create the push-service container on the host.
#
# Exists because recreating it by hand is a trap: the image must carry the
# docker CLI (see ops/Dockerfile.push) and the container must keep its
# environment, and getting either wrong takes down every store preview
# without producing a single error in the service's own log.
#
# Safe to re-run. Reads the existing container's environment so a restart
# never needs the secrets to be retyped or stored in the repo.
set -euo pipefail

NAME=kurumera-push
IMAGE=kurumera-push-runtime:1
REPO=/home/ubuntu/kurumera-framework
PUSHES=/home/ubuntu/theme-pushes
NETWORK=website-builder_web

cd "$REPO"
docker build -q -t "$IMAGE" -f ops/Dockerfile.push ops/ >/dev/null
echo "built $IMAGE"

# Carry the running container's environment forward. If there is no container
# to read from, require an env file rather than starting a half-configured
# service that fails only once a customer hits it.
ENV_ARGS=()
if docker inspect "$NAME" >/dev/null 2>&1; then
  while IFS= read -r kv; do
    case "$kv" in
      KURUMERA_*) ENV_ARGS+=(-e "$kv") ;;
    esac
  done < <(docker inspect "$NAME" --format '{{range .Config.Env}}{{println .}}{{end}}')
elif [ -f "$PUSHES/.push-env" ]; then
  while IFS= read -r kv; do
    [ -n "$kv" ] && ENV_ARGS+=(-e "$kv")
  done < <(grep -E '^KURUMERA_[A-Z_]+=' "$PUSHES/.push-env")
else
  echo "refusing to start: no existing container to copy env from, and no $PUSHES/.push-env" >&2
  exit 1
fi
echo "carrying ${#ENV_ARGS[@]} environment settings forward"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
  --network "$NETWORK" -p 9200:9200 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PUSHES:$PUSHES" \
  -v "$REPO/ops:/ops" \
  -w "$PUSHES" \
  "${ENV_ARGS[@]}" \
  "$IMAGE" node /ops/push-service.mjs >/dev/null
echo "started $NAME"

# The failure this script exists to prevent. Assert it, do not assume it.
sleep 5
if ! docker exec "$NAME" docker ps >/dev/null 2>&1; then
  echo "FAILED: the container cannot reach the docker socket — previews will not wake" >&2
  exit 1
fi
echo "verified: docker CLI reachable from inside $NAME"
