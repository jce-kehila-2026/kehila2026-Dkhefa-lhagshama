#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CR=".design-sync/clean-room"
PKG=".ds-nm/push-for-fulfillment-frontend"
DB="$PKG/.ds-build"

rm -rf .ds-nm .ds-pkg
mkdir -p "$DB"

cp frontend/package.json "$PKG/package.json"
cp "$CR/tsconfig.json" "$PKG/tsconfig.json"
cp -R frontend/src "$PKG/src"
cp "$CR/overrides/lib-firebase.ts" "$PKG/src/lib/firebase.ts"
cp -R "$CR/shims" "$DB/shims"

( cd frontend && npx tailwindcss \
    -i src/styles/globals.css \
    -o "$ROOT/$DB/tailwind.css" \
    --config tailwind.config.js >/dev/null 2>&1 )

S="$PKG/src/styles"
{
  printf "%s\n" "@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Noto+Sans+Hebrew:wght@300;400;500;700&display=swap');"
  cat "$DB/tailwind.css"
  cat "$S/tokens.css"
  cat "$S/base.css" "$S/utilities.css"
  cat "$S"/components/*.css
  cat "$S"/screens/*.css
} > "$DB/app.css"

node "$CR/make-barrel.mjs" "$PKG"

ln -sfn "$ROOT/frontend/node_modules" "$PKG/node_modules"

ln -sfn "$ROOT/frontend/node_modules/react" .ds-nm/react
ln -sfn "$ROOT/frontend/node_modules/react-dom" .ds-nm/react-dom
ln -sfn "$ROOT/frontend/node_modules/@types" .ds-nm/@types
for dep in lucide-react motion recharts firebase; do
  [ -e "$ROOT/frontend/node_modules/$dep" ] && ln -sfn "$ROOT/frontend/node_modules/$dep" ".ds-nm/$dep"
done

echo "clean room ready (real dir): $PKG ; css $(wc -c < "$DB/app.css") bytes"
