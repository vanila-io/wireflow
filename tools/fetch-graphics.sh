#!/bin/bash
# Download the exact production graphics (102 SVGs) listed in data/graphics.json into public/graphics/.
# Run from the project root while wireflow.co still serves them: bash tools/fetch-graphics.sh
set -euo pipefail
python3 -I -c 'import json;[print(g["src"]) for g in json.load(open("data/graphics.json"))]' | while read -r p; do
  out="public$p"; mkdir -p "$(dirname "$out")"
  [ -s "$out" ] || { curl -fsS "https://wireflow.co$p" -o "$out"; sleep 0.3; }
done
echo done
