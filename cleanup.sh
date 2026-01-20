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
    echo "$1"
  fi
}

NETWORK_PREFIX="coderunner-session-"

# 1. Aggressively kill ALL containers attached to CodeRunner networks
log "Step 1: Identifying and removing containers in CodeRunner networks..."

# Method A: Find containers by network name
# We find networks matching the prefix, then inspect them to find attached containers
CONTAINERS_IN_NETWORKS=$(docker network ls --filter "name=${NETWORK_PREFIX}" --quiet | \
  xargs -I {} docker network inspect {} --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | tr ' ' '\n' | grep -v '^$' || echo "")

# Method B: Find containers by name pattern (if they follow a naming convention, not always true for random names)
# But we can also look for containers with specific labels if we add them. 
# For now, let's stick to network association and name pattern if possible, but network association is safest for random names.

# Method C: Find containers by label (best practice, but we need to ensure labels are applied)
CONTAINERS_BY_LABEL=$(docker ps -a --filter "label=type=coderunner-session" --quiet)

# Combine and deduplicate
ALL_CONTAINERS=$(echo -e "${CONTAINERS_IN_NETWORKS}\n${CONTAINERS_BY_LABEL}" | sort -u | grep -v '^$' || true)

if [ -n "$ALL_CONTAINERS" ]; then
  COUNT=$(echo "$ALL_CONTAINERS" | wc -l)
  log "Found ${COUNT} containers to remove."
  
  # Kill and remove
  # We use xargs for parallel execution if possible, or just batch it
  echo "$ALL_CONTAINERS" | xargs -r docker kill >/dev/null 2>&1 || true
  echo "$ALL_CONTAINERS" | xargs -r docker rm -f >/dev/null 2>&1 || true
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
  echo "$NETWORKS" | xargs -r docker network rm >/dev/null 2>&1 || true
  log "✓ Networks removed."
else
  log "✓ No networks found."
fi

# 3. Final Prune (Optional, maybe too aggressive for shared env, but good for dedicated)
# log "Step 3: Pruning unused networks..."
# docker network prune -f --filter "label=type=coderunner-session" >/dev/null 2>&1 || true

log "✓ Cleanup complete."
