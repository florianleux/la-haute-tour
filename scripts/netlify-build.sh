#!/usr/bin/env bash
# Déclenche un build manuel sur Netlify sans laisser le pipeline ouvert.
# stop_builds reste actif en permanence sur ce site (budget) : on le lève,
# on déclenche, on attend la fin, on reverrouille — toujours, même en échec.
set -uo pipefail

SITE=2b924aed-54bf-4b8c-8956-9e9569da1142

relock() {
  netlify api updateSite --data "{\"site_id\":\"$SITE\",\"body\":{\"build_settings\":{\"stop_builds\":true}}}" > /dev/null
  echo "stop_builds reverrouillé."
}
trap relock EXIT

echo "Déverrouillage du pipeline de build..."
netlify api updateSite --data "{\"site_id\":\"$SITE\",\"body\":{\"build_settings\":{\"stop_builds\":false}}}" > /dev/null

echo "Déclenchement du build..."
build_id=$(netlify api createSiteBuild --data "{\"site_id\":\"$SITE\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "Build $build_id lancé, attente..."

state=""
until [ "$state" = "ready" ] || [ "$state" = "error" ]; do
  sleep 10
  state=$(netlify api getSiteBuild --data "{\"site_id\":\"$SITE\",\"build_id\":\"$build_id\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['deploy_state'])")
  echo "  état : $state"
done

if [ "$state" = "error" ]; then
  echo "Build en échec."
  exit 1
fi

echo "Build prêt (publish reste verrouillé séparément)."
