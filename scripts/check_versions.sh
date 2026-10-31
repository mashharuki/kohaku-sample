#!/usr/bin/env bash
# Compare npm dist-tags for Kohaku packages and (optionally) what a project has installed.
# Usage: bash check_versions.sh [project_dir]
set -u
PKGS="plugins provider privacy-pools tornado-cash"
printf "%-28s %-22s %-22s %s\n" package npm-latest npm-alpha installed
for p in $PKGS; do
  tags=$(npm view "@kohaku-eth/$p" dist-tags --json 2>/dev/null || echo '{}')
  latest=$(echo "$tags" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("latest","?"))' 2>/dev/null)
  alpha=$(echo "$tags" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("alpha","-"))' 2>/dev/null)
  inst="-"
  if [ -n "${1:-}" ] && [ -f "$1/node_modules/@kohaku-eth/$p/package.json" ]; then
    inst=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$1/node_modules/@kohaku-eth/$p/package.json")
  fi
  printf "%-28s %-22s %-22s %s\n" "@kohaku-eth/$p" "$latest" "$alpha" "$inst"
done
echo
echo "Note: the 'alpha' tag on plugins/provider points to an old release. Pin exact versions and read CHANGELOG.md + .changeset/ in github.com/ethereum/kohaku before upgrading."
