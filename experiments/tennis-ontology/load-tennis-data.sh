#!/usr/bin/env bash
set -euo pipefail

curl -fsS \
  -u admin:tennis \
  -X POST \
  --data-binary @tennis.ttl \
  -H 'Content-Type: text/turtle' \
  'http://localhost:3030/tennis/data?default' >/dev/null

echo "Loaded tennis.ttl into http://localhost:3030/tennis"
