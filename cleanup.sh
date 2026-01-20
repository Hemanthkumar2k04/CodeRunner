#!/bin/bash

# CodeRunner Aggressive Cleanup Script
# Cleans up all CodeRunner containers and networks
# Usage: ./cleanup.sh [--silent]

set -e

SILENT=false
if [ "$1" == "--silent" ]; then
  SILENT=true
fi

log() {
  if [ "$SILENT" = false ]; then
    printf "%s\n" "$1"
  fi
}

NETWORK_PREFIX="coderunner-session-"

# 1. Aggressively kill ALL containers attached to CodeRunner networks
log "Step 1: Identifying and removing containers in CodeRunner networks..."

# Method A: Find containers by network name
# We find networks matching the prefix, then inspect them to find attached containers
# Only piping to xargs if output is not empty
CONTAINERS_IN_NETWORKS=$(docker network ls --filter "name=${NETWORK_PREFIX}" --quiet | \
  xargs -I {} docker network inspect {} --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | tr ' ' '\n' | grep -v '^$' || echo "")

# Method B & C
CONTAINERS_BY_LABEL=$(docker ps -a --filter "label=type=coderunner-session" --quiet)

# Combine and deduplicate
ALL_CONTAINERS=$(printf "%s\n%s" "$CONTAINERS_IN_NETWORKS" "$CONTAINERS_BY_LABEL" | sort -u | grep -v '^$' || true)

if [ -n "$ALL_CONTAINERS" ]; then
  COUNT=$(echo "$ALL_CONTAINERS" | wc -l)
  log "Found ${COUNT} containers to remove."
  
  # Kill and remove using standard xargs (gnu -r is avoided by check above, but safe to just Pipe if empty is impossible or handled)
  echo "$ALL_CONTAINERS" | xargs docker kill >/dev/null 2>&1 || true
  echo "$ALL_CONTAINERS" | xargs docker rm -f >/dev/null 2>&1 || true
  log "✓ Containers removed."
else
  log "✓ No containers found."
fi

# 2. Remove all CodeRunner networks
log "Step 2: Removing CodeRunner networks..."
NETWORKS=$(docker network ls --filter "name=${NETWORK_PREFIX}" --quiet)

if [ -n "$NETWORKS" ]; then
  COUNT=$(echo "$NETWORKS" | wc -l)
  log "Found ${COUNT} networks to remove."
  echo "$NETWORKS" | xargs docker network rm >/dev/null 2>&1 || true
  log "✓ Networks removed."
else
  log "✓ No networks found."
fi

log "✓ Cleanup complete."
