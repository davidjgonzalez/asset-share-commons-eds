#!/usr/bin/env bash
# Copies the ASC UI Kit gallery (docs/ui-kit.html) and the stylesheets it needs
# from the asset-share-commons-eds code repo into ./ui-kit so it is served at
# /ui-kit/ on this site. Re-run whenever the UI Kit changes, then commit ui-kit/.
#
# Usage: _tools/sync-ui-kit.sh [path/to/asset-share-commons-eds]
set -euo pipefail

SRC="${1:-$HOME/Code/asset-share-commons-eds}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/ui-kit"

[ -f "$SRC/docs/ui-kit.html" ] || { echo "Not an ASC repo: $SRC" >&2; exit 1; }

rm -rf "$DEST"
mkdir -p "$DEST/styles/themes"

# The gallery links ../styles/... (it lives in docs/ in the code repo); here the
# styles sit next to it, so drop the ../ .
sed 's#\.\./styles/#styles/#g' "$SRC/docs/ui-kit.html" > "$DEST/index.html"

for f in styles.css lazy-styles.css tokens.css ui-kit.css sections.css; do
  cp "$SRC/styles/$f" "$DEST/styles/$f"
done
cp "$SRC"/styles/themes/*.css "$DEST/styles/themes/"

echo "Synced UI Kit from $SRC to $DEST"
