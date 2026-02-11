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

# Method B: Find session containers by label
CONTAINERS_SESSION=$(docker ps -a --filter "label=type=coderunner-session" --quiet)

# Method C: Find kernel containers by label
CONTAINERS_KERNEL=$(docker ps -a --filter "label=type=coderunner-kernel" --quiet)

# Method D: Find any containers with coderunner in the name (safety net)
CONTAINERS_BY_NAME=$(docker ps -a --filter "name=coderunner" --quiet)

# Combine and deduplicate all methods
ALL_CONTAINERS=$(printf "%s\n%s\n%s\n%s" "$CONTAINERS_IN_NETWORKS" "$CONTAINERS_SESSION" "$CONTAINERS_KERNEL" "$CONTAINERS_BY_NAME" | sort -u | grep -v '^$' || true)

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

# Method A: Find by name prefix
NETWORKS_BY_NAME=$(docker network ls --filter "name=${NETWORK_PREFIX}" --quiet)

# Method B: Find by label (safety net)
NETWORKS_BY_LABEL=$(docker network ls --filter "label=type=coderunner" --quiet)

# Combine and deduplicate
NETWORKS=$(printf "%s\n%s" "$NETWORKS_BY_NAME" "$NETWORKS_BY_LABEL" | sort -u | grep -v '^$' || true)

if [ -n "$NETWORKS" ]; then
  COUNT=$(echo "$NETWORKS" | wc -l)
  log "Found ${COUNT} networks to remove."
  echo "$NETWORKS" | xargs docker network rm >/dev/null 2>&1 || true
  log "✓ Networks removed."
else
  log "✓ No networks found."
fi

# 3. Final verification
log "Step 3: Verifying cleanup..."
REMAINING_CONTAINERS=$(docker ps -a --filter "label=type=coderunner-session" --quiet; docker ps -a --filter "label=type=coderunner-kernel" --quiet | sort -u | grep -v '^$' || true)
REMAINING_NETWORKS=$(docker network ls --filter "name=${NETWORK_PREFIX}" --quiet; docker network ls --filter "label=type=coderunner" --quiet | sort -u | grep -v '^$' || true)

if [ -n "$REMAINING_CONTAINERS" ]; then
  log "⚠ Warning: Found $(echo "$REMAINING_CONTAINERS" | wc -l) remaining containers"
else
  log "✓ No remaining containers"
fi

if [ -n "$REMAINING_NETWORKS" ]; then
  log "⚠ Warning: Found $(echo "$REMAINING_NETWORKS" | wc -l) remaining networks"
else
  log "✓ No remaining networks"
fi

log "✓ Cleanup complete."
