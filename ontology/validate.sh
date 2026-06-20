#!/usr/bin/env bash
# Understood suite ontology validation pipeline.
# Syntax (riot) + SPARQL proofs via Docker Jena — same gate as Re_Call.
#
# Usage:
#   ./ontology/validate.sh
#   ./ontology/validate.sh ontology/adam-beliefs.ttl
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
JENA=(docker run --rm -v "$ROOT":/data stain/jena)

FILES=("${@:-}")
if [ -z "${FILES[0]:-}" ]; then
  FILES=(
    ontology/understood-suite.ttl
    ontology/adam-beliefs.ttl
    ontology/adam-beliefs-bundle.ttl
    fixtures/ontology/suite-bundle.ttl
  )
fi

echo "== 1/3  Syntactic validation (riot --validate) =="
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    printf "  skip %-40s (missing)\n" "$f"
    continue
  fi
  if "${JENA[@]}" riot --validate "/data/$f" >/dev/null 2>&1; then
    n=$("${JENA[@]}" riot --output=NT "/data/$f" 2>/dev/null | wc -l | tr -d ' ')
    printf "  ok   %-40s %s triples\n" "$f" "$n"
  else
    printf "  FAIL %s\n" "$f"
    "${JENA[@]}" riot --validate "/data/$f" 2>&1 | sed 's/^/       /'
    exit 1
  fi
done

echo
echo "== 2/3  Adam beliefs connection count (SPARQL) =="
if [ -f ontology/adam-beliefs.ttl ]; then
  "${JENA[@]}" sparql --data=/data/ontology/adam-beliefs.ttl --query=/data/ontology/queries/count-connections.rq --results=text
else
  echo "  skip ontology/adam-beliefs.ttl (missing)"
fi

echo
echo "== 3/3  Protégé reminder =="
echo "  For OWL logical consistency, open ontology/adam-beliefs-bundle.ttl in Protégé and run HermiT."

echo
echo "All Docker checks passed."
