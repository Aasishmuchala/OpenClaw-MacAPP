#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm install
npm run tauri build

echo
echo "Built bundles under:"
echo "  src-tauri/target/release/bundle"
